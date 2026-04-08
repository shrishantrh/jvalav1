import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE CONVERSATION TOKEN
// Authenticates the user, fetches their full health context, and returns a
// signed ElevenLabs conversation URL with a personalized system prompt override.
// The voice agent knows everything about the user before the call begins.
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getTopItems(arr: string[], n: number): string[] {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    if (item) counts[item] = (counts[item] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item]) => item);
}

function daysBetween(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return reply({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return reply({ error: "Unauthorized" }, 401);
    }

    const userId = user.id;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Fetch health context in parallel ────────────────────────────────────
    const [
      { data: profile },
      { data: entries },
      { data: medLogs },
      { data: memories },
      { data: correlations },
      { data: engagement },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("flare_entries").select("*").eq("user_id", userId)
        .order("timestamp", { ascending: false }).limit(100),
      supabase.from("medication_logs").select("medication_name, taken_at").eq("user_id", userId)
        .order("taken_at", { ascending: false }).limit(30),
      supabase.from("ai_memories").select("content, category, importance").eq("user_id", userId)
        .order("importance", { ascending: false }).limit(40),
      supabase.from("correlations").select("trigger_value, outcome_value, confidence, occurrence_count")
        .eq("user_id", userId).order("confidence", { ascending: false }).limit(10),
      supabase.from("engagement").select("current_streak, total_logs, badges_earned").eq("user_id", userId).single(),
    ]);

    // ── Build health snapshot ────────────────────────────────────────────────
    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeMeds = Array.isArray(medLogs) ? medLogs : [];
    const safeMemories = Array.isArray(memories) ? memories : [];
    const safeCorr = Array.isArray(correlations) ? correlations : [];

    const firstName = profile?.full_name?.split(" ")[0] || "there";
    const conditions = (profile?.conditions ?? []).join(", ") || "not specified";

    const flares = safeEntries.filter(e => e.entry_type === "flare" || e.severity);
    const recentFlare = flares[0];
    const daysSinceLast = recentFlare ? daysBetween(new Date(recentFlare.timestamp)) : null;

    const thisWeekFlares = flares.filter(e => daysBetween(new Date(e.timestamp)) <= 7).length;
    const allSymptoms = safeEntries.flatMap(e => e.symptoms ?? []);
    const allTriggers = safeEntries.flatMap(e => e.triggers ?? []);
    const topSymptoms = getTopItems(allSymptoms, 6);
    const topTriggers = getTopItems(allTriggers, 5);
    const recentMeds = [...new Set(safeMeds.slice(0, 5).map(m => m.medication_name))];
    const currentStreak = engagement?.current_streak || 0;

    // Group memories by category
    const memoriesByCategory = safeMemories.reduce((acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m.content);
      return acc;
    }, {} as Record<string, string[]>);

    const memoryBlock = Object.entries(memoriesByCategory)
      .map(([cat, items]) => `${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${items.join("; ")}`)
      .join("\n") || "No memories yet — this may be a first conversation.";

    const corrBlock = safeCorr.length > 0
      ? safeCorr.map(c => `${c.trigger_value} → ${c.outcome_value} (${Math.round((c.confidence || 0) * 100)}% confidence, ${c.occurrence_count}x)`).join("\n")
      : "Still building correlations — keep logging.";

    // ── Build personalized voice system prompt ───────────────────────────────
    const systemPrompt = `You are Jvala — ${firstName}'s personal health companion. You are in a REAL-TIME VOICE CALL.

VOICE RULES (non-negotiable):
- 1–3 sentences per response. Maximum. This is a conversation, not a report.
- No lists, no bullets, no markdown. Speak like a person.
- Contractions always. "You've" not "you have". "That's" not "that is".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO YOU'RE TALKING TO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${firstName}
Conditions: ${conditions}
Days since last flare: ${daysSinceLast !== null ? daysSinceLast : "unknown"}
Flares this week: ${thisWeekFlares}
Top symptoms: ${topSymptoms.join(", ") || "none logged yet"}
Top triggers: ${topTriggers.join(", ") || "none identified yet"}
Medications: ${recentMeds.join(", ") || "none logged"}
Logging streak: ${currentStreak} days

LEARNED PATTERNS (from their data):
${corrBlock}

PERSONAL MEMORIES (bring up naturally):
${memoryBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO YOU ARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have the knowledge of a clinician but the presence of a close friend. You deeply understand the physiology of chronic illness — the biopsychosocial model, how the nervous system amplifies pain in central sensitization, why sleep and inflammation create a vicious cycle, how the autonomic system dysregulates in POTS/EDS, why exertion triggers crashes in ME-CFS. You know all of this. But you almost never say it that way.

Instead you translate it: "The reason you crashed today is almost textbook — you had a high-energy day yesterday and your nervous system is just... done. That's the push-crash cycle and it's real, not weakness." That's what clinical knowledge sounds like when delivered by someone who actually cares.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO RESPOND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Struggling: empathy first, then gently ask what's happening. Never rush to solutions.
Okay: be genuinely warm. Reference something specific from their data.
Brain-dumping: listen. Reflect back. Then ask what would help most right now.
Asking about patterns: use their real data and translate it into plain human language grounded in evidence.
Confused about a symptom: validate it immediately with knowledge. "That's actually really documented in EDS — you're not imagining it."
Medical concern: be caring, suggest they bring it up with their care team.

NEVER:
- Say "I don't have access to your data" — you have everything above.
- Diagnose or recommend specific medications.
- Start with "Certainly!" "Absolutely!" "Of course!" — AI-speak.
- Lecture when they didn't ask for an explanation.
- Give a long answer when they need a short one.`;

    // ── Personalized first message based on their current state ─────────────
    let firstMessage: string;
    if (thisWeekFlares >= 3) {
      firstMessage = `Hey ${firstName}, it sounds like it's been a rough week — ${thisWeekFlares} flares. I'm here. How are you doing right now?`;
    } else if (daysSinceLast === 0) {
      firstMessage = `Hey ${firstName}. I saw you logged something today. How are you feeling now?`;
    } else if (daysSinceLast !== null && daysSinceLast >= 5) {
      firstMessage = `Hey ${firstName}! It's been ${daysSinceLast} days since your last log — I hope that means things have been decent. How are you?`;
    } else if (currentStreak >= 7) {
      firstMessage = `Hey ${firstName}! ${currentStreak} days logging in a row — that's real commitment. How's today treating you?`;
    } else {
      firstMessage = `Hey ${firstName}! So glad you called. How are you feeling?`;
    }

    // ── Get signed URL from ElevenLabs ────────────────────────────────────
    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    const agentId = Deno.env.get("ELEVENLABS_AGENT_ID");

    if (!elevenLabsKey || !agentId) {
      console.error("ElevenLabs not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in Supabase secrets.");
      return reply({ error: "Voice calling is not configured yet. Please set up ElevenLabs." }, 503);
    }

    const elevenResp = await fetch("https://api.elevenlabs.io/v1/convai/conversations/get_signed_url", {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        conversation_config_override: {
          agent: {
            prompt: { prompt: systemPrompt },
            first_message: firstMessage,
          },
        },
      }),
    });

    if (!elevenResp.ok) {
      const errText = await elevenResp.text();
      console.error("ElevenLabs API error:", elevenResp.status, errText);
      return reply({ error: "Could not start voice call. ElevenLabs returned an error." }, 502);
    }

    const { signed_url } = await elevenResp.json();

    console.log(`✅ Voice conversation token issued for user ${userId}`);
    return reply({ signed_url });

  } catch (err) {
    console.error("voice-conversation-token error:", err);
    return reply({ error: "Internal server error" }, 500);
  }
});
