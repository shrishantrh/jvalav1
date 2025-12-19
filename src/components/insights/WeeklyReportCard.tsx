import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Heart, 
  Flame, 
  Activity,
  ChevronRight,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  health_score: number | null;
  flare_count: number | null;
  avg_severity: number | null;
  logging_consistency: number | null;
  trend: string | null;
  top_symptoms: { name: string; count: number }[] | null;
  top_triggers: { name: string; count: number }[] | null;
  top_correlations: { trigger: string; outcome: string; confidence: number }[] | null;
  key_insights: string[] | null;
}

interface WeeklyReportCardProps {
  userId: string;
  onViewDetails?: () => void;
}

export const WeeklyReportCard = ({ userId, onViewDetails }: WeeklyReportCardProps) => {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReport = async () => {
    try {
      // Get current week range
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

      const { data, error } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', format(weekStart, 'yyyy-MM-dd'))
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Type cast the JSON fields properly
        setReport({
          ...data,
          top_symptoms: data.top_symptoms as { name: string; count: number }[] | null,
          top_triggers: data.top_triggers as { name: string; count: number }[] | null,
          top_correlations: data.top_correlations as { trigger: string; outcome: string; confidence: number }[] | null,
          key_insights: data.key_insights as string[] | null,
        });
      } else {
        // Generate report if doesn't exist
        await generateReport();
      }
    } catch (error) {
      console.error('Failed to load weekly report:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-weekly-report', {
        body: { userId }
      });

      if (error) throw error;

      if (data) {
        setReport({
          id: '',
          ...data,
        });
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadReport();
    }
  }, [userId]);

  const handleRefresh = async () => {
    await generateReport();
  };

  if (loading) {
    return (
      <Card className="p-4 bg-gradient-card border-0 animate-pulse">
        <div className="h-32 bg-muted/30 rounded-xl" />
      </Card>
    );
  }

  if (!report) {
    return null;
  }

  const healthScore = report.health_score || 0;
  const trend = report.trend || 'stable';
  const flareCount = report.flare_count || 0;
  const consistency = report.logging_consistency || 0;

  const getTrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'worsening':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'improving':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'worsening':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = () => {
    if (healthScore >= 70) return 'text-green-500';
    if (healthScore >= 40) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getScoreGradient = () => {
    if (healthScore >= 70) return 'from-green-500 to-emerald-500';
    if (healthScore >= 40) return 'from-yellow-500 to-orange-500';
    return 'from-destructive to-pink-500';
  };

  return (
    <Card className="overflow-hidden bg-gradient-card border-0 shadow-soft-lg">
      {/* Header */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Weekly Report</h3>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(report.week_start), 'MMM d')} - {format(new Date(report.week_end), 'MMM d')}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Health Score */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getScoreGradient()} flex items-center justify-center shadow-lg`}>
              <span className="text-2xl font-bold text-white">{healthScore}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card flex items-center justify-center shadow-md">
              {getTrendIcon()}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">Health Score</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${getTrendColor()}`}>
                {trend === 'improving' ? '↑ Better' : trend === 'worsening' ? '↓ Check triggers' : '→ Stable'}
              </Badge>
            </div>
            <Progress value={healthScore} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">
              Based on flares, severity, and consistency
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2">
        <div className="bg-muted/30 rounded-xl p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Flame className="w-3 h-3 text-destructive" />
            <span className="text-lg font-bold text-foreground">{flareCount}</span>
          </div>
          <p className="text-[9px] text-muted-foreground">Flares</p>
        </div>
        <div className="bg-muted/30 rounded-xl p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Activity className="w-3 h-3 text-primary" />
            <span className="text-lg font-bold text-foreground">{consistency}%</span>
          </div>
          <p className="text-[9px] text-muted-foreground">Logged</p>
        </div>
        <div className="bg-muted/30 rounded-xl p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Heart className="w-3 h-3 text-pink-500" />
            <span className="text-lg font-bold text-foreground">
              {report.avg_severity ? report.avg_severity.toFixed(1) : '-'}
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground">Avg Severity</p>
        </div>
      </div>

      {/* Key Insights */}
      {report.key_insights && report.key_insights.length > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-primary/5 rounded-xl p-3 space-y-1.5">
            {report.key_insights.slice(0, 3).map((insight, index) => (
              <p key={index} className="text-[11px] text-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                {insight}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Top Triggers */}
      {report.top_triggers && report.top_triggers.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-muted-foreground mb-1.5">Top Triggers</p>
          <div className="flex flex-wrap gap-1">
            {report.top_triggers.slice(0, 3).map((trigger, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="text-[10px] px-2 py-0.5 bg-destructive/10 text-destructive border-destructive/20"
              >
                {trigger.name} ({trigger.count}x)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* View Details */}
      {onViewDetails && (
        <div className="px-4 pb-4">
          <Button 
            variant="ghost" 
            className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={onViewDetails}
          >
            View Full Insights
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}
    </Card>
  );
};
