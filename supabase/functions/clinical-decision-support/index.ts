import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curated drug interaction matrix (mirror of src/data/drugInteractions.ts top entries)
const RULES = [
  { a: ['warfarin','coumadin','apixaban','eliquis','rivaroxaban'], b: ['ibuprofen','naproxen','aspirin','diclofenac'], severity: 'critical', title: 'Anticoagulant + NSAID', desc: 'Significantly increased bleeding risk.', rec: 'Avoid; use acetaminophen + PPI cover if NSAID required.' },
  { a: ['fluoxetine','sertraline','paroxetine','citalopram','escitalopram','venlafaxine','duloxetine'], b: ['phenelzine','tranylcypromine','selegiline','rasagiline'], severity: 'critical', title: 'SSRI/SNRI + MAOI', desc: 'Serotonin syndrome risk — potentially fatal.', rec: '14-day washout (5 weeks for fluoxetine).' },
  { a: ['oxycodone','hydrocodone','morphine','fentanyl','tramadol','codeine'], b: ['alprazolam','lorazepam','clonazepam','diazepam'], severity: 'critical', title: 'Opioid + Benzodiazepine', desc: 'FDA Black Box: respiratory depression, coma, death.', rec: 'Avoid combination; prescribe naloxone if unavoidable.' },
  { a: ['lisinopril','enalapril','losartan','valsartan'], b: ['spironolactone','potassium chloride','amiloride'], severity: 'warning', title: 'ACE/ARB + K+-sparing diuretic', desc: 'Hyperkalemia risk.', rec: 'Monitor serum K+ and creatinine within 1 week.' },
  { a: ['simvastatin','atorvastatin','lovastatin'], b: ['clarithromycin','erythromycin','itraconazole','ketoconazole'], severity: 'warning', title: 'Statin + CYP3A4 inhibitor', desc: 'Rhabdomyolysis risk.', rec: 'Use azithromycin or pravastatin/rosuvastatin.' },
  { a: ['methotrexate'], b: ['ibuprofen','naproxen','sulfamethoxazole','bactrim'], severity: 'warning', title: 'Methotrexate + NSAID/Sulfa', desc: 'Reduced renal MTX clearance — toxicity.', rec: 'Monitor CBC/LFTs.' },
  { a: ['warfarin','coumadin'], b: ['ciprofloxacin','metronidazole','sulfamethoxazole','fluconazole'], severity: 'warning', title: 'Warfarin + antibiotic', desc: 'INR elevation, bleeding risk.', rec: 'Check INR within 3-5 days.' },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { patient_id } = await req.json();
    if (!patient_id) return new Response(JSON.stringify({ error: "patient_id required" }), { status: 400, headers: corsHeaders });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Pull active medications (last 30 days) and recent flares (last 14 days)
    const thirtyDays = new Date(Date.now() - 30 * 86400000).toISOString();
    const fourteenDays = new Date(Date.now() - 14 * 86400000).toISOString();
    const sevenDays = new Date(Date.now() - 7 * 86400000).toISOString();

    const [medsRes, flaresRes] = await Promise.all([
      supabase.from("medication_logs").select("medication_name, taken_at").eq("user_id", patient_id).gte("taken_at", thirtyDays),
      supabase.from("flare_entries").select("severity, timestamp, symptoms").eq("user_id", patient_id).eq("entry_type", "flare").gte("timestamp", fourteenDays).order("timestamp", { ascending: true }),
    ]);

    const meds = Array.from(new Set((medsRes.data || []).map((m: any) => m.medication_name?.toLowerCase()).filter(Boolean)));
    const flares = flaresRes.data || [];

    const alerts: any[] = [];

    // 1. Drug-drug interactions
    for (const rule of RULES) {
      const matchA = meds.find((m) => rule.a.some((p) => m.includes(p)));
      const matchB = meds.find((m) => rule.b.some((p) => m.includes(p)));
      if (matchA && matchB) {
        alerts.push({
          patient_id,
          alert_type: "drug_interaction",
          severity: rule.severity,
          title: `${rule.title}: ${matchA} + ${matchB}`,
          description: rule.desc,
          recommendation: rule.rec,
          evidence: { drugs: [matchA, matchB], rule_id: rule.title },
        });
      }
    }

    // 2. Severity escalation (last 7d > prior 7d by >50%)
    const last7 = flares.filter((f: any) => new Date(f.timestamp) >= new Date(sevenDays));
    const prior7 = flares.filter((f: any) => new Date(f.timestamp) < new Date(sevenDays));
    if (last7.length > 0 && prior7.length > 0) {
      const sev = (s: string) => s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
      const recentAvg = last7.reduce((s: number, f: any) => s + sev(f.severity || 'mild'), 0) / last7.length;
      const priorAvg = prior7.reduce((s: number, f: any) => s + sev(f.severity || 'mild'), 0) / prior7.length;
      if (recentAvg > priorAvg * 1.5 || (last7.length > prior7.length * 2 && last7.length >= 3)) {
        alerts.push({
          patient_id,
          alert_type: "severity_escalation",
          severity: "warning",
          title: "Symptom escalation pattern detected",
          description: `${last7.length} flares in last 7 days (vs ${prior7.length} prior week). Average severity rising.`,
          recommendation: "Consider treatment intensification, trigger review, or in-person visit.",
          evidence: { last_7d_count: last7.length, prior_7d_count: prior7.length, recent_avg_severity: recentAvg.toFixed(2), prior_avg_severity: priorAvg.toFixed(2) },
        });
      }
    }

    // 3. Severe flare cluster
    const severeLast14 = flares.filter((f: any) => f.severity === 'severe').length;
    if (severeLast14 >= 3) {
      alerts.push({
        patient_id, alert_type: "severe_cluster", severity: "critical",
        title: `${severeLast14} severe flares in 14 days`,
        description: "Patient is experiencing high-severity disease activity.",
        recommendation: "Urgent reassessment recommended; consider rescue therapy or escalation.",
        evidence: { count: severeLast14, window_days: 14 },
      });
    }

    // 4. Missed-dose pattern (medication logged < 50% of expected days)
    if (meds.length > 0) {
      const medDays = new Set((medsRes.data || []).map((m: any) => m.taken_at.slice(0, 10))).size;
      const expectedDays = 30;
      if (medDays < expectedDays * 0.5 && medDays > 0) {
        alerts.push({
          patient_id, alert_type: "adherence", severity: "warning",
          title: "Possible medication non-adherence",
          description: `Medications logged on only ${medDays}/${expectedDays} days.`,
          recommendation: "Discuss adherence barriers; consider simplifying regimen or adding reminders.",
          evidence: { logged_days: medDays, window_days: expectedDays },
        });
      }
    }

    // Dismiss superseded alerts of same type, then insert
    if (alerts.length > 0) {
      const types = Array.from(new Set(alerts.map(a => a.alert_type)));
      await supabase.from("clinical_alerts").update({ dismissed: true, dismissed_at: new Date().toISOString(), dismissed_reason: "superseded" })
        .eq("patient_id", patient_id).eq("dismissed", false).in("alert_type", types);

      const toInsert = alerts.map(a => ({ ...a, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }));
      await supabase.from("clinical_alerts").insert(toInsert);
    }

    return new Response(JSON.stringify({ ok: true, alerts_generated: alerts.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("CDS error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
