import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { HealthForecast } from "@/components/forecast/HealthForecast";
import { useAuth } from "@/hooks/useAuth";
import { useDeepAnalytics } from "@/hooks/useDeepAnalytics";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Minus,
  Clock,
  Target,
  ThermometerSun,
  Activity,
  Heart,
  Moon,
  Droplets,
  Wind,
  Sparkles,
  ChevronRight,
  Lightbulb,
  Shield,
  Gauge,
  CloudRain,
  Zap,
  BarChart3
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, subDays, isWithinInterval, differenceInDays } from 'date-fns';

interface CleanInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
  onAskAI?: (prompt: string) => void;
}

export const CleanInsights = ({ entries, userConditions = [], onAskAI }: CleanInsightsProps) => {
  const { user } = useAuth();
  const analytics = useDeepAnalytics(entries);

  const basicStats = useMemo(() => {
    const now = new Date();
    const flares = entries.filter(e => e.type === 'flare');
    const last7Days = flares.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 7), end: now })
    );
    const last30Days = flares.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 30), end: now })
    );

    const getSeverityScore = (s: string | undefined) => s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
    
    const avgSeverity = last30Days.length > 0 
      ? last30Days.reduce((a, b) => a + getSeverityScore(b.severity), 0) / last30Days.length 
      : 0;

    const sortedFlares = [...last30Days].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const daysSinceLastFlare = sortedFlares.length > 0 
      ? differenceInDays(now, sortedFlares[0].timestamp)
      : null;

    return {
      flares7d: last7Days.length,
      flares30d: last30Days.length,
      avgSeverity,
      daysSinceLastFlare
    };
  }, [entries]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'weather': return <CloudRain className="w-4 h-4" />;
      case 'air_quality': return <Wind className="w-4 h-4" />;
      case 'sleep': return <Moon className="w-4 h-4" />;
      case 'activity': return <Activity className="w-4 h-4" />;
      case 'physiological': return <Heart className="w-4 h-4" />;
      case 'time': return <Clock className="w-4 h-4" />;
      default: return <Gauge className="w-4 h-4" />;
    }
  };

  const getStrengthColor = (strength: number) => {
    if (strength > 0.4) return 'text-red-600 bg-red-500/10';
    if (strength > 0.2) return 'text-orange-600 bg-orange-500/10';
    if (strength > 0) return 'text-yellow-600 bg-yellow-500/10';
    if (strength < -0.2) return 'text-emerald-600 bg-emerald-500/10';
    return 'text-muted-foreground bg-muted/50';
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
          <Brain className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No data yet</h3>
        <p className="text-base text-muted-foreground max-w-xs">
          Start logging to unlock personalized insights and predictions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Tomorrow's Forecast */}
      {user && (
        <HealthForecast userId={user.id} />
      )}

      {/* Weekly Trend Card */}
      <div className={cn(
        "relative p-5 rounded-3xl overflow-hidden",
        analytics.weeklyTrend.change > 2 ? "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20" :
        analytics.weeklyTrend.change < -2 ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20" :
        "bg-white/70 dark:bg-slate-900/70 border-white/50 dark:border-slate-700/50",
        "backdrop-blur-xl border",
        "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
      )}>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {analytics.weeklyTrend.change > 2 ? (
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-red-600" />
                </div>
              ) : analytics.weeklyTrend.change < -2 ? (
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-emerald-600" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Minus className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold">This Week</h3>
                <p className="text-base text-muted-foreground">
                  {format(subDays(new Date(), 7), 'MMM d')} - {format(new Date(), 'MMM d')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold">{analytics.weeklyTrend.thisWeek}</p>
              <p className={cn(
                "text-base font-medium",
                analytics.weeklyTrend.change > 2 ? 'text-red-600' :
                analytics.weeklyTrend.change < -2 ? 'text-emerald-600' :
                'text-muted-foreground'
              )}>
                {analytics.weeklyTrend.change > 0 ? '+' : ''}{analytics.weeklyTrend.change} vs last week
              </p>
            </div>
          </div>
          
          {analytics.weeklyTrend.lastWeek > 0 && Math.abs(analytics.weeklyTrend.changePercent) > 20 && (
            <p className="text-base text-muted-foreground mt-2">
              {analytics.weeklyTrend.changePercent > 0 
                ? `⚠️ ${analytics.weeklyTrend.changePercent}% increase from last week`
                : `✓ ${Math.abs(analytics.weeklyTrend.changePercent)}% decrease from last week`
              }
            </p>
          )}
        </div>
      </div>

      {/* Flare-free streak */}
      {basicStats.daysSinceLastFlare !== null && basicStats.daysSinceLastFlare >= 2 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden",
          "bg-gradient-to-br from-emerald-500/15 to-emerald-500/5",
          "backdrop-blur-xl border border-emerald-500/20",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <Target className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {basicStats.daysSinceLastFlare} days flare-free
              </p>
              <p className="text-base text-muted-foreground">Keep up the great work!</p>
            </div>
          </div>
        </div>
      )}

      {/* KEY DISCOVERY: Your Top Correlations */}
      {analytics.correlations.length > 0 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden",
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Your Patterns</h3>
                <p className="text-sm text-muted-foreground">Based on {basicStats.flares30d} flares in 30 days</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {analytics.correlations.slice(0, 5).map((corr, i) => (
                <div 
                  key={i}
                  className={cn(
                    "p-4 rounded-2xl",
                    "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
                    "border border-white/40 dark:border-slate-700/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      getStrengthColor(corr.strength)
                    )}>
                      {getCategoryIcon(corr.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold">{corr.factor}</p>
                        {corr.threshold && (
                          <Badge variant="outline" className="text-xs">
                            {corr.threshold}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{corr.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{corr.occurrences} occurrences</span>
                        <span>•</span>
                        <span>{Math.round(corr.confidence * 100)}% confidence</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI-Discovered Insights */}
      {analytics.insights.length > 0 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden",
          "bg-gradient-to-br from-amber-500/10 to-amber-500/5",
          "backdrop-blur-xl border border-amber-500/20",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold">Discoveries</h3>
            </div>
            
            <div className="space-y-4">
              {analytics.insights.slice(0, 3).map((insight, i) => (
                <div key={i} className={cn(
                  "p-4 rounded-2xl",
                  "bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm",
                  "border border-white/40 dark:border-slate-700/40"
                )}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-base font-semibold">{insight.title}</p>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs shrink-0",
                        insight.confidence === 'high' ? 'border-emerald-500/50 text-emerald-600' :
                        insight.confidence === 'medium' ? 'border-yellow-500/50 text-yellow-600' :
                        'border-muted text-muted-foreground'
                      )}
                    >
                      {insight.confidence}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                  {insight.actionable && (
                    <p className="text-sm font-medium text-primary mt-2">
                      → {insight.actionable}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Risk Factors Summary */}
      {(analytics.riskFactors.length > 0 || analytics.protectiveFactors.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {/* Risk Factors */}
          {analytics.riskFactors.length > 0 && (
            <div className={cn(
              "relative p-4 rounded-2xl overflow-hidden",
              "bg-red-500/10 backdrop-blur-xl border border-red-500/20"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Risk Factors</p>
              </div>
              <ul className="space-y-2">
                {analytics.riskFactors.slice(0, 3).map((factor, i) => (
                  <li key={i} className="text-sm text-red-700/80 dark:text-red-400/80 flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Protective Factors */}
          {analytics.protectiveFactors.length > 0 && (
            <div className={cn(
              "relative p-4 rounded-2xl overflow-hidden",
              "bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Helps You</p>
              </div>
              <ul className="space-y-2">
                {analytics.protectiveFactors.slice(0, 3).map((factor, i) => (
                  <li key={i} className="text-sm text-emerald-700/80 dark:text-emerald-400/80 flex items-start gap-2">
                    <span className="text-emerald-500 mt-1">✓</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Peak Risk Conditions */}
      {analytics.peakRiskConditions.length >= 2 && (
        <div className={cn(
          "relative p-4 rounded-2xl overflow-hidden",
          "bg-orange-500/10 backdrop-blur-xl border border-orange-500/20"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-orange-600" />
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Highest Risk When</p>
          </div>
          <p className="text-base">
            {analytics.peakRiskConditions.join(' + ')}
          </p>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={() => onAskAI?.("What patterns do you see in my data? Give me specific insights about what's triggering my flares.")}
        className={cn(
          "w-full h-14 rounded-2xl text-base font-semibold",
          "bg-gradient-to-r from-primary to-primary/80",
          "shadow-lg shadow-primary/20"
        )}
      >
        <Brain className="w-5 h-5 mr-2" />
        Ask AI About My Patterns
      </Button>

      {/* Minimum Data Notice */}
      {basicStats.flares30d < 10 && (
        <p className="text-center text-sm text-muted-foreground px-4">
          💡 More accurate insights with {10 - basicStats.flares30d} more logged flares
        </p>
      )}
    </div>
  );
};