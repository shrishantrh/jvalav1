import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const personalAccessToken = Deno.env.get('OURA_PERSONAL_ACCESS_TOKEN');
    
    if (!personalAccessToken) {
      console.error('OURA_PERSONAL_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Oura not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    console.log(`Fetching Oura data for ${yesterday} to ${today}`);

    // Fetch daily activity
    const activityResponse = await fetch(
      `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${yesterday}&end_date=${today}`,
      {
        headers: {
          'Authorization': `Bearer ${personalAccessToken}`,
        },
      }
    );

    // Fetch sleep data
    const sleepResponse = await fetch(
      `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${yesterday}&end_date=${today}`,
      {
        headers: {
          'Authorization': `Bearer ${personalAccessToken}`,
        },
      }
    );

    // Fetch readiness data
    const readinessResponse = await fetch(
      `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${yesterday}&end_date=${today}`,
      {
        headers: {
          'Authorization': `Bearer ${personalAccessToken}`,
        },
      }
    );

    // Fetch heart rate data
    const heartRateResponse = await fetch(
      `https://api.ouraring.com/v2/usercollection/heartrate?start_datetime=${yesterday}T00:00:00Z&end_datetime=${today}T23:59:59Z`,
      {
        headers: {
          'Authorization': `Bearer ${personalAccessToken}`,
        },
      }
    );

    if (!activityResponse.ok && !sleepResponse.ok && !readinessResponse.ok) {
      console.error('All Oura API requests failed');
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Oura data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const activityData = activityResponse.ok ? await activityResponse.json() : { data: [] };
    const sleepData = sleepResponse.ok ? await sleepResponse.json() : { data: [] };
    const readinessData = readinessResponse.ok ? await readinessResponse.json() : { data: [] };
    const heartRateData = heartRateResponse.ok ? await heartRateResponse.json() : { data: [] };

    // Get latest data points
    const latestActivity = activityData.data?.[activityData.data.length - 1];
    const latestSleep = sleepData.data?.[sleepData.data.length - 1];
    const latestReadiness = readinessData.data?.[readinessData.data.length - 1];
    
    // Calculate average heart rate from recent readings
    const heartRates = heartRateData.data?.map((d: { bpm: number }) => d.bpm) || [];
    const avgHeartRate = heartRates.length > 0 
      ? Math.round(heartRates.reduce((a: number, b: number) => a + b, 0) / heartRates.length)
      : null;

    // Map sleep score to quality
    const sleepScore = latestSleep?.score;
    let sleepQuality: 'poor' | 'fair' | 'good' | 'excellent' | null = null;
    if (sleepScore) {
      if (sleepScore >= 85) sleepQuality = 'excellent';
      else if (sleepScore >= 70) sleepQuality = 'good';
      else if (sleepScore >= 50) sleepQuality = 'fair';
      else sleepQuality = 'poor';
    }

    const result = {
      // Activity data
      steps: latestActivity?.steps || null,
      activeMinutes: latestActivity?.high_activity_time 
        ? Math.round(latestActivity.high_activity_time / 60) 
        : null,
      caloriesBurned: latestActivity?.active_calories || null,
      
      // Sleep data
      sleepHours: latestSleep?.total_sleep_duration 
        ? Math.round((latestSleep.total_sleep_duration / 3600) * 10) / 10 
        : null,
      sleepScore: sleepScore || null,
      sleepQuality,
      
      // Readiness/Recovery
      readinessScore: latestReadiness?.score || null,
      hrvBalance: latestReadiness?.contributors?.hrv_balance || null,
      
      // Heart rate
      heartRate: avgHeartRate,
      restingHeartRate: latestReadiness?.contributors?.resting_heart_rate || null,
      
      // Metadata
      lastSyncedAt: new Date().toISOString(),
      source: 'oura',
    };

    console.log('Oura data fetched successfully:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching Oura data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
