import { useMemo, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { InsightsCharts } from "@/components/insights/InsightsCharts";
import { EnhancedMedicalExport } from "@/components/insights/EnhancedMedicalExport";
import { SmartPredictions } from "@/components/insights/SmartPredictions";
import { MedicationTracker } from "@/components/medication/MedicationTracker";
import { EHRIntegration } from "@/components/ehr/EHRIntegration";
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
  Sparkles
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, subDays, isWithinInterval, differenceInDays } from 'date-fns';
import { useAuth } from "@/hooks/useAuth";

interface MedicationLog {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  takenAt: Date;
}

interface StreamlinedInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
  medicationLogs?: MedicationLog[];
  onLogMedication?: (log: Omit<MedicationLog, 'id' | 'takenAt'>) => void;
  userMedications?: string[];
}

export const StreamlinedInsights = ({ 
  entries, 
  userConditions = [], 
  medicationLogs = [], 
  onLogMedication, 
  userMedications = [] 
}: StreamlinedInsightsProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const analytics = useMemo(() => {
    const now = new Date();
    const last7Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 7), end: now })
    );
    const last30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 30), end: now })
    );
    const prev30Days = entries.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 60), end: subDays(now, 30) })
    );

    const flares7d = last7Days.filter(e => e.type === 'flare');
    const flares30d = last30Days.filter(e => e.type === 'flare');
    const flaresPrev30d = prev30Days.filter(e => e.type === 'flare');

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

    return {
      flares7d: flares7d.length,
      flares30d: flares30d.length,
      trend,
      topTriggers,
      topSymptoms,
      peakTime,
      daysSinceFlare,
      totalEntries: entries.length,
    };
  }, [entries]);

  const getTrendIcon = () => {
    switch (analytics.trend) {
      case 'improving': return <TrendingDown className="w-4 h-4 text-severity-none" />;
      case 'worsening': return <TrendingUp className="w-4 h-4 text-severity-severe" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
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
      {/* Quick Stats - Clean 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">This Week</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{analytics.flares7d}</span>
            <span className="text-xs text-muted-foreground">flares</span>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            {getTrendIcon()}
            <span className="text-xs text-muted-foreground">Trend</span>
          </div>
          <div className="text-lg font-medium capitalize">{analytics.trend}</div>
        </Card>

        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Peak Time</span>
          </div>
          <div className="text-lg font-medium capitalize">{analytics.peakTime}</div>
        </Card>

        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Days Clear</span>
          </div>
          <div className="text-lg font-medium">
            {analytics.daysSinceFlare !== null ? `${analytics.daysSinceFlare}d` : '—'}
          </div>
        </Card>
      </div>

      {/* Top Patterns - Compact */}
      {(analytics.topTriggers.length > 0 || analytics.topSymptoms.length > 0) && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Your Patterns
          </h3>
          <div className="space-y-3">
            {analytics.topTriggers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Top Triggers</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topTriggers.map(t => (
                    <Badge key={t.name} variant="outline" className="text-xs">
                      {t.name}
                      <span className="ml-1 text-muted-foreground">×{t.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {analytics.topSymptoms.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Common Symptoms</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topSymptoms.map(s => (
                    <Badge key={s.name} variant="secondary" className="text-xs">
                      {s.name}
                      <span className="ml-1 text-muted-foreground">×{s.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* AI Predictions */}
      <SmartPredictions 
        entries={entries} 
        userConditions={userConditions} 
      />

      {/* Tabbed Content - Simplified to 4 tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-10">
          <TabsTrigger value="overview" className="text-xs gap-1">
            <BarChart3 className="w-3 h-3" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="meds" className="text-xs gap-1">
            <Pill className="w-3 h-3" />
            Meds
          </TabsTrigger>
          <TabsTrigger value="records" className="text-xs gap-1">
            <Hospital className="w-3 h-3" />
            Records
          </TabsTrigger>
          <TabsTrigger value="export" className="text-xs gap-1">
            <Download className="w-3 h-3" />
            Export
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="overview" className="mt-0">
            <InsightsCharts entries={entries} />
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

          <TabsContent value="records" className="mt-0">
            {user && <EHRIntegration userId={user.id} />}
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
