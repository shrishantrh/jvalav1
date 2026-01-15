import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 1Up Health API endpoints
const ONEUP_AUTH_URL = 'https://api.1up.health/user-management/v1/user/auth-code';
const ONEUP_TOKEN_URL = 'https://api.1up.health/fhir/oauth2/token';
const ONEUP_FHIR_URL = 'https://api.1up.health/fhir/dstu2';

interface EHRProvider {
  id: string;
  name: string;
  type: 'fhir' | 'proprietary';
  available: boolean;
  authType: 'oauth2' | 'api_key' | 'user_initiated';
  dataTypes: string[];
}

const EHR_PROVIDERS: Record<string, EHRProvider> = {
  '1uphealth': {
    id: '1uphealth',
    name: '1Up Health',
    type: 'fhir',
    available: true,
    authType: 'oauth2',
    dataTypes: ['conditions', 'medications', 'labs', 'claims', 'vitals', 'allergies'],
  },
  apple_health_records: {
    id: 'apple_health_records',
    name: 'Apple Health Records',
    type: 'fhir',
    available: true,
    authType: 'user_initiated',
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals', 'immunizations'],
  },
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const ONEUP_CLIENT_ID = Deno.env.get('ONEUP_CLIENT_ID');
    const ONEUP_CLIENT_SECRET = Deno.env.get('ONEUP_CLIENT_SECRET');

    const { action, userId, provider, code, appUserId } = await req.json();
    console.log(`EHR Connect: action=${action}, provider=${provider}, userId=${userId}`);

    switch (action) {
      case 'list_providers': {
        return new Response(JSON.stringify({
          providers: Object.values(EHR_PROVIDERS),
          has_1up_credentials: !!ONEUP_CLIENT_ID && !!ONEUP_CLIENT_SECRET,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'initiate_connection': {
        if (provider !== '1uphealth') {
          return new Response(JSON.stringify({
            status: 'user_action_required',
            message: 'This provider requires manual setup on your device.',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!ONEUP_CLIENT_ID || !ONEUP_CLIENT_SECRET) {
          throw new Error('1Up Health credentials not configured');
        }

        // Step 1: Create a 1Up Health user and get auth code
        // Note: 1Up Health API requires app_user_id to be a string identifier
        console.log('Creating 1Up Health user for:', userId);
        
        const authCodeResponse = await fetch(ONEUP_AUTH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            app_user_id: userId,
            client_id: ONEUP_CLIENT_ID,
            client_secret: ONEUP_CLIENT_SECRET,
          }),
        });

        const authData = await authCodeResponse.json();
        console.log('1Up auth response:', JSON.stringify(authData));

        if (!authCodeResponse.ok) {
          console.error('1Up auth code error:', authData);
          throw new Error(authData.error_description || authData.error || `Failed to get auth code: ${authCodeResponse.status}`);
        }

        // The response should contain 'code' for new users or might have different structure
        const authCode = authData.code;
        if (!authCode) {
          console.error('No auth code in response:', authData);
          throw new Error('1Up Health did not return an auth code. Please verify your API credentials are correct and have the right permissions.');
        }

        console.log('Got 1Up auth code successfully');

        // Step 2: Exchange auth code for access token
        const tokenResponse = await fetch(ONEUP_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: ONEUP_CLIENT_ID,
            client_secret: ONEUP_CLIENT_SECRET,
            code: authCode,
            grant_type: 'authorization_code',
          }),
        });

        const tokens = await tokenResponse.json();
        console.log('1Up token response status:', tokenResponse.status);

        if (!tokenResponse.ok) {
          console.error('1Up token error:', tokens);
          throw new Error(tokens.error_description || tokens.error || `Failed to get access token: ${tokenResponse.status}`);
        }
        console.log('Got 1Up access token:', tokens.access_token ? 'yes' : 'no');

        // Store tokens securely
        const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
        
        await supabase.from('ehr_tokens').upsert({
          user_id: userId,
          provider_id: '1uphealth',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
          scope: tokens.scope || null,
          metadata: { oneup_user_id: authData.oneup_user_id },
        }, { onConflict: 'user_id,provider_id' });

        // Update connection status
        await supabase.from('ehr_connections').upsert({
          user_id: userId,
          provider_id: '1uphealth',
          status: 'connected',
          last_sync_at: null,
          metadata: { 
            oneup_user_id: authData.oneup_user_id,
            connected_at: new Date().toISOString(),
          },
        }, { onConflict: 'user_id,provider_id' });

        // Return the 1Up Health provider connect URL for the user to link their health systems
        const connectUrl = `https://api.1up.health/connect/system/clinical?client_id=${ONEUP_CLIENT_ID}&access_token=${tokens.access_token}`;

        return new Response(JSON.stringify({
          status: 'connected',
          connect_url: connectUrl,
          message: 'Connected to 1Up Health! Click the link to connect your health systems.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_connect_url': {
        // Get the stored access token and return connect URL
        const { data: tokenData } = await supabase
          .from('ehr_tokens')
          .select('access_token')
          .eq('user_id', userId)
          .eq('provider_id', '1uphealth')
          .single();

        if (!tokenData?.access_token) {
          throw new Error('Not connected to 1Up Health. Please connect first.');
        }

        const connectUrl = `https://api.1up.health/connect/system/clinical?client_id=${ONEUP_CLIENT_ID}&access_token=${tokenData.access_token}`;

        return new Response(JSON.stringify({
          connect_url: connectUrl,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync_data': {
        // Get stored tokens
        const { data: tokenData, error: tokenError } = await supabase
          .from('ehr_tokens')
          .select('*')
          .eq('user_id', userId)
          .eq('provider_id', '1uphealth')
          .single();

        if (tokenError || !tokenData) {
          throw new Error('Not connected to 1Up Health');
        }

        // Check if token is expired and refresh if needed
        let accessToken = tokenData.access_token;
        if (new Date(tokenData.expires_at) < new Date()) {
          if (tokenData.refresh_token) {
            console.log('Refreshing 1Up token...');
            const refreshResponse = await fetch(ONEUP_TOKEN_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id: ONEUP_CLIENT_ID!,
                client_secret: ONEUP_CLIENT_SECRET!,
                refresh_token: tokenData.refresh_token,
                grant_type: 'refresh_token',
              }),
            });

            if (refreshResponse.ok) {
              const newTokens = await refreshResponse.json();
              accessToken = newTokens.access_token;
              
              await supabase.from('ehr_tokens').update({
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token || tokenData.refresh_token,
                expires_at: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString(),
              }).eq('user_id', userId).eq('provider_id', '1uphealth');
            }
          }
        }

        // Fetch FHIR data from 1Up Health
        console.log('Fetching FHIR data from 1Up Health...');
        
        const fhirResources: Record<string, any[]> = {
          conditions: [],
          medications: [],
          allergies: [],
          labs: [],
          vitals: [],
        };

        // Fetch Conditions
        try {
          const conditionsRes = await fetch(`${ONEUP_FHIR_URL}/Condition`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (conditionsRes.ok) {
            const data = await conditionsRes.json();
            fhirResources.conditions = data.entry?.map((e: any) => e.resource) || [];
            console.log(`Fetched ${fhirResources.conditions.length} conditions`);
          }
        } catch (e) {
          console.error('Error fetching conditions:', e);
        }

        // Fetch MedicationStatements
        try {
          const medsRes = await fetch(`${ONEUP_FHIR_URL}/MedicationStatement`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (medsRes.ok) {
            const data = await medsRes.json();
            fhirResources.medications = data.entry?.map((e: any) => e.resource) || [];
            console.log(`Fetched ${fhirResources.medications.length} medications`);
          }
        } catch (e) {
          console.error('Error fetching medications:', e);
        }

        // Fetch AllergyIntolerances
        try {
          const allergiesRes = await fetch(`${ONEUP_FHIR_URL}/AllergyIntolerance`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (allergiesRes.ok) {
            const data = await allergiesRes.json();
            fhirResources.allergies = data.entry?.map((e: any) => e.resource) || [];
            console.log(`Fetched ${fhirResources.allergies.length} allergies`);
          }
        } catch (e) {
          console.error('Error fetching allergies:', e);
        }

        // Fetch Observations (labs/vitals)
        try {
          const obsRes = await fetch(`${ONEUP_FHIR_URL}/Observation`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (obsRes.ok) {
            const data = await obsRes.json();
            const observations = data.entry?.map((e: any) => e.resource) || [];
            // Separate labs from vitals based on category
            fhirResources.labs = observations.filter((o: any) => 
              o.category?.some((c: any) => c.coding?.some((cd: any) => cd.code === 'laboratory'))
            );
            fhirResources.vitals = observations.filter((o: any) => 
              o.category?.some((c: any) => c.coding?.some((cd: any) => cd.code === 'vital-signs'))
            );
            console.log(`Fetched ${fhirResources.labs.length} labs, ${fhirResources.vitals.length} vitals`);
          }
        } catch (e) {
          console.error('Error fetching observations:', e);
        }

        // Store the FHIR data in the connection metadata
        const totalRecords = Object.values(fhirResources).reduce((sum, arr) => sum + arr.length, 0);
        
        await supabase.from('ehr_connections').update({
          last_sync_at: new Date().toISOString(),
          metadata: {
            last_sync_records: totalRecords,
            fhir_data: fhirResources,
            synced_at: new Date().toISOString(),
          },
        }).eq('user_id', userId).eq('provider_id', '1uphealth');

        return new Response(JSON.stringify({
          status: 'synced',
          records_synced: totalRecords,
          breakdown: {
            conditions: fhirResources.conditions.length,
            medications: fhirResources.medications.length,
            allergies: fhirResources.allergies.length,
            labs: fhirResources.labs.length,
            vitals: fhirResources.vitals.length,
          },
          last_sync: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_fhir_data': {
        const { data: connection } = await supabase
          .from('ehr_connections')
          .select('*')
          .eq('user_id', userId)
          .eq('provider_id', provider || '1uphealth')
          .single();

        if (!connection) {
          return new Response(JSON.stringify({
            status: 'not_connected',
            message: 'Connect to 1Up Health first to import your records.',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const metadata = connection.metadata as any;
        
        return new Response(JSON.stringify({
          status: 'success',
          resources: metadata?.fhir_data || {
            conditions: [],
            medications: [],
            allergies: [],
            labs: [],
            vitals: [],
          },
          last_sync: connection.last_sync_at,
          records_count: metadata?.last_sync_records || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        await supabase.from('ehr_connections')
          .delete()
          .eq('user_id', userId)
          .eq('provider_id', provider);

        await supabase.from('ehr_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('provider_id', provider);

        return new Response(JSON.stringify({
          status: 'disconnected',
          message: 'Successfully disconnected from EHR provider.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('EHR connect error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
