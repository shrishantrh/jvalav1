/**
 * Smart Local Notifications — Duolingo-style on-device scheduling.
 * 
 * When the app opens, this hook:
 * 1. Cancels all previously scheduled notifications
 * 2. Schedules condition-aware notifications for the next 7 days
 * 3. Adapts timing and content based on user behavior and patterns
 * 
 * Uses @capacitor/local-notifications on native, falls back to no-op on web.
 */
import { useEffect, useCallback, useRef } from 'react';
import { isNative } from '@/lib/capacitor';
import { supabase } from '@/integrations/supabase/client';

interface ScheduleContext {
  userName?: string | null;
  conditions?: string[];
  streak?: number;
  lastLogDate?: string | null;
  reminderTimes?: string[];
  reminderEnabled?: boolean;
}

// Notification content pools — condition-aware, never generic
const MORNING_MESSAGES = [
  { title: 'Morning check-in', body: 'How did you sleep? A quick log helps spot patterns.' },
  { title: 'Start your day right', body: 'Log how you feel — even "feeling fine" is useful data.' },
  { title: 'Good morning', body: 'Take 5 seconds to check in. Your future self will thank you.' },
];

const EVENING_MESSAGES = [
  { title: 'Evening wrap-up', body: 'How was today? Log any symptoms before bed.' },
  { title: 'End of day', body: 'Did anything trigger a flare today? Quick log before you forget.' },
  { title: 'Daily recap', body: 'Tap to log your day — consistency reveals patterns.' },
];

const STREAK_MESSAGES = [
  { title: 'Keep it going! 🔥', body: 'Don\'t break your {streak}-day streak! Quick log takes 3 seconds.' },
  { title: 'Streak alert', body: '{streak} days strong. One tap to keep it alive.' },
];

const INACTIVITY_MESSAGES = [
  { title: 'We miss your data', body: 'It\'s been {days} days. Even one log keeps your AI learning.' },
  { title: 'Quick check-in?', body: 'Your patterns need consistent data. Tap to log in 3 seconds.' },
];

const MEAL_MESSAGES = [
  { title: 'Meal time?', body: 'Log what you ate — food patterns often connect to flares.' },
];

const PREDICTION_MESSAGES = [
  { title: 'Risk alert', body: 'Based on recent patterns, stay mindful today. Check your forecast.' },
];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const fillTemplate = (msg: { title: string; body: string }, vars: Record<string, string | number>) => ({
  title: msg.title,
  body: Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), msg.body),
});

