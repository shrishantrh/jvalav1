import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Smile, Pill, ChevronRight, X } from "lucide-react";

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
  disabled?: boolean;
}

const COMMON_SYMPTOMS = [
  'Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Pain', 
  'Brain fog', 'Cramping', 'Weakness', 'Migraine'
];

const SEVERITIES = [
  { value: 'mild', label: 'Mild', color: 'bg-severity-mild' },
  { value: 'moderate', label: 'Moderate', color: 'bg-severity-moderate' },
  { value: 'severe', label: 'Severe', color: 'bg-severity-severe' },
];

export const FluidLogSelector = ({
  userSymptoms,
  userMedications,
  onLogSymptom,
  onLogMedication,
  onLogWellness,
  disabled
}: FluidLogSelectorProps) => {
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [showMedications, setShowMedications] = useState(false);
  
  const allSymptoms = [...new Set([...userSymptoms, ...COMMON_SYMPTOMS])].slice(0, 9);

  const handleSymptomClick = (symptom: string) => {
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
    setShowMedications(false);
  };

  // Severity selector overlay
  if (selectedSymptom) {
    return (
      <div className="animate-scale-in">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{selectedSymptom}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0"
            onClick={() => setSelectedSymptom(null)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex gap-2">
          {SEVERITIES.map(sev => (
            <Button
              key={sev.value}
              variant="outline"
              size="sm"
              onClick={() => handleSeverityClick(sev.value)}
              disabled={disabled}
              className={cn(
                "flex-1 h-12 text-sm font-medium transition-all hover:scale-105",
                sev.value === 'mild' && "hover:bg-severity-mild/20 hover:border-severity-mild",
                sev.value === 'moderate' && "hover:bg-severity-moderate/20 hover:border-severity-moderate",
                sev.value === 'severe' && "hover:bg-severity-severe/20 hover:border-severity-severe",
              )}
            >
              <span className={cn("w-2.5 h-2.5 rounded-full mr-2", sev.color)} />
              {sev.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Medication selector
  if (showMedications) {
    return (
      <div className="animate-scale-in">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <Pill className="w-4 h-4" />
            Took medication
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0"
            onClick={() => setShowMedications(false)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        {userMedications.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {userMedications.map((med, i) => (
              <Badge
                key={i}
                variant="outline"
                className="cursor-pointer py-1.5 px-3 text-sm hover:bg-primary hover:text-primary-foreground transition-all hover:scale-105"
                onClick={() => handleMedicationClick(med.name)}
              >
                {med.name}
                {med.dosage && <span className="ml-1 opacity-60">({med.dosage})</span>}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add medications in your Profile → Health section first.
          </p>
        )}
      </div>
    );
  }

  // Main selector
  return (
    <div className="space-y-2">
      {/* Quick actions row */}
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs flex-1 hover:bg-severity-none/20 hover:border-severity-none"
          onClick={onLogWellness}
          disabled={disabled}
        >
          <Smile className="w-3.5 h-3.5 mr-1 text-severity-none" />
          Feeling good
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs flex-1"
          onClick={() => setShowMedications(true)}
          disabled={disabled}
        >
          <Pill className="w-3.5 h-3.5 mr-1" />
          Took meds
          <ChevronRight className="w-3 h-3 ml-1 opacity-50" />
        </Button>
      </div>
      
      {/* Symptom chips - tap to select, then choose severity */}
      <div className="flex flex-wrap gap-1.5">
        {allSymptoms.map(symptom => (
          <Badge
            key={symptom}
            variant="outline"
            className={cn(
              "cursor-pointer text-xs py-1 px-2.5 transition-all hover:scale-105",
              "hover:bg-primary/10 hover:border-primary"
            )}
            onClick={() => handleSymptomClick(symptom)}
          >
            {symptom}
          </Badge>
        ))}
      </div>
    </div>
  );
};