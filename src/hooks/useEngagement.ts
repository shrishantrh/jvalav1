import { supabase } from "@/integrations/supabase/client";
import { format, isToday, parseISO } from "date-fns";

export const useEngagement = () => {
  
  const updateEngagementOnLog = async (userId: string): Promise<{
    newBadges: string[];
    streakIncreased: boolean;
    currentStreak: number;
  }> => {
    try {
      // Get current engagement
      const { data: engagement } = await supabase
        .from('engagement')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!engagement) {
        // Create new engagement record
        await supabase
          .from('engagement')
          .insert({
            user_id: userId,
            current_streak: 1,
            longest_streak: 1,
            total_logs: 1,
            last_log_date: format(new Date(), 'yyyy-MM-dd'),
            badges: ['first_log']
          });
        return { newBadges: ['first_log'], streakIncreased: true, currentStreak: 1 };
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const lastLogDate = engagement.last_log_date;
      const newBadges: string[] = [];
      
      let newStreak = engagement.current_streak;
      let streakIncreased = false;
      
      // Calculate streak
      if (lastLogDate !== today) {
        const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
        
        if (lastLogDate === yesterday) {
          // Continue streak
          newStreak = engagement.current_streak + 1;
          streakIncreased = true;
        } else if (lastLogDate !== today) {
          // Streak broken, start fresh
          newStreak = 1;
          streakIncreased = true;
        }
      }

      const newTotalLogs = engagement.total_logs + 1;
      const newLongestStreak = Math.max(engagement.longest_streak, newStreak);
      
      // Check for new badges
      const existingBadges = engagement.badges || [];
      
      if (!existingBadges.includes('first_log')) {
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
      if (newTotalLogs >= 30 && !existingBadges.includes('logs_30')) {
        newBadges.push('logs_30');
      }

      // Only update if it's a new day or there are changes
      if (lastLogDate !== today || newBadges.length > 0) {
        await supabase
          .from('engagement')
          .update({
            current_streak: newStreak,
            longest_streak: newLongestStreak,
            total_logs: newTotalLogs,
            last_log_date: today,
            badges: [...existingBadges, ...newBadges]
          })
          .eq('user_id', userId);
      }

      return { newBadges, streakIncreased, currentStreak: newStreak };
    } catch (error) {
      console.error('Failed to update engagement:', error);
      return { newBadges: [], streakIncreased: false, currentStreak: 0 };
    }
  };

  return { updateEngagementOnLog };
};