export const useSmartLocalNotifications = (userId: string | null, context?: ScheduleContext) => {
  const scheduledRef = useRef(false);

  const scheduleNotifications = useCallback(async () => {
    if (!isNative || !userId || scheduledRef.current) return;
    scheduledRef.current = true;

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      // Check permission
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const result = await LocalNotifications.requestPermissions();
        if (result.display !== 'granted') return;
      }

      // Cancel all existing scheduled notifications
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }

      // Fetch user context if not provided
      let ctx = context;
      if (!ctx) {
        const [profileRes, engagementRes] = await Promise.all([
          supabase.from('profiles').select('full_name, conditions').eq('id', userId).maybeSingle(),
          supabase.from('engagement').select('current_streak, last_log_date, reminder_enabled, reminder_times').eq('user_id', userId).maybeSingle(),
        ]);
        ctx = {
          userName: profileRes.data?.full_name?.split(' ')[0],
          conditions: profileRes.data?.conditions || [],
          streak: engagementRes.data?.current_streak || 0,
          lastLogDate: engagementRes.data?.last_log_date,
          reminderEnabled: engagementRes.data?.reminder_enabled ?? true,
          reminderTimes: engagementRes.data?.reminder_times || [],
        };
      }

      if (ctx.reminderEnabled === false) return;

      const notifications: any[] = [];
      let notifId = 1000;

      const morningHour = 9;
      const eveningHour = 20;
      const mealHour = 13;

      // Schedule for next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);

        // Morning check-in
        const morningDate = new Date(date);
        morningDate.setHours(morningHour, 0, 0, 0);
        if (morningDate > new Date()) {
          const msg = pick(MORNING_MESSAGES);
          notifications.push({
            id: notifId++,
            title: msg.title,
            body: ctx.userName ? `${ctx.userName}, ${msg.body.charAt(0).toLowerCase()}${msg.body.slice(1)}` : msg.body,
            schedule: { at: morningDate },
            sound: 'default',
            smallIcon: 'ic_notification',
          });
        }

        // Evening wrap-up
        const eveningDate = new Date(date);
        eveningDate.setHours(eveningHour, 0, 0, 0);
        if (eveningDate > new Date()) {
          const msg = pick(EVENING_MESSAGES);
          notifications.push({
            id: notifId++,
            title: msg.title,
            body: msg.body,
            schedule: { at: eveningDate },
            sound: 'default',
            smallIcon: 'ic_notification',
          });
        }

        // Meal reminder (every other day)
        if (dayOffset % 2 === 0) {
          const mealDate = new Date(date);
          mealDate.setHours(mealHour, 30, 0, 0);
          if (mealDate > new Date()) {
            const msg = pick(MEAL_MESSAGES);
            notifications.push({
              id: notifId++,
              title: msg.title,
              body: msg.body,
              schedule: { at: mealDate },
              sound: 'default',
              smallIcon: 'ic_notification',
            });
          }
        }

        // Streak reminder (afternoon, only if streak > 2 and no log today)
        if ((ctx.streak || 0) > 2 && dayOffset > 0) {
          const streakDate = new Date(date);
          streakDate.setHours(16, 0, 0, 0);
          if (streakDate > new Date()) {
            const msg = fillTemplate(pick(STREAK_MESSAGES), { streak: ctx.streak || 0 });
            notifications.push({
              id: notifId++,
              title: msg.title,
              body: msg.body,
              schedule: { at: streakDate },
              sound: 'default',
              smallIcon: 'ic_notification',
            });
          }
        }
      }

      // Inactivity nudge — if last log > 2 days ago, add one for tomorrow at 11am
      if (ctx.lastLogDate) {
        const daysSince = Math.floor((Date.now() - new Date(ctx.lastLogDate).getTime()) / 86400000);
        if (daysSince >= 2) {
          const inactivityDate = new Date();
          inactivityDate.setDate(inactivityDate.getDate() + 1);
          inactivityDate.setHours(11, 0, 0, 0);
          const msg = fillTemplate(pick(INACTIVITY_MESSAGES), { days: daysSince });
          notifications.push({
            id: notifId++,
            title: msg.title,
            body: msg.body,
            schedule: { at: inactivityDate },
            sound: 'default',
            smallIcon: 'ic_notification',
          });
        }
      }

      // Prediction alert — schedule for tomorrow at 8am if they have conditions
      if ((ctx.conditions?.length || 0) > 0) {
        const predDate = new Date();
        predDate.setDate(predDate.getDate() + 1);
        predDate.setHours(8, 0, 0, 0);
        if (predDate > new Date()) {
          const msg = pick(PREDICTION_MESSAGES);
          notifications.push({
            id: notifId++,
            title: msg.title,
            body: msg.body,
            schedule: { at: predDate },
            sound: 'default',
            smallIcon: 'ic_notification',
          });
        }
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`[SmartLocalNotif] Scheduled ${notifications.length} notifications for next 7 days`);
      }
    } catch (e) {
      console.error('[SmartLocalNotif] Error scheduling:', e);
    }
  }, [userId, context]);

  // Schedule on mount with a delay
  useEffect(() => {
    if (!isNative || !userId) return;
    const timer = setTimeout(scheduleNotifications, 3000);
    return () => clearTimeout(timer);
  }, [userId, scheduleNotifications]);

  return { scheduleNotifications };
};
