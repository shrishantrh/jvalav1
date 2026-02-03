import { useState, useMemo } from 'react';
import { FlareEntry } from '@/types/flare';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  addWeeks, 
  subWeeks,
  isToday,
  startOfMonth,
  endOfMonth,
  isSameMonth
} from 'date-fns';
import { CompactFlareCard } from './CompactFlareCard';
import { EditFlareDialog } from '@/components/flare/EditFlareDialog';
import { FollowUpDialog } from '@/components/flare/FollowUpDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface WeekCalendarHistoryProps {
  entries: FlareEntry[];
  onUpdate?: (entryId: string, updates: Partial<FlareEntry>) => void;
  onDelete?: (entryId: string) => void;
  onAddFollowUp?: (entryId: string, note: string) => void;
}

export const WeekCalendarHistory = ({
  entries,
  onUpdate,
  onDelete,
  onAddFollowUp,
}: WeekCalendarHistoryProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [editingEntry, setEditingEntry] = useState<FlareEntry | null>(null);
  const [followUpEntry, setFollowUpEntry] = useState<FlareEntry | null>(null);

  // Get days for current view
  const days = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const monthDays = eachDayOfInterval({ start, end });
      
      // Add padding days for the first week
      const firstDayOfMonth = start.getDay();
      const paddingStart = [];
      for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        paddingStart.push(new Date(start.getTime() - (i + 1) * 24 * 60 * 60 * 1000));
      }
      
      return [...paddingStart, ...monthDays];
    }
  }, [currentDate, viewMode]);

  // Count flares per day
  const getEntriesForDay = (day: Date) => {
    return entries.filter(e => isSameDay(e.timestamp, day));
  };

  const getSeverityForDay = (day: Date): 'severe' | 'moderate' | 'mild' | null => {
    const dayEntries = getEntriesForDay(day).filter(e => e.type === 'flare');
    if (dayEntries.some(e => e.severity === 'severe')) return 'severe';
    if (dayEntries.some(e => e.severity === 'moderate')) return 'moderate';
    if (dayEntries.some(e => e.severity === 'mild')) return 'mild';
    if (dayEntries.length > 0) return 'mild';
    return null;
  };

  // Selected date entries
  const selectedEntries = useMemo(() => {
    return entries
      .filter(e => isSameDay(e.timestamp, selectedDate))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [entries, selectedDate]);

  const navigatePrev = () => {
    if (viewMode === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-sm font-semibold min-w-[140px] text-center">
            {viewMode === 'week' 
              ? `${format(days[0], 'MMM d')} - ${format(days[days.length - 1], 'MMM d')}`
              : format(currentDate, 'MMMM yyyy')
            }
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={goToToday}
          >
            Today
          </Button>
          <Button
            variant={viewMode === 'week' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('week')}
          >
            Week
          </Button>
          <Button
            variant={viewMode === 'month' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('month')}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-3 glass-card">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={cn(
          "grid grid-cols-7 gap-1",
          viewMode === 'month' && "grid-rows-5"
        )}>
          {days.map((day, i) => {
            const severity = getSeverityForDay(day);
            const entryCount = getEntriesForDay(day).length;
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;
            
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all text-xs",
                  isSelected && "ring-2 ring-primary",
                  isToday(day) && !isSelected && "ring-1 ring-primary/50",
                  !isCurrentMonth && "opacity-40",
                  severity === 'severe' && "bg-red-500/20 text-red-700 dark:text-red-400",
                  severity === 'moderate' && "bg-amber-500/20 text-amber-700 dark:text-amber-400",
                  severity === 'mild' && "bg-blue-500/20 text-blue-700 dark:text-blue-400",
                  !severity && "hover:bg-muted/50"
                )}
              >
                <span className={cn(
                  "font-medium",
                  isToday(day) && "text-primary font-bold"
                )}>
                  {format(day, 'd')}
                </span>
                {entryCount > 0 && (
                  <span className="text-[8px] opacity-70">{entryCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected Date Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary" />
          {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE, MMM d')}
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {selectedEntries.length} {selectedEntries.length === 1 ? 'entry' : 'entries'}
        </Badge>
      </div>

      {/* Entries for Selected Date */}
      {selectedEntries.length === 0 ? (
        <Card className="p-6 text-center glass-card">
          <p className="text-sm text-muted-foreground">No entries for this date</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {selectedEntries.map(entry => (
            <CompactFlareCard
              key={entry.id}
              entry={entry}
              onEdit={setEditingEntry}
              onDelete={onDelete}
              onFollowUp={setFollowUpEntry}
            />
          ))}
        </div>
      )}

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
