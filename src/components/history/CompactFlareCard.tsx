import { useState } from 'react';
import { FlareEntry } from '@/types/flare';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { 
  ChevronDown, 
  MapPin, 
  Thermometer, 
  Droplets,
  Heart,
  Moon,
  Footprints,
  Clock,
  Edit,
  Trash2,
  MessageSquare,
  MoreHorizontal,
  Smile,
  Meh,
  Frown,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CompactFlareCardProps {
  entry: FlareEntry;
  onEdit?: (entry: FlareEntry) => void;
  onDelete?: (entryId: string) => void;
  onFollowUp?: (entry: FlareEntry) => void;
}

export const CompactFlareCard = ({ 
  entry, 
  onEdit, 
  onDelete, 
  onFollowUp 
}: CompactFlareCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = (open: boolean) => {
    haptics.light();
    setIsExpanded(open);
  };

  const getSeverityEmoji = (severity?: string) => {
    switch (severity) {
      case 'severe': return <Frown className="w-5 h-5 text-red-500" />;
      case 'moderate': return <Meh className="w-5 h-5 text-orange-500" />;
      case 'mild': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'none': return <Smile className="w-5 h-5 text-emerald-500" />;
      default: return <Meh className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getSeverityBg = (severity?: string) => {
    switch (severity) {
      case 'severe': return 'bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-900/10';
      case 'moderate': return 'bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10';
      case 'mild': return 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10';
      case 'none': return 'bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/10';
      default: return 'bg-gradient-to-br from-muted to-muted/50';
    }
  };

  const getSeverityLabel = (severity?: string) => {
    switch (severity) {
      case 'severe': return 'Severe';
      case 'moderate': return 'Moderate';
      case 'mild': return 'Mild';
      case 'none': return 'Great';
      default: return 'Logged';
    }
  };

  // Extract data safely
  const env = entry.environmentalData as any;
  const phys = entry.physiologicalData as any;
  
  const city = env?.location?.city || env?.city;
  const temp = env?.weather?.temperature;
  const humidity = env?.weather?.humidity;
  const condition = env?.weather?.condition;
  
  const heartRate = phys?.heartRate || phys?.heart_rate;
  const sleepHours = phys?.sleepHours || phys?.sleep_hours;
  const steps = phys?.steps;

  const hasData = city || temp || heartRate || sleepHours || entry.symptoms?.length || entry.triggers?.length || entry.note;

  return (
    <Collapsible open={isExpanded} onOpenChange={handleToggle}>
      <Card className={cn(
        "overflow-hidden transition-all duration-300 border-2",
        isExpanded ? "shadow-md border-primary/20" : "border-transparent shadow-sm"
      )}>
        {/* Compact Header - Tappable */}
        <CollapsibleTrigger className="w-full text-left">
          <div className="p-4 active:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              {/* Severity Emoji Circle */}
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm",
                getSeverityBg(entry.severity)
              )}>
                {getSeverityEmoji(entry.severity)}
              </div>

              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold text-foreground">
                    {getSeverityLabel(entry.severity)}
                  </span>
                  {entry.type !== 'flare' && (
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {entry.type}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {format(entry.timestamp, 'h:mm a')}
                  </span>
                  {city && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {city}
                    </span>
                  )}
                </div>
                
                {/* Symptoms Preview */}
                {entry.symptoms && entry.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {entry.symptoms.slice(0, 2).map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-2 py-0.5 bg-muted/50 font-medium">
                        {s}
                      </Badge>
                    ))}
                    {entry.symptoms.length > 2 && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium">
                        +{entry.symptoms.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Expand Arrow */}
              {hasData && (
                <ChevronDown className={cn(
                  "w-5 h-5 text-muted-foreground transition-transform duration-300 flex-shrink-0",
                  isExpanded && "rotate-180"
                )} />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
            {/* Quick Metrics Row */}
            {(temp || heartRate || sleepHours || steps) && (
              <div className="grid grid-cols-4 gap-2">
                {temp && (
                  <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/10">
                    <Thermometer className="w-4 h-4 mx-auto mb-1.5 text-orange-500" />
                    <p className="text-sm font-bold">{temp}°</p>
                  </div>
                )}
                {humidity && (
                  <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/10">
                    <Droplets className="w-4 h-4 mx-auto mb-1.5 text-blue-500" />
                    <p className="text-sm font-bold">{humidity}%</p>
                  </div>
                )}
                {heartRate && (
                  <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/20 dark:to-red-900/10">
                    <Heart className="w-4 h-4 mx-auto mb-1.5 text-red-500" />
                    <p className="text-sm font-bold">{heartRate}</p>
                  </div>
                )}
                {sleepHours && (
                  <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/20 dark:to-indigo-900/10">
                    <Moon className="w-4 h-4 mx-auto mb-1.5 text-indigo-500" />
                    <p className="text-sm font-bold">{sleepHours}h</p>
                  </div>
                )}
                {steps && (
                  <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/20 dark:to-emerald-900/10">
                    <Footprints className="w-4 h-4 mx-auto mb-1.5 text-emerald-500" />
                    <p className="text-sm font-bold">{steps >= 1000 ? `${(steps/1000).toFixed(1)}k` : steps}</p>
                  </div>
                )}
              </div>
            )}

            {/* Triggers */}
            {entry.triggers && entry.triggers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Triggers</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.triggers.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-xs px-2.5 py-0.5 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Medications */}
            {entry.medications && entry.medications.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Medications</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.medications.map((m, i) => (
                    <Badge key={i} variant="secondary" className="text-xs px-2.5 py-0.5">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            {entry.note && (
              <div className="p-3 rounded-2xl bg-muted/30">
                <p className="text-sm text-foreground/80 italic leading-relaxed">"{entry.note}"</p>
              </div>
            )}

            {/* Follow-ups */}
            {entry.followUps && entry.followUps.length > 0 && (
              <div className="border-t border-border/30 pt-3">
                <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Follow-ups ({entry.followUps.length})
                </p>
                <div className="space-y-2">
                  {entry.followUps.map((fu, i) => (
                    <div key={i} className="text-sm pl-4 border-l-2 border-primary/30">
                      <p className="text-foreground/80">{fu.note}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {format(new Date(fu.timestamp), "MMM d 'at' h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-10"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(entry);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-10"
                onClick={(e) => {
                  e.stopPropagation();
                  onFollowUp?.(entry);
                }}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Follow-up
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  haptics.warning();
                  onDelete?.(entry.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
