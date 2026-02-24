import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Pill, Flame, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  type: 'medication' | 'flare';
  timestamp: string;
  label?: string;
  dosage?: string;
  severity?: string;
  symptoms?: string[];
  triggers?: string[];
}

interface ADRSignal {
  medication: string;
  symptom: string;
  riskLevel: string;
  avgOnsetHours: number;
}

interface ADRTimelineProps {
  events: TimelineEvent[];
  adrSignals: ADRSignal[];
}

const SEVERITY_COLORS = {
  mild: 'bg-yellow-400',
  moderate: 'bg-orange-400',
  severe: 'bg-red-500',
};

export const ADRTimeline = ({ events, adrSignals }: ADRTimelineProps) => {
  // Group events by day
  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    events.forEach(event => {
      const day = format(parseISO(event.timestamp), 'yyyy-MM-dd');
      if (!groups[day]) groups[day] = [];
      groups[day].push(event);
    });
    // Return most recent 30 days
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30);
  }, [events]);

  // Check if a flare symptom matches a known ADR signal
  const isADRMatch = (med: string, symptom: string): ADRSignal | undefined => {
    return adrSignals.find(s => 
      s.medication.toLowerCase() === med.toLowerCase() && 
      s.symptom.toLowerCase() === symptom.toLowerCase()
    );
  };

  if (events.length === 0) {
    return (
      <Card className="p-6 bg-gradient-card border-0 text-center">
        <p className="text-sm text-muted-foreground">
          No medication or flare data in the last 90 days.
          Start logging to see your medication-symptom timeline.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground mb-2">
        Showing medication doses and flare events • ADR matches highlighted
      </p>

      {groupedEvents.map(([day, dayEvents]) => (
        <div key={day} className="relative">
          {/* Day label */}
          <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm py-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              {format(parseISO(day), 'EEE, MMM d')}
            </p>
          </div>

          {/* Events */}
          <div className="ml-3 border-l border-border/50 pl-3 space-y-1 pb-2">
            {dayEvents.map((event, i) => {
              if (event.type === 'medication') {
                return (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <div className="absolute -ml-[18px] w-3 h-3 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                      <Pill className="w-1.5 h-1.5 text-primary" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground w-10">
                        {format(parseISO(event.timestamp), 'HH:mm')}
                      </span>
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                        💊 {event.label}
                      </Badge>
                      {event.dosage && event.dosage !== 'standard' && (
                        <span className="text-[9px] text-muted-foreground">{event.dosage}</span>
                      )}
                    </div>
                  </div>
                );
              }

              // Flare event
              const sevColor = SEVERITY_COLORS[event.severity as keyof typeof SEVERITY_COLORS] || 'bg-gray-400';

              // Check if any symptoms match ADR signals for meds taken that day
              const dayMeds = dayEvents.filter(e => e.type === 'medication').map(e => e.label || '');
              const adrMatches = (event.symptoms || []).flatMap(symptom => 
                dayMeds.map(med => isADRMatch(med, symptom)).filter(Boolean)
              );

              return (
                <div key={i} className={cn(
                  "py-1.5 rounded-lg transition-colors",
                  adrMatches.length > 0 && "bg-red-500/5 px-2 -mx-1 border border-red-500/20"
                )}>
                  <div className="flex items-start gap-2">
                    <div className={cn("absolute -ml-[18px] w-3 h-3 rounded-full border-2", sevColor, "border-background")} />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground w-10">
                          {format(parseISO(event.timestamp), 'HH:mm')}
                        </span>
                        <Flame className={cn("w-3 h-3", event.severity === 'severe' ? 'text-red-500' : event.severity === 'moderate' ? 'text-orange-500' : 'text-yellow-500')} />
                        <span className="text-[10px] font-medium capitalize">{event.severity} flare</span>
                        {adrMatches.length > 0 && (
                          <Badge className="text-[8px] bg-red-500 text-white ml-auto">
                            <AlertTriangle className="w-2 h-2 mr-0.5" />
                            ADR
                          </Badge>
                        )}
                      </div>
                      {(event.symptoms?.length || 0) > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 ml-10">
                          {event.symptoms!.slice(0, 4).map((s, j) => {
                            const matchedADR = dayMeds.some(med => isADRMatch(med, s));
                            return (
                              <span key={j} className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded-full",
                                matchedADR ? "bg-red-500/15 text-red-600 dark:text-red-400 font-medium" : "bg-muted text-muted-foreground"
                              )}>
                                {matchedADR && '⚠️ '}{s}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
