import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EngagementData {
  current_streak: number;
  longest_streak: number;
  badges: string[];
  total_logs: number;
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

  if (loading || !engagement) return null;

  const earnedBadges = BADGES.filter(b => engagement.badges?.includes(b.id));
  const recentBadge = earnedBadges[earnedBadges.length - 1];

  // Don't show if no meaningful engagement yet
  if (engagement.total_logs === 0 && earnedBadges.length === 0) return null;

  return (
    <Button
      variant="ghost"
      onClick={onOpenProgress}
      className="w-full justify-between h-auto py-2 px-3 bg-muted/30 hover:bg-muted/50"
    >
      <div className="flex items-center gap-3">
        {recentBadge && (
          <span className="text-lg">{recentBadge.icon}</span>
        )}
        <div className="text-left">
          <p className="text-xs font-medium">
            {engagement.total_logs} logs • {earnedBadges.length} badges
          </p>
          {recentBadge && (
            <p className="text-[10px] text-muted-foreground">
              Latest: {recentBadge.name}
            </p>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Button>
  );
};

export { BADGES };