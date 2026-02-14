import { useState } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Smile, Pill, X, Zap, Plus, Activity, Flame, Sun, Moon, Droplets, Thermometer, Eye, Brain, Shield, AlertTriangle, Heart } from "lucide-react";
import { SeverityWheel } from "@/components/flare/SeverityWheel";
import { EnergyOrbs } from "@/components/flare/EnergyOrbs";
import { FlareSeverity } from "@/types/flare";

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
}

interface FluidLogSelectorProps {
  userSymptoms: string[];
  userMedications: MedicationDetails[];
  aiLogCategories?: AILogCategory[];
  onLogSymptom: (symptom: string, severity: string) => void;
  onLogMedication: (medicationName: string) => void;
  onLogWellness: () => void;
  onLogEnergy?: (level: 'low' | 'moderate' | 'high') => void;
  onLogRecovery?: () => void;
  onOpenDetails?: () => void;
  disabled?: boolean;
}

const FALLBACK_SYMPTOMS = [
  'Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Pain', 
  'Brain fog', 'Cramping', 'Weakness', 'Migraine'
];

type ActivePanel = null | 'symptom' | 'medication' | 'energy' | 'mood';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  flame: Flame, zap: Zap, heart: Heart, activity: Activity,
  alert: AlertTriangle, sun: Sun, moon: Moon, droplets: Droplets,
  thermometer: Thermometer, eye: Eye, brain: Brain, shield: Shield,
};

