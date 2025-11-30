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

  useEffect(() => {
    loadEngagement();
  }, [userId]);

  const loadEngagement = async () => {
    const { data } = await supabase
      .from('engagement')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) setEngagement(data);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-clinical">Your Progress</h2>
      </div>

      {/* Streak Card */}
      <Card className="p-5 bg-gradient-primary text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm mb-1">Current Streak</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{engagement.current_streak}</span>
              <span className="text-white/80">days</span>
            </div>
          </div>
          <div className="text-5xl">
            {engagement.current_streak >= 7 ? '🔥' : engagement.current_streak >= 3 ? '✨' : '💫'}
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/60 text-xs">Longest Streak</p>
            <p className="text-xl font-bold">{engagement.longest_streak} days</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Total Logs</p>
            <p className="text-xl font-bold">{engagement.total_logs}</p>
          </div>
        </div>
      </Card>

      {/* Monthly Activity */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-clinical text-sm">This Month</h3>
          <span className="text-xs text-muted-foreground">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
        </div>
        
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span>{daysLoggedThisMonth} days logged</span>
              <span className="text-muted-foreground">{daysInMonth.length} days</span>
            </div>
            <Progress value={(daysLoggedThisMonth / daysInMonth.length) * 100} className="h-2" />
          </div>
        </div>
      </Card>

      {/* Next Badge Progress */}
      {nextBadge && (
        <Card className="p-4">
          <h3 className="font-clinical text-sm mb-3">Next Badge</h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{nextBadge.name}</p>
              <Progress value={nextBadge.progress} className="h-1.5 mt-1" />
            </div>
            <span className="text-xs text-muted-foreground">
              {Math.round(nextBadge.progress)}%
            </span>
          </div>
        </Card>
      )}

      {/* Badges Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-clinical text-sm">Badges</h3>
          <span className="text-xs text-muted-foreground">
            {earnedBadges.length}/{BADGES.length} earned
          </span>
        </div>

        {/* Earned Badges */}
        {earnedBadges.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Earned</p>
            <div className="grid grid-cols-4 gap-2">
              {earnedBadges.map(badge => (
                <div 
                  key={badge.id}
                  className="aspect-square rounded-xl bg-gradient-primary/10 flex flex-col items-center justify-center p-2 group relative"
                >
                  <span className="text-2xl mb-0.5">{badge.icon}</span>
                  <span className="text-[10px] text-center leading-tight">{badge.name}</span>
                  
                  {/* Tooltip */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {badge.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked Badges */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Locked</p>
          <div className="grid grid-cols-4 gap-2">
            {lockedBadges.map(badge => (
              <div 
                key={badge.id}
                className="aspect-square rounded-xl bg-muted/50 flex flex-col items-center justify-center p-2 opacity-50"
              >
                <Lock className="w-4 h-4 mb-1 text-muted-foreground" />
                <span className="text-[10px] text-center leading-tight text-muted-foreground">
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
