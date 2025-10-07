import { Card } from "@/components/ui/card";
import { FlareEntry, EntryType } from "@/types/flare";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { 
  AlertTriangle, 
  Pill, 
  Zap, 
  TrendingUp, 
  Battery, 
  FileText,
  Clock
} from "lucide-react";

interface FlareTimelineProps {
  entries: FlareEntry[];
}

export const FlareTimeline = ({ entries }: FlareTimelineProps) => {
  const formatDate = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM d, yyyy");
  };

  const formatTime = (date: Date) => {
    return format(date, "h:mm a");
  };

  const getEntryIcon = (type: EntryType) => {
    switch (type) {
      case 'flare': return AlertTriangle;
      case 'medication': return Pill;
      case 'trigger': return Zap;
      case 'recovery': return TrendingUp;
      case 'energy': return Battery;
      case 'note': return FileText;
      default: return FileText;
    }
  };

  const getEntryStyle = (entry: FlareEntry) => {
    switch (entry.type) {
      case 'flare':
        if (!entry.severity) return 'bg-muted/30 text-foreground border-l-muted-foreground';
        switch (entry.severity) {
          case 'none':
            return 'bg-severity-none-bg text-severity-none border-l-severity-none';
          case 'mild':
            return 'bg-severity-mild-bg text-severity-mild border-l-severity-mild';
          case 'moderate':
            return 'bg-severity-moderate-bg text-severity-moderate border-l-severity-moderate';
          case 'severe':
            return 'bg-severity-severe-bg text-severity-severe border-l-severity-severe';
        }
        break;
      case 'medication':
        return 'bg-primary/10 text-primary border-l-primary';
      case 'trigger':
        return 'bg-destructive/10 text-destructive border-l-destructive';
      case 'recovery':
        return 'bg-severity-none-bg text-severity-none border-l-severity-none';
      case 'energy':
        return 'bg-accent/50 text-accent-foreground border-l-accent-foreground';
      case 'note':
        return 'bg-muted/30 text-foreground border-l-muted-foreground';
      default:
        return 'bg-muted/30 text-foreground border-l-muted-foreground';
    }
  };

  const getEntryTitle = (entry: FlareEntry) => {
    switch (entry.type) {
      case 'flare':
        return entry.severity ? `${entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1)} flare` : 'Flare update';
      case 'medication':
        return 'Medication taken';
      case 'trigger':
        return 'Potential trigger';
      case 'recovery':
        return 'Feeling better';
      case 'energy':
        return entry.energyLevel ? `Energy: ${entry.energyLevel.replace('-', ' ')}` : 'Energy update';
      case 'note':
        return 'Note';
      default:
        return 'Entry';
    }
  };

  // Group entries by date
  const groupedEntries = entries.reduce((groups, entry) => {
    const dateKey = format(entry.timestamp, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(entry);
    return groups;
  }, {} as Record<string, FlareEntry[]>);

  // Sort dates descending (most recent first)
  const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-clinical mb-2">No entries yet</h2>
        <p className="text-muted-foreground">
          Start tracking to see your timeline here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-clinical">Your Timeline</h2>
      
      {sortedDates.map((dateKey) => {
        const dayEntries = groupedEntries[dateKey].sort((a, b) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        );
        const firstEntry = dayEntries[0];
        
        return (
          <div key={dateKey} className="space-y-2">
            <div className="flex items-center gap-2 sticky top-16 bg-background/95 backdrop-blur py-2 z-10">
              <h3 className="font-clinical text-sm text-muted-foreground">
                {formatDate(firstEntry.timestamp)}
              </h3>
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-muted-foreground">
                {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            
            <div className="space-y-2 ml-4">
              {dayEntries.map((entry) => {
                const Icon = getEntryIcon(entry.type);
                
                return (
                  <Card 
                    key={entry.id}
                    className={`p-3 border-l-4 ${getEntryStyle(entry)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="font-clinical text-sm">
                          {getEntryTitle(entry)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatTime(entry.timestamp)}
                      </div>
                    </div>
                    
                    {entry.symptoms && entry.symptoms.length > 0 && (
                      <div className="text-xs mb-2">
                        <span className="font-clinical">Symptoms:</span> {entry.symptoms.join(' • ')}
                      </div>
                    )}
                    
                    {entry.medications && entry.medications.length > 0 && (
                      <div className="text-xs mb-2">
                        <span className="font-clinical">Medications:</span> {entry.medications.join(' • ')}
                      </div>
                    )}
                    
                    {entry.triggers && entry.triggers.length > 0 && (
                      <div className="text-xs mb-2">
                        <span className="font-clinical">Triggers:</span> {entry.triggers.join(' • ')}
                      </div>
                    )}
                    
                    {entry.note && (
                      <div className="text-xs text-foreground/80 mt-2 italic">
                        "{entry.note}"
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};