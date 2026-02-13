import { useState } from 'react';
import { FlareEntry } from '@/types/flare';
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
  Zap,
  Pill,
  Wind,
  Sun,
  Cloud,
  CloudRain,
  Gauge,
  Leaf,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface CompactFlareCardProps {
  entry: FlareEntry;
  onEdit?: (entry: FlareEntry) => void;
  onDelete?: (entryId: string) => void;
  onFollowUp?: (entry: FlareEntry) => void;
}

// 3D orb face component - matches SeverityWheel style
const SeverityOrb = ({ severity, type }: { severity?: string; type?: string }) => {
  const getConfig = () => {
    // Special entry types
    if (type === 'wellness' || type === 'recovery') {
      return { 
        gradient: 'from-emerald-200 via-emerald-100 to-teal-50',
        glow: 'rgba(52, 211, 153, 0.35)',
        face: '#059669',
        faceType: 'happy' as const
      };
    }
    if (type === 'energy') {
      return { 
        gradient: 'from-amber-200 via-yellow-100 to-orange-50',
        glow: 'rgba(251, 191, 36, 0.35)',
        face: '#d97706',
        faceType: 'icon' as const,
        icon: <Zap className="w-5 h-5 text-amber-600" />
      };
    }
    if (type === 'medication') {
      return { 
        gradient: 'from-blue-200 via-indigo-100 to-violet-50',
        glow: 'rgba(99, 102, 241, 0.35)',
        face: '#6366f1',
        faceType: 'icon' as const,
        icon: <Pill className="w-5 h-5 text-indigo-600" />
      };
    }

    // Severity-based
    switch (severity) {
      case 'none':
        return { 
          gradient: 'from-emerald-200 via-emerald-100 to-teal-50',
          glow: 'rgba(52, 211, 153, 0.35)',
          face: '#059669',
          faceType: 'happy' as const
        };
      case 'mild':
        return { 
          gradient: 'from-amber-200 via-yellow-100 to-orange-50',
          glow: 'rgba(251, 191, 36, 0.35)',
          face: '#d97706',
          faceType: 'neutral' as const
        };
      case 'moderate':
        return { 
          gradient: 'from-orange-300 via-orange-200 to-amber-100',
          glow: 'rgba(251, 146, 60, 0.35)',
          face: '#ea580c',
          faceType: 'worried' as const
        };
      case 'severe':
        return { 
          gradient: 'from-rose-300 via-pink-200 to-red-100',
          glow: 'rgba(244, 63, 94, 0.35)',
          face: '#dc2626',
          faceType: 'distressed' as const
        };
      default:
        return { 
          gradient: 'from-slate-200 via-gray-100 to-slate-50',
          glow: 'rgba(148, 163, 184, 0.35)',
          face: '#64748b',
          faceType: 'neutral' as const
        };
    }
  };

  const config = getConfig();

  const renderFace = () => {
    if (config.icon) {
      return <div className="absolute inset-0 flex items-center justify-center">{config.icon}</div>;
    }

    switch (config.faceType) {
      case 'happy':
        return (
          <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
            <path d="M9 11 Q11 9 13 11" stroke={config.face} strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M19 11 Q21 9 23 11" stroke={config.face} strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M10 19 Q16 25 22 19" stroke={config.face} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'neutral':
        return (
          <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
            <circle cx="11" cy="12" r="2" fill={config.face} />
            <circle cx="21" cy="12" r="2" fill={config.face} />
            <path d="M11 20 L21 20" stroke={config.face} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        );
      case 'worried':
        return (
          <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
            <circle cx="11" cy="12" r="2" fill={config.face} />
            <circle cx="21" cy="12" r="2" fill={config.face} />
            <path d="M8 9 Q11 7 14 9" stroke={config.face} strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M18 9 Q21 7 24 9" stroke={config.face} strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M11 21 Q16 17 21 21" stroke={config.face} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'distressed':
        return (
          <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
            {/* Sad droopy eyes */}
            <ellipse cx="11" cy="12" rx="2" ry="2.5" fill={config.face} />
            <ellipse cx="21" cy="12" rx="2" ry="2.5" fill={config.face} />
            {/* Sad eyebrows */}
            <path d="M7 8 Q11 10 15 8" stroke={config.face} strokeWidth="1.5" strokeLinecap="round" fill="none" />
            <path d="M17 8 Q21 10 25 8" stroke={config.face} strokeWidth="1.5" strokeLinecap="round" fill="none" />
            {/* Deep frown */}
            <path d="M10 22 Q16 17 22 22" stroke={config.face} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
            <circle cx="11" cy="12" r="2" fill={config.face} />
            <circle cx="21" cy="12" r="2" fill={config.face} />
            <path d="M11 20 L21 20" stroke={config.face} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        );
    }
  };

  return (
    <div 
      className="w-12 h-12 rounded-full overflow-hidden relative flex-shrink-0"
      style={{
        boxShadow: `0 4px 16px ${config.glow}, inset 0 -6px 16px rgba(0,0,0,0.08)`,
      }}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br", config.gradient)} />
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.2) 30%, transparent 60%)',
        }}
      />
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.4)',
        }}
      />
      {renderFace()}
    </div>
  );
};

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

  const getLabel = () => {
    if (entry.type === 'wellness' || entry.type === 'recovery') {
      return entry.type === 'recovery' ? 'Recovery' : 'Feeling Good';
    }
    if (entry.type === 'energy') return 'Energy';
    if (entry.type === 'medication') return 'Medication';
    switch (entry.severity) {
      case 'none': return 'Great';
      case 'mild': return 'Mild';
      case 'moderate': return 'Moderate';
      case 'severe': return 'Severe';
      default: return 'Note';
    }
  };

  // Extract data safely
  const env = entry.environmentalData as any;
  const phys = entry.physiologicalData as any;
  
  const city = env?.location?.city || env?.city;
  const temp = env?.weather?.temperature;
  const humidity = env?.weather?.humidity;
  const pressure = env?.weather?.pressure || env?.weather?.pressureMb;
  const condition = env?.weather?.condition;
  const conditionIcon = env?.weather?.conditionIcon;
  const windSpeed = env?.weather?.windSpeed;
  const windDirection = env?.weather?.windDirection;
  const uvIndex = env?.weather?.uvIndex;
  const cloudCover = env?.weather?.cloudCover;
  const precipitation = env?.weather?.precipitation;
  const feelsLike = env?.weather?.feelsLike;
  const aqi = env?.airQuality?.aqi;
  const aqiCategory = env?.airQuality?.aqiCategory;
  const pollenTree = env?.airQuality?.pollenTree;
  const pollenGrass = env?.airQuality?.pollenGrass;
  
  const heartRate = phys?.heartRate || phys?.heart_rate;
  const sleepHours = phys?.sleepHours || phys?.sleep_hours;
  const steps = phys?.steps;

  const hasWeatherData = temp || humidity || pressure || windSpeed || uvIndex || aqi || condition;
  const hasData = city || hasWeatherData || heartRate || sleepHours || entry.symptoms?.length || entry.triggers?.length || entry.note;

  return (
    <Collapsible open={isExpanded} onOpenChange={handleToggle}>
      <div 
        className="relative rounded-3xl transition-all duration-300 overflow-hidden backdrop-blur-xl"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.75) 100%)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: isExpanded 
            ? 'inset 0 1px 3px rgba(255,255,255,0.4), 0 8px 24px rgba(0,0,0,0.08)' 
            : 'inset 0 1px 2px rgba(255,255,255,0.3), 0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        {/* Glass highlight overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 40%)',
            borderRadius: 'inherit',
          }}
        />

        {/* Compact Header - Tappable */}
        <CollapsibleTrigger className="w-full text-left relative z-10">
          <div className="p-4 active:bg-muted/10 transition-colors">
            <div className="flex items-center gap-3">
              {/* 3D Orb */}
              <SeverityOrb severity={entry.severity} type={entry.type} />

              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold text-foreground">
                    {getLabel()}
                  </span>
                  {entry.type && entry.type !== 'flare' && !['wellness', 'recovery', 'energy', 'medication'].includes(entry.type) && (
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
                      <Badge 
                        key={i} 
                        variant="outline" 
                        className="text-[10px] px-2 py-0.5 font-medium"
                        style={{
                          background: 'rgba(255,255,255,0.6)',
                          borderColor: 'rgba(255,255,255,0.8)',
                        }}
                      >
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
          <div className="px-4 pb-4 space-y-4 border-t border-white/30 pt-4 relative z-10">
            {/* Weather Condition Banner */}
            {condition && (
              <div 
                className="flex items-center gap-2 p-2.5 rounded-2xl backdrop-blur-sm"
                style={{
                  background: 'linear-gradient(145deg, rgba(241,245,249,0.9) 0%, rgba(226,232,240,0.85) 100%)',
                  border: '1px solid rgba(148,163,184,0.3)',
                }}
              >
                {conditionIcon && <span className="text-lg">{conditionIcon}</span>}
                <span className="text-sm font-semibold text-foreground">{condition}</span>
                {feelsLike && <span className="text-xs text-muted-foreground ml-auto">Feels like {feelsLike}°F</span>}
              </div>
            )}

            {/* Weather Metrics Grid */}
            {hasWeatherData && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Weather & Environment</p>
                <div className="grid grid-cols-4 gap-2">
                  {temp != null && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(255,237,213,0.9) 0%, rgba(254,215,170,0.85) 100%)', border: '1px solid rgba(251,191,36,0.3)' }}>
                      <Thermometer className="w-3.5 h-3.5 mx-auto mb-1 text-orange-500" />
                      <p className="text-sm font-bold">{temp}°F</p>
                      <p className="text-[8px] text-muted-foreground">temp</p>
                    </div>
                  )}
                  {humidity != null && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(219,234,254,0.9) 0%, rgba(191,219,254,0.85) 100%)', border: '1px solid rgba(59,130,246,0.3)' }}>
                      <Droplets className="w-3.5 h-3.5 mx-auto mb-1 text-blue-500" />
                      <p className="text-sm font-bold">{humidity}%</p>
                      <p className="text-[8px] text-muted-foreground">humidity</p>
                    </div>
                  )}
                  {pressure != null && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(237,233,254,0.9) 0%, rgba(221,214,254,0.85) 100%)', border: '1px solid rgba(139,92,246,0.3)' }}>
                      <Gauge className="w-3.5 h-3.5 mx-auto mb-1 text-violet-500" />
                      <p className="text-sm font-bold">{pressure}</p>
                      <p className="text-[8px] text-muted-foreground">mb</p>
                    </div>
                  )}
                  {windSpeed != null && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(241,245,249,0.9) 0%, rgba(226,232,240,0.85) 100%)', border: '1px solid rgba(100,116,139,0.3)' }}>
                      <Wind className="w-3.5 h-3.5 mx-auto mb-1 text-slate-500" />
                      <p className="text-sm font-bold">{windSpeed}</p>
                      <p className="text-[8px] text-muted-foreground">{windDirection || 'mph'}</p>
                    </div>
                  )}
                  {uvIndex != null && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(254,249,195,0.9) 0%, rgba(253,224,71,0.85) 100%)', border: '1px solid rgba(234,179,8,0.3)' }}>
                      <Sun className="w-3.5 h-3.5 mx-auto mb-1 text-yellow-500" />
                      <p className="text-sm font-bold">{uvIndex}</p>
                      <p className="text-[8px] text-muted-foreground">UV</p>
                    </div>
                  )}
                  {cloudCover != null && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(241,245,249,0.9) 0%, rgba(226,232,240,0.85) 100%)', border: '1px solid rgba(148,163,184,0.3)' }}>
                      <Cloud className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" />
                      <p className="text-sm font-bold">{cloudCover}%</p>
                      <p className="text-[8px] text-muted-foreground">clouds</p>
                    </div>
                  )}
                  {aqi != null && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(220,252,231,0.9) 0%, rgba(187,247,208,0.85) 100%)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <Eye className="w-3.5 h-3.5 mx-auto mb-1 text-green-500" />
                      <p className="text-sm font-bold">{aqi}</p>
                      <p className="text-[8px] text-muted-foreground">AQI</p>
                    </div>
                  )}
                  {(pollenTree != null || pollenGrass != null) && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(236,252,203,0.9) 0%, rgba(217,249,157,0.85) 100%)', border: '1px solid rgba(132,204,22,0.3)' }}>
                      <Leaf className="w-3.5 h-3.5 mx-auto mb-1 text-lime-500" />
                      <p className="text-sm font-bold">{pollenTree ?? pollenGrass}</p>
                      <p className="text-[8px] text-muted-foreground">pollen</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Biometric Metrics Row */}
            {(heartRate || sleepHours || steps) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Biometrics</p>
                <div className="grid grid-cols-4 gap-2">
                  {heartRate && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(254,226,226,0.9) 0%, rgba(254,202,202,0.85) 100%)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <Heart className="w-3.5 h-3.5 mx-auto mb-1 text-red-500" />
                      <p className="text-sm font-bold">{heartRate}</p>
                      <p className="text-[8px] text-muted-foreground">bpm</p>
                    </div>
                  )}
                  {sleepHours && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(224,231,255,0.9) 0%, rgba(199,210,254,0.85) 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
                      <Moon className="w-3.5 h-3.5 mx-auto mb-1 text-indigo-500" />
                      <p className="text-sm font-bold">{sleepHours}h</p>
                      <p className="text-[8px] text-muted-foreground">sleep</p>
                    </div>
                  )}
                  {steps && (
                    <div className="text-center p-2.5 rounded-2xl backdrop-blur-sm"
                      style={{ background: 'linear-gradient(145deg, rgba(209,250,229,0.9) 0%, rgba(167,243,208,0.85) 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <Footprints className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-500" />
                      <p className="text-sm font-bold">{steps >= 1000 ? `${(steps/1000).toFixed(1)}k` : steps}</p>
                      <p className="text-[8px] text-muted-foreground">steps</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Triggers */}
            {entry.triggers && entry.triggers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Triggers</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.triggers.map((t, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="text-xs px-2.5 py-0.5"
                      style={{
                        background: 'rgba(254,226,226,0.9)',
                        borderColor: 'rgba(239,68,68,0.3)',
                        color: '#b91c1c',
                      }}
                    >
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
              <div 
                className="p-3 rounded-2xl backdrop-blur-sm"
                style={{
                  background: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.6)',
                }}
              >
                <p className="text-sm text-foreground/80 italic leading-relaxed">"{entry.note}"</p>
              </div>
            )}

            {/* Follow-ups */}
            {entry.followUps && entry.followUps.length > 0 && (
              <div className="border-t border-white/30 pt-3">
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
                className="flex-1 h-10 backdrop-blur-sm"
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  borderColor: 'rgba(255,255,255,0.8)',
                }}
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
                className="flex-1 h-10 backdrop-blur-sm"
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  borderColor: 'rgba(255,255,255,0.8)',
                }}
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
      </div>
    </Collapsible>
  );
};
