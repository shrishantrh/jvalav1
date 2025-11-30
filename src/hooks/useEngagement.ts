import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const useEngagement = () => {
  
  const updateEngagementOnLog = async (userId: string): Promise<{
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

      const actualTotalLogs = (totalEntries || 0) + 1;

      if (!engagement) {
        const badges = actualTotalLogs === 1 ? ['first_log'] : [];
        await supabase
          .from('engagement')
          .insert({
            user_id: userId,
            current_streak: 1,
            longest_streak: 1,
            total_logs: actualTotalLogs,
            last_log_date: format(new Date(), 'yyyy-MM-dd'),
            badges
          });
        return { newBadges: badges, streakIncreased: true, currentStreak: 1 };
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const lastLogDate = engagement.last_log_date;
      const newBadges: string[] = [];
      let newStreak = engagement.current_streak || 0;
      let streakIncreased = false;
      
      if (lastLogDate !== today) {
        const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
        if (lastLogDate === yesterday) {
          newStreak = (engagement.current_streak || 0) + 1;
          streakIncreased = true;
        } else {
          newStreak = 1;
          streakIncreased = true;
        }
      }

      const newLongestStreak = Math.max(engagement.longest_streak || 0, newStreak);
      const existingBadges = engagement.badges || [];
      
      if (newStreak >= 3 && !existingBadges.includes('streak_3')) newBadges.push('streak_3');
      if (newStreak >= 7 && !existingBadges.includes('streak_7')) newBadges.push('streak_7');
      if (actualTotalLogs >= 30 && !existingBadges.includes('logs_30')) newBadges.push('logs_30');

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

  const syncEngagementTotals = async (userId: string) => {
    const { count } = await supabase
      .from('flare_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (count !== null) {
      await supabase.from('engagement').update({ total_logs: count }).eq('user_id', userId);
    }
  };

  return { updateEngagementOnLog, getEngagement, syncEngagementTotals };
};
