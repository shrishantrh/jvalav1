import React, { useMemo, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlareEntry } from "@/types/flare";
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, Clock, Calendar, 
  Thermometer, Droplets, Wind, AlertCircle, CheckCircle, Flame
} from 'lucide-react';

interface AdvancedAnalyticsDashboardProps {
  entries: FlareEntry[];
}

const SEVERITY_COLORS = {
  none: 'hsl(145, 50%, 48%)',
  mild: 'hsl(42, 85%, 55%)',
  moderate: 'hsl(25, 85%, 58%)',
  severe: 'hsl(355, 75%, 52%)',
};

export const AdvancedAnalyticsDashboard = ({ entries }: AdvancedAnalyticsDashboardProps) => {
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');
  
  const flareEntries = useMemo(() => 
    entries.filter(e => e.type === 'flare' && 
      differenceInDays(new Date(), new Date(e.timestamp)) <= parseInt(timeRange)
    ), [entries, timeRange]
  );

  // Calculate key metrics
  const metrics = useMemo(() => {
    const total = flareEntries.length;
    const severe = flareEntries.filter(e => e.severity === 'severe').length;
    const moderate = flareEntries.filter(e => e.severity === 'moderate').length;
    const mild = flareEntries.filter(e => e.severity === 'mild').length;
    
    const avgPerDay = total / parseInt(timeRange);
    
    // Trend calculation
    const halfPoint = Math.floor(flareEntries.length / 2);
    const recentHalf = flareEntries.slice(0, halfPoint);
    const olderHalf = flareEntries.slice(halfPoint);
    const trend = recentHalf.length > olderHalf.length ? 'increasing' : 
                  recentHalf.length < olderHalf.length ? 'decreasing' : 'stable';
    
    return { total, severe, moderate, mild, avgPerDay, trend };
  }, [flareEntries, timeRange]);

  // Timeline data
  const timelineData = useMemo(() => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), parseInt(timeRange)),
      end: new Date()
    });

    return days.map(day => {
      const dayEntries = flareEntries.filter(e => 
        format(new Date(e.timestamp), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );
      
      const severityScore = dayEntries.reduce((sum, e) => {
        const scores = { none: 0, mild: 1, moderate: 2, severe: 3 };
        return sum + (scores[e.severity || 'none'] || 0);
      }, 0);

      return {
        date: format(day, 'MMM d'),
        fullDate: day,
        flares: dayEntries.length,
        severity: dayEntries.length > 0 ? Math.round((severityScore / dayEntries.length) * 10) / 10 : 0,
        severe: dayEntries.filter(e => e.severity === 'severe').length,
        moderate: dayEntries.filter(e => e.severity === 'moderate').length,
        mild: dayEntries.filter(e => e.severity === 'mild').length,
      };
    });
  }, [flareEntries, timeRange]);

  // Time of day distribution
  const timeOfDayData = useMemo(() => {
    const periods = [
      { name: 'Morning', start: 5, end: 12, count: 0 },
      { name: 'Afternoon', start: 12, end: 17, count: 0 },
      { name: 'Evening', start: 17, end: 21, count: 0 },
      { name: 'Night', start: 21, end: 5, count: 0 },
    ];

    flareEntries.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      if (hour >= 5 && hour < 12) periods[0].count++;
      else if (hour >= 12 && hour < 17) periods[1].count++;
      else if (hour >= 17 && hour < 21) periods[2].count++;
      else periods[3].count++;
    });

    return periods;
  }, [flareEntries]);

  // Symptom frequency
  const symptomData = useMemo(() => {
    const counts: Record<string, number> = {};
    flareEntries.forEach(e => {
      e.symptoms?.forEach(s => {
        counts[s] = (counts[s] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / flareEntries.length) * 100) }));
  }, [flareEntries]);

  // Trigger analysis
  const triggerData = useMemo(() => {
    const counts: Record<string, { count: number; severeCounts: number }> = {};
    flareEntries.forEach(e => {
      e.triggers?.forEach(t => {
        if (!counts[t]) counts[t] = { count: 0, severeCounts: 0 };
        counts[t].count++;
        if (e.severity === 'severe') counts[t].severeCounts++;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([name, data]) => ({ 
        name, 
        count: data.count, 
        severeRate: Math.round((data.severeCounts / data.count) * 100) 
      }));
  }, [flareEntries]);

  // Severity distribution for pie chart
  const severityDistribution = useMemo(() => [
    { name: 'Severe', value: metrics.severe, color: SEVERITY_COLORS.severe },
    { name: 'Moderate', value: metrics.moderate, color: SEVERITY_COLORS.moderate },
    { name: 'Mild', value: metrics.mild, color: SEVERITY_COLORS.mild },
  ].filter(d => d.value > 0), [metrics]);

  if (flareEntries.length === 0) {
    return (
      <Card className="p-6 text-center animate-fade-in">
        <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-medium mb-1">No Data Yet</h3>
        <p className="text-sm text-muted-foreground">
          Start logging flares to see detailed analytics
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Analytics Dashboard</h2>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {(['7', '30', '90'] as const).map(range => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimeRange(range)}
              className="h-7 text-xs px-3"
            >
              {range}d
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 stagger-fade-in">
        <Card className="p-3 bg-gradient-card border shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-severity-severe/10">
              <Flame className="w-4 h-4 text-severity-severe" />
            </div>
            <span className="text-xs text-muted-foreground">Total Flares</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold">{metrics.total}</span>
            <div className={`flex items-center gap-1 text-xs ${
              metrics.trend === 'decreasing' ? 'text-severity-none' : 
              metrics.trend === 'increasing' ? 'text-severity-severe' : 'text-muted-foreground'
            }`}>
              {metrics.trend === 'decreasing' ? <TrendingDown className="w-3 h-3" /> : 
               metrics.trend === 'increasing' ? <TrendingUp className="w-3 h-3" /> : null}
              {metrics.trend}
            </div>
          </div>
        </Card>

        <Card className="p-3 bg-gradient-card border shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Daily Average</span>
          </div>
          <span className="text-2xl font-bold">{metrics.avgPerDay.toFixed(1)}</span>
        </Card>

        <Card className="p-3 bg-gradient-card border shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-severity-severe/10">
              <AlertCircle className="w-4 h-4 text-severity-severe" />
            </div>
            <span className="text-xs text-muted-foreground">Severe Episodes</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold">{metrics.severe}</span>
            <span className="text-xs text-muted-foreground">
              {metrics.total > 0 ? Math.round((metrics.severe / metrics.total) * 100) : 0}%
            </span>
          </div>
        </Card>

        <Card className="p-3 bg-gradient-card border shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-severity-none/10">
              <CheckCircle className="w-4 h-4 text-severity-none" />
            </div>
            <span className="text-xs text-muted-foreground">Mild Episodes</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold">{metrics.mild}</span>
            <span className="text-xs text-muted-foreground">
              {metrics.total > 0 ? Math.round((metrics.mild / metrics.total) * 100) : 0}%
            </span>
          </div>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card className="p-4 bg-gradient-card border shadow-soft">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Flare Timeline
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={timelineData}>
            <defs>
              <linearGradient id="flareGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip 
              contentStyle={{ 
                background: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="flares" 
              stroke="hsl(var(--primary))" 
              fill="url(#flareGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Two Column Charts */}
      <div className="grid grid-cols-2 gap-3">
        {/* Severity Distribution */}
        <Card className="p-4 bg-gradient-card border shadow-soft">
          <h3 className="text-xs font-semibold mb-3">Severity Split</h3>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={severityDistribution}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={45}
                paddingAngle={3}
                dataKey="value"
              >
                {severityDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-2">
            {severityDistribution.map(d => (
              <div key={d.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="text-[10px] text-muted-foreground">{d.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Time of Day */}
        <Card className="p-4 bg-gradient-card border shadow-soft">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Time of Day
          </h3>
          <div className="space-y-2">
            {timeOfDayData.map(period => {
              const maxCount = Math.max(...timeOfDayData.map(p => p.count));
              const percentage = maxCount > 0 ? (period.count / maxCount) * 100 : 0;
              return (
                <div key={period.name}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span>{period.name}</span>
                    <span className="text-muted-foreground">{period.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Top Symptoms */}
      {symptomData.length > 0 && (
        <Card className="p-4 bg-gradient-card border shadow-soft">
          <h3 className="text-sm font-semibold mb-3">Top Symptoms</h3>
          <div className="space-y-2">
            {symptomData.slice(0, 5).map((symptom, idx) => (
              <div key={symptom.name} className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                <span className="text-xs w-24 truncate">{symptom.name}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-primary transition-all duration-700"
                    style={{ width: `${symptom.percentage}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8">{symptom.percentage}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Trigger Analysis */}
      {triggerData.length > 0 && (
        <Card className="p-4 bg-gradient-card border shadow-soft">
          <h3 className="text-sm font-semibold mb-3">Trigger Analysis</h3>
          <div className="grid grid-cols-2 gap-2">
            {triggerData.map((trigger, idx) => (
              <div 
                key={trigger.name} 
                className="p-2.5 rounded-lg bg-background/60 border border-border/50 animate-fade-in"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate">{trigger.name}</span>
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {trigger.count}×
                  </Badge>
                </div>
                {trigger.severeRate > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-2.5 h-2.5 text-severity-severe" />
                    <span className="text-[10px] text-severity-severe">{trigger.severeRate}% severe</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
