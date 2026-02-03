import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Trophy, Calendar, Target, ArrowLeft, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { BADGES } from "./EngagementPanel";
import { FlareEntry } from "@/types/flare";
import { useEngagement } from "@/hooks/useEngagement";
import { useToast } from "@/hooks/use-toast";

interface EngagementData {
  current_streak: number;
  longest_streak: number;
  badges: string[];
  total_logs: number;
  last_log_date: string | null;
}

interface ProgressDashboardProps {
  userId: string;
  entries: FlareEntry[];
  onBack: () => void;
}

export const ProgressDashboard = ({ userId, entries, onBack }: ProgressDashboardProps) => {
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const { checkConsistencyBadges } = useEngagement();
  const { toast } = useToast();

  useEffect(() => {
    loadEngagement();
    checkBadges();
  }, [userId]);

  const loadEngagement = async () => {
    const { data } = await supabase
      .from('engagement')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) setEngagement(data);
  };

  const checkBadges = async () => {
    // Check for consistency badges when viewing progress
    const newBadges = await checkConsistencyBadges(userId, entries);
    if (newBadges.length > 0) {
      toast({
        title: "🏆 Badge Earned!",
        description: `You earned: ${newBadges.map(b => 
          b === 'perfect_week' ? 'Perfect Week' : 'Consistency King'
        ).join(', ')}`,
      });
      // Reload engagement to show new badges
      loadEngagement();
    }
  };

  // Calculate days logged this month
  const currentMonth = new Date();
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });
  
  const daysLoggedThisMonth = daysInMonth.filter(day => 
    entries.some(e => isSameDay(e.timestamp, day))
  ).length;

  if (!engagement) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  const earnedBadges = BADGES.filter(b => engagement.badges?.includes(b.id));
  const lockedBadges = BADGES.filter(b => !engagement.badges?.includes(b.id));

  // Calculate progress to next badge
  const getNextBadgeProgress = () => {
    if (!engagement.badges?.includes('streak_3') && engagement.current_streak < 3) {
      return { name: '3-Day Streak', progress: (engagement.current_streak / 3) * 100, target: 3 };
    }
    if (!engagement.badges?.includes('streak_7') && engagement.current_streak < 7) {
      return { name: 'Week Warrior', progress: (engagement.current_streak / 7) * 100, target: 7 };
    }
    if (!engagement.badges?.includes('logs_30') && engagement.total_logs < 30) {
      return { name: '30 Logs', progress: (engagement.total_logs / 30) * 100, target: 30 };
    }
    return null;
  };

  const nextBadge = getNextBadgeProgress();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-base font-semibold">Your Progress</h2>
      </div>

      {/* Streak Card */}
      <Card className="p-4 bg-gradient-primary text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-xs mb-0.5">Current Streak</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold">{engagement.current_streak}</span>
              <span className="text-white/80 text-sm">days</span>
            </div>
          </div>
          <div className="text-4xl">
            {engagement.current_streak >= 7 ? '🔥' : engagement.current_streak >= 3 ? '✨' : '💫'}
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-3">
          <div>
            <p className="text-white/60 text-[10px]">Longest Streak</p>
            <p className="text-lg font-bold">{engagement.longest_streak} days</p>
          </div>
          <div>
            <p className="text-white/60 text-[10px]">Total Logs</p>
            <p className="text-lg font-bold">{engagement.total_logs}</p>
          </div>
        </div>
      </Card>

      {/* Monthly Activity */}
      <Card className="p-3 glass-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-xs">This Month</h3>
          <span className="text-[10px] text-muted-foreground">
            {format(currentMonth, 'MMM yyyy')}
          </span>
        </div>
        
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-primary" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span>{daysLoggedThisMonth} days logged</span>
              <span className="text-muted-foreground">{daysInMonth.length} days</span>
            </div>
            <Progress value={(daysLoggedThisMonth / daysInMonth.length) * 100} className="h-1.5" />
          </div>
        </div>
      </Card>

      {/* Next Badge Progress */}
      {nextBadge && (
        <Card className="p-3 glass-card">
          <h3 className="font-medium text-xs mb-2">Next Badge</h3>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium">{nextBadge.name}</p>
              <Progress value={nextBadge.progress} className="h-1 mt-1" />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {Math.round(nextBadge.progress)}%
            </span>
          </div>
        </Card>
      )}

      {/* Badges Section */}
      <Card className="p-3 glass-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-xs">Badges</h3>
          <span className="text-[10px] text-muted-foreground">
            {earnedBadges.length}/{BADGES.length} earned
          </span>
        </div>

        {['milestone', 'streak', 'consistency', 'feature', 'tracking', 'insight', 'engagement'].map(category => {
          const categoryBadges = BADGES.filter(b => b.category === category);
          const earnedInCategory = categoryBadges.filter(b => engagement.badges?.includes(b.id));
          const lockedInCategory = categoryBadges.filter(b => !engagement.badges?.includes(b.id));
          
          if (categoryBadges.length === 0) return null;

          const categoryNames: Record<string, string> = {
            milestone: '🎯 Milestones',
            streak: '🔥 Streaks',
            consistency: '📅 Consistency',
            feature: '✨ Features',
            tracking: '📊 Tracking',
            insight: '💡 Insights',
            engagement: '🌟 Engagement',
          };

          return (
            <div key={category} className="mb-3 last:mb-0">
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
                {categoryNames[category]} ({earnedInCategory.length}/{categoryBadges.length})
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {earnedInCategory.map(badge => (
                  <div 
                    key={badge.id}
                    className="aspect-square rounded-xl bg-gradient-primary/10 flex flex-col items-center justify-center p-1.5"
                  >
                    <span className="text-lg">{badge.icon}</span>
                    <span className="text-[7px] text-center leading-tight truncate w-full">{badge.name}</span>
                  </div>
                ))}
                {lockedInCategory.map(badge => (
                  <div 
                    key={badge.id}
                    className="aspect-square rounded-xl bg-muted/30 flex flex-col items-center justify-center p-1.5 opacity-40"
                  >
                    <Lock className="w-3 h-3 mb-0.5 text-muted-foreground" />
                    <span className="text-[7px] text-center leading-tight text-muted-foreground truncate w-full">
                      {badge.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
};