const GlassButton = ({ children, onClick, active, disabled, className = "" }: { 
  children: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; className?: string;
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
    style={{
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
  userSymptoms, userMedications, aiLogCategories = [],
  onLogSymptom, onLogMedication, onLogWellness,
  onLogEnergy, onLogRecovery, onOpenDetails, disabled
}: FluidLogSelectorProps) => {
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [selectedCategory, setSelectedCategory] = useState<AILogCategory | null>(null);

  // Use user's known symptoms; fallback only if empty
  const allSymptoms = userSymptoms.length > 0 
    ? [...new Set([...userSymptoms])].slice(0, 12)
    : FALLBACK_SYMPTOMS;

  // Determine the primary log category from AI
  const primaryCategory = aiLogCategories.length > 0 ? aiLogCategories[0] : null;
  const primaryLabel = primaryCategory?.label || 'Flare';
  const PrimaryIcon = primaryCategory?.icon ? (ICON_MAP[primaryCategory.icon] || Flame) : Flame;

  const handleSymptomClick = (symptom: string) => {
    haptics.selection();
    setSelectedSymptom(symptom);
  };

  const handleSeveritySelect = (severity: FlareSeverity) => {
    if (selectedSymptom) {
      haptics.success();
      onLogSymptom(selectedSymptom, severity);
      setSelectedSymptom(null);
      setActivePanel(null);
      setSelectedCategory(null);
    }
  };

  const handleCategorySeveritySelect = (severity: FlareSeverity) => {
    if (selectedCategory) {
      haptics.success();
      // Log with the category label as the symptom
      onLogSymptom(selectedCategory.label, severity);
      setSelectedCategory(null);
      setActivePanel(null);
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

  const togglePanel = (panel: ActivePanel) => {
    haptics.selection();
    setActivePanel(activePanel === panel ? null : panel);
    setSelectedSymptom(null);
    setSelectedCategory(null);
  };

  const closeAll = () => {
    setActivePanel(null);
    setSelectedSymptom(null);
    setSelectedCategory(null);
  };

  // Build custom severity labels from AI category
  const customSeverityLabels = selectedCategory?.severityLabels;

  return (
    <div className="space-y-2">
      {/* Main action buttons */}
      <div className="flex items-center gap-2">
        <GlassButton onClick={() => togglePanel('symptom')} disabled={disabled} active={activePanel === 'symptom'} className="flex-1">
          <PrimaryIcon className="w-4 h-4 text-red-500" />
          <span>{primaryLabel}</span>
        </GlassButton>

        <GlassButton onClick={() => togglePanel('mood')} disabled={disabled} active={activePanel === 'mood'} className="flex-1">
          <Smile className="w-4 h-4 text-emerald-500" />
          <span>Mood</span>
        </GlassButton>

        <GlassButton onClick={() => togglePanel('medication')} disabled={disabled} active={activePanel === 'medication'} className="flex-1">
          <Pill className="w-4 h-4 text-blue-500" />
          <span>Meds</span>
        </GlassButton>

        <GlassButton onClick={() => togglePanel('energy')} disabled={disabled} active={activePanel === 'energy'} className="flex-1">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Energy</span>
        </GlassButton>

        {onOpenDetails && (
          <button onClick={() => { haptics.light(); onOpenDetails(); }} disabled={disabled}
            className={cn(
              "relative h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0",
              "transition-all duration-300 touch-manipulation overflow-hidden backdrop-blur-xl",
              "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-b before:from-white/40 before:to-transparent",
              "active:scale-95"
            )}
            style={{
              background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.8) 0%, hsl(0 0% 96% / 0.75) 100%)',
              border: '1px solid hsl(0 0% 100% / 0.5)',
              boxShadow: 'inset 0 1px 2px hsl(0 0% 100% / 0.3), 0 2px 8px hsl(0 0% 0% / 0.04)',
            }}
          >
            <Plus className="w-5 h-5 text-muted-foreground relative z-10" />
          </button>
        )}
      </div>

      {/* Expandable panels */}
      {activePanel && (
        <div className={cn("animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl p-4 overflow-hidden backdrop-blur-xl")}
          style={{
            background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.9) 0%, hsl(0 0% 98% / 0.85) 100%)',
            border: '1px solid hsl(0 0% 100% / 0.6)',
            boxShadow: 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 8px 24px hsl(0 0% 0% / 0.06)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-semibold text-foreground">
              {activePanel === 'symptom' && (selectedCategory ? `${selectedCategory.label} — how severe?` : selectedSymptom ? `${selectedSymptom} — how severe?` : `What ${primaryLabel.toLowerCase()}?`)}
              {activePanel === 'medication' && 'Which medication?'}
              {activePanel === 'energy' && "How's your energy?"}
              {activePanel === 'mood' && 'How are you feeling?'}
            </span>
            <button onClick={closeAll} className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Symptom selection - show AI categories first, then symptoms */}
          {activePanel === 'symptom' && !selectedSymptom && !selectedCategory && (
            <div className="space-y-3">
              {/* AI log categories as primary options */}
              {aiLogCategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {aiLogCategories.map((cat) => {
                    const CatIcon = ICON_MAP[cat.icon] || Flame;
                    return (
                      <button key={cat.id} onClick={() => { haptics.selection(); setSelectedCategory(cat); }}
                        className={cn("px-4 py-2.5 rounded-xl text-sm font-semibold transition-all backdrop-blur-sm hover:scale-[1.02] active:scale-95 flex items-center gap-2")}
                        style={{
                          background: `linear-gradient(145deg, ${cat.color || 'hsl(0 70% 95%)'} / 0.15, ${cat.color || 'hsl(0 70% 90%)'} / 0.08)`,
                          border: `1.5px solid ${cat.color || 'hsl(0 70% 70%)'} / 0.3`,
                          boxShadow: `0 2px 8px ${cat.color || 'hsl(0 70% 50%)'} / 0.1`,
                        }}
                      >
                        <CatIcon className="w-4 h-4" style={{ color: cat.color || 'hsl(0 70% 50%)' }} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Regular symptoms */}
              <div className="flex flex-wrap gap-2">
                {allSymptoms.map((symptom) => (
                  <button key={symptom} onClick={() => handleSymptomClick(symptom)}
                    className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm hover:scale-[1.02] active:scale-95")}
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

          {/* Severity selector for AI category */}
          {activePanel === 'symptom' && selectedCategory && (
            <div>
              <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-1.5 text-sm text-primary font-medium mb-4">
                <Activity className="w-3.5 h-3.5" /> ← Change type
              </button>
              {customSeverityLabels && customSeverityLabels.length === 3 ? (
                <div className="grid grid-cols-3 gap-3">
                  {(['mild', 'moderate', 'severe'] as FlareSeverity[]).map((sev, i) => (
                    <button key={sev} onClick={() => handleCategorySeveritySelect(sev)}
                      className="py-4 px-3 rounded-2xl text-center transition-all active:scale-95 hover:scale-[1.02]"
                      style={{
                        background: sev === 'mild' ? 'linear-gradient(145deg, hsl(50 80% 92%), hsl(50 70% 85%))' 
                          : sev === 'moderate' ? 'linear-gradient(145deg, hsl(30 80% 90%), hsl(30 70% 82%))'
                          : 'linear-gradient(145deg, hsl(0 70% 90%), hsl(0 60% 82%))',
                        border: `1px solid ${sev === 'mild' ? 'hsl(50 60% 70%)' : sev === 'moderate' ? 'hsl(30 60% 70%)' : 'hsl(0 50% 70%)'}`,
                      }}
                    >
                      <div className="text-sm font-semibold">{customSeverityLabels[i]}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 capitalize">{sev}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <SeverityWheel selectedSeverity={null} onSeveritySelect={handleCategorySeveritySelect} />
              )}
            </div>
          )}

          {/* Severity selector for symptoms */}
          {activePanel === 'symptom' && selectedSymptom && !selectedCategory && (
            <div>
              <button onClick={() => setSelectedSymptom(null)} className="flex items-center gap-1.5 text-sm text-primary font-medium mb-4">
                <Activity className="w-3.5 h-3.5" /> ← Change symptom
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
                      className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm hover:scale-[1.02] active:scale-95")}
                      style={{
                        background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.8) 0%, hsl(0 0% 96% / 0.7) 100%)',
                        border: '1px solid hsl(0 0% 100% / 0.5)',
                        boxShadow: 'inset 0 1px 2px hsl(0 0% 100% / 0.3), 0 2px 6px hsl(0 0% 0% / 0.03)',
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
        </div>
      )}
    </div>
  );
};
