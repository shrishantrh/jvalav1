import { useState } from 'react';
import { FlareEntry } from '@/types/flare';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  Thermometer, 
  Droplets, 
  Wind,
  Heart,
  Moon,
  Footprints,
  Activity,
  Clock,
  FileText,
  Share2,
  Download,
  Stethoscope,
  Zap,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedFlareHistoryProps {
  entries: FlareEntry[];
  onUpdate?: (entryId: string, updates: Partial<FlareEntry>) => void;
  onDelete?: (entryId: string) => void;
  onGenerateClinicalRecord?: (entry: FlareEntry) => void;
}

export const EnhancedFlareHistory = ({ 
  entries, 
  onUpdate, 
  onDelete,
  onGenerateClinicalRecord 
}: EnhancedFlareHistoryProps) => {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSeverityStyles = (severity?: string) => {
    switch (severity) {
      case 'severe': return { bg: 'bg-severity-severe', text: 'text-white', border: 'border-severity-severe' };
      case 'moderate': return { bg: 'bg-severity-moderate', text: 'text-white', border: 'border-severity-moderate' };
      case 'mild': return { bg: 'bg-severity-mild', text: 'text-foreground', border: 'border-severity-mild' };
      default: return { bg: 'bg-muted', text: 'text-foreground', border: 'border-muted' };
    }
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'flare': return <Zap className="w-4 h-4" />;
      case 'energy': return <Activity className="w-4 h-4" />;
      case 'medication': return <Stethoscope className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No entries for this date</p>
        <p className="text-xs text-muted-foreground mt-1">Start logging to see your history</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const isExpanded = expandedEntries.has(entry.id);
        const severity = getSeverityStyles(entry.severity);
        const hasEnvData = entry.environmentalData?.weather || entry.environmentalData?.location;
        const hasPhysData = entry.physiologicalData;
        const hasDetailedData = hasEnvData || hasPhysData;

        return (
          <Collapsible key={entry.id} open={isExpanded} onOpenChange={() => toggleExpand(entry.id)}>
            <Card className={cn(
              "overflow-hidden transition-all duration-200",
              isExpanded ? "ring-2 ring-primary/20" : "",
              entry.type === 'flare' && `border-l-4 ${severity.border}`
            )}>
              {/* Header - Always Visible */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Severity/Type Indicator */}
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    entry.type === 'flare' ? severity.bg : 'bg-primary/10'
                  )}>
                    <span className={entry.type === 'flare' ? severity.text : 'text-primary'}>
                      {getEntryIcon(entry.type)}
                    </span>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold capitalize">{entry.type}</span>
                      {entry.severity && (
                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px] capitalize", 
                            entry.severity === 'severe' && 'border-severity-severe text-severity-severe',
                            entry.severity === 'moderate' && 'border-severity-moderate text-severity-moderate',
                            entry.severity === 'mild' && 'border-severity-mild text-severity-mild'
                          )}
                        >
                          {entry.severity}
                        </Badge>
                      )}
                      {hasDetailedData && (
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                          Rich Data
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      {format(entry.timestamp, 'h:mm a')} • {format(entry.timestamp, 'EEEE, MMMM d')}
                    </p>

                    {/* Symptoms */}
                    {entry.symptoms && entry.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {entry.symptoms.slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] bg-muted/50">
                            {s}
                          </Badge>
                        ))}
                        {entry.symptoms.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{entry.symptoms.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Note Preview */}
                    {entry.note && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{entry.note}</p>
                    )}
                  </div>

                  {/* Expand Button */}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>

              {/* Expanded Content */}
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-4 border-t pt-4">
                  {/* Environmental Data */}
                  {hasEnvData && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                        <MapPin className="w-3.5 h-3.5" />
                        Environmental Context
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {entry.environmentalData?.location?.city && (
                          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                              <span className="text-[10px] text-muted-foreground uppercase">Location</span>
                            </div>
                            <p className="text-sm font-medium">{entry.environmentalData.location.city}</p>
                          </div>
                        )}
                        
                        {entry.environmentalData?.weather?.temperature && (
                          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex items-center gap-2 mb-1">
                              <Thermometer className="w-3.5 h-3.5 text-severity-moderate" />
                              <span className="text-[10px] text-muted-foreground uppercase">Temp</span>
                            </div>
                            <p className="text-sm font-medium">{entry.environmentalData.weather.temperature}°F</p>
                          </div>
                        )}
                        
                        {entry.environmentalData?.weather?.humidity && (
                          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex items-center gap-2 mb-1">
                              <Droplets className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-[10px] text-muted-foreground uppercase">Humidity</span>
                            </div>
                            <p className="text-sm font-medium">{entry.environmentalData.weather.humidity}%</p>
                          </div>
                        )}
                        
                        {entry.environmentalData?.weather?.condition && (
                          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex items-center gap-2 mb-1">
                              <Wind className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground uppercase">Condition</span>
                            </div>
                            <p className="text-sm font-medium capitalize">{entry.environmentalData.weather.condition}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Physiological Data */}
                  {hasPhysData && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                        <Activity className="w-3.5 h-3.5" />
                        Physiological Metrics
                      </h4>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {entry.physiologicalData?.heartRate && (
                          <div className="p-3 rounded-lg bg-severity-severe/10 border border-severity-severe/20">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Heart className="w-3.5 h-3.5 text-severity-severe" />
                              <span className="text-[10px] text-muted-foreground">HR</span>
                            </div>
                            <p className="text-lg font-bold">{entry.physiologicalData.heartRate}</p>
                            <p className="text-[10px] text-muted-foreground">bpm</p>
                          </div>
                        )}
                        
                        {entry.physiologicalData?.sleepHours && (
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Moon className="w-3.5 h-3.5 text-primary" />
                              <span className="text-[10px] text-muted-foreground">Sleep</span>
                            </div>
                            <p className="text-lg font-bold">{entry.physiologicalData.sleepHours}</p>
                            <p className="text-[10px] text-muted-foreground">hours</p>
                          </div>
                        )}
                        
                        {entry.physiologicalData?.steps && (
                          <div className="p-3 rounded-lg bg-severity-none/10 border border-severity-none/20">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Footprints className="w-3.5 h-3.5 text-severity-none" />
                              <span className="text-[10px] text-muted-foreground">Steps</span>
                            </div>
                            <p className="text-lg font-bold">{entry.physiologicalData.steps.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">today</p>
                          </div>
                        )}

                        {entry.physiologicalData?.stressLevel && (
                          <div className="p-3 rounded-lg bg-severity-moderate/10 border border-severity-moderate/20">
                            <div className="flex items-center gap-1.5 mb-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-severity-moderate" />
                              <span className="text-[10px] text-muted-foreground">Stress</span>
                            </div>
                            <p className="text-lg font-bold">{entry.physiologicalData.stressLevel}/10</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Triggers */}
                  {entry.triggers && entry.triggers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Triggers</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.triggers.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Note */}
                  {entry.note && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</h4>
                      <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg">{entry.note}</p>
                    </div>
                  )}

                  {/* Clinical Record Actions */}
                  <div className="pt-3 border-t border-border/50">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 gap-1.5 text-xs h-9"
                        onClick={() => onGenerateClinicalRecord?.(entry)}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Generate Clinical Record
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1.5 text-xs h-9"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1.5 text-xs h-9"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
};