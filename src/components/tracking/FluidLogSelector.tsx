import { useState } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Smile, Pill, X, Zap, Plus, Activity, Flame, Sun, Moon, Droplets, Thermometer, Eye, Brain, Shield, AlertTriangle, Heart, Search, Dumbbell, GlassWater, Apple, Loader2, Sparkles } from "lucide-react";
import { SeverityWheel } from "@/components/flare/SeverityWheel";
import { EnergyOrbs } from "@/components/flare/EnergyOrbs";
import { FlareSeverity } from "@/types/flare";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";

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
  onLogEnergy?: (level: 'low' | 'moderate' | 'high') => void;
  onLogRecovery?: () => void;
  onLogCustom?: (trackableLabel: string, value?: string) => void;
  onAddTrackable?: (trackable: SmartTrackable) => void;
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
  onLogSymptom, onLogMedication, onLogWellness,
  onLogEnergy, onLogRecovery, onLogCustom, onAddTrackable, onOpenDetails, disabled
}: FluidLogSelectorProps) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [activeCondition, setActiveCondition] = useState<AILogCategory | null>(null);
  const [activeTrackable, setActiveTrackable] = useState<SmartTrackable | null>(null);
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [trackableSearch, setTrackableSearch] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [researchedTrackable, setResearchedTrackable] = useState<SmartTrackable | null>(null);

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

  const handleMoodSelect = (severity: FlareSeverity) => {
    haptics.success();
    if (severity === 'none' || severity === 'mild') {
      onLogWellness();
    } else if (onLogRecovery) {
      onLogRecovery();
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
    <div className="space-y-2">
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
                  ? `linear-gradient(145deg, ${cat.color || 'hsl(0 70% 95%)'}, ${cat.color ? cat.color.replace(/\d+%\)/, '90%)') : 'hsl(0 70% 90%)'})`
                  : 'linear-gradient(145deg, hsl(0 0% 100% / 0.85) 0%, hsl(0 0% 98% / 0.8) 100%)',
                backgroundClip: 'padding-box',
                border: isActive ? `2px solid ${cat.color || 'hsl(0 70% 50%)'}` : '1px solid hsl(0 0% 100% / 0.6)',
                boxShadow: isActive
                  ? `inset 0 1px 2px hsl(0 0% 100% / 0.5), 0 4px 12px ${cat.color || 'hsl(0 70% 50%)'}`
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

        {/* Custom trackables with their AI-generated colors */}
        {customTrackables.map((t) => {
          const TIcon = ICON_MAP[t.icon] || Activity;
          const isActive = activePanel === 'customTrackable' && activeTrackable?.id === t.id;
          return (
            <GlassButton key={t.id} onClick={() => handleCustomTrackableClick(t as SmartTrackable)} disabled={disabled} active={isActive} className="flex-shrink-0"
              style={{
                background: isActive
                  ? `linear-gradient(145deg, ${(t as SmartTrackable).color?.replace(/\d+%\)/, '95%)') || 'hsl(250 60% 95%)'}, ${(t as SmartTrackable).color?.replace(/\d+%\)/, '90%)') || 'hsl(250 60% 90%)'})`
                  : 'linear-gradient(145deg, hsl(0 0% 100% / 0.85) 0%, hsl(0 0% 98% / 0.8) 100%)',
                backgroundClip: 'padding-box',
                border: isActive ? `2px solid ${(t as SmartTrackable).color || 'hsl(250 60% 55%)'}` : '1px solid hsl(0 0% 100% / 0.6)',
                boxShadow: isActive
                  ? `inset 0 1px 2px hsl(0 0% 100% / 0.5), 0 4px 12px ${(t as SmartTrackable).color?.replace(/\d+%\)/, '30%)') || 'hsl(250 60% 30%)'}`
                  : 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 2px 8px hsl(0 0% 0% / 0.04)',
              }}
            >
              <TIcon className="w-4 h-4" style={{ color: (t as SmartTrackable).color || 'hsl(250 60% 55%)' }} />
              <span>{t.label}</span>
            </GlassButton>
          );
        })}

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
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-semibold">Which medication?</span>
                <button onClick={closeAll} className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              {userMedications && userMedications.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {userMedications.map((med, i) => (
                    <button key={i} onClick={() => handleMedicationClick(med.name)}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm hover:scale-[1.02] active:scale-95"
                      style={{
                        background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.8) 0%, hsl(0 0% 96% / 0.7) 100%)',
                        border: '1px solid hsl(0 0% 100% / 0.5)',
                      }}
                    >
                      💊 {med.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Add medications in Profile → Health</p>
              )}
            </>
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
              <SeverityWheel selectedSeverity={null} onSeveritySelect={handleMoodSelect} />
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
