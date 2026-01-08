import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, 
  AlertCircle, 
  TrendingUp, 
  Clock,
  BrainCircuit,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BusyDay {
  date: string;
  level: "light" | "moderate" | "heavy";
  events: number;
}

interface StressIndicator {
  type: string;
  level: number;
  evidence: string;
}

interface CalendarStressProps {
  userId: string;
  onStressData?: (level: number) => void;
}

export const CalendarStress = ({ userId, onStressData }: CalendarStressProps) => {
  const [stressIndicators, setStressIndicators] = useState<StressIndicator[]>([]);
  const [overallStress, setOverallStress] = useState<number>(50);
  const [recentPatterns, setRecentPatterns] = useState<{
    busyDays: number;
    avgEventsPerDay: number;
    irregularSchedule: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyzeStressPatterns();
  }, [userId]);

  const analyzeStressPatterns = async () => {
    setLoading(true);
    try {
      // Fetch user's flare entries to analyze patterns
      const { data: entries } = await supabase
        .from("flare_entries")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(100);

      if (!entries || entries.length === 0) {
        setLoading(false);
        return;
      }

      const indicators: StressIndicator[] = [];
      let stressScore = 30; // Base stress

      // Analyze flare frequency (more flares = more stress)
      const recentFlares = entries.filter((e: any) => {
        const daysSince = (Date.now() - new Date(e.timestamp).getTime()) / (24 * 60 * 60 * 1000);
        return e.entry_type === "flare" && daysSince <= 7;
      });

      if (recentFlares.length >= 5) {
        indicators.push({
          type: "High flare activity",
          level: 80,
          evidence: `${recentFlares.length} flares in the past week`,
        });
        stressScore += 25;
      } else if (recentFlares.length >= 3) {
        indicators.push({
          type: "Moderate flare activity",
          level: 50,
          evidence: `${recentFlares.length} flares this week`,
        });
        stressScore += 10;
      }

      // Analyze logging patterns (irregular logging = irregular routine = stress)
      const timestamps = entries.map((e: any) => new Date(e.timestamp).getTime()).sort();
      const gaps = [];
      for (let i = 1; i < timestamps.length; i++) {
        gaps.push((timestamps[i - 1] - timestamps[i]) / (24 * 60 * 60 * 1000));
      }
      const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1;
      const irregularSchedule = avgGap > 2;

      if (irregularSchedule) {
        indicators.push({
          type: "Irregular routine detected",
          level: 60,
          evidence: "Logging patterns suggest disrupted routine",
        });
        stressScore += 15;
      }

      // Check for stress mentions in notes
      const stressNotes = entries.filter((e: any) => {
        const note = (e.note || "").toLowerCase();
        return note.includes("stress") || note.includes("anxious") || 
               note.includes("overwhelmed") || note.includes("tired") ||
               note.includes("exhausted") || note.includes("busy");
      });

      if (stressNotes.length >= 3) {
        indicators.push({
          type: "Stress frequently mentioned",
          level: 70,
          evidence: `${stressNotes.length} recent entries mention stress`,
        });
        stressScore += 20;
      }

      // Analyze time of day patterns
      const nightEntries = entries.filter((e: any) => {
        const hour = new Date(e.timestamp).getHours();
        return hour >= 23 || hour <= 5;
      });

      if (nightEntries.length >= 5) {
        indicators.push({
          type: "Late-night activity",
          level: 55,
          evidence: `${nightEntries.length} entries between 11PM-5AM`,
        });
        stressScore += 10;
      }

      // Check physiological data for stress indicators
      const highStressEntries = entries.filter((e: any) => {
        const stress = e.physiological_data?.stress?.level || e.physiological_data?.stress;
        return stress && stress > 60;
      });

      if (highStressEntries.length >= 2) {
        indicators.push({
          type: "Elevated wearable stress",
          level: 65,
          evidence: "Wearable data shows elevated stress levels",
        });
        stressScore += 15;
      }

      // Cap stress score
      stressScore = Math.min(100, Math.max(0, stressScore));

      setStressIndicators(indicators.slice(0, 4));
      setOverallStress(stressScore);
      setRecentPatterns({
        busyDays: recentFlares.length,
        avgEventsPerDay: entries.length / 7,
        irregularSchedule,
      });

      onStressData?.(stressScore);

    } catch (err) {
      console.error("Stress analysis error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStressColor = (level: number) => {
    if (level < 30) return "text-severity-none";
    if (level < 50) return "text-yellow-500";
    if (level < 70) return "text-severity-moderate";
    return "text-severity-severe";
  };

  const getStressBg = (level: number) => {
    if (level < 30) return "bg-severity-none/10";
    if (level < 50) return "bg-yellow-500/10";
    if (level < 70) return "bg-severity-moderate/10";
    return "bg-severity-severe/10";
  };

  if (loading) {
    return (
      <Card className="p-4 bg-gradient-card border-0 shadow-soft animate-pulse">
        <div className="h-24 bg-muted rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 border-0 shadow-soft", getStressBg(overallStress))}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            overallStress > 60 ? "bg-severity-severe/20" : "bg-primary/10"
          )}>
            <BrainCircuit className={cn(
              "w-4 h-4",
              overallStress > 60 ? "text-severity-severe" : "text-primary"
            )} />
          </div>
          <div>
            <h3 className="text-sm font-medium">Stress Analysis</h3>
            <p className="text-[10px] text-muted-foreground">Based on your patterns</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={analyzeStressPatterns}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stress Meter */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-muted-foreground">Inferred Stress Level</span>
          <span className={cn("text-lg font-bold", getStressColor(overallStress))}>
            {overallStress}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-500 rounded-full",
              overallStress < 30 ? "bg-severity-none" :
              overallStress < 50 ? "bg-yellow-500" :
              overallStress < 70 ? "bg-severity-moderate" :
              "bg-severity-severe"
            )}
            style={{ width: `${overallStress}%` }}
          />
        </div>
      </div>

      {/* Indicators */}
      {stressIndicators.length > 0 && (
        <div className="space-y-2">
          {stressIndicators.map((indicator, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <AlertCircle className={cn(
                "w-3.5 h-3.5 mt-0.5 shrink-0",
                indicator.level > 60 ? "text-severity-severe" :
                indicator.level > 40 ? "text-yellow-500" : "text-muted-foreground"
              )} />
              <div>
                <span className="font-medium">{indicator.type}</span>
                <span className="text-muted-foreground ml-1">— {indicator.evidence}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {stressIndicators.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="w-4 h-4 text-severity-none" />
          <span>No major stress indicators detected</span>
        </div>
      )}

      {/* Recommendations */}
      {overallStress > 50 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">💡 Tip:</span> Your patterns suggest elevated stress. Consider adding relaxation techniques to your routine.
          </p>
        </div>
      )}
    </Card>
  );
};
