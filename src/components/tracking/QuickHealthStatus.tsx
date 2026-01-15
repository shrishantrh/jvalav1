import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { 
  Brain, 
  Sun, 
  CloudRain, 
  AlertTriangle,
  Droplets,
  Activity,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays, startOfDay } from "date-fns";

interface QuickHealthStatusProps {
  userId: string;
  onViewForecast?: () => void;
}

export const QuickHealthStatus = ({ userId, onViewForecast }: QuickHealthStatusProps) => {
  const [loading, setLoading] = useState(true);
  const [riskLevel, setRiskLevel] = useState<"low" | "moderate" | "high">("low");
  const [riskScore, setRiskScore] = useState(25);
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  const [stressLevel, setStressLevel] = useState<number>(30);
  const [showCycleCalendar, setShowCycleCalendar] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [userId]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      // Fetch forecast
      const { data: forecastData } = await supabase.functions.invoke("health-forecast", {
        body: { userId },
      });

      if (forecastData?.forecast) {
        setRiskScore(forecastData.forecast.riskScore);
        setRiskLevel(forecastData.forecast.riskLevel);
      }

      // Fetch profile for cycle data
      const { data: profile } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", userId)
        .single();

      const cycleMeta = (profile?.metadata as any)?.cycle;
      if (cycleMeta?.lastPeriodStart) {
        const lastStart = new Date(cycleMeta.lastPeriodStart);
        const daysSince = differenceInDays(startOfDay(new Date()), startOfDay(lastStart));
        const cycleLength = cycleMeta.cycleLength || 28;
        setCycleDay((daysSince % cycleLength) + 1);
      }

      // Fetch recent entries for stress inference
      const { data: entries } = await supabase
        .from("flare_entries")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(20);

      if (entries) {
        const recentFlares = entries.filter((e: any) => {
          const daysSince = (Date.now() - new Date(e.timestamp).getTime()) / (24 * 60 * 60 * 1000);
          return e.entry_type === "flare" && daysSince <= 7;
        });
        // Simple stress inference
        const inferredStress = Math.min(30 + recentFlares.length * 10, 100);
        setStressLevel(inferredStress);
      }

    } catch (err) {
      console.error("Status load error:", err);
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

      await loadStatus();
      setShowCycleCalendar(false);
    } catch (err) {
      console.error("Failed to save period start:", err);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "text-severity-none";
      case "moderate": return "text-yellow-500";
      case "high": return "text-severity-severe";
      default: return "text-muted-foreground";
    }
  };

  const getRiskBg = (level: string) => {
    switch (level) {
      case "low": return "bg-severity-none";
      case "moderate": return "bg-yellow-500";
      case "high": return "bg-severity-severe";
      default: return "bg-muted";
    }
  };

  if (loading) {
    return (
      <Card className="p-4 bg-gradient-card border-0 shadow-soft animate-pulse">
        <div className="h-24 bg-muted rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gradient-card border-0 shadow-soft space-y-3">
      {/* Health Forecast Summary */}
      <button 
        onClick={onViewForecast}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            riskLevel === "low" ? "bg-severity-none/20" :
            riskLevel === "moderate" ? "bg-yellow-500/20" :
            "bg-severity-severe/20"
          )}>
            {riskLevel === "low" ? (
              <Sun className={cn("w-5 h-5", getRiskColor(riskLevel))} />
            ) : riskLevel === "high" ? (
              <AlertTriangle className={cn("w-5 h-5", getRiskColor(riskLevel))} />
            ) : (
              <CloudRain className={cn("w-5 h-5", getRiskColor(riskLevel))} />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">Tomorrow's Risk</p>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full", getRiskBg(riskLevel))}
                  style={{ width: `${riskScore}%` }}
                />
              </div>
              <span className={cn("text-xs font-medium", getRiskColor(riskLevel))}>
                {riskScore}%
              </span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Cycle Day */}
        <Popover open={showCycleCalendar} onOpenChange={setShowCycleCalendar}>
          <PopoverTrigger asChild>
            <button className="p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-all text-left">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-pink-500" />
                <span className="text-xs text-muted-foreground">Cycle</span>
              </div>
              {cycleDay ? (
                <p className="text-lg font-bold mt-1">Day {cycleDay}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Tap to log</p>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              onSelect={handlePeriodStart}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Stress Level */}
        <div className="p-3 rounded-xl bg-background/50 text-left">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Stress</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-lg font-bold",
              stressLevel > 60 ? "text-severity-severe" :
              stressLevel > 40 ? "text-yellow-500" :
              "text-severity-none"
            )}>
              {stressLevel}%
            </span>
            <Progress 
              value={stressLevel} 
              className="flex-1 h-1.5"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
