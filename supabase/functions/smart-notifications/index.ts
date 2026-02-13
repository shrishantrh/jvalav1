import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Human-friendly message templates ────────────────────────────────────────

const MORNING_MESSAGES = [
  (ctx: MsgCtx) => ctx.streak > 7
    ? `Good morning! ${ctx.streak} days strong 🔥 How are you waking up today?`
    : ctx.streak > 0
    ? `Morning! Day ${ctx.streak + 1} of your streak. Quick check-in?`
    : `Hey, good morning! How are you feeling today?`,
  (ctx: MsgCtx) => ctx.lastSeverity === 'severe'
    ? `Morning. Yesterday was rough — how did you sleep? 💜`
    : `Rise and shine! A quick log takes 3 seconds.`,
  (ctx: MsgCtx) => ctx.weatherChange
    ? `Heads up — ${ctx.weatherChange}. Worth noting how you feel.`
    : `New day, fresh start. Tap to log how you're doing.`,
];

const AFTERNOON_MESSAGES = [
  (ctx: MsgCtx) => ctx.lastSeverity === 'severe'
    ? `Checking in — how's the afternoon going after yesterday's flare?`
    : `Afternoon check-in! How's your energy right now?`,
  (ctx: MsgCtx) => `Quick midday pulse: any symptoms to note?`,
];

const EVENING_MESSAGES = [
  (ctx: MsgCtx) => ctx.streak > 0
    ? `Evening! ${ctx.streak}-day streak. How was today overall?`
    : `Hey! Before you wind down — how was your day?`,
  (ctx: MsgCtx) => ctx.totalLogsToday === 0
    ? `You haven't logged today yet. Even a quick tap helps track patterns.`
    : `Nice — you logged ${ctx.totalLogsToday} time${ctx.totalLogsToday > 1 ? 's' : ''} today. Any evening update?`,
];

const NIGHT_MESSAGES = [
  (ctx: MsgCtx) => `Before sleep — rate your day with a quick log. Rest well 🌙`,
  (ctx: MsgCtx) => ctx.lastSeverity
    ? `Hope tonight is better. Quick severity tap before bed?`
    : `Goodnight! Log anything you noticed today.`,
];

const POST_FLARE_MESSAGES: Record<string, ((ctx: MsgCtx) => string)[]> = {
  '2h': [
    (ctx: MsgCtx) => `It's been 2 hours since your ${ctx.lastSeverity} flare. How are things now?`,
    (ctx: MsgCtx) => `Quick follow-up — feeling any better since earlier?`,
  ],
  '6h': [
    (ctx: MsgCtx) => `6 hours since your flare. Has anything changed?`,
    (ctx: MsgCtx) => `Checking in — how's the rest of your day going?`,
  ],
  'next_morning': [
    (ctx: MsgCtx) => `Good morning. How are you feeling after yesterday's ${ctx.lastSeverity} flare?`,
    (ctx: MsgCtx) => `Morning after a tough day — how did you sleep? Any lingering symptoms?`,
  ],
};

const ENVIRONMENTAL_MESSAGES = [
  (ctx: MsgCtx) => `🌡️ ${ctx.weatherChange} — people with similar conditions often notice changes. Worth a quick log.`,
  (ctx: MsgCtx) => `Environmental alert: ${ctx.weatherChange}. How are you feeling?`,
];

const INACTIVITY_MESSAGES = [
  (ctx: MsgCtx) => ctx.daysSinceLastLog === 1
    ? `Hey, you missed yesterday. No judgment — just a gentle nudge 💜`
    : ctx.daysSinceLastLog! <= 3
    ? `It's been ${ctx.daysSinceLastLog} days. Even a quick severity tap helps.`
    : `We miss you! ${ctx.daysSinceLastLog} days without a log. Your patterns work best with consistent data.`,
];

