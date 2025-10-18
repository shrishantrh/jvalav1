import React, { useState } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  ScatterChart, 
  Scatter, 
  PieChart, 
  Pie, 
  Cell, 
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
import { ChevronDown, ChevronRight, BarChart3, Activity, Clock, Thermometer, Heart, Brain } from 'lucide-react';

interface InsightsChartsProps {
  entries: FlareEntry[];
}

export const InsightsCharts = ({ entries }: InsightsChartsProps) => {
  const [openCharts, setOpenCharts] = useState<Set<string>>(new Set(['timeline']));

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
      const energyEntries = dayEntries.filter(e => e.type === 'energy');
      
      // Real flare count
      const flareCount = flareEntries.length;
      
      // Calculate average severity from real data
      const severityMap = { 'none': 0, 'mild': 1, 'moderate': 2, 'severe': 3 };
      const avgSeverity = flareCount > 0 
        ? flareEntries.reduce((sum, e) => sum + (severityMap[e.severity || 'none'] || 0), 0) / flareCount
        : 0;
      
      // Calculate average energy from real data
      const energyMap = { 'very-low': 1, 'low': 2, 'moderate': 3, 'good': 4, 'high': 5 };
      const avgEnergy = energyEntries.length > 0
        ? energyEntries.reduce((sum, e) => sum + (energyMap[e.energyLevel || 'moderate'] || 3), 0) / energyEntries.length
        : 0;
      
      // Extract environmental data from entries
      const envData = dayEntries
        .map(e => e.environmentalData)
        .filter(Boolean);
      
      const temperature = envData.length > 0
        ? Math.round(envData.reduce((sum, e) => sum + (e?.weather?.temperature || 0), 0) / envData.length)
        : 0;
      
      const pollen = envData.length > 0
        ? Math.round(envData.reduce((sum, e) => sum + (e?.airQuality?.pollen || 0), 0) / envData.length)
        : 0;
      
      const pressure = envData.length > 0
        ? Math.round(envData.reduce((sum, e) => sum + (e?.weather?.pressure || 0), 0) / envData.length)
        : 0;
      
      const humidity = envData.length > 0
        ? Math.round(envData.reduce((sum, e) => sum + (e?.weather?.humidity || 0), 0) / envData.length)
        : 0;
      
      // Extract physiological data from entries
      const physioData = dayEntries
        .map(e => e.physiologicalData)
        .filter(Boolean);
      
      const heartRate = physioData.length > 0
        ? Math.round(physioData.reduce((sum, e) => sum + (e?.heartRate || 0), 0) / physioData.length)
        : 0;
      
      const sleepHours = physioData.length > 0
        ? Math.round((physioData.reduce((sum, e) => sum + (e?.sleepHours || 0), 0) / physioData.length) * 10) / 10
        : 0;
      
      const stressLevel = physioData.length > 0
        ? Math.round(physioData.reduce((sum, e) => sum + (e?.stressLevel || 0), 0) / physioData.length)
        : 0;
      
      const steps = physioData.length > 0
        ? Math.round(physioData.reduce((sum, e) => sum + (e?.steps || 0), 0) / physioData.length / 1000)
        : 0;

      return {
        date: format(day, 'MMM dd'),
        fullDate: day,
        flares: flareCount,
        severity: Math.round(avgSeverity * 10) / 10,
        energy: Math.round(avgEnergy * 10) / 10,
        entries: dayEntries.length,
        temperature,
        pollen,
        pressure,
        humidity,
        heartRate,
        sleepHours,
        stressLevel,
        steps
      };
    });
  };

  const generateSymptomData = () => {
    // Extract real symptom data from entries
    const symptomCounts: { [key: string]: number } = {};
    
    entries.forEach(entry => {
      if (entry.symptoms && entry.symptoms.length > 0) {
        entry.symptoms.forEach(symptom => {
          symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
        });
      }
    });

    const symptomData = Object.entries(symptomCounts)
      .map(([symptom, count]) => ({ symptom, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 symptoms

    return symptomData;
  };

  const generateTimeOfDayData = () => {
    // Extract real time-of-day patterns from flare entries
    const hourCounts = Array.from({ length: 24 }, () => 0);
    
    entries
      .filter(entry => entry.type === 'flare')
      .forEach(entry => {
        const hour = new Date(entry.timestamp).getHours();
        hourCounts[hour]++;
      });

    const timePatterns = hourCounts.map((count, hour) => ({
      hour: hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : 
            hour < 12 ? `${hour} AM` : `${hour - 12} PM`,
      flares: count,
      hourNum: hour
    }));

    return timePatterns;
  };

  const timelineData = generateEnhancedData();
  const symptomData = generateSymptomData();
  const timeOfDayData = generateTimeOfDayData();

  const COLORS = ['hsl(var(--severity-severe))', 'hsl(var(--severity-moderate))', 'hsl(var(--severity-mild))', 'hsl(var(--severity-none))'];

  const chartConfigs = [
    {
      id: 'timeline',
      title: 'Flare & Energy Timeline',
      subtitle: '30-day symptom and energy tracking',
      icon: Activity,
      component: (
        <ResponsiveContainer width="100%" height={400}>
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
              dataKey="flares" 
              stroke="hsl(var(--severity-severe))" 
              strokeWidth={3}
              name="Daily Flares"
              dot={{ r: 4 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="energy" 
              stroke="hsl(var(--severity-none))" 
              strokeWidth={3}
              name="Energy Level (1-5)"
              dot={{ r: 4 }}
            />
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
    },
    {
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
    },
    {
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
    },
    {
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
              name="Temperature (°C)"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="pollen" 
              stroke="hsl(var(--severity-moderate))" 
              strokeWidth={2}
              name="Pollen Level"
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
    },
    {
      id: 'physiological',
      title: 'Physiological Metrics',
      subtitle: 'Heart rate, sleep, and stress tracking',
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
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="sleepHours" 
              stroke="hsl(var(--severity-none))" 
              strokeWidth={2}
              name="Sleep Hours"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="stressLevel" 
              stroke="hsl(var(--severity-moderate))" 
              strokeWidth={2}
              name="Stress Level (1-10)"
            />
          </LineChart>
        </ResponsiveContainer>
      )
    },
    {
      id: 'activity',
      title: 'Activity & Mobility',
      subtitle: 'Daily steps and activity levels',
      icon: Brain,
      component: (
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={timelineData}>
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
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="steps" 
              stroke="hsl(var(--primary))" 
              fill="hsl(var(--primary) / 0.3)"
              strokeWidth={2}
              name="Daily Steps (thousands)"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="flares" 
              stroke="hsl(var(--severity-severe))" 
              strokeWidth={3}
              name="Daily Flares"
            />
          </AreaChart>
        </ResponsiveContainer>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Click on any chart to expand and view detailed analysis
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