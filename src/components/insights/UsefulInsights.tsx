import { useMemo, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FlareEntry } from "@/types/flare";
import { 
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Droplets,
  Wind,
  Heart,
  Moon,
  Activity,
  MapPin,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Brain,
  Sun,
  CloudRain,
  Leaf,
  BarChart3
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { isWithinInterval, subDays, format, differenceInDays } from 'date-fns';
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface UsefulInsightsProps {
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

export const UsefulInsights = ({ 
  entries, 
  userConditions = [],
  onAskAI
}: UsefulInsightsProps) => {
  const { user } = useAuth();
  const [showStats, setShowStats] = useState(false);

  // Fetch AI insights
  const { data: aiInsights, isLoading: isLoadingAI, error: aiError } = useQuery({
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
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Calculate correlations from actual data
  const correlations = useMemo(() => {
    const now = new Date();
    const last30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 30), end: now })
    );
    const flares = last30Days.filter(e => e.type === 'flare');

    // Weather correlations
    const weatherCorrelations: Record<string, { count: number; severities: string[] }> = {};
    flares.forEach(f => {
      const weather = (f.environmentalData as any)?.weather?.condition;
      if (weather) {
        if (!weatherCorrelations[weather]) {
          weatherCorrelations[weather] = { count: 0, severities: [] };
        }
        weatherCorrelations[weather].count++;
        if (f.severity) weatherCorrelations[weather].severities.push(f.severity);
      }
    });

    // Temperature analysis
    const tempFlares = flares.filter(f => (f.environmentalData as any)?.weather?.temperature);
    const avgTempOnFlare = tempFlares.length > 0
      ? tempFlares.reduce((sum, f) => sum + ((f.environmentalData as any)?.weather?.temperature || 0), 0) / tempFlares.length
      : null;

    // Humidity analysis
    const humidityFlares = flares.filter(f => (f.environmentalData as any)?.weather?.humidity);
    const avgHumidityOnFlare = humidityFlares.length > 0
      ? humidityFlares.reduce((sum, f) => sum + ((f.environmentalData as any)?.weather?.humidity || 0), 0) / humidityFlares.length
      : null;

    // Pressure analysis  
    const pressureFlares = flares.filter(f => (f.environmentalData as any)?.weather?.pressure);
    const avgPressureOnFlare = pressureFlares.length > 0
      ? pressureFlares.reduce((sum, f) => sum + ((f.environmentalData as any)?.weather?.pressure || 0), 0) / pressureFlares.length
      : null;

    // Sleep analysis
    const sleepFlares = flares.filter(f => {
      const phys = f.physiologicalData as any;
      return phys?.sleepHours || phys?.sleep_hours;
    });
    const avgSleepOnFlare = sleepFlares.length > 0
      ? sleepFlares.reduce((sum, f) => {
          const phys = f.physiologicalData as any;
          return sum + (phys?.sleepHours || phys?.sleep_hours || 0);
        }, 0) / sleepFlares.length
      : null;

    // Heart rate analysis
    const hrFlares = flares.filter(f => {
      const phys = f.physiologicalData as any;
      return phys?.heartRate || phys?.heart_rate;
    });
    const avgHROnFlare = hrFlares.length > 0
      ? hrFlares.reduce((sum, f) => {
          const phys = f.physiologicalData as any;
          return sum + (phys?.heartRate || phys?.heart_rate || 0);
        }, 0) / hrFlares.length
      : null;

    // Location analysis
    const locationCounts: Record<string, number> = {};
    flares.forEach(f => {
      const city = (f.environmentalData as any)?.location?.city;
      if (city) {
        locationCounts[city] = (locationCounts[city] || 0) + 1;
      }
    });

    // Time of day analysis
    const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    flares.forEach(f => {
      const hour = f.timestamp.getHours();
      if (hour >= 5 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
      else if (hour >= 17 && hour < 21) timeSlots.evening++;
      else timeSlots.night++;
    });

    // Day of week analysis
    const dayCounts: Record<string, number> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    flares.forEach(f => {
      const day = dayNames[f.timestamp.getDay()];
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    return {
      weather: Object.entries(weatherCorrelations)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([condition, data]) => ({ condition, ...data })),
      avgTemp: avgTempOnFlare,
      avgHumidity: avgHumidityOnFlare,
      avgPressure: avgPressureOnFlare,
      avgSleep: avgSleepOnFlare,
      avgHR: avgHROnFlare,
      topLocation: Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0],
      peakTime: Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0],
      peakDay: Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0],
      flareCount: flares.length,
      totalEntries: last30Days.length,
    };
  }, [entries]);

  // Generate local insights from data
  const localInsights = useMemo(() => {
    const insights: { icon: React.ReactNode; title: string; detail: string; type: 'info' | 'warning' | 'success' }[] = [];

    // Weather insight
    if (correlations.weather.length > 0) {
      const topWeather = correlations.weather[0];
      insights.push({
        icon: <CloudRain className="w-4 h-4" />,
        title: `${Math.round((topWeather.count / correlations.flareCount) * 100)}% of flares during ${topWeather.condition.toLowerCase()}`,
        detail: `You had ${topWeather.count} flares when it was ${topWeather.condition.toLowerCase()}. Consider staying indoors or preparing ahead.`,
        type: 'warning',
      });
    }

    // Temperature insight
    if (correlations.avgTemp !== null) {
      const temp = Math.round(correlations.avgTemp);
      insights.push({
        icon: <Thermometer className="w-4 h-4" />,
        title: `Flares cluster around ${temp}°F`,
        detail: `Your average temperature during flares is ${temp}°F. This could indicate temperature sensitivity.`,
        type: 'info',
      });
    }

    // Sleep insight
    if (correlations.avgSleep !== null) {
      const sleep = correlations.avgSleep.toFixed(1);
      const isLow = correlations.avgSleep < 7;
      insights.push({
        icon: <Moon className="w-4 h-4" />,
        title: isLow ? `Low sleep (${sleep}h) on flare days` : `Sleep averaging ${sleep}h on flare days`,
        detail: isLow 
          ? `You're getting less than 7 hours of sleep before flares. Prioritizing rest may help reduce flare frequency.`
          : `Your sleep on flare days is adequate. This may not be a primary trigger.`,
        type: isLow ? 'warning' : 'info',
      });
    }

    // Time pattern insight
    if (correlations.peakTime) {
      insights.push({
        icon: <Clock className="w-4 h-4" />,
        title: `Most flares happen in the ${correlations.peakTime[0]}`,
        detail: `${correlations.peakTime[1]} of your ${correlations.flareCount} flares occurred during ${correlations.peakTime[0]} hours. Consider adjusting activities or medication timing.`,
        type: 'info',
      });
    }

    // Day pattern insight
    if (correlations.peakDay && correlations.peakDay[1] > 1) {
      insights.push({
        icon: <Calendar className="w-4 h-4" />,
        title: `${correlations.peakDay[0]}s are your hardest day`,
        detail: `You've had ${correlations.peakDay[1]} flares on ${correlations.peakDay[0]}s. Think about what's different on this day.`,
        type: 'warning',
      });
    }

    // Heart rate insight
    if (correlations.avgHR !== null) {
      const hr = Math.round(correlations.avgHR);
      insights.push({
        icon: <Heart className="w-4 h-4" />,
        title: `Heart rate averaging ${hr} bpm during flares`,
        detail: hr > 80 
          ? `Elevated heart rate may indicate stress or inflammation before/during flares. Monitor for patterns.`
          : `Your heart rate is normal during flares. Stress may not be a primary factor.`,
        type: hr > 80 ? 'warning' : 'info',
      });
    }

    // Location insight
    if (correlations.topLocation) {
      insights.push({
        icon: <MapPin className="w-4 h-4" />,
        title: `${correlations.topLocation[1]} flares in ${correlations.topLocation[0]}`,
        detail: `Most flares occurred in ${correlations.topLocation[0]}. Consider local environmental factors like air quality or allergens.`,
        type: 'info',
      });
    }

    return insights;
  }, [correlations]);

  // Quick stats
  const stats = useMemo(() => {
    const now = new Date();
    const last7 = entries.filter(e => 
      e.type === 'flare' && isWithinInterval(e.timestamp, { start: subDays(now, 7), end: now })
    );
    const lastFlare = entries.find(e => e.type === 'flare');
    const clearDays = lastFlare ? differenceInDays(now, lastFlare.timestamp) : null;

    return {
      weekFlares: last7.length,
      monthFlares: correlations.flareCount,
      clearDays,
      loggingRate: Math.round((correlations.totalEntries / 30) * 100),
    };
  }, [entries, correlations]);

  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400';
      case 'success': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400';
      default: return 'bg-primary/5 border-primary/10 text-foreground';
    }
  };

  const getAIInsightStyle = (type: string) => {
    switch (type) {
      case 'success': return 'border-l-emerald-500 bg-emerald-500/5';
      case 'warning': return 'border-l-red-500 bg-red-500/5';
      case 'trigger': return 'border-l-amber-500 bg-amber-500/5';
      case 'recommendation': return 'border-l-primary bg-primary/5';
      default: return 'border-l-blue-500 bg-blue-500/5';
    }
  };

  if (entries.length < 5) {
    return (
      <Card className="p-6 text-center glass-card">
        <Sparkles className="w-10 h-10 mx-auto text-primary/50 mb-3" />
        <h3 className="text-base font-semibold mb-1">Keep logging!</h3>
        <p className="text-xs text-muted-foreground">
          Log at least 5 entries to unlock AI-powered insights about your patterns.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Summary Header */}
      {aiInsights?.summary && (
        <Card className="p-4 glass-card bg-gradient-to-br from-primary/10 via-transparent to-primary/5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold">AI Analysis</h3>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {aiInsights.trend === 'improving' && '↑ Improving'}
                  {aiInsights.trend === 'worsening' && '↓ Watch out'}
                  {aiInsights.trend === 'stable' && '→ Stable'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {aiInsights.summary}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoadingAI && (
        <Card className="p-4 glass-card">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </Card>
      )}

      {/* AI Insights - Key Findings */}
      {aiInsights?.insights && aiInsights.insights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5" />
            What We Found
          </h3>
          
          {aiInsights.insights.slice(0, 3).map((insight, idx) => (
            <Card 
              key={idx} 
              className={cn("p-3 border-l-4", getAIInsightStyle(insight.type))}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium">{insight.title}</h4>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[8px] px-1 py-0",
                        insight.confidence === 'high' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                        insight.confidence === 'medium' && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                        insight.confidence === 'low' && "bg-muted text-muted-foreground"
                      )}
                    >
                      {insight.confidence}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    {insight.description}
                  </p>
                  {insight.actionable && onAskAI && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1.5 -ml-2 text-primary hover:text-primary"
                      onClick={() => onAskAI(`Help me ${insight.actionable.toLowerCase()}`)}
                    >
                      <MessageCircle className="w-3 h-3" />
                      {insight.actionable}
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {aiInsights?.recommendations && aiInsights.recommendations.length > 0 && (
        <Card className="p-4 glass-card">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            What To Do Next
          </h3>
          <div className="space-y-2">
            {aiInsights.recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="text-xs leading-relaxed">{rec}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Data-Driven Correlations */}
      {localInsights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            Your Data Patterns
          </h3>
          
          {localInsights.slice(0, 4).map((insight, idx) => (
            <Card 
              key={idx} 
              className={cn("p-3 border", getInsightStyle(insight.type))}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  insight.type === 'warning' && "bg-amber-500/20",
                  insight.type === 'success' && "bg-emerald-500/20",
                  insight.type === 'info' && "bg-primary/10"
                )}>
                  {insight.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium mb-0.5">{insight.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {insight.detail}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Predictions */}
      {aiInsights?.predictions && aiInsights.predictions.length > 0 && (
        <Card className="p-4 glass-card bg-gradient-to-br from-amber-500/5 to-transparent">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Watch Out For
          </h3>
          <div className="space-y-2">
            {aiInsights.predictions.slice(0, 2).map((pred, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-amber-500/5">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium">{pred.title}</span>
                  <p className="text-[10px] text-muted-foreground">{pred.basedOn}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Collapsible Stats Section */}
      <Collapsible open={showStats} onOpenChange={setShowStats}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-9 text-xs text-muted-foreground hover:text-foreground">
            <span className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              View Statistics
            </span>
            {showStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2.5 glass-card text-center">
              <p className="text-lg font-bold">{stats.weekFlares}</p>
              <p className="text-[9px] text-muted-foreground">This Week</p>
            </Card>
            <Card className="p-2.5 glass-card text-center">
              <p className="text-lg font-bold">{stats.monthFlares}</p>
              <p className="text-[9px] text-muted-foreground">This Month</p>
            </Card>
            <Card className="p-2.5 glass-card text-center">
              <p className="text-lg font-bold">{stats.clearDays ?? '—'}</p>
              <p className="text-[9px] text-muted-foreground">Days Clear</p>
            </Card>
            <Card className="p-2.5 glass-card text-center">
              <p className="text-lg font-bold">{stats.loggingRate}%</p>
              <p className="text-[9px] text-muted-foreground">Logged</p>
            </Card>
          </div>
          
          {correlations.avgTemp !== null && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Card className="p-2 glass-card text-center">
                <Thermometer className="w-3.5 h-3.5 mx-auto mb-1 text-orange-500" />
                <p className="text-sm font-semibold">{Math.round(correlations.avgTemp)}°</p>
                <p className="text-[8px] text-muted-foreground">Avg Temp</p>
              </Card>
              {correlations.avgHumidity !== null && (
                <Card className="p-2 glass-card text-center">
                  <Droplets className="w-3.5 h-3.5 mx-auto mb-1 text-blue-500" />
                  <p className="text-sm font-semibold">{Math.round(correlations.avgHumidity)}%</p>
                  <p className="text-[8px] text-muted-foreground">Avg Humidity</p>
                </Card>
              )}
              {correlations.avgHR !== null && (
                <Card className="p-2 glass-card text-center">
                  <Heart className="w-3.5 h-3.5 mx-auto mb-1 text-red-500" />
                  <p className="text-sm font-semibold">{Math.round(correlations.avgHR)}</p>
                  <p className="text-[8px] text-muted-foreground">Avg HR</p>
                </Card>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
