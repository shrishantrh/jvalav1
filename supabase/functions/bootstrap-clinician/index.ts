import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user_id, full_name, email, npi, specialty, practice_name } = await req.json();
    if (!user_id || !full_name || !email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Insert clinician_profiles (idempotent)
    const { error: profileError } = await supabase.from("clinician_profiles").upsert({
      id: user_id, full_name, email, npi, specialty, practice_name,
    }, { onConflict: "id" });
    if (profileError) throw profileError;

    // Grant clinician role (idempotent via unique constraint)
    const { error: roleError } = await supabase.from("user_roles").upsert({ user_id, role: "clinician" }, { onConflict: "user_id,role" });
    if (roleError) throw roleError;

    // Auto-link any pending patient invites matching this clinician email.
    const { error: inviteError } = await supabase
      .from("patient_clinician_links")
      .update({ clinician_id: user_id, status: "active", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("invited_email", String(email).toLowerCase())
      .is("clinician_id", null)
      .eq("status", "pending");
    if (inviteError) throw inviteError;

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
