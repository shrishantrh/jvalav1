import { useState, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle, TrendingUp, Utensils, Clock, Cloud, Activity } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { FlareEntry } from "@/types/flare";

interface SmartPredictionsProps {
  entries: FlareEntry[];
  userConditions?: string[];
}

interface Prediction {
  type: 'risk' | 'insight' | 'tip' | 'trigger';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  icon?: string;
}

// Extract potential triggers from notes using NLP-like patterns
function extractTriggersFromNotes(entries: FlareEntry[]): Record<string, { count: number; severities: string[]; timestamps: string[] }> {
  const triggers: Record<string, { count: number; severities: string[]; timestamps: string[] }> = {};
  
  const foodPatterns = [
    /(?:ate|eat|eating|had|consumed|tried)\s+(?:some\s+)?(\w+(?:\s+\w+)?)/gi,
    /after\s+(?:eating|having|drinking)\s+(\w+(?:\s+\w+)?)/gi,
    /(\w+)\s+(?:for\s+)?(?:breakfast|lunch|dinner|snack)/gi,
  ];
  
  const activityPatterns = [
    /(?:after|during|while)\s+(\w+ing)/gi,
    /(?:went|gone)\s+(\w+ing)/gi,
    /(?:did|done)\s+(?:some\s+)?(\w+)/gi,
  ];
  
  const exposurePatterns = [
    /(?:exposure|exposed)\s+to\s+(\w+(?:\s+\w+)?)/gi,
    /(?:around|near)\s+(\w+)/gi,
    /(?:contact\s+with)\s+(\w+)/gi,
  ];
  
  const stopWords = ['the', 'and', 'some', 'lot', 'bit', 'too', 'much', 'very', 'really', 
    'today', 'yesterday', 'just', 'like', 'been', 'have', 'had', 'was', 'were', 
    'that', 'this', 'with', 'good', 'great', 'bad', 'well', 'feeling', 'feel'];
  
  entries.forEach(entry => {
    if (!entry.note) return;
    const note = entry.note.toLowerCase();
    
    const allPatterns = [...foodPatterns, ...activityPatterns, ...exposurePatterns];
    
    allPatterns.forEach(pattern => {
      const matches = note.matchAll(pattern);
      for (const match of matches) {
        let trigger = match[1]?.trim();
        if (!trigger || trigger.length < 3) continue;
        
        // Clean up the trigger
        const words = trigger.split(' ').filter(w => !stopWords.includes(w) && w.length > 2);
        trigger = words.join(' ');
        
        if (trigger.length > 2 && trigger.length < 30) {
          if (!triggers[trigger]) {
            triggers[trigger] = { count: 0, severities: [], timestamps: [] };
          }
          triggers[trigger].count++;
          if (entry.severity) triggers[trigger].severities.push(entry.severity);
          triggers[trigger].timestamps.push(String(entry.timestamp));
        }
      }
    });
    
    // Also count explicit triggers
    entry.triggers?.forEach(t => {
      const trigger = t.toLowerCase();
      if (!triggers[trigger]) {
        triggers[trigger] = { count: 0, severities: [], timestamps: [] };
      }
      triggers[trigger].count++;
      if (entry.severity) triggers[trigger].severities.push(entry.severity);
      triggers[trigger].timestamps.push(String(entry.timestamp));
    });
  });
  
  return triggers;
}

