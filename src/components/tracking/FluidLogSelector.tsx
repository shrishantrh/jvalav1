import { useState } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Smile, Pill, X, Zap, Plus, Activity, Flame, Sun, Moon, Droplets, Thermometer, Eye, Brain, Shield, AlertTriangle, Heart, Search, Dumbbell, GlassWater, Apple } from "lucide-react";
import { SeverityWheel } from "@/components/flare/SeverityWheel";
import { EnergyOrbs } from "@/components/flare/EnergyOrbs";
import { FlareSeverity } from "@/types/flare";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

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

interface CustomTrackable {
  id: string;
  label: string;
  icon: string;
  type: 'custom';
}

interface FluidLogSelectorProps {
  userSymptoms: string[];
  userMedications: MedicationDetails[];
  aiLogCategories?: AILogCategory[];
  customTrackables?: CustomTrackable[];
  onLogSymptom: (symptom: string, severity: string) => void;
  onLogMedication: (medicationName: string) => void;
  onLogWellness: () => void;
  onLogEnergy?: (level: 'low' | 'moderate' | 'high') => void;
  onLogRecovery?: () => void;
  onLogCustom?: (trackableLabel: string) => void;
  onAddTrackable?: (trackable: CustomTrackable) => void;
  onOpenDetails?: () => void;
  disabled?: boolean;
}

type ActivePanel = null | 'condition' | 'medication' | 'energy' | 'mood' | 'addTrackable';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  flame: Flame, zap: Zap, heart: Heart, activity: Activity,
  alert: AlertTriangle, sun: Sun, moon: Moon, droplets: Droplets,
  thermometer: Thermometer, eye: Eye, brain: Brain, shield: Shield,
  dumbbell: Dumbbell, glass_water: GlassWater, apple: Apple,
};

const TRACKABLE_SUGGESTIONS = [
  { query: 'water', label: 'Water', icon: 'droplets' },
  { query: 'exercise', label: 'Exercise', icon: 'dumbbell' },
  { query: 'vitamins', label: 'Vitamins', icon: 'shield' },
  { query: 'sleep', label: 'Sleep', icon: 'moon' },
  { query: 'food', label: 'Food', icon: 'apple' },
  { query: 'stress', label: 'Stress', icon: 'brain' },
];

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
      border: active ? '2px solid hsl(25 75% 50% / 0.4)' : '1px solid hsl(0 0% 100% / 0.6)',
      boxShadow: active
        ? 'inset 0 1px 2px hsl(0 0% 100% / 0.5), 0 4px 12px hsl(25 75% 50% / 0.15)'
        : 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 2px 8px hsl(0 0% 0% / 0.04)',
    }}
  >
    <span className="relative z-10 flex items-center gap-1.5">{children}</span>
  </button>
);

