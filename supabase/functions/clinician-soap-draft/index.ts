import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { patient_id, chief_complaint } = await req.json();
    if (!patient_id) return new Response(JSON.stringify({ error: "patient_id required" }), { status: 400, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: linkOk } = await supabase.rpc("is_clinician_for_patient", { _clinician_id: user.id, _patient_id: patient_id });
    if (!linkOk) return new Response(JSON.stringify({ error: "Not authorized for this patient" }), { status: 403, headers: corsHeaders });

    const thirty = new Date(Date.now() - 30 * 86400000).toISOString();
    const [profileRes, flaresRes, medsRes, alertsRes] = await Promise.all([
      supabase.from("profiles").select("full_name, date_of_birth, biological_sex, conditions, known_symptoms, known_triggers").eq("id", patient_id).maybeSingle(),
      supabase.from("flare_entries").select("*").eq("user_id", patient_id).gte("timestamp", thirty).order("timestamp", { ascending: false }).limit(50),
      supabase.from("medication_logs").select("*").eq("user_id", patient_id).gte("taken_at", thirty),
      supabase.from("clinical_alerts").select("*").eq("patient_id", patient_id).eq("dismissed", false),
    ]);

    const profile = profileRes.data || {};
    const flares = flaresRes.data || [];
    const meds = medsRes.data || [];
    const alerts = alertsRes.data || [];

    const age = profile.date_of_birth ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400000)) : null;

    const sysPrompt = `You are a clinical scribe assisting a licensed physician. Generate a concise, evidence-based SOAP note draft from the patient data provided. Use clinical language. Do NOT invent findings. If a section has insufficient data, write "Limited data — clinician to assess at visit." Output MUST be valid JSON with keys: subjective, objective, assessment, plan. Each section is plain text (no markdown).`;

    const flareText = flares.slice(0, 30).map((f: any) =>
      `${f.timestamp}: ${f.severity || 'unknown'} ${f.entry_type}${f.symptoms?.length ? ` [${f.symptoms.join(', ')}]` : ''}${f.note ? ` — "${f.note}"` : ''}${f.physiological_data?.heart_rate ? ` HR:${f.physiological_data.heart_rate}` : ''}`
    ).join('\n');

    const medSet = Array.from(new Set(meds.map((m: any) => m.medication_name)));
    const userPrompt = `PATIENT
Name: ${profile.full_name || 'N/A'} | Age: ${age ?? 'N/A'} | Sex: ${profile.biological_sex || 'N/A'}
Conditions: ${(profile.conditions || []).join(', ') || 'none documented'}
Known triggers: ${(profile.known_triggers || []).join(', ') || 'none'}
Active medications: ${medSet.join(', ') || 'none'}

CHIEF COMPLAINT: ${chief_complaint || 'Routine follow-up'}

LAST 30 DAYS — ${flares.length} entries:
${flareText || 'No entries logged.'}

ACTIVE CDS ALERTS:
${alerts.map((a: any) => `- [${a.severity}] ${a.title}: ${a.description}`).join('\n') || 'None'}

Generate the SOAP draft as JSON now.`;

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI Gateway error:", aiResp.status, errText);
      throw new Error(`AI error ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const text = aiData.choices?.[0]?.message?.content || "";

    let soap = { subjective: '', objective: '', assessment: '', plan: '' };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) soap = { ...soap, ...JSON.parse(jsonMatch[0]) };
    } catch (e) { console.warn("Could not parse SOAP JSON:", e); soap.assessment = text; }

    const { data: inserted, error: insErr } = await supabase.from("soap_notes").insert({
      patient_id, clinician_id: user.id, visit_date: new Date().toISOString(),
      chief_complaint: chief_complaint || null,
      subjective: soap.subjective || null, objective: soap.objective || null,
      assessment: soap.assessment || null, plan: soap.plan || null,
      ai_generated: true, ai_model: "gemini-2.5-flash",
      ai_evidence_entry_ids: flares.slice(0, 30).map((f: any) => f.id),
      status: "draft",
    }).select().single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, note: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("SOAP draft error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
