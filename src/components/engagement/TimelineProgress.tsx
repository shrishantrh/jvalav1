import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Trophy, Calendar, Target, Lock, Sparkles, ChevronRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { ALL_BADGES, BADGE_CATEGORIES, getRarityColor } from "@/data/allBadges";
import type { Badge as BadgeType } from "@/data/allBadges";
import { FlareEntry } from "@/types/flare";
import { haptics } from "@/lib/haptics";
import { useEngagement, BadgeProgressInfo } from "@/hooks/useEngagement";

interface EngagementData {
  current_streak: number;
  longest_streak: number;
  badges: string[];
  total_logs: number;
  last_log_date: string | null;
}

interface TimelineProgressProps {
  userId: string;
  entries: FlareEntry[];
  onBack: () => void;
}

// SVG circular progress ring
const ProgressRing = ({ progress, size = 56, strokeWidth = 3, earned }: { progress: number; size?: number; strokeWidth?: number; earned: boolean }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="absolute inset-0">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted) / 0.4)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={earned ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
    </svg>
  );
};

export const TimelineProgress = ({ userId, entries, onBack }: TimelineProgressProps) => {
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | null>(null);
  const [badgeProgress, setBadgeProgress] = useState<Record<string, BadgeProgressInfo>>({});
  const { getBadgeProgress, runFullBadgeAudit } = useEngagement();

  useEffect(() => {
    loadEngagement();
    loadProgress();
  }, [userId]);

  const loadEngagement = async () => {
    const { data } = await supabase
      .from('engagement')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) setEngagement(data);
  };

  const loadProgress = async () => {
    // Run a full audit first to award any missing badges
    await runFullBadgeAudit(userId);
    // Then get fresh progress
    const progress = await getBadgeProgress(userId);
    setBadgeProgress(progress);
    // Reload engagement in case new badges were awarded
    const { data } = await supabase
      .from('engagement')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) setEngagement(data);
  };

  const monthStats = useMemo(() => {
    const currentMonth = new Date();
    const daysInMonth = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth)
    });
    
    const daysLoggedThisMonth = daysInMonth.filter(day => 
      entries.some(e => isSameDay(e.timestamp, day))
    ).length;

    return { daysLoggedThisMonth, totalDays: daysInMonth.length };
  }, [entries]);

  if (!engagement) {
    return (
      <div className="space-y-4 animate-pulse p-5">
        <div className="h-32 bg-muted rounded-3xl" />
        <div className="h-48 bg-muted rounded-3xl" />
      </div>
    );
  }

  const earnedBadgeIds = new Set(engagement.badges || []);
  const earnedBadges = ALL_BADGES.filter(b => earnedBadgeIds.has(b.id));

  const badgesByCategory = BADGE_CATEGORIES.map(cat => ({
    ...cat,
    badges: ALL_BADGES.filter(b => b.category === cat.id),
    earned: ALL_BADGES.filter(b => b.category === cat.id && earnedBadgeIds.has(b.id)),
  }));

  const getNextBadgeProgress = () => {
    // Find the first un-earned badge with the most progress
    const candidates = ALL_BADGES
      .filter(b => !earnedBadgeIds.has(b.id) && badgeProgress[b.id])
      .map(b => ({ badge: b, ...badgeProgress[b.id] }))
      .filter(c => c.progress > 0 && c.progress < 100)
      .sort((a, b) => b.progress - a.progress);
    
    if (candidates.length > 0) {
      const c = candidates[0];
      return { badge: c.badge, progress: c.progress, current: c.current, target: c.target };
    }
    return null;
  };

  const nextBadge = getNextBadgeProgress();
  const streakEmoji = engagement.current_streak >= 30 ? '🏆' : engagement.current_streak >= 7 ? '🔥' : engagement.current_streak >= 3 ? '✨' : '💫';

  // Week progress visualization
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const weekProgress = weekDays.map((label, i) => {
    const d = new Date(today);
    const currentDayOfWeek = (today.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - currentDayOfWeek + i);
    const hasEntry = entries.some(e => isSameDay(e.timestamp, d));
    const isFuture = d > today;
    return { label, hasEntry, isFuture, isToday: isSameDay(d, today) };
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3 px-5 py-3">
          <Button variant="ghost" size="icon" onClick={() => { haptics.light(); onBack(); }} className="h-10 w-10 rounded-2xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Your Progress</h2>
            <p className="text-sm text-muted-foreground">{earnedBadges.length} of {ALL_BADGES.length} badges earned</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-primary/10">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">{earnedBadges.length}</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 px-5 pb-6">
          {/* Streak Hero Card */}
          <div className="relative p-5 rounded-3xl overflow-hidden" style={{ background: 'var(--gradient-primary)', boxShadow: '0 8px 32px hsl(var(--primary) / 0.3)' }}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
            
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm mb-1">Current Streak</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-white">{engagement.current_streak}</span>
                  <span className="text-white/80 text-lg">days</span>
                </div>
              </div>
              <div className="text-5xl">{streakEmoji}</div>
            </div>

            {/* Week progress bar */}
            <div className="relative mt-4 flex justify-between px-1">
              {weekProgress.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    day.hasEntry ? "bg-white text-primary" 
                      : day.isToday ? "bg-white/30 text-white border-2 border-white/60"
                      : day.isFuture ? "bg-white/10 text-white/40"
                      : "bg-white/15 text-white/50"
                  )}>
                    {day.hasEntry ? '✓' : day.label}
                  </div>
                  {day.isToday && <div className="w-1 h-1 rounded-full bg-white" />}
                </div>
              ))}
            </div>
            
            <div className="relative mt-4 pt-3 border-t border-white/20 grid grid-cols-3 gap-4">
              <div>
                <p className="text-white/60 text-xs">Best Streak</p>
                <p className="text-xl font-bold text-white">{engagement.longest_streak}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs">Total Logs</p>
                <p className="text-xl font-bold text-white">{engagement.total_logs}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs">This Month</p>
                <p className="text-xl font-bold text-white">{monthStats.daysLoggedThisMonth}d</p>
              </div>
            </div>
          </div>

          {/* Monthly Progress */}
          <Card className="p-4 glass-card border-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="font-semibold">{format(new Date(), 'MMMM yyyy')}</span>
              </div>
              <span className="text-sm text-muted-foreground">{monthStats.daysLoggedThisMonth}/{monthStats.totalDays} days</span>
            </div>
            <Progress value={(monthStats.daysLoggedThisMonth / monthStats.totalDays) * 100} className="h-3" />
          </Card>

          {/* Next Badge */}
          {nextBadge && (
            <Card className="p-4 glass-card border-0">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(145deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))' }}>
                  {nextBadge.badge.icon}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Next Badge</p>
                  <p className="font-semibold">{nextBadge.badge.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Progress value={nextBadge.progress} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground font-medium">{nextBadge.current}/{nextBadge.target}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Badge Categories */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              All Badges
            </h3>

            {badgesByCategory.map(category => (
              <Card key={category.id} className="overflow-hidden border-0 glass-card">
                <button
                  onClick={() => { haptics.light(); setActiveCategory(activeCategory === category.id ? null : category.id); }}
                  className="w-full p-4 flex items-center gap-3 touch-manipulation"
                >
                  <span className="text-2xl">{category.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{category.earned.length}/{category.badges.length}</Badge>
                    <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", activeCategory === category.id && "rotate-90")} />
                  </div>
                </button>

                {activeCategory === category.id && (
                  <div className="px-4 pb-4 grid grid-cols-4 gap-2.5 animate-in fade-in slide-in-from-top-2">
                    {category.badges.map(badge => {
                      const isEarned = earnedBadgeIds.has(badge.id);
                      const rarity = getRarityColor(badge.rarity);
                      const prog = badgeProgress[badge.id];
                      const progressPct = prog?.progress ?? 0;
                      
                      return (
                        <button 
                          key={badge.id}
                          onClick={() => { haptics.light(); setSelectedBadge(badge); }}
                          className={cn(
                            "relative aspect-square rounded-2xl flex flex-col items-center justify-center p-1.5 transition-all touch-manipulation active:scale-95",
                            isEarned ? `${rarity.bg} ${rarity.border} border` : "bg-muted/20"
                          )}
                        >
                          {/* Progress ring */}
                          <ProgressRing progress={isEarned ? 100 : progressPct} earned={isEarned} />
                          
                          <div className="relative z-10 flex flex-col items-center">
                            {isEarned ? (
                              <>
                                <span className="text-xl mb-0.5">{badge.icon}</span>
                                <span className="text-[8px] text-center leading-tight line-clamp-2 font-medium">{badge.name}</span>
                              </>
                            ) : (
                              <>
                                {progressPct > 0 ? (
                                  <span className="text-lg mb-0.5 opacity-40">{badge.icon}</span>
                                ) : (
                                  <Lock className="w-3.5 h-3.5 mb-0.5 text-muted-foreground" />
                                )}
                                <span className="text-[8px] text-center leading-tight text-muted-foreground line-clamp-2">{badge.name}</span>
                                {prog && prog.target > 1 && (
                                  <span className="text-[7px] font-bold text-primary mt-0.5">
                                    {prog.current}/{prog.target}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Recently Earned */}
          {earnedBadges.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Recently Earned
              </h3>
              <div className="relative pl-6">
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent" />
                {earnedBadges.slice(-5).reverse().map((badge) => {
                  const rarity = getRarityColor(badge.rarity);
                  return (
                    <button 
                      key={badge.id}
                      onClick={() => { haptics.light(); setSelectedBadge(badge); }}
                      className="relative flex items-center gap-3 pb-4 w-full touch-manipulation text-left"
                    >
                      <div className="absolute left-[-16px] w-4 h-4 rounded-full border-2 border-background" style={{ background: 'var(--gradient-primary)' }} />
                      <div className={cn("flex-1 p-3 rounded-2xl border", rarity.bg, rarity.border)}>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{badge.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{badge.name}</p>
                            <p className="text-xs text-muted-foreground">{badge.description}</p>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] capitalize shrink-0", rarity.text)}>{badge.rarity}</Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Badge Detail Modal */}
      {selectedBadge && (() => {
        const isEarned = earnedBadgeIds.has(selectedBadge.id);
        const prog = badgeProgress[selectedBadge.id];
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" onClick={() => setSelectedBadge(null)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div 
              className="relative bg-background rounded-3xl p-6 w-full max-w-sm animate-in zoom-in-95 fade-in"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedBadge(null)} className="absolute top-4 right-4 p-1 rounded-full bg-muted/50">
                <X className="w-4 h-4" />
              </button>
              
              <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <ProgressRing progress={isEarned ? 100 : (prog?.progress ?? 0)} size={96} strokeWidth={4} earned={isEarned} />
                  <div className={cn(
                    "absolute inset-2 rounded-3xl flex items-center justify-center text-4xl",
                    isEarned ? getRarityColor(selectedBadge.rarity).bg : "bg-muted/30"
                  )}>
                    {isEarned ? selectedBadge.icon : (prog && prog.progress > 0 ? <span className="opacity-40">{selectedBadge.icon}</span> : <Lock className="w-8 h-8 text-muted-foreground" />)}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold mb-1">{selectedBadge.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{selectedBadge.description}</p>
                
                <Badge variant="outline" className={cn("capitalize mb-4", getRarityColor(selectedBadge.rarity).text)}>
                  {selectedBadge.rarity}
                </Badge>

                {/* Progress indicator */}
                {prog && prog.target > 1 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span className="font-bold text-foreground">{prog.current}/{prog.target}</span>
                    </div>
                    <Progress value={prog.progress} className="h-2.5" />
                  </div>
                )}

                <div className={cn(
                  "p-4 rounded-2xl text-left",
                  isEarned ? "bg-primary/5 border border-primary/10" : "bg-muted/50"
                )}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    {isEarned ? '✅ Earned!' : '🔒 How to unlock'}
                  </p>
                  <p className="text-sm">
                    {selectedBadge.howToGet}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};