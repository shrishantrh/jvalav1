import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Proactive Checkin — AI decides what to say/ask when the user opens the app.
 *
 * Returns:
 *  { message: string, form?: ProactiveForm, type: 'greeting'|'form'|'followup'|'nudge' }
 *
 * The AI considers: time of day, last activity, streak, recent flares, patterns,
 * missed data, and general context to produce something human and relevant.
 */

interface FormField {
  id: string;
  label: string;
  type: "single_select" | "multi_select";
  options: { label: string; value: string; emoji?: string }[];
}

interface ProactiveForm {
  title: string;
  fields: FormField[];
  closingMessage: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { clientTimezone, isFirstSession, isFollowUp } = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch context in parallel
    const [profileRes, entriesRes, engagementRes, medsRes, discoveriesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("flare_entries")
        .select("entry_type, severity, symptoms, triggers, note, timestamp, energy_level, environmental_data")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(50),
      supabase.from("engagement").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("medication_logs")
        .select("medication_name, taken_at")
        .eq("user_id", userId)
        .order("taken_at", { ascending: false })
        .limit(10),
      supabase
        .from("discoveries")
        .select("discovery_type, category, factor_a, factor_b, relationship, confidence, status, evidence_summary")
        .eq("user_id", userId)
        .order("confidence", { ascending: false })
        .limit(10),
    ]);

    const profile = profileRes.data;
    const entries = entriesRes.data || [];
    const engagement = engagementRes.data;
    const meds = medsRes.data || [];
    const discoveries = discoveriesRes.data || [];

    const userTz = clientTimezone || profile?.timezone || "UTC";
    const now = new Date();

    // Get local hour
    let localHour = now.getUTCHours();
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: userTz,
      }).formatToParts(now);
      const hp = parts.find((p) => p.type === "hour");
      if (hp) localHour = parseInt(hp.value, 10);
    } catch {}

    const timeOfDay =
      localHour >= 5 && localHour < 12
        ? "morning"
        : localHour >= 12 && localHour < 17
        ? "afternoon"
        : localHour >= 17 && localHour < 22
        ? "evening"
        : "night";

    const userName = profile?.full_name?.split(" ")[0] || "there";
    const conditions = profile?.conditions || [];
    const knownSymptoms = profile?.known_symptoms || [];
    const knownTriggers = profile?.known_triggers || [];
    const streak = engagement?.current_streak || 0;
    const totalLogs = engagement?.total_logs || 0;
    const lastLogDate = engagement?.last_log_date;

    // Compute recent activity
    const todayEntries = entries.filter((e: any) => {
      const d = new Date(e.timestamp);
      try {
        const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: userTz }).format(d);
        const todayDate = new Intl.DateTimeFormat("en-CA", { timeZone: userTz }).format(now);
        return localDate === todayDate;
      } catch {
        return false;
      }
    });

    const daysSinceLastLog = lastLogDate
      ? Math.floor((now.getTime() - new Date(lastLogDate).getTime()) / 86400000)
      : null;

    const lastFlare = entries.find((e: any) => e.entry_type === "flare" || e.severity);
    const hoursSinceLastFlare = lastFlare
      ? (now.getTime() - new Date(lastFlare.timestamp).getTime()) / 3600000
      : null;

    // Recent symptoms/triggers for pattern context
    const recentSymptoms = entries
      .slice(0, 20)
      .flatMap((e: any) => e.symptoms || []);
    const recentTriggers = entries
      .slice(0, 20)
      .flatMap((e: any) => e.triggers || []);

    // Get AI memory from profile metadata
    const aiMemory = (profile?.metadata as any)?.ai_memory || [];

    // Build context for AI
    const contextSummary = {
      userName,
      timeOfDay,
      localHour,
      conditions,
      knownSymptoms: knownSymptoms.slice(0, 10),
      knownTriggers: knownTriggers.slice(0, 10),
      streak,
      totalLogs,
      daysSinceLastLog,
      todayLogCount: todayEntries.length,
      todayLogTypes: todayEntries.map((e: any) => e.entry_type),
      lastFlare: lastFlare
        ? {
            severity: lastFlare.severity,
            symptoms: lastFlare.symptoms?.slice(0, 5),
            hoursSince: Math.round(hoursSinceLastFlare || 0),
          }
        : null,
      recentMeds: meds.slice(0, 5).map((m: any) => m.medication_name),
      recentSymptomFreq: Object.entries(
        recentSymptoms.reduce((acc: Record<string, number>, s: string) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {})
      )
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 5),
      recentTriggerFreq: Object.entries(
        recentTriggers.reduce((acc: Record<string, number>, t: string) => {
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {})
      )
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 5),
      biologicalSex: profile?.biological_sex,
      dateOfBirth: profile?.date_of_birth,
      aiMemory: aiMemory.slice(-10),
      isFollowUp: !!isFollowUp,
      discoveries: discoveries.slice(0, 5).map((d: any) => ({
        type: d.discovery_type,
        factor: d.factor_a,
        relationship: d.relationship,
        confidence: Math.round((d.confidence || 0) * 100),
        status: d.status,
        summary: d.evidence_summary,
      })),
    };

    // Classify user: new = account < 7 days old AND fewer than 5 logs AND hasn't done context form
    const contextFormDone = !!(aiMemory.find((m: any) => m.key === '_context_form_complete'));
    const accountCreatedAt = profile?.created_at ? new Date(profile.created_at) : now;
    const accountAgeDays = Math.floor((now.getTime() - accountCreatedAt.getTime()) / 86400000);
    const isNewUser = accountAgeDays < 7 && totalLogs < 5 && !contextFormDone;

    const systemPrompt = isNewUser
      ? `You are Jvala's AI health companion. ${userName} just created their account. They are tracking: ${conditions.join(', ') || 'health concerns'}.

YOUR JOB: Send ONE short welcome message, then a DETAILED context form. This is the ONLY time you'll ask this many questions, so be thorough.

1. Call "send_message" ONCE with a brief, warm welcome (2 sentences max). Example tone: "Hey ${userName}! Welcome to Jvala — I'm your health companion. Let me get to know you a bit so I can help."

2. Then call "send_form" with a DETAILED intake form. This is the initial context-gathering form — make it thorough (4-6 fields) because this is the only time you'll do a deep intake. Fields should include:
   - Field 1: How long they've had this condition (options: "Just started", "Few weeks", "Few months", "1-2 years", "5+ years")
   - Field 2: Current frequency (options: "Rarely", "Weekly", "Few times a week", "Daily", "Multiple times daily")
   - Field 3: Main triggers they've noticed (multi_select, 5-6 common triggers for their specific condition ${conditions.join(', ')} with emojis)
   - Field 4: What they've tried so far (multi_select, 4-5 treatment options relevant to their condition: medication, therapy, lifestyle changes, supplements, etc.)
   - Field 5: What time of day symptoms are worst (options: "Morning", "Afternoon", "Evening", "Night", "No pattern")
   - Field 6: Current stress level (options: "Low 😌", "Moderate 😐", "High 😰", "Very high 🥵")
   Use condition-specific language. For depression: "low mood episodes". For cough: "coughing bouts". For asthma: "attacks". Etc.
   closingMessage should be warm, like "thanks, this really helps me understand your situation 💜"

STYLE: Brief, warm, conversational. NO bullet points, NO medical disclaimers, NO "I'm an AI".
You MUST call "send_message" once, then "send_form" once.`
      : `You are Jvala's proactive health intelligence. You open the app with ${userName}.
${isFollowUp ? 'FOLLOW-UP mode: user just completed a form. Send ONE "send_message" — a short warm closing. No forms, no questions.' : `
YOUR JOB: Send EXACTLY TWO tool calls:
1. "send_message" — a 1-sentence contextual observation based on their DATA (not "how are you feeling"). Reference something specific: a pattern, a gap, a trend, a discovery. Examples:
   - "Your cough entries cluster in the evenings — 4 of your last 6 were after 5pm."
   - "You haven't logged any trigger data in your last 3 entries, which limits what patterns I can find."
   - "Interesting — your flares dropped after you started logging hydration."
   NEVER say "how are you feeling", "how's it going", or any generic greeting. Lead with intelligence.

