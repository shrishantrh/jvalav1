import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ElevenLabs not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agentId } = await req.json();
    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user context to inject as overrides
    let userContext = "";
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const anonClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: claimsData } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
        if (claimsData?.claims?.sub) {
          const userId = claimsData.claims.sub as string;
          const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          
          const [profileRes, entriesRes, memoriesRes, medsRes] = await Promise.all([
            supabase.from("profiles").select("full_name,conditions,known_symptoms,known_triggers,biological_sex,date_of_birth").eq("id", userId).single(),
            supabase.from("flare_entries").select("severity,symptoms,triggers,timestamp,entry_type").eq("user_id", userId).order("timestamp", { ascending: false }).limit(20),
            supabase.from("ai_memories").select("content,category,importance").eq("user_id", userId).order("importance", { ascending: false }).limit(20),
            supabase.from("medication_logs").select("medication_name,taken_at").eq("user_id", userId).order("taken_at", { ascending: false }).limit(10),
          ]);

          const profile = profileRes.data;
          const entries = entriesRes.data || [];
          const memories = memoriesRes.data || [];
          const meds = medsRes.data || [];
          const flares = entries.filter(e => e.entry_type === "flare" || e.severity);
          const name = profile?.full_name?.split(" ")[0] || "there";
          const conditions = (profile?.conditions || []).join(", ") || "not specified";
          const age = profile?.date_of_birth ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400000)) : null;

          // Build compact context for voice agent
          userContext = `
ABOUT THIS USER:
Name: ${name}. Conditions: ${conditions}. ${profile?.biological_sex ? `Sex: ${profile.biological_sex}.` : ""} ${age ? `Age: ${age}.` : ""}
Known symptoms: ${(profile?.known_symptoms || []).slice(0, 8).join(", ") || "none"}
Known triggers: ${(profile?.known_triggers || []).slice(0, 8).join(", ") || "none"}

RECENT FLARES (last 10): ${flares.slice(0, 10).map(f => {
  const d = new Date(f.timestamp);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${f.severity || "?"} [${(f.symptoms || []).slice(0, 3).join(",")}]`;
}).join("; ") || "none"}

MEDICATIONS: ${meds.slice(0, 5).map(m => m.medication_name).join(", ") || "none"}

MEMORIES (things you know about ${name}):
${memories.slice(0, 15).map(m => `- ${m.content}`).join("\n") || "- Nothing learned yet"}

USE THIS CONTEXT NATURALLY. Reference specific details. "${name} mentioned yoga helps" → "How's the yoga been going?" You KNOW this person.`;
        }
      } catch (e) {
        console.error("Context fetch error:", e);
      }
    }

    // Get a conversation token (WebRTC approach)
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs error:", response.status, err);
      return new Response(JSON.stringify({ error: "Failed to get conversation token", details: err }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Return token + user context for prompt overrides
    return new Response(JSON.stringify({ 
      ...data, 
      userContext 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-conversation-token error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
