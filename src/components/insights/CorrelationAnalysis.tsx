import { useMemo, useState } from "react";
import { parseBold } from '@/lib/renderBold';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Sun,
  Moon,
  Thermometer,
  Droplets,
  Wind,
  Loader2,
  Brain,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CorrelationAnalysisProps {
  entries: FlareEntry[];
  userConditions?: string[];
}

interface Correlation {
  factor: string;
  type: 'symptom' | 'trigger' | 'environmental' | 'time' | 'physiological';
  correlation: number; // -1 to 1
  confidence: 'low' | 'medium' | 'high';
  description: string;
  icon?: React.ReactNode;
}

interface Prediction {
  type: 'risk' | 'insight';
  title: string;
  description: string;
  confidence: number;
}

export const CorrelationAnalysis = ({ entries, userConditions = [] }: CorrelationAnalysisProps) => {
  const [aiPredictions, setAiPredictions] = useState<Prediction[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const { toast } = useToast();

  const correlations = useMemo(() => {
    const results: Correlation[] = [];
    const flares = entries.filter(e => e.type === 'flare');
    
    if (flares.length < 3) return results;

    // Symptom frequency analysis
    const symptomCounts: Record<string, { total: number; withSevere: number }> = {};
    flares.forEach(flare => {
      const isSevere = flare.severity === 'severe' || flare.severity === 'moderate';
      flare.symptoms?.forEach(symptom => {
        if (!symptomCounts[symptom]) {
          symptomCounts[symptom] = { total: 0, withSevere: 0 };
        }
        symptomCounts[symptom].total++;
        if (isSevere) symptomCounts[symptom].withSevere++;
      });
    });

    Object.entries(symptomCounts)
      .filter(([_, data]) => data.total >= 2)
      .forEach(([symptom, data]) => {
        const severity = data.withSevere / data.total;
        results.push({
          factor: symptom,
          type: 'symptom',
          correlation: severity,
          confidence: data.total >= 5 ? 'high' : data.total >= 3 ? 'medium' : 'low',
          description: `${Math.round(severity * 100)}% of flares with this symptom were moderate/severe`,
        });
      });

    // Time of day analysis
    const hourBuckets: Record<string, number[]> = {
      'Morning (6-12)': [],
      'Afternoon (12-18)': [],
      'Evening (18-22)': [],
      'Night (22-6)': [],
    };

    flares.forEach(flare => {
      const hour = flare.timestamp.getHours();
      const severityScore = flare.severity === 'severe' ? 3 : flare.severity === 'moderate' ? 2 : 1;
      
      if (hour >= 6 && hour < 12) hourBuckets['Morning (6-12)'].push(severityScore);
      else if (hour >= 12 && hour < 18) hourBuckets['Afternoon (12-18)'].push(severityScore);
      else if (hour >= 18 && hour < 22) hourBuckets['Evening (18-22)'].push(severityScore);
      else hourBuckets['Night (22-6)'].push(severityScore);
    });

    Object.entries(hourBuckets)
      .filter(([_, scores]) => scores.length >= 2)
      .forEach(([period, scores]) => {
        const avgSeverity = scores.reduce((a, b) => a + b, 0) / scores.length / 3;
        const icon = period.includes('Morning') ? <Sun className="w-4 h-4" /> :
                     period.includes('Night') ? <Moon className="w-4 h-4" /> : null;
        
        results.push({
          factor: period,
          type: 'time',
          correlation: avgSeverity,
          confidence: scores.length >= 5 ? 'high' : 'medium',
          description: `${scores.length} flares recorded during this period`,
          icon,
        });
      });

    // Environmental correlations
    const envData = flares.filter(f => f.environmentalData?.weather);
    if (envData.length >= 3) {
      const tempCorrelation = calculateWeatherCorrelation(envData, 'temperature');
      const humidityCorrelation = calculateWeatherCorrelation(envData, 'humidity');
      const pressureCorrelation = calculateWeatherCorrelation(envData, 'pressure');

      if (Math.abs(tempCorrelation) > 0.3) {
        results.push({
          factor: 'Temperature',
          type: 'environmental',
          correlation: tempCorrelation,
          confidence: envData.length >= 10 ? 'high' : 'medium',
          description: tempCorrelation > 0 
            ? 'Flares tend to be worse in warmer conditions'
            : 'Flares tend to be worse in colder conditions',
          icon: <Thermometer className="w-4 h-4" />,
        });
      }

      if (Math.abs(humidityCorrelation) > 0.3) {
        results.push({
          factor: 'Humidity',
          type: 'environmental',
          correlation: humidityCorrelation,
          confidence: envData.length >= 10 ? 'high' : 'medium',
          description: humidityCorrelation > 0
            ? 'Higher humidity correlates with worse flares'
            : 'Lower humidity correlates with worse flares',
          icon: <Droplets className="w-4 h-4" />,
        });
      }

      if (Math.abs(pressureCorrelation) > 0.3) {
        results.push({
          factor: 'Barometric Pressure',
          type: 'environmental',
          correlation: pressureCorrelation,
          confidence: envData.length >= 10 ? 'high' : 'medium',
          description: 'Pressure changes may be affecting your symptoms',
          icon: <Wind className="w-4 h-4" />,
        });
      }
    }

    return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 8);
  }, [entries]);

  const generateAIPredictions = async () => {
    if (entries.length < 5) {
      toast({
        title: "Not enough data",
        description: "Log at least 5 entries for AI predictions",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-suggestions', {
        body: { 
          entries: entries.slice(0, 50).map(e => ({
            type: e.type,
            severity: e.severity,
            symptoms: e.symptoms,
            triggers: e.triggers,
            timestamp: e.timestamp.toISOString(),
            environmentalData: e.environmentalData,
            physiologicalData: e.physiologicalData,
          })),
          userConditions,
          correlations: correlations.slice(0, 5),
        }
      });

      if (error) throw error;

      if (data?.predictions) {
        setAiPredictions(data.predictions);
      }
    } catch (error) {
      console.error('AI prediction error:', error);
      toast({
        title: "AI analysis failed",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAI(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Correlation Cards */}
      <Card className="p-4 shadow-soft bg-gradient-card border-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Pattern Analysis</h3>
          <Badge variant="outline" className="text-xs">
            {entries.length} entries analyzed
          </Badge>
        </div>

        {correlations.length === 0 ? (
          <div className="text-center py-6">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Log more entries to see patterns
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              We need at least 3 flares to analyze
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {correlations.map((corr, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  corr.correlation > 0.5 ? "bg-severity-severe/20 text-severity-severe" :
                  corr.correlation > 0.3 ? "bg-severity-moderate/20 text-severity-moderate" :
                  "bg-muted text-muted-foreground"
                )}>
                  {corr.icon || (corr.correlation > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{corr.factor}</span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] h-4",
                        corr.confidence === 'high' ? "border-severity-none text-severity-none" :
                        corr.confidence === 'medium' ? "border-severity-moderate text-severity-moderate" :
                        "border-muted-foreground"
                      )}
                    >
                      {corr.confidence}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{parseBold(corr.description)}</p>
                </div>

                <div className="text-right">
                  <div className={cn(
                    "text-sm font-bold",
                    corr.correlation > 0.5 ? "text-severity-severe" :
                    corr.correlation > 0.3 ? "text-severity-moderate" :
                    "text-muted-foreground"
                  )}>
                    {Math.round(corr.correlation * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI Predictions */}
      <Card className="p-4 shadow-soft bg-gradient-card border-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium">AI Predictions</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generateAIPredictions}
            disabled={isLoadingAI}
            className="h-7 text-xs"
          >
            {isLoadingAI ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            {aiPredictions.length > 0 ? 'Refresh' : 'Generate'}
          </Button>
        </div>

        {aiPredictions.length === 0 && !isLoadingAI ? (
          <div className="text-center py-6">
            <Brain className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Get AI-powered predictions based on your data
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click Generate to analyze your patterns
            </p>
          </div>
        ) : isLoadingAI ? (
          <div className="text-center py-6">
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing your patterns...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {aiPredictions.map((pred, index) => (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-lg border",
                  pred.type === 'risk' 
                    ? "bg-severity-moderate/10 border-severity-moderate/30" 
                    : "bg-primary/10 border-primary/30"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{pred.title}</span>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {Math.round(pred.confidence * 100)}% confident
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{pred.description}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// Helper function to calculate weather correlation
function calculateWeatherCorrelation(entries: FlareEntry[], metric: 'temperature' | 'humidity' | 'pressure'): number {
  const dataPoints = entries
    .filter(e => e.environmentalData?.weather && e.severity)
    .map(e => ({
      value: e.environmentalData!.weather![metric],
      severity: e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1,
    }));

  if (dataPoints.length < 3) return 0;

  // Simple correlation calculation
  const n = dataPoints.length;
  const sumX = dataPoints.reduce((a, b) => a + b.value, 0);
  const sumY = dataPoints.reduce((a, b) => a + b.severity, 0);
  const sumXY = dataPoints.reduce((a, b) => a + b.value * b.severity, 0);
  const sumX2 = dataPoints.reduce((a, b) => a + b.value ** 2, 0);
  const sumY2 = dataPoints.reduce((a, b) => a + b.severity ** 2, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

  if (denominator === 0) return 0;
  return Math.max(-1, Math.min(1, numerator / denominator));
}
