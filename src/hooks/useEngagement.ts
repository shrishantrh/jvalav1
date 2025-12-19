import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInDays } from "date-fns";

const BADGE_DEFINITIONS = {
  // Core badges
  first_log: { name: 'First Log', description: 'Logged your first entry' },
  streak_3: { name: '3-Day Streak', description: 'Logged 3 days in a row' },
  streak_7: { name: 'Week Warrior', description: 'Logged 7 days in a row' },
  streak_30: { name: 'Monthly Master', description: 'Logged 30 days in a row' },
  logs_30: { name: '30 Logs', description: 'Logged 30 total entries' },
  logs_100: { name: 'Century Club', description: 'Logged 100 total entries' },
  detailed_first: { name: 'Detail Oriented', description: 'First detailed entry' },
  photo_first: { name: 'Picture Perfect', description: 'First photo log' },
  voice_first: { name: 'Voice Logger', description: 'First voice note' },
  // Enhanced badges
  perfect_week: { name: 'Perfect Week', description: 'Logged every day for a week' },
  pattern_detective: { name: 'Pattern Detective', description: 'Discovered first correlation' },
  insight_seeker: { name: 'Insight Seeker', description: 'Viewed insights 5 times' },
  export_pro: { name: 'Export Pro', description: 'First health export' },
  self_aware: { name: 'Self Aware', description: 'Tracked 10 different triggers' },
  symptom_tracker: { name: 'Symptom Tracker', description: 'Tracked 10 different symptoms' },
  consistency_king: { name: 'Consistency King', description: '80%+ logging for a month' },
  health_analyst: { name: 'Health Analyst', description: '5 correlations discovered' },
};

