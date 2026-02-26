import { useState, useEffect } from 'react';
import { parseBold } from '@/lib/renderBold';
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
  Activity,
  Heart,
  Shield,
  Bell,
  MessageCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { FlareEntry } from "@/types/flare";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface AIInsightsPanelProps {
  entries: FlareEntry[];
  userConditions?: string[];
  onStartProtocol?: (recommendation: string) => void;
  onNavigateToChat?: (prompt: string) => void;
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

// Cache AI insights to prevent constant reloading
const analysisCache = new Map<string, { analysis: AIAnalysis; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const AIInsightsPanel = ({ entries, userConditions = [], onStartProtocol, onNavigateToChat }: AIInsightsPanelProps) => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(() => {
    if (user?.id) {
      const cached = analysisCache.get(user.id);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.analysis;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(() => {
    if (user?.id) {
      const cached = analysisCache.get(user.id);
      return !!(cached && Date.now() - cached.timestamp < CACHE_DURATION);
    }
    return false;
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['insights']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const fetchAIInsights = async (forceRefresh = false) => {
    if (!user) return;
    
    if (!forceRefresh) {
      const cached = analysisCache.get(user.id);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setAnalysis(cached.analysis);
        setHasAnalyzed(true);
        return;
      }
    }
    
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
        analysisCache.set(user.id, { analysis: data, timestamp: Date.now() });
      }
    } catch (err) {
      console.error('AI Insights error:', err);
      setError('Failed to generate insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsights = () => fetchAIInsights(true);

  useEffect(() => {
    if (user && entries.length >= 5 && !hasAnalyzed) {
      fetchAIInsights();
    }
  }, [user?.id, entries.length]);

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

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'trigger': return <Zap className="w-3.5 h-3.5" />;
      case 'recommendation': return <Lightbulb className="w-3.5 h-3.5" />;
      default: return <Target className="w-3.5 h-3.5" />;
    }
  };

  const getInsightColors = (type: string) => {
    switch (type) {
      case 'warning': return { bg: 'bg-severity-severe/10', text: 'text-severity-severe' };
      case 'success': return { bg: 'bg-severity-none/10', text: 'text-severity-none' };
      case 'trigger': return { bg: 'bg-severity-moderate/10', text: 'text-severity-moderate' };
      case 'recommendation': return { bg: 'bg-primary/10', text: 'text-primary' };
      default: return { bg: 'bg-accent', text: 'text-accent-foreground' };
    }
  };

  const handleChatWithRecommendation = (rec: string) => {
    const prompt = `I want to create a health protocol based on this recommendation: "${rec}". Help me break this down into actionable steps with a schedule I can follow.`;
    onNavigateToChat?.(prompt);
  };

  if (entries.length < 5) {
    return (
      <Card className="p-5 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-primary">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Health Analysis</h3>
            <p className="text-[10px] text-muted-foreground">Powered by Gemini</p>
          </div>
        </div>
        <div className="text-center py-6">
          <Sparkles className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs font-medium">Need more data</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Log {5 - entries.length} more {5 - entries.length === 1 ? 'entry' : 'entries'} to unlock
          </p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-5 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-primary animate-pulse">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Analyzing...</h3>
            <p className="text-[10px] text-muted-foreground">AI is reviewing your patterns</p>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </Card>
    );
  }

  if (error || !analysis) {
    return (
      <Card className="p-5 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-gradient-primary">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Health Analysis</h3>
            <p className="text-[10px] text-muted-foreground">Powered by Gemini</p>
          </div>
        </div>
        <Button onClick={generateAIInsights} className="w-full bg-gradient-primary hover:opacity-90" size="sm">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Insights
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Health Score Compact Card */}
      <Card className="p-4 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="none" className="text-muted/30" />
                <circle
                  cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"
                  className={getHealthScoreColor(analysis.healthScore)}
                  strokeDasharray={`${(analysis.healthScore / 100) * 151} 151`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-lg font-bold", getHealthScoreColor(analysis.healthScore))}>
                  {analysis.healthScore}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                {getTrendIcon(analysis.trend)}
                <span className="text-sm font-medium capitalize">{analysis.trend}</span>
              </div>
              <p className="text-[10px] text-muted-foreground max-w-[180px] line-clamp-2">
                {parseBold(analysis.summary)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={generateAIInsights} className="h-8 w-8" title="Refresh insights">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </Card>

      {/* Key Insights */}
      {analysis.insights && analysis.insights.length > 0 && (
        <Card className="p-3 bg-gradient-card border-0 shadow-soft">
          <button
            onClick={() => toggleSection('insights')}
            className="w-full flex items-center justify-between mb-2"
          >
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Key Insights ({analysis.insights.length})
            </h4>
            {expandedSections.has('insights') ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          
          {expandedSections.has('insights') && (
            <div className="space-y-1.5">
              {analysis.insights.slice(0, 4).map((insight, idx) => {
                const colors = getInsightColors(insight.type);
                return (
                  <div key={idx} className={cn("p-2.5 rounded-lg flex items-start gap-2", colors.bg)}>
                    <span className={cn("mt-0.5", colors.text)}>{getInsightIcon(insight.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight">{insight.title}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{parseBold(insight.description)}</p>
                    </div>
                    <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">
                      {insight.confidence}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Predictions */}
      {analysis.predictions && analysis.predictions.length > 0 && (
        <Card className="p-3 bg-gradient-card border-0 shadow-soft">
          <button
            onClick={() => toggleSection('predictions')}
            className="w-full flex items-center justify-between mb-2"
          >
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-primary" />
              Predictions ({analysis.predictions.length})
            </h4>
            {expandedSections.has('predictions') ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          
          {expandedSections.has('predictions') && (
            <div className="space-y-1.5">
              {analysis.predictions.map((pred, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-muted/50 flex items-center justify-between">
                  <p className="text-xs font-medium">{pred.title}</p>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[8px] px-1.5",
                      pred.likelihood === 'high' ? 'border-severity-severe/50 text-severity-severe' :
                      pred.likelihood === 'medium' ? 'border-severity-moderate/50 text-severity-moderate' :
                      'border-muted-foreground/50'
                    )}
                  >
                    {pred.likelihood}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Actionable Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <Card className="p-3 bg-gradient-card border-0 shadow-soft">
          <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
            <Shield className="w-3.5 h-3.5 text-primary" />
            Action Plan
          </h4>
          <div className="space-y-2">
            {analysis.recommendations.map((rec, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-start gap-2">
                  <div className="p-1 rounded-full bg-primary/10 mt-0.5 shrink-0">
                    <Heart className="w-2.5 h-2.5 text-primary" />
                  </div>
                  <p className="text-xs text-foreground flex-1">{parseBold(rec)}</p>
                </div>
                
                {/* Action buttons */}
                <div className="flex gap-2 mt-2 ml-6">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] gap-1 flex-1"
                    onClick={() => handleChatWithRecommendation(rec)}
                  >
                    <MessageCircle className="w-3 h-3" />
                    Chat
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] gap-1"
                    onClick={() => {
                      // TODO: Set up reminder for this
                    }}
                  >
                    <Bell className="w-3 h-3" />
                    Remind
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};