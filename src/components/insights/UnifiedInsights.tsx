import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { InsightsCharts } from "@/components/insights/InsightsCharts";
import { EnhancedMedicalExport } from "@/components/insights/EnhancedMedicalExport";
import { LimitlessAIChat } from "@/components/ai/LimitlessAIChat";
import { MedicationTracker } from "@/components/medication/MedicationTracker";
import { 
  Brain, 
  BarChart3, 
  Download, 
  Pill,
  Sparkles,
  TrendingUp,
  Clock,
  Target,
  TrendingDown,
  Minus
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, subDays, isWithinInterval, differenceInDays } from 'date-fns';

interface MedicationLog {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  takenAt: Date;
}

interface UnifiedInsightsProps {
  entries: FlareEntry[];
  userId: string;
  userConditions?: string[];
  medicationLogs?: MedicationLog[];
  onLogMedication?: (log: Omit<MedicationLog, 'id' | 'takenAt'>) => void;
  userMedications?: string[];
}

export const UnifiedInsights = ({ 
  entries, 
  userId,
  userConditions = [], 
  medicationLogs = [], 
  onLogMedication, 
  userMedications = [] 
}: UnifiedInsightsProps) => {
  const [activeTab, setActiveTab] = useState("ai");

  // Calculate quick stats
  const now = new Date();
  const last7Days = entries.filter(e => 
    isWithinInterval(e.timestamp, { start: subDays(now, 7), end: now })
  );
  const flares7d = last7Days.filter(e => e.type === 'flare');
  const prev7Days = entries.filter(e => 
    isWithinInterval(e.timestamp, { start: subDays(now, 14), end: subDays(now, 7) })
  );
  const flaresPrev = prev7Days.filter(e => e.type === 'flare');
  
  const frequencyChange = flares7d.length - flaresPrev.length;
  let trend: 'improving' | 'worsening' | 'stable' = 'stable';
  if (frequencyChange > 1) trend = 'worsening';
  else if (frequencyChange < -1) trend = 'improving';

  // Days since last flare
  const sortedFlares = entries
    .filter(e => e.type === 'flare')
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const daysSinceLastFlare = sortedFlares.length > 0 
    ? differenceInDays(now, sortedFlares[0].timestamp)
    : null;

  // Peak time
  const timeSlots: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  flares7d.forEach(f => {
    const hour = f.timestamp.getHours();
    if (hour >= 6 && hour < 12) timeSlots.morning++;
    else if (hour >= 12 && hour < 18) timeSlots.afternoon++;
    else if (hour >= 18 && hour < 22) timeSlots.evening++;
    else timeSlots.night++;
  });
  const peakTime = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0];

  const getTrendIcon = () => {
    if (trend === 'improving') return <TrendingDown className="w-4 h-4 text-severity-none" />;
    if (trend === 'worsening') return <TrendingUp className="w-4 h-4 text-severity-severe" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">This Week</span>
            {getTrendIcon()}
          </div>
          <p className="text-2xl font-bold">{flares7d.length}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{trend}</p>
        </Card>
        
        <Card className="p-3 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Peak Time</span>
            <Clock className="w-3 h-3 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold capitalize">{peakTime[0]}</p>
          <p className="text-[10px] text-muted-foreground">{peakTime[1]} flares</p>
        </Card>

        <Card className={cn(
          "p-3 border-0 shadow-soft",
          daysSinceLastFlare && daysSinceLastFlare >= 2 
            ? "bg-severity-none/10" 
            : "bg-gradient-card"
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Streak</span>
            <Target className="w-3 h-3 text-severity-none" />
          </div>
          <p className="text-2xl font-bold">{daysSinceLastFlare ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">days clear</p>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-10">
          <TabsTrigger value="ai" className="text-xs gap-1">
            <Sparkles className="w-3 h-3" />
            AI
          </TabsTrigger>
          <TabsTrigger value="charts" className="text-xs gap-1">
            <BarChart3 className="w-3 h-3" />
            Charts
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

        <TabsContent value="ai" className="mt-3">
          <LimitlessAIChat userId={userId} />
        </TabsContent>

        <TabsContent value="charts" className="mt-3">
          <InsightsCharts entries={entries} />
        </TabsContent>

        <TabsContent value="meds" className="mt-3">
          <MedicationTracker 
            logs={medicationLogs}
            onLogMedication={onLogMedication}
            userMedications={userMedications}
          />
        </TabsContent>

        <TabsContent value="export" className="mt-3">
          <EnhancedMedicalExport 
            entries={entries}
            conditions={userConditions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
