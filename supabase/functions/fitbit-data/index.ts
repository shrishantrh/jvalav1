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

    // Fetch ALL available data from Fitbit API
    const today = new Date().toISOString().split('T')[0];
    
    console.log('Fetching comprehensive Fitbit data for:', today);

    // Fetch all endpoints in parallel for maximum data
    const [
      heartRate,
      activities,
      sleep,
      hrv,
      spo2,
      breathingRate,
      skinTemperature,
      cardioScore,
      activeZoneMinutes,
    ] = await Promise.all([
      // Heart rate with intraday data
      fetchFitbitData(`/1/user/-/activities/heart/date/${today}/1d.json`, accessToken),
      // Daily activity summary
      fetchFitbitData(`/1/user/-/activities/date/${today}.json`, accessToken),
      // Sleep data
      fetchFitbitData(`/1.2/user/-/sleep/date/${today}.json`, accessToken),
      // Heart Rate Variability (HRV)
      fetchFitbitData(`/1/user/-/hrv/date/${today}.json`, accessToken),
      // SpO2 (Blood Oxygen Saturation)
      fetchFitbitData(`/1/user/-/spo2/date/${today}.json`, accessToken),
      // Breathing Rate
      fetchFitbitData(`/1/user/-/br/date/${today}.json`, accessToken),
      // Skin Temperature
      fetchFitbitData(`/1/user/-/temp/skin/date/${today}.json`, accessToken),
      // Cardio Fitness Score (VO2 Max)
      fetchFitbitData(`/1/user/-/cardioscore/date/${today}.json`, accessToken),
      // Active Zone Minutes
      fetchFitbitData(`/1/user/-/activities/active-zone-minutes/date/${today}/1d.json`, accessToken),
    ]);

    // Process Heart Rate data
    const heartRateData = heartRate?.['activities-heart']?.[0]?.value;
    const restingHeartRate = heartRateData?.restingHeartRate || null;
    const heartRateZones = heartRateData?.heartRateZones || [];
    
    // Calculate max and average HR from zones if available
    const fatBurnZone = heartRateZones.find((z: any) => z.name === 'Fat Burn');
    const cardioZone = heartRateZones.find((z: any) => z.name === 'Cardio');
    const peakZone = heartRateZones.find((z: any) => z.name === 'Peak');

    // Process HRV data
    const hrvData = hrv?.hrv?.[0]?.value || null;
    const hrvRmssd = hrvData?.dailyRmssd || hrvData?.rmssd || null;
    const hrvCoverage = hrvData?.coverage || null;
    const hrvLowFreq = hrvData?.lf || null;
    const hrvHighFreq = hrvData?.hf || null;

    // Process SpO2 data
    const spo2Data = spo2?.value || spo2;
    const spo2Avg = spo2Data?.avg || spo2Data?.value || null;
    const spo2Min = spo2Data?.min || null;
    const spo2Max = spo2Data?.max || null;

    // Process Breathing Rate data
    const breathingRateData = breathingRate?.br?.[0]?.value;
    const breathingRateValue = breathingRateData?.breathingRate || null;
    const breathingRateDeepSleep = breathingRateData?.deepSleepSummary?.breathingRate || null;
    const breathingRateLightSleep = breathingRateData?.lightSleepSummary?.breathingRate || null;
    const breathingRateRemSleep = breathingRateData?.remSleepSummary?.breathingRate || null;

    // Process Skin Temperature data
    const tempData = skinTemperature?.tempSkin?.[0]?.value;
    const skinTempRelative = tempData?.nightlyRelative || null;
    const skinTempLogType = tempData?.logType || null;

    // Process Cardio Score (VO2 Max) data
    const cardioData = cardioScore?.cardioScore?.[0]?.value;
    const vo2Max = cardioData?.vo2Max || null;
    const vo2MaxRange = cardioData ? `${cardioData.vo2MaxLow || ''}-${cardioData.vo2MaxHigh || ''}` : null;

    // Process Active Zone Minutes
    const azmData = activeZoneMinutes?.['activities-active-zone-minutes']?.[0]?.value;
    const activeZoneMinutesTotal = azmData?.activeZoneMinutes || null;
    const fatBurnMinutes = azmData?.fatBurnActiveZoneMinutes || null;
    const cardioMinutes = azmData?.cardioActiveZoneMinutes || null;
    const peakMinutes = azmData?.peakActiveZoneMinutes || null;

    // Process Sleep data with stages
    const sleepSummary = sleep?.summary;
    const totalMinutesAsleep = sleepSummary?.totalMinutesAsleep || null;
    const sleepStages = sleepSummary?.stages || null;
    const deepSleepMinutes = sleepStages?.deep || null;
    const lightSleepMinutes = sleepStages?.light || null;
    const remSleepMinutes = sleepStages?.rem || null;
    const wakeSleepMinutes = sleepStages?.wake || null;
    const sleepEfficiency = sleep?.sleep?.[0]?.efficiency || null;
    const timeInBed = sleep?.sleep?.[0]?.timeInBed || null;

    // Process Activity data
    const activitySummary = activities?.summary;
    const steps = activitySummary?.steps || 0;
    const fairlyActiveMinutes = activitySummary?.fairlyActiveMinutes || 0;
    const veryActiveMinutes = activitySummary?.veryActiveMinutes || 0;
    const lightlyActiveMinutes = activitySummary?.lightlyActiveMinutes || 0;
    const sedentaryMinutes = activitySummary?.sedentaryMinutes || 0;
    const caloriesOut = activitySummary?.caloriesOut || 0;
    const caloriesBMR = activitySummary?.caloriesBMR || 0;
    const activityCalories = activitySummary?.activityCalories || 0;
    const floors = activitySummary?.floors || 0;
    const elevation = activitySummary?.elevation || 0;
    const distanceTotal = activitySummary?.distances?.find((d: any) => d.activity === 'total')?.distance || 0;

    // Compile comprehensive data object
    const data = {
      // Core vitals
      heartRate: restingHeartRate,
      restingHeartRate,
      heartRateZones,
      
      // HRV - Heart Rate Variability
      hrv: hrvRmssd,
      hrvRmssd,
      hrvCoverage,
      hrvLowFreq,
      hrvHighFreq,
      
      // Blood Oxygen
      spo2: spo2Avg,
      spo2Avg,
      spo2Min,
      spo2Max,
      
      // Breathing
      breathingRate: breathingRateValue,
      breathingRateDeepSleep,
      breathingRateLightSleep,
      breathingRateRemSleep,
      
      // Temperature
      skinTemperature: skinTempRelative,
      skinTempLogType,
      
      // Cardio Fitness
      vo2Max,
      vo2MaxRange,
      
      // Active Zone Minutes
      activeZoneMinutesTotal,
      fatBurnMinutes,
      cardioMinutes,
      peakMinutes,
      
      // Sleep
      sleepHours: totalMinutesAsleep ? Math.round((totalMinutesAsleep / 60) * 10) / 10 : null,
      sleepMinutes: totalMinutesAsleep,
      sleepQuality: getSleepQuality(totalMinutesAsleep),
      sleepStages,
      deepSleepMinutes,
      lightSleepMinutes,
      remSleepMinutes,
      wakeSleepMinutes,
      sleepEfficiency,
      timeInBed,
      
      // Activity
      steps,
      activeMinutes: fairlyActiveMinutes + veryActiveMinutes,
      fairlyActiveMinutes,
      veryActiveMinutes,
      lightlyActiveMinutes,
      sedentaryMinutes,
      caloriesBurned: caloriesOut,
      caloriesBMR,
      activityCalories,
      floors,
      elevation,
      distance: distanceTotal,
      
      // Metadata
      lastSyncedAt: new Date().toISOString(),
      source: 'fitbit',
      dataDate: today,
    };

    console.log('Fetched comprehensive Fitbit data for user:', user.id, {
      hasHRV: !!hrvRmssd,
      hasSpO2: !!spo2Avg,
      hasBreathingRate: !!breathingRateValue,
      hasSkinTemp: !!skinTempRelative,
      hasVO2Max: !!vo2Max,
      hasAZM: !!activeZoneMinutesTotal,
      hasSleepStages: !!sleepStages,
    });

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
      // Log but don't throw - some endpoints may not have data or require premium
      console.log(`Fitbit API ${endpoint}: ${response.status} (may require premium or no data available)`);
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
