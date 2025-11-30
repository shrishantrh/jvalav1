import React, { useMemo, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { InsightsCharts } from "@/components/insights/InsightsCharts";
import { ImprovedPDFExport } from "@/components/insights/ImprovedPDFExport";
import { MedicalExport } from "@/components/insights/MedicalExport";
import { FlareLocationMap } from "@/components/history/FlareLocationMap";
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
  ThermometerSun
} from 'lucide-react';
import { format, subDays, isWithinInterval, differenceInDays } from 'date-fns';

interface CleanInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
}

export const CleanInsights = ({ entries, userConditions = [] }: CleanInsightsProps) => {
  const chartRef = React.useRef<HTMLDivElement>(null);

  // Comprehensive analytics
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

    // Calculate severity scores
    const getSeverityScore = (s: string) => s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
    const calcAvg = (flares: FlareEntry[]) => {
      if (flares.length === 0) return 0;
      return flares.reduce((sum, e) => sum + getSeverityScore(e.severity || 'mild'), 0) / flares.length;
    };

    const avgSeverity7d = calcAvg(flares7d);
    const avgSeverityPrev = calcAvg(flaresPrev30d);

    // Trend calculation - compare this week to average
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

    // Symptom analysis with severity context
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
        if (!triggerData[t]) triggerData[t] = { count: 0, severities: [] };
        triggerData[t].count++;
        triggerData[t].severities.push(getSeverityScore(f.severity || 'mild'));
      });
    });

    const topTriggers = Object.entries(triggerData)
      .map(([name, data]) => ({
        name,
        count: data.count,
        percentage: Math.round((data.count / flares30d.length) * 100),
        avgSeverity: data.severities.reduce((a, b) => a + b, 0) / data.severities.length
      }))
      .sort((a, b) => b.avgSeverity - a.avgSeverity) // Sort by severity impact
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

    // Flare-free streak
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
    <div className="space-y-4">
      {/* Primary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">This Week</span>
            {getTrendIcon()}
          </div>
          <p className="text-3xl font-bold">{analytics.flares7d}</p>
          <p className="text-xs text-muted-foreground">{getTrendLabel()}</p>
        </Card>
        
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
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
        <Card className="p-3 bg-severity-none/10 border-severity-none/20 border">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-severity-none" />
            <span className="text-sm font-medium">
              {analytics.daysSinceLastFlare} days flare-free
            </span>
            <span className="text-xs text-muted-foreground ml-auto">Keep it up!</span>
          </div>
        </Card>
      )}

      {/* What's Affecting You - Actionable Insights */}
      {(analytics.topTriggers.length > 0 || analytics.topSymptoms.length > 0) && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
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
                {analytics.topTriggers.slice(0, 3).map(t => (
                  <div key={t.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        t.avgSeverity >= 2.5 ? 'bg-severity-severe' : 
                        t.avgSeverity >= 1.5 ? 'bg-severity-moderate' : 'bg-severity-mild'
                      }`} />
                      <span className="text-sm">{t.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t.count}x • {t.avgSeverity >= 2.5 ? 'often severe' : t.avgSeverity >= 1.5 ? 'moderate' : 'usually mild'}
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
                {analytics.topSymptoms.map(s => (
                  <Badge 
                    key={s.name} 
                    variant="secondary"
                    className="text-xs"
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
        </Card>
      )}

      {/* Detailed Views */}
      <Tabs defaultValue="charts" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="charts" className="text-xs">
            <BarChart3 className="w-3 h-3 mr-1" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="map" className="text-xs">
            <MapPin className="w-3 h-3 mr-1" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="export" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="mt-4">
          <div ref={chartRef}>
            <InsightsCharts entries={entries} />
          </div>
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <FlareLocationMap entries={entries} />
        </TabsContent>

        <TabsContent value="export" className="mt-4 space-y-4">
          <ImprovedPDFExport entries={entries} chartRefs={[chartRef]} />
          <MedicalExport entries={entries} onExport={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
