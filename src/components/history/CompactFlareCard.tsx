import { useState } from 'react';
import { FlareEntry } from '@/types/flare';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { 
  ChevronDown, 
  ChevronUp, 
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
  Zap,
  Activity,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'severe': return 'bg-red-500';
      case 'moderate': return 'bg-amber-500';
      case 'mild': return 'bg-blue-500';
      default: return 'bg-muted';
    }
  };

  const getSeverityBg = (severity?: string) => {
    switch (severity) {
      case 'severe': return 'bg-red-500/10 border-red-500/20';
      case 'moderate': return 'bg-amber-500/10 border-amber-500/20';
      case 'mild': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-muted/50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'flare': return <Zap className="w-3.5 h-3.5" />;
      case 'energy': return <Activity className="w-3.5 h-3.5" />;
      default: return <FileText className="w-3.5 h-3.5" />;
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

  const hasData = city || temp || heartRate || sleepHours;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn(
        "overflow-hidden transition-all",
        isExpanded && "ring-1 ring-primary/20"
      )}>
        {/* Compact Header */}
        <div className="p-3">
          <div className="flex items-center gap-2.5">
            {/* Severity Indicator */}
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              entry.type === 'flare' ? getSeverityColor(entry.severity) : 'bg-primary'
            )}>
              <span className="text-white">{getTypeIcon(entry.type)}</span>
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm font-semibold capitalize">{entry.type}</span>
                {entry.severity && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[9px] capitalize px-1.5 py-0",
                      entry.severity === 'severe' && "text-red-600 border-red-500/30",
                      entry.severity === 'moderate' && "text-amber-600 border-amber-500/30",
                      entry.severity === 'mild' && "text-blue-600 border-blue-500/30"
                    )}
                  >
                    {entry.severity}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(entry.timestamp, 'h:mm a')}
                </span>
                {city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {city}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onEdit?.(entry)} className="text-xs gap-2">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onFollowUp?.(entry)} className="text-xs gap-2">
                    <MessageSquare className="w-3.5 h-3.5" /> Follow-up
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(entry.id)} 
                    className="text-xs gap-2 text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {hasData && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>

          {/* Symptoms Preview */}
          {entry.symptoms && entry.symptoms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 ml-12">
              {entry.symptoms.slice(0, 3).map((s, i) => (
                <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 bg-muted/60">
                  {s}
                </Badge>
              ))}
              {entry.symptoms.length > 3 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  +{entry.symptoms.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Note Preview */}
          {entry.note && !isExpanded && (
            <p className="text-[10px] text-muted-foreground mt-2 ml-12 line-clamp-1 italic">
              "{entry.note}"
            </p>
          )}
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3 bg-muted/5">
            {/* Quick Metrics Row */}
            {(temp || heartRate || sleepHours || steps) && (
              <div className="grid grid-cols-4 gap-2">
                {temp && (
                  <div className="text-center p-2 rounded-lg bg-orange-500/10">
                    <Thermometer className="w-3.5 h-3.5 mx-auto mb-1 text-orange-500" />
                    <p className="text-sm font-semibold">{temp}°</p>
                  </div>
                )}
                {humidity && (
                  <div className="text-center p-2 rounded-lg bg-blue-500/10">
                    <Droplets className="w-3.5 h-3.5 mx-auto mb-1 text-blue-500" />
                    <p className="text-sm font-semibold">{humidity}%</p>
                  </div>
                )}
                {heartRate && (
                  <div className="text-center p-2 rounded-lg bg-red-500/10">
                    <Heart className="w-3.5 h-3.5 mx-auto mb-1 text-red-500" />
                    <p className="text-sm font-semibold">{heartRate}</p>
                  </div>
                )}
                {sleepHours && (
                  <div className="text-center p-2 rounded-lg bg-indigo-500/10">
                    <Moon className="w-3.5 h-3.5 mx-auto mb-1 text-indigo-500" />
                    <p className="text-sm font-semibold">{sleepHours}h</p>
                  </div>
                )}
                {steps && (
                  <div className="text-center p-2 rounded-lg bg-emerald-500/10">
                    <Footprints className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-500" />
                    <p className="text-sm font-semibold">{steps >= 1000 ? `${(steps/1000).toFixed(1)}k` : steps}</p>
                  </div>
                )}
              </div>
            )}

            {/* Triggers */}
            {entry.triggers && entry.triggers.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Triggers</p>
                <div className="flex flex-wrap gap-1">
                  {entry.triggers.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0 bg-red-500/5 border-red-500/20 text-red-600">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Medications */}
            {entry.medications && entry.medications.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Medications</p>
                <div className="flex flex-wrap gap-1">
                  {entry.medications.map((m, i) => (
                    <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            {entry.note && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Note</p>
                <p className="text-xs text-foreground/80 italic">"{entry.note}"</p>
              </div>
            )}

            {/* Follow-ups */}
            {entry.followUps && entry.followUps.length > 0 && (
              <div className="border-t border-border/50 pt-2">
                <p className="text-[10px] font-medium text-primary mb-1.5 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  Follow-ups ({entry.followUps.length})
                </p>
                <div className="space-y-1.5">
                  {entry.followUps.map((fu, i) => (
                    <div key={i} className="text-[10px] pl-3 border-l-2 border-primary/30">
                      <p>{fu.note}</p>
                      <p className="text-muted-foreground text-[9px]">
                        {format(new Date(fu.timestamp), "MMM d 'at' h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weather Details */}
            {condition && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Weather: {condition}</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
