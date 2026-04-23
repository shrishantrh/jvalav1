import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlareEntry, FlareSeverity, EnergyLevel } from "@/types/flare";
import { format } from "date-fns";
import { X } from "lucide-react";

interface EditFlareDialogProps {
  entry: FlareEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<FlareEntry>) => void;
}

export const EditFlareDialog = ({ entry, open, onOpenChange, onSave }: EditFlareDialogProps) => {
  const [severity, setSeverity] = useState<FlareSeverity | undefined>(entry.severity);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | undefined>(entry.energyLevel);
  const [symptoms, setSymptoms] = useState<string[]>(entry.symptoms || []);
  const [symptomInput, setSymptomInput] = useState<string>('');
  const [medications, setMedications] = useState<string[]>(entry.medications || []);
  const [medicationInput, setMedicationInput] = useState<string>('');
  const [triggers, setTriggers] = useState<string[]>(entry.triggers || []);
  const [triggerInput, setTriggerInput] = useState<string>('');
  const [note, setNote] = useState<string>(entry.note || '');
  const [timestamp, setTimestamp] = useState<string>(format(entry.timestamp, "yyyy-MM-dd'T'HH:mm"));

  const addItem = (value: string, items: string[], setter: (items: string[]) => void, reset: () => void) => {
    const trimmed = value.trim();
    if (!trimmed || items.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      reset();
      return;
    }
    setter([...items, trimmed]);
    reset();
  };

  const removeItem = (value: string, items: string[], setter: (items: string[]) => void) => {
    setter(items.filter((item) => item !== value));
  };

  const handleSave = () => {
    const updates: Partial<FlareEntry> = {
      timestamp: new Date(timestamp),
      severity: entry.type === 'flare' ? severity : undefined,
      energyLevel: entry.type === 'energy' ? energyLevel : undefined,
      symptoms: symptoms.length > 0 ? symptoms : undefined,
      medications: medications.length > 0 ? medications : undefined,
      triggers: triggers.length > 0 ? triggers : undefined,
      note: note || undefined,
    };
    onSave(updates);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Entry</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="timestamp">Date & Time</Label>
            <Input
              id="timestamp"
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
            />
          </div>

          {entry.type === 'flare' && (
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select value={severity} onValueChange={(value) => setSeverity(value as FlareSeverity)}>
                <SelectTrigger id="severity">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {entry.type === 'energy' && (
            <div className="space-y-2">
              <Label htmlFor="energy">Energy Level</Label>
              <Select value={energyLevel} onValueChange={(value) => setEnergyLevel(value as EnergyLevel)}>
                <SelectTrigger id="energy">
                  <SelectValue placeholder="Select energy level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="very-low">Very Low</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="symptoms">Symptoms</Label>
            {symptoms.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {symptoms.map((symptom) => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => removeItem(symptom, symptoms, setSymptoms)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                  >
                    {symptom}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
            <Input
              id="symptoms"
              value={symptomInput}
              onChange={(e) => setSymptomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem(symptomInput, symptoms, setSymptoms, () => setSymptomInput(''));
                }
              }}
              placeholder="Type and press Enter to add"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medications">Medications</Label>
            {medications.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {medications.map((medication) => (
                  <button
                    key={medication}
                    type="button"
                    onClick={() => removeItem(medication, medications, setMedications)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    {medication}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
            <Input
              id="medications"
              value={medicationInput}
              onChange={(e) => setMedicationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem(medicationInput, medications, setMedications, () => setMedicationInput(''));
                }
              }}
              placeholder="Type and press Enter to add"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="triggers">Triggers</Label>
            {triggers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {triggers.map((trigger) => (
                  <button
                    key={trigger}
                    type="button"
                    onClick={() => removeItem(trigger, triggers, setTriggers)}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary"
                  >
                    {trigger}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
            <Input
              id="triggers"
              value={triggerInput}
              onChange={(e) => setTriggerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem(triggerInput, triggers, setTriggers, () => setTriggerInput(''));
                }
              }}
              placeholder="Type and press Enter to add"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Notes</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};