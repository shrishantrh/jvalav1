import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA PROACTIVE MONITORING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
// Runs on schedule to:
// - Check user locations for weather changes
// - Monitor wearable data for anomalies
// - Send proactive alerts
// - Generate nightly forecasts
// - Weekly reviews
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Alert {
  userId: string;
  type: 'weather' | 'wearable' | 'location' | 'inactivity' | 'forecast' | 'weekly';
  title: string;
  body: string;
  urgency: 'low' | 'normal' | 'high';
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const weatherApiKey = Deno.env.get('WEATHER_API_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json().catch(() => ({}));
    const { monitorType = 'all' } = body;
    
    const now = new Date();
    const currentHour = now.getUTCHours();
    
    const alerts: Alert[] = [];
    const results = { alerts: 0, emails: 0, errors: 0 };

    // Get all users with engagement enabled
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        timezone,
        conditions,
        known_triggers
      `);

    if (usersError) throw usersError;

    for (const user of users || []) {
      try {
        // ═══════════════════════════════════════════════════════════════════════
        // 1. WEATHER MONITORING
        // ═══════════════════════════════════════════════════════════════════════
        if ((monitorType === 'all' || monitorType === 'weather') && weatherApiKey) {
          await checkWeatherAlerts(supabase, user, weatherApiKey, alerts);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 2. WEARABLE ANOMALY DETECTION
        // ═══════════════════════════════════════════════════════════════════════
        if (monitorType === 'all' || monitorType === 'wearable') {
          await checkWearableAnomalies(supabase, user, alerts);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 3. INACTIVITY ESCALATION
        // ═══════════════════════════════════════════════════════════════════════
        if (monitorType === 'all' || monitorType === 'inactivity') {
          await checkInactivity(supabase, user, alerts, currentHour);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 4. NIGHTLY FORECAST (8-9 PM local time)
        // ═══════════════════════════════════════════════════════════════════════
        if ((monitorType === 'all' || monitorType === 'forecast')) {
          const userHour = getLocalHour(now, user.timezone || 'UTC');
          if (userHour >= 20 && userHour < 21) {
            await generateNightlyForecast(supabase, user, weatherApiKey, alerts);
          }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 5. WEEKLY REVIEW (Sunday 10 AM local)
        // ═══════════════════════════════════════════════════════════════════════
        if ((monitorType === 'all' || monitorType === 'weekly')) {
          const userHour = getLocalHour(now, user.timezone || 'UTC');
          const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: user.timezone || 'UTC' })).getDay();
          if (dayOfWeek === 0 && userHour >= 10 && userHour < 11) {
            await generateWeeklyReview(supabase, user, alerts);
          }
        }

      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        results.errors++;
      }
    }

    // Send all alerts
    for (const alert of alerts) {
      try {
        // Send push notification
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: alert.userId,
            title: alert.title,
            body: alert.body,
            tag: `proactive-${alert.type}`,
            data: alert.data,
          }),
        });
        results.alerts++;

        // Also send email for testing
        if (resendApiKey) {
          const user = users?.find(u => u.id === alert.userId);
          if (user?.email) {
            await sendAlertEmail(resendApiKey, user.email, alert);
            results.emails++;
          }
        }
      } catch (alertError) {
        console.error('Failed to send alert:', alertError);
        results.errors++;
      }
    }

    console.log(`📊 Monitor complete: ${results.alerts} alerts, ${results.emails} emails, ${results.errors} errors`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('❌ Monitor error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getLocalHour(date: Date, timezone: string): number {
  try {
    const localTime = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return localTime.getHours();
  } catch {
    return date.getUTCHours();
  }
}

async function checkWeatherAlerts(
  supabase: any,
  user: any,
  apiKey: string,
  alerts: Alert[]
) {
  // Get user's last known location
  const { data: lastEntry } = await supabase
    .from('flare_entries')
    .select('latitude, longitude, city, environmental_data')
    .eq('user_id', user.id)
    .not('latitude', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (!lastEntry?.latitude) return;

  // Get current weather
  try {
    const weatherRes = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lastEntry.latitude},${lastEntry.longitude}&aqi=yes`
    );
    const weather = await weatherRes.json();

    if (!weather?.current) return;

    // Check user's weather triggers
    const triggers = user.known_triggers || [];
    const conditions = user.conditions || [];
    
    // Get user's historical weather-flare correlations
    const { data: flares } = await supabase
      .from('flare_entries')
      .select('environmental_data, severity')
      .eq('user_id', user.id)
      .eq('entry_type', 'flare')
      .order('timestamp', { ascending: false })
      .limit(50);

    // Check for concerning weather patterns
    const aqi = weather.current.air_quality?.['us-epa-index'] || 0;
    const humidity = weather.current.humidity;
    const pressure = weather.current.pressure_mb;
    const temp = weather.current.temp_c;

    // Poor air quality alert
    if (aqi >= 4) {
      alerts.push({
        userId: user.id,
        type: 'weather',
        title: '⚠️ Poor Air Quality Alert',
        body: `AQI is ${aqi > 4 ? 'unhealthy' : 'moderate'} in ${lastEntry.city || 'your area'}. Consider staying indoors.`,
        urgency: aqi >= 5 ? 'high' : 'normal',
        data: { aqi, city: lastEntry.city },
      });
    }

    // Pressure drop alert (migraine trigger)
    if (flares?.some((f: any) => f.environmental_data?.weather?.pressure < 1010)) {
      if (pressure < 1005) {
        alerts.push({
          userId: user.id,
          type: 'weather',
          title: '📉 Pressure Drop Warning',
          body: `Barometric pressure is low (${pressure}mb). This has triggered flares before.`,
          urgency: 'normal',
          data: { pressure },
        });
      }
    }

    // High humidity alert
    if (humidity > 85 && triggers.includes('humidity')) {
      alerts.push({
        userId: user.id,
        type: 'weather',
        title: '💧 High Humidity Alert',
        body: `Humidity is ${humidity}% today. Stay hydrated and cool.`,
        urgency: 'low',
        data: { humidity },
      });
    }

  } catch (weatherError) {
    console.error('Weather check failed:', weatherError);
  }
}