2. "send_form" — a TARGETED data-collection form asking for SPECIFIC missing data the AI needs. Analyze the gaps:

DATA GAP ANALYSIS (use this to decide what to ask):
- Logged symptoms: ${recentSymptoms.length > 0 ? [...new Set(recentSymptoms)].slice(0, 5).join(', ') : 'NONE — need symptom data'}
- Logged triggers: ${recentTriggers.length > 0 ? [...new Set(recentTriggers)].slice(0, 5).join(', ') : 'NONE — need trigger data'}
- Known symptoms NOT yet logged: ${knownSymptoms.filter((s: string) => !recentSymptoms.includes(s)).slice(0, 5).join(', ') || 'all covered'}
- Known triggers NOT yet logged: ${knownTriggers.filter((t: string) => !recentTriggers.includes(t)).slice(0, 5).join(', ') || 'all covered'}
- Energy data logged: ${entries.filter((e: any) => e.energy_level).length} of ${entries.length} entries
- Environmental data: ${entries.filter((e: any) => e.environmental_data).length} of ${entries.length} entries
- Today's logs: ${todayEntries.length} (types: ${todayEntries.map((e: any) => e.entry_type).join(', ') || 'none'})
- Days since last log: ${daysSinceLastLog ?? 'never'}
- Total logs: ${totalLogs}

