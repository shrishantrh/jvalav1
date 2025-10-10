import { FlareEntry, EntryType } from "@/types/flare";
import { format, startOfDay, differenceInMinutes, addMinutes } from "date-fns";
import { 
  AlertTriangle, 
  Pill, 
  Zap, 
  TrendingUp, 
  Battery, 
  FileText
} from "lucide-react";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GanttTimelineProps {
  entries: FlareEntry[];
  onEntriesUpdate: () => void;
}

export const GanttTimeline = ({ entries, onEntriesUpdate }: GanttTimelineProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const getIcon = (type: EntryType) => {
    const icons = { flare: AlertTriangle, medication: Pill, trigger: Zap, recovery: TrendingUp, energy: Battery, note: FileText };
    return icons[type] || FileText;
  };

  const getColor = (entry: FlareEntry) => {
    if (entry.type === 'flare') {
      const colors = {
        none: 'bg-severity-none-bg border-l-4 border-severity-none',
        mild: 'bg-severity-mild-bg border-l-4 border-severity-mild',
        moderate: 'bg-severity-moderate-bg border-l-4 border-severity-moderate',
        severe: 'bg-severity-severe-bg border-l-4 border-severity-severe'
      };
      return colors[entry.severity || 'mild'];
    }
    const typeColors = {
      medication: 'bg-primary/5 border-l-4 border-primary',
      trigger: 'bg-destructive/5 border-l-4 border-destructive',
      recovery: 'bg-severity-none-bg border-l-4 border-severity-none',
      energy: 'bg-accent/20 border-l-4 border-accent-foreground',
      note: 'bg-muted/20 border-l-4 border-muted-foreground'
    };
    return typeColors[entry.type as keyof typeof typeColors] || typeColors.note;
  };

  const getLabel = (entry: FlareEntry) => {
    if (entry.type === 'flare') return entry.severity || 'flare';
    if (entry.type === 'energy') return entry.energyLevel?.replace('-', ' ') || 'energy';
    return entry.type;
  };

  // Group by day
  const groupedByDay = entries.reduce((acc, entry) => {
    const day = format(entry.timestamp, 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {} as Record<string, FlareEntry[]>);

  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

  const handleDragEnd = async (entry: FlareEntry, newMinutes: number) => {
    const dayStart = startOfDay(entry.timestamp);
    const newTimestamp = addMinutes(dayStart, newMinutes);
    
    const { error } = await supabase
      .from('flare_entries')
      .update({ timestamp: newTimestamp.toISOString() })
      .eq('id', entry.id);

    if (error) {
      toast.error("Failed to update");
    } else {
      onEntriesUpdate();
    }
    setDraggingId(null);
  };

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
      <div className="p-12 text-center bg-card rounded-lg border">
        <p className="text-muted-foreground">No entries yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sortedDays.map(day => {
        const dayEntries = groupedByDay[day];
        const dayStart = startOfDay(new Date(day));

        // Calculate overlaps and assign lanes
        const lanes: FlareEntry[][] = [];
        dayEntries.forEach(entry => {
          const startMin = differenceInMinutes(entry.timestamp, dayStart);
          const duration = entry.duration_minutes || 60;
          const endMin = startMin + duration;

          let placed = false;
          for (const lane of lanes) {
            const overlaps = lane.some(e => {
              const eStart = differenceInMinutes(e.timestamp, dayStart);
              const eDur = e.duration_minutes || 60;
              const eEnd = eStart + eDur;
              return !(endMin <= eStart || startMin >= eEnd);
            });
            if (!overlaps) {
              lane.push(entry);
              placed = true;
              break;
            }
          }
          if (!placed) lanes.push([entry]);
        });

        const laneWidth = lanes.length > 0 ? `${100 / lanes.length}%` : '100%';

        return (
          <div key={day}>
            <h3 className="text-sm font-clinical mb-3 text-muted-foreground">
              {format(new Date(day), 'EEE, MMM d')}
            </h3>
            
            <div ref={timelineRef} className="relative h-[500px] bg-card rounded-lg border overflow-hidden">
              {/* Time labels */}
              {[0, 6, 12, 18].map(hour => (
                <div key={hour} className="absolute left-0 text-xs text-muted-foreground px-2" style={{ top: `${(hour / 24) * 100}%` }}>
                  {hour}:00
                </div>
              ))}

              {/* Hour lines */}
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="absolute left-12 right-0 border-t border-border/30" style={{ top: `${(i / 24) * 100}%` }} />
              ))}

              {/* Entry blocks */}
              {lanes.map((lane, laneIdx) => 
                lane.map(entry => {
                  const Icon = getIcon(entry.type);
                  const startMin = differenceInMinutes(entry.timestamp, dayStart);
                  const duration = entry.duration_minutes || 60;
                  const top = (startMin / (24 * 60)) * 100;
                  const height = Math.max((duration / (24 * 60)) * 100, 3);

                  return (
                    <div
                      key={entry.id}
                      draggable
                      onDragStart={() => setDraggingId(entry.id)}
                      onDragEnd={(e) => {
                        if (!timelineRef.current) return;
                        const rect = timelineRef.current.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const newMin = Math.max(0, Math.min(24 * 60, (y / rect.height) * 24 * 60));
                        handleDragEnd(entry, newMin);
                      }}
                      className={`absolute rounded cursor-move ${getColor(entry)} hover:shadow-md transition-all`}
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        left: `calc(3rem + ${laneIdx * 100 / lanes.length}%)`,
                        width: laneWidth,
                        opacity: draggingId === entry.id ? 0.5 : 1
                      }}
                    >
                      <div className="p-2 h-full flex flex-col gap-1 overflow-hidden">
                        <div className="flex items-center gap-1">
                          <Icon className="w-3 h-3 flex-shrink-0" />
                          <span className="text-xs font-clinical truncate capitalize">{getLabel(entry)}</span>
                        </div>
                        {entry.symptoms && entry.symptoms.length > 0 && (
                          <span className="text-[10px] opacity-70 truncate">{entry.symptoms[0]}</span>
                        )}
                        {entry.note && (
                          <span className="text-[10px] italic opacity-60 truncate">"{entry.note.slice(0, 20)}"</span>
                        )}
                      </div>
                      
                      {/* Resize handle */}
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setResizingId(entry.id);
                          
                          const handleMouseMove = (me: MouseEvent) => {
                            if (!timelineRef.current) return;
                            const rect = timelineRef.current.getBoundingClientRect();
                            const y = me.clientY - rect.top;
                            const endMin = (y / rect.height) * 24 * 60;
                            const newDur = Math.max(15, endMin - startMin);
                            handleResize(entry, newDur);
                          };
                          
                          const handleMouseUp = () => {
                            setResizingId(null);
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-foreground/10 flex items-center justify-center"
                      >
                        <div className="w-6 h-0.5 bg-foreground/20 rounded" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
