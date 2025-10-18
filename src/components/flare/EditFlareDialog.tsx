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
  const [symptoms, setSymptoms] = useState<string>(entry.symptoms?.join(', ') || '');
  const [medications, setMedications] = useState<string>(entry.medications?.join(', ') || '');
  const [triggers, setTriggers] = useState<string>(entry.triggers?.join(', ') || '');
  const [note, setNote] = useState<string>(entry.note || '');
  const [timestamp, setTimestamp] = useState<string>(format(entry.timestamp, "yyyy-MM-dd'T'HH:mm"));

  const handleSave = () => {
    const updates: Partial<FlareEntry> = {
      timestamp: new Date(timestamp),
      severity: entry.type === 'flare' ? severity : undefined,
      energyLevel: entry.type === 'energy' ? energyLevel : undefined,
      symptoms: symptoms ? symptoms.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      medications: medications ? medications.split(',').map(m => m.trim()).filter(Boolean) : undefined,
      triggers: triggers ? triggers.split(',').map(t => t.trim()).filter(Boolean) : undefined,
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
            <Label htmlFor="symptoms">Symptoms (comma-separated)</Label>
            <Input
              id="symptoms"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. headache, fatigue, joint pain"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medications">Medications (comma-separated)</Label>
            <Input
              id="medications"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              placeholder="e.g. ibuprofen, vitamins"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="triggers">Triggers (comma-separated)</Label>
            <Input
              id="triggers"
              value={triggers}
              onChange={(e) => setTriggers(e.target.value)}
              placeholder="e.g. stress, weather, food"
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