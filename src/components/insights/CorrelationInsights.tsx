import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Activity, 
  Utensils, 
  Cloud, 
  Pill, 
  Clock,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Zap
} from "lucide-react";
import { Correlation } from "@/hooks/useCorrelations";
import { cn } from "@/lib/utils";

interface CorrelationInsightsProps {
  correlations: Correlation[];
  onViewDetails?: () => void;
}

const getTriggerIcon = (triggerType: string) => {
  switch (triggerType) {
    case 'activity': return <Activity className="w-4 h-4" />;
    case 'food': return <Utensils className="w-4 h-4" />;
    case 'weather': return <Cloud className="w-4 h-4" />;
    case 'medication': return <Pill className="w-4 h-4" />;
    case 'time_of_day': return <Clock className="w-4 h-4" />;
    default: return <Zap className="w-4 h-4" />;
  }
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.7) return 'bg-red-500/20 text-red-600 border-red-500/30';
  if (confidence >= 0.5) return 'bg-orange-500/20 text-orange-600 border-orange-500/30';
  if (confidence >= 0.3) return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
  return 'bg-muted text-muted-foreground border-border';
};

const formatDelay = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
  return `${Math.round(minutes / 1440)} days`;
};

export function CorrelationInsights({ correlations, onViewDetails }: CorrelationInsightsProps) {
  // Filter to high-confidence correlations
  const highConfidence = correlations.filter(c => c.confidence >= 0.3 && c.occurrence_count >= 2);
  
  if (highConfidence.length === 0) {
    return (
      <Card className="p-4 bg-gradient-to-br from-muted/30 to-muted/10 border-0">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">
            Keep logging to discover your personal patterns
          </span>
        </div>
      </Card>
    );
  }

  const topCorrelations = highConfidence.slice(0, 4);

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-background border-0 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">Discovered Patterns</h3>
        </div>
        {onViewDetails && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onViewDetails}>
            View All
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {topCorrelations.map((correlation) => (
          <div 
            key={correlation.id}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-background/60 hover:bg-background/80 transition-colors"
          >
            <div className={cn(
              "p-1.5 rounded-lg",
              correlation.trigger_type === 'activity' ? 'bg-blue-500/10 text-blue-600' :
              correlation.trigger_type === 'food' ? 'bg-orange-500/10 text-orange-600' :
              correlation.trigger_type === 'weather' ? 'bg-sky-500/10 text-sky-600' :
              'bg-purple-500/10 text-purple-600'
            )}>
              {getTriggerIcon(correlation.trigger_type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium capitalize truncate">
                  {correlation.trigger_value}
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {correlation.outcome_value}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {correlation.occurrence_count}x
                </span>
                {correlation.avg_delay_minutes > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    ~{formatDelay(correlation.avg_delay_minutes)} delay
                  </span>
                )}
              </div>
            </div>

            <Badge 
              variant="outline" 
              className={cn("text-[10px] h-5 shrink-0", getConfidenceColor(correlation.confidence))}
            >
              {Math.round(correlation.confidence * 100)}%
            </Badge>
          </div>
        ))}
      </div>

      {highConfidence.length > 4 && (
        <p className="text-xs text-muted-foreground text-center">
          +{highConfidence.length - 4} more patterns discovered
        </p>
      )}

      {/* High confidence warning */}
      {highConfidence.some(c => c.confidence >= 0.6) && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700">Strong pattern detected</p>
            <p className="text-[10px] text-amber-600/80 mt-0.5">
              Consider discussing these patterns with your healthcare provider
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

export function CorrelationAlert({ correlation }: { correlation: Correlation }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-amber-700">
          <span className="font-medium capitalize">{correlation.trigger_value}</span>
          {' '}has preceded{' '}
          <span className="font-medium">{correlation.outcome_value}</span>
          {' '}{correlation.occurrence_count} times
          {correlation.avg_delay_minutes > 0 && (
            <span className="text-amber-600/80">
              {' '}(~{formatDelay(correlation.avg_delay_minutes)} later)
            </span>
          )}
        </p>
      </div>
      <Badge 
        variant="outline" 
        className={cn("text-[10px] h-5", getConfidenceColor(correlation.confidence))}
      >
        {Math.round(correlation.confidence * 100)}% confident
      </Badge>
    </div>
  );
}
