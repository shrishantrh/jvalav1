import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Grid3X3, List } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, isToday } from "date-fns";
import { cn } from "@/lib/utils";

type ViewMode = 'month' | 'week' | 'day';

interface CalendarHistoryProps {
  entries: FlareEntry[];
  onSelectDate: (date: Date) => void;
  selectedDate: Date;
}

export const CalendarHistory = ({ entries, onSelectDate, selectedDate }: CalendarHistoryProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const entriesByDate = useMemo(() => {
    const map = new Map<string, FlareEntry[]>();
    entries.forEach(entry => {
      const key = format(entry.timestamp, 'yyyy-MM-dd');
      const existing = map.get(key) || [];
      map.set(key, [...existing, entry]);
    });
    return map;
  }, [entries]);

  const getEntriesForDate = (date: Date) => {
    return entriesByDate.get(format(date, 'yyyy-MM-dd')) || [];
  };

  const getSeverityColor = (entries: FlareEntry[]) => {
    const severities = entries.filter(e => e.severity).map(e => e.severity);
    if (severities.includes('severe')) return 'bg-severity-severe';
    if (severities.includes('moderate')) return 'bg-severity-moderate';
    if (severities.includes('mild')) return 'bg-severity-mild';
    return 'bg-primary/50';
  };

  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(prev => new Date(prev.setDate(prev.getDate() - 1)));
  };

  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(prev => new Date(prev.setDate(prev.getDate() + 1)));
  };

  const getDaysToShow = () => {
    if (viewMode === 'month') {
      const start = startOfWeek(startOfMonth(currentDate));
      const end = endOfWeek(endOfMonth(currentDate));
      return eachDayOfInterval({ start, end });
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return eachDayOfInterval({ start, end });
    }
    return [currentDate];
  };

  const days = getDaysToShow();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-clinical text-base min-w-[140px] text-center">
            {viewMode === 'day' 
              ? format(currentDate, 'EEEE, MMM d')
              : viewMode === 'week'
              ? `Week of ${format(startOfWeek(currentDate), 'MMM d')}`
              : format(currentDate, 'MMMM yyyy')}
          </h3>
          <Button variant="ghost" size="icon" onClick={navigateNext} className="h-8 w-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex bg-muted rounded-lg p-0.5">
          <Button
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('month')}
            className="h-7 px-2 text-xs"
          >
            <Grid3X3 className="w-3 h-3 mr-1" />
            Month
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
            className="h-7 px-2 text-xs"
          >
            <CalendarIcon className="w-3 h-3 mr-1" />
            Week
          </Button>
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
            className="h-7 px-2 text-xs"
          >
            <List className="w-3 h-3 mr-1" />
            Day
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      {viewMode !== 'day' && (
        <>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs text-muted-foreground font-medium py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dayEntries = getEntriesForDate(day);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    onSelectDate(day);
                    if (dayEntries.length > 0) {
                      setViewMode('day');
                      setCurrentDate(day);
                    }
                  }}
                  className={cn(
                    "aspect-square p-1 rounded-lg relative transition-all",
                    "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50",
                    isSelected && "ring-2 ring-primary",
                    !isCurrentMonth && "opacity-40",
                    isToday(day) && "bg-primary/10"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium",
                    isToday(day) && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {dayEntries.length > 0 && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        getSeverityColor(dayEntries)
                      )} />
                      {dayEntries.length > 1 && (
                        <span className="text-[8px] text-muted-foreground">
                          +{dayEntries.length - 1}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Day View - Hourly timeline */}
      {viewMode === 'day' && (
        <DayView 
          date={currentDate} 
          entries={getEntriesForDate(currentDate)} 
        />
      )}
    </div>
  );
};

interface DayViewProps {
  date: Date;
  entries: FlareEntry[];
}

const DayView = ({ date, entries }: DayViewProps) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const getEntriesForHour = (hour: number) => {
    return entries.filter(e => new Date(e.timestamp).getHours() === hour);
  };

  const getSeverityBg = (severity?: string) => {
    switch (severity) {
      case 'severe': return 'bg-severity-severe/20 border-severity-severe';
      case 'moderate': return 'bg-severity-moderate/20 border-severity-moderate';
      case 'mild': return 'bg-severity-mild/20 border-severity-mild';
      default: return 'bg-muted';
    }
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'flare': return '🔥';
      case 'energy': return '⚡';
      case 'medication': return '💊';
      case 'trigger': return '⚠️';
      case 'recovery': return '💚';
      default: return '📝';
    }
  };

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center bg-muted/30">
        <p className="text-muted-foreground text-sm">
          No entries on {format(date, 'MMMM d, yyyy')}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-1 max-h-[400px] overflow-y-auto">
      {hours.map(hour => {
        const hourEntries = getEntriesForHour(hour);
        if (hourEntries.length === 0) return null;
        
        return (
          <div key={hour} className="flex gap-3 items-start">
            <div className="w-14 text-xs text-muted-foreground pt-2 text-right flex-shrink-0">
              {format(new Date().setHours(hour, 0), 'h a')}
            </div>
            <div className="flex-1 space-y-1">
              {hourEntries.map(entry => (
                <Card 
                  key={entry.id}
                  className={cn(
                    "p-3 border-l-4",
                    getSeverityBg(entry.severity)
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{getEntryIcon(entry.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm capitalize">{entry.type}</span>
                        {entry.severity && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-background">
                            {entry.severity}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(entry.timestamp, 'h:mm a')}
                        </span>
                      </div>
                      {entry.symptoms && entry.symptoms.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.symptoms.join(', ')}
                        </p>
                      )}
                      {entry.note && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          "{entry.note}"
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