export const FluidLogSelector = ({
  userSymptoms, userMedications, aiLogCategories = [], customTrackables = [],
  onLogSymptom, onLogMedication, onLogWellness,
  onLogEnergy, onLogRecovery, onLogCustom, onAddTrackable, onOpenDetails, disabled
}: FluidLogSelectorProps) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [activeCondition, setActiveCondition] = useState<AILogCategory | null>(null);
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [trackableSearch, setTrackableSearch] = useState("");
  const [isSearchingTrackable, setIsSearchingTrackable] = useState(false);
  const [trackableSuggestion, setTrackableSuggestion] = useState<{ label: string; icon: string } | null>(null);

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

  const handleSymptomClick = (symptom: string) => {
    haptics.selection();
    setSelectedSymptom(symptom);
  };

  const handleSeveritySelect = (severity: FlareSeverity) => {
    if (activeCondition && !selectedSymptom) {
      // Logging the condition itself (e.g. "Breakout - moderate")
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

  const handleCustomTrackableLog = (trackable: CustomTrackable) => {
    haptics.light();
    if (onLogCustom) onLogCustom(trackable.label);
  };

  const handleAddTrackable = async () => {
    if (!trackableSearch.trim()) return;
    setIsSearchingTrackable(true);
    
    // Simple AI-like matching: find a matching icon for common trackables
    const query = trackableSearch.toLowerCase().trim();
    const match = TRACKABLE_SUGGESTIONS.find(s => query.includes(s.query));
    
    if (match) {
      setTrackableSuggestion({ label: trackableSearch.trim(), icon: match.icon });
    } else {
      // Default icon based on first letter grouping
      const iconOptions: Record<string, string> = {
        a: 'apple', b: 'brain', c: 'heart', d: 'droplets', e: 'zap',
        f: 'flame', g: 'shield', h: 'heart', i: 'eye', j: 'activity',
      };
      const firstChar = query[0] || 'a';
      setTrackableSuggestion({ label: trackableSearch.trim(), icon: iconOptions[firstChar] || 'activity' });
    }
    setIsSearchingTrackable(false);
  };

  const confirmAddTrackable = () => {
    if (!trackableSuggestion || !onAddTrackable) return;
    const newTrackable: CustomTrackable = {
      id: `custom_${Date.now()}`,
      label: trackableSuggestion.label,
      icon: trackableSuggestion.icon,
      type: 'custom',
    };
    onAddTrackable(newTrackable);
    setTrackableSearch("");
    setTrackableSuggestion(null);
    setActivePanel(null);
    haptics.success();
  };

  const closeAll = () => {
    setActivePanel(null);
    setActiveCondition(null);
    setSelectedSymptom(null);
    setTrackableSearch("");
    setTrackableSuggestion(null);
  };

  const togglePanel = (panel: ActivePanel) => {
    haptics.selection();
    if (activePanel === panel) {
      closeAll();
    } else {
      setActivePanel(panel);
      setActiveCondition(null);
      setSelectedSymptom(null);
    }
  };

  // Build the condition-specific symptom list
  const conditionSymptoms = activeCondition?.symptoms || 
    userSymptoms.filter(s => {
      // Basic heuristic: show symptoms relevant to this condition
      return true; // fallback: show all
    });

  return (
    <div className="space-y-2">
      {/* Main action buttons - one per condition + mood/meds/energy */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {/* Condition-specific buttons */}
        {aiLogCategories.map((cat) => {
          const CatIcon = ICON_MAP[cat.icon] || Flame;
          const isActive = activePanel === 'condition' && activeCondition?.id === cat.id;
          return (
            <GlassButton 
              key={cat.id} 
              onClick={() => handleConditionClick(cat)} 
              disabled={disabled} 
              active={isActive}
              className="flex-shrink-0"
              style={{
                background: isActive
                  ? `linear-gradient(145deg, ${cat.color || 'hsl(0 70% 95%)'}, ${cat.color ? cat.color.replace('50%', '90%') : 'hsl(0 70% 90%)'})`
                  : 'linear-gradient(145deg, hsl(0 0% 100% / 0.85) 0%, hsl(0 0% 98% / 0.8) 100%)',
                border: isActive 
                  ? `2px solid ${cat.color || 'hsl(0 70% 50%)'}` 
                  : '1px solid hsl(0 0% 100% / 0.6)',
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

        {/* If no AI categories, show a generic Flare button */}
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

        {/* Custom trackables */}
        {customTrackables.map((t) => {
          const TIcon = ICON_MAP[t.icon] || Activity;
          return (
            <GlassButton key={t.id} onClick={() => handleCustomTrackableLog(t)} disabled={disabled} className="flex-shrink-0">
              <TIcon className="w-4 h-4 text-primary" />
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
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-semibold text-foreground">
              {activePanel === 'condition' && activeCondition && (
                selectedSymptom 
                  ? `${selectedSymptom} — how severe?`
                  : `Log ${activeCondition.label}`
              )}
              {activePanel === 'condition' && !activeCondition && 'What are you experiencing?'}
              {activePanel === 'medication' && 'Which medication?'}
              {activePanel === 'energy' && "How's your energy?"}
              {activePanel === 'mood' && 'How are you feeling?'}
              {activePanel === 'addTrackable' && 'Add a trackable'}
            </span>
            <button onClick={closeAll} className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Condition panel - show symptoms for the selected condition, then severity */}
          {activePanel === 'condition' && activeCondition && !selectedSymptom && (
            <div className="space-y-3">
              {/* Quick severity - log the condition directly */}
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

              {/* Condition-specific symptoms */}
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

          {/* Generic flare panel when no AI categories */}
          {activePanel === 'condition' && !activeCondition && (
            <div className="space-y-3">
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
            </div>
          )}

          {/* Severity selector after picking a specific symptom */}
          {activePanel === 'condition' && selectedSymptom && (
            <div>
              <button onClick={() => setSelectedSymptom(null)} className="flex items-center gap-1.5 text-sm text-primary font-medium mb-3">
                <Activity className="w-3.5 h-3.5" /> ← Back
              </button>
              <SeverityWheel selectedSeverity={null} onSeveritySelect={handleSeveritySelect} />
            </div>
          )}

          {/* Medication panel */}
          {activePanel === 'medication' && (
            <>
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
          {activePanel === 'energy' && <EnergyOrbs onSelect={handleEnergySelect} />}

          {/* Mood panel */}
          {activePanel === 'mood' && <SeverityWheel selectedSeverity={null} onSeveritySelect={handleMoodSelect} />}

          {/* Add Trackable panel */}
          {activePanel === 'addTrackable' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Track anything — water, vitamins, exercise, supplements, habits, etc.
              </p>
              
              <div className="flex gap-2">
                <Input
                  value={trackableSearch}
                  onChange={(e) => { setTrackableSearch(e.target.value); setTrackableSuggestion(null); }}
                  placeholder="e.g. Water, Vitamins, Exercise..."
                  className="flex-1 h-10 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTrackable(); }}
                />
                <button 
                  onClick={handleAddTrackable}
                  disabled={!trackableSearch.trim() || isSearchingTrackable}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSearchingTrackable ? '...' : 'Add'}
                </button>
              </div>

              {/* Suggestion chips */}
              {!trackableSuggestion && (
                <div className="flex flex-wrap gap-2">
                  {TRACKABLE_SUGGESTIONS.map((s) => {
                    const SIcon = ICON_MAP[s.icon] || Activity;
                    return (
                      <button key={s.query} onClick={() => { setTrackableSearch(s.label); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95"
                        style={{
                          background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.8) 0%, hsl(0 0% 96% / 0.7) 100%)',
                          border: '1px solid hsl(0 0% 100% / 0.5)',
                        }}
                      >
                        <SIcon className="w-3.5 h-3.5 text-primary" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Confirm trackable */}
              {trackableSuggestion && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  {(() => {
                    const TIcon = ICON_MAP[trackableSuggestion.icon] || Activity;
                    return <TIcon className="w-5 h-5 text-primary" />;
                  })()}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{trackableSuggestion.label}</p>
                    <p className="text-[10px] text-muted-foreground">Will appear in your quick tracking bar</p>
                  </div>
                  <button 
                    onClick={confirmAddTrackable}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition-all active:scale-95"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
