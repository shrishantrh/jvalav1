import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-terra-signature',
};

// Terra API unified wearables data
// Supports: Apple Health, Fitbit, Oura, Garmin, WHOOP, Google Fit, Samsung, Polar, etc.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('Terra webhook received:', JSON.stringify(payload, null, 2));

    // Terra sends different event types
    const { type, user, data } = payload;

    if (!user?.user_id) {
      console.log('No user_id in webhook payload');
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map Terra's user_id to our user_id (stored in fitbit_tokens or a new terra_connections table)
    const userId = user.reference_id || user.user_id; // reference_id is what we set during auth

    switch (type) {
      case 'activity': {
        // Daily activity summary
        const activityData = data?.[0];
        if (activityData) {
          await supabase.from('activity_logs').insert({
            user_id: userId,
            activity_type: 'daily_summary',
            activity_value: JSON.stringify({
              steps: activityData.steps,
              calories: activityData.calories,
              distance_meters: activityData.distance_meters,
              active_duration_seconds: activityData.active_duration_seconds,
              low_intensity_seconds: activityData.low_intensity_seconds,
              medium_intensity_seconds: activityData.medium_intensity_seconds,
              high_intensity_seconds: activityData.high_intensity_seconds,
            }),
            duration_minutes: Math.round((activityData.active_duration_seconds || 0) / 60),
            metadata: { source: 'terra', device: user.provider },
            timestamp: activityData.metadata?.end_time || new Date().toISOString(),
          });
        }
        break;
      }

      case 'sleep': {
        // Sleep data
        const sleepData = data?.[0];
        if (sleepData) {
          await supabase.from('activity_logs').insert({
            user_id: userId,
            activity_type: 'sleep',
            activity_value: JSON.stringify({
              sleep_duration_hours: (sleepData.sleep_duration_seconds || 0) / 3600,
              deep_sleep_hours: (sleepData.deep_duration_seconds || 0) / 3600,
              rem_sleep_hours: (sleepData.rem_duration_seconds || 0) / 3600,
              light_sleep_hours: (sleepData.light_duration_seconds || 0) / 3600,
              awake_duration_minutes: (sleepData.awake_duration_seconds || 0) / 60,
              sleep_efficiency: sleepData.sleep_efficiency,
              breath_average: sleepData.breath_average,
              hr_average: sleepData.hr_average,
              hrv_average: sleepData.hrv_average,
              temperature_delta: sleepData.temperature_delta,
            }),
            duration_minutes: Math.round((sleepData.sleep_duration_seconds || 0) / 60),
            metadata: { source: 'terra', device: user.provider },
            timestamp: sleepData.metadata?.end_time || new Date().toISOString(),
          });
        }
        break;
      }

      case 'body': {
        // Body metrics (weight, body fat, etc.)
        const bodyData = data?.[0];
        if (bodyData) {
          await supabase.from('activity_logs').insert({
            user_id: userId,
            activity_type: 'body_metrics',
            activity_value: JSON.stringify({
              weight_kg: bodyData.weight_kg,
              body_fat_percentage: bodyData.body_fat_percentage,
              bmi: bodyData.bmi,
            }),
            metadata: { source: 'terra', device: user.provider },
            timestamp: bodyData.metadata?.end_time || new Date().toISOString(),
          });
        }
        break;
      }

      case 'daily': {
        // Combined daily data
        const dailyData = data?.[0];
        if (dailyData) {
          // Store comprehensive daily snapshot
          await supabase.from('activity_logs').insert({
            user_id: userId,
            activity_type: 'daily_snapshot',
            activity_value: JSON.stringify({
              // Heart metrics
              resting_hr: dailyData.heart_rate?.resting,
              avg_hr: dailyData.heart_rate?.average,
              max_hr: dailyData.heart_rate?.max,
              hrv_rmssd: dailyData.hrv?.rmssd,
              hrv_sdnn: dailyData.hrv?.sdnn,
              // Stress & recovery
              stress_score: dailyData.stress?.avg_stress_level,
              recovery_score: dailyData.recovery?.recovery_score,
              // Activity
              steps: dailyData.steps,
              calories: dailyData.calories,
              active_zone_minutes: dailyData.active_zone_minutes?.total,
              // Oxygen
              spo2_avg: dailyData.oxygen?.avg_saturation_percentage,
              // Temperature
              skin_temperature: dailyData.temperature?.skin_temp_celsius,
              core_temperature: dailyData.temperature?.core_temp_celsius,
            }),
            metadata: { source: 'terra', device: user.provider },
            timestamp: dailyData.metadata?.end_time || new Date().toISOString(),
          });
        }
        break;
      }

      case 'menstruation': {
        // Menstrual cycle data (from Clue, Flo via Apple Health, or Oura)
        const menstrualData = data?.[0];
        if (menstrualData) {
          await supabase.from('activity_logs').insert({
            user_id: userId,
            activity_type: 'menstrual_cycle',
            activity_value: JSON.stringify({
              cycle_day: menstrualData.day_in_cycle,
              period_length_days: menstrualData.period_length_days,
              cycle_length_days: menstrualData.cycle_length_days,
              is_predicted: menstrualData.is_predicted,
              menstruation_flow: menstrualData.menstruation?.flow,
              ovulation_day: menstrualData.ovulation?.day_in_cycle,
            }),
            metadata: { source: 'terra', device: user.provider },
            timestamp: menstrualData.metadata?.end_time || new Date().toISOString(),
          });
        }
        break;
      }

      case 'auth': {
        // User connected/disconnected
        console.log('Terra auth event:', user.provider, data?.status);
        break;
      }

      default:
        console.log('Unknown Terra event type:', type);
    }

    return new Response(JSON.stringify({ status: 'processed', type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Terra webhook error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
