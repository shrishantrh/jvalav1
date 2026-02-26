import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parseBold } from '@/lib/renderBold';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { InsightsCharts } from "@/components/insights/InsightsCharts";
import { ImprovedPDFExport } from "@/components/insights/ImprovedPDFExport";
import { MedicalExport } from "@/components/insights/MedicalExport";
import { supabase } from "@/integrations/supabase/client";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  BarChart3,
  Download,
  Clock,
  Sun,
  Moon,
  Thermometer
} from 'lucide-react';
import { format, subDays, isWithinInterval } from 'date-fns';

interface InsightsPanelProps {
  entries: FlareEntry[];
}

interface Insight {
  type: 'pattern' | 'correlation' | 'recommendation' | 'warning';
  title: string;
  description: string;
  confidence: number;
}

export const InsightsPanel = ({ entries }: InsightsPanelProps) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const chartRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  // Calculate key stats
  const stats = useMemo(() => {
    const last7Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(new Date(), 7), end: new Date() })
    );
    const last30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(new Date(), 30), end: new Date() })
    );

    const flares7d = last7Days.filter(e => e.type === 'flare');
    const flares30d = last30Days.filter(e => e.type === 'flare');
    
    const avgSeverity7d = flares7d.length > 0 
      ? flares7d.reduce((sum, e) => {
          return sum + (e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1);
        }, 0) / flares7d.length
      : 0;

    const avgSeverity30d = flares30d.length > 0 
      ? flares30d.reduce((sum, e) => {
          return sum + (e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1);
        }, 0) / flares30d.length
      : 0;

    // Time of day analysis
    const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    flares30d.forEach(f => {
      const hour = f.timestamp.getHours();
      if (hour >= 6 && hour < 12) timeDistribution.morning++;
      else if (hour >= 12 && hour < 18) timeDistribution.afternoon++;
      else if (hour >= 18 && hour < 22) timeDistribution.evening++;
      else timeDistribution.night++;
    });

    const peakTime = Object.entries(timeDistribution)
      .sort((a, b) => b[1] - a[1])[0];

    // Top symptoms
    const symptomCounts: Record<string, number> = {};
    flares30d.forEach(f => {
      f.symptoms?.forEach(s => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    });
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top triggers
    const triggerCounts: Record<string, number> = {};
    flares30d.forEach(f => {
      f.triggers?.forEach(t => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });
    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const trend = avgSeverity7d > avgSeverity30d ? 'up' : avgSeverity7d < avgSeverity30d ? 'down' : 'stable';

    return {
      flares7d: flares7d.length,
      flares30d: flares30d.length,
      avgSeverity7d,
      avgSeverity30d,
      trend,
      peakTime,
      topSymptoms,
      topTriggers,
      totalEntries: entries.length
    };
  }, [entries]);

  const generateAIInsights = async () => {
    if (entries.length === 0) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { entries }
      });

      if (error) throw error;
      
      if (data?.success && data.insights?.length > 0) {
        setInsights(data.insights);
      }
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateAIInsights();
  }, [entries]);

  const getSeverityLabel = (score: number) => {
    if (score >= 2.5) return { label: 'High', color: 'text-severity-severe' };
    if (score >= 1.5) return { label: 'Moderate', color: 'text-severity-moderate' };
    return { label: 'Low', color: 'text-severity-mild' };
  };

  const getTimeLabel = (time: string) => {
    switch(time) {
      case 'morning': return { label: 'Mornings (6am-12pm)', icon: Sun };
      case 'afternoon': return { label: 'Afternoons (12pm-6pm)', icon: Sun };
      case 'evening': return { label: 'Evenings (6pm-10pm)', icon: Moon };
      case 'night': return { label: 'Nights (10pm-6am)', icon: Moon };
      default: return { label: time, icon: Clock };
    }
  };

  return (
    <div className="space-y-4">
      {/* Key Metrics - Clean Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">This Week</span>
            {stats.trend === 'down' ? (
              <TrendingDown className="w-4 h-4 text-severity-none" />
            ) : stats.trend === 'up' ? (
              <TrendingUp className="w-4 h-4 text-severity-severe" />
            ) : null}
          </div>
          <p className="text-2xl font-bold">{stats.flares7d}</p>
          <p className="text-xs text-muted-foreground">flares logged</p>
        </Card>
        
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Avg Severity</span>
          </div>
          <p className={`text-2xl font-bold ${getSeverityLabel(stats.avgSeverity7d).color}`}>
            {getSeverityLabel(stats.avgSeverity7d).label}
          </p>
          <p className="text-xs text-muted-foreground">{stats.avgSeverity7d.toFixed(1)} / 3.0</p>
        </Card>
      </div>

      {/* Quick Insights */}
      {stats.totalEntries >= 3 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            What Your Data Shows
          </h3>
          <div className="space-y-3">
            {/* Peak Time */}
            {stats.peakTime && stats.peakTime[1] > 0 && (
              <div className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg">
                {React.createElement(getTimeLabel(stats.peakTime[0]).icon, { className: "w-4 h-4 mt-0.5 text-muted-foreground" })}
                <div>
                  <p className="text-sm font-medium">Most flares occur in {stats.peakTime[0]}s</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.peakTime[1]} of {stats.flares30d} flares this month
                  </p>
                </div>
              </div>
            )}

            {/* Top Symptoms */}
            {stats.topSymptoms.length > 0 && (
              <div className="p-2 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium mb-2">Most Common Symptoms</p>
                <div className="flex flex-wrap gap-1">
                  {stats.topSymptoms.map(([symptom, count]) => (
                    <Badge key={symptom} variant="secondary" className="text-xs">
                      {symptom} ({count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Top Triggers */}
            {stats.topTriggers.length > 0 && (
              <div className="p-2 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium mb-2">Likely Triggers</p>
                <div className="flex flex-wrap gap-1">
                  {stats.topTriggers.map(([trigger, count]) => (
                    <Badge key={trigger} variant="outline" className="text-xs border-severity-moderate/50">
                      {trigger} ({count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="charts" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="charts" className="text-xs">
            <BarChart3 className="w-3 h-3 mr-1" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">
            <Brain className="w-3 h-3 mr-1" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="export" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="mt-4">
          <div ref={chartRefs[0]}>
            <InsightsCharts entries={entries} />
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card className="p-4 bg-gradient-card border-0 shadow-soft">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Brain className="h-5 w-5 animate-spin text-primary mr-2" />
                <span className="text-sm">Analyzing patterns...</span>
              </div>
            ) : insights.length > 0 ? (
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <div key={index} className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      {insight.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-severity-moderate mt-0.5" />
                      ) : insight.type === 'recommendation' ? (
                        <Lightbulb className="w-4 h-4 text-primary mt-0.5" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-muted-foreground mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{parseBold(insight.description)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Brain className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {entries.length < 5 
                    ? "Log more entries for AI insights" 
                    : "No patterns detected yet"
                  }
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="export" className="mt-4 space-y-4">
          <ImprovedPDFExport entries={entries} chartRefs={chartRefs} />
          <MedicalExport entries={entries} onExport={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
};