import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClinicianAuth } from "@/hooks/useClinicianAuth";
import { useClinicalAlerts } from "@/hooks/useClinicalAlerts";
import { useSOAPNotes, type SOAPNote } from "@/hooks/useSOAPNotes";
import { usePatientBiometrics } from "@/hooks/usePatientBiometrics";
import { supabase } from "@/integrations/supabase/client";
import { logClinicianAction } from "@/lib/clinicianAudit";
import { BiometricsPanel } from "@/components/clinician/BiometricsPanel";
import { MedicationTimeline } from "@/components/clinician/MedicationTimeline";
import { PatientTimeline } from "@/components/clinician/PatientTimeline";
import { RPMTimeTracker } from "@/components/clinician/RPMTimeTracker";
import { Sparkline } from "@/components/clinician/Sparkline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, ArrowLeft, AlertTriangle, FileText, Sparkles,
  Activity, Pill, Check, Heart, Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import SOAPEditor from "@/components/clinician/SOAPEditor";

const sevColor = (s: string) => s === 'severe' ? '#DC2626' : s === 'moderate' ? '#D97706' : '#059669';

export default function ClinicianPatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, isClinician, loading: authLoading } = useClinicianAuth();
  const { alerts, loading: alertsLoading, acknowledge, dismiss, generateAlerts } = useClinicalAlerts(patientId);
  const { notes, loading: notesLoading, draftWithAI, refetch: refetchNotes } = useSOAPNotes(patientId);
  const { data: bio, entries, foodLogs, medLogs, activityLogs, discoveries, loading: bioLoading } = usePatientBiometrics(patientId);

  const [patient, setPatient] = useState<any>(null);
  const [drafting, setDrafting] = useState(false);
  const [openNote, setOpenNote] = useState<SOAPNote | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isClinician)) navigate('/clinician/auth', { replace: true });
  }, [authLoading, user, isClinician, navigate]);

  useEffect(() => {
    if (!patientId || !user) return;
    (async () => {
      const sb = supabase as any;
      const { data } = await sb.from('profiles').select('*').eq('id', patientId).maybeSingle();
      setPatient(data);
      logClinicianAction({ patient_id: patientId, action: 'view_chart', resource_type: 'patient' });
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
    return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]"><Loader2 className="w-5 h-5 animate-spin text-[#6B7280]" /></div>;
  }

  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 86400000)) : null;
  const activeMeds = Array.from(new Set(medLogs.map((m: any) => m.medication_name)));
  const flares = entries.filter((e: any) => e.entry_type === 'flare');

  // Health score (same algorithm as useLinkedPatients)
  const last7Flares = flares.filter((f: any) => Date.now() - new Date(f.timestamp).getTime() < 7 * 86400000);
  const sevNum = (s: string | null) => s === 'severe' ? 3 : s === 'moderate' ? 2 : s === 'mild' ? 1 : 0;
  const avgSev = last7Flares.length ? last7Flares.reduce((a: number, f: any) => a + sevNum(f.severity), 0) / last7Flares.length : 0;
  let hs = 100 - Math.min(last7Flares.length * 8, 40) - Math.min(avgSev * 10, 30) - last7Flares.filter((f: any) => f.severity === 'severe').length * 5;
  hs = Math.max(0, Math.min(100, Math.round(hs)));
  const hsColor = hs < 25 ? '#DC2626' : hs < 50 ? '#D97706' : hs < 75 ? '#6B7280' : '#059669';

  return (
    <div className="clinical-shell min-h-screen" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white">
        <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-[#6B7280]" onClick={() => navigate('/clinician/dashboard')}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Patients
            </Button>
            <span className="text-xs text-[#D1D5DB]">|</span>
            <span className="text-sm font-semibold text-[#111827]">{patient.full_name || patient.email || 'Patient'}</span>
          </div>
          <div className="flex items-center gap-3">
            {user && patientId && <RPMTimeTracker clinicianId={user.id} patientId={patientId} />}
            <span className="text-[10px] text-[#9CA3AF]">{profile?.full_name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-4 space-y-4 overflow-y-auto" style={{ height: 'calc(100vh - 48px)' }}>
        {/* Patient header strip */}
        <div className="flex items-start justify-between gap-4 p-4 rounded border border-[#E5E7EB] bg-white">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                style={{ borderColor: hsColor, color: hsColor }}
              >
                {hs}
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#111827]">{patient.full_name || 'Patient'}</h1>
                <div className="text-xs text-[#6B7280]">
                  {age != null && `${age}y`}{age != null && patient.biological_sex && ' · '}{patient.biological_sex || ''}
                  {patient.email && ` · ${patient.email}`}
                </div>
              </div>
            </div>
            {patient.conditions?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {patient.conditions.map((c: string) => (
                  <Badge key={c} className="bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] text-[10px]">{c}</Badge>
                ))}
              </div>
            )}
            {activeMeds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {activeMeds.slice(0, 5).map(m => (
                  <Badge key={m} className="bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] text-[10px]">
                    <Pill className="w-2.5 h-2.5 mr-0.5" />{m}
                  </Badge>
                ))}
                {activeMeds.length > 5 && <span className="text-[10px] text-[#6B7280]">+{activeMeds.length - 5} more</span>}
              </div>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-8 text-xs border-[#E5E7EB]" onClick={handleDraftSOAP} disabled={drafting}>
              {drafting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              Draft SOAP
            </Button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2">
          <QuickStat label="Flares 7d" value={last7Flares.length} />
          <QuickStat label="Flares 30d" value={flares.length} />
          <QuickStat label="Active Meds" value={activeMeds.length} />
          <QuickStat label="Open Alerts" value={alerts.length} color={alerts.length > 0 ? '#DC2626' : undefined} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-3">
          <TabsList className="bg-[#F3F4F6] border border-[#E5E7EB] p-0.5 h-8 rounded">
            <TabsTrigger value="overview" className="text-[11px] h-7 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="biometrics" className="text-[11px] h-7 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">Biometrics</TabsTrigger>
            <TabsTrigger value="meds" className="text-[11px] h-7 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">Meds & Food</TabsTrigger>
            <TabsTrigger value="alerts" className="text-[11px] h-7 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">
              CDS Alerts {alerts.length > 0 && <Badge className="ml-1 h-4 text-[9px] bg-[#DC2626] text-white border-0">{alerts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="soap" className="text-[11px] h-7 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">
              SOAP Notes {notes.length > 0 && <Badge className="ml-1 h-4 text-[9px] bg-[#F3F4F6] text-[#6B7280] border-0">{notes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-[11px] h-7 rounded data-[state=active]:bg-white data-[state=active]:shadow-sm">Timeline</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            {bioLoading ? (
              <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#6B7280] mx-auto" /></div>
            ) : bio ? (
              <>
                {/* Severity trend sparkline */}
                {bio.severityTrend.length > 0 && (
                  <div className="p-3 rounded border border-[#E5E7EB] bg-white">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Severity Trend (30d)</h3>
                    <Sparkline values={bio.severityTrend} width={400} height={40} color="#DC2626" />
                  </div>
                )}

                {/* Top symptoms + triggers */}
                <div className="grid md:grid-cols-2 gap-3">
                  <FreqBar title="Top Symptoms" items={bio.topSymptoms} color="#2563EB" />
                  <FreqBar title="Top Triggers" items={bio.topTriggers} color="#D97706" />
                </div>

                {/* Discoveries */}
                {discoveries.length > 0 && (
                  <div className="p-3 rounded border border-[#E5E7EB] bg-white">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">AI Discoveries</h3>
                    <div className="space-y-2">
                      {discoveries.slice(0, 5).map((d: any) => (
                        <div key={d.id} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="text-xs text-[#111827]">
                              <span className="font-medium">{d.factor_a}</span>
                              <span className="text-[#6B7280]"> {d.relationship.replace(/_/g, ' ')} </span>
                              {d.factor_b && <span className="font-medium">{d.factor_b}</span>}
                            </div>
                          </div>
                          <div className="w-20 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#2563EB]"
                              style={{ width: `${Math.round(d.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#6B7280] w-8 text-right">{Math.round(d.confidence * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick biometric preview */}
                <div className="grid grid-cols-3 gap-2">
                  {bio.hr.avg && <MiniStat label="Avg HR" value={`${Math.round(bio.hr.avg)} bpm`} />}
                  {bio.sleep.avgHours && <MiniStat label="Avg Sleep" value={`${bio.sleep.avgHours.toFixed(1)} hrs`} />}
                  {bio.steps.avgDaily && <MiniStat label="Avg Steps" value={`${Math.round(bio.steps.avgDaily)}`} />}
                </div>
              </>
            ) : (
              <p className="text-xs text-[#6B7280] text-center py-8">No data available.</p>
            )}
          </TabsContent>

          {/* Biometrics */}
          <TabsContent value="biometrics">
            <div className="p-4 rounded border border-[#E5E7EB] bg-white">
              {bioLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#6B7280] mx-auto my-8" />
              ) : bio ? (
                <BiometricsPanel data={bio} />
              ) : (
                <p className="text-xs text-[#6B7280] text-center py-8">No biometric data recorded.</p>
              )}
            </div>
          </TabsContent>

          {/* Meds & Food */}
          <TabsContent value="meds">
            <div className="p-4 rounded border border-[#E5E7EB] bg-white">
              <MedicationTimeline medLogs={medLogs} foodLogs={foodLogs} />
            </div>
          </TabsContent>

          {/* CDS Alerts */}
          <TabsContent value="alerts" className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Clinical Decision Support</h3>
              <Button size="sm" variant="outline" onClick={generateAlerts} className="h-7 text-[10px] border-[#E5E7EB]">Re-analyze</Button>
            </div>
            {alertsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#6B7280] mx-auto my-8" />
            ) : alerts.length === 0 ? (
              <div className="p-8 text-center rounded border border-[#E5E7EB] bg-white">
                <Check className="w-5 h-5 text-[#059669] mx-auto mb-2" />
                <p className="text-xs text-[#6B7280]">No active CDS alerts.</p>
              </div>
            ) : (
              alerts.map(a => (
                <div key={a.id} className={cn(
                  "p-3 rounded border bg-white",
                  a.severity === 'critical' ? 'border-l-2 border-l-[#DC2626] border-t-[#E5E7EB] border-r-[#E5E7EB] border-b-[#E5E7EB]' : 'border-[#E5E7EB]'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn(
                      "text-[9px] uppercase border-0 px-1.5 py-0",
                      a.severity === 'critical' ? 'bg-[#DC2626] text-white' : 'bg-[#FEF3C7] text-[#D97706]'
                    )}>{a.severity}</Badge>
                    <span className="text-[10px] text-[#9CA3AF]">{a.alert_type.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-xs font-medium text-[#111827]">{a.title}</div>
                  <div className="text-[10px] text-[#6B7280] mt-0.5">{a.description}</div>
                  {a.recommendation && (
                    <div className="mt-2 p-2 rounded bg-[#F9FAFB] text-[10px] text-[#374151]">
                      <span className="font-semibold">Rec: </span>{a.recommendation}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    {!a.acknowledged_at && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] border-[#E5E7EB]" onClick={() => acknowledge(a.id)}>Acknowledge</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => dismiss(a.id, 'clinician_dismissed')}>Dismiss</Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* SOAP Notes */}
          <TabsContent value="soap" className="space-y-2">
            {notesLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#6B7280] mx-auto my-8" />
            ) : notes.length === 0 ? (
              <div className="p-8 text-center rounded border border-[#E5E7EB] bg-white">
                <FileText className="w-5 h-5 text-[#D1D5DB] mx-auto mb-2" />
                <p className="text-xs text-[#6B7280]">No SOAP notes yet. Click "Draft SOAP" above.</p>
              </div>
            ) : (
              notes.map(n => (
                <div
                  key={n.id}
                  className="p-3 rounded border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                  onClick={() => setOpenNote(n)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-[#111827]">{n.chief_complaint || 'SOAP Note'}</div>
                      <div className="text-[10px] text-[#6B7280]">
                        {format(new Date(n.visit_date), 'MMM d, yyyy')} ·{' '}
                        <Badge className={cn(
                          "text-[9px] border-0 px-1.5 py-0",
                          n.status === 'finalized' ? 'bg-[#D1FAE5] text-[#059669]' : 'bg-[#F3F4F6] text-[#6B7280]'
                        )}>{n.status}</Badge>
                        {n.ai_generated && <span className="ml-1 text-[#9CA3AF]">AI</span>}
                      </div>
                    </div>
                    <span className="text-[#D1D5DB]">›</span>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline">
            <div className="p-3 rounded border border-[#E5E7EB] bg-white">
              <PatientTimeline entries={entries} medLogs={medLogs} foodLogs={foodLogs} activityLogs={activityLogs} />
            </div>
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

function QuickStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-2.5 rounded border border-[#E5E7EB] bg-white">
      <div className="text-lg font-bold" style={{ color: color || '#111827' }}>{value}</div>
      <div className="text-[10px] text-[#6B7280] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function FreqBar({ title, items, color }: { title: string; items: { name: string; count: number }[]; color: string }) {
  const max = items.length ? Math.max(...items.map(i => i.count)) : 1;
  return (
    <div className="p-3 rounded border border-[#E5E7EB] bg-white">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-[10px] text-[#9CA3AF]">No data</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.name} className="flex items-center gap-2">
              <span className="text-[10px] text-[#374151] w-24 truncate">{item.name}</span>
              <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, backgroundColor: color }} />
              </div>
              <span className="text-[10px] text-[#6B7280] w-6 text-right">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded border border-[#E5E7EB] bg-white text-center">
      <div className="text-xs font-bold text-[#111827]">{value}</div>
      <div className="text-[9px] text-[#9CA3AF] uppercase">{label}</div>
    </div>
  );
}
