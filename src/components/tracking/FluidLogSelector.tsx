import { useState } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Smile, Pill, X, Zap, Plus, Activity, Flame, Clock } from "lucide-react";
import { SeverityWheel } from "@/components/flare/SeverityWheel";
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

const COMMON_SYMPTOMS = [
  'Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Pain', 
  'Brain fog', 'Cramping', 'Weakness', 'Migraine'
];

type ActivePanel = null | 'symptom' | 'medication' | 'energy' | 'mood';

const ENERGY_LEVELS = [
  { value: 'low' as const, emoji: '😔', label: 'Poor', hours: '3-4 HOURS', color: { h: 0, s: 65, l: 55 } },
  { value: 'moderate' as const, emoji: '😐', label: 'Fair', hours: '5 HOURS', color: { h: 35, s: 60, l: 50 } },
  { value: 'high' as const, emoji: '🙂', label: 'Good', hours: '6-7 HOURS', color: { h: 50, s: 65, l: 50 } },
];

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
      "relative flex items-center justify-center gap-2 h-12 px-4 rounded-2xl text-base font-medium",
      "transition-all duration-300 touch-manipulation overflow-hidden",
      // Frosted glass effect
      "bg-white/60 dark:bg-slate-900/60",
      "backdrop-blur-xl",
      "border border-white/50 dark:border-slate-700/50",
      // Inner highlight
      "before:absolute before:inset-0 before:rounded-2xl",
      "before:bg-gradient-to-b before:from-white/40 before:to-transparent before:pointer-events-none",
      // Shadow
      "shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
      // States
      active && "bg-primary/20 border-primary/40 dark:bg-primary/30",
      "active:scale-95 hover:bg-white/80 dark:hover:bg-slate-800/80",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}
  >
    <span className="relative z-10 flex items-center gap-2">{children}</span>
  </button>
);