// Analyze temporal patterns between entries (e.g., food → symptom within 4 hours)
function findTemporalCorrelations(entries: FlareEntry[]): Array<{ trigger: string; symptom: string; avgDelayHours: number; count: number }> {
  const correlations: Record<string, { symptom: string; delays: number[]; count: number }> = {};
  
  // Sort by timestamp
  const sorted = [...entries].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Look for patterns: note with food/activity followed by symptom within 6 hours
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (!entry.note) continue;
    
    // Extract potential cause from note
    const foodMatch = entry.note.match(/(?:ate|eat|eating|had)\s+(\w+)/i);
    if (!foodMatch) continue;
    
    const potentialTrigger = foodMatch[1].toLowerCase();
    
    // Look for symptoms in the next 6 hours
    for (let j = i + 1; j < sorted.length; j++) {
      const nextEntry = sorted[j];
      const timeDiff = (new Date(nextEntry.timestamp).getTime() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60);
      
      if (timeDiff > 6) break; // Only look 6 hours ahead
      
      if (nextEntry.type === 'flare' && nextEntry.symptoms?.length) {
        nextEntry.symptoms.forEach(symptom => {
          const key = `${potentialTrigger}→${symptom}`;
          if (!correlations[key]) {
            correlations[key] = { symptom, delays: [], count: 0 };
          }
          correlations[key].delays.push(timeDiff);
          correlations[key].count++;
        });
      }
    }
  }
  
  // Convert to array and calculate averages
  return Object.entries(correlations)
    .filter(([_, data]) => data.count >= 2) // Only patterns that occurred 2+ times
    .map(([key, data]) => ({
      trigger: key.split('→')[0],
      symptom: data.symptom,
      avgDelayHours: data.delays.reduce((a, b) => a + b, 0) / data.delays.length,
      count: data.count
    }))
    .sort((a, b) => b.count - a.count);
}

