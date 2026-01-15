import { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { InsightsCharts } from "@/components/insights/InsightsCharts";
import { EnhancedMedicalExport } from "@/components/insights/EnhancedMedicalExport";
import { AIInsightsPanel } from "@/components/insights/AIInsightsPanel";
import { MedicationTracker } from "@/components/medication/MedicationTracker";
import { EHRIntegration } from "@/components/ehr/EHRIntegration";
import { CommunityHotspots } from "@/components/insights/CommunityHotspots";
import { 
  TrendingUp, 
  TrendingDown,
  Minus,
  BarChart3,
  Download,
  Pill,
  Hospital,
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
import { isWithinInterval, subDays, differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
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
}

export const RevampedInsights = ({ 
  entries, 
  userConditions = [], 
  medicationLogs = [], 
  onLogMedication, 
  userMedications = [] 
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

    // Top symptoms
    const symptomCounts: Record<string, number> = {};
    flares30d.forEach(f => {
      f.symptoms?.forEach(s => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    });
    const topSymptoms = Object.entries(symptomCounts)
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

    // Month logging streak
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: now });
    const daysLogged = new Set(
      entries.map(e => format(e.timestamp, 'yyyy-MM-dd'))
    );
    const monthLoggingRate = Math.round(
      (daysInMonth.filter(d => daysLogged.has(format(d, 'yyyy-MM-dd'))).length / daysInMonth.length) * 100
    );

    return {
      flares7d: flares7d.length,
      flares30d: flares30d.length,
      trend,
      topTriggers,
      topSymptoms,
      peakTime,
      daysSinceFlare,
      totalEntries: entries.length,
      severeCt,
      moderateCt,
      mildCt,
      monthLoggingRate,
    };
  }, [entries]);

  const getTrendIcon = () => {
    switch (analytics.trend) {
      case 'improving': return <TrendingDown className="w-4 h-4 text-severity-none" />;
      case 'worsening': return <TrendingUp className="w-4 h-4 text-severity-severe" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
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
      <Card className="p-8 text-center bg-gradient-card border-0 shadow-soft">
        <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No data yet</h3>
        <p className="text-sm text-muted-foreground">
          Start logging to see your insights
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="p-3 bg-gradient-card border-0 shadow-soft text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame className="w-3.5 h-3.5 text-severity-severe" />
          </div>
          <p className="text-xl font-bold">{analytics.flares7d}</p>
          <p className="text-[10px] text-muted-foreground">This Week</p>
        </Card>

        <Card className={cn("p-3 border-0 shadow-soft text-center", getTrendColor())}>
          <div className="flex items-center justify-center gap-1 mb-1">
            {getTrendIcon()}
          </div>
          <p className="text-sm font-semibold capitalize">{analytics.trend}</p>
          <p className="text-[10px] opacity-70">Trend</p>
        </Card>

        <Card className="p-3 bg-gradient-card border-0 shadow-soft text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold capitalize">{analytics.peakTime}</p>
          <p className="text-[10px] text-muted-foreground">Peak Time</p>
        </Card>

        <Card className="p-3 bg-gradient-card border-0 shadow-soft text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Calendar className="w-3.5 h-3.5 text-severity-none" />
          </div>
          <p className="text-xl font-bold">
            {analytics.daysSinceFlare !== null ? analytics.daysSinceFlare : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">Days Clear</p>
        </Card>
      </div>

      {/* Severity Breakdown Mini Chart */}
      {analytics.flares7d > 0 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              This Week's Severity
            </h3>
            <Badge variant="outline" className="text-[10px]">
              {analytics.monthLoggingRate}% logged this month
            </Badge>
          </div>
          <div className="flex gap-2 h-3 rounded-full overflow-hidden bg-muted">
            {analytics.severeCt > 0 && (
              <div 
                className="bg-severity-severe h-full transition-all"
                style={{ width: `${(analytics.severeCt / analytics.flares7d) * 100}%` }}
              />
            )}
            {analytics.moderateCt > 0 && (
              <div 
                className="bg-severity-moderate h-full transition-all"
                style={{ width: `${(analytics.moderateCt / analytics.flares7d) * 100}%` }}
              />
            )}
            {analytics.mildCt > 0 && (
              <div 
                className="bg-severity-mild h-full transition-all"
                style={{ width: `${(analytics.mildCt / analytics.flares7d) * 100}%` }}
              />
            )}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-severity-severe" />
              Severe ({analytics.severeCt})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-severity-moderate" />
              Moderate ({analytics.moderateCt})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-severity-mild" />
              Mild ({analytics.mildCt})
            </span>
          </div>
        </Card>
      )}

      {/* Top Patterns - Compact */}
      {(analytics.topTriggers.length > 0 || analytics.topSymptoms.length > 0) && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Your Patterns (30 days)
          </h3>
          <div className="space-y-3">
            {analytics.topTriggers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Top Triggers</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topTriggers.map((t, i) => (
                    <Badge 
                      key={t.name} 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        i === 0 && "bg-severity-severe/10 border-severity-severe/30 text-severity-severe"
                      )}
                    >
                      {t.name}
                      <span className="ml-1 opacity-60">×{t.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {analytics.topSymptoms.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Common Symptoms</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topSymptoms.map((s, i) => (
                    <Badge 
                      key={s.name} 
                      variant="secondary" 
                      className={cn(
                        "text-xs",
                        i === 0 && "bg-primary/10 text-primary"
                      )}
                    >
                      {s.name}
                      <span className="ml-1 opacity-60">×{s.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tabbed Content - AI First */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-10">
          <TabsTrigger value="ai" className="text-xs gap-1">
            <Brain className="w-3 h-3" />
            AI
          </TabsTrigger>
          <TabsTrigger value="charts" className="text-xs gap-1">
            <BarChart3 className="w-3 h-3" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="local" className="text-xs gap-1">
            <MapPin className="w-3 h-3" />
            Local
          </TabsTrigger>
          <TabsTrigger value="meds" className="text-xs gap-1">
            <Pill className="w-3 h-3" />
            Meds
          </TabsTrigger>
          <TabsTrigger value="export" className="text-xs gap-1">
            <Download className="w-3 h-3" />
            Export
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="ai" className="mt-0">
            <AIInsightsPanel entries={entries} userConditions={userConditions} />
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
              <Card className="p-6 text-center">
                <Pill className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Medication tracking coming soon</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="export" className="mt-0">
            <EnhancedMedicalExport 
              entries={entries}
              conditions={userConditions}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
