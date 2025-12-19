import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { subDays, isWithinInterval } from 'date-fns';

interface TriggerFrequencyChartProps {
  entries: FlareEntry[];
}

export const TriggerFrequencyChart = ({ entries }: TriggerFrequencyChartProps) => {
  const triggerData = useMemo(() => {
    const now = new Date();
    const last30Days = entries.filter(e => 
      isWithinInterval(new Date(e.timestamp), { start: subDays(now, 30), end: now }) &&
      e.type === 'flare'
    );

    const getSeverityScore = (s: string) => s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
    
    const triggerStats: Record<string, { count: number; severities: number[]; totalSeverity: number }> = {};
    
    last30Days.forEach(entry => {
      entry.triggers?.forEach(trigger => {
        const key = trigger.toLowerCase();
        if (!triggerStats[key]) {
          triggerStats[key] = { count: 0, severities: [], totalSeverity: 0 };
        }
        triggerStats[key].count++;
        const severity = getSeverityScore(entry.severity || 'mild');
        triggerStats[key].severities.push(severity);
        triggerStats[key].totalSeverity += severity;
      });
    });

    return Object.entries(triggerStats)
      .filter(([_, data]) => data.count >= 2)
      .map(([name, data]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: data.count,
        avgSeverity: data.totalSeverity / data.count,
        impact: Math.round((data.count * data.totalSeverity / data.count) * 10) / 10
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 8);
  }, [entries]);

  const getBarColor = (avgSeverity: number) => {
    if (avgSeverity >= 2.5) return 'hsl(var(--severity-severe))';
    if (avgSeverity >= 1.5) return 'hsl(var(--severity-moderate))';
    return 'hsl(var(--severity-mild))';
  };

  if (triggerData.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground text-center">
          Log more entries with triggers to see patterns
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-severity-moderate" />
          Trigger Impact Analysis
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Triggers ranked by frequency × severity
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart 
            data={triggerData} 
            layout="vertical"
            margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fontSize: 11 }} 
              width={75}
            />
            <Tooltip 
              contentStyle={{ 
                background: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number, name: string) => {
                if (name === 'count') return [`${value} occurrences`, 'Frequency'];
                return [value, name];
              }}
              labelFormatter={(label) => `Trigger: ${label}`}
            />
            <Bar 
              dataKey="count" 
              radius={[0, 4, 4, 0]}
            >
              {triggerData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.avgSeverity)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        <div className="flex items-center justify-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-severity-mild" />
            <span className="text-muted-foreground">Mild</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-severity-moderate" />
            <span className="text-muted-foreground">Moderate</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-severity-severe" />
            <span className="text-muted-foreground">Severe</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
