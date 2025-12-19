import React, { useMemo, useCallback, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { InsightsCharts } from "@/components/insights/InsightsCharts";
import { EnhancedMedicalExport } from "@/components/insights/EnhancedMedicalExport";
import { FlareLocationMap } from "@/components/history/FlareLocationMap";
import { CommunityHotspots } from "@/components/insights/CommunityHotspots";
import { SmartPredictions } from "@/components/insights/SmartPredictions";
import { HealthScoreDashboard } from "@/components/insights/HealthScoreDashboard";
import { TriggerFrequencyChart } from "@/components/insights/TriggerFrequencyChart";
import { AdvancedAnalyticsDashboard } from "@/components/insights/AdvancedAnalyticsDashboard";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  BarChart3,
  Download,
  MapPin,
  Minus,
  Clock,
  Target,
  ThermometerSun,
} from 'lucide-react';
import { format, subDays, isWithinInterval, differenceInDays } from 'date-fns';

interface CleanInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
}

// Stop words for trigger extraction
const STOP_WORDS = new Set([
  'the', 'and', 'some', 'lot', 'bit', 'too', 'much', 'very', 'really', 
  'today', 'yesterday', 'just', 'like', 'been', 'have', 'had', 'was', 'were', 
  'that', 'this', 'with', 'good', 'great', 'bad', 'well', 'feeling', 'feel',
  'before', 'after', 'during', 'while', 'when', 'then', 'now', 'later',
  'morning', 'afternoon', 'evening', 'night', 'day', 'week', 'month',
  'went', 'going', 'doing', 'done', 'did', 'does', 'made', 'making',
  'got', 'get', 'getting', 'started', 'start', 'starting',
]);

