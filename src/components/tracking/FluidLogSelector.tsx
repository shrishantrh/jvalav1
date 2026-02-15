import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Smile, Pill, X, Zap, Plus, Activity, Flame, Sun, Moon, Droplets, Thermometer, Eye, Brain, Shield, AlertTriangle, Heart, Search, Dumbbell, GlassWater, Apple, Loader2, Sparkles, Trash2 } from "lucide-react";
import { SeverityWheel } from "@/components/flare/SeverityWheel";
import { EnergyOrbs } from "@/components/flare/EnergyOrbs";
import { FlareSeverity } from "@/types/flare";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";
import { searchDrugs } from "@/data/whoDrugDictionary";

// ─── Types ───

interface MedicationDetails {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

interface AILogCategory {
  id: string;
  label: string;
  icon: string;
  severityLabels?: string[];
  color?: string;
  symptoms?: string[];
}

interface TrackableSubOption {
  id: string;
  label: string;
  value: string;
  emoji?: string;
}

export interface SmartTrackable {
  id: string;
  label: string;
  icon: string;
  type: 'custom';
  color?: string;
  interactionType?: 'levels' | 'options' | 'amount' | 'toggle' | 'slider';
  subOptions?: TrackableSubOption[];
  unit?: string | null;
  logMessage?: string;
}

interface FluidLogSelectorProps {
  userSymptoms: string[];
  userMedications: MedicationDetails[];
  aiLogCategories?: AILogCategory[];
  customTrackables?: SmartTrackable[];
  onLogSymptom: (symptom: string, severity: string) => void;
  onLogMedication: (medicationName: string) => void;
  onLogWellness: () => void;
  onLogMood?: (mood: string) => void;
  onLogEnergy?: (level: 'low' | 'moderate' | 'high') => void;
  onLogRecovery?: () => void;
  onLogCustom?: (trackableLabel: string, value?: string) => void;
  onAddTrackable?: (trackable: SmartTrackable) => void;
  onRemoveTrackable?: (trackableId: string) => void;
  onReorderTrackables?: (trackables: SmartTrackable[]) => void;
  onAddMedication?: (med: MedicationDetails) => void;
  onRemoveMedication?: (medName: string) => void;
  onOpenDetails?: () => void;
  disabled?: boolean;
}

type ActivePanel = null | 'condition' | 'medication' | 'energy' | 'mood' | 'addTrackable' | 'customTrackable';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  flame: Flame, zap: Zap, heart: Heart, activity: Activity,
  alert: AlertTriangle, sun: Sun, moon: Moon, droplets: Droplets,
  thermometer: Thermometer, eye: Eye, brain: Brain, shield: Shield,
  dumbbell: Dumbbell, glass_water: GlassWater, apple: Apple,
};

// ─── Glass Button ───

