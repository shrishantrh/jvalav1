import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useClinicianAuth } from "@/hooks/useClinicianAuth";
import { Button } from "@/components/ui/button";
import { Stethoscope, Shield, Users, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

/**
 * /clinician — entry point.
 * - If ?token=... → legacy patient-share view (existing dashboard)
 * - If signed in as a clinician → patient triage list (coming next round)
 * - Otherwise → marketing/CTA page with sign-in / sign-up for providers
 */
export default function ClinicianEntry() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user, isClinician, loading } = useClinicianAuth();

  useEffect(() => {
    if (token) {
      navigate(`/clinician/shared?token=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (user && isClinician) navigate('/clinician/dashboard', { replace: true });
  }, [user, isClinician, navigate]);

  if (loading || token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5 px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Stethoscope className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Jvala for Clinicians</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Industry-grade patient monitoring with AI-drafted SOAP notes, clinical decision support, and continuous flare tracking — all from your patients' real-world data.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: Users, title: "Triage by risk", desc: "Critical patients surfaced first, sorted by health score and unread alerts." },
            { icon: AlertTriangle, title: "CDS alerts", desc: "Drug interactions, ADR signals, severity escalations, and missed-dose patterns." },
            { icon: FileText, title: "AI SOAP notes", desc: "Subjective/Objective/Assessment/Plan auto-drafted from 30 days of patient data." },
            { icon: Shield, title: "HIPAA-style audit", desc: "Every chart access logged. Patients can see who viewed their data." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-4">
              <f.icon className="w-5 h-5 text-primary mb-2" />
              <div className="font-semibold text-sm">{f.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-4">
          <h2 className="font-semibold">Have a patient access link?</h2>
          <p className="text-sm text-muted-foreground">
            If your patient sent you a tokenized share link, open it directly — no account needed for one-off views.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-4">
          <h2 className="font-semibold">Sign in or create a provider account</h2>
          <p className="text-sm text-muted-foreground">
            Get instant access to all patients who have invited you. Free during clinical pilot.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/clinician/auth")} className="flex-1">Provider sign in / sign up</Button>
            <Button variant="outline" onClick={() => navigate("/")}>Back</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