async function checkWearableAnomalies(
  supabase: any,
  user: any,
  alerts: Alert[]
) {
  // Check if user has Fitbit connected
  const { data: fitbitToken } = await supabase
    .from('fitbit_tokens')
    .select('access_token')
    .eq('user_id', user.id)
    .single();

  if (!fitbitToken) return;

  // Get latest wearable data from entries
  const { data: recentEntries } = await supabase
    .from('flare_entries')
    .select('physiological_data')
    .eq('user_id', user.id)
    .not('physiological_data', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(7);

  if (!recentEntries || recentEntries.length < 3) return;

  // Calculate baselines
  const heartRates = recentEntries
    .map((e: any) => e.physiological_data?.heart_rate || e.physiological_data?.heartRate)
    .filter(Boolean);
  const hrvValues = recentEntries
    .map((e: any) => e.physiological_data?.hrv?.current || e.physiological_data?.hrv?.daily)
    .filter(Boolean);
  const sleepHours = recentEntries
    .map((e: any) => e.physiological_data?.sleep?.duration || e.physiological_data?.sleepHours)
    .filter(Boolean);

  if (heartRates.length >= 3) {
    const avgHR = heartRates.reduce((a: number, b: number) => a + b, 0) / heartRates.length;
    const latestHR = heartRates[0];
    
    // Elevated resting heart rate alert
    if (latestHR > avgHR * 1.15 && latestHR > 75) {
      alerts.push({
        userId: user.id,
        type: 'wearable',
        title: '❤️ Elevated Heart Rate',
        body: `Your resting heart rate (${latestHR} BPM) is higher than usual. Consider rest today.`,
        urgency: 'normal',
        data: { heartRate: latestHR, baseline: avgHR },
      });
    }
  }

  if (hrvValues.length >= 3) {
    const avgHRV = hrvValues.reduce((a: number, b: number) => a + b, 0) / hrvValues.length;
    const latestHRV = hrvValues[0];
    
    // Low HRV (stress) alert
    if (latestHRV < avgHRV * 0.75) {
      alerts.push({
        userId: user.id,
        type: 'wearable',
        title: '😮‍💨 Low HRV Detected',
        body: `Your HRV (${latestHRV}ms) indicates elevated stress. Take it easy today.`,
        urgency: 'normal',
        data: { hrv: latestHRV, baseline: avgHRV },
      });
    }
  }

  if (sleepHours.length >= 3) {
    const avgSleep = sleepHours.reduce((a: number, b: number) => a + b, 0) / sleepHours.length;
    const latestSleep = sleepHours[0];
    
    // Poor sleep alert
    if (latestSleep < avgSleep * 0.7 && latestSleep < 6) {
      alerts.push({
        userId: user.id,
        type: 'wearable',
        title: '😴 Poor Sleep Warning',
        body: `You only got ${latestSleep.toFixed(1)}h of sleep. Watch for symptoms today.`,
        urgency: 'normal',
        data: { sleep: latestSleep, baseline: avgSleep },
      });
    }
  }
}

async function checkInactivity(
  supabase: any,
  user: any,
  alerts: Alert[],
  currentHour: number
) {
  // Get engagement data
  const { data: engagement } = await supabase
    .from('engagement')
    .select('last_log_date, current_streak, reminder_enabled')
    .eq('user_id', user.id)
    .single();

  if (!engagement?.reminder_enabled) return;

  const lastLogDate = engagement.last_log_date;
  if (!lastLogDate) return;

  const daysSinceLog = Math.floor(
    (Date.now() - new Date(lastLogDate).getTime()) / (24 * 60 * 60 * 1000)
  );

  // Escalating reminders
  if (daysSinceLog === 2) {
    alerts.push({
      userId: user.id,
      type: 'inactivity',
      title: '👋 Miss you!',
      body: "Haven't seen you in 2 days. A quick log takes 10 seconds!",
      urgency: 'low',
    });
  } else if (daysSinceLog === 4) {
    alerts.push({
      userId: user.id,
      type: 'inactivity',
      title: '⏰ Your streak needs you!',
      body: `You had a ${engagement.current_streak || 0}-day streak. Come back and start fresh!`,
      urgency: 'normal',
    });
  } else if (daysSinceLog === 7) {
    alerts.push({
      userId: user.id,
      type: 'inactivity',
      title: '🔔 Week check-in',
      body: "It's been a week! Even a simple 'feeling okay' log helps build your health picture.",
      urgency: 'normal',
    });
  } else if (daysSinceLog >= 14 && daysSinceLog % 7 === 0) {
    alerts.push({
      userId: user.id,
      type: 'inactivity',
      title: '💜 We miss tracking with you',
      body: `${daysSinceLog} days without logging. Your health insights are waiting!`,
      urgency: 'high',
    });
  }
}

async function generateNightlyForecast(
  supabase: any,
  user: any,
  weatherApiKey: string | undefined,
  alerts: Alert[]
) {
  // Check if we already sent tonight's forecast
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `forecast_${user.id}_${today}`;
  
  // Simple in-memory dedup (in production, use a database flag)
  // For now, we'll rely on the time window check

  // Get forecast from health-forecast function
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get last location
    const { data: lastEntry } = await supabase
      .from('flare_entries')
      .select('latitude, longitude')
      .eq('user_id', user.id)
      .not('latitude', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    let weatherData = null;
    if (lastEntry?.latitude && weatherApiKey) {
      const weatherRes = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${lastEntry.latitude},${lastEntry.longitude}&days=1&aqi=yes`
      );
      weatherData = await weatherRes.json();
    }

    const forecastRes = await fetch(`${supabaseUrl}/functions/v1/health-forecast`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        currentWeather: weatherData?.forecast?.forecastday?.[0]?.day || null,
      }),
    });

    const forecast = await forecastRes.json();
    
    if (forecast?.forecast) {
      const f = forecast.forecast;
      let emoji = '🌤️';
      if (f.riskLevel === 'high' || f.riskLevel === 'very_high') emoji = '⚠️';
      else if (f.riskLevel === 'moderate') emoji = '🌥️';
      else emoji = '☀️';

      alerts.push({
        userId: user.id,
        type: 'forecast',
        title: `${emoji} Tomorrow's Forecast`,
        body: f.prediction || `Risk level: ${f.riskLevel}. ${f.recommendations?.[0] || 'Stay mindful!'}`,
        urgency: f.riskLevel === 'high' || f.riskLevel === 'very_high' ? 'high' : 'low',
        data: { riskScore: f.riskScore, riskLevel: f.riskLevel },
      });
    }
  } catch (forecastError) {
    console.error('Forecast generation failed:', forecastError);
  }
}

