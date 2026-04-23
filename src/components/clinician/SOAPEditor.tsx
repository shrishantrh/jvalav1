import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSOAPNotes, type SOAPNote } from "@/hooks/useSOAPNotes";
import { logClinicianAction } from "@/lib/clinicianAudit";
import { Lock, Save, Sparkles, Loader2 } from "lucide-react";

interface Props {
  note: SOAPNote;
  patient: any;
  clinicianName: string;
  clinicianNpi: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function SOAPEditor({ note, patient, clinicianName, clinicianNpi, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const { updateNote, finalize } = useSOAPNotes(patient.id);
  const [chief, setChief] = useState(note.chief_complaint || '');
  const [s, setS] = useState(note.subjective || '');
  const [o, setO] = useState(note.objective || '');
  const [a, setA] = useState(note.assessment || '');
  const [p, setP] = useState(note.plan || '');
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const isFinalized = note.status === 'finalized';

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNote(note.id, { chief_complaint: chief, subjective: s, objective: o, assessment: a, plan: p });
      toast({ title: 'Draft saved' });
      logClinicianAction({ patient_id: patient.id, action: 'edit_soap', resource_type: 'soap_note', resource_id: note.id });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleFinalize = async () => {
    if (!confirm('Finalizing locks this note. Amendments require a new note. Continue?')) return;
    setFinalizing(true);
    try {
      await updateNote(note.id, { chief_complaint: chief, subjective: s, objective: o, assessment: a, plan: p });
      await finalize(note.id, clinicianName, clinicianNpi);
      toast({ title: 'SOAP note finalized', description: 'Locked and signed.' });
      logClinicianAction({ patient_id: patient.id, action: 'finalize_soap', resource_type: 'soap_note', resource_id: note.id });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'Finalize failed', description: e.message, variant: 'destructive' });
    } finally { setFinalizing(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            SOAP Note — {patient.full_name || patient.email}
            {note.ai_generated && <Badge variant="outline" className="text-[10px]"><Sparkles className="w-2.5 h-2.5 mr-1" />AI Draft</Badge>}
            {isFinalized && <Badge variant="outline" className="text-[10px]"><Lock className="w-2.5 h-2.5 mr-1" />Finalized</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Chief Complaint</Label>
            <Input value={chief} onChange={e => setChief(e.target.value)} disabled={isFinalized} placeholder="e.g. Worsening joint pain" />
          </div>

          <Section label="S — Subjective" hint="Patient's report: symptoms, history, ROS." value={s} onChange={setS} disabled={isFinalized} rows={5} />
          <Section label="O — Objective" hint="Vitals, exam findings, lab/imaging results, wearable data." value={o} onChange={setO} disabled={isFinalized} rows={5} />
          <Section label="A — Assessment" hint="Diagnosis, differential, clinical reasoning." value={a} onChange={setA} disabled={isFinalized} rows={4} />
          <Section label="P — Plan" hint="Medications, referrals, follow-up, patient education." value={p} onChange={setP} disabled={isFinalized} rows={4} />

          {note.ai_generated && note.ai_evidence_entry_ids?.length > 0 && (
            <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded">
              <Sparkles className="w-3 h-3 inline mr-1 text-primary" />
              Drafted from {note.ai_evidence_entry_ids.length} patient log entries · model: {note.ai_model || 'claude'}
            </div>
          )}

          {isFinalized && note.signed_clinician_name && (
            <div className="text-[11px] border-t pt-2">
              <Lock className="w-3 h-3 inline mr-1" />
              Signed by <span className="font-semibold">{note.signed_clinician_name}</span>
              {note.signed_clinician_npi && ` (NPI ${note.signed_clinician_npi})`}
              {note.finalized_at && ` on ${new Date(note.finalized_at).toLocaleString()}`}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!isFinalized && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Draft
              </Button>
              <Button onClick={handleFinalize} disabled={finalizing}>
                {finalizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                Finalize & Sign
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, hint, value, onChange, disabled, rows }: { label: string; hint: string; value: string; onChange: (v: string) => void; disabled: boolean; rows: number }) {
  return (
    <div>
      <Label className="text-xs font-semibold">{label}</Label>
      <p className="text-[10px] text-muted-foreground mb-1">{hint}</p>
      <Textarea value={value} onChange={e => onChange(e.target.value)} disabled={disabled} rows={rows} className="font-mono text-sm" />
    </div>
  );
}
