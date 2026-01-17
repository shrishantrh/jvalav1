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
  ResponsiveContainer,
  Cell,
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
} from 'recharts';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { 
  ChevronDown, 
  ChevronRight, 
  Activity, 
  Clock, 
  Thermometer, 
  Heart,
  TrendingUp,
  Zap,
  BarChart3
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface PremiumInsightsChartsProps {
  entries: FlareEntry[];
}

const GRADIENT_COLORS = {
  primary: ['#892EFF', '#D6006C'],
  severe: ['#FF4B4B', '#FF8080'],
  moderate: ['#FFA500', '#FFD580'],
  mild: ['#4ADE80', '#86EFAC'],
  energy: ['#6366F1', '#8B5CF6'],
};

export const PremiumInsightsCharts = ({ entries }: PremiumInsightsChartsProps) => {
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set(['timeline']));

  const toggleChart = (chartId: string) => {
    const newSet = new Set(expandedCharts);
    if (newSet.has(chartId)) {
      newSet.delete(chartId);
    } else {
      newSet.add(chartId);
    }
    setExpandedCharts(newSet);
  };

  // Process data
  const timelineData = useMemo(() => {
    const last30Days = eachDayOfInterval({
      start: subDays(new Date(), 30),
      end: new Date()
    });

    return last30Days.map((day) => {
      const dayEntries = entries.filter(entry => 
        format(new Date(entry.timestamp), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );

      const flareEntries = dayEntries.filter(e => e.type === 'flare');
      const flareCount = flareEntries.length;
      
      const severityMap: Record<string, number> = { 'none': 0, 'mild': 1, 'moderate': 2, 'severe': 3 };
      const avgSeverity = flareCount > 0 
        ? flareEntries.reduce((sum, e) => sum + (severityMap[e.severity || 'none'] || 0), 0) / flareCount
        : 0;

      const envData = dayEntries.map(e => e.environmentalData).filter(Boolean);
      const temperature = envData.length > 0
        ? Math.round(envData.reduce((sum, e) => sum + (e?.weather?.temperature || 0), 0) / envData.length)
        : null;

      return {
        date: format(day, 'MMM dd'),
        shortDate: format(day, 'dd'),
        flares: flareCount,
        severity: Math.round(avgSeverity * 10) / 10,
        temperature,
      };
    });
  }, [entries]);

  const symptomData = useMemo(() => {
    const symptomCounts: Record<string, number> = {};
    entries.forEach(entry => {
      entry.symptoms?.forEach(symptom => {
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
      });
    });
    return Object.entries(symptomCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [entries]);

  const severityData = useMemo(() => {
    const flares = entries.filter(e => e.type === 'flare');
    const counts = {
      mild: flares.filter(e => e.severity === 'mild').length,
      moderate: flares.filter(e => e.severity === 'moderate').length,
      severe: flares.filter(e => e.severity === 'severe').length,
    };
    return [
      { name: 'Mild', value: counts.mild, fill: 'hsl(var(--severity-mild))' },
      { name: 'Moderate', value: counts.moderate, fill: 'hsl(var(--severity-moderate))' },
      { name: 'Severe', value: counts.severe, fill: 'hsl(var(--severity-severe))' },
    ].filter(d => d.value > 0);
  }, [entries]);

  const timeOfDayData = useMemo(() => {
    const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ 
      hour: i, 
      label: i === 0 ? '12a' : i === 12 ? '12p' : i < 12 ? `${i}a` : `${i-12}p`,
      count: 0 
    }));
    
    entries
      .filter(e => e.type === 'flare')
      .forEach(entry => {
        const hour = new Date(entry.timestamp).getHours();
        hourBuckets[hour].count++;
      });

    return hourBuckets;
  }, [entries]);

  const hasData = entries.filter(e => e.type === 'flare').length > 0;

  if (!hasData) {
    return (
      <Card className="p-8 text-center bg-gradient-to-br from-card to-muted/20 border-0 shadow-lg">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
        <p className="text-sm text-muted-foreground">
          Start logging entries to see beautiful analytics
        </p>
      </Card>
    );
  }

  const charts = [
    {
      id: 'timeline',
      title: 'Flare Timeline',
      subtitle: '30-day activity overview',
      icon: Activity,
      gradient: 'from-primary/10 to-transparent',
      chart: (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="flareGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="severityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--severity-severe))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--severity-severe))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="shortDate" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                  padding: '12px',
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Area 
                type="monotone" 
                dataKey="flares" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2.5}
                fill="url(#flareGradient)"
                name="Daily Flares"
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
              />
              <Area 
                type="monotone" 
                dataKey="severity" 
                stroke="hsl(var(--severity-severe))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#severityGradient)"
                name="Avg Severity"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    {
      id: 'symptoms',
      title: 'Symptom Distribution',
      subtitle: 'Most frequent symptoms',
      icon: Zap,
      gradient: 'from-severity-moderate/10 to-transparent',
      chart: symptomData.length > 0 ? (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={symptomData} 
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="symptomGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--severity-moderate))" />
                </linearGradient>
              </defs>
              <XAxis 
                type="number" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                }}
                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
              />
              <Bar 
                dataKey="value" 
                fill="url(#symptomGradient)"
                radius={[0, 6, 6, 0]}
                name="Occurrences"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null,
    },
    {
      id: 'severity',
      title: 'Severity Breakdown',
      subtitle: 'Flare intensity distribution',
      icon: TrendingUp,
      gradient: 'from-severity-severe/10 to-transparent',
      chart: severityData.length > 0 ? (
        <div className="h-52 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.15"/>
                </filter>
              </defs>
              <Pie
                data={severityData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                filter="url(#shadow)"
              >
                {severityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute flex flex-col gap-1">
            {severityData.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null,
    },
    {
      id: 'timeOfDay',
      title: 'Daily Patterns',
      subtitle: 'When flares typically occur',
      icon: Clock,
      gradient: 'from-primary/10 to-transparent',
      chart: (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeOfDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="timeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval={3}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                }}
                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
              />
              <Bar 
                dataKey="count" 
                fill="url(#timeGradient)"
                radius={[4, 4, 0, 0]}
                name="Flares"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-1">
        {charts.filter(c => c.chart).length} analytics based on your data
      </p>
      
      {charts.filter(c => c.chart).map((chart) => {
        const isExpanded = expandedCharts.has(chart.id);
        const IconComponent = chart.icon;
        
        return (
          <Card 
            key={chart.id} 
            className={cn(
              "overflow-hidden border-0 shadow-lg transition-all duration-300",
              "bg-gradient-to-br from-card via-card to-muted/10",
              isExpanded && "ring-1 ring-primary/20"
            )}
          >
            <Button 
              variant="ghost" 
              className="w-full p-0 h-auto hover:bg-transparent"
              onClick={() => toggleChart(chart.id)}
            >
              <div className="w-full flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl transition-colors",
                    isExpanded ? "bg-primary/20" : "bg-muted"
                  )}>
                    <IconComponent className={cn(
                      "h-4 w-4 transition-colors",
                      isExpanded ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold">{chart.title}</h3>
                    <p className="text-[11px] text-muted-foreground">{chart.subtitle}</p>
                  </div>
                </div>
                <div className={cn(
                  "p-1.5 rounded-full transition-all",
                  isExpanded ? "bg-primary/10 rotate-180" : "bg-muted"
                )}>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-all",
                    isExpanded ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
              </div>
            </Button>
            
            <div className={cn(
              "overflow-hidden transition-all duration-300",
              isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}>
              <CardContent className="pt-0 pb-4 px-4">
                <div className={cn("rounded-xl p-2 bg-gradient-to-br", chart.gradient)}>
                  {chart.chart}
                </div>
              </CardContent>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
