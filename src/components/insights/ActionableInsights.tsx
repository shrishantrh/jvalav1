import { useMemo, useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { 
  TrendingUp, 
  TrendingDown,
  Minus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Activity,
  Moon,
  Zap,
  Target,
  Clock,
  Calendar,
  Heart,
  MessageCircle
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { isWithinInterval, subDays, differenceInDays, format } from 'date-fns';
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface ActionableInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
  onAskAI?: (prompt: string) => void;
}

interface AIInsight {
  type: 'pattern' | 'trigger' | 'recommendation' | 'warning' | 'success';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  actionable: string;
}

interface AIInsightsData {
  summary: string;
  healthScore: number;
  trend: 'improving' | 'stable' | 'worsening';
  insights: AIInsight[];
  predictions: { title: string; likelihood: string; basedOn: string }[];
  recommendations: string[];
}

export const ActionableInsights = ({ 
  entries, 
  userConditions = [],
  onAskAI
}: ActionableInsightsProps) => {
  const { user } = useAuth();

  // Fetch AI insights
  const { data: aiInsights, isLoading: isLoadingAI } = useQuery({
    queryKey: ['ai-insights', user?.id, entries.length],
    queryFn: async () => {
      if (!user?.id || entries.length < 5) return null;
      
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      return data as AIInsightsData;
    },
    enabled: !!user?.id && entries.length >= 5,
    staleTime: 10 * 60 * 1000, // Cache for 10 min
    refetchOnWindowFocus: false,
  });

  const analytics = useMemo(() => {
    const now = new Date();
    const last7Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 7), end: now })
    );
    const last30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 30), end: now })
    );

    const flares7d = last7Days.filter(e => e.type === 'flare');
    const flares30d = last30Days.filter(e => e.type === 'flare');

    // Trend calculation
    const weeklyAvgFlares = flares30d.length / 4;
    const frequencyChange = flares7d.length - weeklyAvgFlares;
    
    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (frequencyChange > 1.5) trend = 'worsening';
    else if (frequencyChange < -1.5) trend = 'improving';

    // Top triggers
    const triggerCounts: Record<string, number> = {};
    flares30d.forEach(f => {
      f.triggers?.forEach(t => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });
    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // Top symptoms
    const symptomCounts: Record<string, number> = {};
    flares30d.forEach(f => {
      f.symptoms?.forEach(s => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    });
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // Peak time
    const timeSlots: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    flares30d.forEach(f => {
      const hour = f.timestamp.getHours();
      if (hour >= 5 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
      else if (hour >= 17 && hour < 21) timeSlots.evening++;
      else timeSlots.night++;
    });
    const peakTime = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0];

    // Days since last flare
    const lastFlare = entries.find(e => e.type === 'flare');
    const daysSinceFlare = lastFlare ? differenceInDays(now, lastFlare.timestamp) : null;

    // Severity breakdown
    const severityCounts = { mild: 0, moderate: 0, severe: 0 };
    flares30d.forEach(f => {
      if (f.severity) severityCounts[f.severity as keyof typeof severityCounts]++;
    });

    return {
      flares7d: flares7d.length,
      flares30d: flares30d.length,
      trend,
      topTriggers,
      topSymptoms,
      peakTime: peakTime ? { period: peakTime[0], count: peakTime[1] } : null,
      daysSinceFlare,
      totalEntries: entries.length,
      severityCounts,
    };
  }, [entries]);

  const healthScore = aiInsights?.healthScore ?? Math.max(20, 100 - (analytics.flares7d * 10) - (analytics.severityCounts.severe * 5));

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-severity-none';
    if (score >= 60) return 'text-amber-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-severity-severe';
  };

  const getScoreRing = (score: number) => {
    if (score >= 80) return 'from-severity-none/20 to-severity-none/40';
    if (score >= 60) return 'from-amber-500/20 to-amber-500/40';
    if (score >= 40) return 'from-orange-500/20 to-orange-500/40';
    return 'from-severity-severe/20 to-severity-severe/40';
  };

  const getTrendIcon = () => {
    const trend = aiInsights?.trend ?? analytics.trend;
    switch (trend) {
      case 'improving': return <TrendingDown className="w-5 h-5 text-severity-none" />;
      case 'worsening': return <TrendingUp className="w-5 h-5 text-severity-severe" />;
      default: return <Minus className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pattern': return <Activity className="w-4 h-4" />;
      case 'trigger': return <AlertTriangle className="w-4 h-4" />;
      case 'recommendation': return <Lightbulb className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'success': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-severity-none/10 text-severity-none border-severity-none/20';
      case 'warning': return 'bg-severity-severe/10 text-severity-severe border-severity-severe/20';
      case 'trigger': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'recommendation': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center glass border-0">
        <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">Start logging to see insights</h3>
        <p className="text-sm text-muted-foreground">
          Your personalized health insights will appear here
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Health Score Card */}
      <Card className="p-5 glass border-0 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Health Score
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-5xl font-bold tabular-nums", getScoreColor(healthScore))}>
                {healthScore}
              </span>
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {getTrendIcon()}
              <span className="text-sm capitalize">
                {aiInsights?.trend ?? analytics.trend}
              </span>
            </div>
          </div>
          
          {/* Visual Ring */}
          <div className={cn(
            "w-24 h-24 rounded-full bg-gradient-to-br flex items-center justify-center",
            getScoreRing(healthScore)
          )}>
            <div className="w-20 h-20 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                <span className="text-2xl font-bold">{analytics.flares7d}</span>
                <span className="block text-[10px] text-muted-foreground">this week</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {aiInsights?.summary && (
          <p className="mt-4 text-sm text-muted-foreground border-t border-white/10 pt-4">
            {aiInsights.summary}
          </p>
        )}
      </Card>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 glass border-0 text-center">
          <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-lg font-semibold capitalize">
            {analytics.peakTime?.period ?? '—'}
          </div>
          <div className="text-[10px] text-muted-foreground">Peak time</div>
        </Card>
        
        <Card className="p-3 glass border-0 text-center">
          <Target className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-lg font-semibold">
            {analytics.daysSinceFlare !== null ? `${analytics.daysSinceFlare}d` : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground">Clear days</div>
        </Card>
        
        <Card className="p-3 glass border-0 text-center">
          <Calendar className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-lg font-semibold">{analytics.flares30d}</div>
          <div className="text-[10px] text-muted-foreground">This month</div>
        </Card>
      </div>

      {/* AI Insights - Actionable Cards */}
      {aiInsights?.insights && aiInsights.insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Insights
          </h3>
          
          {aiInsights.insights.slice(0, 4).map((insight, idx) => (
            <Card 
              key={idx} 
              className={cn(
                "p-4 border glass",
                getInsightColor(insight.type)
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getInsightIcon(insight.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{insight.title}</h4>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {insight.confidence}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {insight.description}
                  </p>
                  {insight.actionable && onAskAI && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => onAskAI(`Help me with: ${insight.actionable}`)}
                    >
                      <MessageCircle className="w-3 h-3" />
                      {insight.actionable.slice(0, 40)}...
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Your Patterns - Visual */}
      {(analytics.topTriggers.length > 0 || analytics.topSymptoms.length > 0) && (
        <Card className="p-4 glass border-0">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Your Patterns
          </h3>
          
          <div className="space-y-4">
            {analytics.topTriggers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Top Triggers</p>
                <div className="space-y-2">
                  {analytics.topTriggers.map((t, idx) => (
                    <div key={t.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-severity-severe" />
                      <span className="text-sm flex-1">{t.name}</span>
                      <div className="flex-1 max-w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-severity-severe/60"
                          style={{ 
                            width: `${Math.min(100, (t.count / analytics.flares30d) * 100)}%` 
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {t.count}×
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {analytics.topSymptoms.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Common Symptoms</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topSymptoms.map(s => (
                    <Badge 
                      key={s.name} 
                      variant="secondary" 
                      className="text-xs bg-primary/10 text-primary border-primary/20"
                    >
                      {s.name}
                      <span className="ml-1 opacity-60">×{s.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {aiInsights?.recommendations && aiInsights.recommendations.length > 0 && (
        <Card className="p-4 glass border-0 bg-gradient-to-br from-severity-none/5 to-transparent">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-severity-none" />
            What to Do
          </h3>
          <div className="space-y-2">
            {aiInsights.recommendations.slice(0, 3).map((rec, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-2 text-sm"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-severity-none flex-shrink-0" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Predictions Preview */}
      {aiInsights?.predictions && aiInsights.predictions.length > 0 && (
        <Card className="p-4 glass border-0">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Watch Out For
          </h3>
          <div className="space-y-2">
            {aiInsights.predictions.slice(0, 2).map((pred, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-2 text-sm p-2 rounded-lg bg-amber-500/5 border border-amber-500/10"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
                <div>
                  <span className="font-medium">{pred.title}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pred.basedOn}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoadingAI && entries.length >= 5 && (
        <Card className="p-4 glass border-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
