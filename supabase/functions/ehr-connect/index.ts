import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EHRProvider {
  id: string;
  name: string;
  type: 'fhir' | 'proprietary';
  available: boolean;
  authType: 'oauth2' | 'api_key' | 'user_initiated';
  baseUrl?: string;
  dataTypes: string[];
  setupSteps: string[];
}

const EHR_PROVIDERS: Record<string, EHRProvider> = {
  apple_health_records: {
    id: 'apple_health_records',
    name: 'Apple Health Records',
    type: 'fhir',
    available: true,
    authType: 'user_initiated',
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals', 'immunizations'],
    setupSteps: [
      'Open the Health app on your iPhone',
      'Tap your profile picture in the top right',
      'Tap "Health Records"',
      'Tap "Get Started" or "Add Account"',
      'Search for your healthcare provider',
      'Sign in with your patient portal credentials',
      'Your data will sync automatically to Jvala',
    ],
  },
  '1uphealth': {
    id: '1uphealth',
    name: '1Up Health',
    type: 'fhir',
    available: true,
    authType: 'oauth2',
    baseUrl: 'https://api.1up.health/fhir/r4',
    dataTypes: ['conditions', 'medications', 'labs', 'claims', 'vitals'],
    setupSteps: [
      'Click "Connect" to start',
      'You will be redirected to 1Up Health',
      'Search for your health plan or provider',
      'Sign in with your credentials',
      'Authorize Jvala to access your records',
      'Data syncs within 24 hours',
    ],
  },
  epic: {
    id: 'epic',
    name: 'Epic MyChart',
    type: 'fhir',
    available: true,
    authType: 'oauth2',
    baseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals', 'encounters', 'immunizations'],
    setupSteps: [
      'Click "Connect" to start',
      'You will be redirected to Epic MyChart',
      'Search for your hospital or clinic',
      'Sign in with your MyChart credentials',
      'Authorize Jvala to access your records',
      'Your data syncs automatically',
    ],
  },
  cerner: {
    id: 'cerner',
    name: 'Oracle Cerner',
    type: 'fhir',
    available: true,
    authType: 'oauth2',
    baseUrl: 'https://fhir-open.cerner.com/r4',
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals', 'encounters'],
    setupSteps: [
      'Click "Connect" to start',
      'You will be redirected to Cerner Health',
      'Search for your healthcare organization',
      'Sign in with your patient portal credentials',
      'Authorize Jvala to access your records',
      'Data syncs within a few hours',
    ],
  },
  bwell: {
    id: 'bwell',
    name: 'b.well Connected Health',
    type: 'proprietary',
    available: true,
    authType: 'oauth2',
    baseUrl: 'https://api.icanbwell.com',
    dataTypes: ['unified_health_record', 'claims', 'clinical', 'devices', 'user_reported'],
    setupSteps: [
      'Click "Connect" to start',
      'You will be redirected to b.well',
      'Connect your health plans and providers',
      'Your unified health record is created',
      'All data syncs to Jvala automatically',
    ],
  },
  healthex: {
    id: 'healthex',
    name: 'HealthEx',
    type: 'fhir',
    available: true,
    authType: 'oauth2',
    baseUrl: 'https://api.healthex.io/fhir/r4',
    dataTypes: ['patient_records', 'consent_management', 'data_sharing'],
    setupSteps: [
      'Click "Connect" to start',
      'You will be redirected to HealthEx',
      'Verify your identity',
      'Set your consent preferences',
      'Your records sync via the TEFCA network',
    ],
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, userId, provider, code, state } = await req.json();
    console.log(`EHR Connect: action=${action}, provider=${provider}`);

    switch (action) {
      case 'list_providers': {
        const providerList = Object.values(EHR_PROVIDERS).map(p => ({
          id: p.id,
          name: p.name,
          type: p.type,
          available: p.available,
          authType: p.authType,
          dataTypes: p.dataTypes,
        }));

        return new Response(JSON.stringify({
          providers: providerList,
          recommendations: [
            {
              priority: 1,
              provider: 'apple_health_records',
              reason: 'No setup required. Your hospitals may already be connected in Apple Health.',
            },
            {
              priority: 2,
              provider: '1uphealth',
              reason: 'Connect to 300+ health plans and EHRs in one place.',
            },
            {
              priority: 3,
              provider: 'epic',
              reason: 'Direct connection to MyChart - the most common patient portal.',
            },
          ],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'initiate_connection': {
        const providerInfo = EHR_PROVIDERS[provider];
        if (!providerInfo) {
          throw new Error('Unknown EHR provider');
        }

        // For OAuth providers, we would generate an auth URL
        // For now, return setup instructions
        if (providerInfo.authType === 'oauth2') {
          // In production: Generate OAuth URL and redirect
          // const authUrl = await generateOAuthUrl(provider, userId);
          
          return new Response(JSON.stringify({
            provider: providerInfo,
            status: 'setup_required',
            message: `To connect ${providerInfo.name}, follow these steps:`,
            steps: providerInfo.setupSteps,
            authType: providerInfo.authType,
            // In production: authUrl,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // User-initiated (like Apple Health)
        return new Response(JSON.stringify({
          provider: providerInfo,
          status: 'user_action_required',
          message: `${providerInfo.name} requires setup on your device:`,
          steps: providerInfo.setupSteps,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'oauth_callback': {
        // Handle OAuth callback from EHR provider
        if (!code || !provider) {
          throw new Error('Missing OAuth callback parameters');
        }

        // In production: Exchange code for tokens
        // const tokens = await exchangeCodeForTokens(provider, code);
        
        // Store tokens securely
        // await supabase.from('ehr_tokens').upsert({
        //   user_id: userId,
        //   provider_id: provider,
        //   access_token: tokens.access_token,
        //   refresh_token: tokens.refresh_token,
        //   expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        // });

        // Update connection status
        await supabase.from('ehr_connections').upsert({
          user_id: userId,
          provider_id: provider,
          status: 'connected',
          last_sync_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider_id' });

        return new Response(JSON.stringify({
          status: 'connected',
          message: 'Successfully connected to EHR',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync_data': {
        // Sync data from connected EHR
        const { data: connection } = await supabase
          .from('ehr_connections')
          .select('*')
          .eq('user_id', userId)
          .eq('provider_id', provider)
          .single();

        if (!connection || connection.status !== 'connected') {
          throw new Error('EHR not connected');
        }

        // In production: Fetch data from EHR API
        // const fhirData = await fetchFHIRData(provider, userId);
        // Process and store the data

        // Update last sync
        await supabase.from('ehr_connections').update({
          last_sync_at: new Date().toISOString(),
        }).eq('user_id', userId).eq('provider_id', provider);

        return new Response(JSON.stringify({
          status: 'synced',
          message: 'Data sync completed',
          lastSync: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_fhir_data': {
        // Fetch specific FHIR resources
        const { data: connection } = await supabase
          .from('ehr_connections')
          .select('*')
          .eq('user_id', userId)
          .eq('provider_id', provider)
          .single();

        if (!connection) {
          return new Response(JSON.stringify({
            status: 'not_connected',
            message: 'Connect an EHR provider first',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // In production: Return actual FHIR data
        // For now, return sample structure
        return new Response(JSON.stringify({
          status: 'success',
          resources: {
            conditions: [],
            medications: [],
            allergies: [],
            labs: [],
            vitals: [],
            immunizations: [],
          },
          lastUpdated: connection.last_sync_at,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        await supabase
          .from('ehr_connections')
          .delete()
          .eq('user_id', userId)
          .eq('provider_id', provider);

        await supabase
          .from('ehr_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('provider_id', provider);

        return new Response(JSON.stringify({
          status: 'disconnected',
          message: 'EHR disconnected successfully',
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
