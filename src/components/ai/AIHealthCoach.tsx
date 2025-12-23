import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Target,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { FlareEntry } from '@/types/flare';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AIHealthCoachProps {
  entries: FlareEntry[];
  userConditions?: string[];
  userId: string;
}

interface Insight {
  id: string;
  type: 'warning' | 'success' | 'tip' | 'goal';
  title: string;
  message: string;
  action?: string;
  priority: number;
}

interface DailyGoal {
  id: string;
  title: string;
  completed: boolean;
  type: 'log' | 'hydration' | 'activity' | 'medication';
}

export function AIHealthCoach({ entries, userConditions = [], userId }: AIHealthCoachProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Calculate health metrics
  const metrics = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    const last7Days = entries.filter(e => (now - new Date(e.timestamp).getTime()) <= 7 * dayMs);
    const prev7Days = entries.filter(e => {
      const age = now - new Date(e.timestamp).getTime();
      return age > 7 * dayMs && age <= 14 * dayMs;
    });

    const flares7d = last7Days.filter(e => e.type === 'flare');
    const flaresPrev = prev7Days.filter(e => e.type === 'flare');
    
    const severityScore = flares7d.reduce((sum, f) => {
      if (f.severity === 'severe') return sum + 3;
      if (f.severity === 'moderate') return sum + 2;
      return sum + 1;
    }, 0);

    const prevSeverityScore = flaresPrev.reduce((sum, f) => {
      if (f.severity === 'severe') return sum + 3;
      if (f.severity === 'moderate') return sum + 2;
      return sum + 1;
    }, 0);

    // Trend calculation
    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (severityScore < prevSeverityScore * 0.7 && prevSeverityScore > 0) trend = 'improving';
    else if (severityScore > prevSeverityScore * 1.3 && prevSeverityScore > 0) trend = 'worsening';

    // Logging consistency
    const daysLogged = new Set(last7Days.map(e => 
      new Date(e.timestamp).toDateString()
    )).size;
    const consistency = Math.round((daysLogged / 7) * 100);

    // Days since last flare
    const flares = entries.filter(e => e.type === 'flare').sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const daysSinceFlare = flares.length > 0 
      ? Math.floor((now - new Date(flares[0].timestamp).getTime()) / dayMs)
      : null;

    return {
      flareCount7d: flares7d.length,
      flareCountPrev: flaresPrev.length,
      trend,
      consistency,
      severityScore,
      daysSinceFlare,
    };
  }, [entries]);

  // Generate insights based on metrics
  useEffect(() => {
    const generateInsights = () => {
      const newInsights: Insight[] = [];

      // Trend-based insights
      if (metrics.trend === 'improving') {
        newInsights.push({
          id: 'trend-improving',
          type: 'success',
          title: 'Great progress!',
          message: `Your flare severity is down this week. Keep doing what you're doing!`,
          priority: 1,
        });
      } else if (metrics.trend === 'worsening') {
        newInsights.push({
          id: 'trend-worsening',
          type: 'warning',
          title: 'Flares increasing',
          message: `You've had ${metrics.flareCount7d} flares this week vs ${metrics.flareCountPrev} last week. Check your recent triggers.`,
          action: 'Review triggers',
          priority: 1,
        });
      }

      // Streak celebration
      if (metrics.daysSinceFlare !== null && metrics.daysSinceFlare >= 3) {
        newInsights.push({
          id: 'streak',
          type: 'success',
          title: `${metrics.daysSinceFlare} days flare-free!`,
          message: `Amazing streak! You're doing great with managing your condition.`,
          priority: 2,
        });
      }

      // Consistency nudge
      if (metrics.consistency < 50) {
        newInsights.push({
          id: 'consistency',
          type: 'tip',
          title: 'Log more often',
          message: 'Daily logging helps us spot patterns. Try logging at least once a day.',
          action: 'Set reminder',
          priority: 3,
        });
      } else if (metrics.consistency >= 80) {
        newInsights.push({
          id: 'consistency-good',
          type: 'success',
          title: 'Excellent logging!',
          message: `${metrics.consistency}% consistency this week. Great for pattern detection!`,
          priority: 3,
        });
      }

      // Time-of-day pattern
      const morningFlares = entries.filter(e => {
        const hour = new Date(e.timestamp).getHours();
        return e.type === 'flare' && hour >= 6 && hour < 12;
      }).length;
      const totalFlares = entries.filter(e => e.type === 'flare').length;
      
      if (morningFlares > totalFlares * 0.4 && totalFlares >= 5) {
        newInsights.push({
          id: 'morning-pattern',
          type: 'tip',
          title: 'Morning flare pattern',
          message: `${Math.round((morningFlares / totalFlares) * 100)}% of your flares happen in the morning. Consider adjusting your morning routine.`,
          priority: 2,
        });
      }

      setInsights(newInsights.sort((a, b) => a.priority - b.priority));
    };

    generateInsights();
  }, [metrics, entries]);

  // Generate daily goals
  useEffect(() => {
    const todayEntries = entries.filter(e => 
      new Date(e.timestamp).toDateString() === new Date().toDateString()
    );

    const goals: DailyGoal[] = [
      {
        id: 'daily-log',
        title: 'Log at least once today',
        completed: todayEntries.length > 0,
        type: 'log',
      },
      {
        id: 'detailed-entry',
        title: 'Add a detailed entry',
        completed: todayEntries.some(e => e.symptoms?.length || e.triggers?.length || e.note),
        type: 'log',
      },
    ];

    setDailyGoals(goals);
  }, [entries]);

  const displayInsights = showAll ? insights : insights.slice(0, 2);
  const completedGoals = dailyGoals.filter(g => g.completed).length;

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-severity-moderate" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-severity-none" />;
      case 'tip': return <Lightbulb className="w-4 h-4 text-severity-mild" />;
      case 'goal': return <Target className="w-4 h-4 text-primary" />;
    }
  };

  const getInsightBg = (type: Insight['type']) => {
    switch (type) {
      case 'warning': return 'bg-severity-moderate/10 border-severity-moderate/20';
      case 'success': return 'bg-severity-none/10 border-severity-none/20';
      case 'tip': return 'bg-severity-mild/10 border-severity-mild/20';
      case 'goal': return 'bg-primary/10 border-primary/20';
    }
  };

  return (
    <Card className="p-4 bg-gradient-card border shadow-soft overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-primary">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI Health Coach</h3>
            <p className="text-[10px] text-muted-foreground">Personalized for you</p>
          </div>
        </div>

        {/* Trend indicator */}
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          metrics.trend === 'improving' && "bg-severity-none/10 text-severity-none",
          metrics.trend === 'worsening' && "bg-severity-severe/10 text-severity-severe",
          metrics.trend === 'stable' && "bg-muted text-muted-foreground"
        )}>
          {metrics.trend === 'improving' && <TrendingDown className="w-3 h-3" />}
          {metrics.trend === 'worsening' && <TrendingUp className="w-3 h-3" />}
          <span className="capitalize">{metrics.trend}</span>
        </div>
      </div>

      {/* Daily Goals Progress */}
      <div className="mb-4 p-3 rounded-xl bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Today's Goals</span>
          <span className="text-xs text-muted-foreground">
            {completedGoals}/{dailyGoals.length}
          </span>
        </div>
        <div className="flex gap-1">
          {dailyGoals.map((goal, idx) => (
            <div 
              key={goal.id}
              className={cn(
                "flex-1 h-1.5 rounded-full transition-colors",
                goal.completed ? "bg-severity-none" : "bg-border"
              )}
            />
          ))}
        </div>
        <div className="mt-2 space-y-1">
          {dailyGoals.map(goal => (
            <div key={goal.id} className="flex items-center gap-2 text-xs">
              <div className={cn(
                "w-3 h-3 rounded-full border flex items-center justify-center",
                goal.completed ? "bg-severity-none border-severity-none" : "border-muted-foreground"
              )}>
                {goal.completed && <CheckCircle2 className="w-2 h-2 text-white" />}
              </div>
              <span className={goal.completed ? "text-muted-foreground line-through" : ""}>
                {goal.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-2">
        {displayInsights.map((insight, idx) => (
          <div 
            key={insight.id}
            className={cn(
              "p-3 rounded-xl border transition-all hover:shadow-soft",
              getInsightBg(insight.type),
              "animate-in fade-in-0 slide-in-from-bottom-2"
            )}
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium mb-0.5">{insight.title}</p>
                <p className="text-[11px] text-muted-foreground">{insight.message}</p>
                {insight.action && (
                  <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs">
                    {insight.action}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {insights.length > 2 && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-3 text-xs h-8"
        >
          {showAll ? 'Show less' : `Show ${insights.length - 2} more insights`}
        </Button>
      )}
    </Card>
  );
}
