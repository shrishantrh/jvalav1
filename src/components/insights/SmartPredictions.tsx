import { useState, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle, TrendingUp, Utensils, Clock, Cloud, ChevronDown, ChevronUp, Brain, Zap, ThermometerSun } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { FlareEntry } from "@/types/flare";
import { format, subDays, isWithinInterval } from 'date-fns';

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

// Stop words to filter out - expanded to prevent silly detections
const STOP_WORDS = new Set([
  'the', 'and', 'some', 'lot', 'bit', 'too', 'much', 'very', 'really', 
  'today', 'yesterday', 'just', 'like', 'been', 'have', 'had', 'was', 'were', 
  'that', 'this', 'with', 'good', 'great', 'bad', 'well', 'feeling', 'feel',
  'before', 'after', 'during', 'while', 'when', 'then', 'now', 'later',
  'morning', 'afternoon', 'evening', 'night', 'day', 'week', 'month',
  'went', 'going', 'doing', 'done', 'did', 'does', 'made', 'making',
  'got', 'get', 'getting', 'started', 'start', 'starting', 'stopped', 'stop',
  'came', 'come', 'coming', 'left', 'leave', 'leaving', 'took', 'take', 'taking',
  'said', 'say', 'saying', 'told', 'tell', 'telling', 'asked', 'ask', 'asking',
  'think', 'thinking', 'thought', 'know', 'knowing', 'knew', 'want', 'wanted',
  'need', 'needed', 'needing', 'tried', 'try', 'trying', 'used', 'use', 'using',
  'work', 'working', 'worked', 'home', 'office', 'place', 'thing', 'things',
  'time', 'times', 'first', 'last', 'next', 'other', 'another', 'same', 'different',
  'also', 'still', 'already', 'even', 'ever', 'never', 'always', 'usually', 'sometimes',
  'maybe', 'probably', 'definitely', 'actually', 'basically', 'especially',
  'around', 'about', 'into', 'onto', 'from', 'until', 'since', 'through',
  'over', 'under', 'above', 'below', 'between', 'among', 'within', 'without',
  'because', 'although', 'though', 'however', 'therefore', 'otherwise',
  'okay', 'fine', 'sure', 'right', 'wrong', 'better', 'worse', 'best', 'worst',
  'more', 'less', 'most', 'least', 'many', 'few', 'several', 'all', 'every', 'each',
  'both', 'either', 'neither', 'any', 'none', 'nothing', 'something', 'everything',
  'someone', 'anyone', 'everyone', 'nobody', 'anybody', 'everybody'
]);

// Extract REAL triggers from notes (food, activities, substances)
function extractTriggersFromNotes(entries: FlareEntry[]): Record<string, { count: number; severities: string[]; timestamps: string[] }> {
  const triggers: Record<string, { count: number; severities: string[]; timestamps: string[] }> = {};
  
  // More specific patterns for actual triggers
  const patterns = [
    /(?:ate|eaten|eat|eating|had|consumed|tried|tasted)\s+(?:some\s+)?(?:a\s+)?(\w+(?:\s+\w+)?)/gi,
    /(?:drank|drunk|drink|drinking)\s+(?:some\s+)?(?:a\s+)?(\w+(?:\s+\w+)?)/gi,
    /(\w+)\s+(?:for\s+)?(?:breakfast|lunch|dinner|snack|meal)/gi,
    /(?:exposure|exposed)\s+to\s+(\w+(?:\s+\w+)?)/gi,
    /(?:allergic|allergy|reaction)\s+(?:to\s+)?(\w+)/gi,
  ];
  
  entries.forEach(entry => {
    if (!entry.note) return;
    const note = entry.note.toLowerCase();
    
    patterns.forEach(pattern => {
      const matches = note.matchAll(pattern);
      for (const match of matches) {
        let trigger = match[1]?.trim();
        if (!trigger || trigger.length < 3) continue;
        
        // Filter out stop words
        const words = trigger.split(' ').filter(w => !STOP_WORDS.has(w) && w.length > 2);
        trigger = words.join(' ');
        
        // Must be a reasonable trigger word (not generic)
        if (trigger.length > 2 && trigger.length < 25 && !STOP_WORDS.has(trigger)) {
          if (!triggers[trigger]) {
            triggers[trigger] = { count: 0, severities: [], timestamps: [] };
          }
          triggers[trigger].count++;
          if (entry.severity) triggers[trigger].severities.push(entry.severity);
          triggers[trigger].timestamps.push(String(entry.timestamp));
        }
      }
    });
    
    // Also count explicit triggers from the triggers field
    entry.triggers?.forEach(t => {
      const trigger = t.toLowerCase().trim();
      if (trigger.length > 2 && !STOP_WORDS.has(trigger)) {
        if (!triggers[trigger]) {
          triggers[trigger] = { count: 0, severities: [], timestamps: [] };
        }
        triggers[trigger].count++;
        if (entry.severity) triggers[trigger].severities.push(entry.severity);
        triggers[trigger].timestamps.push(String(entry.timestamp));
      }
    });
  });
  
  return triggers;
}