async function generateWeeklyReview(
  supabase: any,
  user: any,
  alerts: Alert[]
) {
  // Get this week's stats
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: weekEntries } = await supabase
    .from('flare_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('timestamp', weekAgo)
    .order('timestamp', { ascending: false });

  const flares = weekEntries?.filter((e: any) => e.entry_type === 'flare') || [];
  const { data: engagement } = await supabase
    .from('engagement')
    .select('current_streak')
    .eq('user_id', user.id)
    .single();

  const streak = engagement?.current_streak || 0;
  const flareCount = flares.length;
  
  let emoji = '🎉';
  let message = '';
  
  if (flareCount === 0) {
    message = 'Amazing week - no flares logged! Keep up the great work.';
  } else if (flareCount <= 2) {
    emoji = '💪';
    message = `Good week with only ${flareCount} flare${flareCount > 1 ? 's' : ''}. You're doing great!`;
  } else if (flareCount <= 5) {
    emoji = '📊';
    message = `${flareCount} flares this week. Check your insights for patterns.`;
  } else {
    emoji = '💜';
    message = `Tough week with ${flareCount} flares. Review triggers in Insights.`;
  }

  if (streak > 7) {
    message += ` Amazing ${streak}-day streak!`;
  }

  alerts.push({
    userId: user.id,
    type: 'weekly',
    title: `${emoji} Your Weekly Review`,
    body: message,
    urgency: 'low',
    data: { flareCount, streak, weekEntries: weekEntries?.length || 0 },
  });
}

