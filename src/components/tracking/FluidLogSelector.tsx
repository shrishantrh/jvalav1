import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Smile, Pill, X, Zap, Plus, Activity, Flame, Heart } from "lucide-react";

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

const MOODS = [
  { value: 'good', emoji: '😊', label: 'Good', bgColor: 'bg-emerald-500/15 hover:bg-emerald-500/25' },
  { value: 'okay', emoji: '😐', label: 'Okay', bgColor: 'bg-muted hover:bg-muted/80' },
  { value: 'bad', emoji: '😔', label: 'Not great', bgColor: 'bg-orange-500/15 hover:bg-orange-500/25' },
];

const SEVERITIES = [
  { value: 'mild', label: 'Mild', emoji: '🟡', bgColor: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300' },
  { value: 'moderate', label: 'Moderate', emoji: '🟠', bgColor: 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-700 dark:text-orange-300' },
  { value: 'severe', label: 'Severe', emoji: '🔴', bgColor: 'bg-red-500/15 hover:bg-red-500/25 text-red-700 dark:text-red-300' },
];

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
  
  const allSymptoms = [...new Set([...userSymptoms, ...COMMON_SYMPTOMS])].slice(0, 12);

  const handleSymptomClick = (symptom: string) => {
    haptics.selection();
    setSelectedSymptom(symptom);
  };

  const handleSeverityClick = (severity: string) => {
    if (selectedSymptom) {
      haptics.medium();
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

  const handleEnergyClick = (level: 'low' | 'moderate' | 'high') => {
    haptics.light();
    if (onLogEnergy) {
      onLogEnergy(level);
    }
    setActivePanel(null);
  };

  const handleMoodClick = (mood: string) => {
    haptics.success();
    if (mood === 'good') {
      onLogWellness();
    } else if (mood === 'bad' && onLogRecovery) {
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

  // Uniform button style - all same size
  const buttonBaseStyle = cn(
    "flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl text-sm font-medium transition-all",
    "active:scale-95 touch-manipulation border border-border/50"
  );

  return (
    <div className="space-y-2">
      {/* Main action buttons - uniform size */}
      <div className="flex items-center gap-2">
        {/* Flare button */}
        <button
          onClick={() => togglePanel('symptom')}
          disabled={disabled}
          className={cn(
            buttonBaseStyle,
            "flex-1",
            activePanel === 'symptom' 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
          )}
        >
          <Flame className="w-4 h-4" />
          <span>Flare</span>
        </button>

        {/* Mood button */}
        <button
          onClick={() => togglePanel('mood')}
          disabled={disabled}
          className={cn(
            buttonBaseStyle,
            "flex-1",
            activePanel === 'mood' 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          )}
        >
          <Smile className="w-4 h-4" />
          <span>Mood</span>
        </button>

        {/* Meds button */}
        <button
          onClick={() => togglePanel('medication')}
          disabled={disabled}
          className={cn(
            buttonBaseStyle,
            "flex-1",
            activePanel === 'medication' 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
          )}
        >
          <Pill className="w-4 h-4" />
          <span>Meds</span>
        </button>

        {/* Energy button */}
        <button
          onClick={() => togglePanel('energy')}
          disabled={disabled}
          className={cn(
            buttonBaseStyle,
            "flex-1",
            activePanel === 'energy' 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          )}
        >
          <Zap className="w-4 h-4" />
          <span>Energy</span>
        </button>

        {/* Plus button for details */}
        {onOpenDetails && (
          <button
            onClick={() => {
              haptics.light();
              onOpenDetails();
            }}
            disabled={disabled}
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
              "active:scale-95 touch-manipulation border border-border/50",
              "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Expandable panels */}
      {activePanel && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-card/80 backdrop-blur-sm rounded-2xl p-3 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {activePanel === 'symptom' && (selectedSymptom ? `${selectedSymptom} — severity?` : 'What symptom?')}
              {activePanel === 'medication' && 'Which medication?'}
              {activePanel === 'energy' && "How's your energy?"}
              {activePanel === 'mood' && 'How are you feeling?'}
            </span>
            <button 
              onClick={closeAll}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted active:scale-95"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Symptom panel */}
          {activePanel === 'symptom' && !selectedSymptom && (
            <div className="flex flex-wrap gap-1.5">
              {allSymptoms.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => handleSymptomClick(symptom)}
                  className="px-3 py-1.5 rounded-lg bg-muted/50 text-sm font-medium border border-border/30 
                    hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all"
                >
                  {symptom}
                </button>
              ))}
            </div>
          )}

          {/* Severity selector */}
          {activePanel === 'symptom' && selectedSymptom && (
            <div className="space-y-2">
              <button 
                onClick={() => setSelectedSymptom(null)}
                className="flex items-center gap-1.5 text-xs text-primary font-medium"
              >
                <Activity className="w-3 h-3" />
                ← Change symptom
              </button>
              <div className="grid grid-cols-3 gap-2">
                {SEVERITIES.map((sev) => (
                  <button
                    key={sev.value}
                    onClick={() => handleSeverityClick(sev.value)}
                    disabled={disabled}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-3 rounded-xl font-medium transition-all",
                      "active:scale-95 touch-manipulation",
                      sev.bgColor
                    )}
                  >
                    <span className="text-xl">{sev.emoji}</span>
                    <span className="text-xs">{sev.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Medication panel */}
          {activePanel === 'medication' && (
            <>
              {userMedications && userMedications.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {userMedications.map((med, i) => (
                    <button
                      key={i}
                      onClick={() => handleMedicationClick(med.name)}
                      className="px-3 py-1.5 rounded-lg bg-muted/50 text-sm font-medium border border-border/30 
                        hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all"
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

          {/* Energy panel */}
          {activePanel === 'energy' && (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleEnergyClick('low')}
                disabled={disabled}
                className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-orange-500/15 
                  text-orange-700 dark:text-orange-300 font-medium active:scale-95 transition-all"
              >
                <span className="text-xl">😔</span>
                <span className="text-xs">Low</span>
              </button>
              <button
                onClick={() => handleEnergyClick('moderate')}
                disabled={disabled}
                className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-muted 
                  text-foreground font-medium active:scale-95 transition-all"
              >
                <span className="text-xl">😐</span>
                <span className="text-xs">Okay</span>
              </button>
              <button
                onClick={() => handleEnergyClick('high')}
                disabled={disabled}
                className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-emerald-500/15 
                  text-emerald-700 dark:text-emerald-300 font-medium active:scale-95 transition-all"
              >
                <span className="text-xl">😊</span>
                <span className="text-xs">High</span>
              </button>
            </div>
          )}

          {/* Mood panel */}
          {activePanel === 'mood' && (
            <div className="grid grid-cols-3 gap-2">
              {MOODS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => handleMoodClick(mood.value)}
                  disabled={disabled}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-3 rounded-xl font-medium transition-all",
                    "active:scale-95 touch-manipulation",
                    mood.bgColor
                  )}
                >
                  <span className="text-xl">{mood.emoji}</span>
                  <span className="text-xs">{mood.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};