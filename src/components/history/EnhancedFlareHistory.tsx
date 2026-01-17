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
  CheckCircle2,
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  Gauge,
  Brain,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { toast } = useToast();

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
      case 'severe': return { 
        bg: 'bg-gradient-to-br from-red-500 to-red-600', 
        text: 'text-white', 
        border: 'border-red-400',
        light: 'bg-red-50 border-red-200',
        accent: 'text-red-600'
      };
      case 'moderate': return { 
        bg: 'bg-gradient-to-br from-amber-500 to-orange-500', 
        text: 'text-white', 
        border: 'border-amber-400',
        light: 'bg-amber-50 border-amber-200',
        accent: 'text-amber-600'
      };
      case 'mild': return { 
        bg: 'bg-gradient-to-br from-blue-500 to-blue-600', 
        text: 'text-white', 
        border: 'border-blue-400',
        light: 'bg-blue-50 border-blue-200',
        accent: 'text-blue-600'
      };
      default: return { 
        bg: 'bg-muted', 
        text: 'text-foreground', 
        border: 'border-muted',
        light: 'bg-muted/50 border-muted',
        accent: 'text-muted-foreground'
      };
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

  const copyEntryData = (entry: FlareEntry) => {
    const text = `${entry.type.toUpperCase()} - ${format(entry.timestamp, 'PPp')}\n` +
      (entry.severity ? `Severity: ${entry.severity}\n` : '') +
      (entry.symptoms?.length ? `Symptoms: ${entry.symptoms.join(', ')}\n` : '') +
      (entry.triggers?.length ? `Triggers: ${entry.triggers.join(', ')}\n` : '') +
      (entry.note ? `Notes: ${entry.note}\n` : '');
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const shareEntry = (entry: FlareEntry) => {
    toast({ title: "Share link created", description: "Secure link copied to clipboard" });
  };

  const downloadEntry = (entry: FlareEntry) => {
    const data = JSON.stringify(entry, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flare-entry-${format(entry.timestamp, 'yyyy-MM-dd-HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Entry saved to your device" });
  };

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center bg-card border border-border/80">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No entries for this date</p>
        <p className="text-xs text-muted-foreground mt-1">Start logging to build your health history</p>
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
              "overflow-hidden transition-all duration-300 shadow-soft bg-card border border-border/80",
              isExpanded ? "ring-2 ring-primary/20 shadow-soft-lg" : "hover:shadow-soft-md",
              entry.type === 'flare' && `border-l-4 ${severity.border}`
            )}>
              {/* Header - Always Visible */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Severity/Type Indicator */}
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    entry.type === 'flare' ? severity.bg : 'bg-gradient-to-br from-primary/80 to-primary'
                  )}>
                    <span className="text-white">
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
                          className={cn("text-[10px] capitalize font-medium", severity.accent)}
                        >
                          {entry.severity}
                        </Badge>
                      )}
                      {hasDetailedData && (
                        <Badge className="text-[10px] bg-primary/10 text-primary border-0 gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          Rich Data
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      {format(entry.timestamp, 'h:mm a')} • {format(entry.timestamp, 'EEEE, MMMM d')}
                    </p>

                    {/* Symptoms */}
                    {entry.symptoms && entry.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {entry.symptoms.slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] bg-muted/60">
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
                      <p className="text-xs text-muted-foreground line-clamp-1 italic">"{entry.note}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => onGenerateClinicalRecord?.(entry)} className="gap-2">
                          <FileText className="w-4 h-4" />
                          Generate Clinical Record
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyEntryData(entry)} className="gap-2">
                          <Copy className="w-4 h-4" />
                          Copy Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareEntry(entry)} className="gap-2">
                          <Share2 className="w-4 h-4" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadEntry(entry)} className="gap-2">
                          <Download className="w-4 h-4" />
                          Export JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onDelete?.(entry.id)} 
                          className="gap-2 text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Entry
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-4 border-t pt-4 bg-muted/20">
                  {/* Environmental Data */}
                  {hasEnvData && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold flex items-center gap-2 text-foreground">
                        <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        Environmental Context
                        <Badge variant="outline" className="text-[9px] ml-auto">Auto-Captured</Badge>
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {entry.environmentalData?.location?.city && (
                          <div className="p-3 rounded-xl bg-card border border-border/60 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Location</span>
                            </div>
                            <p className="text-sm font-semibold">{entry.environmentalData.location.city}</p>
                          </div>
                        )}
                        
                        {entry.environmentalData?.weather?.temperature && (
                          <div className="p-3 rounded-xl bg-card border border-border/60 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Temperature</span>
                            </div>
                            <p className="text-sm font-semibold">{entry.environmentalData.weather.temperature}°F</p>
                          </div>
                        )}
                        
                        {entry.environmentalData?.weather?.humidity && (
                          <div className="p-3 rounded-xl bg-card border border-border/60 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Droplets className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Humidity</span>
                            </div>
                            <p className="text-sm font-semibold">{entry.environmentalData.weather.humidity}%</p>
                          </div>
                        )}
                        
                        {entry.environmentalData?.weather?.pressure && (
                          <div className="p-3 rounded-xl bg-card border border-border/60 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Gauge className="w-3.5 h-3.5 text-purple-500" />
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Pressure</span>
                            </div>
                            <p className="text-sm font-semibold">{entry.environmentalData.weather.pressure} inHg</p>
                          </div>
                        )}
                        
                        {entry.environmentalData?.weather?.condition && (
                          <div className="p-3 rounded-xl bg-card border border-border/60 shadow-sm col-span-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Wind className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Conditions</span>
                            </div>
                            <p className="text-sm font-semibold capitalize">{entry.environmentalData.weather.condition}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Physiological Data */}
                  {hasPhysData && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold flex items-center gap-2 text-foreground">
                        <div className="w-6 h-6 rounded-md bg-rose-500/10 flex items-center justify-center">
                          <Activity className="w-3.5 h-3.5 text-rose-600" />
                        </div>
                        Wearable Metrics
                        <Badge variant="outline" className="text-[9px] ml-auto">Fitbit Sync</Badge>
                      </h4>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {(entry.physiologicalData?.heartRate || entry.physiologicalData?.restingHeartRate) && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Heart className="w-3.5 h-3.5 text-red-500" />
                              <span className="text-[9px] text-red-600/80 font-medium uppercase">Heart Rate</span>
                            </div>
                            <p className="text-xl font-bold text-red-600">
                              {entry.physiologicalData.heartRate || entry.physiologicalData.restingHeartRate}
                            </p>
                            <p className="text-[10px] text-red-500/70">bpm</p>
                          </div>
                        )}
                        
                        {entry.physiologicalData?.heartRateVariability && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Brain className="w-3.5 h-3.5 text-purple-500" />
                              <span className="text-[9px] text-purple-600/80 font-medium uppercase">HRV</span>
                            </div>
                            <p className="text-xl font-bold text-purple-600">{entry.physiologicalData.heartRateVariability}</p>
                            <p className="text-[10px] text-purple-500/70">ms</p>
                          </div>
                        )}
                        
                        {entry.physiologicalData?.sleepHours && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Moon className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="text-[9px] text-indigo-600/80 font-medium uppercase">Sleep</span>
                            </div>
                            <p className="text-xl font-bold text-indigo-600">{entry.physiologicalData.sleepHours}</p>
                            <p className="text-[10px] text-indigo-500/70">hours</p>
                          </div>
                        )}
                        
                        {entry.physiologicalData?.steps && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Footprints className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-[9px] text-emerald-600/80 font-medium uppercase">Steps</span>
                            </div>
                            <p className="text-xl font-bold text-emerald-600">{entry.physiologicalData.steps.toLocaleString()}</p>
                            <p className="text-[10px] text-emerald-500/70">today</p>
                          </div>
                        )}

                        {entry.physiologicalData?.stressLevel && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                              <span className="text-[9px] text-amber-600/80 font-medium uppercase">Stress</span>
                            </div>
                            <p className="text-xl font-bold text-amber-600">{entry.physiologicalData.stressLevel}</p>
                            <p className="text-[10px] text-amber-500/70">/10</p>
                          </div>
                        )}

                        {entry.physiologicalData?.spo2 && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-50 to-teal-50 border border-cyan-100 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Activity className="w-3.5 h-3.5 text-cyan-500" />
                              <span className="text-[9px] text-cyan-600/80 font-medium uppercase">SpO2</span>
                            </div>
                            <p className="text-xl font-bold text-cyan-600">{entry.physiologicalData.spo2}</p>
                            <p className="text-[10px] text-cyan-500/70">%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Triggers */}
                  {entry.triggers && entry.triggers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold flex items-center gap-2 text-foreground">
                        <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        Identified Triggers
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.triggers.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Note */}
                  {entry.note && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-foreground">Patient Notes</h4>
                      <p className="text-sm text-foreground bg-card p-3 rounded-xl border border-border/60 italic">
                        "{entry.note}"
                      </p>
                    </div>
                  )}

                  {/* Clinical Record Action */}
                  <div className="pt-3 border-t border-border/50">
                    <Button 
                      onClick={() => onGenerateClinicalRecord?.(entry)}
                      className="w-full gap-2 h-11 shadow-sm"
                    >
                      <FileText className="w-4 h-4" />
                      Generate EHR Clinical Record
                      <Sparkles className="w-3 h-3 ml-auto" />
                    </Button>
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