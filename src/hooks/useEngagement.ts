import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInDays } from "date-fns";

export const useEngagement = () => {
  
  const updateEngagementOnLog = async (userId: string, isDetailed?: boolean): Promise<{
    newBadges: string[];
    streakIncreased: boolean;
    currentStreak: number;
  }> => {
    try {
      const { data: engagement } = await supabase
        .from('engagement')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const { count: totalEntries } = await supabase
        .from('flare_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const actualTotalLogs = totalEntries || 0;
      const today = format(new Date(), 'yyyy-MM-dd');
      const newBadges: string[] = [];

      if (!engagement) {
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
        return { newBadges: badges, streakIncreased: true, currentStreak: 1 };
      }

      // Calculate streak
      const lastLogDate = engagement.last_log_date;
      let newStreak = engagement.current_streak || 0;
      let streakIncreased = false;
      const previousStreak = engagement.current_streak || 0;
      
      if (lastLogDate !== today) {
        const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
        if (lastLogDate === yesterday) {
          newStreak = (engagement.current_streak || 0) + 1;
          streakIncreased = true;
        } else if (lastLogDate) {
          const lastDate = parseISO(lastLogDate);
          const gap = differenceInDays(new Date(), lastDate);
          if (gap > 1) {
            newStreak = 1;
            streakIncreased = true;
          } else {
            newStreak = Math.max(1, engagement.current_streak || 0);
          }
        } else {
          newStreak = 1;
          streakIncreased = true;
        }
      }

      const newLongestStreak = Math.max(engagement.longest_streak || 0, newStreak);
      const existingBadges = engagement.badges || [];

      // === MILESTONE BADGES ===
      const milestoneThresholds: [number, string][] = [
        [1, 'first_log'], [10, 'logs_10'], [25, 'logs_25'], [50, 'logs_50'],
        [100, 'logs_100'], [250, 'logs_250'], [500, 'logs_500'], [1000, 'logs_1000'], [2500, 'logs_2500'],
      ];
      for (const [threshold, badge] of milestoneThresholds) {
        if (actualTotalLogs >= threshold && !existingBadges.includes(badge)) {
          newBadges.push(badge);
        }
      }

      // === STREAK BADGES ===
      const streakThresholds: [number, string][] = [
        [3, 'streak_3'], [7, 'streak_7'], [14, 'streak_14'], [21, 'streak_21'],
        [30, 'streak_30'], [60, 'streak_60'], [90, 'streak_90'], [180, 'streak_180'], [365, 'streak_365'],
      ];
      for (const [threshold, badge] of streakThresholds) {
        if (newStreak >= threshold && !existingBadges.includes(badge)) {
          newBadges.push(badge);
        }
      }

      // Comeback kid: rebuilt to 7+ after breaking
      if (previousStreak === 0 && newStreak >= 7 && !existingBadges.includes('streak_comeback')) {
        // Check if they had a previous streak that was broken
        if ((engagement.longest_streak || 0) > newStreak) {
          newBadges.push('streak_comeback');
        }
      }

      // === FEATURE BADGES ===
      if (isDetailed && !existingBadges.includes('detailed_first')) {
        newBadges.push('detailed_first');
      }

      // === TIME-BASED BADGES ===
      const now = new Date();
      const hour = now.getHours();
      const month = now.getMonth(); // 0-indexed
      const day = now.getDate();
      const monthDay = `${month + 1}-${day}`;

      // Seasonal badges
      if (month >= 2 && month <= 4 && !existingBadges.includes('spring_tracker')) newBadges.push('spring_tracker');
      if (month >= 5 && month <= 7 && !existingBadges.includes('summer_logger')) newBadges.push('summer_logger');
      if (month >= 8 && month <= 10 && !existingBadges.includes('fall_tracker')) newBadges.push('fall_tracker');
      if ((month === 11 || month <= 1) && !existingBadges.includes('winter_warrior')) newBadges.push('winter_warrior');

      // Special date badges
      if (monthDay === '1-1' && !existingBadges.includes('new_year_logger')) newBadges.push('new_year_logger');
      if (monthDay === '2-14' && !existingBadges.includes('valentines_care')) newBadges.push('valentines_care');
      if (monthDay === '10-31' && !existingBadges.includes('halloween_logger')) newBadges.push('halloween_logger');
      if (monthDay === '12-25' && !existingBadges.includes('holiday_health')) newBadges.push('holiday_health');
      if (monthDay === '3-14' && !existingBadges.includes('pi_day')) newBadges.push('pi_day');
      if (monthDay === '2-29' && !existingBadges.includes('leap_year')) newBadges.push('leap_year');

      // Midnight logger
      if (hour === 0 && now.getMinutes() < 5 && !existingBadges.includes('midnight_logger')) {
        newBadges.push('midnight_logger');
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

  const awardBadge = async (userId: string, badgeId: string): Promise<boolean> => {
    try {
      const { data: engagement } = await supabase
        .from('engagement')
        .select('badges')
        .eq('user_id', userId)
        .maybeSingle();

      const existingBadges = engagement?.badges || [];
      if (existingBadges.includes(badgeId)) return false;

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

      if (count && count >= 1 && !existingBadges.includes('pattern_detective')) newBadges.push('pattern_detective');
      if (count && count >= 5 && !existingBadges.includes('health_analyst')) newBadges.push('health_analyst');
      if (count && count >= 10 && !existingBadges.includes('data_scientist')) newBadges.push('data_scientist');

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

  const checkTrackingBadges = async (userId: string): Promise<string[]> => {
    try {
      const { data: entries } = await supabase
        .from('flare_entries')
        .select('symptoms, triggers, medications, photos, voice_transcript, energy_level, environmental_data, city, severity')
        .eq('user_id', userId);

      if (!entries) return [];

      const allSymptoms = new Set<string>();
      const allTriggers = new Set<string>();
      const allCities = new Set<string>();
      let photoCount = 0;
      let voiceCount = 0;
      let medCount = 0;
      let energyCount = 0;
      let weatherCount = 0;
      const severities = new Set<string>();

      entries.forEach(entry => {
        (entry.symptoms || []).forEach((s: string) => allSymptoms.add(s));
        (entry.triggers || []).forEach((t: string) => allTriggers.add(t));
        if (entry.photos?.length) photoCount++;
        if (entry.voice_transcript) voiceCount++;
        if (entry.medications?.length) medCount++;
        if (entry.energy_level) energyCount++;
        if (entry.environmental_data) weatherCount++;
        if (entry.city) allCities.add(entry.city);
        if (entry.severity) severities.add(entry.severity);
      });

      const newBadges: string[] = [];
      const { data: engagement } = await supabase
        .from('engagement')
        .select('badges')
        .eq('user_id', userId)
        .maybeSingle();

      const existing = engagement?.badges || [];

      // Symptom badges
      if (allSymptoms.size >= 10 && !existing.includes('symptom_tracker')) newBadges.push('symptom_tracker');
      if (allSymptoms.size >= 25 && !existing.includes('symptom_master')) newBadges.push('symptom_master');

      // Trigger badges
      if (allTriggers.size >= 10 && !existing.includes('trigger_detective')) newBadges.push('trigger_detective');
      if (allTriggers.size >= 25 && !existing.includes('trigger_master')) newBadges.push('trigger_master');

      // Feature count badges
      if (photoCount >= 10 && !existing.includes('photo_10')) newBadges.push('photo_10');
      if (voiceCount >= 10 && !existing.includes('voice_10')) newBadges.push('voice_10');
      if (medCount >= 20 && !existing.includes('med_tracker')) newBadges.push('med_tracker');
      if (energyCount >= 20 && !existing.includes('energy_tracker')) newBadges.push('energy_tracker');
      if (weatherCount >= 50 && !existing.includes('weather_watcher')) newBadges.push('weather_watcher');

      // Location badges
      if (allCities.size >= 5 && !existing.includes('road_tripper')) newBadges.push('road_tripper');
      if (allCities.size >= 10 && !existing.includes('city_hopper')) newBadges.push('city_hopper');
      if (allCities.size >= 1 && !existing.includes('nomad')) newBadges.push('nomad');
      if (allCities.size >= 10 && !existing.includes('location_tracker')) newBadges.push('location_tracker');

      // Mood master - logged all severity types
      if (severities.has('mild') && severities.has('moderate') && severities.has('severe') && !existing.includes('mood_master')) {
        newBadges.push('mood_master');
      }

      // Time-based consistency badges  
      let earlyCount = 0;
      let nightCount = 0;
      let noonCount = 0;
      entries.forEach(entry => {
        // We don't have timestamp in this query, but we can check from the entry if needed
      });

      if (newBadges.length > 0) {
        await supabase
          .from('engagement')
          .update({ badges: [...existing, ...newBadges] })
          .eq('user_id', userId);
      }

      return newBadges;
    } catch (error) {
      console.error('Failed to check tracking badges:', error);
      return [];
    }
  };

  const checkConsistencyBadges = async (userId: string, entries: { timestamp: Date }[]): Promise<string[]> => {
    try {
      const { data: engagement } = await supabase
        .from('engagement')
        .select('badges, current_streak')
        .eq('user_id', userId)
        .maybeSingle();

      const existingBadges = engagement?.badges || [];
      const newBadges: string[] = [];

      // Perfect week
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

      // Consistency king
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

      // Early bird / night owl check
      let earlyCount = 0;
      let nightCount = 0;
      let noonCount = 0;
      entries.forEach(e => {
        const h = new Date(e.timestamp).getHours();
        if (h < 7) earlyCount++;
        if (h >= 22) nightCount++;
        if (h >= 11 && h <= 13) noonCount++;
      });
      if (earlyCount >= 10 && !existingBadges.includes('early_bird')) newBadges.push('early_bird');
      if (nightCount >= 10 && !existingBadges.includes('night_owl')) newBadges.push('night_owl');
      if (noonCount >= 10 && !existingBadges.includes('lunch_logger')) newBadges.push('lunch_logger');

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
      const { count } = await supabase
        .from('flare_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (count !== null) {
        await supabase
          .from('engagement')
          .update({ total_logs: count })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error('Failed to sync engagement:', error);
    }
  };

  return { 
    updateEngagementOnLog, 
    getEngagement, 
    syncEngagementTotals,
    awardBadge,
    checkCorrelationBadges,
    checkTrackingBadges,
    checkConsistencyBadges,
  };
};