export const useEngagement = () => {
  
  const updateEngagementOnLog = async (userId: string, isDetailed?: boolean): Promise<{
    newBadges: string[];
    streakIncreased: boolean;
    currentStreak: number;
  }> => {
    try {
      // Get existing engagement data
      const { data: engagement } = await supabase
        .from('engagement')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Get ACTUAL total logs count from database
      const { count: totalEntries } = await supabase
        .from('flare_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // This is called AFTER insert, so count already includes new entry
      const actualTotalLogs = totalEntries || 0;
      const today = format(new Date(), 'yyyy-MM-dd');
      const newBadges: string[] = [];

      // No existing engagement record - first time user
      if (!engagement) {
        // Only give first_log badge if this is truly the first entry
        const badges = actualTotalLogs === 1 ? ['first_log'] : [];
        
        await supabase
          .from('engagement')
          .insert({
            user_id: userId,
            current_streak: 1,
            longest_streak: 1,
            total_logs: actualTotalLogs,
            last_log_date: today,
            badges
          });
        
        return { 
          newBadges: badges, 
          streakIncreased: true, 
          currentStreak: 1 
        };
      }

      // Existing user - calculate streak
      const lastLogDate = engagement.last_log_date;
      let newStreak = engagement.current_streak || 0;
      let streakIncreased = false;
      
      if (lastLogDate !== today) {
        // Check if yesterday was last log date
        const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
        
        if (lastLogDate === yesterday) {
          // Continuing streak
          newStreak = (engagement.current_streak || 0) + 1;
          streakIncreased = true;
        } else if (lastLogDate) {
          // Check gap - if more than 1 day, reset streak
          const lastDate = parseISO(lastLogDate);
          const gap = differenceInDays(new Date(), lastDate);
          
          if (gap > 1) {
            // Streak broken
            newStreak = 1;
            streakIncreased = true;
          } else {
            // Same day or continuing
            newStreak = Math.max(1, engagement.current_streak || 0);
          }
        } else {
          newStreak = 1;
          streakIncreased = true;
        }
      }

      const newLongestStreak = Math.max(engagement.longest_streak || 0, newStreak);
      const existingBadges = engagement.badges || [];
      
      // Badge checks - ONLY award if conditions met AND not already earned
      if (actualTotalLogs === 1 && !existingBadges.includes('first_log')) {
        newBadges.push('first_log');
      }
      if (newStreak >= 3 && !existingBadges.includes('streak_3')) {
        newBadges.push('streak_3');
      }
      if (newStreak >= 7 && !existingBadges.includes('streak_7')) {
        newBadges.push('streak_7');
      }
      if (newStreak >= 30 && !existingBadges.includes('streak_30')) {
        newBadges.push('streak_30');
      }
      if (actualTotalLogs >= 30 && !existingBadges.includes('logs_30')) {
        newBadges.push('logs_30');
      }
      if (actualTotalLogs >= 100 && !existingBadges.includes('logs_100')) {
        newBadges.push('logs_100');
      }
      if (isDetailed && !existingBadges.includes('detailed_first')) {
        newBadges.push('detailed_first');
      }

      await supabase
        .from('engagement')
        .update({
          current_streak: newStreak,
          longest_streak: newLongestStreak,
          total_logs: actualTotalLogs,
          last_log_date: today,
          badges: [...existingBadges, ...newBadges]
        })
        .eq('user_id', userId);

      return { newBadges, streakIncreased, currentStreak: newStreak };
    } catch (error) {
      console.error('Failed to update engagement:', error);
      return { newBadges: [], streakIncreased: false, currentStreak: 0 };
    }
  };

  const getEngagement = async (userId: string) => {
    const { data } = await supabase
      .from('engagement')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  };

  // Award special badges for specific actions
  const awardBadge = async (userId: string, badgeId: string): Promise<boolean> => {
    try {
      const { data: engagement } = await supabase
        .from('engagement')
        .select('badges')
        .eq('user_id', userId)
        .maybeSingle();

      const existingBadges = engagement?.badges || [];
      
      if (existingBadges.includes(badgeId)) {
        return false; // Already has badge
      }

      await supabase
        .from('engagement')
        .update({ badges: [...existingBadges, badgeId] })
        .eq('user_id', userId);

      return true;
    } catch (error) {
      console.error('Failed to award badge:', error);
      return false;
    }
  };

  // Check for correlation-based badges
  const checkCorrelationBadges = async (userId: string): Promise<string[]> => {
    try {
      const { count } = await supabase
        .from('correlations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const newBadges: string[] = [];
      const { data: engagement } = await supabase
        .from('engagement')
        .select('badges')
        .eq('user_id', userId)
        .maybeSingle();

      const existingBadges = engagement?.badges || [];

      if (count && count >= 1 && !existingBadges.includes('pattern_detective')) {
        newBadges.push('pattern_detective');
      }
      if (count && count >= 5 && !existingBadges.includes('health_analyst')) {
        newBadges.push('health_analyst');
      }

      if (newBadges.length > 0) {
        await supabase
          .from('engagement')
          .update({ badges: [...existingBadges, ...newBadges] })
          .eq('user_id', userId);
      }

      return newBadges;
    } catch (error) {
      console.error('Failed to check correlation badges:', error);
      return [];
    }
  };

  // Check for tracking variety badges (symptoms/triggers)
  const checkTrackingBadges = async (userId: string): Promise<string[]> => {
    try {
      const { data: entries } = await supabase
        .from('flare_entries')
        .select('symptoms, triggers')
        .eq('user_id', userId);

      if (!entries) return [];

      const allSymptoms = new Set<string>();
      const allTriggers = new Set<string>();

      entries.forEach(entry => {
        (entry.symptoms || []).forEach((s: string) => allSymptoms.add(s));
        (entry.triggers || []).forEach((t: string) => allTriggers.add(t));
      });

      const newBadges: string[] = [];
      const { data: engagement } = await supabase
        .from('engagement')
        .select('badges')
        .eq('user_id', userId)
        .maybeSingle();

      const existingBadges = engagement?.badges || [];

      if (allSymptoms.size >= 10 && !existingBadges.includes('symptom_tracker')) {
        newBadges.push('symptom_tracker');
      }
      if (allTriggers.size >= 10 && !existingBadges.includes('self_aware')) {
        newBadges.push('self_aware');
      }

      if (newBadges.length > 0) {
        await supabase
          .from('engagement')
          .update({ badges: [...existingBadges, ...newBadges] })
          .eq('user_id', userId);
      }

      return newBadges;
    } catch (error) {
      console.error('Failed to check tracking badges:', error);
      return [];
    }
  };

  // Check for consistency badges (perfect_week, consistency_king)
  const checkConsistencyBadges = async (userId: string, entries: { timestamp: Date }[]): Promise<string[]> => {
    try {
      const { data: engagement } = await supabase
        .from('engagement')
        .select('badges, current_streak')
        .eq('user_id', userId)
        .maybeSingle();

      const existingBadges = engagement?.badges || [];
      const newBadges: string[] = [];

      // Check for perfect_week: 7 consecutive days logged
      const last7Days = new Set<string>();
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        last7Days.add(format(d, 'yyyy-MM-dd'));
      }

      const daysWithEntries = new Set(
        entries.map(e => format(new Date(e.timestamp), 'yyyy-MM-dd'))
      );

      let perfectWeek = true;
      last7Days.forEach(day => {
        if (!daysWithEntries.has(day)) perfectWeek = false;
      });

      if (perfectWeek && !existingBadges.includes('perfect_week')) {
        newBadges.push('perfect_week');
      }

      // Check for consistency_king: 80%+ logging for current month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const dayOfMonth = today.getDate();
      const entriesThisMonth = entries.filter(e => new Date(e.timestamp) >= startOfMonth);
      const daysLoggedThisMonth = new Set(
        entriesThisMonth.map(e => format(new Date(e.timestamp), 'yyyy-MM-dd'))
      ).size;

      const consistencyRate = (daysLoggedThisMonth / dayOfMonth) * 100;
      if (consistencyRate >= 80 && dayOfMonth >= 7 && !existingBadges.includes('consistency_king')) {
        newBadges.push('consistency_king');
      }

      if (newBadges.length > 0) {
        await supabase
          .from('engagement')
          .update({ badges: [...existingBadges, ...newBadges] })
          .eq('user_id', userId);
      }

      return newBadges;
    } catch (error) {
      console.error('Failed to check consistency badges:', error);
      return [];
    }
  };

  const syncEngagementTotals = async (userId: string) => {
    try {
      // Get actual count from entries
      const { count } = await supabase
        .from('flare_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (count !== null) {
        // Get current engagement to preserve badges
        const { data: engagement } = await supabase
          .from('engagement')
          .select('badges')
          .eq('user_id', userId)
          .maybeSingle();

        // Only award first_log badge if count is actually 1 and not already awarded
        const existingBadges = engagement?.badges || [];
        const shouldHaveFirstLog = count >= 1 && !existingBadges.includes('first_log');
        
        // Don't retroactively add first_log for users with many entries
        // Only users with exactly 1 entry get it fresh
        await supabase
          .from('engagement')
          .update({ total_logs: count })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error('Failed to sync engagement:', error);
    }
  };

  const getBadgeInfo = (badgeId: string) => {
    return BADGE_DEFINITIONS[badgeId as keyof typeof BADGE_DEFINITIONS] || { 
      name: badgeId, 
      description: 'Achievement unlocked' 
    };
  };

  return { 
    updateEngagementOnLog, 
    getEngagement, 
    syncEngagementTotals,
    getBadgeInfo,
    awardBadge,
    checkCorrelationBadges,
    checkTrackingBadges,
    checkConsistencyBadges,
    BADGE_DEFINITIONS
  };
};
