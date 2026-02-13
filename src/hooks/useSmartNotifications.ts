import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from './usePushNotifications';

type NotificationType =
  | 'morning' | 'afternoon' | 'evening' | 'night'
  | 'post_flare_2h' | 'post_flare_6h' | 'post_flare_next_morning'
  | 'environmental_change' | 'inactivity' | 'streak_milestone'
  | 'medication_reminder';

interface SmartNotificationContext {
  severity?: string;
  weatherChange?: string;
  medicationName?: string;
  milestoneDay?: number;
}

/**
 * useSmartNotifications — Proactive, context-aware notification triggers.
 *
 * Fires at the right moment:
 *  • App open → morning/afternoon/evening/night check-in based on time-of-day
 *  • After flare → schedules 2h and 6h follow-ups
 *  • Environmental shift → alerts user of weather/AQI changes
 *  • Inactivity → nudge if no log in 24h+
 *  • Streak milestone → celebrate 3, 7, 14, 30, 60, 100 days
 */
export const useSmartNotifications = () => {
  const { permission, isSubscribed } = usePushNotifications();
  const followUpTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasCheckedOnOpen = useRef(false);

  // Send a smart notification via edge function
  const sendSmartNotification = useCallback(async (
    type: NotificationType,
    context?: SmartNotificationContext
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.functions.invoke('smart-notifications', {
        body: { userId: user.id, type, context },
      });

      console.log(`[SmartNotif] Sent: ${type}`);
    } catch (err) {
      console.error(`[SmartNotif] Failed to send ${type}:`, err);
    }
  }, []);

  // Schedule post-flare follow-ups
  const schedulePostFlareFollowUps = useCallback((severity: string) => {
    // Clear existing timers
    followUpTimers.current.forEach(clearTimeout);
    followUpTimers.current = [];

    if (permission !== 'granted') return;

    // 2-hour follow-up
    const timer2h = setTimeout(() => {
      sendSmartNotification('post_flare_2h', { severity });
    }, 2 * 60 * 60 * 1000);

    // 6-hour follow-up
    const timer6h = setTimeout(() => {
      sendSmartNotification('post_flare_6h', { severity });
    }, 6 * 60 * 60 * 1000);

    followUpTimers.current = [timer2h, timer6h];
    console.log(`[SmartNotif] Scheduled post-flare follow-ups for ${severity} flare`);
  }, [permission, sendSmartNotification]);

  // Check environmental changes against last logged data
  const checkEnvironmentalChanges = useCallback(async (
    currentWeather: { temperature?: number; pressure?: number; aqi?: number }
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the most recent flare's environmental data
      const { data: lastEntry } = await supabase
        .from('flare_entries')
        .select('environmental_data')
        .eq('user_id', user.id)
        .not('environmental_data', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastEntry?.environmental_data) return;

      const lastEnv = lastEntry.environmental_data as Record<string, any>;
      const changes: string[] = [];

      // Pressure drop > 8 hPa
      if (currentWeather.pressure && lastEnv.pressure) {
        const pressureDelta = Math.abs(currentWeather.pressure - lastEnv.pressure);
        if (pressureDelta > 8) {
          changes.push(`pressure ${currentWeather.pressure > lastEnv.pressure ? 'rose' : 'dropped'} ${Math.round(pressureDelta)} hPa`);
        }
      }

      // Temperature swing > 10°C
      if (currentWeather.temperature !== undefined && lastEnv.temperature !== undefined) {
        const tempDelta = Math.abs(currentWeather.temperature - lastEnv.temperature);
        if (tempDelta > 10) {
          changes.push(`temp shifted ${Math.round(tempDelta)}°`);
        }
      }

      // AQI jump
      if (currentWeather.aqi && lastEnv.aqi) {
        if (currentWeather.aqi > 100 && lastEnv.aqi <= 100) {
          changes.push(`AQI spiked to ${currentWeather.aqi}`);
        }
      }

      if (changes.length > 0) {
        sendSmartNotification('environmental_change', {
          weatherChange: changes.join(', '),
        });
      }
    } catch (err) {
      console.error('[SmartNotif] Environmental check failed:', err);
    }
  }, [sendSmartNotification]);

  // Notify streak milestone
  const checkStreakMilestone = useCallback((newStreak: number) => {
    const milestones = [3, 7, 14, 30, 60, 100];
    if (milestones.includes(newStreak)) {
      sendSmartNotification('streak_milestone', { milestoneDay: newStreak });
    }
  }, [sendSmartNotification]);

  // On app open: determine time-of-day and check for inactivity
  useEffect(() => {
    if (hasCheckedOnOpen.current) return;
    if (permission !== 'granted' || !isSubscribed) return;

    const checkOnOpen = async () => {
      hasCheckedOnOpen.current = true;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check inactivity
      const { data: engagement } = await supabase
        .from('engagement')
        .select('last_log_date, current_streak')
        .eq('user_id', user.id)
        .maybeSingle();

      if (engagement?.last_log_date) {
        const lastLog = new Date(engagement.last_log_date);
        const daysSince = Math.floor(
          (Date.now() - lastLog.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSince >= 2) {
          sendSmartNotification('inactivity');
          return; // Don't also send time-of-day notification
        }
      }

      // Determine time-of-day check-in (only local notification, not push)
      // Push notifications are handled by process-reminders cron
    };

    // Delay slightly so app has time to load
    const timer = setTimeout(checkOnOpen, 3000);
    return () => clearTimeout(timer);
  }, [permission, isSubscribed, sendSmartNotification]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      followUpTimers.current.forEach(clearTimeout);
    };
  }, []);

  return {
    sendSmartNotification,
    schedulePostFlareFollowUps,
    checkEnvironmentalChanges,
    checkStreakMilestone,
  };
};
