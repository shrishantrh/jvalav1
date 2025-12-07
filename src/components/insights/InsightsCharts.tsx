import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FlareEntry } from "@/types/flare";
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { ChevronDown, ChevronRight, BarChart3, Activity, Clock, Thermometer, Heart } from 'lucide-react';

interface InsightsChartsProps {
  entries: FlareEntry[];
}

// Check if user has meaningful data for specific chart types
const hasEnergyData = (entries: FlareEntry[]) => 
  entries.some(e => e.type === 'energy' || e.energyLevel);

const hasEnvironmentalData = (entries: FlareEntry[]) =>
  entries.some(e => e.environmentalData?.weather?.temperature);

const hasPhysiologicalData = (entries: FlareEntry[]) =>
  entries.some(e => e.physiologicalData?.heartRate || e.physiologicalData?.sleepHours);

const hasSymptomData = (entries: FlareEntry[]) =>
  entries.some(e => e.symptoms && e.symptoms.length > 0);

export const InsightsCharts = ({ entries }: InsightsChartsProps) => {
  const [openCharts, setOpenCharts] = useState<Set<string>>(new Set(['timeline']));

  // Determine which charts are relevant
  const chartRelevance = useMemo(() => ({
    timeline: entries.filter(e => e.type === 'flare').length > 0,
    symptoms: hasSymptomData(entries),
    timeofday: entries.filter(e => e.type === 'flare').length >= 3,
    environmental: hasEnvironmentalData(entries),
    physiological: hasPhysiologicalData(entries),
    energy: hasEnergyData(entries),
  }), [entries]);

  const toggleChart = (chartId: string) => {
    const newOpenCharts = new Set(openCharts);
    if (newOpenCharts.has(chartId)) {
      newOpenCharts.delete(chartId);
    } else {
      newOpenCharts.add(chartId);
    }
    setOpenCharts(newOpenCharts);
  };

  // Process real user data
  const generateEnhancedData = () => {
    const last30Days = eachDayOfInterval({
      start: subDays(new Date(), 30),
      end: new Date()
    });

    return last30Days.map((day) => {
      const dayEntries = entries.filter(entry => 
        format(new Date(entry.timestamp), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );

      const flareEntries = dayEntries.filter(e => e.type === 'flare');
      const energyEntries = dayEntries.filter(e => e.type === 'energy' || e.energyLevel);
      
      const flareCount = flareEntries.length;
      
      const severityMap = { 'none': 0, 'mild': 1, 'moderate': 2, 'severe': 3 };
      const avgSeverity = flareCount > 0 
        ? flareEntries.reduce((sum, e) => sum + (severityMap[e.severity || 'none'] || 0), 0) / flareCount
        : 0;
      
      const energyMap = { 'very-low': 1, 'low': 2, 'moderate': 3, 'good': 4, 'high': 5 };
      const avgEnergy = energyEntries.length > 0
        ? energyEntries.reduce((sum, e) => sum + (energyMap[e.energyLevel || 'moderate'] || 3), 0) / energyEntries.length
        : null; // null if no energy data
      
      const envData = dayEntries.map(e => e.environmentalData).filter(Boolean);
      
      const temperature = envData.length > 0
        ? Math.round(envData.reduce((sum, e) => sum + (e?.weather?.temperature || 0), 0) / envData.length)
        : null;
      
      const pollen = envData.length > 0
        ? Math.round(envData.reduce((sum, e) => sum + (e?.airQuality?.pollen || 0), 0) / envData.length)
        : null;
      
      const humidity = envData.length > 0
        ? Math.round(envData.reduce((sum, e) => sum + (e?.weather?.humidity || 0), 0) / envData.length)
        : null;
      
      const physioData = dayEntries.map(e => e.physiologicalData).filter(Boolean);
      
      const heartRate = physioData.length > 0
        ? Math.round(physioData.reduce((sum, e) => sum + (e?.heartRate || 0), 0) / physioData.length)
        : null;
      
      const sleepHours = physioData.length > 0
        ? Math.round((physioData.reduce((sum, e) => sum + (e?.sleepHours || 0), 0) / physioData.length) * 10) / 10
        : null;
      
      const stressLevel = physioData.length > 0
        ? Math.round(physioData.reduce((sum, e) => sum + (e?.stressLevel || 0), 0) / physioData.length)
        : null;

      return {
        date: format(day, 'MMM dd'),
        fullDate: day,
        flares: flareCount,
        severity: Math.round(avgSeverity * 10) / 10,
        energy: avgEnergy,
        entries: dayEntries.length,
        temperature,
        pollen,
        humidity,
        heartRate,
        sleepHours,
        stressLevel,
      };
    });
  };

  const generateSymptomData = () => {
    const symptomCounts: { [key: string]: number } = {};
    
    entries.forEach(entry => {
      if (entry.symptoms && entry.symptoms.length > 0) {
        entry.symptoms.forEach(symptom => {
          symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
        });
      }
    });

    return Object.entries(symptomCounts)
      .map(([symptom, count]) => ({ symptom, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  const generateTimeOfDayData = () => {
    const hourCounts = Array.from({ length: 24 }, () => 0);
    
    entries
      .filter(entry => entry.type === 'flare')
      .forEach(entry => {
        const hour = new Date(entry.timestamp).getHours();
        hourCounts[hour]++;
      });

    return hourCounts.map((count, hour) => ({
      hour: hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : 
            hour < 12 ? `${hour} AM` : `${hour - 12} PM`,
      flares: count,
      hourNum: hour
    }));
  };

  const timelineData = generateEnhancedData();
  const symptomData = generateSymptomData();
  const timeOfDayData = generateTimeOfDayData();

  // Build charts dynamically based on relevance
  const chartConfigs = useMemo(() => {
    const configs = [];

    // Always show flare timeline if there are any flares
    if (chartRelevance.timeline) {
      configs.push({
        id: 'timeline',
        title: chartRelevance.energy ? 'Flare & Energy Timeline' : 'Flare Timeline',
        subtitle: '30-day symptom tracking',
        icon: Activity,
        component: (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              {chartRelevance.energy && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />}
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="flares" 
                stroke="hsl(var(--severity-severe))" 
                strokeWidth={3}
                name="Daily Flares"
                dot={{ r: 4 }}
              />
              {chartRelevance.energy && (
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="energy" 
                  stroke="hsl(var(--severity-none))" 
                  strokeWidth={3}
                  name="Energy Level (1-5)"
                  dot={{ r: 4 }}
                  connectNulls
                />
              )}
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="severity" 
                stroke="hsl(var(--severity-moderate))" 
                strokeWidth={2}
                name="Avg Severity"
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        )
      });
    }

    // Symptom chart if user has logged symptoms
    if (chartRelevance.symptoms && symptomData.length > 0) {
      configs.push({
        id: 'symptoms',
        title: 'Symptom Distribution',
        subtitle: 'Most frequently reported symptoms',
        icon: BarChart3,
        component: (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={symptomData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="symptom" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="count" 
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )
      });
    }

    // Time of day chart if user has enough flares
    if (chartRelevance.timeofday) {
      configs.push({
        id: 'timeofday',
        title: 'Daily Flare Patterns',
        subtitle: 'When symptoms are most likely to occur',
        icon: Clock,
        component: (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={timeOfDayData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="flares" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary) / 0.3)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      });
    }

    // Environmental chart only if user has environmental data
    if (chartRelevance.environmental) {
      configs.push({
        id: 'environmental',
        title: 'Environmental Correlations',
        subtitle: 'Weather and air quality impact',
        icon: Thermometer,
        component: (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="temperature" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                name="Temperature (°F)"
                connectNulls
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="humidity" 
                stroke="hsl(var(--severity-moderate))" 
                strokeWidth={2}
                name="Humidity %"
                connectNulls
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="flares" 
                stroke="hsl(var(--severity-severe))" 
                strokeWidth={3}
                name="Daily Flares"
              />
            </LineChart>
          </ResponsiveContainer>
        )
      });
    }

    // Physiological chart only if user has wearable/health data
    if (chartRelevance.physiological) {
      configs.push({
        id: 'physiological',
        title: 'Health Metrics',
        subtitle: 'Sleep, heart rate, and stress tracking',
        icon: Heart,
        component: (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="heartRate" 
                stroke="hsl(var(--severity-severe))" 
                strokeWidth={2}
                name="Heart Rate (BPM)"
                connectNulls
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="sleepHours" 
                stroke="hsl(var(--severity-none))" 
                strokeWidth={2}
                name="Sleep Hours"
                connectNulls
              />
              {timelineData.some(d => d.stressLevel) && (
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="stressLevel" 
                  stroke="hsl(var(--severity-moderate))" 
                  strokeWidth={2}
                  name="Stress Level (1-10)"
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )
      });
    }

    return configs;
  }, [chartRelevance, timelineData, symptomData, timeOfDayData]);

  if (chartConfigs.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">
          Start logging more entries to see personalized charts and insights.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Showing {chartConfigs.length} charts relevant to your data
      </div>
      
      {chartConfigs.map((chart) => {
        const isOpen = openCharts.has(chart.id);
        const IconComponent = chart.icon;
        
        return (
          <Collapsible key={chart.id} open={isOpen} onOpenChange={() => toggleChart(chart.id)}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full p-0 h-auto"
                >
                  <CardHeader className="w-full flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <CardTitle className="text-lg">{chart.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{chart.subtitle}</p>
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </CardHeader>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="animate-accordion-down">
                <CardContent className="pt-0">
                  {chart.component}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
};
