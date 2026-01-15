import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Brain, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Target,
  Zap,
  RefreshCw,
  ChevronRight,
  Activity,
  Heart,
  Shield
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { FlareEntry } from "@/types/flare";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface AIInsightsPanelProps {
  entries: FlareEntry[];
  userConditions?: string[];
}

interface AIInsight {
  type: 'pattern' | 'trigger' | 'recommendation' | 'warning' | 'success';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  actionable?: string;
}

interface AIPrediction {
  title: string;
  likelihood: 'high' | 'medium' | 'low';
  basedOn: string;
}

interface AIAnalysis {
  summary: string;
  healthScore: number;
  trend: 'improving' | 'stable' | 'worsening';
  insights: AIInsight[];
  predictions: AIPrediction[];
  recommendations: string[];
}

export const AIInsightsPanel = ({ entries, userConditions = [] }: AIInsightsPanelProps) => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const fetchAIInsights = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-insights', {
        body: { userId: user.id, analysisType: 'comprehensive' }
      });

      if (fnError) throw fnError;
      
      if (data) {
        setAnalysis(data);
        setHasAnalyzed(true);
      }
    } catch (err) {
      console.error('AI Insights error:', err);
      setError('Failed to generate insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && entries.length >= 5 && !hasAnalyzed) {
      fetchAIInsights();
    }
  }, [user, entries.length]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingDown className="w-4 h-4 text-severity-none" />;
      case 'worsening': return <TrendingUp className="w-4 h-4 text-severity-severe" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 70) return 'text-severity-none';
    if (score >= 40) return 'text-severity-moderate';
    return 'text-severity-severe';
  };

  const getHealthScoreGradient = (score: number) => {
    if (score >= 70) return 'from-severity-none/20 to-severity-none/5';
    if (score >= 40) return 'from-severity-moderate/20 to-severity-moderate/5';
    return 'from-severity-severe/20 to-severity-severe/5';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'success': return <CheckCircle2 className="w-4 h-4" />;
      case 'trigger': return <Zap className="w-4 h-4" />;
      case 'recommendation': return <Lightbulb className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const getInsightColors = (type: string) => {
    switch (type) {
      case 'warning': return { bg: 'bg-severity-severe/10', text: 'text-severity-severe', border: 'border-severity-severe/20' };
      case 'success': return { bg: 'bg-severity-none/10', text: 'text-severity-none', border: 'border-severity-none/20' };
      case 'trigger': return { bg: 'bg-severity-moderate/10', text: 'text-severity-moderate', border: 'border-severity-moderate/20' };
      case 'recommendation': return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' };
      default: return { bg: 'bg-accent', text: 'text-accent-foreground', border: 'border-accent' };
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-severity-none/20 text-severity-none',
      medium: 'bg-severity-mild/20 text-severity-mild',
      low: 'bg-muted text-muted-foreground'
    };
    return colors[confidence as keyof typeof colors] || colors.low;
  };

  if (entries.length < 5) {
    return (
      <Card className="p-6 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-primary">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">AI Health Analysis</h3>
            <p className="text-xs text-muted-foreground">Powered by Claude</p>
          </div>
        </div>
        <div className="text-center py-8">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">Need more data</p>
          <p className="text-xs text-muted-foreground">
            Log {5 - entries.length} more {5 - entries.length === 1 ? 'entry' : 'entries'} to unlock AI insights
          </p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-card border-0 shadow-soft overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-primary animate-pulse">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Analyzing your data...</h3>
            <p className="text-xs text-muted-foreground">Claude is reviewing your health patterns</p>
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-destructive/10">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold">Analysis Error</h3>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
        <Button 
          onClick={fetchAIInsights} 
          variant="outline" 
          className="w-full"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="p-6 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-primary">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">AI Health Analysis</h3>
            <p className="text-xs text-muted-foreground">Powered by Claude</p>
          </div>
        </div>
        <Button 
          onClick={fetchAIInsights} 
          className="w-full bg-gradient-primary hover:opacity-90"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate AI Insights
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Health Score Hero Card */}
      <Card className={cn(
        "p-6 bg-gradient-to-br border-0 shadow-soft overflow-hidden relative",
        getHealthScoreGradient(analysis.healthScore)
      )}>
        <div className="absolute inset-0 bg-gradient-card opacity-60" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-primary shadow-primary">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">AI Health Analysis</h3>
                <p className="text-xs text-muted-foreground">Powered by Claude</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchAIInsights}
              className="h-8 w-8"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-6 mb-4">
            {/* Health Score Circle */}
            <div className="relative">
              <svg className="w-20 h-20 -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-muted/30"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  className={getHealthScoreColor(analysis.healthScore)}
                  strokeDasharray={`${(analysis.healthScore / 100) * 226} 226`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-2xl font-bold", getHealthScoreColor(analysis.healthScore))}>
                  {analysis.healthScore}
                </span>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getTrendIcon(analysis.trend)}
                <span className="text-sm font-medium capitalize">{analysis.trend}</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {analysis.summary}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* AI Insights */}
      {analysis.insights && analysis.insights.length > 0 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Key Insights
          </h4>
          <div className="space-y-2">
            {analysis.insights.slice(0, 4).map((insight, idx) => {
              const colors = getInsightColors(insight.type);
              return (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-xl border transition-all hover-lift cursor-default",
                    colors.bg,
                    colors.border
                  )}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-1.5 rounded-lg", colors.bg)}>
                      <span className={colors.text}>{getInsightIcon(insight.type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">{insight.title}</p>
                        <Badge className={cn("text-[9px] px-1.5 py-0", getConfidenceBadge(insight.confidence))}>
                          {insight.confidence}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                      {insight.actionable && (
                        <p className="text-xs text-primary mt-1.5 font-medium flex items-center gap-1">
                          <ChevronRight className="w-3 h-3" />
                          {insight.actionable}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Predictions */}
      {analysis.predictions && analysis.predictions.length > 0 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Predictions
          </h4>
          <div className="space-y-2">
            {analysis.predictions.map((pred, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-muted/50 border border-border/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{pred.title}</p>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[9px]",
                      pred.likelihood === 'high' ? 'border-severity-severe/50 text-severity-severe' :
                      pred.likelihood === 'medium' ? 'border-severity-moderate/50 text-severity-moderate' :
                      'border-muted-foreground/50 text-muted-foreground'
                    )}
                  >
                    {pred.likelihood} likelihood
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{pred.basedOn}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Personalized Recommendations
          </h4>
          <div className="space-y-2">
            {analysis.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10"
              >
                <div className="p-1 rounded-full bg-primary/10 mt-0.5">
                  <Heart className="w-3 h-3 text-primary" />
                </div>
                <p className="text-sm text-foreground">{rec}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
