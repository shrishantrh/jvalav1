import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Personalized message templates
const MORNING_MESSAGES = [
  (streak: number) => streak > 0 
    ? `Rise and shine! Your ${streak}-day streak is waiting. A quick check-in keeps your patterns clear.`
    : `Good morning! How are you starting the day? A quick log helps track your patterns.`,
  (streak: number) => streak > 7 
    ? `Amazing ${streak}-day streak! Keep it going with a morning check-in.`
    : `New day, new data point! Your future self will thank you for tracking.`,
];

const EVENING_MESSAGES = [
  (streak: number) => `Evening reflection time. ${streak > 0 ? `Keep that ${streak}-day streak alive!` : 'How was today?'}`,
  (streak: number) => `Before bed check-in. ${streak > 0 ? `Streak: ${streak} days and counting!` : 'Capture your day before it fades.'}`,
];

// Helper to get current hour in a timezone
const getCurrentHourInTimezone = (timezone: string): number => {
  try {
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return localTime.getHours();
  } catch {
    return new Date().getUTCHours();
  }
};

// Get today's date in a timezone
const getTodayInTimezone = (timezone: string): string => {
  try {
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return localTime.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!resendApiKey) {
      console.log('⚠️ RESEND_API_KEY not configured, skipping reminders');
      return new Response(JSON.stringify({ skipped: true, reason: 'no_api_key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`🕐 Processing reminders at ${new Date().toISOString()}`);

    // Get users with reminders enabled
    const { data: usersWithReminders, error: fetchError } = await supabase
      .from('engagement')
      .select(`
        user_id,
        reminder_enabled,
        reminder_times,
        current_streak,
        last_log_date,
        last_morning_sent,
        last_evening_sent
      `)
      .eq('reminder_enabled', true);

    if (fetchError) {
      console.error('Failed to fetch users:', fetchError);
      throw fetchError;
    }

    console.log(`📋 Found ${usersWithReminders?.length || 0} users with reminders enabled`);

    const results = { sent: 0, skipped: 0, errors: 0 };

    for (const user of usersWithReminders || []) {
      try {
        // Get user's profile for email and timezone
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('email, timezone')
          .eq('id', user.user_id)
          .single();

        if (!userProfile?.email) {
          console.log(`⚠️ No email for user ${user.user_id}`);
          results.skipped++;
          continue;
        }

        const timezone = userProfile.timezone || 'UTC';
        const currentLocalHour = getCurrentHourInTimezone(timezone);
        const todayLocal = getTodayInTimezone(timezone);
        
        // Get reminder times (default to 9am and 9pm)
        const reminderTimes = (user.reminder_times && user.reminder_times.length >= 2) 
          ? user.reminder_times 
          : ['09:00', '21:00'];
        const morningHour = parseInt(reminderTimes[0]?.split(':')[0] || '9');
        const eveningHour = parseInt(reminderTimes[1]?.split(':')[0] || '21');

        // Check if it's time for morning or evening reminder (exact hour match)
        const isMorningTime = currentLocalHour === morningHour;
        const isEveningTime = currentLocalHour === eveningHour;

        if (!isMorningTime && !isEveningTime) {
          continue; // Not time for this user's reminder
        }

        // Check if we already sent this reminder today (prevent duplicates)
        const alreadySentMorning = user.last_morning_sent === todayLocal;
        const alreadySentEvening = user.last_evening_sent === todayLocal;

        if (isMorningTime && alreadySentMorning) {
          console.log(`⏭️ Already sent morning reminder to ${user.user_id} today`);
          results.skipped++;
          continue;
        }

        if (isEveningTime && alreadySentEvening) {
          console.log(`⏭️ Already sent evening reminder to ${user.user_id} today`);
          results.skipped++;
          continue;
        }

        // Check if user already logged today
        if (user.last_log_date === todayLocal) {
          console.log(`⏭️ User ${user.user_id} already logged today, skipping`);
          results.skipped++;
          continue;
        }

        const streak = user.current_streak || 0;
        const type = isMorningTime ? 'morning' : 'evening';
        const messages = type === 'morning' ? MORNING_MESSAGES : EVENING_MESSAGES;
        const messageTemplate = messages[Math.floor(Math.random() * messages.length)];
        const bodyText = messageTemplate(streak);

        const subject = type === 'morning' 
          ? (streak > 0 ? `Day ${streak + 1} - Keep your streak!` : 'Good morning - Time to check in')
          : (streak > 0 ? `Evening check-in • ${streak}-day streak` : 'How was your day?');

        const bodyHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                .container { max-width: 400px; margin: 0 auto; background: white; }
                .header { background: linear-gradient(135deg, #D6006C, #892EFF); padding: 24px; text-align: center; }
                .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 600; }
                .content { padding: 24px; text-align: center; }
                .message { font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 24px; }
                .cta-button { display: inline-block; background: linear-gradient(135deg, #D6006C, #892EFF); color: white !important; padding: 14px 32px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 15px; }
                .streak-badge { display: inline-block; background: #FFF3CD; color: #856404; padding: 6px 12px; border-radius: 20px; font-size: 13px; margin-bottom: 16px; }
                .footer { padding: 16px 24px; text-align: center; background: #f8f9fa; border-top: 1px solid #eee; }
                .footer p { margin: 4px 0; font-size: 11px; color: #888; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header"><h1>Jvala</h1></div>
                <div class="content">
                  ${streak > 0 ? `<div class="streak-badge">🔥 ${streak}-day streak</div>` : ''}
                  <p class="message">${bodyText}</p>
                  <a href="https://app.jvala.tech" class="cta-button">Quick Log</a>
                </div>
                <div class="footer">
                  <p>Manage reminders in Settings → Reminders</p>
                </div>
              </div>
            </body>
          </html>
        `;

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Jvala <onboarding@resend.dev>',
            to: [userProfile.email],
            subject,
            html: bodyHtml,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`❌ Failed to send email to ${userProfile.email}:`, error);
          results.errors++;
        } else {
          console.log(`✅ Sent ${type} email reminder to ${userProfile.email}`);
          results.sent++;

          // Update last sent timestamp to prevent duplicates
          const updateData = type === 'morning' 
            ? { last_morning_sent: todayLocal }
            : { last_evening_sent: todayLocal };

          await supabase
            .from('engagement')
            .update(updateData)
            .eq('user_id', user.user_id);
        }

        // Send via smart-notifications for push (uses VAPID/service worker)
        try {
          await fetch(`${supabaseUrl}/functions/v1/smart-notifications`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.user_id,
              type,
            }),
          });
          console.log(`📱 Sent ${type} smart push to ${user.user_id}`);
        } catch (pushError) {
          console.log(`⚠️ Smart push failed for ${user.user_id}:`, pushError);
        }

      } catch (userError) {
        console.error(`❌ Error processing user ${user.user_id}:`, userError);
        results.errors++;
      }
    }

    console.log(`📊 Results: ${results.sent} sent, ${results.skipped} skipped, ${results.errors} errors`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('❌ Process reminders error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
