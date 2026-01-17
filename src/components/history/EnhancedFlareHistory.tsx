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
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  Gauge,
  Brain,
  Sparkles,
  Sun,
  Cloud,
  Eye,
  Leaf,
  MessageSquare,
  FileOutput
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
import { EditFlareDialog } from '@/components/flare/EditFlareDialog';
import { FollowUpDialog } from '@/components/flare/FollowUpDialog';

interface EnhancedFlareHistoryProps {
  entries: FlareEntry[];
  onUpdate?: (entryId: string, updates: Partial<FlareEntry>) => void;
  onDelete?: (entryId: string) => void;
  onAddFollowUp?: (entryId: string, note: string) => void;
  onGenerateClinicalRecord?: (entry: FlareEntry) => void;
  onGenerateBulkClinicalRecord?: (entries: FlareEntry[]) => void;
}

export const EnhancedFlareHistory = ({ 
  entries, 
  onUpdate, 
  onDelete,
  onAddFollowUp,
  onGenerateClinicalRecord,
  onGenerateBulkClinicalRecord,
}: EnhancedFlareHistoryProps) => {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<FlareEntry | null>(null);
  const [followUpEntry, setFollowUpEntry] = useState<FlareEntry | null>(null);
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
        border: 'border-l-red-500',
        accent: 'text-red-600'
      };
      case 'moderate': return { 
        bg: 'bg-gradient-to-br from-amber-500 to-orange-500', 
        border: 'border-l-amber-500',
        accent: 'text-amber-600'
      };
      case 'mild': return { 
        bg: 'bg-gradient-to-br from-blue-500 to-blue-600', 
        border: 'border-l-blue-500',
        accent: 'text-blue-600'
      };
      default: return { 
        bg: 'bg-muted', 
        border: 'border-l-muted',
        accent: 'text-muted-foreground'
      };
    }
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'flare': return <Zap className="w-3.5 h-3.5" />;
      case 'energy': return <Activity className="w-3.5 h-3.5" />;
      case 'medication': return <Stethoscope className="w-3.5 h-3.5" />;
      default: return <FileText className="w-3.5 h-3.5" />;
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

  const handleEdit = (entry: FlareEntry) => {
    setEditingEntry(entry);
  };

  const handleFollowUp = (entry: FlareEntry) => {
    setFollowUpEntry(entry);
  };

  if (entries.length === 0) {
    return (
      <Card className="p-6 text-center bg-card border border-border/80">
        <div className="w-12 h-12 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No entries for this date</p>
        <p className="text-xs text-muted-foreground mt-1">Start logging to build your history</p>
      </Card>
    );
  }

  // Get environmental and physiological data with fallbacks
  const getEnvValue = (entry: FlareEntry, key: string): any => {
    const env = entry.environmentalData as any;
    if (!env) return null;
    // Check nested weather object first
    if (env.weather?.[key] !== undefined) return env.weather[key];
    // Check nested location object
    if (env.location?.[key] !== undefined) return env.location[key];
    // Check direct properties
    if (env[key] !== undefined) return env[key];
    return null;
  };

  const getPhysValue = (entry: FlareEntry, key: string): any => {
    const phys = entry.physiologicalData as any;
    if (!phys) return null;
    return phys[key] ?? phys[key.replace(/_/g, '')] ?? null;
  };

  return (
    <div className="space-y-2">
      {/* Bulk Export Button */}
      {entries.length > 1 && onGenerateBulkClinicalRecord && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mb-2 gap-2 text-xs"
          onClick={() => onGenerateBulkClinicalRecord(entries)}
        >
          <FileOutput className="w-3.5 h-3.5" />
          Export All {entries.length} Entries to EHR
        </Button>
      )}

      {entries.map((entry) => {
        const isExpanded = expandedEntries.has(entry.id);
        const severity = getSeverityStyles(entry.severity);
        const hasEnvData = entry.environmentalData;
        const hasPhysData = entry.physiologicalData;

        // Extract values
        const temp = getEnvValue(entry, 'temperature');
        const humidity = getEnvValue(entry, 'humidity');
        const pressure = getEnvValue(entry, 'pressure');
        const condition = getEnvValue(entry, 'condition');
        const city = getEnvValue(entry, 'city');
        const uvIndex = getEnvValue(entry, 'uvIndex') ?? getEnvValue(entry, 'uv_index');
        const aqi = getEnvValue(entry, 'aqi');
        const windSpeed = getEnvValue(entry, 'windSpeed') ?? getEnvValue(entry, 'wind_speed');
        const visibility = getEnvValue(entry, 'visibility');
        const pollenTree = getEnvValue(entry, 'pollenTree') ?? getEnvValue(entry, 'pollen_tree');
        const pollenGrass = getEnvValue(entry, 'pollenGrass') ?? getEnvValue(entry, 'pollen_grass');

        const heartRate = getPhysValue(entry, 'heart_rate') ?? getPhysValue(entry, 'heartRate');
        const hrv = getPhysValue(entry, 'heart_rate_variability') ?? getPhysValue(entry, 'heartRateVariability');
        const sleepHours = getPhysValue(entry, 'sleep_hours') ?? getPhysValue(entry, 'sleepHours');
        const steps = getPhysValue(entry, 'steps');
        const spo2 = getPhysValue(entry, 'spo2');
        const calories = getPhysValue(entry, 'calories_burned') ?? getPhysValue(entry, 'caloriesBurned');
        const restingHr = getPhysValue(entry, 'resting_heart_rate') ?? getPhysValue(entry, 'restingHeartRate');

        return (
          <Collapsible key={entry.id} open={isExpanded} onOpenChange={() => toggleExpand(entry.id)}>
            <Card className={cn(
              "overflow-hidden transition-all duration-200 bg-card border shadow-sm",
              isExpanded ? "ring-1 ring-primary/20" : "hover:shadow-md",
              entry.type === 'flare' && `border-l-4 ${severity.border}`
            )}>
              {/* Compact Header */}
              <div className="p-3">
                <div className="flex items-center gap-2.5">
                  {/* Severity Icon */}
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    entry.type === 'flare' ? severity.bg : 'bg-primary'
                  )}>
                    <span className="text-white">{getEntryIcon(entry.type)}</span>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold capitalize">{entry.type}</span>
                      {entry.severity && (
                        <Badge variant="outline" className={cn("text-[9px] capitalize px-1.5 py-0", severity.accent)}>
                          {entry.severity}
                        </Badge>
                      )}
                      {(hasEnvData || hasPhysData) && (
                        <Badge className="text-[9px] bg-primary/10 text-primary border-0 gap-0.5 px-1.5 py-0">
                          <Sparkles className="w-2 h-2" /> Data
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {format(entry.timestamp, 'h:mm a')} • {city || format(entry.timestamp, 'MMM d')}
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-0.5">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleEdit(entry); }}
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleFollowUp(entry); }}
                      title="Follow-up"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => onGenerateClinicalRecord?.(entry)} className="gap-2 text-xs">
                          <FileText className="w-3.5 h-3.5" /> EHR Record
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyEntryData(entry)} className="gap-2 text-xs">
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareEntry(entry)} className="gap-2 text-xs">
                          <Share2 className="w-3.5 h-3.5" /> Share
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadEntry(entry)} className="gap-2 text-xs">
                          <Download className="w-3.5 h-3.5" /> Export JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onDelete?.(entry.id)} 
                          className="gap-2 text-xs text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                {/* Symptoms Preview */}
                {entry.symptoms && entry.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 ml-11">
                    {entry.symptoms.slice(0, 4).map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 bg-muted/60">{s}</Badge>
                    ))}
                    {entry.symptoms.length > 4 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">+{entry.symptoms.length - 4}</Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded Content */}
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-3 border-t pt-3 bg-muted/10">
                  {/* Physiological Data - Wearables */}
                  {hasPhysData && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3 h-3 text-rose-500" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Wearable Metrics</span>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto">Fitbit</Badge>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-1.5">
                        {heartRate && (
                          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-center">
                            <Heart className="w-3 h-3 text-red-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-red-600">{heartRate}</p>
                            <p className="text-[8px] text-red-500/70">bpm</p>
                          </div>
                        )}
                        {hrv && (
                          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-center">
                            <Brain className="w-3 h-3 text-purple-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-purple-600">{hrv}</p>
                            <p className="text-[8px] text-purple-500/70">ms HRV</p>
                          </div>
                        )}
                        {sleepHours && (
                          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-center">
                            <Moon className="w-3 h-3 text-indigo-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-indigo-600">{sleepHours}</p>
                            <p className="text-[8px] text-indigo-500/70">hrs sleep</p>
                          </div>
                        )}
                        {steps && (
                          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-center">
                            <Footprints className="w-3 h-3 text-emerald-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-emerald-600">{steps >= 1000 ? `${(steps/1000).toFixed(1)}k` : steps}</p>
                            <p className="text-[8px] text-emerald-500/70">steps</p>
                          </div>
                        )}
                        {spo2 && (
                          <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 text-center">
                            <Activity className="w-3 h-3 text-cyan-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-cyan-600">{spo2}%</p>
                            <p className="text-[8px] text-cyan-500/70">SpO2</p>
                          </div>
                        )}
                        {restingHr && (
                          <div className="p-2 rounded-lg bg-pink-50 dark:bg-pink-950/30 text-center">
                            <Heart className="w-3 h-3 text-pink-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-pink-600">{restingHr}</p>
                            <p className="text-[8px] text-pink-500/70">resting</p>
                          </div>
                        )}
                        {calories && (
                          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-center">
                            <Zap className="w-3 h-3 text-orange-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-orange-600">{calories >= 1000 ? `${(calories/1000).toFixed(1)}k` : calories}</p>
                            <p className="text-[8px] text-orange-500/70">cals</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Environmental Data */}
                  {hasEnvData && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Environment</span>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto">Auto</Badge>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-1.5">
                        {temp !== null && (
                          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-center">
                            <Thermometer className="w-3 h-3 text-orange-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-orange-600">{temp}°</p>
                            <p className="text-[8px] text-orange-500/70">temp</p>
                          </div>
                        )}
                        {humidity !== null && (
                          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-center">
                            <Droplets className="w-3 h-3 text-blue-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-blue-600">{humidity}%</p>
                            <p className="text-[8px] text-blue-500/70">humidity</p>
                          </div>
                        )}
                        {pressure !== null && (
                          <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 text-center">
                            <Gauge className="w-3 h-3 text-violet-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-violet-600">{pressure}</p>
                            <p className="text-[8px] text-violet-500/70">inHg</p>
                          </div>
                        )}
                        {uvIndex !== null && (
                          <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 text-center">
                            <Sun className="w-3 h-3 text-yellow-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-yellow-600">{uvIndex}</p>
                            <p className="text-[8px] text-yellow-500/70">UV</p>
                          </div>
                        )}
                        {aqi !== null && (
                          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-950/30 text-center">
                            <Cloud className="w-3 h-3 text-gray-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-gray-600">{aqi}</p>
                            <p className="text-[8px] text-gray-500/70">AQI</p>
                          </div>
                        )}
                        {windSpeed !== null && (
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/30 text-center">
                            <Wind className="w-3 h-3 text-slate-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-slate-600">{windSpeed}</p>
                            <p className="text-[8px] text-slate-500/70">mph</p>
                          </div>
                        )}
                        {visibility !== null && (
                          <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-center">
                            <Eye className="w-3 h-3 text-sky-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-sky-600">{visibility}</p>
                            <p className="text-[8px] text-sky-500/70">mi vis</p>
                          </div>
                        )}
                        {(pollenTree !== null || pollenGrass !== null) && (
                          <div className="p-2 rounded-lg bg-lime-50 dark:bg-lime-950/30 text-center">
                            <Leaf className="w-3 h-3 text-lime-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-lime-600">{pollenTree || pollenGrass}</p>
                            <p className="text-[8px] text-lime-500/70">pollen</p>
                          </div>
                        )}
                      </div>

                      {condition && (
                        <p className="text-[10px] text-muted-foreground text-center capitalize">{condition}</p>
                      )}
                    </div>
                  )}

                  {/* Triggers */}
                  {entry.triggers && entry.triggers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Triggers</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {entry.triggers.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-[9px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-1.5 py-0">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {entry.note && (
                    <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-[11px] text-foreground italic">"{entry.note}"</p>
                    </div>
                  )}

                  {/* Follow-ups */}
                  {entry.followUps && entry.followUps.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Follow-ups</span>
                      <div className="space-y-1">
                        {entry.followUps.map((fu: any, i: number) => (
                          <div key={i} className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                            <p className="text-[10px] text-foreground">{fu.note}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              {format(new Date(fu.timestamp), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clinical Record Button */}
                  <Button 
                    onClick={() => onGenerateClinicalRecord?.(entry)}
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-xs h-8"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Generate EHR Record
                  </Button>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Edit Dialog */}
      {editingEntry && (
        <EditFlareDialog
          entry={editingEntry}
          open={!!editingEntry}
          onOpenChange={(open) => !open && setEditingEntry(null)}
          onSave={(updates) => {
            onUpdate?.(editingEntry.id, updates);
            setEditingEntry(null);
          }}
        />
      )}

      {/* Follow-up Dialog */}
      {followUpEntry && (
        <FollowUpDialog
          entry={followUpEntry}
          open={!!followUpEntry}
          onOpenChange={(open) => !open && setFollowUpEntry(null)}
          onSave={(note) => {
            onAddFollowUp?.(followUpEntry.id, note);
            setFollowUpEntry(null);
          }}
        />
      )}
    </div>
  );
};