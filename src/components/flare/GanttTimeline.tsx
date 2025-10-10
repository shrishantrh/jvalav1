import { FlareEntry, EntryType } from "@/types/flare";
import { format, startOfDay, differenceInMinutes, addMinutes, isToday, isYesterday } from "date-fns";
import { AlertTriangle, Pill, Zap, TrendingUp, Battery, FileText } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

interface GanttTimelineProps {
  entries: FlareEntry[];
  onEntriesUpdate: () => void;
}

export const GanttTimeline = ({ entries, onEntriesUpdate }: GanttTimelineProps) => {
  const [dragging, setDragging] = useState<{
    id: string;
    startY: number;
    originalTop: number;
    type: 'move' | 'resize';
  } | null>(null);

  // Add console logs to debug data
  console.log('Timeline entries:', entries);
  console.log('Total entries:', entries.length);

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

  // Prevent default drag behavior globally when dragging
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (dragging) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleGlobalMouseUp = async (e: MouseEvent) => {
    if (!dragging) return;

    e.preventDefault();
    e.stopPropagation();

    const entry = entries.find(e => e.id === dragging.id);
    if (!entry) {
      setDragging(null);
      return;
    }

    const dayStart = startOfDay(entry.timestamp);
    const deltaY = e.clientY - dragging.startY;
    const TIMELINE_HEIGHT = 600;

    if (dragging.type === 'move') {
      // Calculate new time based on pixel movement
      const deltaMinutes = (deltaY / TIMELINE_HEIGHT) * (24 * 60);
      const currentMinutes = differenceInMinutes(entry.timestamp, dayStart);
      const newMinutes = Math.max(0, Math.min(24 * 60 - 1, currentMinutes + deltaMinutes));
      const newTimestamp = addMinutes(dayStart, newMinutes);

      console.log('Moving entry:', { deltaY, deltaMinutes, currentMinutes, newMinutes });

      await supabase
        .from('flare_entries')
        .update({ timestamp: newTimestamp.toISOString() })
        .eq('id', entry.id);

      onEntriesUpdate();
    } else if (dragging.type === 'resize') {
      const deltaMinutes = (deltaY / TIMELINE_HEIGHT) * (24 * 60);
      const currentDuration = entry.duration_minutes || 15;
      const newDuration = Math.max(15, currentDuration + deltaMinutes);

      console.log('Resizing entry:', { deltaY, deltaMinutes, currentDuration, newDuration });

      await supabase
        .from('flare_entries')
        .update({ duration_minutes: Math.round(newDuration) })
        .eq('id', entry.id);

      onEntriesUpdate();
    }

    setDragging(null);
    document.body.style.userSelect = '';
  };

  // Attach global listeners
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
    if (dragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
  }

  const handleResize = async (entry: FlareEntry, newDuration: number) => {
    const endTime = addMinutes(entry.timestamp, newDuration);
    
    const { error } = await supabase
      .from('flare_entries')
      .update({ 
        duration_minutes: newDuration,
        end_timestamp: endTime.toISOString()
      })
      .eq('id', entry.id);

    if (error) {
      toast.error("Failed to resize");
    } else {
      onEntriesUpdate();
    }
  };

  if (entries.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No entries yet</p>
      </Card>
    );
  }

  // Group by day
  const groupedByDay = entries.reduce((acc, entry) => {
    const day = format(entry.timestamp, 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {} as Record<string, FlareEntry[]>);

  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-clinical">Timeline</h2>
        <p className="text-xs text-muted-foreground">{entries.length} entries</p>
      </div>

      {sortedDays.map(day => {
        const dayEntries = groupedByDay[day];
        const dayStart = startOfDay(new Date(day));
        const TIMELINE_HEIGHT = 600;

        console.log(`Rendering day ${day} with ${dayEntries.length} entries`);

        return (
          <div key={day} className="space-y-2">
            <h3 className="text-sm font-clinical text-foreground">
              {formatDayHeader(new Date(day))}
            </h3>
            
            <div 
              className="relative bg-card rounded-lg border" 
              style={{ height: `${TIMELINE_HEIGHT}px`, position: 'relative', overflow: 'visible' }}
            >
              {/* Time markers */}
              <div className="absolute inset-0 px-4 py-2">
                {[0, 6, 12, 18].map(hour => (
                  <div 
                    key={hour} 
                    className="absolute left-0 right-0 flex items-center text-xs text-muted-foreground"
                    style={{ top: `${(hour / 24) * 100}%` }}
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
                    const duration = entry.duration_minutes || 15;
                    const topPercent = (startMin / (24 * 60)) * 100;
                    const heightPercent = Math.max((duration / (24 * 60)) * 100, 2);
                    const widthPercent = 100 / entry.totalLanes;
                    const leftPercent = widthPercent * entry.lane;

                    console.log(`Entry ${entry.id}:`, { 
                      time: format(entry.timestamp, 'HH:mm'),
                      startMin, 
                      duration, 
                      topPercent, 
                      heightPercent,
                      lane: entry.lane,
                      totalLanes: entry.totalLanes
                    });

                    return (
                      <div
                        key={entry.id}
                        className={`absolute rounded-md border-l-4 shadow-sm cursor-move ${getColor(entry)} hover:shadow-md transition-shadow`}
                        style={{
                          top: `${topPercent}%`,
                          height: `${heightPercent}%`,
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          minHeight: '32px',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          zIndex: dragging?.id === entry.id ? 50 : 10
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          document.body.style.userSelect = 'none';
                          setDragging({
                            id: entry.id,
                            startY: e.clientY,
                            originalTop: topPercent,
                            type: 'move'
                          });
                        }}
                      >
                        <div className="px-2 py-1 flex items-center gap-2 h-full overflow-hidden" style={{ pointerEvents: 'none' }}>
                          <Icon className="w-3 h-3 flex-shrink-0" />
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <span className="text-xs font-medium capitalize truncate block">{getLabel(entry)}</span>
                            {entry.symptoms && entry.symptoms.length > 0 && entry.totalLanes === 1 && (
                              <span className="text-xs opacity-70 truncate block">• {entry.symptoms[0]}</span>
                            )}
                          </div>
                          <span className="text-xs opacity-60 whitespace-nowrap">{format(entry.timestamp, 'h:mm a')}</span>
                        </div>

                        {/* Resize handle */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black/10 group z-10"
                          style={{ pointerEvents: 'auto' }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            document.body.style.userSelect = 'none';
                            setDragging({
                              id: entry.id,
                              startY: e.clientY,
                              originalTop: topPercent,
                              type: 'resize'
                            });
                          }}
                        >
                          <div className="h-0.5 bg-current opacity-0 group-hover:opacity-30 mx-auto w-8" />
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
    </div>
  );
};
