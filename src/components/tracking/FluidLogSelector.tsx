import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Smile, Pill, ChevronRight, X, Zap, Heart, Moon, Coffee, Frown, Meh } from "lucide-react";

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
  { value: 'mild', label: 'Mild', color: 'bg-severity-mild', hoverBg: 'hover:bg-severity-mild/30' },
  { value: 'moderate', label: 'Moderate', color: 'bg-severity-moderate', hoverBg: 'hover:bg-severity-moderate/30' },
  { value: 'severe', label: 'Severe', color: 'bg-severity-severe', hoverBg: 'hover:bg-severity-severe/30' },
];

const ENERGY_LEVELS = [
  { value: 'low', label: 'Low', icon: Moon, color: 'text-severity-moderate', bg: 'bg-severity-moderate/10' },
  { value: 'moderate', label: 'OK', icon: Coffee, color: 'text-muted-foreground', bg: 'bg-muted' },
  { value: 'high', label: 'High', icon: Zap, color: 'text-severity-none', bg: 'bg-severity-none/10' },
];

const MOOD_OPTIONS = [
  { value: 'good', label: 'Good', icon: Smile, color: 'text-severity-none', bg: 'hover:bg-severity-none/20' },
  { value: 'okay', label: 'Okay', icon: Meh, color: 'text-muted-foreground', bg: 'hover:bg-muted' },
  { value: 'bad', label: 'Not great', icon: Frown, color: 'text-severity-moderate', bg: 'hover:bg-severity-moderate/20' },
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

  // Severity selector with animation
  if (selectedSymptom) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium">{selectedSymptom}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0 rounded-full"
            onClick={closePanel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">How severe?</p>
        <div className="grid grid-cols-3 gap-2">
          {SEVERITIES.map((sev, idx) => (
            <Button
              key={sev.value}
              variant="outline"
              size="sm"
              onClick={() => handleSeverityClick(sev.value)}
              disabled={disabled}
              className={cn(
                "h-14 flex-col gap-1 transition-all duration-200 border-2",
                sev.hoverBg,
                "animate-in fade-in slide-in-from-bottom-1",
              )}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <span className={cn("w-3 h-3 rounded-full", sev.color)} />
              <span className="text-xs font-medium">{sev.label}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Medication selector panel
  if (activePanel === 'medication') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" />
            Log medication
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0 rounded-full"
            onClick={closePanel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        {userMedications && userMedications.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {userMedications.map((med, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-10 text-sm animate-in fade-in slide-in-from-bottom-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => handleMedicationClick(med.name)}
              >
                <Pill className="w-3.5 h-3.5 mr-1.5" />
                {med.name}
                {med.dosage && <span className="ml-1 opacity-60 text-xs">({med.dosage})</span>}
              </Button>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <Pill className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No medications added yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add them in Profile → Health tab
            </p>
          </div>
        )}
      </div>
    );
  }

  // Energy selector panel
  if (activePanel === 'energy') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Energy level
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0 rounded-full"
            onClick={closePanel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ENERGY_LEVELS.map((level, idx) => {
            const Icon = level.icon;
            return (
              <Button
                key={level.value}
                variant="outline"
                size="sm"
                onClick={() => handleEnergyClick(level.value as 'low' | 'moderate' | 'high')}
                disabled={disabled}
                className={cn(
                  "h-14 flex-col gap-1 transition-all duration-200 border-2",
                  level.bg,
                  "animate-in fade-in slide-in-from-bottom-1",
                )}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <Icon className={cn("w-5 h-5", level.color)} />
                <span className="text-xs font-medium">{level.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  // Mood selector panel
  if (activePanel === 'mood') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            How are you feeling?
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0 rounded-full"
            onClick={closePanel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MOOD_OPTIONS.map((mood, idx) => {
            const Icon = mood.icon;
            return (
              <Button
                key={mood.value}
                variant="outline"
                size="sm"
                onClick={() => handleMoodClick(mood.value)}
                disabled={disabled}
                className={cn(
                  "h-14 flex-col gap-1 transition-all duration-200 border-2",
                  mood.bg,
                  "animate-in fade-in slide-in-from-bottom-1",
                )}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <Icon className={cn("w-5 h-5", mood.color)} />
                <span className="text-xs font-medium">{mood.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  // Main selector - organized layout
  return (
    <div className="space-y-4">
      {/* Quick actions - 2x2 grid */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-2 justify-start px-3 hover:bg-primary/10 hover:border-primary transition-all"
          onClick={() => setActivePanel('mood')}
          disabled={disabled}
        >
          <Heart className="w-4 h-4 text-primary" />
          <span className="text-sm">How I feel</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-2 justify-start px-3 hover:bg-primary/10 hover:border-primary transition-all"
          onClick={() => setActivePanel('medication')}
          disabled={disabled}
        >
          <Pill className="w-4 h-4" />
          <span className="text-sm">Took meds</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-2 justify-start px-3 hover:bg-primary/10 hover:border-primary transition-all"
          onClick={() => setActivePanel('energy')}
          disabled={disabled}
        >
          <Zap className="w-4 h-4" />
          <span className="text-sm">Energy</span>
        </Button>
        {onLogRecovery && (
          <Button
            variant="outline"
            size="sm"
            className="h-11 gap-2 justify-start px-3 hover:bg-severity-none/20 hover:border-severity-none transition-all"
            onClick={onLogRecovery}
            disabled={disabled}
          >
            <Smile className="w-4 h-4 text-severity-none" />
            <span className="text-sm">Feeling better</span>
          </Button>
        )}
      </div>
      
      {/* Symptom chips */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Symptoms</p>
        <div className="flex flex-wrap gap-1.5">
          {allSymptoms.map((symptom) => (
            <Badge
              key={symptom}
              variant="outline"
              className={cn(
                "cursor-pointer text-xs py-1 px-2.5 transition-all duration-150",
                "hover:bg-primary/10 hover:border-primary",
                "active:scale-95"
              )}
              onClick={() => handleSymptomClick(symptom)}
            >
              {symptom}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};