PRIORITY ORDER for what to ask:
1. If triggers are missing from recent entries → ask "What were you doing before your last flare?" with specific scenario options
2. If sleep/energy data is sparse → ask about last night's sleep quality or current energy
3. If environmental context is missing → ask about their current environment (indoors/outdoors, AC, dust, humidity)
4. If a discovery is "investigating" → probe that specific factor with a targeted question
5. If known symptoms haven't been logged → ask if they experienced specific ones today
6. If medication timing data is sparse → ask about recent medication adherence

Form fields should have SPECIFIC, ACTIONABLE options — not "good/bad/okay". Example:
- Sleep: "Less than 5h", "5-6h restless", "6-7h decent", "7+ solid", "Kept waking up"
- Pre-flare activity: "Exercising", "Eating", "Outdoors in cold/heat", "Dusty environment", "Stressful situation", "Just woke up"
- Energy: "Exhausted barely moving", "Low dragging", "Moderate functional", "Good energized", "Wired/restless"

The form MUST serve a research purpose — every field should fill a data gap that improves pattern detection.`}

CONTEXT:
${JSON.stringify({ ...contextSummary, accountAgeDays }, null, 2)}
${aiMemory.length > 0 ? `\nAI MEMORY:\n${aiMemory.map((m: any) => `- ${m.question}: ${m.answer}`).join('\n')}\n` : ''}
${discoveries.length > 0 ? `\nDISCOVERIES:\n${discoveries.slice(0, 5).map((d: any) => `- ${d.discovery_type}: ${d.factor_a} ${d.relationship} (${Math.round((d.confidence || 0) * 100)}% conf, ${d.status})`).join('\n')}\nProbe these with targeted questions.\n` : ''}

RULES:
- Conditions: ${conditions.join(', ') || 'none'}. Known symptoms: ${knownSymptoms.slice(0, 10).join(', ') || 'none'}. Known triggers: ${knownTriggers.slice(0, 10).join(', ') || 'none'}.
- NEVER say "how are you feeling", "how's it going", "how are you". BANNED phrases.
- NEVER speak as the user. NEVER say "I'm doing well".
- NEVER ask generic wellness questions. Every question must target a DATA GAP.
- For self-reported biometrics (sleep, energy), frame as check-in, not tracking.
- Keep message to 1 sentence. Keep form to 1-2 fields max.
- If todayLogCount >= 3, skip the form — just send an intelligent observation via "send_message" only.
- Use condition-specific language, not generic health talk.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "send_message",
          description:
            "Send a plain text message — greeting, follow-up, observation, or encouragement.",
          parameters: {
            type: "object",
            required: ["message"],
            properties: {
              message: {
                type: "string",
                description: "The message to display in chat. 1-2 sentences, human and warm.",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "send_form",
          description:
            "Send an interactive quick-form to collect data the user hasn't logged. 1-3 fields max.",
          parameters: {
            type: "object",
            required: ["message", "form"],
            properties: {
              message: {
                type: "string",
                description:
                  "Brief intro before the form, e.g. 'Quick end-of-day check —'",
              },
              form: {
                type: "object",
                required: ["fields", "closingMessage"],
                properties: {
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["id", "label", "type", "options"],
                      properties: {
                        id: { type: "string" },
                        label: {
                          type: "string",
                          description: "Short question, e.g. 'How was your sleep?'",
                        },
                        type: {
                          type: "string",
                          enum: ["single_select", "multi_select"],
                        },
                        options: {
                          type: "array",
                          items: {
                            type: "object",
                            required: ["label", "value"],
                            properties: {
                              label: { type: "string" },
                              value: { type: "string" },
                              emoji: { type: "string" },
                            },
                          },
                        },
                      },
                    },
                  },
                  closingMessage: {
                    type: "string",
                    description:
                      "Message after form completion, e.g. 'thanks, sleep well 🌙'",
                  },
                },
              },
            },
          },
        },
      },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate a proactive checkin for right now (${timeOfDay}, ${localHour}:00 local time). User has ${todayEntries.length} logs today, streak: ${streak}, last log: ${daysSinceLastLog ?? 'never'} days ago.`,
            },
          ],
          tools,
          tool_choice: "required",
          temperature: 0.9,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      // Fallback
      return new Response(
        JSON.stringify({
          type: "greeting",
          message: getStaticFallback(userName, timeOfDay, streak, todayEntries.length),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCalls = data.choices?.[0]?.message?.tool_calls || [];

    if (toolCalls.length > 0) {
      try {
        // Collect all messages from multiple tool calls
        const messages: string[] = [];
        let form: any = null;
        let responseType = "greeting";

        for (const toolCall of toolCalls) {
          if (!toolCall?.function?.arguments) continue;
          const parsed = JSON.parse(toolCall.function.arguments);

          if (toolCall.function.name === "send_form") {
            responseType = "form";
            messages.push(parsed.message);
            form = parsed.form;
          } else if (toolCall.function.name === "send_message") {
            messages.push(parsed.message);
          }
        }

        if (form) {
          return new Response(
            JSON.stringify({ type: "form", message: messages[0], form }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Return all messages as an array for the client to display sequentially
        return new Response(
          JSON.stringify({
            type: "greeting",
            message: messages[0] || getStaticFallback(userName, timeOfDay, streak, todayEntries.length),
            messages: messages.length > 1 ? messages : undefined,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    // Fallback to content
    const content = data.choices?.[0]?.message?.content;
    return new Response(
      JSON.stringify({
        type: "greeting",
        message: content || getStaticFallback(userName, timeOfDay, streak, todayEntries.length),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Proactive checkin error:", error);
    return new Response(
      JSON.stringify({ type: "greeting", message: "Hey! How are you feeling?" }),
      {
        status: 200, // Don't fail the app
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getStaticFallback(
  name: string,
  timeOfDay: string,
  streak: number,
  todayLogs: number
): string {
  const greetings: Record<string, string[]> = {
    morning: [
      `Morning ${name}! How'd you sleep?`,
      `Good morning! Ready to track your day?`,
      `Hey, morning! How are you feeling?`,
    ],
    afternoon: [
      `Afternoon check-in — how's it going?`,
      `Hey! How's your afternoon?`,
      `Quick midday pulse — how are you?`,
    ],
    evening: [
      `Evening! How was your day overall?`,
      `Hey ${name}, winding down? How was today?`,
      `End of day check — how are things?`,
    ],
    night: [
      `Before you sleep — how was today?`,
      `Goodnight soon! Any last thoughts to log?`,
      `Rest well ${name} 🌙`,
    ],
  };
  const pool = greetings[timeOfDay] || greetings.afternoon;
  return pool[Math.floor(Math.random() * pool.length)];
}
