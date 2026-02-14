import { useState } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Smile, Pill, X, Zap, Plus, Activity, Flame } from "lucide-react";
import { SeverityWheel } from "@/components/flare/SeverityWheel";
import { EnergyOrbs } from "@/components/flare/EnergyOrbs";
import { FlareSeverity } from "@/types/flare";

interface MedicationDetails {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

interface FluidLogSelectorProps {
  userSymptoms: string[];
  userMedications: MedicationDetails[];
  onLogSymptom: (symptom: string, severity: string) => void;
  onLogMedication: (medicationName: string) => void;
  onLogWellness: () => void;
  onLogEnergy?: (level: 'low' | 'moderate' | 'high') => void;
  onLogRecovery?: () => void;
  onOpenDetails?: () => void;
  disabled?: boolean;
}

// Fallback symptoms only used when user has none configured
const FALLBACK_SYMPTOMS = [
  'Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Pain', 
  'Brain fog', 'Cramping', 'Weakness', 'Migraine'
];

type ActivePanel = null | 'symptom' | 'medication' | 'energy' | 'mood';

// Frosted glass button component
const GlassButton = ({ 
  children, 
  onClick, 
  active, 
  disabled,
  className = "" 
}: { 
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "relative flex items-center justify-center gap-1.5 h-11 px-3 rounded-2xl text-sm font-medium",
      "transition-all duration-300 touch-manipulation overflow-hidden",
      // Frosted glass effect
      "backdrop-blur-xl",
      // Inner highlight
      "before:absolute before:inset-0 before:rounded-2xl",
      "before:bg-gradient-to-b before:from-white/50 before:to-transparent before:pointer-events-none",
      // States
      "active:scale-95",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}
    style={{
      background: active 
        ? 'linear-gradient(145deg, hsl(25 75% 95% / 0.95) 0%, hsl(25 70% 92% / 0.9) 100%)'
        : 'linear-gradient(145deg, hsl(0 0% 100% / 0.85) 0%, hsl(0 0% 98% / 0.8) 100%)',
      border: active 
        ? '2px solid hsl(25 75% 50% / 0.4)'
        : '1px solid hsl(0 0% 100% / 0.6)',
      boxShadow: active
        ? 'inset 0 1px 2px hsl(0 0% 100% / 0.5), 0 4px 12px hsl(25 75% 50% / 0.15)'
        : 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 2px 8px hsl(0 0% 0% / 0.04)',
    }}
  >
    <span className="relative z-10 flex items-center gap-1.5">{children}</span>
  </button>
);

export const FluidLogSelector = ({
  userSymptoms,
  userMedications,
  onLogSymptom,
  onLogMedication,
  onLogWellness,
  onLogEnergy,
  onLogRecovery,
  onOpenDetails,
  disabled
}: FluidLogSelectorProps) => {
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [energyIndex, setEnergyIndex] = useState(1);
  
  // Prioritize user's known symptoms, then fallback
  const allSymptoms = userSymptoms.length > 0 
    ? [...new Set([...userSymptoms])].slice(0, 12)
    : FALLBACK_SYMPTOMS;

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
    }
  };

  const handleMedicationClick = (medName: string) => {
    haptics.light();
    onLogMedication(medName);
    setActivePanel(null);
  };

  const handleEnergySelect = (level: 'low' | 'moderate' | 'high') => {
    haptics.success();
    if (onLogEnergy) {
      onLogEnergy(level);
    }
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
  };

  const closeAll = () => {
    setActivePanel(null);
    setSelectedSymptom(null);
  };

  return (
    <div className="space-y-2">
      {/* Main action buttons - uniform frosted glass */}
      <div className="flex items-center gap-2">
        <GlassButton
          onClick={() => togglePanel('symptom')}
          disabled={disabled}
          active={activePanel === 'symptom'}
          className="flex-1"
        >
          <Flame className="w-4 h-4 text-red-500" />
          <span>Flare</span>
        </GlassButton>

        <GlassButton
          onClick={() => togglePanel('mood')}
          disabled={disabled}
          active={activePanel === 'mood'}
          className="flex-1"
        >
          <Smile className="w-4 h-4 text-emerald-500" />
          <span>Mood</span>
        </GlassButton>

        <GlassButton
          onClick={() => togglePanel('medication')}
          disabled={disabled}
          active={activePanel === 'medication'}
          className="flex-1"
        >
          <Pill className="w-4 h-4 text-blue-500" />
          <span>Meds</span>
        </GlassButton>

        <GlassButton
          onClick={() => togglePanel('energy')}
          disabled={disabled}
          active={activePanel === 'energy'}
          className="flex-1"
        >
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Energy</span>
        </GlassButton>

        {/* Plus button for details */}
        {onOpenDetails && (
          <button
            onClick={() => {
              haptics.light();
              onOpenDetails();
            }}
            disabled={disabled}
            className={cn(
              "relative h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0",
              "transition-all duration-300 touch-manipulation overflow-hidden",
              "backdrop-blur-xl",
              "before:absolute before:inset-0 before:rounded-2xl",
              "before:bg-gradient-to-b before:from-white/40 before:to-transparent",
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

      {/* Expandable panels - frosted glass */}
      {activePanel && (
        <div 
          className={cn(
            "animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl p-4 overflow-hidden",
            "backdrop-blur-xl"
          )}
          style={{
            background: 'linear-gradient(145deg, hsl(0 0% 100% / 0.9) 0%, hsl(0 0% 98% / 0.85) 100%)',
            border: '1px solid hsl(0 0% 100% / 0.6)',
            boxShadow: 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 8px 24px hsl(0 0% 0% / 0.06)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-semibold text-foreground">
              {activePanel === 'symptom' && (selectedSymptom ? `${selectedSymptom} — how severe?` : 'What symptom?')}
              {activePanel === 'medication' && 'Which medication?'}
              {activePanel === 'energy' && "How's your energy?"}
              {activePanel === 'mood' && 'How are you feeling?'}
            </span>
            <button 
              onClick={closeAll}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:scale-95 transition-all"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Symptom selection */}
          {activePanel === 'symptom' && !selectedSymptom && (
            <div className="flex flex-wrap gap-2">
              {allSymptoms.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => handleSymptomClick(symptom)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    "backdrop-blur-sm",
                    "hover:scale-[1.02] active:scale-95"
                  )}
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
          )}

          {/* Severity selector for symptoms - 3D orbs */}
          {activePanel === 'symptom' && selectedSymptom && (
            <div>
              <button 
                onClick={() => setSelectedSymptom(null)}
                className="flex items-center gap-1.5 text-sm text-primary font-medium mb-4"
              >
                <Activity className="w-3.5 h-3.5" />
                ← Change symptom
              </button>
              <SeverityWheel
                selectedSeverity={null}
                onSeveritySelect={handleSeveritySelect}
              />
            </div>
          )}

          {/* Medication panel */}
          {activePanel === 'medication' && (
            <>
              {userMedications && userMedications.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {userMedications.map((med, i) => (
                    <button
                      key={i}
                      onClick={() => handleMedicationClick(med.name)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                        "backdrop-blur-sm",
                        "hover:scale-[1.02] active:scale-95"
                      )}
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
                <p className="text-sm text-muted-foreground">
                  Add medications in Profile → Health
                </p>
              )}
            </>
          )}

          {/* Energy panel - 3D orbs */}
          {activePanel === 'energy' && (
            <EnergyOrbs onSelect={handleEnergySelect} />
          )}

          {/* Mood panel - 3D orbs */}
          {activePanel === 'mood' && (
            <SeverityWheel
              selectedSeverity={null}
              onSeveritySelect={handleMoodSelect}
            />
          )}
        </div>
      )}
    </div>
  );
};
