import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { 
  CalendarDays, 
  Droplets, 
  AlertCircle, 
  TrendingUp,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, addDays, startOfDay } from "date-fns";

interface CycleData {
  lastPeriodStart: Date | null;
  cycleLength: number;
  periodLength: number;
  currentDay: number | null;
  phase: "menstrual" | "follicular" | "ovulation" | "luteal" | null;
  predictedFlareRisk: "low" | "moderate" | "high" | null;
  historicalPatterns: {
    highRiskDays: number[];
    avgSeverityByDay: Record<number, number>;
  };
}

interface CycleTrackerProps {
  userId: string;
  onCycleDataUpdate?: (day: number | null) => void;
}

export const CycleTracker = ({ userId, onCycleDataUpdate }: CycleTrackerProps) => {
  const [cycleData, setCycleData] = useState<CycleData>({
    lastPeriodStart: null,
    cycleLength: 28,
    periodLength: 5,
    currentDay: null,
    phase: null,
    predictedFlareRisk: null,
    historicalPatterns: { highRiskDays: [], avgSeverityByDay: {} },
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCycleData();
  }, [userId]);

  useEffect(() => {
    if (cycleData.currentDay !== null) {
      onCycleDataUpdate?.(cycleData.currentDay);
    }
  }, [cycleData.currentDay, onCycleDataUpdate]);

  const loadCycleData = async () => {
    try {
      // Load from profile metadata
      const { data: profile } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", userId)
        .single();

      const cycleMeta = (profile?.metadata as any)?.cycle || {};
      
      // Load flare patterns by cycle day
      const { data: entries } = await supabase
        .from("flare_entries")
        .select("timestamp, severity, physiological_data")
        .eq("user_id", userId)
        .eq("entry_type", "flare");

      // Analyze historical patterns
      const dayPatterns: Record<number, { count: number; severities: number[] }> = {};
      
      (entries || []).forEach((e: any) => {
        const cycleDay = e.physiological_data?.menstrual_day;
        if (cycleDay && cycleDay >= 1 && cycleDay <= 35) {
          if (!dayPatterns[cycleDay]) {
            dayPatterns[cycleDay] = { count: 0, severities: [] };
          }
          dayPatterns[cycleDay].count++;
          const sev = e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3;
          dayPatterns[cycleDay].severities.push(sev);
        }
      });

      // Find high-risk days (above average flare count)
      const avgCount = Object.values(dayPatterns).reduce((a, b) => a + b.count, 0) / 
                       Math.max(Object.keys(dayPatterns).length, 1);
      const highRiskDays = Object.entries(dayPatterns)
        .filter(([_, data]) => data.count > avgCount * 1.3)
        .map(([day]) => parseInt(day));

      // Calculate average severity by day
      const avgSeverityByDay: Record<number, number> = {};
      Object.entries(dayPatterns).forEach(([day, data]) => {
        if (data.severities.length > 0) {
          avgSeverityByDay[parseInt(day)] = 
            data.severities.reduce((a, b) => a + b, 0) / data.severities.length;
        }
      });

      // Calculate current day
      let currentDay: number | null = null;
      let phase: CycleData["phase"] = null;
      let predictedFlareRisk: CycleData["predictedFlareRisk"] = null;

      if (cycleMeta.lastPeriodStart) {
        const lastStart = new Date(cycleMeta.lastPeriodStart);
        const daysSince = differenceInDays(startOfDay(new Date()), startOfDay(lastStart));
        const cycleLength = cycleMeta.cycleLength || 28;
        
        currentDay = (daysSince % cycleLength) + 1;
        
        // Determine phase
        if (currentDay <= 5) phase = "menstrual";
        else if (currentDay <= 13) phase = "follicular";
        else if (currentDay <= 16) phase = "ovulation";
        else phase = "luteal";

        // Determine risk
        if (highRiskDays.includes(currentDay) || highRiskDays.includes(currentDay + 1)) {
          predictedFlareRisk = "high";
        } else if (avgSeverityByDay[currentDay] && avgSeverityByDay[currentDay] > 1.5) {
          predictedFlareRisk = "moderate";
        } else {
          predictedFlareRisk = "low";
        }
      }

      setCycleData({
        lastPeriodStart: cycleMeta.lastPeriodStart ? new Date(cycleMeta.lastPeriodStart) : null,
        cycleLength: cycleMeta.cycleLength || 28,
        periodLength: cycleMeta.periodLength || 5,
        currentDay,
        phase,
        predictedFlareRisk,
        historicalPatterns: { highRiskDays, avgSeverityByDay },
      });

    } catch (err) {
      console.error("Cycle load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodStart = async (date: Date | undefined) => {
    if (!date) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", userId)
        .single();

      const existingMeta = (profile?.metadata as any) || {};
      
      await supabase
        .from("profiles")
        .update({
          metadata: {
            ...existingMeta,
            cycle: {
              ...(existingMeta.cycle || {}),
              lastPeriodStart: date.toISOString(),
            },
          },
        })
        .eq("id", userId);

      await loadCycleData();
      setShowCalendar(false);
    } catch (err) {
      console.error("Failed to save period start:", err);
    }
  };

  const getPhaseColor = (phase: string | null) => {
    switch (phase) {
      case "menstrual": return "text-red-500 bg-red-500/10";
      case "follicular": return "text-green-500 bg-green-500/10";
      case "ovulation": return "text-purple-500 bg-purple-500/10";
      case "luteal": return "text-yellow-500 bg-yellow-500/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getRiskColor = (risk: string | null) => {
    switch (risk) {
      case "low": return "text-severity-none";
      case "moderate": return "text-yellow-500";
      case "high": return "text-severity-severe";
      default: return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <Card className="p-4 bg-gradient-card border-0 shadow-soft animate-pulse">
        <div className="h-20 bg-muted rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gradient-card border-0 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-pink-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Cycle Tracking</h3>
            {cycleData.currentDay && (
              <p className="text-[10px] text-muted-foreground">
                Day {cycleData.currentDay} of {cycleData.cycleLength}
              </p>
            )}
          </div>
        </div>
        
        {cycleData.phase && (
          <Badge className={cn("text-[10px] capitalize", getPhaseColor(cycleData.phase))}>
            {cycleData.phase}
          </Badge>
        )}
      </div>

      {!cycleData.lastPeriodStart ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-3">
            Track your cycle to unlock hormone-related flare predictions
          </p>
          <Popover open={showCalendar} onOpenChange={setShowCalendar}>
            <PopoverTrigger asChild>
              <Button size="sm" className="gap-2">
                <CalendarDays className="w-4 h-4" />
                Log Period Start
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={cycleData.lastPeriodStart || undefined}
                onSelect={handlePeriodStart}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Risk Indicator */}
          {cycleData.predictedFlareRisk && (
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg",
              cycleData.predictedFlareRisk === "high" ? "bg-severity-severe/10" :
              cycleData.predictedFlareRisk === "moderate" ? "bg-yellow-500/10" :
              "bg-severity-none/10"
            )}>
              {cycleData.predictedFlareRisk === "high" ? (
                <AlertCircle className="w-4 h-4 text-severity-severe" />
              ) : cycleData.predictedFlareRisk === "moderate" ? (
                <TrendingUp className="w-4 h-4 text-yellow-500" />
              ) : (
                <Sparkles className="w-4 h-4 text-severity-none" />
              )}
              <span className={cn("text-xs font-medium", getRiskColor(cycleData.predictedFlareRisk))}>
                {cycleData.predictedFlareRisk === "high" 
                  ? "You historically flare around this time" 
                  : cycleData.predictedFlareRisk === "moderate"
                  ? "Moderate risk based on your patterns"
                  : "Low flare risk today"}
              </span>
            </div>
          )}

          {/* High Risk Days Preview */}
          {cycleData.historicalPatterns.highRiskDays.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Your high-risk days: </span>
              {cycleData.historicalPatterns.highRiskDays.slice(0, 5).map((day, i) => (
                <Badge key={day} variant="outline" className={cn(
                  "text-[10px] mx-0.5",
                  day === cycleData.currentDay && "bg-primary text-primary-foreground"
                )}>
                  Day {day}
                </Badge>
              ))}
            </div>
          )}

          {/* Update Period */}
          <Popover open={showCalendar} onOpenChange={setShowCalendar}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-xs">
                <CalendarDays className="w-3 h-3 mr-1" />
                Update period start
                <ChevronRight className="w-3 h-3 ml-auto" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={cycleData.lastPeriodStart || undefined}
                onSelect={handlePeriodStart}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </Card>
  );
};
