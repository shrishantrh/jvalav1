import React, { useState, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { InsightsCharts } from "@/components/insights/InsightsCharts";
import { ImprovedPDFExport } from "@/components/insights/ImprovedPDFExport";
import { MedicalExport } from "@/components/insights/MedicalExport";
import { FlareLocationMap } from "@/components/history/FlareLocationMap";
import { supabase } from "@/integrations/supabase/client";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  BarChart3,
  Download,
  MapPin,
  Activity,
  Target
} from 'lucide-react';
import { format, subDays, isWithinInterval, differenceInDays } from 'date-fns';

interface SmartInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
}

interface Prediction {
  type: 'risk' | 'pattern' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  actionable?: string;
}

export const SmartInsights = ({ entries, userConditions = [] }: SmartInsightsProps) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);

  // Analyze data and generate predictions
  const analytics = useMemo(() => {
    const last7Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(new Date(), 7), end: new Date() })
    );
    const last30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(new Date(), 30), end: new Date() })
    );
    const prev30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(new Date(), 60), end: subDays(new Date(), 30) })
    );

    const flares7d = last7Days.filter(e => e.type === 'flare');
    const flares30d = last30Days.filter(e => e.type === 'flare');
    const flaresPrev30d = prev30Days.filter(e => e.type === 'flare');
    
    // Severity calculations
    const calcAvgSeverity = (flares: FlareEntry[]) => {
      if (flares.length === 0) return 0;
      return flares.reduce((sum, e) => {
        return sum + (e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1);
      }, 0) / flares.length;
    };

    const avgSeverity7d = calcAvgSeverity(flares7d);
    const avgSeverity30d = calcAvgSeverity(flares30d);
    const avgSeverityPrev30d = calcAvgSeverity(flaresPrev30d);

    // Time patterns
    const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    flares30d.forEach(f => {
      const hour = f.timestamp.getHours();
      if (hour >= 6 && hour < 12) timeDistribution.morning++;
      else if (hour >= 12 && hour < 18) timeDistribution.afternoon++;
      else if (hour >= 18 && hour < 22) timeDistribution.evening++;
      else timeDistribution.night++;
    });

    const peakTime = Object.entries(timeDistribution).sort((a, b) => b[1] - a[1])[0];

    // Day of week patterns
    const dayDistribution: Record<string, number> = {};
    flares30d.forEach(f => {
      const day = format(f.timestamp, 'EEEE');
      dayDistribution[day] = (dayDistribution[day] || 0) + 1;
    });
    const peakDay = Object.entries(dayDistribution).sort((a, b) => b[1] - a[1])[0];

    // Symptom analysis
    const symptomData: Record<string, { count: number; severities: string[] }> = {};
    flares30d.forEach(f => {
      f.symptoms?.forEach(s => {
        if (!symptomData[s]) symptomData[s] = { count: 0, severities: [] };
        symptomData[s].count++;
        if (f.severity) symptomData[s].severities.push(f.severity);
      });
    });

    const topSymptoms = Object.entries(symptomData)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgSeverity: data.severities.reduce((sum, s) => 
          sum + (s === 'severe' ? 3 : s === 'moderate' ? 2 : 1), 0) / data.severities.length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Trigger analysis
    const triggerData: Record<string, { count: number; severities: string[] }> = {};
    flares30d.forEach(f => {
      f.triggers?.forEach(t => {
        if (!triggerData[t]) triggerData[t] = { count: 0, severities: [] };
        triggerData[t].count++;
        if (f.severity) triggerData[t].severities.push(f.severity);
      });
    });

    const topTriggers = Object.entries(triggerData)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgSeverity: data.severities.reduce((sum, s) => 
          sum + (s === 'severe' ? 3 : s === 'moderate' ? 2 : 1), 0) / data.severities.length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Weather correlations
    const weatherCorrelations: Record<string, number> = {};
    flares30d.forEach(f => {
      if (f.environmentalData?.weather?.condition) {
        const condition = f.environmentalData.weather.condition;
        weatherCorrelations[condition] = (weatherCorrelations[condition] || 0) + 1;
      }
    });

    // Calculate trends
    const severityTrend = avgSeverity7d > avgSeverity30d ? 'worsening' : 
                         avgSeverity7d < avgSeverity30d ? 'improving' : 'stable';
    
    const frequencyTrend = flares7d.length > (flares30d.length / 4) ? 'increasing' :
                          flares7d.length < (flares30d.length / 4) ? 'decreasing' : 'stable';

    // Flare-free days
    const daysSinceLastFlare = flares30d.length > 0 
      ? differenceInDays(new Date(), flares30d[0].timestamp)
      : null;

    return {
      flares7d: flares7d.length,
      flares30d: flares30d.length,
      flaresPrev30d: flaresPrev30d.length,
      avgSeverity7d,
      avgSeverity30d,
      avgSeverityPrev30d,
      severityTrend,
      frequencyTrend,
      peakTime,
      peakDay,
      topSymptoms,
      topTriggers,
      weatherCorrelations,
      daysSinceLastFlare,
      totalEntries: entries.length
    };
  }, [entries]);

  // Generate predictions based on analytics
  useEffect(() => {
    const newPredictions: Prediction[] = [];

    // Frequency prediction
    if (analytics.frequencyTrend === 'increasing') {
      newPredictions.push({
        type: 'risk',
        title: 'Flare frequency increasing',
        description: `You've had ${analytics.flares7d} flares this week, which is higher than your usual pattern.`,
        confidence: 75,
        actionable: 'Consider identifying new triggers or environmental changes'
      });
    }

    // Severity trend
    if (analytics.severityTrend === 'improving') {
      newPredictions.push({
        type: 'pattern',
        title: 'Your flares are getting milder',
        description: `Average severity has decreased compared to your 30-day baseline. Keep doing what you're doing!`,
        confidence: 80,
      });
    } else if (analytics.severityTrend === 'worsening') {
      newPredictions.push({
        type: 'risk',
        title: 'Severity trending up',
        description: `Recent flares have been more severe than usual. This might be worth discussing with your doctor.`,
        confidence: 70,
        actionable: 'Track any lifestyle changes that coincided with this'
      });
    }

    // Time pattern recommendation
    if (analytics.peakTime && analytics.peakTime[1] > 2) {
      const timeLabel = analytics.peakTime[0] === 'morning' ? 'mornings' :
                       analytics.peakTime[0] === 'afternoon' ? 'afternoons' :
                       analytics.peakTime[0] === 'evening' ? 'evenings' : 'nights';
      newPredictions.push({
        type: 'pattern',
        title: `Most flares happen in ${timeLabel}`,
        description: `${Math.round((analytics.peakTime[1] / analytics.flares30d) * 100)}% of your flares occur during this time.`,
        confidence: 85,
        actionable: `Plan lower-intensity activities for ${timeLabel}`
      });
    }

    // Day pattern
    if (analytics.peakDay && analytics.peakDay[1] > 3) {
      newPredictions.push({
        type: 'pattern',
        title: `${analytics.peakDay[0]}s are your toughest days`,
        description: `You tend to have more flares on ${analytics.peakDay[0]}s. Consider what's different about this day.`,
        confidence: 70,
      });
    }

    // Trigger warning
    if (analytics.topTriggers.length > 0) {
      const worstTrigger = analytics.topTriggers.sort((a, b) => b.avgSeverity - a.avgSeverity)[0];
      if (worstTrigger.avgSeverity > 2) {
        newPredictions.push({
          type: 'risk',
          title: `"${worstTrigger.name}" causes severe flares`,
          description: `When this trigger is involved, your flares tend to be more severe.`,
          confidence: 75,
          actionable: `Try to minimize exposure to ${worstTrigger.name.toLowerCase()}`
        });
      }
    }

    // Weather correlation
    const weatherEntries = Object.entries(analytics.weatherCorrelations);
    if (weatherEntries.length > 0) {
      const topWeather = weatherEntries.sort((a, b) => b[1] - a[1])[0];
      if (topWeather[1] > 3) {
        newPredictions.push({
          type: 'pattern',
          title: `Flares correlate with ${topWeather[0].toLowerCase()} weather`,
          description: `${topWeather[1]} of your recent flares occurred during ${topWeather[0].toLowerCase()} conditions.`,
          confidence: 65,
          actionable: 'Check weather forecasts to prepare for potential flare days'
        });
      }
    }

    // Positive reinforcement
    if (analytics.daysSinceLastFlare !== null && analytics.daysSinceLastFlare > 3) {
      newPredictions.push({
        type: 'recommendation',
        title: `${analytics.daysSinceLastFlare} days flare-free! 🎉`,
        description: `You're on a good streak. Note what's been different recently.`,
        confidence: 100,
      });
    }

    setPredictions(newPredictions);
  }, [analytics]);

  const getSeverityLabel = (score: number) => {
    if (score >= 2.5) return { label: 'High', color: 'text-severity-severe', bg: 'bg-severity-severe/10' };
    if (score >= 1.5) return { label: 'Moderate', color: 'text-severity-moderate', bg: 'bg-severity-moderate/10' };
    return { label: 'Low', color: 'text-severity-mild', bg: 'bg-severity-mild/10' };
  };

  return (
    <div className="space-y-4">
      {/* Key Numbers */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 bg-gradient-card border-0 shadow-soft text-center">
          <p className="text-2xl font-bold">{analytics.flares7d}</p>
          <p className="text-[10px] text-muted-foreground">This week</p>
        </Card>
        <Card className="p-3 bg-gradient-card border-0 shadow-soft text-center">
          <p className={`text-2xl font-bold ${getSeverityLabel(analytics.avgSeverity7d).color}`}>
            {getSeverityLabel(analytics.avgSeverity7d).label}
          </p>
          <p className="text-[10px] text-muted-foreground">Avg severity</p>
        </Card>
        <Card className="p-3 bg-gradient-card border-0 shadow-soft text-center">
          <div className="flex items-center justify-center gap-1">
            {analytics.frequencyTrend === 'decreasing' ? (
              <TrendingDown className="w-4 h-4 text-severity-none" />
            ) : analytics.frequencyTrend === 'increasing' ? (
              <TrendingUp className="w-4 h-4 text-severity-severe" />
            ) : (
              <Activity className="w-4 h-4 text-muted-foreground" />
            )}
            <p className="text-sm font-bold capitalize">{analytics.frequencyTrend}</p>
          </div>
          <p className="text-[10px] text-muted-foreground">Trend</p>
        </Card>
      </div>

      {/* Predictions - The Smart Part */}
      {predictions.length > 0 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            What We're Seeing
          </h3>
          <div className="space-y-3">
            {predictions.slice(0, 4).map((pred, i) => (
              <div 
                key={i} 
                className={`p-3 rounded-lg ${
                  pred.type === 'risk' ? 'bg-severity-moderate/10 border border-severity-moderate/20' :
                  pred.type === 'recommendation' ? 'bg-severity-none/10 border border-severity-none/20' :
                  'bg-muted/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  {pred.type === 'risk' ? (
                    <AlertTriangle className="w-4 h-4 text-severity-moderate mt-0.5 flex-shrink-0" />
                  ) : pred.type === 'recommendation' ? (
                    <Target className="w-4 h-4 text-severity-none mt-0.5 flex-shrink-0" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{pred.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pred.description}</p>
                    {pred.actionable && (
                      <p className="text-xs text-primary mt-1.5 font-medium">
                        💡 {pred.actionable}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Your Patterns */}
      {(analytics.topSymptoms.length > 0 || analytics.topTriggers.length > 0) && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-medium mb-3">Your Top Patterns</h3>
          <div className="space-y-3">
            {analytics.topSymptoms.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Most frequent symptoms</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topSymptoms.map(s => (
                    <Badge 
                      key={s.name} 
                      variant="secondary"
                      className={`text-xs ${getSeverityLabel(s.avgSeverity).bg}`}
                    >
                      {s.name} ({s.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {analytics.topTriggers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Likely triggers</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topTriggers.map(t => (
                    <Badge 
                      key={t.name} 
                      variant="outline"
                      className="text-xs border-severity-moderate/50"
                    >
                      {t.name} ({t.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tabs for detailed views */}
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
          <ImprovedPDFExport entries={entries} chartRefs={[chartRef, chartRef, chartRef]} />
          <MedicalExport entries={entries} onExport={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
