import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlareEntry } from "@/types/flare";
import { InsightsCharts } from "@/components/insights/InsightsCharts";
import { FlareMap } from "@/components/insights/FlareMap";
import { PDFExport } from "@/components/insights/PDFExport";
import { ImprovedPDFExport } from "@/components/insights/ImprovedPDFExport";
import { MedicalExport } from "@/components/insights/MedicalExport";
import { supabase } from "@/integrations/supabase/client";
import { 
  Brain, 
  TrendingUp, 
  Calendar, 
  Activity,
  Lightbulb,
  AlertTriangle,
  Target,
  Clock,
  BarChart3,
  Map,
  Download
} from 'lucide-react';

interface InsightsPanelProps {
  entries: FlareEntry[];
}

interface Insight {
  type: 'pattern' | 'correlation' | 'recommendation' | 'warning';
  title: string;
  description: string;
  confidence: number;
  icon?: string;
}

export const InsightsPanel = ({ entries }: InsightsPanelProps) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const chartRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  const getIconForType = (type: string) => {
    switch (type) {
      case 'pattern': return TrendingUp;
      case 'correlation': return Target;
      case 'recommendation': return Lightbulb;
      case 'warning': return AlertTriangle;
      default: return Brain;
    }
  };

  const generateAIInsights = async () => {
    if (entries.length === 0) {
      console.log('Skipping AI insights - no entries');
      return;
    }

    setLoading(true);
    console.log('🚀 Starting AI insights generation...');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { entries }
      });

      if (error) throw error;

      console.log('🎯 Received AI insights:', data);
      
      if (data?.success && data.insights && data.insights.length > 0) {
        const formattedInsights = data.insights.map((insight: any) => ({
          ...insight,
          icon: getIconForType(insight.type)
        }));
        
        setInsights(formattedInsights);
        setLastUpdated(new Date());
        console.log('✅ Insights updated successfully');
      } else {
        console.log('⚠️ No insights generated');
      }
    } catch (error) {
      console.error('❌ Failed to generate insights:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateAIInsights();
  }, [entries]);

  const getBasicStats = () => {
    const last7Days = entries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return entryDate >= weekAgo;
    });

    const flares = last7Days.filter(entry => entry.type === 'flare');
    const avgSeverity = flares.length > 0 
      ? flares.reduce((sum, entry) => {
          const severityValue = entry.severity === 'severe' ? 4 : 
                               entry.severity === 'moderate' ? 3 :
                               entry.severity === 'mild' ? 2 : 1;
          return sum + severityValue;
        }, 0) / flares.length
      : 0;

    return {
      totalEntries: last7Days.length,
      flareCount: flares.length,
      avgSeverity
    };
  };

  const stats = getBasicStats();

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <Calendar className="h-8 w-8 text-primary mr-3" />
            <div>
              <p className="text-2xl font-bold">{stats.totalEntries}</p>
              <p className="text-sm text-muted-foreground">Total Entries</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <Activity className="h-8 w-8 text-severity-moderate mr-3" />
            <div>
              <p className="text-2xl font-bold">{stats.flareCount}</p>
              <p className="text-sm text-muted-foreground">Flares (7 days)</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <TrendingUp className="h-8 w-8 text-accent mr-3" />
            <div>
              <p className="text-2xl font-bold">{stats.avgSeverity.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Avg Severity</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Insights Tabs */}
      <Tabs defaultValue="charts" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="charts" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="map" className="flex items-center gap-2">
            <Map className="w-4 h-4" />
            Community
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-6">
          <div ref={chartRefs[0]}>
            <InsightsCharts entries={entries} />
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Generated Insights
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full ml-auto">
                  Beta
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Brain className="h-6 w-6 animate-spin text-primary mr-2" />
                  <span>Analyzing your data...</span>
                </div>
              ) : insights.length > 0 ? (
                <div className="space-y-4">
                  {insights.map((insight, index) => {
                    const IconComponent = getIconForType(insight.type);
                    return (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <IconComponent className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">{insight.title}</h4>
                            <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-xs text-muted-foreground mt-4">
                    Last updated: {lastUpdated.toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No insights available yet</p>
                  <p className="text-sm">
                    {entries.length < 5 
                      ? "Add more entries to get personalized insights" 
                      : "Try refreshing or check back later"
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map" className="space-y-6">
          <div className="relative">
            <div className="absolute inset-0 backdrop-blur-md bg-background/60 z-10 flex items-center justify-center">
              <div className="text-center">
                <Map className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h3 className="text-2xl font-clinical mb-2">Coming Soon</h3>
                <p className="text-muted-foreground">
                  Community features will be available in a future update
                </p>
              </div>
            </div>
            <div className="opacity-30 pointer-events-none">
              <FlareMap />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <ImprovedPDFExport 
            entries={entries} 
            chartRefs={chartRefs}
          />
          
          <MedicalExport entries={entries} onExport={() => setLastUpdated(new Date())} />
        </TabsContent>
      </Tabs>
    </div>
  );
};