import { FlareEntry, EntryType } from "@/types/flare";
import { format, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { 
  AlertTriangle, 
  Pill, 
  Zap, 
  TrendingUp, 
  Battery, 
  FileText
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GanttTimelineProps {
  entries: FlareEntry[];
  onEntriesUpdate: () => void;
}

export const GanttTimeline = ({ entries, onEntriesUpdate }: GanttTimelineProps) => {
  const [draggingEntry, setDraggingEntry] = useState<string | null>(null);
  const [resizingEntry, setResizingEntry] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getEntryIcon = (type: EntryType) => {
    const icons = {
      flare: AlertTriangle,
      medication: Pill,
      trigger: Zap,
      recovery: TrendingUp,
      energy: Battery,
      note: FileText
    };
    return icons[type] || FileText;
  };

  const getEntryColor = (entry: FlareEntry) => {
    if (entry.type === 'flare') {
      const colors = {
        none: 'bg-severity-none-bg border-severity-none text-severity-none',
        mild: 'bg-severity-mild-bg border-severity-mild text-severity-mild',
        moderate: 'bg-severity-moderate-bg border-severity-moderate text-severity-moderate',
        severe: 'bg-severity-severe-bg border-severity-severe text-severity-severe'
      };
      return colors[entry.severity || 'mild'];
    }
    const typeColors = {
      medication: 'bg-primary/10 border-primary text-primary',
      trigger: 'bg-destructive/10 border-destructive text-destructive',
      recovery: 'bg-severity-none-bg border-severity-none text-severity-none',
      energy: 'bg-accent/50 border-accent-foreground text-accent-foreground',
      note: 'bg-muted/30 border-muted-foreground text-foreground'
    };
    return typeColors[entry.type as keyof typeof typeColors] || typeColors.note;
  };

  const getEntryTitle = (entry: FlareEntry) => {
    if (entry.type === 'flare') return entry.severity || 'Flare';
    if (entry.type === 'energy') return entry.energyLevel?.replace('-', ' ') || 'Energy';
    return entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
  };

  // Group entries by day
  const groupedByDay = entries.reduce((acc, entry) => {
    const dayKey = format(entry.timestamp, 'yyyy-MM-dd');
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(entry);
    return acc;
  }, {} as Record<string, FlareEntry[]>);

  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    setDraggingEntry(entryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = async (e: React.DragEvent, entry: FlareEntry) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesPerPixel = (24 * 60) / rect.height;
    const newMinutes = Math.max(0, Math.min(24 * 60, y * minutesPerPixel));
    
    const dayStart = startOfDay(entry.timestamp);
    const newTimestamp = new Date(dayStart.getTime() + newMinutes * 60000);
    
    const { error } = await supabase
      .from('flare_entries')
      .update({ timestamp: newTimestamp.toISOString() })
      .eq('id', entry.id);

    if (error) {
      toast.error("Failed to update entry time");
    } else {
      onEntriesUpdate();
    }

    setDraggingEntry(null);
  };

  const handleResizeStart = (e: React.MouseEvent, entryId: string) => {
    e.preventDefault();
    setResizingEntry(entryId);
  };

  useEffect(() => {
    const handleMouseMove = async (e: MouseEvent) => {
      if (!resizingEntry || !containerRef.current) return;

      const entry = entries.find(e => e.id === resizingEntry);
      if (!entry) return;

      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const minutesPerPixel = (24 * 60) / rect.height;
      const dayStart = startOfDay(entry.timestamp);
      
      const startMinutes = differenceInMinutes(entry.timestamp, dayStart);
      const endMinutes = Math.max(startMinutes + 15, Math.min(24 * 60, y * minutesPerPixel));
      const durationMinutes = endMinutes - startMinutes;

      const endTimestamp = new Date(entry.timestamp.getTime() + durationMinutes * 60000);

      const { error } = await supabase
        .from('flare_entries')
        .update({ 
          duration_minutes: durationMinutes,
          end_timestamp: endTimestamp.toISOString()
        })
        .eq('id', entry.id);

      if (!error) {
        onEntriesUpdate();
      }
    };

    const handleMouseUp = () => {
      setResizingEntry(null);
    };

    if (resizingEntry) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingEntry, entries, onEntriesUpdate]);

  const renderDayTimeline = (dayKey: string, dayEntries: FlareEntry[]) => {
    const dayStart = startOfDay(new Date(dayKey));
    const dayEnd = endOfDay(new Date(dayKey));
    const totalMinutes = differenceInMinutes(dayEnd, dayStart);

    // Find overlapping entries and assign columns
    const entriesWithColumns = dayEntries.map(entry => {
      const startMinutes = differenceInMinutes(entry.timestamp, dayStart);
      const durationMinutes = (entry as any).duration_minutes || 60;
      const endMinutes = startMinutes + durationMinutes;
      
      return { entry, startMinutes, endMinutes, column: 0 };
    });

    // Simple column assignment: check for overlaps
    entriesWithColumns.forEach((item, i) => {
      const overlapping = entriesWithColumns
        .slice(0, i)
        .filter(other => 
          !(item.endMinutes <= other.startMinutes || item.startMinutes >= other.endMinutes)
        );
      
      const usedColumns = new Set(overlapping.map(o => o.column));
      let column = 0;
      while (usedColumns.has(column)) column++;
      item.column = column;
    });

    const maxColumns = Math.max(...entriesWithColumns.map(e => e.column), 0) + 1;
    const columnWidth = maxColumns > 0 ? 100 / maxColumns : 100;

    return (
      <div key={dayKey} className="mb-8">
        <h3 className="text-sm font-clinical mb-2 text-muted-foreground sticky top-0 bg-background z-10 py-2">
          {format(new Date(dayKey), 'MMM d, yyyy')}
        </h3>
        
        <div 
          ref={containerRef}
          className="relative h-[600px] bg-card border border-border rounded-lg overflow-hidden"
        >
          {/* Time markers */}
          {Array.from({ length: 25 }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-border/30 flex items-center"
              style={{ top: `${(i / 24) * 100}%` }}
            >
              <span className="text-xs text-muted-foreground bg-background px-2 py-0.5">
                {format(new Date(2024, 0, 1, i, 0), 'h:mm a')}
              </span>
            </div>
          ))}

          {/* Entry blocks */}
          {entriesWithColumns.map(({ entry, startMinutes, endMinutes, column }) => {
            const Icon = getEntryIcon(entry.type);
            const topPercent = (startMinutes / totalMinutes) * 100;
            const heightPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;
            
            return (
              <div
                key={entry.id}
                draggable
                onDragStart={(e) => handleDragStart(e, entry.id)}
                onDragEnd={(e) => handleDragEnd(e, entry)}
                className={`absolute border-l-4 rounded cursor-move ${getEntryColor(entry)} transition-all hover:shadow-lg`}
                style={{
                  top: `${topPercent}%`,
                  height: `${Math.max(heightPercent, 2)}%`,
                  left: `${60 + column * columnWidth}px`,
                  width: `calc(${columnWidth}% - 4px)`,
                  opacity: draggingEntry === entry.id ? 0.5 : 1
                }}
              >
                <div className="p-1.5 h-full flex flex-col text-xs overflow-hidden">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Icon className="w-3 h-3 flex-shrink-0" />
                    <span className="font-clinical truncate text-[10px]">{getEntryTitle(entry)}</span>
                  </div>
                  
                  {entry.symptoms && entry.symptoms.length > 0 && (
                    <div className="text-[9px] truncate opacity-80">
                      {entry.symptoms[0]}
                    </div>
                  )}
                  
                  {entry.note && (
                    <div className="text-[9px] italic truncate opacity-70 mt-auto">
                      "{entry.note.slice(0, 30)}"
                    </div>
                  )}
                </div>

                {/* Resize handle */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, entry.id)}
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-foreground/10 flex items-center justify-center"
                >
                  <div className="w-8 h-0.5 bg-foreground/30 rounded"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (entries.length === 0) {
    return (
      <div className="p-8 text-center bg-card border border-border rounded-lg">
        <h2 className="text-lg font-clinical mb-2">No entries yet</h2>
        <p className="text-muted-foreground">Start tracking to see your timeline here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-clinical">Timeline</h2>
        <p className="text-xs text-muted-foreground">Drag to move • Resize from bottom</p>
      </div>
      
      {sortedDays.map(day => renderDayTimeline(day, groupedByDay[day]))}
    </div>
  );
};