const STREAK_MILESTONE_MESSAGES: Record<number, string> = {
  3: `🎉 3-day streak! You're building a real habit.`,
  7: `🔥 One full week! Your data is starting to reveal patterns.`,
  14: `💪 Two weeks strong! Your insights are getting more accurate.`,
  30: `🏆 30 days! You're a tracking champion. Your doctor will love this data.`,
  60: `🌟 60 days of consistency. You're truly dedicated to understanding your health.`,
  100: `💎 100 days! Incredible commitment. Your health story is beautifully documented.`,
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface MsgCtx {
  streak: number;
  lastSeverity?: string;
  weatherChange?: string;
  totalLogsToday: number;
  daysSinceLastLog?: number;
  userName?: string;
}

type NotificationType = 
  | 'morning' | 'afternoon' | 'evening' | 'night'
  | 'post_flare_2h' | 'post_flare_6h' | 'post_flare_next_morning'
  | 'environmental_change' | 'inactivity' | 'streak_milestone'
  | 'medication_reminder';

interface NotificationRequest {
  userId: string;
  type: NotificationType;
  context?: {
    severity?: string;
    weatherChange?: string;
    medicationName?: string;
    milestoneDay?: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTitle(type: NotificationType): string {
  const titles: Record<string, string> = {
    morning: '🌅 Morning Check-in',
    afternoon: '☀️ Afternoon Pulse',
    evening: '🌆 Evening Reflection',
    night: '🌙 Bedtime Log',
    post_flare_2h: '💜 How Are You Now?',
    post_flare_6h: '💜 Follow-up Check',
    post_flare_next_morning: '🌅 Morning After',
    environmental_change: '🌡️ Environment Alert',
    inactivity: '👋 We Miss You',
    streak_milestone: '🎉 Streak Milestone!',
    medication_reminder: '💊 Medication Time',
  };
  return titles[type] || 'Jvala';
}

function getTag(type: NotificationType): string {
  return `jvala-${type.replace(/_/g, '-')}`;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NotificationRequest = await req.json();
    const { userId, type, context = {} } = body;

    if (!userId || !type) {
      return new Response(JSON.stringify({ error: 'userId and type required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gather user context
    const { data: engagement } = await supabase
      .from('engagement')
      .select('current_streak, last_log_date, total_logs')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, timezone')
      .eq('id', userId)
      .maybeSingle();

    // Count today's logs
    const timezone = profile?.timezone || 'UTC';
    const now = new Date();
    const todayStart = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayLogCount } = await supabase
      .from('flare_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('timestamp', todayStart.toISOString());

    // Calculate days since last log
    let daysSinceLastLog = 0;
    if (engagement?.last_log_date) {
      const lastLog = new Date(engagement.last_log_date);
      daysSinceLastLog = Math.floor((now.getTime() - lastLog.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Build message context
    const msgCtx: MsgCtx = {
      streak: engagement?.current_streak || 0,
      lastSeverity: context.severity,
      weatherChange: context.weatherChange,
      totalLogsToday: todayLogCount || 0,
      daysSinceLastLog,
      userName: profile?.full_name?.split(' ')[0],
    };

    // Generate message based on type
    let messageBody: string;
    
    switch (type) {
      case 'morning':
        messageBody = pickRandom(MORNING_MESSAGES)(msgCtx);
        break;
      case 'afternoon':
        messageBody = pickRandom(AFTERNOON_MESSAGES)(msgCtx);
        break;
      case 'evening':
        messageBody = pickRandom(EVENING_MESSAGES)(msgCtx);
        break;
      case 'night':
        messageBody = pickRandom(NIGHT_MESSAGES)(msgCtx);
        break;
      case 'post_flare_2h':
        messageBody = pickRandom(POST_FLARE_MESSAGES['2h'])(msgCtx);
        break;
      case 'post_flare_6h':
        messageBody = pickRandom(POST_FLARE_MESSAGES['6h'])(msgCtx);
        break;
      case 'post_flare_next_morning':
        messageBody = pickRandom(POST_FLARE_MESSAGES['next_morning'])(msgCtx);
        break;
      case 'environmental_change':
        messageBody = pickRandom(ENVIRONMENTAL_MESSAGES)(msgCtx);
        break;
      case 'inactivity':
        messageBody = pickRandom(INACTIVITY_MESSAGES)(msgCtx);
        break;
      case 'streak_milestone': {
        const day = context.milestoneDay || msgCtx.streak;
        messageBody = STREAK_MILESTONE_MESSAGES[day] || `🔥 ${day}-day streak! Keep it going!`;
        break;
      }
      case 'medication_reminder':
        messageBody = context.medicationName 
          ? `Time to take your ${context.medicationName}. Tap to log.`
          : `Medication reminder — don't forget your meds today.`;
        break;
      default:
        messageBody = `Hey! Time for a quick check-in.`;
    }

    // Prepend name if available
    if (msgCtx.userName && !messageBody.startsWith(msgCtx.userName)) {
      // Only sometimes add name for variety
      if (Math.random() > 0.6) {
        messageBody = `${msgCtx.userName}, ${messageBody.charAt(0).toLowerCase()}${messageBody.slice(1)}`;
      }
    }

    const title = getTitle(type);
    const tag = getTag(type);

    // Send push notification via send-push function
    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        title,
        body: messageBody,
        tag,
        url: '/?action=quick-log',
        requireInteraction: ['post_flare_2h', 'post_flare_6h', 'inactivity'].includes(type),
      }),
    });

    const pushResult = await pushResponse.json();

    // Also send email for important notifications (morning, evening, inactivity, post-flare)
    const emailWorthy = ['morning', 'evening', 'inactivity', 'post_flare_next_morning'].includes(type);
    let emailSent = false;

    if (emailWorthy) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const { data: emailProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (resendApiKey && emailProfile?.email) {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Jvala <onboarding@resend.dev>',
            to: [emailProfile.email],
            subject: title.replace(/[🌅☀️🌆🌙💜👋🎉💊🌡️]/g, '').trim(),
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                    .container { max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
                    .header { background: linear-gradient(135deg, #D6006C, #892EFF); padding: 20px; text-align: center; }
                    .header h1 { color: white; margin: 0; font-size: 18px; }
                    .content { padding: 24px; text-align: center; }
                    .message { font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 24px; }
                    .cta { display: inline-block; background: linear-gradient(135deg, #D6006C, #892EFF); color: white !important; padding: 12px 28px; border-radius: 25px; text-decoration: none; font-weight: 600; }
                    .footer { padding: 12px; text-align: center; font-size: 11px; color: #999; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header"><h1>${title}</h1></div>
                    <div class="content">
                      ${msgCtx.streak > 0 ? `<p style="font-size:13px;color:#856404;background:#FFF3CD;display:inline-block;padding:4px 12px;border-radius:12px;">🔥 ${msgCtx.streak}-day streak</p>` : ''}
                      <p class="message">${messageBody}</p>
                      <a href="https://app.jvala.tech" class="cta">Open Jvala</a>
                    </div>
                    <div class="footer">Manage in Settings → Reminders</div>
                  </div>
                </body>
              </html>
            `,
          }),
        });
        emailSent = emailResponse.ok;
      }
    }

    console.log(`📱 Smart notification [${type}] sent to ${userId}: "${messageBody.substring(0, 60)}..."`);

    return new Response(JSON.stringify({
      success: true,
      type,
      push: pushResult,
      emailSent,
      message: messageBody,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Smart notification error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
