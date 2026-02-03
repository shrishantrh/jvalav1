import React, { useMemo, useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { HealthForecast } from "@/components/forecast/HealthForecast";
import { EnhancedMedicalExport } from "@/components/insights/EnhancedMedicalExport";
import { useAuth } from "@/hooks/useAuth";
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
  Lightbulb
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, subDays, isWithinInterval, differenceInDays } from 'date-fns';

interface MedicationLog {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  takenAt: Date;
}

interface CleanInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
  medicationLogs?: MedicationLog[];
  onLogMedication?: (log: Omit<MedicationLog, 'id' | 'takenAt'>) => void;
  userMedications?: string[];
  onAskAI?: (prompt: string) => void;
}

// Stop words for trigger extraction
const STOP_WORDS = new Set([
  'the', 'and', 'some', 'lot', 'bit', 'too', 'much', 'very', 'really', 
  'today', 'yesterday', 'just', 'like', 'been', 'have', 'had', 'was', 'were', 
  'that', 'this', 'with', 'good', 'great', 'bad', 'well', 'feeling', 'feel',
]);

export const CleanInsights = ({ entries, userConditions = [], medicationLogs = [], onLogMedication, userMedications = [], onAskAI }: CleanInsightsProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'patterns' | 'export'>('patterns');

  const analytics = useMemo(() => {
    const now = new Date();
    const last7Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 7), end: now })
    );
    const last30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 30), end: now })
    );
    const prev30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 60), end: subDays(now, 30) })
    );

    const flares7d = last7Days.filter(e => e.type === 'flare');
    const flares30d = last30Days.filter(e => e.type === 'flare');

    const getSeverityScore = (s: string) => s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;

    const weeklyAvgFlares = flares30d.length / 4;
    const frequencyChange = flares7d.length - weeklyAvgFlares;
    
    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (frequencyChange > 1.5) trend = 'worsening';
    else if (frequencyChange < -1.5) trend = 'improving';

    // Time of day analysis
    const timeSlots: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    flares30d.forEach(f => {
      const hour = f.timestamp.getHours();
      if (hour >= 6 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 18) timeSlots.afternoon++;
      else if (hour >= 18 && hour < 22) timeSlots.evening++;
      else timeSlots.night++;
    });
    const peakTime = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0];
    const peakTimePercent = flares30d.length > 0 ? Math.round((peakTime[1] / flares30d.length) * 100) : 0;

    // Symptom analysis
    const symptomData: Record<string, { count: number; severities: number[] }> = {};
    flares30d.forEach(f => {
      f.symptoms?.forEach(s => {
        if (!symptomData[s]) symptomData[s] = { count: 0, severities: [] };
        symptomData[s].count++;
        symptomData[s].severities.push(getSeverityScore(f.severity || 'mild'));
      });
    });

    const topSymptoms = Object.entries(symptomData)
      .map(([name, data]) => ({
        name,
        count: data.count,
        percentage: Math.round((data.count / flares30d.length) * 100),
        avgSeverity: data.severities.reduce((a, b) => a + b, 0) / data.severities.length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Trigger analysis
    const triggerData: Record<string, { count: number; severities: number[] }> = {};
    flares30d.forEach(f => {
      f.triggers?.forEach(t => {
        const key = t.toLowerCase();
        if (!STOP_WORDS.has(key) && key.length > 2) {
          if (!triggerData[key]) triggerData[key] = { count: 0, severities: [] };
          triggerData[key].count++;
          triggerData[key].severities.push(getSeverityScore(f.severity || 'mild'));
        }
      });
    });

    const topTriggers = Object.entries(triggerData)
      .filter(([_, data]) => data.count >= 2)
      .map(([name, data]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: data.count,
        avgSeverity: data.severities.reduce((a, b) => a + b, 0) / data.severities.length
      }))
      .sort((a, b) => b.avgSeverity - a.avgSeverity)
      .slice(0, 5);

    // Weather correlation
    const weatherData: Record<string, number> = {};
    flares30d.forEach(f => {
      if (f.environmentalData?.weather?.condition) {
        const cond = f.environmentalData.weather.condition;
        weatherData[cond] = (weatherData[cond] || 0) + 1;
      }
    });
    const topWeather = Object.entries(weatherData)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Sleep analysis
    const sleepValues = flares30d
      .filter(f => f.physiologicalData?.sleepHours || f.physiologicalData?.sleep_hours)
      .map(f => (f.physiologicalData?.sleepHours || f.physiologicalData?.sleep_hours) as number);
    const avgSleep = sleepValues.length > 0 
      ? Math.round((sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) * 10) / 10 
      : null;

    const sortedFlares = [...flares30d].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const daysSinceLastFlare = sortedFlares.length > 0 
      ? differenceInDays(now, sortedFlares[0].timestamp)
      : null;

    return {
      flares7d: flares7d.length,
      flares30d: flares30d.length,
      trend,
      frequencyChange: Math.round(frequencyChange * 10) / 10,
      peakTime: peakTime[0],
      peakTimePercent,
      topSymptoms,
      topTriggers,
      topWeather,
      avgSleep,
      daysSinceLastFlare,
      totalEntries: entries.length
    };
  }, [entries]);

  const getTrendIcon = () => {
    if (analytics.trend === 'improving') return <TrendingDown className="w-5 h-5 text-emerald-500" />;
    if (analytics.trend === 'worsening') return <TrendingUp className="w-5 h-5 text-red-500" />;
    return <Minus className="w-5 h-5 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (analytics.trend === 'improving') return 'text-emerald-600';
    if (analytics.trend === 'worsening') return 'text-red-600';
    return 'text-muted-foreground';
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
      {/* Tomorrow's Forecast - moved from log page */}
      {user && (
        <HealthForecast userId={user.id} />
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* This Week */}
        <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">This Week</span>
            {getTrendIcon()}
          </div>
          <p className="text-4xl font-bold">{analytics.flares7d}</p>
          <p className={cn("text-sm font-medium mt-1", getTrendColor())}>
            {analytics.trend === 'improving' ? '↓ Improving' : 
             analytics.trend === 'worsening' ? `↑ +${Math.abs(analytics.frequencyChange)}` : 
             'Stable'}
          </p>
        </Card>
        
        {/* Peak Time */}
        <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Peak Time</span>
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold capitalize">{analytics.peakTime}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {analytics.peakTimePercent}% of flares
          </p>
        </Card>
      </div>

      {/* Flare-free streak */}
      {analytics.daysSinceLastFlare !== null && analytics.daysSinceLastFlare >= 2 && (
        <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {analytics.daysSinceLastFlare} days flare-free
              </p>
              <p className="text-sm text-muted-foreground">Keep up the great work!</p>
            </div>
          </div>
        </Card>
      )}

      {/* What's Affecting You */}
      {(analytics.topTriggers.length > 0 || analytics.topSymptoms.length > 0) && (
        <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold">What's Affecting You</h3>
          </div>
          
          {/* Top Triggers */}
          {analytics.topTriggers.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Top Triggers
              </p>
              <div className="space-y-2">
                {analytics.topTriggers.slice(0, 3).map((t) => (
                  <div 
                    key={t.name} 
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${
                        t.avgSeverity >= 2.5 ? 'bg-red-500' : 
                        t.avgSeverity >= 1.5 ? 'bg-orange-500' : 'bg-amber-500'
                      }`} />
                      <span className="text-base font-medium">{t.name}</span>
                    </div>
                    <Badge variant="outline" className="text-sm">
                      {t.count}x
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Symptoms */}
          {analytics.topSymptoms.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Top Symptoms
              </p>
              <div className="flex flex-wrap gap-2">
                {analytics.topSymptoms.slice(0, 4).map((s) => (
                  <Badge 
                    key={s.name} 
                    variant="secondary"
                    className="text-sm py-1.5 px-3"
                  >
                    {s.name} ({s.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Environmental Factors */}
      {(analytics.topWeather.length > 0 || analytics.avgSleep) && (
        <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <ThermometerSun className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-base font-semibold">Environmental Factors</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {analytics.topWeather.length > 0 && (
              <div className="p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Wind className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Weather</span>
                </div>
                <p className="text-base font-medium">{analytics.topWeather[0].name}</p>
                <p className="text-sm text-muted-foreground">{analytics.topWeather[0].count} flares</p>
              </div>
            )}
            
            {analytics.avgSleep && (
              <div className="p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Moon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg Sleep</span>
                </div>
                <p className="text-base font-medium">{analytics.avgSleep}h</p>
                <p className="text-sm text-muted-foreground">during flares</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* What To Do Next */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-base font-semibold">What To Do Next</h3>
        </div>
        
        <div className="space-y-2">
          {analytics.topTriggers.length > 0 && (
            <Button 
              variant="ghost" 
              className="w-full justify-between h-auto py-3 px-3 bg-background/50 hover:bg-background/80"
              onClick={() => onAskAI?.(`How can I avoid ${analytics.topTriggers[0].name}?`)}
            >
              <div className="flex items-center gap-2 text-left">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm">How to avoid {analytics.topTriggers[0].name}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            className="w-full justify-between h-auto py-3 px-3 bg-background/50 hover:bg-background/80"
            onClick={() => onAskAI?.("What patterns do you see in my data?")}
          >
            <div className="flex items-center gap-2 text-left">
              <Brain className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm">Analyze my patterns</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-between h-auto py-3 px-3 bg-background/50 hover:bg-background/80"
            onClick={() => onAskAI?.("What's my flare risk today?")}
          >
            <div className="flex items-center gap-2 text-left">
              <Target className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm">Predict today's risk</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </Card>

      {/* Export Section */}
      <EnhancedMedicalExport entries={entries} conditions={userConditions} />
    </div>
  );
};