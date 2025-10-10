import { FlareEntry, EntryType } from "@/types/flare";
import { format, startOfDay, differenceInMinutes, addMinutes, isToday, isYesterday } from "date-fns";
import { AlertTriangle, Pill, Zap, TrendingUp, Battery, FileText, Info } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface GanttTimelineProps {
  entries: FlareEntry[];
  onEntriesUpdate: () => void;
}

export const GanttTimeline = ({ entries, onEntriesUpdate }: GanttTimelineProps) => {
  const [dragging, setDragging] = useState<{
    id: string;
    startY: number;
    initialMinutes: number;
    type: 'move' | 'resize';
  } | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FlareEntry | null>(null);
  const isDraggingRef = useRef(false);


  const getIcon = (type: EntryType) => {
    const icons = { flare: AlertTriangle, medication: Pill, trigger: Zap, recovery: TrendingUp, energy: Battery, note: FileText };
    const Icon = icons[type] || FileText;
    return Icon;
  };

  const getColor = (entry: FlareEntry) => {
    if (entry.type === 'flare') {
      const colors = {
        none: 'bg-green-50 border-green-500 text-green-900',
        mild: 'bg-yellow-50 border-yellow-500 text-yellow-900',
        moderate: 'bg-orange-50 border-orange-500 text-orange-900',
        severe: 'bg-red-50 border-red-500 text-red-900'
      };
      return colors[entry.severity || 'mild'];
    }
    const typeColors = {
      medication: 'bg-blue-50 border-blue-500 text-blue-900',
      trigger: 'bg-purple-50 border-purple-500 text-purple-900',
      recovery: 'bg-green-50 border-green-500 text-green-900',
      energy: 'bg-cyan-50 border-cyan-500 text-cyan-900',
      note: 'bg-gray-50 border-gray-400 text-gray-900'
    };
    return typeColors[entry.type as keyof typeof typeColors] || typeColors.note;
  };

  const getLabel = (entry: FlareEntry) => {
    if (entry.type === 'flare') return entry.severity || 'flare';
    if (entry.type === 'energy') return entry.energyLevel?.replace('-', ' ') || 'energy';
    return entry.type;
  };

  const formatDayHeader = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, 'EEEE, MMM d');
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !isDraggingRef.current) return;
    e.preventDefault();
  }, [dragging]);

  const handleGlobalMouseUp = useCallback(async (e: MouseEvent) => {
    if (!dragging || !isDraggingRef.current) return;
    
    isDraggingRef.current = false;
    e.preventDefault();

    const entry = entries.find(e => e.id === dragging.id);
    if (!entry) {
      setDragging(null);
      document.body.style.userSelect = '';
      return;
    }

    const dayStart = startOfDay(entry.timestamp);
    const deltaY = e.clientY - dragging.startY;
    const TIMELINE_HEIGHT = 600;

    if (dragging.type === 'move') {
      const deltaMinutes = -(deltaY / TIMELINE_HEIGHT) * (24 * 60); // Negative because timeline is reversed
      const newMinutes = Math.max(0, Math.min(24 * 60 - 1, dragging.initialMinutes + deltaMinutes));
      const newTimestamp = addMinutes(dayStart, newMinutes);

      await supabase
        .from('flare_entries')
        .update({ timestamp: newTimestamp.toISOString() })
        .eq('id', entry.id);

      onEntriesUpdate();
    } else if (dragging.type === 'resize') {
      const deltaMinutes = -(deltaY / TIMELINE_HEIGHT) * (24 * 60); // Negative because timeline is reversed
      const newDuration = Math.max(60, dragging.initialMinutes + deltaMinutes);

      await supabase
        .from('flare_entries')
        .update({ duration_minutes: Math.round(newDuration) })
        .eq('id', entry.id);

      onEntriesUpdate();
    }

    setDragging(null);
    document.body.style.userSelect = '';
  }, [dragging, entries, onEntriesUpdate]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [dragging, handleGlobalMouseMove, handleGlobalMouseUp]);


  if (entries.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No entries yet</p>
      </Card>
    );
  }

  // Group by day - store both the day string and the actual Date for proper calculations
  const groupedByDay = entries.reduce((acc, entry) => {
    const dayKey = format(entry.timestamp, 'yyyy-MM-dd');
    if (!acc[dayKey]) {
      acc[dayKey] = {
        entries: [],
        dayStart: startOfDay(entry.timestamp) // Use the actual entry's date for day start
      };
    }
    acc[dayKey].entries.push(entry);
    return acc;
  }, {} as Record<string, { entries: FlareEntry[]; dayStart: Date }>);

  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-clinical">Timeline</h2>
        <p className="text-xs text-muted-foreground">{entries.length} entries</p>
      </div>

      {sortedDays.map(day => {
        const { entries: dayEntries, dayStart } = groupedByDay[day];
        const TIMELINE_HEIGHT = 600;

        return (
          <div key={day} className="space-y-2">
            <h3 className="text-sm font-clinical text-foreground">
              {formatDayHeader(new Date(day))}
            </h3>
            
            <div 
              className="relative bg-card rounded-lg border" 
              style={{ height: `${TIMELINE_HEIGHT}px`, position: 'relative', overflow: 'visible' }}
            >
              {/* Time markers - reversed so later times are at top */}
              <div className="absolute inset-0 px-4 py-2">
                {[23, 18, 12, 6, 0].map(hour => (
                  <div 
                    key={hour} 
                    className="absolute left-0 right-0 flex items-center text-xs text-muted-foreground"
                    style={{ top: `${((24 - hour) / 24) * 100}%` }}
                  >
                    <span className="w-12 text-right pr-2 bg-card">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                ))}
              </div>

              {/* Entries container */}
              <div className="absolute left-16 right-4 top-0 bottom-0" style={{ position: 'absolute' }}>
                {(() => {
                  // Calculate lanes for overlapping entries
                  const sortedEntries = [...dayEntries].sort((a, b) => 
                    a.timestamp.getTime() - b.timestamp.getTime()
                  );

                  interface EntryWithLane extends FlareEntry {
                    lane: number;
                    totalLanes: number;
                  }

                  const entriesWithLanes: EntryWithLane[] = [];
                  
                  sortedEntries.forEach(entry => {
                    const entryStart = differenceInMinutes(entry.timestamp, dayStart);
                    const entryDuration = entry.duration_minutes || 15;
                    const entryEnd = entryStart + entryDuration;

                    const overlapping = entriesWithLanes.filter(existing => {
                      const existingStart = differenceInMinutes(existing.timestamp, dayStart);
                      const existingDuration = existing.duration_minutes || 15;
                      const existingEnd = existingStart + existingDuration;
                      return !(entryEnd <= existingStart || entryStart >= existingEnd);
                    });

                    let lane = 0;
                    const usedLanes = new Set(overlapping.map(e => e.lane));
                    while (usedLanes.has(lane)) {
                      lane++;
                    }

                    entriesWithLanes.push({
                      ...entry,
                      lane,
                      totalLanes: Math.max(lane + 1, ...overlapping.map(e => e.totalLanes))
                    });

                    overlapping.forEach(e => {
                      e.totalLanes = Math.max(e.totalLanes, lane + 1);
                    });
                  });

                  return entriesWithLanes.map((entry) => {
                    const Icon = getIcon(entry.type);
                    const startMin = differenceInMinutes(entry.timestamp, dayStart);
                    const duration = entry.duration_minutes || 60;
                    // Reverse the timeline: later times at top
                    const topPercent = ((24 * 60 - startMin - duration) / (24 * 60)) * 100;
                    const heightPercent = Math.max((duration / (24 * 60)) * 100, 2);
                    const widthPercent = 100 / entry.totalLanes;
                    const leftPercent = widthPercent * entry.lane;

                    return (
                      <div
                        key={entry.id}
                        className={`absolute rounded-md border-l-4 shadow-sm group ${getColor(entry)} hover:shadow-md transition-shadow`}
                        style={{
                          top: `${topPercent}%`,
                          height: `${heightPercent}%`,
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          minHeight: '40px',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          zIndex: dragging?.id === entry.id ? 50 : 10
                        }}
                      >
                        <div 
                          className="px-2 py-1 flex items-center gap-2 h-full overflow-hidden cursor-move"
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            isDraggingRef.current = true;
                            document.body.style.userSelect = 'none';
                            setDragging({
                              id: entry.id,
                              startY: e.clientY,
                              initialMinutes: startMin,
                              type: 'move'
                            });
                          }}
                          onClick={(e) => {
                            if (!isDraggingRef.current) {
                              setSelectedEntry(entry);
                            }
                            isDraggingRef.current = false;
                          }}
                        >
                          <Icon className="w-3 h-3 flex-shrink-0" />
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <span className="text-xs font-medium capitalize truncate block">{getLabel(entry)}</span>
                            {entry.symptoms && entry.symptoms.length > 0 && entry.totalLanes === 1 && (
                              <span className="text-xs opacity-70 truncate block">• {entry.symptoms[0]}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {(entry.environmentalData || entry.physiologicalData) && (
                              <Info className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                            )}
                            <span className="text-xs opacity-60 whitespace-nowrap">{format(entry.timestamp, 'h:mm a')}</span>
                          </div>
                        </div>

                        {/* Resize handle - now at top since timeline is reversed */}
                        <div
                          className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black/10 z-10"
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            isDraggingRef.current = true;
                            document.body.style.userSelect = 'none';
                            setDragging({
                              id: entry.id,
                              startY: e.clientY,
                              initialMinutes: duration,
                              type: 'resize'
                            });
                          }}
                        >
                          <div className="h-0.5 bg-current opacity-30 mx-auto w-8" />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        );
      })}

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEntry && (() => {
                const Icon = getIcon(selectedEntry.type);
                return <><Icon className="w-5 h-5" /> {getLabel(selectedEntry)} Entry</>;
              })()}
            </DialogTitle>
            <DialogDescription>
              {selectedEntry && format(selectedEntry.timestamp, 'EEEE, MMMM d, yyyy • h:mm a')}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              {selectedEntry.symptoms && selectedEntry.symptoms.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Symptoms</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntry.symptoms.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
                  </div>
                </div>
              )}

              {selectedEntry.note && (
                <div>
                  <h4 className="font-medium mb-2">Note</h4>
                  <p className="text-sm text-muted-foreground">{selectedEntry.note}</p>
                </div>
              )}

              {selectedEntry.environmentalData && (
                <div>
                  <h4 className="font-medium mb-2">Environmental Data</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedEntry.environmentalData.location && (
                      <div>
                        <span className="text-muted-foreground">Location:</span>
                        <p className="font-medium">{selectedEntry.environmentalData.location.city}, {selectedEntry.environmentalData.location.country}</p>
                      </div>
                    )}
                    {selectedEntry.environmentalData.weather && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Temperature:</span>
                          <p className="font-medium">{selectedEntry.environmentalData.weather.temperature}°C</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Humidity:</span>
                          <p className="font-medium">{selectedEntry.environmentalData.weather.humidity}%</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pressure:</span>
                          <p className="font-medium">{selectedEntry.environmentalData.weather.pressure} hPa</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Condition:</span>
                          <p className="font-medium capitalize">{selectedEntry.environmentalData.weather.condition}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Wind Speed:</span>
                          <p className="font-medium">{selectedEntry.environmentalData.weather.windSpeed} km/h</p>
                        </div>
                      </>
                    )}
                    {selectedEntry.environmentalData.airQuality && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Air Quality Index:</span>
                          <p className="font-medium">{selectedEntry.environmentalData.airQuality.aqi}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pollen:</span>
                          <p className="font-medium">{selectedEntry.environmentalData.airQuality.pollen}</p>
                        </div>
                      </>
                    )}
                    {selectedEntry.environmentalData.season && (
                      <div>
                        <span className="text-muted-foreground">Season:</span>
                        <p className="font-medium capitalize">{selectedEntry.environmentalData.season}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedEntry.physiologicalData && (
                <div>
                  <h4 className="font-medium mb-2">Health Data</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedEntry.physiologicalData.heartRate && (
                      <div>
                        <span className="text-muted-foreground">Heart Rate:</span>
                        <p className="font-medium">{selectedEntry.physiologicalData.heartRate} bpm</p>
                      </div>
                    )}
                    {selectedEntry.physiologicalData.bloodPressure && (
                      <div>
                        <span className="text-muted-foreground">Blood Pressure:</span>
                        <p className="font-medium">
                          {selectedEntry.physiologicalData.bloodPressure.systolic}/
                          {selectedEntry.physiologicalData.bloodPressure.diastolic}
                        </p>
                      </div>
                    )}
                    {selectedEntry.physiologicalData.sleepHours && (
                      <div>
                        <span className="text-muted-foreground">Sleep:</span>
                        <p className="font-medium">{selectedEntry.physiologicalData.sleepHours}h ({selectedEntry.physiologicalData.sleepQuality})</p>
                      </div>
                    )}
                    {selectedEntry.physiologicalData.stressLevel && (
                      <div>
                        <span className="text-muted-foreground">Stress Level:</span>
                        <p className="font-medium">{selectedEntry.physiologicalData.stressLevel}/10</p>
                      </div>
                    )}
                    {selectedEntry.physiologicalData.steps && (
                      <div>
                        <span className="text-muted-foreground">Steps:</span>
                        <p className="font-medium">{selectedEntry.physiologicalData.steps.toLocaleString()}</p>
                      </div>
                    )}
                    {selectedEntry.physiologicalData.heartRateVariability && (
                      <div>
                        <span className="text-muted-foreground">HRV:</span>
                        <p className="font-medium">{selectedEntry.physiologicalData.heartRateVariability} ms</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
