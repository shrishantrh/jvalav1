import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClinicianAuth } from "@/hooks/useClinicianAuth";
import { useClinicalAlerts } from "@/hooks/useClinicalAlerts";
import { useSOAPNotes, type SOAPNote } from "@/hooks/useSOAPNotes";
import { supabase } from "@/integrations/supabase/client";
import { logClinicianAction } from "@/lib/clinicianAudit";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, AlertTriangle, FileText, Sparkles, Activity, Pill, Stethoscope, Check } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import SOAPEditor from "@/components/clinician/SOAPEditor";

export default function ClinicianPatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, isClinician, loading: authLoading } = useClinicianAuth();
  const { alerts, loading: alertsLoading, acknowledge, dismiss, generateAlerts } = useClinicalAlerts(patientId);
  const { notes, loading: notesLoading, draftWithAI, refetch: refetchNotes } = useSOAPNotes(patientId);

  const [patient, setPatient] = useState<any>(null);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [openNote, setOpenNote] = useState<SOAPNote | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isClinician)) navigate('/clinician/auth', { replace: true });
  }, [authLoading, user, isClinician, navigate]);

  useEffect(() => {
    if (!patientId || !user) return;
    (async () => {
      const sb = supabase as any;
      const [pRes, eRes, mRes] = await Promise.all([
        sb.from('profiles').select('*').eq('id', patientId).maybeSingle(),
        sb.from('flare_entries').select('*').eq('user_id', patientId).order('timestamp', { ascending: false }).limit(30),
        sb.from('medication_logs').select('*').eq('user_id', patientId).order('taken_at', { ascending: false }).limit(20),
      ]);
      setPatient(pRes.data);
      setRecentEntries(eRes.data || []);
      setMeds(mRes.data || []);
      logClinicianAction({ patient_id: patientId, action: 'view_chart', resource_type: 'patient' });
      // Run CDS once on open
      generateAlerts();
    })();
  }, [patientId, user]);

  const handleDraftSOAP = async () => {
    setDrafting(true);
    try {
      const note = await draftWithAI();
      if (note) {
        setOpenNote(note);
        toast({ title: 'SOAP draft generated', description: 'Review, edit, and finalize.' });
        logClinicianAction({ patient_id: patientId, action: 'draft_soap', resource_type: 'soap_note', resource_id: note.id });
      }
    } catch (e: any) {
      toast({ title: 'Draft failed', description: e.message, variant: 'destructive' });
    } finally { setDrafting(false); }
  };

  if (authLoading || !patient) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 86400000)) : null;
  const activeMeds = Array.from(new Set(meds.map((m: any) => m.medication_name)));
  const flares = recentEntries.filter(e => e.entry_type === 'flare');

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clinician')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> All patients
          </Button>
          <div className="text-xs text-muted-foreground">{profile?.full_name}</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Patient header */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{patient.full_name || patient.email || 'Patient'}</h1>
              <div className="text-sm text-muted-foreground mt-1">
                {age != null && `${age}y`}{age != null && patient.biological_sex && ' · '}{patient.biological_sex || ''}
                {patient.email && ` · ${patient.email}`}
              </div>
              {patient.conditions?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {patient.conditions.map((c: string) => <Badge key={c} variant="secondary">{c}</Badge>)}
                </div>
              )}
            </div>
            <Button onClick={handleDraftSOAP} disabled={drafting}>
              {drafting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Draft SOAP with AI
            </Button>
          </div>
        </Card>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="alerts">
              CDS Alerts {alerts.length > 0 && <Badge variant="outline" className="ml-1.5 h-4 text-[10px]">{alerts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="soap">SOAP Notes {notes.length > 0 && <Badge variant="outline" className="ml-1.5 h-4 text-[10px]">{notes.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-4">
            <div className="grid md:grid-cols-3 gap-3">
              <SummaryStat label="Flares (30d)" value={flares.length} icon={Activity} />
              <SummaryStat label="Active Meds" value={activeMeds.length} icon={Pill} />
              <SummaryStat label="Open Alerts" value={alerts.length} icon={AlertTriangle} accent={alerts.length > 0 ? 'warn' : undefined} />
            </div>

            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-2">Active Medications</h3>
              {activeMeds.length === 0 ? (
                <p className="text-xs text-muted-foreground">No medications logged in the last 30 days.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeMeds.map(m => <Badge key={m} variant="outline">{m}</Badge>)}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-2">Top alerts (preview)</h3>
              {alerts.slice(0, 3).map(a => (
                <div key={a.id} className="border-l-2 border-amber-500 pl-3 py-1.5 mb-2">
                  <div className="text-xs font-medium">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground">{a.description}</div>
                </div>
              ))}
              {alerts.length === 0 && <p className="text-xs text-muted-foreground">No active CDS alerts.</p>}
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Clinical Decision Support</h3>
              <Button size="sm" variant="outline" onClick={generateAlerts}>Re-analyze</Button>
            </div>
            {alertsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto my-8" />
            ) : alerts.length === 0 ? (
              <Card className="p-8 text-center">
                <Check className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium">No active alerts</p>
                <p className="text-xs text-muted-foreground">CDS engine has reviewed this patient and found no safety-critical issues.</p>
              </Card>
            ) : (
              alerts.map(a => (
                <Card key={a.id} className={cn("p-4 border-l-4",
                  a.severity === 'critical' ? 'border-l-destructive' :
                  a.severity === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500'
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={a.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px] uppercase">
                          {a.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{a.alert_type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="font-semibold text-sm">{a.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
                      {a.recommendation && (
                        <div className="mt-2 p-2 rounded-lg bg-primary/5 text-xs">
                          <span className="font-semibold">Recommendation: </span>{a.recommendation}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {!a.acknowledged_at && (
                      <Button size="sm" variant="outline" onClick={() => acknowledge(a.id)}>Acknowledge</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => dismiss(a.id, 'clinician_dismissed')}>Dismiss</Button>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="soap" className="space-y-2 mt-4">
            {notesLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto my-8" />
            ) : notes.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No SOAP notes yet</p>
                <p className="text-xs text-muted-foreground mb-4">Click "Draft SOAP with AI" above to generate one from the patient's last 30 days.</p>
              </Card>
            ) : (
              notes.map(n => (
                <Card key={n.id} className="p-4 hover:bg-muted/30 cursor-pointer" onClick={() => setOpenNote(n)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{n.chief_complaint || 'SOAP Note'}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {format(new Date(n.visit_date), 'MMM d, yyyy')} ·
                        <Badge variant="outline" className="ml-1.5 text-[9px]">{n.status}</Badge>
                        {n.ai_generated && <span className="ml-1.5">AI-drafted</span>}
                      </div>
                    </div>
                    <ChevronRightIcon />
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-2 mt-4">
            {flares.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No flares in the last 30 days.</p>
            ) : flares.map((e: any) => (
              <Card key={e.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                    e.severity === 'severe' ? 'bg-destructive' :
                    e.severity === 'moderate' ? 'bg-amber-500' : 'bg-yellow-500'
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{format(new Date(e.timestamp), 'MMM d, p')} — {e.severity}</div>
                    {e.symptoms?.length > 0 && <div className="text-[11px] text-muted-foreground">{e.symptoms.join(', ')}</div>}
                    {e.note && <div className="text-[11px] text-muted-foreground mt-0.5 italic">"{e.note}"</div>}
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {openNote && patient && (
          <SOAPEditor
            note={openNote}
            patient={patient}
            clinicianName={profile?.full_name || ''}
            clinicianNpi={profile?.npi || null}
            onClose={() => setOpenNote(null)}
            onSaved={() => { refetchNotes(); }}
          />
        )}
      </main>
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: 'warn' }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className={cn("w-4 h-4", accent === 'warn' ? 'text-amber-500' : 'text-muted-foreground')} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </Card>
  );
}

function ChevronRightIcon() { return <span className="text-muted-foreground">›</span>; }