export const CleanInsights = ({ entries, userConditions = [] }: CleanInsightsProps) => {
  const chartRef = React.useRef<HTMLDivElement>(null);

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
    const flaresPrev30d = prev30Days.filter(e => e.type === 'flare');

    const getSeverityScore = (s: string) => s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
    const calcAvg = (flares: FlareEntry[]) => {
      if (flares.length === 0) return 0;
      return flares.reduce((sum, e) => sum + getSeverityScore(e.severity || 'mild'), 0) / flares.length;
    };

    const avgSeverity7d = calcAvg(flares7d);
    const avgSeverityPrev = calcAvg(flaresPrev30d);

    const weeklyAvgFlares = flares30d.length / 4;
    const frequencyChange = flares7d.length - weeklyAvgFlares;
    
    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (frequencyChange > 1.5) trend = 'worsening';
    else if (frequencyChange < -1.5) trend = 'improving';

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

    // Extract triggers from notes - filter out stop words
    const extractTriggersFromNotes = (note: string): string[] => {
      const triggers: string[] = [];
      const patterns = [
        /(?:ate|eaten|eat|eating|had|consumed)\s+(?:some\s+)?(?:a\s+)?(\w+(?:\s+\w+)?)/gi,
        /(?:drank|drunk|drink|drinking)\s+(?:some\s+)?(?:a\s+)?(\w+(?:\s+\w+)?)/gi,
        /(\w+)\s+(?:for\s+)?(?:breakfast|lunch|dinner|snack)/gi,
      ];
      
      patterns.forEach(pattern => {
        const matches = note.toLowerCase().matchAll(pattern);
        for (const match of matches) {
          const trigger = match[1].trim();
          if (trigger.length > 2 && !STOP_WORDS.has(trigger)) {
            triggers.push(trigger);
          }
        }
      });
      return triggers;
    };

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

    // Trigger analysis - combine explicit triggers with note-extracted ones
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
      if (f.note) {
        const noteTriggers = extractTriggersFromNotes(f.note);
        noteTriggers.forEach(t => {
          if (!triggerData[t]) triggerData[t] = { count: 0, severities: [] };
          triggerData[t].count++;
          triggerData[t].severities.push(getSeverityScore(f.severity || 'mild'));
        });
      }
    });

    const topTriggers = Object.entries(triggerData)
      .filter(([_, data]) => data.count >= 2)
      .map(([name, data]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: data.count,
        percentage: Math.round((data.count / flares30d.length) * 100),
        avgSeverity: data.severities.reduce((a, b) => a + b, 0) / data.severities.length
      }))
      .sort((a, b) => b.avgSeverity - a.avgSeverity)
      .slice(0, 5);

    // Weather correlation
    const weatherData: Record<string, { count: number; conditions: string[] }> = {};
    flares30d.forEach(f => {
      if (f.environmentalData?.weather?.condition) {
        const cond = f.environmentalData.weather.condition;
        if (!weatherData[cond]) weatherData[cond] = { count: 0, conditions: [] };
        weatherData[cond].count++;
      }
    });
    const topWeather = Object.entries(weatherData)
      .map(([name, data]) => ({ name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Physiological data correlation analysis
    const physioCorrelations: { metric: string; avgDuringFlare: number; unit: string; trend?: string }[] = [];
    
    const hrvValues = flares30d.filter(f => f.physiologicalData?.hrv_rmssd).map(f => f.physiologicalData?.hrv_rmssd as number);
    if (hrvValues.length > 0) {
      const avgHRV = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
      physioCorrelations.push({ metric: 'HRV', avgDuringFlare: Math.round(avgHRV), unit: 'ms', trend: avgHRV < 30 ? 'low' : avgHRV > 50 ? 'high' : 'normal' });
    }
    
    const hrValues = flares30d.filter(f => f.physiologicalData?.heart_rate).map(f => f.physiologicalData?.heart_rate as number);
    if (hrValues.length > 0) {
      const avgHR = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
      physioCorrelations.push({ metric: 'Resting HR', avgDuringFlare: Math.round(avgHR), unit: 'bpm', trend: avgHR > 80 ? 'elevated' : 'normal' });
    }
    
    const spo2Values = flares30d.filter(f => f.physiologicalData?.spo2).map(f => f.physiologicalData?.spo2 as number);
    if (spo2Values.length > 0) {
      const avgSpO2 = spo2Values.reduce((a, b) => a + b, 0) / spo2Values.length;
      physioCorrelations.push({ metric: 'SpO2', avgDuringFlare: Math.round(avgSpO2 * 10) / 10, unit: '%', trend: avgSpO2 < 95 ? 'low' : 'normal' });
    }
    
    const sleepValues = flares30d.filter(f => f.physiologicalData?.sleep_hours).map(f => f.physiologicalData?.sleep_hours as number);
    if (sleepValues.length > 0) {
      const avgSleep = sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length;
      physioCorrelations.push({ metric: 'Sleep', avgDuringFlare: Math.round(avgSleep * 10) / 10, unit: 'hrs', trend: avgSleep < 6 ? 'low' : avgSleep > 8 ? 'good' : 'moderate' });
    }

    const sortedFlares = [...flares30d].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const daysSinceLastFlare = sortedFlares.length > 0 
      ? differenceInDays(now, sortedFlares[0].timestamp)
      : null;

    return {
      flares7d: flares7d.length,
      flares30d: flares30d.length,
      avgSeverity7d,
      trend,
      frequencyChange: Math.round(frequencyChange * 10) / 10,
      peakTime: peakTime[0],
      peakTimePercent,
      topSymptoms,
      topTriggers,
      topWeather,
      physioCorrelations,
      daysSinceLastFlare,
      totalEntries: entries.length
    };
  }, [entries]);

  const getSeverityColor = (score: number) => {
    if (score >= 2.5) return 'text-severity-severe';
    if (score >= 1.5) return 'text-severity-moderate';
    return 'text-severity-mild';
  };

  const getTrendIcon = () => {
    if (analytics.trend === 'improving') return <TrendingDown className="w-4 h-4 text-severity-none" />;
    if (analytics.trend === 'worsening') return <TrendingUp className="w-4 h-4 text-severity-severe" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getTrendLabel = () => {
    if (analytics.trend === 'improving') return 'Improving';
    if (analytics.trend === 'worsening') return `+${analytics.frequencyChange > 0 ? analytics.frequencyChange : 0} this week`;
    return 'Stable';
  };

  return (
    <div className="space-y-4 stagger-fade-in">
      {/* Primary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-gradient-card border shadow-soft hover-lift">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">This Week</span>
            {getTrendIcon()}
          </div>
          <p className="text-3xl font-bold gradient-text-animated">{analytics.flares7d}</p>
          <p className="text-xs text-muted-foreground">{getTrendLabel()}</p>
        </Card>
        
        <Card className="p-4 bg-gradient-card border shadow-soft hover-lift">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Peak Time</span>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-lg font-bold capitalize">{analytics.peakTime}</p>
          <p className="text-xs text-muted-foreground">{analytics.peakTimePercent}% of flares</p>
        </Card>
      </div>

      {/* Flare-free streak if applicable */}
      {analytics.daysSinceLastFlare !== null && analytics.daysSinceLastFlare >= 2 && (
        <Card className="p-3 bg-severity-none/10 border-severity-none/20 border animate-fade-in card-enter">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-severity-none/20 flex items-center justify-center animate-float">
              <Target className="w-4 h-4 text-severity-none" />
            </div>
            <div>
              <span className="text-sm font-medium">
                {analytics.daysSinceLastFlare} days flare-free
              </span>
              <p className="text-[10px] text-muted-foreground">Keep it up!</p>
            </div>
          </div>
        </Card>
      )}

      {/* What's Affecting You - Main actionable section */}
      {(analytics.topTriggers.length > 0 || analytics.topSymptoms.length > 0) && (
        <Card className="p-4 bg-gradient-card border shadow-soft">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-primary">
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            What's Affecting You
          </h3>
          
          {/* High-impact triggers */}
          {analytics.topTriggers.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Triggers (by severity impact)
              </p>
              <div className="space-y-2">
                {analytics.topTriggers.slice(0, 3).map((t, idx) => (
                  <div 
                    key={t.name} 
                    className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors animate-fade-in"
                    style={{ animationDelay: `${idx * 75}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full animate-pulse-soft ${
                        t.avgSeverity >= 2.5 ? 'bg-severity-severe' : 
                        t.avgSeverity >= 1.5 ? 'bg-severity-moderate' : 'bg-severity-mild'
                      }`} />
                      <span className="text-sm">{t.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t.count}× • {t.avgSeverity >= 2.5 ? 'often severe' : t.avgSeverity >= 1.5 ? 'moderate' : 'usually mild'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common symptoms */}
          {analytics.topSymptoms.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                Most common symptoms
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analytics.topSymptoms.map((s, idx) => (
                  <Badge 
                    key={s.name} 
                    variant="secondary"
                    className="text-xs animate-scale-in press-effect"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    {s.name} <span className="ml-1 opacity-60">{s.percentage}%</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Weather patterns */}
          {analytics.topWeather.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <ThermometerSun className="w-3 h-3" />
                Weather during flares
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analytics.topWeather.map(w => (
                  <Badge key={w.name} variant="outline" className="text-xs">
                    {w.name} ({w.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Physiological correlations */}
          {analytics.physioCorrelations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Body metrics during flares
              </p>
              <div className="grid grid-cols-2 gap-2">
                {analytics.physioCorrelations.map(p => (
                  <div key={p.metric} className="p-2 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{p.metric}</span>
                      {p.trend && p.trend !== 'normal' && (
                        <Badge variant="outline" className={cn("text-[10px] h-4", 
                          p.trend === 'low' || p.trend === 'elevated' ? 'border-amber-500/50 text-amber-600' : 'border-green-500/50 text-green-600'
                        )}>
                          {p.trend}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-bold">{p.avgDuringFlare} <span className="text-[10px] font-normal text-muted-foreground">{p.unit}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* AI Predictions - compact, below main insights */}
      <SmartPredictions entries={entries} userConditions={userConditions} />

      {/* Detailed Views */}
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-10 p-1 bg-muted/50">
          <TabsTrigger value="analytics" className="text-xs px-1 data-[state=active]:shadow-primary data-[state=active]:animate-scale-in">
            📊 Analytics
          </TabsTrigger>
          <TabsTrigger value="charts" className="text-xs px-1 data-[state=active]:shadow-primary">
            <BarChart3 className="w-3 h-3 mr-1" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="map" className="text-xs px-1 data-[state=active]:shadow-primary">
            <MapPin className="w-3 h-3 mr-1" />
            Map
          </TabsTrigger>
          <TabsTrigger value="community" className="text-xs px-1 data-[state=active]:shadow-primary">
            🌍
          </TabsTrigger>
          <TabsTrigger value="export" className="text-xs px-1 data-[state=active]:shadow-primary">
            <Download className="w-3 h-3 mr-1" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4 animate-fade-in">
          <AdvancedAnalyticsDashboard entries={entries} />
        </TabsContent>

        <TabsContent value="charts" className="mt-4 animate-fade-in">
          <div className="space-y-4">
            <HealthScoreDashboard entries={entries} />
            <TriggerFrequencyChart entries={entries} />
            <div ref={chartRef}>
              <InsightsCharts entries={entries} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="map" className="mt-4 animate-fade-in">
          <FlareLocationMap entries={entries} />
        </TabsContent>

        <TabsContent value="community" className="mt-4 animate-fade-in">
          <CommunityHotspots entries={entries} userConditions={userConditions} />
        </TabsContent>

        <TabsContent value="export" className="mt-4 animate-fade-in">
          <EnhancedMedicalExport entries={entries} conditions={userConditions} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
