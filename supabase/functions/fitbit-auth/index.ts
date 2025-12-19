import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, redirect_uri } = await req.json();
    
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const CLIENT_ID = Deno.env.get('FITBIT_CLIENT_ID');
    if (!CLIENT_ID) {
      console.error('FITBIT_CLIENT_ID not configured');
      return new Response(JSON.stringify({ error: 'Fitbit not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const REDIRECT_URI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fitbit-callback`;
    
    // Generate state with user_id for security and tracking
    const state = btoa(JSON.stringify({ 
      user_id, 
      redirect_uri: redirect_uri || '',
      timestamp: Date.now() 
    }));

    // Fitbit OAuth scopes
    const scopes = [
      'activity',
      'heartrate', 
      'sleep',
      'weight',
      'profile'
    ].join(' ');

    const authUrl = new URL('https://www.fitbit.com/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    console.log('Generated Fitbit auth URL for user:', user_id);

    return new Response(JSON.stringify({ 
      auth_url: authUrl.toString() 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error generating auth URL:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
