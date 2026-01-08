import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
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
  TrendingDown,
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
      case "low": return "text-severity-none";
      case "moderate": return "text-yellow-500";
      case "high": return "text-severity-moderate";
      case "very_high": return "text-severity-severe";
      default: return "text-muted-foreground";
    }
  };

  const getRiskBg = (level: string) => {
    switch (level) {
      case "low": return "bg-severity-none/10";
      case "moderate": return "bg-yellow-500/10";
      case "high": return "bg-severity-moderate/10";
      case "very_high": return "bg-severity-severe/10";
      default: return "bg-muted";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "sleep": return <Moon className="w-3 h-3" />;
      case "activity": return <Activity className="w-3 h-3" />;
      case "stress": return <Heart className="w-3 h-3" />;
      case "weather": return <CloudRain className="w-3 h-3" />;
      case "cycle": return <Zap className="w-3 h-3" />;
      case "pattern": return <TrendingUp className="w-3 h-3" />;
      default: return <AlertTriangle className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <Card className="p-4 bg-gradient-card border-0 shadow-soft animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-48 bg-muted rounded" />
          </div>
        </div>
      </Card>
    );
  }

  if (needsMoreData) {
    return (
      <Card className="p-4 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">Building Your Forecast</h3>
            <p className="text-[11px] text-muted-foreground">
              Keep logging for 1-2 weeks to unlock AI predictions
            </p>
          </div>
          <Progress value={30} className="w-16 h-2" />
        </div>
      </Card>
    );
  }

  if (!forecast) return null;

  const riskFactors = forecast.factors.filter(f => f.impact > 0).slice(0, 3);
  const protectiveCount = forecast.factors.filter(f => f.impact < 0).length;

  return (
    <Card className={cn(
      "p-4 border-0 shadow-soft-lg transition-all duration-300",
      getRiskBg(forecast.riskLevel)
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            forecast.riskLevel === "low" ? "bg-severity-none/20" :
            forecast.riskLevel === "moderate" ? "bg-yellow-500/20" :
            forecast.riskLevel === "high" ? "bg-severity-moderate/20" :
            "bg-severity-severe/20"
          )}>
            {forecast.riskLevel === "low" ? (
              <Sun className={cn("w-6 h-6", getRiskColor(forecast.riskLevel))} />
            ) : forecast.riskLevel === "very_high" ? (
              <AlertTriangle className={cn("w-6 h-6", getRiskColor(forecast.riskLevel))} />
            ) : (
              <CloudRain className={cn("w-6 h-6", getRiskColor(forecast.riskLevel))} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Tomorrow's Forecast</h3>
              <Badge variant="outline" className={cn("text-[10px] capitalize", getRiskColor(forecast.riskLevel))}>
                {forecast.riskLevel.replace("_", " ")} risk
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {Math.round(forecast.confidence * 100)}% confidence
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetchForecast}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Risk Score Bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-muted-foreground">Flare Risk</span>
          <span className={cn("text-lg font-bold", getRiskColor(forecast.riskLevel))}>
            {forecast.riskScore}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-500 rounded-full",
              forecast.riskLevel === "low" ? "bg-severity-none" :
              forecast.riskLevel === "moderate" ? "bg-yellow-500" :
              forecast.riskLevel === "high" ? "bg-severity-moderate" :
              "bg-severity-severe"
            )}
            style={{ width: `${forecast.riskScore}%` }}
          />
        </div>
      </div>

      {/* Prediction */}
      <p className="text-sm mb-3">{forecast.prediction}</p>

      {/* Risk Factors (Collapsed) */}
      {riskFactors.length > 0 && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          <div className="flex items-center justify-between py-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {riskFactors.length} risk factor{riskFactors.length > 1 ? "s" : ""}
                {protectiveCount > 0 && ` • ${protectiveCount} protective`}
              </span>
            </div>
            <ChevronRight className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )} />
          </div>
        </button>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="space-y-3 pt-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Risk Factors */}
          {riskFactors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk Factors</h4>
              {riskFactors.map((factor, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                  <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center mt-0.5",
                    factor.impact > 0.3 ? "bg-severity-severe/10 text-severity-severe" :
                    factor.impact > 0.2 ? "bg-severity-moderate/10 text-severity-moderate" :
                    "bg-yellow-500/10 text-yellow-600"
                  )}>
                    {getCategoryIcon(factor.category)}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{factor.factor}</p>
                    <p className="text-[10px] text-muted-foreground">{factor.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Protective Factors */}
          {forecast.protectiveFactors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Working in Your Favor</h4>
              {forecast.protectiveFactors.map((factor, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-severity-none" />
                  <span>{factor}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {forecast.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recommendations</h4>
              <div className="space-y-1">
                {forecast.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Sparkles className="w-3 h-3 text-primary mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
