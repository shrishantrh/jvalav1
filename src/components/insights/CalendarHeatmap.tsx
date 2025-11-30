import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths, getDay, startOfWeek, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface CalendarHeatmapProps {
  entries: FlareEntry[];
}

export const CalendarHeatmap = ({ entries }: CalendarHeatmapProps) => {
  const [viewMonth, setViewMonth] = useState(new Date());
  
  const monthData = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Get the start of the week for the first day of month
    const weekStart = startOfWeek(start, { weekStartsOn: 0 });
    const paddingDays = [];
    let currentDay = weekStart;
    while (currentDay < start) {
      paddingDays.push({ date: currentDay, isPadding: true });
      currentDay = addDays(currentDay, 1);
    }

    return paddingDays.concat(days.map(date => {
      const dayEntries = entries.filter(e => isSameDay(e.timestamp, date));
      const flares = dayEntries.filter(e => e.type === 'flare');
      
      let severity = 0;
      let entryCount = dayEntries.length;
      
      if (flares.length > 0) {
        const severities = flares.map(f => {
          switch (f.severity) {
            case 'severe': return 3;
            case 'moderate': return 2;
            case 'mild': return 1;
            default: return 0;
          }
        });
        severity = Math.max(...severities);
      }

      return { date, severity, entryCount, isPadding: false };
    }));
  }, [entries, viewMonth]);

  const getSeverityClass = (severity: number, entryCount: number) => {
    if (entryCount === 0) return "bg-muted/30";
    switch (severity) {
      case 3: return "bg-severity-severe/80";
      case 2: return "bg-severity-moderate/80";
      case 1: return "bg-severity-mild/80";
      default: return "bg-primary/30";
    }
  };

  const stats = useMemo(() => {
    const monthEntries = entries.filter(e => {
      const entryMonth = e.timestamp.getMonth();
      const entryYear = e.timestamp.getFullYear();
      return entryMonth === viewMonth.getMonth() && entryYear === viewMonth.getFullYear();
    });

    const flares = monthEntries.filter(e => e.type === 'flare');
    const severeCount = flares.filter(f => f.severity === 'severe').length;
    const moderateCount = flares.filter(f => f.severity === 'moderate').length;
    const mildCount = flares.filter(f => f.severity === 'mild').length;
    const daysWithEntries = new Set(monthEntries.map(e => format(e.timestamp, 'yyyy-MM-dd'))).size;

    return {
      totalEntries: monthEntries.length,
      flares: flares.length,
      severe: severeCount,
      moderate: moderateCount,
      mild: mildCount,
      daysTracked: daysWithEntries,
    };
  }, [entries, viewMonth]);

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <Card className="p-4 shadow-soft bg-gradient-card border-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Activity</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {format(viewMonth, 'MMMM yyyy')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMonth(addDays(viewMonth, 32))}
            disabled={viewMonth.getMonth() === new Date().getMonth() && viewMonth.getFullYear() === new Date().getFullYear()}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day, i) => (
          <div key={i} className="text-xs text-muted-foreground text-center py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {monthData.map((day, index) => (
          <div
            key={index}
            className={cn(
              "aspect-square rounded-sm flex items-center justify-center text-xs transition-all",
              day.isPadding 
                ? "opacity-0" 
                : getSeverityClass(day.severity, day.entryCount),
              !day.isPadding && day.entryCount > 0 && "cursor-pointer hover:ring-2 hover:ring-primary/30",
              isSameDay(day.date, new Date()) && !day.isPadding && "ring-2 ring-primary"
            )}
            title={!day.isPadding ? `${format(day.date, 'MMM d')}: ${day.entryCount} entries` : undefined}
          >
            {!day.isPadding && (
              <span className={cn(
                "text-[10px]",
                day.severity > 0 ? "text-white font-medium" : "text-muted-foreground"
              )}>
                {format(day.date, 'd')}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-muted/30" />
          <span>None</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-severity-mild/80" />
          <span>Mild</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-severity-moderate/80" />
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-severity-severe/80" />
          <span>Severe</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{stats.daysTracked}</p>
          <p className="text-xs text-muted-foreground">Days tracked</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{stats.flares}</p>
          <p className="text-xs text-muted-foreground">Flares</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{stats.totalEntries}</p>
          <p className="text-xs text-muted-foreground">Total entries</p>
        </div>
      </div>
    </Card>
  );
};