async function sendAlertEmail(
  apiKey: string,
  email: string,
  alert: Alert
) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Jvala <onboarding@resend.dev>',
        to: [email],
        subject: alert.title.replace(/[^\w\s-]/g, '').trim() || 'Jvala Alert',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                .container { max-width: 450px; margin: 0 auto; background: white; }
                .header { background: linear-gradient(135deg, #D6006C, #892EFF); padding: 20px; text-align: center; }
                .header h1 { color: white; margin: 0; font-size: 18px; }
                .content { padding: 24px; }
                .alert-title { font-size: 20px; font-weight: 600; color: #333; margin-bottom: 12px; }
                .alert-body { font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 20px; }
                .cta-button { display: inline-block; background: linear-gradient(135deg, #D6006C, #892EFF); color: white !important; padding: 12px 28px; border-radius: 25px; text-decoration: none; font-weight: 600; }
                .footer { padding: 16px 24px; text-align: center; background: #f8f9fa; border-top: 1px solid #eee; font-size: 11px; color: #888; }
                .type-badge { display: inline-block; background: #f0f0f0; color: #666; padding: 4px 10px; border-radius: 12px; font-size: 11px; text-transform: uppercase; margin-bottom: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header"><h1>Jvala</h1></div>
                <div class="content">
                  <div class="type-badge">${alert.type}</div>
                  <div class="alert-title">${alert.title}</div>
                  <div class="alert-body">${alert.body}</div>
                  <a href="https://jvala.tech" class="cta-button">Open Jvala</a>
                </div>
                <div class="footer">
                  Manage notifications in Settings → Reminders
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    });

    if (!response.ok) {
      console.error('Email send failed:', await response.text());
    }
  } catch (emailError) {
    console.error('Email error:', emailError);
  }
}
