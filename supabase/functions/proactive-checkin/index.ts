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

    const { clientTimezone, isFirstSession } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch context in parallel
    const [profileRes, entriesRes, engagementRes, medsRes] = await Promise.all([
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
    ]);

    const profile = profileRes.data;
    const entries = entriesRes.data || [];
    const engagement = engagementRes.data;
    const meds = medsRes.data || [];

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
    };

    // If this is a brand new user with zero logs, send an introductory tour message
    const isNewUser = isFirstSession || totalLogs === 0;

    const systemPrompt = isNewUser
      ? `You are Jvala's AI health companion. This is ${userName}'s FIRST TIME opening the app after onboarding. They are tracking: ${conditions.join(', ') || 'health concerns'}.

YOUR JOB: Give a warm, personal introductory message that acts as a mini tour of the chat. This is a text-message-style chat, so keep it natural and conversational.

MUST include in your message (weave naturally, not a numbered list):
- A warm welcome by name
- Tell them this chat is their main hub — they can tell you anything: symptoms, what they ate, how they slept, their mood, took meds, etc. in plain language
- Mention you'll learn their patterns over time and start spotting connections (triggers, trends)
- Invite them to start by telling you about their ${conditions[0] || 'health concern'} — when it started, what makes it worse, what they've tried
- Keep it 3-4 short paragraphs max, conversational tone, like a knowledgeable friend texting

DO NOT: use bullet points, numbered lists, medical disclaimers, or say "I'm an AI". Just be natural and inviting.
You MUST call the "send_message" tool.`
      : `You are Jvala's proactive AI companion. You're texting ${userName} when they open the app.

YOUR JOB: Decide what to say or ask right now based on context. Be human, warm, brief, situationally aware.

CONTEXT:
${JSON.stringify(contextSummary, null, 2)}

RULES:
1. You MUST call exactly ONE tool: either "send_message" or "send_form".
2. Use "send_form" when it makes sense to collect data the user hasn't logged today (mood, energy, sleep quality, symptoms). The form should have 1-3 quick fields max. Keep it effortless.
3. Use "send_message" for greetings, follow-ups, observations, encouragement, or when a form isn't needed.
4. Be VARIED — don't always start with "Hey {name}". Mix greetings, skip greetings, ask questions, make observations.
5. If they already logged today, acknowledge it. Don't ask for what they already gave you.
6. If they haven't opened in days, be gentle — no guilt trips.
7. If there was a recent severe flare, follow up with care.
8. ${timeOfDay === 'morning' ? 'Morning: ask about sleep or how they woke up. Maybe a quick form.' : ''}
9. ${timeOfDay === 'evening' || timeOfDay === 'night' ? 'Evening/night: reflect on the day. "How was today?" form or wrap-up message.' : ''}
10. ${timeOfDay === 'afternoon' ? 'Afternoon: midday check-in, energy check, or casual observation.' : ''}
11. For forms, use the user's actual conditions/symptoms for options, not generic ones.
12. The closingMessage should be short and warm, like "thanks, rest up 💜" or "got it, have a good one!"
13. NEVER use medical disclaimers. NEVER say "I'm an AI". Just be natural.
14. Keep messages 1-2 sentences max. Be concise.`;

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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);

        if (toolCall.function.name === "send_form") {
          return new Response(
            JSON.stringify({
              type: "form",
              message: parsed.message,
              form: parsed.form,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            type: "greeting",
            message: parsed.message,
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
