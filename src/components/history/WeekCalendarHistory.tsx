import { useState, useMemo } from 'react';
import { FlareEntry } from '@/types/flare';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
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

  const getSeverityForDay = (day: Date): 'severe' | 'moderate' | 'mild' | 'none' | null => {
    const dayEntries = getEntriesForDay(day).filter(e => e.type === 'flare');
    if (dayEntries.some(e => e.severity === 'severe')) return 'severe';
    if (dayEntries.some(e => e.severity === 'moderate')) return 'moderate';
    if (dayEntries.some(e => e.severity === 'mild')) return 'mild';
    if (dayEntries.some(e => e.severity === 'none')) return 'none';
    if (dayEntries.length > 0) return 'mild';
    return null;
  };

  // Selected date entries
  const selectedEntries = useMemo(() => {
    return entries
      .filter(e => isSameDay(e.timestamp, selectedDate))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [entries, selectedDate]);

  const handleDateSelect = (day: Date) => {
    haptics.selection();
    setSelectedDate(day);
  };

  const navigatePrev = () => {
    haptics.light();
    if (viewMode === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    haptics.light();
    if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const goToToday = () => {
    haptics.light();
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const toggleViewMode = (mode: 'week' | 'month') => {
    haptics.selection();
    setViewMode(mode);
  };

  const getSeverityDotColor = (severity: string | null) => {
    switch (severity) {
      case 'severe': return 'bg-red-500';
      case 'moderate': return 'bg-orange-500';
      case 'mild': return 'bg-amber-500';
      case 'none': return 'bg-emerald-500';
      case 'trackable': return 'bg-violet-500';
      default: return '';
    }
  };

  // Check if a day has trackable entries (non-flare custom types)
  const hasTrackablesForDay = (day: Date): boolean => {
    return getEntriesForDay(day).some(e => e.type?.startsWith('trackable:'));
  };

  return (
    <div className="space-y-5" data-tour="calendar-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={navigatePrev}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-base font-bold min-w-[160px] text-center">
            {viewMode === 'week' 
              ? `${format(days[0], 'MMM d')} – ${format(days[days.length - 1], 'MMM d')}`
              : format(currentDate, 'MMMM yyyy')
            }
          </h2>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={navigateNext}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
          <Button 
            variant={viewMode === 'week' ? 'secondary' : 'ghost'}
            size="sm" 
            className="h-8 text-xs rounded-lg px-3"
            onClick={() => toggleViewMode('week')}
          >
            Week
          </Button>
          <Button
            variant={viewMode === 'month' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 text-xs rounded-lg px-3"
            onClick={() => toggleViewMode('month')}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-4">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
            <div key={i} className="text-center text-xs font-semibold text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={cn(
          "grid grid-cols-7 gap-1.5",
          viewMode === 'month' && "gap-y-2"
        )}>
          {days.map((day, i) => {
            const severity = getSeverityForDay(day);
            const entryCount = getEntriesForDay(day).length;
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;
            
            return (
              <button
                key={i}
                onClick={() => handleDateSelect(day)}
                className={cn(
                  "relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-200",
                  "active:scale-95 touch-manipulation",
                  isSelected && "bg-primary text-primary-foreground shadow-md",
                  !isSelected && isToday(day) && "ring-2 ring-primary/50",
                  !isSelected && !isToday(day) && "hover:bg-muted/50",
                  !isCurrentMonth && "opacity-30"
                )}
              >
                <span className={cn(
                  "text-sm font-semibold",
                  isToday(day) && !isSelected && "text-primary"
                )}>
                  {format(day, 'd')}
                </span>
                
                {/* Severity dot indicator */}
                {severity && !isSelected && (
                  <div className={cn(
                    "absolute bottom-1.5 w-1.5 h-1.5 rounded-full",
                    getSeverityDotColor(severity)
                  )} />
                )}
                
                {/* Entry count for selected */}
                {isSelected && entryCount > 0 && (
                  <span className="text-[10px] opacity-80">{entryCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Today button */}
        {!isToday(selectedDate) && (
          <div className="mt-4 pt-3 border-t border-border/30">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-primary font-semibold"
              onClick={goToToday}
            >
              Jump to Today
            </Button>
          </div>
        )}
      </Card>

      {/* Selected Date Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-base font-bold flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary" />
          {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE, MMMM d')}
        </h3>
        <Badge variant="secondary" className="text-xs font-semibold px-3 py-1">
          {selectedEntries.length} {selectedEntries.length === 1 ? 'entry' : 'entries'}
        </Badge>
      </div>

      {/* Entries for Selected Date */}
      {selectedEntries.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">No entries for this date</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Tap Log to add one</p>
        </Card>
      ) : (
        <div className="space-y-3">
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
