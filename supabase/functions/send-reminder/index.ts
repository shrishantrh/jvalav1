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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!resendApiKey || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { userId, email, type } = await req.json();

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

    if (hasLoggedToday && type === 'morning') {
      console.log('User already logged today, skipping reminder');
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subject = type === 'morning' 
      ? `Good morning! ${streak > 0 ? `Keep your ${streak}-day streak going 🔥` : 'Time to check in'}`
      : `Evening check-in ${streak > 0 ? `• ${streak}-day streak` : ''}`;

    const bodyHtml = type === 'morning' 
      ? `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #B40078; margin-bottom: 10px;">Good morning! ☀️</h2>
          <p style="color: #444; line-height: 1.6;">
            ${streak > 0 
              ? `You're on a <strong>${streak}-day logging streak</strong>. A quick log keeps your data accurate and your streak alive!`
              : `Starting your day with a quick health check-in helps track patterns over time.`
            }
          </p>
          <a href="https://jvala.app" style="display: inline-block; background: linear-gradient(135deg, #D6006C, #892EFF); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 15px;">
            Log how you're feeling
          </a>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">
            You can manage reminders in your Jvala settings.
          </p>
        </div>
      `
      : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #B40078; margin-bottom: 10px;">Evening check-in 🌙</h2>
          <p style="color: #444; line-height: 1.6;">
            How was today? A quick log before bed helps capture your day while it's fresh.
            ${streak > 0 ? `<br><br><strong>Current streak:</strong> ${streak} days` : ''}
          </p>
          <a href="https://jvala.app" style="display: inline-block; background: linear-gradient(135deg, #D6006C, #892EFF); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 15px;">
            Quick log now
          </a>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">
            Manage reminders in your Jvala settings.
          </p>
        </div>
      `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Jvala <reminders@jvala.app>',
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
