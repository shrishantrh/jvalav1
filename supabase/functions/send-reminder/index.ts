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
  (streak: number) => `Morning! ${streak > 0 ? `Day ${streak + 1} of your streak awaits.` : 'Ready to log how you feel?'}`,
];

const EVENING_MESSAGES = [
  (streak: number) => `Evening reflection time. ${streak > 0 ? `Keep that ${streak}-day streak alive!` : 'How was today?'}`,
  (streak: number) => `Day winding down? ${streak > 0 ? `Your ${streak}-day streak is strong!` : 'Capture today before it fades.'}`,
  (streak: number) => `Before bed check-in. ${streak > 0 ? `Streak: ${streak} days and counting!` : 'A quick log helps you sleep knowing tomorrow will have context.'}`,
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!resendApiKey || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { userId, email, type, medicationName } = await req.json();

    console.log(`📧 Sending ${type} reminder to ${email}`);

    // Get user's streak and recent activity
    const { data: engagement } = await supabase
      .from('engagement')
      .select('current_streak, longest_streak, total_logs')
      .eq('user_id', userId)
      .single();

    const { data: recentLogs } = await supabase
      .from('flare_entries')
      .select('timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1);

    const streak = engagement?.current_streak || 0;
    const hasLoggedToday = recentLogs && recentLogs.length > 0 && 
      new Date(recentLogs[0].timestamp).toDateString() === new Date().toDateString();

    // Skip reminder if already logged today (unless it's medication)
    if (hasLoggedToday && type !== 'medication') {
      console.log('User already logged today, skipping reminder');
      return new Response(JSON.stringify({ skipped: true, reason: 'already_logged' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let subject = '';
    let bodyText = '';

    if (type === 'medication') {
      subject = `💊 ${medicationName || 'Medication'} Reminder`;
      bodyText = `Time for ${medicationName || 'your medication'}. Did you take it?`;
    } else if (type === 'morning') {
      const morningMsg = MORNING_MESSAGES[Math.floor(Math.random() * MORNING_MESSAGES.length)];
      subject = streak > 0 ? `Day ${streak + 1} - Keep your streak!` : `Good morning - Time to check in`;
      bodyText = morningMsg(streak);
    } else {
      const eveningMsg = EVENING_MESSAGES[Math.floor(Math.random() * EVENING_MESSAGES.length)];
      subject = streak > 0 ? `Evening check-in • ${streak}-day streak` : `How was your day?`;
      bodyText = eveningMsg(streak);
    }

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
              ${streak > 0 && type !== 'medication' ? `<div class="streak-badge">🔥 ${streak}-day streak</div>` : ''}
              <p class="message">${bodyText}</p>
              <a href="https://jvala.tech" class="cta-button">${type === 'medication' ? 'Log Medication' : 'Quick Log'}</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you enabled reminders.</p>
              <p>Manage in Settings → Reminders</p>
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
        to: [email],
        subject,
        html: bodyHtml,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend error:', error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Reminder sent:', result);

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Reminder error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
