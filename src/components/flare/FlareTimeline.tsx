import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FlareEntry, EntryType } from "@/types/flare";
import { format, isToday, isYesterday } from "date-fns";
import { 
  AlertTriangle, 
  Pill, 
  Zap, 
  TrendingUp, 
  Battery, 
  FileText,
  Clock,
  ChevronDown,
  MapPin,
  ThermometerSun,
  Droplets,
  Wind,
  Gauge,
  Leaf,
  CloudRain,
  Heart,
  Activity,
  Moon,
  Footprints,
  Edit2,
  Trash2,
  MessageSquarePlus
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EditFlareDialog } from "./EditFlareDialog";
import { FollowUpDialog } from "./FollowUpDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FlareTimelineProps {
  entries: FlareEntry[];
  onUpdate?: (entryId: string, updates: Partial<FlareEntry>) => void;
  onDelete?: (entryId: string) => void;
  onAddFollowUp?: (entryId: string, followUpNote: string) => void;
}

export const FlareTimeline = ({ entries, onUpdate, onDelete, onAddFollowUp }: FlareTimelineProps) => {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<FlareEntry | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [followUpEntry, setFollowUpEntry] = useState<FlareEntry | null>(null);

  const toggleEntry = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const formatDate = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM d, yyyy");
  };

  const formatTime = (date: Date) => {
    return format(date, "h:mm a");
  };

  const getEntryIcon = (type: EntryType) => {
    switch (type) {
      case 'flare': return AlertTriangle;
      case 'medication': return Pill;
      case 'trigger': return Zap;
      case 'recovery': return TrendingUp;
      case 'energy': return Battery;
      case 'note': return FileText;
      default: return FileText;
    }
  };

  const getEntryStyle = (entry: FlareEntry) => {
    switch (entry.type) {
      case 'flare':
        if (!entry.severity) return 'bg-muted/30 text-foreground border-l-muted-foreground';
        switch (entry.severity) {
          case 'none':
            return 'bg-severity-none-bg text-severity-none border-l-severity-none';
          case 'mild':
            return 'bg-severity-mild-bg text-severity-mild border-l-severity-mild';
          case 'moderate':
            return 'bg-severity-moderate-bg text-severity-moderate border-l-severity-moderate';
          case 'severe':
            return 'bg-severity-severe-bg text-severity-severe border-l-severity-severe';
        }
        break;
      case 'medication':
        return 'bg-primary/10 text-primary border-l-primary';
      case 'trigger':
        return 'bg-destructive/10 text-destructive border-l-destructive';
      case 'recovery':
        return 'bg-severity-none-bg text-severity-none border-l-severity-none';
      case 'energy':
        return 'bg-accent/50 text-accent-foreground border-l-accent-foreground';
      case 'note':
        return 'bg-muted/30 text-foreground border-l-muted-foreground';
      default:
        return 'bg-muted/30 text-foreground border-l-muted-foreground';
    }
  };

  const getEntryTitle = (entry: FlareEntry) => {
    switch (entry.type) {
      case 'flare':
        return entry.severity ? `${entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1)} flare` : 'Flare update';
      case 'medication':
        return 'Medication taken';
      case 'trigger':
        return 'Potential trigger';
      case 'recovery':
        return 'Feeling better';
      case 'energy':
        return entry.energyLevel ? `Energy: ${entry.energyLevel.replace('-', ' ')}` : 'Energy update';
      case 'note':
        return 'Note';
      default:
        return 'Entry';
    }
  };

  // Group entries by date
  const groupedEntries = entries.reduce((groups, entry) => {
    const dateKey = format(entry.timestamp, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(entry);
    return groups;
  }, {} as Record<string, FlareEntry[]>);

  // Sort dates descending (most recent first)
  const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-clinical mb-2">No entries yet</h2>
        <p className="text-muted-foreground">
          Start tracking to see your timeline here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-clinical">Your Timeline</h2>
      
      {sortedDates.map((dateKey) => {
        const dayEntries = groupedEntries[dateKey].sort((a, b) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        );
        const firstEntry = dayEntries[0];
        
        return (
          <div key={dateKey} className="space-y-2">
            <div className="flex items-center gap-2 sticky top-16 bg-background/95 backdrop-blur py-2 z-10">
              <h3 className="font-clinical text-sm text-muted-foreground">
                {formatDate(firstEntry.timestamp)}
              </h3>
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-muted-foreground">
                {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            
            <div className="space-y-2 ml-4">
              {dayEntries.map((entry) => {
                const Icon = getEntryIcon(entry.type);
                const isExpanded = expandedEntries.has(entry.id);
                const hasDetailedData = entry.environmentalData || entry.physiologicalData;
                
                return (
                  <div 
                    key={entry.id}
                    className="relative group"
                    onMouseEnter={() => setHoveredEntry(entry.id)}
                    onMouseLeave={() => setHoveredEntry(null)}
                  >
                    <Card 
                      className={`p-3 border-l-4 transition-all duration-200 ${getEntryStyle(entry)} ${
                        hoveredEntry === entry.id ? 'ml-0 mr-16' : ''
                      }`}
                    >
                      {/* Edit/Delete/Follow-up Buttons */}
                      {hoveredEntry === entry.id && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 z-10">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-primary/10"
                            onClick={() => setFollowUpEntry(entry)}
                            title="Add follow-up"
                          >
                            <MessageSquarePlus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-primary/10"
                            onClick={() => setEditingEntry(entry)}
                            title="Edit entry"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeletingEntryId(entry.id)}
                            title="Delete entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span className="font-clinical text-sm">
                            {getEntryTitle(entry)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatTime(entry.timestamp)}
                          </div>
                          {hasDetailedData && (
                            <button
                              onClick={() => toggleEntry(entry.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Basic Info */}
                      {entry.symptoms && entry.symptoms.length > 0 && (
                        <div className="text-xs mb-2">
                          <span className="font-clinical">Symptoms:</span> {entry.symptoms.join(' • ')}
                        </div>
                      )}
                      
                      {entry.medications && entry.medications.length > 0 && (
                        <div className="text-xs mb-2">
                          <span className="font-clinical">Medications:</span> {entry.medications.join(' • ')}
                        </div>
                      )}
                      
                      {entry.triggers && entry.triggers.length > 0 && (
                        <div className="text-xs mb-2">
                          <span className="font-clinical">Triggers:</span> {entry.triggers.join(' • ')}
                        </div>
                      )}

                      {entry.note && (
                        <div className="text-xs text-foreground/80 mt-2 italic">
                          "{entry.note}"
                        </div>
                      )}

                      {/* Follow-ups */}
                      {entry.followUps && entry.followUps.length > 0 && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <p className="text-xs font-clinical text-primary flex items-center gap-1.5">
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                            Follow-ups ({entry.followUps.length})
                          </p>
                          <div className="space-y-2">
                            {entry.followUps.map((followUp, index) => (
                              <div key={index} className="text-xs border-l-2 border-primary/30 pl-3 py-1">
                                <p className="text-foreground">{followUp.note}</p>
                                <p className="text-muted-foreground text-[10px] mt-0.5">
                                  {format(new Date(followUp.timestamp), "MMM d 'at' h:mm a")}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Compact Environmental/Physiological Preview */}
                      {!isExpanded && hasDetailedData && (
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                          {entry.environmentalData?.weather && (
                            <span>🌡️ {entry.environmentalData.weather.temperature}°C</span>
                          )}
                          {entry.physiologicalData?.heartRate && (
                            <span>❤️ {entry.physiologicalData.heartRate} bpm</span>
                          )}
                          <span className="text-primary">Click to expand details</span>
                        </div>
                      )}

                      {/* Expanded Environmental & Physiological Data */}
                      {isExpanded && (
                        <div className="mt-3 space-y-3 pt-3 border-t">
                          {/* Environmental Data */}
                          {entry.environmentalData && (
                            <div className="space-y-2">
                              <h4 className="font-clinical text-xs flex items-center gap-1.5 text-primary">
                                <MapPin className="w-3.5 h-3.5" />
                                Environmental Conditions
                              </h4>
                              
                              {entry.environmentalData.location && (
                                <div className="text-xs space-y-0.5 pl-5">
                                  <p className="flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3" />
                                    {entry.environmentalData.location.city}, {entry.environmentalData.location.country}
                                  </p>
                                  <p className="text-muted-foreground text-[10px]">
                                    {entry.environmentalData.location.latitude.toFixed(4)}°, {entry.environmentalData.location.longitude.toFixed(4)}°
                                  </p>
                                </div>
                              )}
                              
                              {entry.environmentalData.weather && (
                                <div className="grid grid-cols-2 gap-1.5 text-xs pl-5">
                                  <div className="flex items-center gap-1.5">
                                    <ThermometerSun className="w-3 h-3 text-orange-500" />
                                    <span>{entry.environmentalData.weather.temperature}°C</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <CloudRain className="w-3 h-3 text-blue-400" />
                                    <span className="capitalize">{entry.environmentalData.weather.condition}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Droplets className="w-3 h-3 text-blue-500" />
                                    <span>{entry.environmentalData.weather.humidity}%</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Wind className="w-3 h-3 text-gray-500" />
                                    <span>{entry.environmentalData.weather.windSpeed} km/h</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Gauge className="w-3 h-3 text-purple-500" />
                                    <span>{entry.environmentalData.weather.pressure} hPa</span>
                                  </div>
                                </div>
                              )}

                              {entry.environmentalData.airQuality && (
                                <div className="space-y-1.5 pl-5">
                                  <p className="text-xs font-clinical">Air Quality</p>
                                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <Leaf className="w-3 h-3 text-green-500" />
                                      <span>AQI: {entry.environmentalData.airQuality.aqi}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Leaf className="w-3 h-3 text-yellow-500" />
                                      <span>Pollen: {entry.environmentalData.airQuality.pollen}</span>
                                    </div>
                                    <div className="col-span-2 text-muted-foreground text-[10px]">
                                      PM10: {entry.environmentalData.airQuality.pollutants} µg/m³
                                    </div>
                                  </div>
                                </div>
                              )}

                              {entry.environmentalData.season && (
                                <div className="text-xs pl-5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    <span className="capitalize">{entry.environmentalData.season}</span> Season
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Physiological Data */}
                          {entry.physiologicalData && (
                            <div className="space-y-2">
                              <h4 className="font-clinical text-xs flex items-center gap-1.5 text-primary">
                                <Heart className="w-3.5 h-3.5" />
                                Health Metrics
                              </h4>
                              
                              <div className="grid grid-cols-2 gap-1.5 text-xs pl-5">
                                {entry.physiologicalData.heartRate && (
                                  <div className="flex items-center gap-1.5">
                                    <Heart className="w-3 h-3 text-red-500" />
                                    <span>HR: {entry.physiologicalData.heartRate} bpm</span>
                                  </div>
                                )}
                                {entry.physiologicalData.heartRateVariability && (
                                  <div className="flex items-center gap-1.5">
                                    <Heart className="w-3 h-3 text-pink-500" />
                                    <span>HRV: {entry.physiologicalData.heartRateVariability} ms</span>
                                  </div>
                                )}
                                {entry.physiologicalData.bloodPressure && (
                                  <div className="flex items-center gap-1.5 col-span-2">
                                    <Gauge className="w-3 h-3 text-red-600" />
                                    <span>BP: {entry.physiologicalData.bloodPressure.systolic}/{entry.physiologicalData.bloodPressure.diastolic} mmHg</span>
                                  </div>
                                )}
                                {entry.physiologicalData.sleepHours && (
                                  <div className="flex items-center gap-1.5 col-span-2">
                                    <Moon className="w-3 h-3 text-indigo-500" />
                                    <span>Sleep: {entry.physiologicalData.sleepHours}h ({entry.physiologicalData.sleepQuality})</span>
                                  </div>
                                )}
                                {entry.physiologicalData.steps && (
                                  <div className="flex items-center gap-1.5">
                                    <Footprints className="w-3 h-3 text-green-500" />
                                    <span>{entry.physiologicalData.steps.toLocaleString()} steps</span>
                                  </div>
                                )}
                                {entry.physiologicalData.stressLevel && (
                                  <div className="flex items-center gap-1.5">
                                    <Activity className="w-3 h-3 text-orange-500" />
                                    <span>Stress: {entry.physiologicalData.stressLevel}/10</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Edit Dialog */}
      {editingEntry && (
        <EditFlareDialog
          entry={editingEntry}
          open={!!editingEntry}
          onOpenChange={(open) => !open && setEditingEntry(null)}
          onSave={(updates) => {
            if (onUpdate) {
              onUpdate(editingEntry.id, updates);
            }
          }}
        />
      )}

      {/* Follow-up Dialog */}
      {followUpEntry && (
        <FollowUpDialog
          entry={followUpEntry}
          open={!!followUpEntry}
          onOpenChange={(open) => !open && setFollowUpEntry(null)}
          onSave={(followUpNote) => {
            if (onAddFollowUp) {
              onAddFollowUp(followUpEntry.id, followUpNote);
            }
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEntryId} onOpenChange={(open) => !open && setDeletingEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deletingEntryId && onDelete) {
                  onDelete(deletingEntryId);
                }
                setDeletingEntryId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};