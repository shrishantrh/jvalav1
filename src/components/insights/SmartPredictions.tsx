import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle, TrendingUp, Cloud, Calendar } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { FlareEntry } from "@/types/flare";

interface SmartPredictionsProps {
  entries: FlareEntry[];
  userConditions?: string[];
}

interface Prediction {
  type: 'risk' | 'insight' | 'tip';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  icon?: string;
}

export const SmartPredictions = ({ entries, userConditions = [] }: SmartPredictionsProps) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generatePredictions = async () => {
    if (entries.length < 5) {
      setPredictions([{
        type: 'tip',
        title: 'Keep logging!',
        description: 'Log at least 5 entries to unlock AI predictions.',
        confidence: 'medium',
      }]);
      setHasGenerated(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-suggestions', {
        body: {
          type: 'predict',
          entries: entries.slice(0, 30).map(e => ({
            type: e.type,
            severity: e.severity,
            symptoms: e.symptoms,
            triggers: e.triggers,
            timestamp: e.timestamp,
            environmentalData: e.environmentalData,
          })),
          conditions: userConditions,
        }
      });

      if (error) throw error;

      if (data?.predictions) {
        setPredictions(data.predictions);
      } else {
        // Fallback to local analysis
        const localPredictions = generateLocalPredictions(entries);
        setPredictions(localPredictions);
      }
    } catch (error) {
      console.error('Prediction error:', error);
      // Fallback to local analysis
      const localPredictions = generateLocalPredictions(entries);
      setPredictions(localPredictions);
    } finally {
      setLoading(false);
      setHasGenerated(true);
    }
  };

  // Local fallback predictions
  const generateLocalPredictions = (entries: FlareEntry[]): Prediction[] => {
    const predictions: Prediction[] = [];
    const flares = entries.filter(e => e.type === 'flare');
    
    // Time-based risk
    const hourCounts: Record<number, number> = {};
    flares.forEach(f => {
      const hour = new Date(f.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakHour) {
      const hourNum = parseInt(peakHour[0]);
      const count = peakHour[1];
      if (hourNum >= 18) {
        predictions.push({
          type: 'insight',
          title: 'Evening Pattern Detected',
          description: `${Math.round((count / flares.length) * 100)}% of your flares occur in the evening. Consider adjusting activities or medication timing.`,
          confidence: 'high',
        });
      }
    }

    // Weather pattern
    const weatherFlares: Record<string, number> = {};
    flares.forEach(f => {
      const condition = f.environmentalData?.weather?.condition;
      if (condition) {
        weatherFlares[condition] = (weatherFlares[condition] || 0) + 1;
      }
    });
    const topWeather = Object.entries(weatherFlares).sort((a, b) => b[1] - a[1])[0];
    if (topWeather && topWeather[1] >= 3) {
      predictions.push({
        type: 'risk',
        title: `Watch for ${topWeather[0]} Weather`,
        description: `${topWeather[1]} of your flares occurred during ${topWeather[0].toLowerCase()} conditions. Check the forecast and plan accordingly.`,
        confidence: 'medium',
      });
    }

    // Recent trend
    const last7 = flares.filter(f => {
      const days = (Date.now() - new Date(f.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 7;
    });
    const prev7 = flares.filter(f => {
      const days = (Date.now() - new Date(f.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return days > 7 && days <= 14;
    });
    
    if (last7.length > prev7.length * 1.5) {
      predictions.push({
        type: 'risk',
        title: 'Increased Flare Activity',
        description: 'Your flare frequency has increased this week. Consider reviewing recent triggers or consulting your healthcare provider.',
        confidence: 'high',
      });
    } else if (last7.length < prev7.length * 0.5 && prev7.length > 0) {
      predictions.push({
        type: 'insight',
        title: 'Great Progress! 🎉',
        description: 'Your flare frequency has decreased this week. Keep doing what works!',
        confidence: 'high',
      });
    }

    // Trigger detection
    const triggerCounts: Record<string, number> = {};
    flares.forEach(f => {
      f.triggers?.forEach(t => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });
    const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];
    if (topTrigger && topTrigger[1] >= 3) {
      predictions.push({
        type: 'tip',
        title: `Avoid ${topTrigger[0]}`,
        description: `This trigger has been linked to ${topTrigger[1]} of your flares. Consider reducing exposure.`,
        confidence: 'high',
      });
    }

    return predictions.slice(0, 3);
  };

  useEffect(() => {
    if (!hasGenerated && entries.length > 0) {
      generatePredictions();
    }
  }, [entries.length]);

  if (!hasGenerated && !loading) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-purple-500/5 border-0 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Predictions
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-xs"
          onClick={generatePredictions}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : predictions.length > 0 ? (
        <div className="space-y-3">
          {predictions.map((pred, idx) => (
            <div 
              key={idx}
              className="flex items-start gap-3 p-2 rounded-lg bg-background/50"
            >
              <div className={`p-1.5 rounded-full ${
                pred.type === 'risk' ? 'bg-severity-severe/10' :
                pred.type === 'insight' ? 'bg-primary/10' :
                'bg-severity-none/10'
              }`}>
                {pred.type === 'risk' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-severity-severe" />
                ) : pred.type === 'insight' ? (
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-severity-none" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{pred.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pred.description}</p>
                <Badge 
                  variant="outline" 
                  className="mt-1.5 text-[10px] h-4"
                >
                  {pred.confidence} confidence
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Keep logging to unlock personalized predictions
        </p>
      )}
    </Card>
  );
};
