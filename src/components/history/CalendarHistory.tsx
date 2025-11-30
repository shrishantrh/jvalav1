import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths, isToday } from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarHistoryProps {
  entries: FlareEntry[];
  onSelectDate: (date: Date) => void;
  selectedDate: Date;
}

export const CalendarHistory = ({ entries, onSelectDate, selectedDate }: CalendarHistoryProps) => {
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

  // Get severity color for heatmap - uses consistent color scale
  const getDayColor = (entries: FlareEntry[]) => {
    if (entries.length === 0) return null;
    
    const flares = entries.filter(e => e.type === 'flare' && e.severity);
    if (flares.length === 0) {
      // Has entries but no flares - show as tracked day
      return 'bg-primary/20';
    }

    // Calculate average severity score
    const severityScore = flares.reduce((sum, f) => {
      if (f.severity === 'severe') return sum + 3;
      if (f.severity === 'moderate') return sum + 2;
      if (f.severity === 'mild') return sum + 1;
      return sum;
    }, 0) / flares.length;

    if (severityScore >= 2.5) return 'bg-severity-severe';
    if (severityScore >= 1.5) return 'bg-severity-moderate';
    return 'bg-severity-mild';
  };

  const navigatePrev = () => setCurrentDate(subMonths(currentDate, 1));
  const navigateNext = () => setCurrentDate(addMonths(currentDate, 1));

  const getDaysToShow = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  };

  const days = getDaysToShow();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-8 w-8">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="font-clinical text-base">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <Button variant="ghost" size="icon" onClick={navigateNext} className="h-8 w-8">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-severity-mild" />
          <span>Mild</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-severity-moderate" />
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-severity-severe" />
          <span>Severe</span>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
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
          const dayColor = getDayColor(dayEntries);
          const hasEntries = dayEntries.length > 0;
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "aspect-square rounded-lg relative transition-all flex items-center justify-center",
                "hover:ring-2 hover:ring-primary/30 focus:outline-none",
                isSelected && "ring-2 ring-primary",
                !isCurrentMonth && "opacity-30",
              )}
            >
              {/* Background color for heatmap */}
              {dayColor && (
                <div className={cn(
                  "absolute inset-1 rounded-md transition-colors",
                  dayColor
                )} />
              )}
              
              {/* Day number */}
              <span className={cn(
                "relative z-10 text-xs font-medium",
                isToday(day) && "text-primary font-bold",
                dayColor && !isToday(day) && "text-white",
                dayColor === 'bg-severity-mild' && "text-foreground",
                dayColor === 'bg-primary/20' && "text-foreground"
              )}>
                {format(day, 'd')}
              </span>
              
              {/* Entry count indicator */}
              {hasEntries && dayEntries.length > 1 && (
                <span className="absolute bottom-0.5 right-0.5 text-[8px] text-muted-foreground bg-background/80 rounded px-0.5">
                  {dayEntries.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date summary */}
      {getEntriesForDate(selectedDate).length > 0 && (
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-1">
            {format(selectedDate, 'EEEE, MMMM d')}
          </p>
          <p className="text-sm font-medium">
            {getEntriesForDate(selectedDate).length} {getEntriesForDate(selectedDate).length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      )}
    </div>
  );
};