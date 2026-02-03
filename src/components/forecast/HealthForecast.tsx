import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useWearableData } from "@/hooks/useWearableData";
import { 
  Brain, 
  Sun, 
  Moon, 
  CloudRain, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Activity,
  Heart,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskFactor {
  factor: string;
  impact: number;
  confidence: number;
  evidence: string;
  category: string;
}

interface Forecast {
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "very_high";
  confidence: number;
  factors: RiskFactor[];
  prediction: string;
  recommendations: string[];
  protectiveFactors: string[];
  timeframe: string;
}

interface HealthForecastProps {
  userId: string;
  currentWeather?: any;
  menstrualDay?: number;
  onViewDetails?: () => void;
}

export const HealthForecast = ({ userId, currentWeather, menstrualDay, onViewDetails }: HealthForecastProps) => {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsMoreData, setNeedsMoreData] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { data: wearableData } = useWearableData();

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("health-forecast", {
        body: {
          userId,
          currentWeather,
          wearableData,
          menstrualDay,
        },
      });

      if (error) throw error;

      setForecast(data.forecast);
      setNeedsMoreData(data.needsMoreData || false);
    } catch (err) {
      console.error("Forecast error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchForecast();
    }
  }, [userId, wearableData]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "text-emerald-600";
      case "moderate": return "text-yellow-600";
      case "high": return "text-orange-600";
      case "very_high": return "text-red-600";
      default: return "text-muted-foreground";
    }
  };

  const getRiskGradient = (level: string) => {
    switch (level) {
      case "low": return "from-emerald-500/15 to-emerald-500/5";
      case "moderate": return "from-yellow-500/15 to-yellow-500/5";
      case "high": return "from-orange-500/15 to-orange-500/5";
      case "very_high": return "from-red-500/15 to-red-500/5";
      default: return "from-muted/20 to-muted/10";
    }
  };

  const getRiskBorderColor = (level: string) => {
    switch (level) {
      case "low": return "border-emerald-500/20";
      case "moderate": return "border-yellow-500/20";
      case "high": return "border-orange-500/20";
      case "very_high": return "border-red-500/20";
      default: return "border-border/50";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "sleep": return <Moon className="w-4 h-4" />;
      case "activity": return <Activity className="w-4 h-4" />;
      case "stress": return <Heart className="w-4 h-4" />;
      case "weather": return <CloudRain className="w-4 h-4" />;
      case "cycle": return <Zap className="w-4 h-4" />;
      case "pattern": return <TrendingUp className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className={cn(
        "relative p-5 rounded-3xl overflow-hidden animate-pulse",
        "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
        "border border-white/50 dark:border-slate-700/50",
        "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
      )}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 bg-muted rounded" />
            <div className="h-4 w-56 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (needsMoreData) {
    return (
      <div className={cn(
        "relative p-5 rounded-3xl overflow-hidden",
        "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
        "border border-white/50 dark:border-slate-700/50",
        "before:absolute before:inset-0 before:rounded-3xl before:pointer-events-none",
        "before:bg-gradient-to-br before:from-white/30 before:via-transparent before:to-transparent",
        "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
      )}>
        <div className="relative z-10 flex items-center gap-4">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            "bg-gradient-to-br from-primary/20 to-primary/10",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
          )}>
            <Brain className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold">Building Your Forecast</h3>
            <p className="text-base text-muted-foreground">
              Keep logging for 1-2 weeks to unlock AI predictions
            </p>
          </div>
          <Progress value={30} className="w-20 h-2" />
        </div>
      </div>
    );
  }

  if (!forecast) return null;

  const riskFactors = forecast.factors.filter(f => f.impact > 0).slice(0, 3);
  const protectiveCount = forecast.factors.filter(f => f.impact < 0).length;

  return (
    <div className={cn(
      "relative p-5 rounded-3xl overflow-hidden transition-all duration-300",
      "backdrop-blur-xl",
      `bg-gradient-to-br ${getRiskGradient(forecast.riskLevel)}`,
      getRiskBorderColor(forecast.riskLevel),
      "border",
      "before:absolute before:inset-0 before:rounded-3xl before:pointer-events-none",
      "before:bg-gradient-to-br before:from-white/20 before:via-transparent before:to-transparent",
      "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
    )}>
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center",
              forecast.riskLevel === "low" ? "bg-emerald-500/20" :
              forecast.riskLevel === "moderate" ? "bg-yellow-500/20" :
              forecast.riskLevel === "high" ? "bg-orange-500/20" :
              "bg-red-500/20",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
            )}>
              {forecast.riskLevel === "low" ? (
                <Sun className={cn("w-7 h-7", getRiskColor(forecast.riskLevel))} />
              ) : forecast.riskLevel === "very_high" ? (
                <AlertTriangle className={cn("w-7 h-7", getRiskColor(forecast.riskLevel))} />
              ) : (
                <CloudRain className={cn("w-7 h-7", getRiskColor(forecast.riskLevel))} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Tomorrow's Forecast</h3>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={cn("text-sm capitalize font-semibold", getRiskColor(forecast.riskLevel))}>
                  {forecast.riskScore}% risk
                </Badge>
                <span className="text-base text-muted-foreground">
                  {Math.round(forecast.confidence * 100)}% confidence
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-2xl",
              "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
              "border border-white/40 dark:border-slate-700/40",
              "hover:bg-white/70"
            )}
            onClick={fetchForecast}
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>

        {/* Key Risk Factors - Always visible */}
        {riskFactors.length > 0 ? (
          <div className="space-y-2 mb-4">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Why this risk level:</p>
            {riskFactors.map((factor, i) => (
              <div key={i} className={cn(
                "flex items-start gap-3 p-3 rounded-2xl",
                "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
                "border border-white/40 dark:border-slate-700/40"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center mt-0.5 shrink-0",
                  factor.impact > 0.3 ? "bg-red-500/15 text-red-600" :
                  factor.impact > 0.2 ? "bg-orange-500/15 text-orange-600" :
                  "bg-yellow-500/15 text-yellow-600"
                )}>
                  {getCategoryIcon(factor.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium">{factor.factor}</p>
                  <p className="text-sm text-muted-foreground truncate">{factor.evidence}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(
            "p-4 rounded-2xl mb-4",
            "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
            "border border-white/40 dark:border-slate-700/40"
          )}>
            <p className="text-base text-muted-foreground">
              No major risk factors detected. Keep logging to refine predictions.
            </p>
          </div>
        )}

        {/* Protective Factors - if any */}
        {protectiveCount > 0 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "w-full p-3 rounded-2xl transition-all",
              "bg-emerald-500/10 backdrop-blur-sm",
              "border border-emerald-500/20",
              "hover:bg-emerald-500/15"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-base text-emerald-700 dark:text-emerald-400 font-medium">
                  {protectiveCount} thing{protectiveCount > 1 ? 's' : ''} working in your favor
                </span>
              </div>
              <ChevronRight className={cn(
                "w-5 h-5 text-emerald-500 transition-transform",
                expanded && "rotate-90"
              )} />
            </div>
          </button>
        )}

        {/* Expanded Details */}
        {expanded && protectiveCount > 0 && (
          <div className="space-y-2 pt-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            {forecast.protectiveFactors.map((factor, i) => (
              <div key={i} className="flex items-center gap-3 text-base pl-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>{factor}</span>
              </div>
            ))}
          </div>
        )}

        {/* Top Recommendation */}
        {forecast.recommendations.length > 0 && (
          <div className={cn(
            "mt-4 p-4 rounded-2xl",
            "bg-gradient-to-br from-primary/10 to-primary/5",
            "border border-primary/20"
          )}>
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary mb-1">Recommendation</p>
                <p className="text-base">{forecast.recommendations[0]}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
