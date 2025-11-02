import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FlareEntry, FlareSeverity, EnergyLevel, EntryType } from "@/types/flare";
import { SeveritySelector } from "@/components/flare/SeveritySelector";
import { SymptomSelector } from "@/components/flare/SymptomSelector";
import { EntryTypeSelector } from "@/components/flare/EntryTypeSelector";
import { EnergySelector } from "@/components/flare/EnergySelector";
import { MedicationInput } from "@/components/MedicationInput";
import { Settings, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DetailedEntryProps {
  onSave: (entry: Partial<FlareEntry>) => void;
}

export const DetailedEntry = ({ onSave }: DetailedEntryProps) => {
  const [open, setOpen] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>('flare');
  const [selectedSeverity, setSelectedSeverity] = useState<FlareSeverity | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyLevel | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const { toast } = useToast();

  const resetForm = () => {
    setEntryType('flare');
    setSelectedSeverity(null);
    setSelectedEnergy(null);
    setSelectedSymptoms([]);
    setSelectedMeds([]);
    setSelectedTriggers([]);
    setNote('');
    setOpen(false);
  };

  const handleSeveritySelect = (severity: FlareSeverity) => {
    setSelectedSeverity(severity);
  };

  const handleEnergySelect = (energy: EnergyLevel) => {
    setSelectedEnergy(energy);
  };

  const handleSymptomToggle = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSaveEntry = async () => {
    const newEntry: Partial<FlareEntry> = {
      type: entryType,
      timestamp: new Date(),
    };

    // Add type-specific data
    if (entryType === 'flare' && selectedSeverity) {
      newEntry.severity = selectedSeverity;
      newEntry.symptoms = selectedSymptoms;
    }
    
    if (entryType === 'energy' && selectedEnergy) {
      newEntry.energyLevel = selectedEnergy;
    }
    
    if (entryType === 'medication') {
      newEntry.medications = selectedMeds.length > 0 ? selectedMeds : ['Medication taken'];
    }
    
    if (entryType === 'trigger') {
      newEntry.triggers = selectedTriggers.length > 0 ? selectedTriggers : ['Trigger noted'];
    }
    
    if (note.trim()) {
      newEntry.note = note.trim();
    }

    // Collect environmental data for all entry types
    try {
      const { getCurrentLocation, fetchWeatherData } = await import("@/services/weatherService");
      
      const location = await getCurrentLocation();
      if (location) {
        const weatherData = await fetchWeatherData(location.latitude, location.longitude);
        
        if (weatherData) {
          newEntry.environmentalData = weatherData;
        }
      }
    } catch (error) {
      console.log('Error collecting environmental data:', error);
    }

    onSave(newEntry);
    resetForm();
    
    toast({
      title: "Detailed entry saved",
      description: "Note: Health data is simulated for demo purposes. Real device integration coming soon.",
    });
  };

  const canSave = (
    (entryType === 'flare' && selectedSeverity) ||
    (entryType === 'energy' && selectedEnergy) ||
    (entryType === 'medication') ||
    (entryType === 'trigger') ||
    (entryType === 'recovery') ||
    (entryType === 'note' && note.trim())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-10 text-sm">
          <Settings className="w-4 h-4 mr-2" />
          Detailed Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              New Detailed Entry
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Entry Type Selector */}
          <div className="space-y-3">
            <h3 className="text-sm font-clinical">What would you like to track?</h3>
            <EntryTypeSelector
              selectedType={entryType}
              onTypeSelect={setEntryType}
            />
          </div>

          {/* Type-specific inputs */}
          {entryType === 'flare' && (
            <div className="space-y-4">
              <h3 className="text-sm font-clinical">How severe is the flare?</h3>
              <SeveritySelector
                selectedSeverity={selectedSeverity}
                onSeveritySelect={handleSeveritySelect}
              />
              
              {selectedSeverity && (
                <>
                  <h4 className="text-sm font-clinical">Any symptoms?</h4>
                  <SymptomSelector
                    selectedSymptoms={selectedSymptoms}
                    onSymptomToggle={handleSymptomToggle}
                  />
                </>
              )}
            </div>
          )}

          {entryType === 'energy' && (
            <div className="space-y-4">
              <h3 className="text-sm font-clinical">What's your energy level?</h3>
              <EnergySelector
                selectedEnergy={selectedEnergy}
                onEnergySelect={handleEnergySelect}
              />
            </div>
          )}

          {entryType === 'medication' && (
            <div className="space-y-4">
              <MedicationInput
                selectedMedications={selectedMeds}
                onMedicationsChange={setSelectedMeds}
              />
            </div>
          )}

          {entryType === 'trigger' && (
            <div className="space-y-3">
              <h3 className="text-sm font-clinical">Trigger information</h3>
              <div className="text-xs text-muted-foreground">
                Describe what might have triggered your symptoms in the note below.
              </div>
            </div>
          )}

          {entryType === 'recovery' && (
            <div className="space-y-3">
              <h3 className="text-sm font-clinical">Recovery details</h3>
              <div className="text-xs text-muted-foreground">
                What helped you feel better? Add details in the note below.
              </div>
            </div>
          )}

          {/* Note field for all types */}
          <div className="space-y-2">
            <label className="text-sm font-clinical">
              Additional Notes {entryType === 'note' && <span className="text-destructive">*</span>}
            </label>
            <Textarea
              placeholder={
                entryType === 'medication' ? 'Which medication? Dosage? Any effects?' :
                entryType === 'trigger' ? 'What triggered this? Context? Location?' :
                entryType === 'recovery' ? 'What helped? How do you feel now?' :
                entryType === 'flare' ? 'Any additional context about this flare...' :
                entryType === 'energy' ? 'What might have affected your energy?' :
                'Add any additional context...'
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-24"
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveEntry}
            disabled={!canSave}
            className="w-full h-12 text-base font-clinical"
            size="lg"
          >
            Save Detailed Entry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};