// Analyze temporal patterns between entries
function findTemporalCorrelations(entries: FlareEntry[]): Array<{ trigger: string; symptom: string; avgDelayHours: number; count: number }> {
  const correlations: Record<string, { symptom: string; delays: number[]; count: number }> = {};
  
  const sorted = [...entries].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (!entry.note) continue;
    
    // More specific food pattern
    const foodMatch = entry.note.match(/(?:ate|eaten|eat|had|consumed)\s+(?:some\s+)?(?:a\s+)?(\w+)/i);
    if (!foodMatch) continue;
    
    const potentialTrigger = foodMatch[1].toLowerCase();
    if (STOP_WORDS.has(potentialTrigger) || potentialTrigger.length < 3) continue;
    
    for (let j = i + 1; j < sorted.length; j++) {
      const nextEntry = sorted[j];
      const timeDiff = (new Date(nextEntry.timestamp).getTime() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60);
      
      if (timeDiff > 6) break;
      
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
  
  return Object.entries(correlations)
    .filter(([_, data]) => data.count >= 2)
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
  const [isExpanded, setIsExpanded] = useState(false);

  const noteTriggers = useMemo(() => extractTriggersFromNotes(entries), [entries]);
  const temporalCorrelations = useMemo(() => findTemporalCorrelations(entries), [entries]);

  // Calculate risk score - must be before any early returns
  const riskScore = useMemo(() => {
    const last7Days = entries.filter(e => {
      const days = (Date.now() - new Date(e.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 7 && e.type === 'flare';
    });
    const severeCount = last7Days.filter(e => e.severity === 'severe').length;
    const moderateCount = last7Days.filter(e => e.severity === 'moderate').length;
    return Math.min(100, (severeCount * 25 + moderateCount * 15 + last7Days.length * 5));
  }, [entries]);

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
      const localPredictions = generateLocalPredictions(entries, noteTriggers, temporalCorrelations);
      setPredictions(localPredictions);
    } catch (error) {
      console.error('Prediction error:', error);
      const localPredictions = generateLocalPredictions(entries, noteTriggers, temporalCorrelations);
      setPredictions(localPredictions);
    } finally {
      setLoading(false);
      setHasGenerated(true);
    }
  };

  const generateLocalPredictions = (
    entries: FlareEntry[], 
    triggers: Record<string, { count: number; severities: string[] }>,
    correlations: Array<{ trigger: string; symptom: string; avgDelayHours: number; count: number }>
  ): Prediction[] => {
    const predictions: Prediction[] = [];
    const flares = entries.filter(e => e.type === 'flare');
    
    // Real trigger detection from notes
    const topTriggers = Object.entries(triggers)
      .filter(([name, _]) => !STOP_WORDS.has(name.toLowerCase()))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);
    
    topTriggers.forEach(([trigger, data]) => {
      if (data.count >= 2) {
        const severeCount = data.severities.filter(s => s === 'severe').length;
        const moderateCount = data.severities.filter(s => s === 'moderate').length;
        
        predictions.push({
          type: 'trigger',
          title: `Possible trigger: ${trigger}`,
          description: `"${trigger}" appears in ${data.count} entries${severeCount > 0 ? `, ${severeCount} severe` : ''}${moderateCount > 0 ? `, ${moderateCount} moderate` : ''}. Track this more closely.`,
          confidence: data.count >= 4 ? 'high' : data.count >= 2 ? 'medium' : 'low',
        });
      }
    });

    // Temporal correlations
    correlations.slice(0, 2).forEach(c => {
      predictions.push({
        type: 'insight',
        title: `${c.trigger} → ${c.symptom}`,
        description: `On ${c.count} occasions, "${c.trigger}" was followed by ${c.symptom} within ~${c.avgDelayHours.toFixed(1)} hours.`,
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
          title: `${percentage}% of flares in the ${timeLabel}`,
          description: `Most symptoms appear around ${hourNum > 12 ? hourNum - 12 : hourNum}${hourNum >= 12 ? 'PM' : 'AM'}. Consider adjusting activities or medication timing.`,
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
        title: `${percentage}% of flares during ${topWeather[0].toLowerCase()}`,
        description: `You've had ${topWeather[1]} flares during ${topWeather[0].toLowerCase()} conditions. Check the forecast.`,
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
        description: `${last7.length} flares this week vs ${prev7.length} last week. Review recent triggers.`,
        confidence: 'high',
      });
    } else if (last7.length < prev7.length * 0.5 && prev7.length > 2) {
      predictions.push({
        type: 'insight',
        title: 'Great progress!',
        description: `${last7.length} flares this week vs ${prev7.length} last week. Keep it up!`,
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

  // Only show predictions if we have meaningful ones
  const meaningfulPredictions = predictions.filter(p => 
    p.type !== 'tip' && p.confidence !== 'low'
  );

  if (meaningfulPredictions.length === 0 && !loading) {
    return null;
  }

  const displayPredictions = isExpanded ? meaningfulPredictions : meaningfulPredictions.slice(0, 2);

  const getRiskLevel = () => {
    if (riskScore >= 70) return { label: 'High Risk', color: 'text-severity-severe', bg: 'bg-severity-severe/10' };
    if (riskScore >= 40) return { label: 'Moderate', color: 'text-severity-moderate', bg: 'bg-severity-moderate/10' };
    return { label: 'Low Risk', color: 'text-severity-none', bg: 'bg-severity-none/10' };
  };

  const risk = getRiskLevel();

  return (
    <Card className="p-4 bg-gradient-card border shadow-soft overflow-hidden relative">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 animate-pulse-soft" />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <div className="p-1.5 rounded-lg bg-gradient-primary">
              <Brain className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            AI Predictions
          </h3>
          
          {/* Risk Score Badge */}
          <div className={`px-2.5 py-1 rounded-full ${risk.bg} flex items-center gap-1.5 animate-fade-in`}>
            <Zap className={`w-3 h-3 ${risk.color}`} />
            <span className={`text-[10px] font-medium ${risk.color}`}>{risk.label}</span>
          </div>
        </div>

        {/* Risk Score Bar */}
        <div className="mb-4">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-severity-none via-severity-moderate to-severity-severe transition-all duration-1000 ease-out"
              style={{ width: `${riskScore}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Weekly risk score: {riskScore}/100
          </p>
        </div>

        {meaningfulPredictions.length > 2 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute top-3 right-12 h-6 text-[10px] px-2"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
            {isExpanded ? 'Less' : `+${meaningfulPredictions.length - 2}`}
          </Button>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {displayPredictions.map((pred, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3 p-2.5 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 hover-lift cursor-default animate-fade-in"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className={`p-1.5 rounded-lg ${getIconBg(pred)} flex-shrink-0 transition-transform hover:scale-110`}>
                  {getIcon(pred)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium">{pred.title}</p>
                    <Badge 
                      variant="secondary" 
                      className={`text-[8px] px-1.5 py-0 ${
                        pred.confidence === 'high' ? 'bg-severity-none/20 text-severity-none' :
                        pred.confidence === 'medium' ? 'bg-severity-mild/20 text-severity-mild' :
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {pred.confidence}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{pred.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Next Flare Prediction */}
        {entries.length >= 5 && (
          <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <ThermometerSun className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">Next Flare Likelihood</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Based on your patterns, {riskScore >= 50 ? 'conditions suggest elevated risk today. Stay hydrated and watch for triggers.' : 'risk is low. Keep maintaining your healthy habits!'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
