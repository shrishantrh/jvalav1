import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlareEntry } from "@/types/flare";
import { format } from "date-fns";
import { MessageSquarePlus } from "lucide-react";

interface FollowUpDialogProps {
  entry: FlareEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (followUpNote: string) => void;
}

export const FollowUpDialog = ({ entry, open, onOpenChange, onSave }: FollowUpDialogProps) => {
  const [followUpNote, setFollowUpNote] = useState<string>('');

  const handleSave = () => {
    if (followUpNote.trim()) {
      onSave(followUpNote.trim());
      setFollowUpNote('');
      onOpenChange(false);
    }
  };

  const getEntryTitle = () => {
    switch (entry.type) {
      case 'flare':
        return entry.severity ? `${entry.severity} flare` : 'Flare';
      case 'energy':
        return 'Energy entry';
      default:
        return 'Entry';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Follow-up</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {getEntryTitle()} from {format(entry.timestamp, "MMM d, yyyy 'at' h:mm a")}
          </p>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Show existing follow-ups */}
          {entry.followUps && entry.followUps.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-muted/30 rounded-md">
              <p className="text-xs font-clinical text-muted-foreground">Previous updates:</p>
              {entry.followUps.map((followUp, index) => (
                <div key={index} className="text-xs border-l-2 border-primary/30 pl-2 py-1">
                  <p className="text-foreground">{followUp.note}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">
                    {format(new Date(followUp.timestamp), "MMM d 'at' h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="followup">New Update</Label>
            <Textarea
              id="followup"
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              placeholder="e.g. Feeling better, pain decreased, took medication..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Track how you're feeling and any changes since the original entry
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!followUpNote.trim()}>
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Add Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};