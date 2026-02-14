import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-terra-signature',
};

// Verify Terra webhook signature using HMAC-SHA256
async function verifyTerraSignature(payload: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Terra sends the signature as the raw hex or prefixed with "sha256="
  const cleanSignature = signature.replace('sha256=', '').replace('t=', '').trim();
  
  // Constant-time comparison to prevent timing attacks
  if (computedHex.length !== cleanSignature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ cleanSignature.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Step 1: Verify Terra webhook signature
    const terraSecret = Deno.env.get('TERRA_WEBHOOK_SECRET');
    if (!terraSecret) {
      console.error('TERRA_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const terraSignature = req.headers.get('terra-signature') || req.headers.get('x-terra-signature');
    const rawPayload = await req.text();

    const isValid = await verifyTerraSignature(rawPayload, terraSignature, terraSecret);
    if (!isValid) {
      console.error('Invalid Terra webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Parse verified payload
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = JSON.parse(rawPayload);
    console.log('Terra webhook verified:', payload.type);

    const { type, user, data } = payload;

    if (!user?.user_id) {
      console.log('No user_id in webhook payload');
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.reference_id || user.user_id;

    // Validate userId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('Invalid user_id format:', userId);
      return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (type) {
      case 'activity': {
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
        const dailyData = data?.[0];
        if (dailyData) {
          await supabase.from('activity_logs').insert({
            user_id: userId,
            activity_type: 'daily_snapshot',
            activity_value: JSON.stringify({
              resting_hr: dailyData.heart_rate?.resting,
              avg_hr: dailyData.heart_rate?.average,
              max_hr: dailyData.heart_rate?.max,
              hrv_rmssd: dailyData.hrv?.rmssd,
              hrv_sdnn: dailyData.hrv?.sdnn,
              stress_score: dailyData.stress?.avg_stress_level,
              recovery_score: dailyData.recovery?.recovery_score,
              steps: dailyData.steps,
              calories: dailyData.calories,
              active_zone_minutes: dailyData.active_zone_minutes?.total,
              spo2_avg: dailyData.oxygen?.avg_saturation_percentage,
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
