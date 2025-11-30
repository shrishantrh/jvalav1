import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Calendar, Target, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface EngagementData {
  current_streak: number;
  longest_streak: number;
  badges: string[];
  total_logs: number;
  last_log_date: string | null;
}

interface EngagementPanelProps {
  userId: string;
  onOpenProgress: () => void;
}

const BADGES = [
  { id: 'first_log', name: 'First Log', icon: '🌟', description: 'Logged your first entry' },
  { id: 'streak_3', name: '3-Day Streak', icon: '🔥', description: '3 days in a row' },
  { id: 'streak_7', name: 'Week Warrior', icon: '💪', description: '7 days in a row' },
  { id: 'streak_30', name: 'Monthly Master', icon: '🏆', description: '30 days in a row' },
  { id: 'logs_30', name: '30 Logs', icon: '📊', description: 'Logged 30 entries' },
  { id: 'detailed', name: 'Detail Oriented', icon: '📝', description: 'First detailed entry' },
  { id: 'photo', name: 'Picture Perfect', icon: '📸', description: 'First photo log' },
  { id: 'voice', name: 'Voice Logger', icon: '🎤', description: 'First voice log' },
];

export const EngagementPanel = ({ userId, onOpenProgress }: EngagementPanelProps) => {
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEngagement();
  }, [userId]);

  const loadEngagement = async () => {
    try {
      const { data, error } = await supabase
        .from('engagement')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEngagement(data);
      } else {
        // Create engagement record if doesn't exist
        const { data: newData, error: insertError } = await supabase
          .from('engagement')
          .insert({ user_id: userId })
          .select()
          .single();

        if (!insertError && newData) {
          setEngagement(newData);
        }
      }
    } catch (error) {
      console.error('Failed to load engagement:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !engagement) {
    return (
      <Card className="p-4 animate-pulse bg-muted/30">
        <div className="h-16 bg-muted rounded" />
      </Card>
    );
  }

  const earnedBadges = BADGES.filter(b => engagement.badges?.includes(b.id));
  const streakEmoji = engagement.current_streak >= 7 ? '🔥' : engagement.current_streak >= 3 ? '✨' : '💫';

  return (
    <Card className="overflow-hidden bg-gradient-card border-0 shadow-soft">
      <div className="p-4">
        {/* Streak Display */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center text-xl",
              engagement.current_streak > 0 
                ? "bg-gradient-primary shadow-soft" 
                : "bg-muted"
            )}>
              {streakEmoji}
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{engagement.current_streak}</span>
                <span className="text-sm text-muted-foreground">day streak</span>
              </div>
              {engagement.current_streak > 0 && (
                <p className="text-xs text-muted-foreground">
                  Keep it going!
                </p>
              )}
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onOpenProgress}
            className="text-xs"
          >
            View Progress
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <Target className="w-4 h-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{engagement.total_logs}</p>
            <p className="text-[10px] text-muted-foreground">Total Logs</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <Flame className="w-4 h-4 mx-auto mb-1 text-severity-moderate" />
            <p className="text-lg font-bold">{engagement.longest_streak}</p>
            <p className="text-[10px] text-muted-foreground">Best Streak</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <Trophy className="w-4 h-4 mx-auto mb-1 text-yellow-500" />
            <p className="text-lg font-bold">{earnedBadges.length}</p>
            <p className="text-[10px] text-muted-foreground">Badges</p>
          </div>
        </div>

        {/* Recent Badge */}
        {earnedBadges.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              Latest badge earned
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <span className="text-xl">{earnedBadges[earnedBadges.length - 1].icon}</span>
              <div>
                <p className="text-sm font-medium">{earnedBadges[earnedBadges.length - 1].name}</p>
                <p className="text-xs text-muted-foreground">{earnedBadges[earnedBadges.length - 1].description}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export { BADGES };
