import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  // Get severity level for a day
  const getDaySeverity = (dayEntries: FlareEntry[]): 'none' | 'tracked' | 'mild' | 'moderate' | 'severe' => {
    if (dayEntries.length === 0) return 'none';
    
    const flares = dayEntries.filter(e => e.type === 'flare' && e.severity);
    if (flares.length === 0) return 'tracked';

    const severityScore = flares.reduce((sum, f) => {
      if (f.severity === 'severe') return sum + 3;
      if (f.severity === 'moderate') return sum + 2;
      if (f.severity === 'mild') return sum + 1;
      return sum;
    }, 0) / flares.length;

    if (severityScore >= 2.5) return 'severe';
    if (severityScore >= 1.5) return 'moderate';
    return 'mild';
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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-8 w-8 rounded-xl">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="font-semibold text-sm">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <Button variant="ghost" size="icon" onClick={navigateNext} className="h-8 w-8 rounded-xl">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Legend - more compact */}
      <div className="flex items-center justify-center gap-3 text-[9px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-severity-mild" />
          <span>Mild</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-severity-moderate" />
          <span>Mod</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-severity-severe" />
          <span>Severe</span>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(day => {
          const dayEntries = getEntriesForDate(day);
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const severity = getDaySeverity(dayEntries);
          const hasEntries = dayEntries.length > 0;
          
          const getBgClass = () => {
            switch (severity) {
              case 'mild': return 'bg-severity-mild';
              case 'moderate': return 'bg-severity-moderate';
              case 'severe': return 'bg-severity-severe';
              case 'tracked': return 'bg-primary/20';
              default: return '';
            }
          };
          
          const getTextClass = () => {
            if (isToday(day)) return 'text-primary font-bold';
            if (severity === 'severe' || severity === 'moderate') return 'text-white';
            return 'text-foreground';
          };
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "aspect-square rounded-lg relative transition-all flex items-center justify-center min-h-[36px]",
                "hover:ring-1 hover:ring-primary/30 focus:outline-none press-effect",
                isSelected && "ring-2 ring-primary",
                !isCurrentMonth && "opacity-30",
              )}
            >
              {severity !== 'none' && (
                <div className={cn(
                  "absolute inset-0.5 rounded-md transition-colors",
                  getBgClass()
                )} />
              )}
              
              <span className={cn(
                "relative z-10 text-[11px] font-medium",
                getTextClass()
              )}>
                {format(day, 'd')}
              </span>
              
              {hasEntries && dayEntries.length > 1 && (
                <span className={cn(
                  "absolute bottom-0 right-0.5 text-[7px] z-10",
                  severity === 'severe' || severity === 'moderate' 
                    ? "text-white/70" 
                    : "text-muted-foreground"
                )}>
                  {dayEntries.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
