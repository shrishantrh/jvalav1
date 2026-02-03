import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Smile, Pill, X, Zap, Frown, Meh, Activity, AlertCircle } from "lucide-react";

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
  disabled?: boolean;
}

const COMMON_SYMPTOMS = [
  'Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Pain', 
  'Brain fog', 'Cramping', 'Weakness', 'Migraine'
];

type ActivePanel = null | 'symptom' | 'medication' | 'energy' | 'mood';

const MOODS = [
  { value: 'good', emoji: '😊', label: 'Good', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200' },
  { value: 'okay', emoji: '😐', label: 'Okay', bgColor: 'bg-muted hover:bg-muted/80' },
  { value: 'bad', emoji: '😔', label: 'Not great', bgColor: 'bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200' },
];

const SEVERITIES = [
  { value: 'mild', label: 'Mild', emoji: '😐', bgColor: 'bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 text-amber-900 dark:text-amber-200' },
  { value: 'moderate', label: 'Moderate', emoji: '😟', bgColor: 'bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 text-orange-900 dark:text-orange-200' },
  { value: 'severe', label: 'Severe', emoji: '😣', bgColor: 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 text-red-900 dark:text-red-200' },
];

export const FluidLogSelector = ({
  userSymptoms,
  userMedications,
  onLogSymptom,
  onLogMedication,
  onLogWellness,
  onLogEnergy,
  onLogRecovery,
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

  return (
    <div className="space-y-3">
      {/* Main action buttons - pill style */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {/* Flare/Symptom button */}
        <button
          onClick={() => togglePanel('symptom')}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all",
            "active:scale-95 touch-manipulation",
            activePanel === 'symptom' 
              ? "bg-primary text-primary-foreground shadow-md" 
              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
          )}
        >
          <AlertCircle className="w-4 h-4" />
          Log Flare
        </button>

        {/* Mood button */}
        <button
          onClick={() => togglePanel('mood')}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all",
            "active:scale-95 touch-manipulation",
            activePanel === 'mood' 
              ? "bg-primary text-primary-foreground shadow-md" 
              : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
          )}
        >
          <Smile className="w-4 h-4" />
          Mood
        </button>

        {/* Meds button */}
        <button
          onClick={() => togglePanel('medication')}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all",
            "active:scale-95 touch-manipulation",
            activePanel === 'medication' 
              ? "bg-primary text-primary-foreground shadow-md" 
              : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          )}
        >
          <Pill className="w-4 h-4" />
          Meds
        </button>

        {/* Energy button */}
        <button
          onClick={() => togglePanel('energy')}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all shrink-0",
            "active:scale-95 touch-manipulation",
            activePanel === 'energy' 
              ? "bg-primary text-primary-foreground shadow-md" 
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
          )}
        >
          <Zap className="w-4 h-4" />
          Energy
        </button>
      </div>

      {/* Expandable panels */}
      {activePanel && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-muted/40 rounded-2xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">
              {activePanel === 'symptom' && (selectedSymptom ? `${selectedSymptom} — severity?` : 'What symptom?')}
              {activePanel === 'medication' && 'Which medication?'}
              {activePanel === 'energy' && "How's your energy?"}
              {activePanel === 'mood' && 'How are you feeling?'}
            </span>
            <button 
              onClick={closeAll}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-muted active:scale-95"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Symptom panel */}
          {activePanel === 'symptom' && !selectedSymptom && (
            <div className="flex flex-wrap gap-2">
              {allSymptoms.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => handleSymptomClick(symptom)}
                  className="px-3.5 py-2 rounded-xl bg-card text-sm font-medium border border-border/50 
                    hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all"
                >
                  {symptom}
                </button>
              ))}
            </div>
          )}

          {/* Severity selector */}
          {activePanel === 'symptom' && selectedSymptom && (
            <div className="space-y-3">
              <button 
                onClick={() => setSelectedSymptom(null)}
                className="flex items-center gap-2 text-sm text-primary font-medium"
              >
                <Activity className="w-4 h-4" />
                ← Change symptom
              </button>
              <div className="grid grid-cols-3 gap-2">
                {SEVERITIES.map((sev) => (
                  <button
                    key={sev.value}
                    onClick={() => handleSeverityClick(sev.value)}
                    disabled={disabled}
                    className={cn(
                      "flex flex-col items-center gap-1 p-4 rounded-2xl font-semibold transition-all",
                      "active:scale-95 touch-manipulation",
                      sev.bgColor
                    )}
                  >
                    <span className="text-2xl">{sev.emoji}</span>
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
                <div className="flex flex-wrap gap-2">
                  {userMedications.map((med, i) => (
                    <button
                      key={i}
                      onClick={() => handleMedicationClick(med.name)}
                      className="px-3.5 py-2 rounded-xl bg-card text-sm font-medium border border-border/50 
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
                className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-orange-100 dark:bg-orange-900/30 
                  text-orange-900 dark:text-orange-200 font-semibold active:scale-95 transition-all"
              >
                <span className="text-2xl">😔</span>
                <span className="text-xs">Low</span>
              </button>
              <button
                onClick={() => handleEnergyClick('moderate')}
                disabled={disabled}
                className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-muted 
                  text-foreground font-semibold active:scale-95 transition-all"
              >
                <span className="text-2xl">😐</span>
                <span className="text-xs">Okay</span>
              </button>
              <button
                onClick={() => handleEnergyClick('high')}
                disabled={disabled}
                className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 
                  text-emerald-900 dark:text-emerald-200 font-semibold active:scale-95 transition-all"
              >
                <span className="text-2xl">😊</span>
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
                    "flex flex-col items-center gap-1 p-4 rounded-2xl font-semibold transition-all",
                    "active:scale-95 touch-manipulation",
                    mood.bgColor
                  )}
                >
                  <span className="text-2xl">{mood.emoji}</span>
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