// Vertical slider for energy/sleep like reference image
const VerticalSlider = ({ 
  levels, 
  activeIndex, 
  onSelect 
}: { 
  levels: typeof ENERGY_LEVELS;
  activeIndex: number;
  onSelect: (index: number) => void;
}) => {
  const activeLevel = levels[activeIndex];
  
  return (
    <div className="flex items-center gap-6 p-4">
      {/* Labels on left */}
      <div className="flex flex-col gap-6">
        {levels.slice().reverse().map((level, i) => {
          const actualIndex = levels.length - 1 - i;
          const isActive = actualIndex === activeIndex;
          
          return (
            <button
              key={level.value}
              onClick={() => onSelect(actualIndex)}
              className={cn(
                "text-left transition-all duration-200",
                isActive ? "opacity-100" : "opacity-50"
              )}
            >
              <p className={cn(
                "text-base font-semibold",
                isActive && "text-foreground"
              )}>{level.label}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {level.hours}
              </p>
            </button>
          );
        })}
      </div>

      {/* Vertical track */}
      <div className="relative h-48 w-3 bg-muted rounded-full">
        {/* Filled portion */}
        <div 
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-300"
          style={{
            height: `${((activeIndex + 1) / levels.length) * 100}%`,
            background: `linear-gradient(to top, hsl(${activeLevel.color.h} ${activeLevel.color.s}% ${activeLevel.color.l}%), hsl(${activeLevel.color.h} ${activeLevel.color.s}% ${activeLevel.color.l + 15}%))`,
          }}
        />
        
        {/* Thumb/knob */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
          style={{
            bottom: `calc(${((activeIndex + 0.5) / levels.length) * 100}% - 20px)`,
            background: `linear-gradient(145deg, hsl(${activeLevel.color.h} ${activeLevel.color.s}% ${activeLevel.color.l + 10}%), hsl(${activeLevel.color.h} ${activeLevel.color.s}% ${activeLevel.color.l}%))`,
            boxShadow: `0 4px 16px hsl(${activeLevel.color.h} ${activeLevel.color.s}% ${activeLevel.color.l}% / 0.4), inset 0 2px 4px hsl(0 0% 100% / 0.3)`,
          }}
        >
          <span className="text-lg">{activeLevel.emoji}</span>
        </div>
      </div>

      {/* Emojis on right */}
      <div className="flex flex-col gap-6">
        {levels.slice().reverse().map((level, i) => {
          const actualIndex = levels.length - 1 - i;
          const isActive = actualIndex === activeIndex;
          
          return (
            <button
              key={level.value}
              onClick={() => onSelect(actualIndex)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
                isActive ? "opacity-100 scale-110" : "opacity-40"
              )}
            >
              <span className="text-2xl">{level.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

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
  
  const allSymptoms = [...new Set([...userSymptoms, ...COMMON_SYMPTOMS])].slice(0, 12);

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

  const handleEnergyConfirm = () => {
    haptics.success();
    const level = ENERGY_LEVELS[energyIndex].value;
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
    <div className="space-y-3">
      {/* Main action buttons - uniform frosted glass */}
      <div className="flex items-center gap-2">
        <GlassButton
          onClick={() => togglePanel('symptom')}
          disabled={disabled}
          active={activePanel === 'symptom'}
          className="flex-1"
        >
          <Flame className="w-5 h-5 text-red-500" />
          <span>Flare</span>
        </GlassButton>

        <GlassButton
          onClick={() => togglePanel('mood')}
          disabled={disabled}
          active={activePanel === 'mood'}
          className="flex-1"
        >
          <Smile className="w-5 h-5 text-emerald-500" />
          <span>Mood</span>
        </GlassButton>

        <GlassButton
          onClick={() => togglePanel('medication')}
          disabled={disabled}
          active={activePanel === 'medication'}
          className="flex-1"
        >
          <Pill className="w-5 h-5 text-blue-500" />
          <span>Meds</span>
        </GlassButton>

        <GlassButton
          onClick={() => togglePanel('energy')}
          disabled={disabled}
          active={activePanel === 'energy'}
          className="flex-1"
        >
          <Zap className="w-5 h-5 text-amber-500" />
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
              "relative h-12 w-12 rounded-2xl flex items-center justify-center",
              "transition-all duration-300 touch-manipulation overflow-hidden",
              "bg-white/60 dark:bg-slate-900/60",
              "backdrop-blur-xl",
              "border border-white/50 dark:border-slate-700/50",
              "before:absolute before:inset-0 before:rounded-2xl",
              "before:bg-gradient-to-b before:from-white/40 before:to-transparent",
              "shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
              "active:scale-95"
            )}
          >
            <Plus className="w-5 h-5 text-muted-foreground relative z-10" />
          </button>
        )}
      </div>

      {/* Expandable panels - frosted glass */}
      {activePanel && (
        <div className={cn(
          "animate-in fade-in slide-in-from-top-2 duration-300 rounded-3xl p-4 overflow-hidden",
          "bg-white/70 dark:bg-slate-900/70",
          "backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50",
          "shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
        )}>
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
                    "px-4 py-2 rounded-xl text-base font-medium transition-all",
                    "bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm",
                    "border border-white/40 dark:border-slate-700/40",
                    "hover:bg-primary/10 hover:border-primary/30 active:scale-95"
                  )}
                >
                  {symptom}
                </button>
              ))}
            </div>
          )}

          {/* Severity wheel for symptoms */}
          {activePanel === 'symptom' && selectedSymptom && (
            <div>
              <button 
                onClick={() => setSelectedSymptom(null)}
                className="flex items-center gap-1.5 text-sm text-primary font-medium mb-2"
              >
                <Activity className="w-3.5 h-3.5" />
                ← Change symptom
              </button>
              <SeverityWheel
                selectedSeverity={null}
                onSeveritySelect={handleSeveritySelect}
                question={`How severe is your ${selectedSymptom.toLowerCase()}?`}
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
                        "px-4 py-2 rounded-xl text-base font-medium transition-all",
                        "bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm",
                        "border border-white/40 dark:border-slate-700/40",
                        "hover:bg-primary/10 hover:border-primary/30 active:scale-95"
                      )}
                    >
                      💊 {med.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-base text-muted-foreground">
                  Add medications in Profile → Health
                </p>
              )}
            </>
          )}

          {/* Energy panel - vertical slider */}
          {activePanel === 'energy' && (
            <div className="flex flex-col items-center">
              <h3 className="text-xl font-bold mb-1">How would you rate</h3>
              <h3 className="text-xl font-bold mb-4">your sleep quality?</h3>
              
              <VerticalSlider
                levels={ENERGY_LEVELS}
                activeIndex={energyIndex}
                onSelect={setEnergyIndex}
              />
              
              <button
                onClick={handleEnergyConfirm}
                className={cn(
                  "mt-4 px-8 py-3 rounded-2xl font-semibold text-white transition-all",
                  "bg-gradient-to-r from-primary to-primary/80",
                  "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
                  "active:scale-95"
                )}
              >
                Log Energy
              </button>
            </div>
          )}

          {/* Mood panel - wheel picker */}
          {activePanel === 'mood' && (
            <SeverityWheel
              selectedSeverity={null}
              onSeveritySelect={handleMoodSelect}
              question="How would you describe your mood?"
            />
          )}
        </div>
      )}
    </div>
  );
};
