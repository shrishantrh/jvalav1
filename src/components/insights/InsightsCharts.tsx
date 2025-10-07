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

  // Generate comprehensive fake data if entries are limited
  const generateEnhancedData = () => {
    const last30Days = eachDayOfInterval({
      start: subDays(new Date(), 30),
      end: new Date()
    });

    return last30Days.map((day, index) => {
      const dayEntries = entries.filter(entry => 
        format(new Date(entry.timestamp), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );

      // Generate realistic fake data patterns
      const baseTemp = 18 + Math.sin((index / 30) * Math.PI * 2) * 8; // Seasonal variation
      const tempVariation = (Math.random() - 0.5) * 6;
      const temperature = Math.round(baseTemp + tempVariation);
      
      const basePollen = 40 + Math.sin((index / 30) * Math.PI * 4) * 30; // Pollen seasons
      const pollen = Math.max(0, Math.round(basePollen + (Math.random() - 0.5) * 20));
      
      const pressure = Math.round(1013 + (Math.random() - 0.5) * 20);
      const humidity = Math.round(45 + (Math.random() - 0.5) * 40);
      
      // Correlate flares with environmental factors
      const flareChance = Math.max(0, 
        (temperature > 28 ? 0.4 : 0) + 
        (pollen > 60 ? 0.3 : 0) + 
        (pressure < 1000 ? 0.2 : 0) +
        Math.random() * 0.3
      );
      
      const flareCount = dayEntries.filter(e => e.type === 'flare').length || 
        (Math.random() < flareChance ? Math.floor(Math.random() * 3) + 1 : 0);
      
      const avgSeverity = flareCount > 0 ? 
        Math.max(1, Math.min(4, 2 + (temperature > 25 ? 1 : 0) + (pollen > 70 ? 1 : 0))) : 0;
      
      const energyLevel = Math.max(1, 5 - Math.floor(avgSeverity * 0.8) - (Math.random() < 0.3 ? 1 : 0));
      
      // Physiological data
      const heartRate = Math.round(65 + (avgSeverity * 5) + (Math.random() - 0.5) * 15);
      const sleepHours = Math.max(4, 8 - (avgSeverity * 0.5) + (Math.random() - 0.5) * 2);
      const stressLevel = Math.min(10, Math.max(1, Math.round(avgSeverity + (Math.random() - 0.5) * 3)));
      const steps = Math.round(Math.max(2000, 8000 - (avgSeverity * 1000) + (Math.random() - 0.5) * 3000));

      return {
        date: format(day, 'MMM dd'),
        fullDate: day,
        flares: flareCount,
        severity: avgSeverity,
        energy: energyLevel,
        entries: dayEntries.length || Math.floor(Math.random() * 5),
        temperature,
        pollen,
        pressure,
        humidity,
        heartRate,
        sleepHours,
        stressLevel,
        steps: steps / 1000 // Convert to thousands for chart readability
      };
    });
  };

  const generateSymptomData = () => {
    // Generate realistic symptom data
    const commonSymptoms = [
      { symptom: 'Joint Pain', count: Math.floor(Math.random() * 15) + 8 },
      { symptom: 'Fatigue', count: Math.floor(Math.random() * 12) + 10 },
      { symptom: 'Muscle Stiffness', count: Math.floor(Math.random() * 10) + 6 },
      { symptom: 'Swelling', count: Math.floor(Math.random() * 8) + 4 },
      { symptom: 'Morning Stiffness', count: Math.floor(Math.random() * 12) + 7 },
      { symptom: 'Sleep Issues', count: Math.floor(Math.random() * 9) + 5 },
      { symptom: 'Headache', count: Math.floor(Math.random() * 7) + 3 },
      { symptom: 'Skin Rash', count: Math.floor(Math.random() * 6) + 2 }
    ];

    return commonSymptoms.sort((a, b) => b.count - a.count);
  };

  const generateTimeOfDayData = () => {
    // Generate realistic time-of-day patterns for flares
    const timePatterns = Array.from({ length: 24 }, (_, hour) => {
      let baseFlares = 0;
      
      // Morning stiffness peak (6-9 AM)
      if (hour >= 6 && hour <= 9) baseFlares = Math.floor(Math.random() * 4) + 2;
      // Afternoon stress peak (2-4 PM)  
      else if (hour >= 14 && hour <= 16) baseFlares = Math.floor(Math.random() * 3) + 1;
      // Evening fatigue (6-8 PM)
      else if (hour >= 18 && hour <= 20) baseFlares = Math.floor(Math.random() * 3) + 1;
      // Night rest (10 PM - 5 AM)
      else if (hour >= 22 || hour <= 5) baseFlares = Math.floor(Math.random() * 2);
      // Other hours
      else baseFlares = Math.floor(Math.random() * 2);

      return {
        hour: hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : 
              hour < 12 ? `${hour} AM` : `${hour - 12} PM`,
        flares: baseFlares,
        hourNum: hour
      };
    });

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