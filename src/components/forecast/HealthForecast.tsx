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
                  {forecast.riskLevel.replace("_", " ")} risk
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

        {/* Risk Score Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-base text-muted-foreground">Flare Risk</span>
            <span className={cn("text-2xl font-bold", getRiskColor(forecast.riskLevel))}>
              {forecast.riskScore}%
            </span>
          </div>
          <div className="h-3 bg-white/50 dark:bg-slate-800/50 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                forecast.riskLevel === "low" ? "bg-emerald-500" :
                forecast.riskLevel === "moderate" ? "bg-yellow-500" :
                forecast.riskLevel === "high" ? "bg-orange-500" :
                "bg-red-500"
              )}
              style={{ width: `${forecast.riskScore}%` }}
            />
          </div>
        </div>

        {/* Prediction */}
        <p className="text-base mb-4">{forecast.prediction}</p>

        {/* Risk Factors (Collapsed) */}
        {riskFactors.length > 0 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "w-full p-3 rounded-2xl transition-all",
              "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
              "border border-white/40 dark:border-slate-700/40",
              "hover:bg-white/70"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base text-muted-foreground">
                  {riskFactors.length} risk factor{riskFactors.length > 1 ? "s" : ""}
                  {protectiveCount > 0 && ` • ${protectiveCount} protective`}
                </span>
              </div>
              <ChevronRight className={cn(
                "w-5 h-5 text-muted-foreground transition-transform",
                expanded && "rotate-90"
              )} />
            </div>
          </button>
        )}

        {/* Expanded Details */}
        {expanded && (
          <div className="space-y-4 pt-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            {/* Risk Factors */}
            {riskFactors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-muted-foreground">Risk Factors</h4>
                {riskFactors.map((factor, i) => (
                  <div key={i} className={cn(
                    "flex items-start gap-3 p-3 rounded-2xl",
                    "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
                    "border border-white/40 dark:border-slate-700/40"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center mt-0.5",
                      factor.impact > 0.3 ? "bg-red-500/15 text-red-600" :
                      factor.impact > 0.2 ? "bg-orange-500/15 text-orange-600" :
                      "bg-yellow-500/15 text-yellow-600"
                    )}>
                      {getCategoryIcon(factor.category)}
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-medium">{factor.factor}</p>
                      <p className="text-sm text-muted-foreground">{factor.evidence}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Protective Factors */}
            {forecast.protectiveFactors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-muted-foreground">Working in Your Favor</h4>
                {forecast.protectiveFactors.map((factor, i) => (
                  <div key={i} className="flex items-center gap-3 text-base">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>{factor}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {forecast.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-muted-foreground">Recommendations</h4>
                <div className="space-y-2">
                  {forecast.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 text-base">
                      <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
