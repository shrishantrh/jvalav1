import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Smile, Pill, X, Zap, Frown, Meh, ChevronDown, Activity, AlertCircle } from "lucide-react";

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

const SEVERITIES = [
  { value: 'mild', label: 'Mild', color: 'bg-severity-mild hover:bg-severity-mild/80' },
  { value: 'moderate', label: 'Moderate', color: 'bg-severity-moderate text-white hover:bg-severity-moderate/80' },
  { value: 'severe', label: 'Severe', color: 'bg-severity-severe text-white hover:bg-severity-severe/80' },
];

type ActivePanel = null | 'symptom' | 'medication' | 'energy' | 'mood';

const MOODS = [
  { value: 'good', icon: Smile, label: 'Good', color: 'text-severity-none' },
  { value: 'okay', icon: Meh, label: 'Okay', color: 'text-muted-foreground' },
  { value: 'bad', icon: Frown, label: 'Not great', color: 'text-severity-moderate' },
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
    setSelectedSymptom(symptom);
  };

  const handleSeverityClick = (severity: string) => {
    if (selectedSymptom) {
      onLogSymptom(selectedSymptom, severity);
      setSelectedSymptom(null);
      setActivePanel(null);
    }
  };

  const handleMedicationClick = (medName: string) => {
    onLogMedication(medName);
    setActivePanel(null);
  };

  const handleEnergyClick = (level: 'low' | 'moderate' | 'high') => {
    if (onLogEnergy) {
      onLogEnergy(level);
    }
    setActivePanel(null);
  };

  const handleMoodClick = (mood: string) => {
    if (mood === 'good') {
      onLogWellness();
    } else if (mood === 'bad' && onLogRecovery) {
      onLogRecovery();
    }
    // 'okay' could be logged as neutral state if needed
    setActivePanel(null);
  };

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(activePanel === panel ? null : panel);
    setSelectedSymptom(null);
  };

  const closeAll = () => {
    setActivePanel(null);
    setSelectedSymptom(null);
  };

  return (
    <div className="space-y-2">
      {/* Main action buttons - single row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {/* Flare/Symptom button */}
        <Button
          variant={activePanel === 'symptom' ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "h-8 px-3 text-xs gap-1.5 shrink-0 transition-all",
            activePanel === 'symptom' && "bg-primary text-primary-foreground"
          )}
          onClick={() => togglePanel('symptom')}
          disabled={disabled}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Flare
          <ChevronDown className={cn("w-3 h-3 transition-transform", activePanel === 'symptom' && "rotate-180")} />
        </Button>

        {/* Mood button - consolidated */}
        <Button
          variant={activePanel === 'mood' ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "h-8 px-3 text-xs gap-1.5 shrink-0 transition-all",
            activePanel === 'mood' && "bg-primary text-primary-foreground"
          )}
          onClick={() => togglePanel('mood')}
          disabled={disabled}
        >
          <Smile className="w-3.5 h-3.5" />
          Mood
          <ChevronDown className={cn("w-3 h-3 transition-transform", activePanel === 'mood' && "rotate-180")} />
        </Button>

        {/* Meds button */}
        <Button
          variant={activePanel === 'medication' ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "h-8 px-3 text-xs gap-1.5 shrink-0 transition-all",
            activePanel === 'medication' && "bg-primary text-primary-foreground"
          )}
          onClick={() => togglePanel('medication')}
          disabled={disabled}
        >
          <Pill className="w-3.5 h-3.5" />
          Meds
        </Button>

        {/* Energy button */}
        <Button
          variant={activePanel === 'energy' ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "h-8 px-3 text-xs gap-1.5 shrink-0 transition-all",
            activePanel === 'energy' && "bg-primary text-primary-foreground"
          )}
          onClick={() => togglePanel('energy')}
          disabled={disabled}
        >
          <Zap className="w-3.5 h-3.5" />
          Energy
        </Button>
      </div>

      {/* Expandable panels */}
      {activePanel && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-150 bg-muted/30 rounded-lg p-2.5 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {activePanel === 'symptom' && 'Select symptom'}
              {activePanel === 'medication' && 'Log medication'}
              {activePanel === 'energy' && 'Energy level'}
              {activePanel === 'mood' && 'How are you feeling?'}
            </span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={closeAll}>
              <X className="w-3 h-3" />
            </Button>
          </div>

          {/* Symptom panel */}
          {activePanel === 'symptom' && !selectedSymptom && (
            <div className="flex flex-wrap gap-1.5">
              {allSymptoms.map((symptom) => (
                <Button
                  key={symptom}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-2.5 hover:bg-primary/10 hover:border-primary"
                  onClick={() => handleSymptomClick(symptom)}
                >
                  {symptom}
                </Button>
              ))}
            </div>
          )}

          {/* Severity selector */}
          {activePanel === 'symptom' && selectedSymptom && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">{selectedSymptom}</span>
                <Button variant="ghost" size="sm" className="h-5 ml-auto text-[10px] p-1" onClick={() => setSelectedSymptom(null)}>
                  change
                </Button>
              </div>
              <div className="flex gap-1.5">
                {SEVERITIES.map((sev) => (
                  <Button
                    key={sev.value}
                    size="sm"
                    onClick={() => handleSeverityClick(sev.value)}
                    disabled={disabled}
                    className={cn("flex-1 h-8 text-xs font-medium", sev.color)}
                  >
                    {sev.label}
                  </Button>
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
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2.5 hover:bg-primary/10 hover:border-primary"
                      onClick={() => handleMedicationClick(med.name)}
                    >
                      {med.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add medications in Profile → Health
                </p>
              )}
            </>
          )}

          {/* Energy panel */}
          {activePanel === 'energy' && (
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEnergyClick('low')}
                disabled={disabled}
                className="flex-1 h-8 text-xs gap-1.5 hover:bg-severity-moderate/20"
              >
                😔 Low
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEnergyClick('moderate')}
                disabled={disabled}
                className="flex-1 h-8 text-xs gap-1.5"
              >
                😐 Okay
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEnergyClick('high')}
                disabled={disabled}
                className="flex-1 h-8 text-xs gap-1.5 hover:bg-severity-none/20"
              >
                😊 High
              </Button>
            </div>
          )}

          {/* Mood panel */}
          {activePanel === 'mood' && (
            <div className="flex gap-1.5">
              {MOODS.map((mood) => {
                const Icon = mood.icon;
                return (
                  <Button
                    key={mood.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleMoodClick(mood.value)}
                    disabled={disabled}
                    className="flex-1 h-8 text-xs gap-1.5"
                  >
                    <Icon className={cn("w-4 h-4", mood.color)} />
                    {mood.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
