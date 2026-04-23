import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { soap_note_id } = await req.json();
    if (!soap_note_id) throw new Error("soap_note_id required");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get SOAP note
    const { data: note, error: noteErr } = await supabase
      .from("soap_notes")
      .select("*")
      .eq("id", soap_note_id)
      .eq("clinician_id", user.id)
      .single();
    if (noteErr || !note) throw new Error("SOAP note not found");

    // Get patient profile
    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: patient } = await svcClient
      .from("profiles")
      .select("full_name, conditions")
      .eq("id", note.patient_id)
      .single();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Generate a clear, patient-friendly visit summary from this clinical SOAP note. Use plain language, avoid medical jargon where possible, and organize into sections: What We Discussed, Key Findings, Plan & Next Steps.

Patient: ${patient?.full_name || "Patient"}
Conditions: ${(patient?.conditions || []).join(", ") || "Not specified"}
Visit Date: ${note.visit_date}

SOAP Note:
Subjective: ${note.subjective || "N/A"}
Objective: ${note.objective || "N/A"}
Assessment: ${note.assessment || "N/A"}
Plan: ${note.plan || "N/A"}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a medical documentation assistant. Generate patient-friendly visit summaries in markdown format." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResp.json();
    const summaryMd = aiData.choices?.[0]?.message?.content || "Summary could not be generated.";

    // Save to visit_summaries
    const { data: summary, error: saveErr } = await supabase
      .from("visit_summaries")
      .insert({
        clinician_id: user.id,
        patient_id: note.patient_id,
        soap_note_id: note.id,
        visit_date: note.visit_date,
        summary_md: summaryMd,
      })
      .select()
      .single();

    if (saveErr) throw saveErr;

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-visit-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
