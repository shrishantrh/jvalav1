import { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { InsightsCharts } from "@/components/insights/InsightsCharts";
import { EnhancedMedicalExport } from "@/components/insights/EnhancedMedicalExport";
import { AIInsightsPanel } from "@/components/insights/AIInsightsPanel";
import { MedicationTracker } from "@/components/medication/MedicationTracker";
import { CommunityHotspots } from "@/components/insights/CommunityHotspots";
import { 
  TrendingUp, 
  TrendingDown,
  Minus,
  BarChart3,
  Download,
  Pill,
  Brain,
  Target,
  Clock,
  Sparkles,
  MapPin,
  Calendar,
  Flame,
  Activity
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { isWithinInterval, subDays, differenceInDays, format, startOfMonth, eachDayOfInterval } from 'date-fns';
import { useAuth } from "@/hooks/useAuth";

interface MedicationLog {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  takenAt: Date;
}

interface RevampedInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
  medicationLogs?: MedicationLog[];
  onLogMedication?: (log: Omit<MedicationLog, 'id' | 'takenAt'>) => void;
  userMedications?: string[];
  onStartProtocol?: (recommendation: string) => void;
}

export const RevampedInsights = ({ 
  entries, 
  userConditions = [], 
  medicationLogs = [], 
  onLogMedication, 
  userMedications = [],
  onStartProtocol
}: RevampedInsightsProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('ai');

  const analytics = useMemo(() => {
    const now = new Date();
    const last7Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 7), end: now })
    );
    const last30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 30), end: now })
    );

    const flares7d = last7Days.filter(e => e.type === 'flare');
    const flares30d = last30Days.filter(e => e.type === 'flare');

    // Trend calculation
    const weeklyAvgFlares = flares30d.length / 4;
    const frequencyChange = flares7d.length - weeklyAvgFlares;
    
    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (frequencyChange > 1.5) trend = 'worsening';
    else if (frequencyChange < -1.5) trend = 'improving';

    // Top triggers
    const triggerCounts: Record<string, number> = {};
    flares30d.forEach(f => {
      f.triggers?.forEach(t => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });
    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // Peak time
    const timeSlots: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    flares30d.forEach(f => {
      const hour = f.timestamp.getHours();
      if (hour >= 5 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
      else if (hour >= 17 && hour < 21) timeSlots.evening++;
      else timeSlots.night++;
    });
    const peakTime = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    // Days since last flare
    const lastFlare = entries.find(e => e.type === 'flare');
    const daysSinceFlare = lastFlare ? differenceInDays(now, lastFlare.timestamp) : null;

    // Severity breakdown
    const severeCt = flares7d.filter(f => f.severity === 'severe').length;
    const moderateCt = flares7d.filter(f => f.severity === 'moderate').length;
    const mildCt = flares7d.filter(f => f.severity === 'mild').length;

    // Month logging rate
    const monthStart = startOfMonth(now);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: now });
    const daysLogged = new Set(entries.map(e => format(e.timestamp, 'yyyy-MM-dd')));
    const monthLoggingRate = Math.round(
      (daysInMonth.filter(d => daysLogged.has(format(d, 'yyyy-MM-dd'))).length / daysInMonth.length) * 100
    );

    return {
      flares7d: flares7d.length,
      flares30d: flares30d.length,
      trend,
      topTriggers,
      peakTime,
      daysSinceFlare,
      severeCt,
      moderateCt,
      mildCt,
      monthLoggingRate,
    };
  }, [entries]);

  const getTrendIcon = () => {
    switch (analytics.trend) {
      case 'improving': return <TrendingDown className="w-3.5 h-3.5 text-severity-none" />;
      case 'worsening': return <TrendingUp className="w-3.5 h-3.5 text-severity-severe" />;
      default: return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (analytics.trend) {
      case 'improving': return 'text-severity-none bg-severity-none/10';
      case 'worsening': return 'text-severity-severe bg-severity-severe/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  if (entries.length === 0) {
    return (
      <Card className="p-6 text-center bg-gradient-card border-0 shadow-soft">
        <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-base font-medium mb-1">No data yet</h3>
        <p className="text-xs text-muted-foreground">Start logging to see your insights</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="p-2.5 bg-gradient-card border-0 shadow-soft text-center">
          <Flame className="w-3.5 h-3.5 mx-auto text-severity-severe mb-1" />
          <p className="text-lg font-bold leading-none">{analytics.flares7d}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">This Week</p>
        </Card>

        <Card className={cn("p-2.5 border-0 shadow-soft text-center", getTrendColor())}>
          <div className="flex justify-center mb-1">{getTrendIcon()}</div>
          <p className="text-xs font-semibold capitalize leading-none">{analytics.trend}</p>
          <p className="text-[9px] opacity-70 mt-0.5">Trend</p>
        </Card>

        <Card className="p-2.5 bg-gradient-card border-0 shadow-soft text-center">
          <Clock className="w-3.5 h-3.5 mx-auto text-primary mb-1" />
          <p className="text-xs font-semibold capitalize leading-none">{analytics.peakTime}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">Peak</p>
        </Card>

        <Card className="p-2.5 bg-gradient-card border-0 shadow-soft text-center">
          <Calendar className="w-3.5 h-3.5 mx-auto text-severity-none mb-1" />
          <p className="text-lg font-bold leading-none">
            {analytics.daysSinceFlare !== null ? analytics.daysSinceFlare : '—'}
          </p>
          <p className="text-[9px] text-muted-foreground mt-0.5">Days Clear</p>
        </Card>
      </div>

      {/* Severity Bar */}
      {analytics.flares7d > 0 && (
        <Card className="p-3 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium flex items-center gap-1">
              <Activity className="w-3 h-3 text-primary" />
              Week Severity
            </span>
            <span className="text-[9px] text-muted-foreground">{analytics.monthLoggingRate}% logged</span>
          </div>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
            {analytics.severeCt > 0 && (
              <div className="bg-severity-severe h-full" style={{ width: `${(analytics.severeCt / analytics.flares7d) * 100}%` }} />
            )}
            {analytics.moderateCt > 0 && (
              <div className="bg-severity-moderate h-full" style={{ width: `${(analytics.moderateCt / analytics.flares7d) * 100}%` }} />
            )}
            {analytics.mildCt > 0 && (
              <div className="bg-severity-mild h-full" style={{ width: `${(analytics.mildCt / analytics.flares7d) * 100}%` }} />
            )}
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-severity-severe" /> {analytics.severeCt}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-severity-moderate" /> {analytics.moderateCt}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-severity-mild" /> {analytics.mildCt}
            </span>
          </div>
        </Card>
      )}

      {/* Top Triggers Compact */}
      {analytics.topTriggers.length > 0 && (
        <Card className="p-3 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-medium">Top Triggers</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analytics.topTriggers.map((t, i) => (
              <Badge 
                key={t.name} 
                variant="outline" 
                className={cn("text-[10px] py-0.5", i === 0 && "bg-severity-severe/10 border-severity-severe/30 text-severity-severe")}
              >
                {t.name} <span className="ml-1 opacity-60">×{t.count}</span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-9">
          <TabsTrigger value="ai" className="text-[10px] gap-1">
            <Brain className="w-3 h-3" />
            AI
          </TabsTrigger>
          <TabsTrigger value="charts" className="text-[10px] gap-1">
            <BarChart3 className="w-3 h-3" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="local" className="text-[10px] gap-1">
            <MapPin className="w-3 h-3" />
            Local
          </TabsTrigger>
          <TabsTrigger value="meds" className="text-[10px] gap-1">
            <Pill className="w-3 h-3" />
            Meds
          </TabsTrigger>
          <TabsTrigger value="export" className="text-[10px] gap-1">
            <Download className="w-3 h-3" />
            Export
          </TabsTrigger>
        </TabsList>

        <div className="mt-3">
          <TabsContent value="ai" className="mt-0">
            <AIInsightsPanel 
              entries={entries} 
              userConditions={userConditions} 
              onStartProtocol={onStartProtocol}
            />
          </TabsContent>

          <TabsContent value="charts" className="mt-0">
            <InsightsCharts entries={entries} />
          </TabsContent>

          <TabsContent value="local" className="mt-0">
            <CommunityHotspots entries={entries} userConditions={userConditions} />
          </TabsContent>

          <TabsContent value="meds" className="mt-0">
            {onLogMedication ? (
              <MedicationTracker 
                logs={medicationLogs}
                onLogMedication={onLogMedication}
                userMedications={userMedications}
              />
            ) : (
              <Card className="p-4 text-center">
                <Pill className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Medication tracking coming soon</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="export" className="mt-0">
            <EnhancedMedicalExport entries={entries} conditions={userConditions} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
