import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Smile, Pill, X, Zap, Heart, Moon, Coffee, Frown, Meh } from "lucide-react";

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
  { value: 'mild', label: 'Mild', color: 'bg-severity-mild text-foreground' },
  { value: 'moderate', label: 'Moderate', color: 'bg-severity-moderate text-white' },
  { value: 'severe', label: 'Severe', color: 'bg-severity-severe text-white' },
];

const ENERGY_LEVELS = [
  { value: 'low', label: 'Low', icon: Moon, color: 'text-severity-moderate' },
  { value: 'moderate', label: 'OK', icon: Coffee, color: 'text-muted-foreground' },
  { value: 'high', label: 'High', icon: Zap, color: 'text-severity-none' },
];

type ActivePanel = null | 'symptom' | 'medication' | 'energy' | 'mood';

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
  
  const allSymptoms = [...new Set([...userSymptoms, ...COMMON_SYMPTOMS])].slice(0, 9);

  const handleSymptomClick = (symptom: string) => {
    setActivePanel(null);
    if (selectedSymptom === symptom) {
      setSelectedSymptom(null);
    } else {
      setSelectedSymptom(symptom);
    }
  };

  const handleSeverityClick = (severity: string) => {
    if (selectedSymptom) {
      onLogSymptom(selectedSymptom, severity);
      setSelectedSymptom(null);
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
    setActivePanel(null);
  };

  const closePanel = () => {
    setActivePanel(null);
    setSelectedSymptom(null);
  };

  // Severity selector
  if (selectedSymptom) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium">{selectedSymptom}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={closePanel}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex gap-2">
          {SEVERITIES.map((sev) => (
            <Button
              key={sev.value}
              variant="outline"
              size="sm"
              onClick={() => handleSeverityClick(sev.value)}
              disabled={disabled}
              className={cn("flex-1 h-9 text-xs", sev.color, "hover:opacity-90")}
            >
              {sev.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Medication panel
  if (activePanel === 'medication') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5 text-primary" />
            Medications
          </span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={closePanel}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        {userMedications && userMedications.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {userMedications.map((med, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-8 text-xs hover:bg-primary hover:text-primary-foreground"
                onClick={() => handleMedicationClick(med.name)}
              >
                {med.name}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            Add medications in Profile → Health
          </p>
        )}
      </div>
    );
  }

  // Energy panel
  if (activePanel === 'energy') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" />
            Energy
          </span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={closePanel}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex gap-2">
          {ENERGY_LEVELS.map((level) => {
            const Icon = level.icon;
            return (
              <Button
                key={level.value}
                variant="outline"
                size="sm"
                onClick={() => handleEnergyClick(level.value as 'low' | 'moderate' | 'high')}
                disabled={disabled}
                className="flex-1 h-9 text-xs gap-1.5"
              >
                <Icon className={cn("w-3.5 h-3.5", level.color)} />
                {level.label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  // Mood panel
  if (activePanel === 'mood') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-primary" />
            How are you?
          </span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={closePanel}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMoodClick('good')}
            className="flex-1 h-9 text-xs gap-1.5 hover:bg-severity-none/20"
          >
            <Smile className="w-3.5 h-3.5 text-severity-none" />
            Good
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMoodClick('okay')}
            className="flex-1 h-9 text-xs gap-1.5"
          >
            <Meh className="w-3.5 h-3.5" />
            Okay
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMoodClick('bad')}
            className="flex-1 h-9 text-xs gap-1.5 hover:bg-severity-moderate/20"
          >
            <Frown className="w-3.5 h-3.5 text-severity-moderate" />
            Not great
          </Button>
        </div>
      </div>
    );
  }

  // Main compact layout
  return (
    <div className="space-y-2">
      {/* Action buttons row */}
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs gap-1.5"
          onClick={() => setActivePanel('mood')}
          disabled={disabled}
        >
          <Heart className="w-3.5 h-3.5" />
          Mood
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs gap-1.5"
          onClick={() => setActivePanel('medication')}
          disabled={disabled}
        >
          <Pill className="w-3.5 h-3.5" />
          Meds
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs gap-1.5"
          onClick={() => setActivePanel('energy')}
          disabled={disabled}
        >
          <Zap className="w-3.5 h-3.5" />
          Energy
        </Button>
        {onLogRecovery && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            onClick={onLogRecovery}
            disabled={disabled}
          >
            <Smile className="w-3.5 h-3.5 text-severity-none" />
            Better
          </Button>
        )}
      </div>
      
      {/* Symptom chips */}
      <div className="flex flex-wrap gap-1">
        {allSymptoms.map((symptom) => (
          <Badge
            key={symptom}
            variant="outline"
            className="cursor-pointer text-[11px] py-1 px-2 hover:bg-primary/10 hover:border-primary active:scale-95 transition-all"
            onClick={() => handleSymptomClick(symptom)}
          >
            {symptom}
          </Badge>
        ))}
      </div>
    </div>
  );
};