const GlassButton = ({ children, onClick, active, disabled, className = "", style }: { 
  children: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; className?: string; style?: React.CSSProperties;
}) => (
  <button onClick={onClick} disabled={disabled}
    className={cn(
      "relative flex items-center justify-center gap-1.5 h-11 px-3 rounded-2xl text-sm font-medium",
      "transition-all duration-300 touch-manipulation overflow-hidden backdrop-blur-xl",
      "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-b before:from-white/50 before:to-transparent before:pointer-events-none",
      "active:scale-95",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}
    style={style || {
      background: active 
        ? 'linear-gradient(145deg, hsl(25 75% 95% / 0.95) 0%, hsl(25 70% 92% / 0.9) 100%)'
        : 'linear-gradient(145deg, hsl(0 0% 100% / 0.85) 0%, hsl(0 0% 98% / 0.8) 100%)',
      backgroundClip: 'padding-box',
      border: active ? '2px solid hsl(25 75% 50% / 0.4)' : '1px solid hsl(0 0% 100% / 0.6)',
      boxShadow: active
        ? 'inset 0 1px 2px hsl(0 0% 100% / 0.5), 0 4px 12px hsl(25 75% 50% / 0.15)'
        : 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 2px 8px hsl(0 0% 0% / 0.04)',
    }}
  >
    <span className="relative z-10 flex items-center gap-1.5">{children}</span>
  </button>
);

// ─── Mood Face SVG ───

const MoodFaceSVG = ({ mood, faceColor }: { mood: string; faceColor: string }) => {
  switch (mood) {
    case 'happy':
      return (
        <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
          <path d="M8 12 Q11 9 14 12" stroke={faceColor} strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M18 12 Q21 9 24 12" stroke={faceColor} strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M9 19 Q16 26 23 19" stroke={faceColor} strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'calm':
      return (
        <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
          <path d="M8 13 L14 13" stroke={faceColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M18 13 L24 13" stroke={faceColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M11 20 Q16 23 21 20" stroke={faceColor} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'anxious':
      return (
        <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
          <circle cx="11" cy="12" r="2.5" fill={faceColor} />
          <circle cx="21" cy="12" r="2.5" fill={faceColor} />
          <path d="M8 7 Q11 9 14 8" stroke={faceColor} strokeWidth="1.3" strokeLinecap="round" fill="none" />
          <path d="M18 8 Q21 9 24 7" stroke={faceColor} strokeWidth="1.3" strokeLinecap="round" fill="none" />
          <ellipse cx="16" cy="21" rx="3" ry="2" stroke={faceColor} strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'sad':
      return (
        <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
          <ellipse cx="11" cy="13" rx="2" ry="1.8" fill={faceColor} />
          <ellipse cx="21" cy="13" rx="2" ry="1.8" fill={faceColor} />
          <path d="M10 22 Q16 17 22 22" stroke={faceColor} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'irritable':
      return (
        <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
          <circle cx="11" cy="13" r="1.8" fill={faceColor} />
          <circle cx="21" cy="13" r="1.8" fill={faceColor} />
          <path d="M7 8 L14 11" stroke={faceColor} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M25 8 L18 11" stroke={faceColor} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 21 L13 19 L16 21 L19 19 L22 21" stroke={faceColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'tired':
      return (
        <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
          <path d="M8 13 Q11 11 14 13" stroke={faceColor} strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M18 13 Q21 11 24 13" stroke={faceColor} strokeWidth="2" strokeLinecap="round" fill="none" />
          <text x="25" y="9" fontSize="5" fontWeight="bold" fill={faceColor} opacity="0.6">z</text>
          <ellipse cx="16" cy="21" rx="2.5" ry="1.5" stroke={faceColor} strokeWidth="1.5" fill="none" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
          <circle cx="11" cy="12" r="2" fill={faceColor} />
          <circle cx="21" cy="12" r="2" fill={faceColor} />
          <path d="M11 20 L21 20" stroke={faceColor} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
};

// ─── Medication Panel ───

const MedicationPanel = ({ userMedications, onLogMedication, onAddMedication, onRemoveMedication, onClose }: {
  userMedications: MedicationDetails[];
  onLogMedication: (name: string) => void;
  onAddMedication?: (med: MedicationDetails) => void;
  onRemoveMedication?: (name: string) => void;
  onClose: () => void;
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const results = searchQuery.length >= 2 ? searchDrugs(searchQuery) : [];

  const handleAddDrug = (drugName: string, drugClass?: string) => {
    if (onAddMedication) {
      onAddMedication({
        name: drugName,
        dosage: drugClass || undefined,
        frequency: scheduleTime || 'as-needed',
      });
    }
    setSearchQuery("");
    setScheduleTime("");
    setShowAdd(false);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-semibold">Medications</span>
        <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {userMedications && userMedications.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-xs text-muted-foreground mb-1">Tap to log dose:</p>
          <div className="flex flex-wrap gap-2">
            {userMedications.map((med, i) => (
              <div key={i} className="flex items-center gap-1">
                <button onClick={() => onLogMedication(med.name)}
                  className="px-3 py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm hover:scale-[1.02] active:scale-95"
                  style={{
                    background: 'linear-gradient(145deg, hsl(230 60% 95% / 0.9), hsl(230 50% 90% / 0.85))',
                    border: '1px solid hsl(230 50% 80% / 0.5)',
                  }}
                >
                  <Pill className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" />
                  {med.name}
                  {med.frequency && med.frequency !== 'as-needed' && (
                    <span className="text-[10px] text-muted-foreground ml-1">({med.frequency})</span>
                  )}
                </button>
                {onRemoveMedication && (
                  <button onClick={() => onRemoveMedication(med.name)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center bg-destructive/10 hover:bg-destructive/20 active:scale-90 transition-all"
                  >
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.8), hsl(0 0% 96% / 0.7))',
            border: '1px dashed hsl(0 0% 80%)',
          }}
        >
          <Plus className="w-4 h-4 text-muted-foreground" />
          Add Medication
        </button>
      ) : (
        <div className="space-y-2 mt-2 p-3 rounded-xl" style={{
          background: 'linear-gradient(145deg, hsl(230 40% 97%), hsl(230 30% 95%))',
          border: '1px solid hsl(230 40% 88%)',
        }}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search WHO Drug Dictionary..."
            className="h-9 text-sm"
            autoFocus
          />

          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {results.slice(0, 8).map((drug) => (
                <button key={drug.id} onClick={() => handleAddDrug(drug.drugName, drug.drugClass)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary/10 transition-all flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium">{drug.drugName}</span>
                    <span className="text-muted-foreground ml-2">{drug.drugClass}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{drug.atcCode}</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && results.length === 0 && (
            <button onClick={() => handleAddDrug(searchQuery.trim())}
              className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary/10 transition-all"
            >
              <Plus className="w-3 h-3 inline mr-1" />
              Add "{searchQuery}" as custom medication
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Schedule:</span>
            <select value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
              className="flex-1 h-8 rounded-lg text-xs bg-background border border-border px-2"
            >
              <option value="">As needed</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="bedtime">Bedtime</option>
              <option value="twice-daily">Twice daily</option>
              <option value="three-times-daily">Three times daily</option>
              <option value="with-meals">With meals</option>
            </select>
          </div>

          <button onClick={() => { setShowAdd(false); setSearchQuery(""); setScheduleTime(""); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
};

// ─── Custom Trackable Panel ───

const TrackableInteractionPanel = ({ trackable, onLog, onClose }: {
  trackable: SmartTrackable;
  onLog: (label: string, value?: string) => void;
  onClose: () => void;
}) => {
  const [sliderValue, setSliderValue] = useState([5]);
  const TIcon = ICON_MAP[trackable.icon] || Activity;

  const handleOptionClick = (option: TrackableSubOption) => {
    haptics.success();
    const msg = trackable.logMessage 
      ? trackable.logMessage.replace('{value}', option.label)
      : `${trackable.label}: ${option.label}`;
    onLog(trackable.label, msg);
  };

  const handleSliderSubmit = () => {
    haptics.success();
    const msg = trackable.logMessage 
      ? trackable.logMessage.replace('{value}', `${sliderValue[0]}/10`)
      : `${trackable.label}: ${sliderValue[0]}/10`;
    onLog(trackable.label, msg);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" 
            style={{ background: trackable.color ? `${trackable.color.replace(')', ' / 0.15)')}` : 'hsl(250 60% 55% / 0.15)' }}>
            <TIcon className="w-4 h-4" style={{ color: trackable.color || 'hsl(250 60% 55%)' }} />
          </div>
          <span className="text-base font-semibold">{trackable.label}</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Slider interaction */}
      {trackable.interactionType === 'slider' && (
        <div className="space-y-4 py-2">
          <div className="text-center">
            <span className="text-3xl font-bold" style={{ color: trackable.color || 'hsl(250 60% 55%)' }}>
              {sliderValue[0]}
            </span>
            <span className="text-sm text-muted-foreground">/10</span>
          </div>
          <Slider
            value={sliderValue}
            onValueChange={setSliderValue}
            min={1}
            max={10}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground px-1">
            {trackable.subOptions?.length === 2 ? (
              <>
                <span>{trackable.subOptions[0]?.emoji} {trackable.subOptions[0]?.label}</span>
                <span>{trackable.subOptions[1]?.emoji} {trackable.subOptions[1]?.label}</span>
              </>
            ) : (
              <>
                <span>Low</span>
                <span>High</span>
              </>
            )}
          </div>
          <button onClick={handleSliderSubmit}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
            style={{
              background: `linear-gradient(145deg, ${trackable.color || 'hsl(250 60% 55%)'}, ${trackable.color?.replace(/\d+%\)/, '45%)') || 'hsl(250 60% 45%)'})`,
              color: 'white',
            }}
          >
            Log {trackable.label}
          </button>
        </div>
      )}

      {/* Options / Levels / Toggle interaction */}
      {(trackable.interactionType === 'options' || trackable.interactionType === 'levels' || trackable.interactionType === 'toggle' || !trackable.interactionType) && (
        <div className="grid gap-2" style={{ gridTemplateColumns: (trackable.subOptions?.length || 0) <= 3 ? `repeat(${trackable.subOptions?.length || 1}, 1fr)` : 'repeat(2, 1fr)' }}>
          {(trackable.subOptions || [{ id: 'done', label: 'Done', value: 'done', emoji: '✅' }]).map((option) => (
            <button key={option.id} onClick={() => handleOptionClick(option)}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-center transition-all active:scale-95 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(145deg, ${trackable.color ? trackable.color.replace(/\d+%\)/, '95%)') : 'hsl(250 60% 95%)'}, ${trackable.color ? trackable.color.replace(/\d+%\)/, '90%)') : 'hsl(250 60% 90%)'})`,
                border: `1px solid ${trackable.color ? trackable.color.replace(/\d+%\)/, '80%)') : 'hsl(250 60% 80%)'}`,
              }}
            >
              {option.emoji && <span className="text-lg">{option.emoji}</span>}
              <span className="text-xs font-semibold leading-tight">{option.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Amount interaction */}
      {trackable.interactionType === 'amount' && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(trackable.subOptions?.length || 3, 3)}, 1fr)` }}>
          {(trackable.subOptions || []).map((option) => (
            <button key={option.id} onClick={() => handleOptionClick(option)}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-center transition-all active:scale-95 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(145deg, ${trackable.color ? trackable.color.replace(/\d+%\)/, '95%)') : 'hsl(250 60% 95%)'}, ${trackable.color ? trackable.color.replace(/\d+%\)/, '90%)') : 'hsl(250 60% 90%)'})`,
                border: `1px solid ${trackable.color ? trackable.color.replace(/\d+%\)/, '80%)') : 'hsl(250 60% 80%)'}`,
              }}
            >
              {option.emoji && <span className="text-lg">{option.emoji}</span>}
              <span className="text-xs font-semibold leading-tight">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───

export const FluidLogSelector = ({
  userSymptoms, userMedications, aiLogCategories = [], customTrackables = [],
  onLogSymptom, onLogMedication, onLogWellness, onLogMood,
  onLogEnergy, onLogRecovery, onLogCustom, onAddTrackable, onRemoveTrackable, onReorderTrackables,
  onAddMedication, onRemoveMedication, onOpenDetails, disabled
}: FluidLogSelectorProps) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [activeCondition, setActiveCondition] = useState<AILogCategory | null>(null);
  const [activeTrackable, setActiveTrackable] = useState<SmartTrackable | null>(null);
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [trackableSearch, setTrackableSearch] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [researchedTrackable, setResearchedTrackable] = useState<SmartTrackable | null>(null);
  
  // Drag-to-delete/reorder state
  const [dragMode, setDragMode] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const handleLongPressStart = (index: number) => {
    longPressTimer.current = setTimeout(() => {
      haptics.medium();
      setDragMode(true);
      setDragIndex(index);
      setShowDeleteZone(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!dragMode) return;
    e.dataTransfer.effectAllowed = 'move';
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) return;
    
    const reordered = [...customTrackables];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onReorderTrackables?.(reordered);
    haptics.light();
    
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDeleteDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex !== null && customTrackables[dragIndex]) {
      haptics.warning();
      onRemoveTrackable?.(customTrackables[dragIndex].id);
    }
    exitDragMode();
  };

  const exitDragMode = () => {
    setDragMode(false);
    setDragIndex(null);
    setDragOverIndex(null);
    setShowDeleteZone(false);
  };

  const handleConditionClick = (cat: AILogCategory) => {
    haptics.selection();
    if (activePanel === 'condition' && activeCondition?.id === cat.id) {
      closeAll();
    } else {
      setActivePanel('condition');
      setActiveCondition(cat);
      setSelectedSymptom(null);
    }
  };

  const handleCustomTrackableClick = (t: SmartTrackable) => {
    haptics.selection();
    if (activePanel === 'customTrackable' && activeTrackable?.id === t.id) {
      closeAll();
    } else {
      setActivePanel('customTrackable');
      setActiveTrackable(t);
    }
  };

  const handleSymptomClick = (symptom: string) => {
    haptics.selection();
    setSelectedSymptom(symptom);
  };

  const handleSeveritySelect = (severity: FlareSeverity) => {
    if (activeCondition && !selectedSymptom) {
      haptics.success();
      onLogSymptom(activeCondition.label, severity);
      closeAll();
    } else if (selectedSymptom) {
      haptics.success();
      onLogSymptom(selectedSymptom, severity);
      closeAll();
    }
  };

  const handleMedicationClick = (medName: string) => {
    haptics.light();
    onLogMedication(medName);
    setActivePanel(null);
  };

  const handleEnergySelect = (level: 'low' | 'moderate' | 'high') => {
    haptics.success();
    if (onLogEnergy) onLogEnergy(level);
    setActivePanel(null);
  };

  const handleMoodSelect = (mood: string) => {
    haptics.success();
    if (onLogMood) {
      onLogMood(mood);
    }
    setActivePanel(null);
  };

  const handleTrackableLog = (label: string, value?: string) => {
    if (onLogCustom) onLogCustom(label, value);
    closeAll();
  };

  // AI-powered trackable research
  const handleResearchTrackable = async () => {
    if (!trackableSearch.trim()) return;
    setIsResearching(true);
    setResearchedTrackable(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-suggestions', {
        body: { trackableQuery: trackableSearch.trim() },
      });

      if (error) throw error;

      const t = data?.trackable;
      if (t) {
        setResearchedTrackable({
          id: `custom_${Date.now()}`,
          label: t.label || trackableSearch.trim(),
          icon: t.icon || 'activity',
          type: 'custom',
          color: t.color || 'hsl(250 60% 55%)',
          interactionType: t.interactionType || 'toggle',
          subOptions: t.subOptions || [{ id: 'done', label: 'Done', value: 'done', emoji: '✅' }],
          unit: t.unit,
          logMessage: t.logMessage,
        });
      }
    } catch (e) {
      console.error('Trackable research error:', e);
      // Fallback
      setResearchedTrackable({
        id: `custom_${Date.now()}`,
        label: trackableSearch.trim(),
        icon: 'activity',
        type: 'custom',
        interactionType: 'toggle',
        subOptions: [{ id: 'done', label: 'Done', value: 'done', emoji: '✅' }],
      });
    } finally {
      setIsResearching(false);
    }
  };

  const confirmAddTrackable = () => {
    if (!researchedTrackable || !onAddTrackable) return;
    onAddTrackable(researchedTrackable);
    setTrackableSearch("");
    setResearchedTrackable(null);
    setActivePanel(null);
    haptics.success();
  };

  const closeAll = () => {
    setActivePanel(null);
    setActiveCondition(null);
    setActiveTrackable(null);
    setSelectedSymptom(null);
    setTrackableSearch("");
    setResearchedTrackable(null);
  };

  const togglePanel = (panel: ActivePanel) => {
    haptics.selection();
    if (activePanel === panel) {
      closeAll();
    } else {
      setActivePanel(panel);
      setActiveCondition(null);
      setActiveTrackable(null);
      setSelectedSymptom(null);
    }
  };

  const conditionSymptoms = activeCondition?.symptoms || userSymptoms;

  return (
    <div className="space-y-2" data-tour="log-buttons">
      {/* Main action buttons row */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {/* Condition-specific buttons */}
        {aiLogCategories.map((cat) => {
          const CatIcon = ICON_MAP[cat.icon] || Flame;
          const isActive = activePanel === 'condition' && activeCondition?.id === cat.id;
          return (
            <GlassButton key={cat.id} onClick={() => handleConditionClick(cat)} disabled={disabled} active={isActive} className="flex-shrink-0"
              style={{
                background: isActive
                  ? `linear-gradient(145deg, ${cat.color ? cat.color.replace(/[\d.]+%\s*\)/, '92%)') : 'hsl(0 70% 92%)'}, ${cat.color ? cat.color.replace(/[\d.]+%\s*\)/, '86%)') : 'hsl(0 70% 86%)'})`
                  : 'linear-gradient(145deg, hsl(0 0% 100% / 0.85) 0%, hsl(0 0% 98% / 0.8) 100%)',
                backgroundClip: 'padding-box',
                border: isActive ? `2px solid ${cat.color ? cat.color.replace(/[\d.]+%\s*\)/, '60%)') : 'hsl(0 70% 60%)'}` : '1px solid hsl(0 0% 100% / 0.6)',
                boxShadow: isActive
                  ? `inset 0 1px 2px hsl(0 0% 100% / 0.5), 0 4px 12px ${cat.color ? cat.color.replace(/[\d.]+%\s*\)/, '50% / 0.2)') : 'hsl(0 70% 50% / 0.2)'}`
                  : 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 2px 8px hsl(0 0% 0% / 0.04)',
              }}
            >
              <CatIcon className="w-4 h-4" style={{ color: cat.color || 'hsl(0 70% 50%)' }} />
              <span>{cat.label}</span>
            </GlassButton>
          );
        })}

        {aiLogCategories.length === 0 && (
          <GlassButton onClick={() => togglePanel('condition')} disabled={disabled} active={activePanel === 'condition'} className="flex-shrink-0">
            <Flame className="w-4 h-4 text-red-500" />
            <span>Flare</span>
          </GlassButton>
        )}

        <GlassButton onClick={() => togglePanel('mood')} disabled={disabled} active={activePanel === 'mood'} className="flex-shrink-0">
          <Smile className="w-4 h-4 text-emerald-500" />
          <span>Mood</span>
        </GlassButton>

        <GlassButton onClick={() => togglePanel('medication')} disabled={disabled} active={activePanel === 'medication'} className="flex-shrink-0">
          <Pill className="w-4 h-4 text-blue-500" />
          <span>Meds</span>
        </GlassButton>

        <GlassButton onClick={() => togglePanel('energy')} disabled={disabled} active={activePanel === 'energy'} className="flex-shrink-0">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Energy</span>
        </GlassButton>

        {/* Custom trackables with drag-to-delete/reorder */}
        {customTrackables.map((t, idx) => {
          const TIcon = ICON_MAP[t.icon] || Activity;
          const isActive = activePanel === 'customTrackable' && activeTrackable?.id === t.id;
          const isDragging = dragMode && dragIndex === idx;
          const isDragOver = dragMode && dragOverIndex === idx;
          return (
            <div
              key={t.id}
              draggable={dragMode}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={exitDragMode}
              onTouchStart={() => handleLongPressStart(idx)}
              onTouchEnd={handleLongPressEnd}
              onMouseDown={() => handleLongPressStart(idx)}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              className={cn(
                "flex-shrink-0 transition-all duration-200",
                isDragging && "opacity-50 scale-95",
                isDragOver && "scale-110",
                dragMode && "animate-[wiggle_0.3s_ease-in-out_infinite]"
              )}
            >
              <GlassButton
                onClick={() => !dragMode && handleCustomTrackableClick(t as SmartTrackable)}
                disabled={disabled}
                active={isActive}
                className="flex-shrink-0"
                style={{
                  background: isActive
                    ? `linear-gradient(145deg, ${(t as SmartTrackable).color?.replace(/\d+%\)/, '95%)') || 'hsl(250 60% 95%)'}, ${(t as SmartTrackable).color?.replace(/\d+%\)/, '90%)') || 'hsl(250 60% 90%)'})`
                    : 'linear-gradient(145deg, hsl(0 0% 100% / 0.85) 0%, hsl(0 0% 98% / 0.8) 100%)',
                  WebkitBackgroundClip: 'padding-box',
                  backgroundClip: 'padding-box',
                  border: isActive ? `2px solid ${(t as SmartTrackable).color || 'hsl(250 60% 55%)'}` : '1px solid hsl(0 0% 100% / 0.6)',
                  boxShadow: isActive
                    ? `inset 0 1px 2px hsl(0 0% 100% / 0.5), 0 4px 12px ${(t as SmartTrackable).color?.replace(/\d+%\)/, '30%)') || 'hsl(250 60% 30%)'}`
                    : 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 2px 8px hsl(0 0% 0% / 0.04)',
                  overflow: 'hidden',
                }}
              >
                <TIcon className="w-4 h-4" style={{ color: (t as SmartTrackable).color || 'hsl(250 60% 55%)' }} />
                <span>{t.label}</span>
              </GlassButton>
              {/* Delete badge on drag mode */}
              {dragMode && (
                <button
                  onClick={(e) => { e.stopPropagation(); haptics.warning(); onRemoveTrackable?.(t.id); exitDragMode(); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] font-bold z-20 shadow-md"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {/* Delete zone - appears when dragging */}
        {showDeleteZone && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDeleteDrop}
            className="flex-shrink-0 h-11 px-3 rounded-2xl flex items-center justify-center border-2 border-dashed border-destructive/50 bg-destructive/10 text-destructive text-xs font-medium animate-in fade-in duration-200"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Drop to delete
          </div>
        )}

        {/* Add trackable button */}
        <button onClick={() => togglePanel('addTrackable')} disabled={disabled}
          className={cn(
            "relative h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0",
            "transition-all duration-300 touch-manipulation overflow-hidden backdrop-blur-xl",
            "active:scale-95",
            activePanel === 'addTrackable' && "ring-2 ring-primary/40"
          )}
          style={{
            background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.8) 0%, hsl(0 0% 96% / 0.75) 100%)',
            border: '1px solid hsl(0 0% 100% / 0.5)',
            boxShadow: 'inset 0 1px 2px hsl(0 0% 100% / 0.3), 0 2px 8px hsl(0 0% 0% / 0.04)',
          }}
        >
          <Plus className="w-5 h-5 text-muted-foreground relative z-10" />
        </button>
      </div>

      {/* Expandable panels */}
      {activePanel && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl p-4 overflow-hidden backdrop-blur-xl"
          style={{
            background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.9) 0%, hsl(0 0% 98% / 0.85) 100%)',
            border: '1px solid hsl(0 0% 100% / 0.6)',
            boxShadow: 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 8px 24px hsl(0 0% 0% / 0.06)',
          }}
        >
          {/* Custom trackable interaction panel */}
          {activePanel === 'customTrackable' && activeTrackable && (
            <TrackableInteractionPanel
              trackable={activeTrackable}
              onLog={handleTrackableLog}
              onClose={closeAll}
            />
          )}

          {/* Condition panels */}
          {activePanel === 'condition' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-semibold text-foreground">
                  {activeCondition && (
                    selectedSymptom ? `${selectedSymptom} — how severe?` : `Log ${activeCondition.label}`
                  )}
                  {!activeCondition && 'What are you experiencing?'}
                </span>
                <button onClick={closeAll} className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {activeCondition && !selectedSymptom && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Quick log severity:</p>
                    {activeCondition.severityLabels && activeCondition.severityLabels.length === 3 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {(['mild', 'moderate', 'severe'] as FlareSeverity[]).map((sev, i) => (
                          <button key={sev} onClick={() => handleSeveritySelect(sev)}
                            className="py-3 px-2 rounded-xl text-center transition-all active:scale-95 hover:scale-[1.02]"
                            style={{
                              background: sev === 'mild' ? 'linear-gradient(145deg, hsl(50 80% 92%), hsl(50 70% 85%))'
                                : sev === 'moderate' ? 'linear-gradient(145deg, hsl(30 80% 90%), hsl(30 70% 82%))'
                                : 'linear-gradient(145deg, hsl(0 70% 90%), hsl(0 60% 82%))',
                              border: `1px solid ${sev === 'mild' ? 'hsl(50 60% 70%)' : sev === 'moderate' ? 'hsl(30 60% 70%)' : 'hsl(0 50% 70%)'}`,
                            }}
                          >
                            <div className="text-xs font-semibold leading-tight">{activeCondition.severityLabels![i]}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <SeverityWheel selectedSeverity={null} onSeveritySelect={handleSeveritySelect} />
                    )}
                  </div>

                  {conditionSymptoms.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Or log a specific symptom:</p>
                      <div className="flex flex-wrap gap-2">
                        {conditionSymptoms.map((symptom) => (
                          <button key={symptom} onClick={() => handleSymptomClick(symptom)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all backdrop-blur-sm hover:scale-[1.02] active:scale-95"
                            style={{
                              background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.8) 0%, hsl(0 0% 96% / 0.7) 100%)',
                              border: '1px solid hsl(0 0% 100% / 0.5)',
                              boxShadow: 'inset 0 1px 2px hsl(0 0% 100% / 0.3), 0 2px 6px hsl(0 0% 0% / 0.03)',
                            }}
                          >
                            {symptom}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!activeCondition && (
                <div className="flex flex-wrap gap-2">
                  {userSymptoms.slice(0, 12).map((symptom) => (
                    <button key={symptom} onClick={() => { setSelectedSymptom(symptom); }}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95"
                      style={{
                        background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.8) 0%, hsl(0 0% 96% / 0.7) 100%)',
                        border: '1px solid hsl(0 0% 100% / 0.5)',
                      }}
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              )}

              {selectedSymptom && (
                <div>
                  <button onClick={() => setSelectedSymptom(null)} className="flex items-center gap-1.5 text-sm text-primary font-medium mb-3">
                    <Activity className="w-3.5 h-3.5" /> ← Back
                  </button>
                  <SeverityWheel selectedSeverity={null} onSeveritySelect={handleSeveritySelect} />
                </div>
              )}
            </>
          )}

          {/* Medication panel */}
          {activePanel === 'medication' && (
            <MedicationPanel
              userMedications={userMedications}
              onLogMedication={handleMedicationClick}
              onAddMedication={onAddMedication}
              onRemoveMedication={onRemoveMedication}
              onClose={closeAll}
            />
          )}

          {/* Energy panel */}
          {activePanel === 'energy' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-semibold">How's your energy?</span>
                <button onClick={closeAll} className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <EnergyOrbs onSelect={handleEnergySelect} />
            </>
          )}

          {/* Mood panel */}
          {activePanel === 'mood' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-semibold">How are you feeling?</span>
                <button onClick={closeAll} className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { mood: 'happy', label: 'Happy', hue: 45, sat: 80, light: 50, face: '#d97706' },
                  { mood: 'calm', label: 'Calm', hue: 200, sat: 55, light: 52, face: '#0284c7' },
                  { mood: 'anxious', label: 'Anxious', hue: 35, sat: 80, light: 50, face: '#c2410c' },
                  { mood: 'sad', label: 'Sad', hue: 230, sat: 60, light: 50, face: '#4338ca' },
                  { mood: 'irritable', label: 'Irritable', hue: 350, sat: 70, light: 52, face: '#be123c' },
                  { mood: 'tired', label: 'Tired', hue: 270, sat: 40, light: 55, face: '#6d28d9' },
                ].map((option) => (
                  <button
                    key={option.mood}
                    onClick={() => handleMoodSelect(option.mood)}
                    className="py-3 px-2 rounded-2xl text-center transition-all active:scale-95 hover:scale-[1.02] relative overflow-hidden"
                    style={{
                      background: `linear-gradient(145deg, hsl(${option.hue} ${option.sat}% ${option.light + 40}% / 0.9), hsl(${option.hue} ${option.sat - 10}% ${option.light + 35}% / 0.85))`,
                      border: `1px solid hsl(${option.hue} ${option.sat}% ${option.light + 20}% / 0.5)`,
                      boxShadow: `inset 0 1px 2px hsl(0 0% 100% / 0.3), 0 2px 8px hsl(${option.hue} ${option.sat}% ${option.light}% / 0.1)`,
                    }}
                  >
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, hsl(0 0% 100% / 0.25) 0%, transparent 50%)', borderRadius: 'inherit' }} />
                    {/* Custom SVG face */}
                    <div className="w-8 h-8 mx-auto rounded-full relative overflow-hidden" style={{
                      background: `linear-gradient(145deg, hsl(${option.hue} ${option.sat}% 88%), hsl(${option.hue} ${option.sat - 10}% 82%))`,
                      boxShadow: `0 2px 8px hsl(${option.hue} ${option.sat}% ${option.light}% / 0.25), inset 0 -3px 8px rgba(0,0,0,0.06)`,
                    }}>
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 30%, transparent 60%)' }} />
                      <MoodFaceSVG mood={option.mood} faceColor={option.face} />
                    </div>
                    <div className="text-xs font-bold mt-1.5 relative" style={{ color: `hsl(${option.hue} ${option.sat}% ${option.light}%)` }}>{option.label}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Add Trackable panel */}
          {activePanel === 'addTrackable' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-semibold">Track anything</span>
                <button onClick={closeAll} className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Add anything you want to track — water intake, supplements, exercise, sleep quality, stress levels, etc. Our AI will create smart logging options for it.
                </p>
                
                <div className="flex gap-2">
                  <Input
                    value={trackableSearch}
                    onChange={(e) => { setTrackableSearch(e.target.value); setResearchedTrackable(null); }}
                    placeholder="e.g. Water, Vitamins, Stress..."
                    className="flex-1 h-10 text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleResearchTrackable(); }}
                  />
                  <button 
                    onClick={handleResearchTrackable}
                    disabled={!trackableSearch.trim() || isResearching}
                    className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isResearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isResearching ? 'Researching...' : 'Create'}
                  </button>
                </div>

                {/* Quick suggestions when no research result */}
                {!researchedTrackable && !isResearching && (
                  <div className="flex flex-wrap gap-2">
                    {['Water', 'Exercise', 'Vitamins', 'Sleep Quality', 'Stress', 'Caffeine'].map((s) => (
                      <button key={s} onClick={() => { setTrackableSearch(s); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95"
                        style={{
                          background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.8) 0%, hsl(0 0% 96% / 0.7) 100%)',
                          border: '1px solid hsl(0 0% 100% / 0.5)',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* AI-researched trackable preview */}
                {researchedTrackable && (
                  <div className="rounded-xl p-3 space-y-3" style={{
                    background: `linear-gradient(145deg, ${researchedTrackable.color?.replace(/\d+%\)/, '97%)') || 'hsl(250 60% 97%)'}, ${researchedTrackable.color?.replace(/\d+%\)/, '94%)') || 'hsl(250 60% 94%)'})`,
                    border: `1px solid ${researchedTrackable.color?.replace(/\d+%\)/, '85%)') || 'hsl(250 60% 85%)'}`,
                  }}>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const TIcon = ICON_MAP[researchedTrackable.icon] || Activity;
                        return (
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                            background: researchedTrackable.color?.replace(/\d+%\)/, '88%)') || 'hsl(250 60% 88%)',
                          }}>
                            <TIcon className="w-5 h-5" style={{ color: researchedTrackable.color || 'hsl(250 60% 55%)' }} />
                          </div>
                        );
                      })()}
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{researchedTrackable.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {researchedTrackable.interactionType === 'slider' ? 'Scale 1-10' : 
                           `${researchedTrackable.subOptions?.length || 0} options`} • Tap to log
                        </p>
                      </div>
                    </div>

                    {/* Preview sub-options */}
                    <div className="flex flex-wrap gap-1.5">
                      {researchedTrackable.subOptions?.slice(0, 4).map((opt) => (
                        <span key={opt.id} className="text-[10px] px-2 py-1 rounded-lg font-medium" style={{
                          background: researchedTrackable.color?.replace(/\d+%\)/, '82%)') || 'hsl(250 60% 82%)',
                          color: researchedTrackable.color?.replace(/\d+%\)/, '30%)') || 'hsl(250 60% 30%)',
                        }}>
                          {opt.emoji} {opt.label}
                        </span>
                      ))}
                      {(researchedTrackable.subOptions?.length || 0) > 4 && (
                        <span className="text-[10px] px-2 py-1 text-muted-foreground">+{(researchedTrackable.subOptions?.length || 0) - 4} more</span>
                      )}
                    </div>

                    <button onClick={confirmAddTrackable}
                      className="w-full py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                      style={{
                        background: `linear-gradient(145deg, ${researchedTrackable.color || 'hsl(250 60% 55%)'}, ${researchedTrackable.color?.replace(/\d+%\)/, '45%)') || 'hsl(250 60% 45%)'})`,
                        color: 'white',
                      }}
                    >
                      Add to Quick Log
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
