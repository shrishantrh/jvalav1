import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tokens from database
    const { data: tokenData, error: tokenError } = await supabase
      .from('fitbit_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ 
        error: 'not_connected',
        message: 'Fitbit not connected' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken = tokenData.access_token;

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log('Token expired, refreshing...');
      const refreshResult = await refreshToken(tokenData.refresh_token, user.id);
      if (!refreshResult.success) {
        return new Response(JSON.stringify({ 
          error: 'token_expired',
          message: 'Please reconnect Fitbit' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      accessToken = refreshResult.access_token;
    }

    // Fetch data from Fitbit API
    const today = new Date().toISOString().split('T')[0];
    
    const [heartRate, activities, sleep] = await Promise.all([
      fetchFitbitData(`/1/user/-/activities/heart/date/${today}/1d.json`, accessToken),
      fetchFitbitData(`/1/user/-/activities/date/${today}.json`, accessToken),
      fetchFitbitData(`/1.2/user/-/sleep/date/${today}.json`, accessToken),
    ]);

    // Process the data
    const data = {
      heartRate: heartRate?.['activities-heart']?.[0]?.value?.restingHeartRate || null,
      heartRateZones: heartRate?.['activities-heart']?.[0]?.value?.heartRateZones || [],
      steps: activities?.summary?.steps || 0,
      activeMinutes: (activities?.summary?.fairlyActiveMinutes || 0) + 
                     (activities?.summary?.veryActiveMinutes || 0),
      caloriesBurned: activities?.summary?.caloriesOut || 0,
      distance: activities?.summary?.distances?.find((d: any) => d.activity === 'total')?.distance || 0,
      sleepHours: sleep?.summary?.totalMinutesAsleep 
        ? Math.round((sleep.summary.totalMinutesAsleep / 60) * 10) / 10 
        : null,
      sleepQuality: getSleepQuality(sleep?.summary?.totalMinutesAsleep),
      sleepStages: sleep?.summary?.stages || null,
      lastSyncedAt: new Date().toISOString(),
      source: 'fitbit',
    };

    console.log('Fetched Fitbit data for user:', user.id, data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching Fitbit data:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function fetchFitbitData(endpoint: string, accessToken: string): Promise<any> {
  try {
    const response = await fetch(`https://api.fitbit.com${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(`Fitbit API error for ${endpoint}:`, response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return null;
  }
}

async function refreshToken(refreshToken: string, userId: string): Promise<{ success: boolean; access_token?: string }> {
  try {
    const CLIENT_ID = Deno.env.get('FITBIT_CLIENT_ID');
    const CLIENT_SECRET = Deno.env.get('FITBIT_CLIENT_SECRET');

    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return { success: false };
    }

    const tokens = await response.json();

    // Update tokens in database using service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from('fitbit_tokens')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return { success: true, access_token: tokens.access_token };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return { success: false };
  }
}

function getSleepQuality(totalMinutes: number | null): string | null {
  if (!totalMinutes) return null;
  const hours = totalMinutes / 60;
  if (hours >= 8) return 'excellent';
  if (hours >= 7) return 'good';
  if (hours >= 5) return 'fair';
  return 'poor';
}