export const SmartPredictions = ({ entries, userConditions = [] }: SmartPredictionsProps) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Extract triggers from notes
  const noteTriggers = useMemo(() => extractTriggersFromNotes(entries), [entries]);
  const temporalCorrelations = useMemo(() => findTemporalCorrelations(entries), [entries]);

  const generatePredictions = async () => {
    if (entries.length < 3) {
      setPredictions([{
        type: 'tip',
        title: 'Keep logging!',
        description: 'Log at least 3 entries to unlock AI predictions.',
        confidence: 'medium',
      }]);
      setHasGenerated(true);
      return;
    }

    setLoading(true);
    try {
      // Build correlations for AI
      const correlations = [
        ...Object.entries(noteTriggers)
          .filter(([_, data]) => data.count >= 2)
          .slice(0, 5)
          .map(([trigger, data]) => ({
            factor: trigger,
            description: `Mentioned ${data.count}x, associated with ${data.severities.filter(s => s === 'severe' || s === 'moderate').length} moderate/severe flares`
          })),
        ...temporalCorrelations.slice(0, 3).map(c => ({
          factor: c.trigger,
          description: `Followed by ${c.symptom} within ${c.avgDelayHours.toFixed(1)}h (${c.count}x)`
        }))
      ];

      const { data, error } = await supabase.functions.invoke('generate-suggestions', {
        body: {
          type: 'predict',
          entries: entries.slice(0, 30).map(e => ({
            type: e.type,
            severity: e.severity,
            symptoms: e.symptoms,
            triggers: e.triggers,
            note: e.note,
            timestamp: e.timestamp,
            environmentalData: e.environmentalData,
          })),
          conditions: userConditions,
          correlations,
        }
      });

      if (error) throw error;

      if (data?.predictions) {
        // Enhance with local trigger analysis
        const localPredictions = generateLocalPredictions(entries, noteTriggers, temporalCorrelations);
        const combined = [...data.predictions, ...localPredictions]
          .slice(0, 5)
          .map((p: any) => ({
            ...p,
            confidence: p.confidence > 0.7 ? 'high' : p.confidence > 0.4 ? 'medium' : 'low'
          }));
        setPredictions(combined);
      } else {
        const localPredictions = generateLocalPredictions(entries, noteTriggers, temporalCorrelations);
        setPredictions(localPredictions);
      }
    } catch (error) {
      console.error('Prediction error:', error);
      const localPredictions = generateLocalPredictions(entries, noteTriggers, temporalCorrelations);
      setPredictions(localPredictions);
    } finally {
      setLoading(false);
      setHasGenerated(true);
    }
  };

  // Enhanced local fallback predictions
  const generateLocalPredictions = (
    entries: FlareEntry[], 
    triggers: Record<string, { count: number; severities: string[] }>,
    correlations: Array<{ trigger: string; symptom: string; avgDelayHours: number; count: number }>
  ): Prediction[] => {
    const predictions: Prediction[] = [];
    const flares = entries.filter(e => e.type === 'flare');
    
    // Trigger detection from notes - MOST IMPORTANT
    const topTriggers = Object.entries(triggers)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);
    
    topTriggers.forEach(([trigger, data]) => {
      if (data.count >= 2) {
        const severeCount = data.severities.filter(s => s === 'severe').length;
        const moderateCount = data.severities.filter(s => s === 'moderate').length;
        
        predictions.push({
          type: 'trigger',
          title: `Possible trigger: ${trigger}`,
          description: `"${trigger}" appears in ${data.count} entries${severeCount > 0 ? `, ${severeCount} severe` : ''}${moderateCount > 0 ? `, ${moderateCount} moderate` : ''}. Consider tracking this more closely.`,
          confidence: data.count >= 4 ? 'high' : data.count >= 2 ? 'medium' : 'low',
        });
      }
    });

    // Temporal correlations (e.g., eggs → symptoms)
    correlations.slice(0, 2).forEach(c => {
      predictions.push({
        type: 'insight',
        title: `${c.trigger} → ${c.symptom}`,
        description: `On ${c.count} occasions, "${c.trigger}" was followed by ${c.symptom} within ~${c.avgDelayHours.toFixed(1)} hours. This may be a trigger.`,
        confidence: c.count >= 3 ? 'high' : 'medium',
      });
    });
    
    // Time-based risk
    const hourCounts: Record<number, number> = {};
    flares.forEach(f => {
      const hour = new Date(f.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakHour && flares.length >= 5) {
      const hourNum = parseInt(peakHour[0]);
      const count = peakHour[1];
      const percentage = Math.round((count / flares.length) * 100);
      
      if (percentage >= 25) {
        const timeLabel = hourNum < 12 ? 'morning' : hourNum < 18 ? 'afternoon' : 'evening';
        predictions.push({
          type: 'insight',
          title: `${percentage}% of flares occur in the ${timeLabel}`,
          description: `Most of your symptoms appear around ${hourNum > 12 ? hourNum - 12 : hourNum}${hourNum >= 12 ? 'PM' : 'AM'}. Consider adjusting activities or medication timing.`,
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
      const percentage = Math.round((topWeather[1] / flares.length) * 100);
      predictions.push({
        type: 'risk',
        title: `${percentage}% of flares during ${topWeather[0].toLowerCase()} weather`,
        description: `You've had ${topWeather[1]} flares during ${topWeather[0].toLowerCase()} conditions. Check the forecast and prepare accordingly.`,
        confidence: percentage >= 40 ? 'high' : 'medium',
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
    
    if (last7.length > prev7.length * 1.5 && prev7.length > 0) {
      predictions.push({
        type: 'risk',
        title: 'Flares increasing this week',
        description: `${last7.length} flares this week vs ${prev7.length} last week. Review recent triggers or consult your healthcare provider.`,
        confidence: 'high',
      });
    } else if (last7.length < prev7.length * 0.5 && prev7.length > 2) {
      predictions.push({
        type: 'insight',
        title: 'Great progress!',
        description: `${last7.length} flares this week vs ${prev7.length} last week. Keep doing what works!`,
        confidence: 'high',
      });
    }

    return predictions.slice(0, 5);
  };

  useEffect(() => {
    if (!hasGenerated && entries.length > 0) {
      generatePredictions();
    }
  }, [entries.length]);

  const getIcon = (prediction: Prediction) => {
    if (prediction.type === 'trigger') return <Utensils className="w-3.5 h-3.5 text-severity-moderate" />;
    if (prediction.type === 'risk') return <AlertTriangle className="w-3.5 h-3.5 text-severity-severe" />;
    if (prediction.type === 'insight') return <TrendingUp className="w-3.5 h-3.5 text-primary" />;
    return <Sparkles className="w-3.5 h-3.5 text-severity-none" />;
  };

  const getIconBg = (prediction: Prediction) => {
    if (prediction.type === 'trigger') return 'bg-severity-moderate/10';
    if (prediction.type === 'risk') return 'bg-severity-severe/10';
    if (prediction.type === 'insight') return 'bg-primary/10';
    return 'bg-severity-none/10';
  };

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
              <div className={`p-1.5 rounded-full ${getIconBg(pred)}`}>
                {getIcon(pred)}
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