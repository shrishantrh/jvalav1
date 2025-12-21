import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, Cell
} from 'recharts';
import { 
  Heart, Activity, Moon, Flame, Wind, Thermometer, 
  TrendingUp, TrendingDown, Minus, AlertTriangle, Zap
} from 'lucide-react';
import { format, subDays, eachDayOfInterval, differenceInDays } from 'date-fns';
import { cn } from "@/lib/utils";

interface PhysiologicalAnalyticsProps {
  entries: FlareEntry[];
}

const SEVERITY_COLORS = {
  mild: 'hsl(42, 85%, 55%)',
  moderate: 'hsl(25, 85%, 58%)',
  severe: 'hsl(355, 75%, 52%)',
};

export const PhysiologicalAnalytics = ({ entries }: PhysiologicalAnalyticsProps) => {
  const flares = useMemo(() => 
    entries.filter(e => e.type === 'flare' && differenceInDays(new Date(), e.timestamp) <= 30),
    [entries]
  );

  // Extract all physiological data points
  const physioData = useMemo(() => {
    const data: {
      hrv: { date: Date; value: number; severity: string }[];
      hr: { date: Date; value: number; severity: string }[];
      spo2: { date: Date; value: number; severity: string }[];
      breathing: { date: Date; value: number; severity: string }[];
      skinTemp: { date: Date; value: number; severity: string }[];
      sleep: { date: Date; hours: number; efficiency?: number; severity: string }[];
      steps: { date: Date; value: number; severity: string }[];
      azm: { date: Date; value: number; severity: string }[];
    } = {
      hrv: [],
      hr: [],
      spo2: [],
      breathing: [],
      skinTemp: [],
      sleep: [],
      steps: [],
      azm: [],
    };

    flares.forEach(f => {
      const p = f.physiologicalData;
      if (!p) return;

      const hrvVal = p.hrv_rmssd || p.hrvRmssd || p.heart_rate_variability || p.heartRateVariability;
      if (hrvVal) data.hrv.push({ date: f.timestamp, value: hrvVal as number, severity: f.severity || 'mild' });

      const hrVal = p.heart_rate || p.heartRate;
      if (hrVal) data.hr.push({ date: f.timestamp, value: hrVal as number, severity: f.severity || 'mild' });

      if (p.spo2) data.spo2.push({ date: f.timestamp, value: p.spo2 as number, severity: f.severity || 'mild' });

      const breathVal = p.breathing_rate || p.breathingRate;
      if (breathVal) data.breathing.push({ date: f.timestamp, value: breathVal as number, severity: f.severity || 'mild' });

      const tempVal = p.skin_temperature || p.skinTemperature;
      if (tempVal) data.skinTemp.push({ date: f.timestamp, value: tempVal as number, severity: f.severity || 'mild' });

      const sleepVal = p.sleep_hours || p.sleepHours;
      const sleepEff = p.sleep_efficiency || p.sleepEfficiency;
      if (sleepVal) data.sleep.push({ 
        date: f.timestamp, 
        hours: sleepVal as number, 
        efficiency: sleepEff as number | undefined,
        severity: f.severity || 'mild' 
      });

      if (p.steps) data.steps.push({ date: f.timestamp, value: p.steps as number, severity: f.severity || 'mild' });

      const azmVal = p.active_zone_minutes_total || p.activeZoneMinutesTotal;
      if (azmVal) data.azm.push({ date: f.timestamp, value: azmVal as number, severity: f.severity || 'mild' });
    });

    return data;
  }, [flares]);

  // Calculate insights
  const insights = useMemo(() => {
    const results: { metric: string; insight: string; icon: React.ReactNode; type: 'warning' | 'info' | 'good' }[] = [];

    // HRV insights
    if (physioData.hrv.length >= 3) {
      const avgHRV = physioData.hrv.reduce((a, b) => a + b.value, 0) / physioData.hrv.length;
      const severeHRV = physioData.hrv.filter(h => h.severity === 'severe');
      const avgSevereHRV = severeHRV.length > 0 ? severeHRV.reduce((a, b) => a + b.value, 0) / severeHRV.length : null;
      
      if (avgSevereHRV && avgSevereHRV < avgHRV * 0.8) {
        results.push({
          metric: 'HRV',
          insight: `HRV drops ${Math.round((1 - avgSevereHRV / avgHRV) * 100)}% during severe flares`,
          icon: <Heart className="w-4 h-4" />,
          type: 'warning'
        });
      }
    }

    // Sleep insights
    if (physioData.sleep.length >= 3) {
      const avgSleep = physioData.sleep.reduce((a, b) => a + b.hours, 0) / physioData.sleep.length;
      const lowSleepFlares = physioData.sleep.filter(s => s.hours < 6);
      if (lowSleepFlares.length > physioData.sleep.length * 0.3) {
        results.push({
          metric: 'Sleep',
          insight: `${Math.round(lowSleepFlares.length / physioData.sleep.length * 100)}% of flares occur after <6hrs sleep`,
          icon: <Moon className="w-4 h-4" />,
          type: 'warning'
        });
      }
    }

    // HR insights
    if (physioData.hr.length >= 3) {
      const severeHR = physioData.hr.filter(h => h.severity === 'severe');
      const mildHR = physioData.hr.filter(h => h.severity === 'mild');
      if (severeHR.length && mildHR.length) {
        const avgSevere = severeHR.reduce((a, b) => a + b.value, 0) / severeHR.length;
        const avgMild = mildHR.reduce((a, b) => a + b.value, 0) / mildHR.length;
        if (avgSevere > avgMild * 1.1) {
          results.push({
            metric: 'Heart Rate',
            insight: `HR averages ${Math.round(avgSevere - avgMild)} bpm higher during severe flares`,
            icon: <Activity className="w-4 h-4" />,
            type: 'info'
          });
        }
      }
    }

    // Steps insights
    if (physioData.steps.length >= 3) {
      const avgSteps = physioData.steps.reduce((a, b) => a + b.value, 0) / physioData.steps.length;
      const lowActivityDays = physioData.steps.filter(s => s.value < 3000);
      if (lowActivityDays.length > physioData.steps.length * 0.4) {
        results.push({
          metric: 'Activity',
          insight: `${Math.round(lowActivityDays.length / physioData.steps.length * 100)}% of flare days have low activity (<3k steps)`,
          icon: <Flame className="w-4 h-4" />,
          type: 'info'
        });
      }
    }

    return results;
  }, [physioData]);

  // Prepare chart data
  const hrvChartData = useMemo(() => {
    return physioData.hrv.map(d => ({
      date: format(d.date, 'MMM d'),
      value: d.value,
      severity: d.severity
    })).slice(-14);
  }, [physioData.hrv]);

  const sleepChartData = useMemo(() => {
    return physioData.sleep.map(d => ({
      date: format(d.date, 'MMM d'),
      hours: d.hours,
      efficiency: d.efficiency,
      severity: d.severity
    })).slice(-14);
  }, [physioData.sleep]);

  const hrVsSeverity = useMemo(() => {
    return physioData.hr.map(d => ({
      hr: d.value,
      severity: d.severity === 'severe' ? 3 : d.severity === 'moderate' ? 2 : 1,
      severityLabel: d.severity
    }));
  }, [physioData.hr]);

  const hasData = Object.values(physioData).some(arr => arr.length > 0);

  if (!hasData) {
    return (
      <Card className="p-6 text-center bg-gradient-card border-0">
        <Activity className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-medium mb-1">No Physiological Data Yet</h3>
        <p className="text-sm text-muted-foreground">
          Connect your Fitbit or other wearable to see health analytics
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Insights */}
      {insights.length > 0 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Physiological Insights
          </h3>
          <div className="space-y-2">
            {insights.map((insight, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "p-3 rounded-lg flex items-start gap-3",
                  insight.type === 'warning' ? 'bg-amber-500/10' : 
                  insight.type === 'good' ? 'bg-green-500/10' : 'bg-primary/10'
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg",
                  insight.type === 'warning' ? 'bg-amber-500/20 text-amber-600' : 
                  insight.type === 'good' ? 'bg-green-500/20 text-green-600' : 'bg-primary/20 text-primary'
                )}>
                  {insight.icon}
                </div>
                <div>
                  <span className="text-xs font-medium">{insight.metric}</span>
                  <p className="text-sm text-muted-foreground">{insight.insight}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        {physioData.hrv.length > 0 && (
          <Card className="p-3 bg-gradient-card border-0">
            <div className="flex items-center gap-1 mb-1">
              <Heart className="w-3 h-3 text-rose-500" />
              <span className="text-[10px] text-muted-foreground">Avg HRV</span>
            </div>
            <span className="text-lg font-bold">
              {Math.round(physioData.hrv.reduce((a, b) => a + b.value, 0) / physioData.hrv.length)}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">ms</span>
            </span>
          </Card>
        )}
        {physioData.hr.length > 0 && (
          <Card className="p-3 bg-gradient-card border-0">
            <div className="flex items-center gap-1 mb-1">
              <Activity className="w-3 h-3 text-red-500" />
              <span className="text-[10px] text-muted-foreground">Avg HR</span>
            </div>
            <span className="text-lg font-bold">
              {Math.round(physioData.hr.reduce((a, b) => a + b.value, 0) / physioData.hr.length)}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">bpm</span>
            </span>
          </Card>
        )}
        {physioData.sleep.length > 0 && (
          <Card className="p-3 bg-gradient-card border-0">
            <div className="flex items-center gap-1 mb-1">
              <Moon className="w-3 h-3 text-indigo-500" />
              <span className="text-[10px] text-muted-foreground">Avg Sleep</span>
            </div>
            <span className="text-lg font-bold">
              {(physioData.sleep.reduce((a, b) => a + b.hours, 0) / physioData.sleep.length).toFixed(1)}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">hrs</span>
            </span>
          </Card>
        )}
      </div>

      {/* HRV Trend Chart */}
      {hrvChartData.length >= 3 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" />
            HRV During Flares
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={hrvChartData}>
              <defs>
                <linearGradient id="hrvGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '11px'
                }}
                formatter={(value: number, name: string) => [`${value} ms`, 'HRV']}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                fill="url(#hrvGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Sleep Pattern Chart */}
      {sleepChartData.length >= 3 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Moon className="w-4 h-4 text-indigo-500" />
            Sleep Before Flares
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={sleepChartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 10]} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '11px'
                }}
                formatter={(value: number, name: string) => [
                  name === 'hours' ? `${value.toFixed(1)} hrs` : `${value}%`,
                  name === 'hours' ? 'Sleep' : 'Efficiency'
                ]}
              />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {sleepChartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.hours < 6 ? SEVERITY_COLORS.severe : 
                          entry.hours < 7 ? SEVERITY_COLORS.moderate : 
                          'hsl(var(--primary))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Heart Rate vs Severity Scatter */}
      {hrVsSeverity.length >= 5 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-500" />
            Heart Rate by Severity
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="hr" 
                tick={{ fontSize: 9 }} 
                name="Heart Rate" 
                unit=" bpm"
                domain={['auto', 'auto']}
              />
              <YAxis 
                dataKey="severity" 
                tick={{ fontSize: 9 }} 
                name="Severity"
                domain={[0.5, 3.5]}
                ticks={[1, 2, 3]}
                tickFormatter={(v) => v === 1 ? 'Mild' : v === 2 ? 'Mod' : 'Sev'}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '11px'
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'hr') return [`${value} bpm`, 'Heart Rate'];
                  return [value === 1 ? 'Mild' : value === 2 ? 'Moderate' : 'Severe', 'Severity'];
                }}
              />
              <Scatter 
                data={hrVsSeverity} 
                fill="hsl(var(--primary))"
              >
                {hrVsSeverity.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={SEVERITY_COLORS[entry.severityLabel as keyof typeof SEVERITY_COLORS] || 'hsl(var(--primary))'}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Additional Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {physioData.spo2.length > 0 && (
          <Card className="p-3 bg-gradient-card border-0">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium">SpO2</span>
            </div>
            <span className="text-xl font-bold">
              {(physioData.spo2.reduce((a, b) => a + b.value, 0) / physioData.spo2.length).toFixed(1)}%
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              Avg during flares ({physioData.spo2.length} readings)
            </p>
          </Card>
        )}
        {physioData.breathing.length > 0 && (
          <Card className="p-3 bg-gradient-card border-0">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-4 h-4 text-cyan-500" />
              <span className="text-xs font-medium">Breathing Rate</span>
            </div>
            <span className="text-xl font-bold">
              {(physioData.breathing.reduce((a, b) => a + b.value, 0) / physioData.breathing.length).toFixed(1)}
              <span className="text-xs font-normal ml-1">br/min</span>
            </span>
          </Card>
        )}
        {physioData.skinTemp.length > 0 && (
          <Card className="p-3 bg-gradient-card border-0">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium">Skin Temp Δ</span>
            </div>
            <span className="text-xl font-bold">
              {physioData.skinTemp.reduce((a, b) => a + b.value, 0) / physioData.skinTemp.length > 0 ? '+' : ''}
              {(physioData.skinTemp.reduce((a, b) => a + b.value, 0) / physioData.skinTemp.length).toFixed(2)}°
            </span>
          </Card>
        )}
        {physioData.azm.length > 0 && (
          <Card className="p-3 bg-gradient-card border-0">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-medium">Active Zone Min</span>
            </div>
            <span className="text-xl font-bold">
              {Math.round(physioData.azm.reduce((a, b) => a + b.value, 0) / physioData.azm.length)}
              <span className="text-xs font-normal ml-1">min</span>
            </span>
          </Card>
        )}
      </div>
    </div>
  );
};
