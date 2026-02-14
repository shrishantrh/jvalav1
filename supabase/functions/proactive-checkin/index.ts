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

    // Classify user: new = account < 7 days old AND fewer than 5 logs
    const accountCreatedAt = profile?.created_at ? new Date(profile.created_at) : now;
    const accountAgeDays = Math.floor((now.getTime() - accountCreatedAt.getTime()) / 86400000);
    const isNewUser = accountAgeDays < 7 && totalLogs < 5;

    const systemPrompt = isNewUser
      ? `You are Jvala's AI health companion. ${userName} just created their account. They are tracking: ${conditions.join(', ') || 'health concerns'}.

YOUR JOB: Send ONE short welcome message, then a form to collect their background.

1. Call "send_message" ONCE with a brief, warm welcome (2 sentences max). Example tone: "Hey ${userName}! Welcome to Jvala — I'm your health companion. Let me get to know you a bit so I can help."

2. Then call "send_form" with a form to collect their condition background. The form MUST have 2-3 fields based on their conditions (${conditions.join(', ') || 'general health'}):
   - Field 1: How long they've had this condition (options: "Just started", "Few months", "1-2 years", "Years")
   - Field 2: Main triggers they've noticed (multi_select, 4-5 common triggers for their specific condition with emojis)
   - Field 3: Current severity / how often (options: "Rarely", "Weekly", "Few times a week", "Daily")
   Use condition-specific language. For depression: "low mood episodes". For asthma: "attacks". Etc.
   closingMessage should be warm, like "thanks, this helps a lot! 💜"

STYLE: Brief, warm, conversational. NO bullet points, NO medical disclaimers, NO "I'm an AI".
You MUST call "send_message" once, then "send_form" once.`
      : `You are Jvala's proactive AI companion. You're texting ${userName} when they open the app.

YOUR JOB: Decide what to say or ask right now based on context. Be human, warm, brief, situationally aware.

CONTEXT:
${JSON.stringify({ ...contextSummary, accountAgeDays }, null, 2)}

RULES:
1. You MUST call exactly ONE tool: either "send_message" or "send_form".
2. STRONGLY PREFER "send_form" over "send_message". Forms are the best way to collect data — users just tap and go. Use forms for mood, energy, sleep quality, symptoms, pain level, stress, or any condition-specific check-in.
3. Only use "send_message" when there's genuinely nothing to collect (e.g. user already logged everything today) or for important follow-ups on recent severe flares.
4. Be VARIED — don't always start with "Hey {name}". Mix greetings, skip greetings, ask questions, make observations.
5. If they already logged today, acknowledge it. Don't ask for what they already gave you.
6. If they haven't opened in days, be gentle — no guilt trips. But still use a form to re-engage.
7. If there was a recent severe flare, follow up with a form asking how they're feeling now.
8. ${timeOfDay === 'morning' ? 'Morning: ALWAYS use a form. Ask about sleep quality, morning symptoms, energy level.' : ''}
9. ${timeOfDay === 'evening' || timeOfDay === 'night' ? 'Evening/night: ALWAYS use a form. Ask about overall day, symptoms, stress level.' : ''}
10. ${timeOfDay === 'afternoon' ? 'Afternoon: Use a form for energy check or symptom check.' : ''}
11. For forms, use the user's actual conditions/symptoms for options, not generic ones. Reference their specific condition.
12. The closingMessage should be short and warm, like "thanks, rest up 💜" or "got it, have a good one!"
13. NEVER use medical disclaimers. NEVER say "I'm an AI". Just be natural.
14. Keep messages 1-2 sentences max. Be concise.
15. NEVER give a generic "warm welcome" or app tour. This is an EXISTING user. Be situationally relevant.
16. If the user has conditions, reference them in form labels. E.g., for depression: "How's your mood today?" with options like "Good", "Low", "Struggling".
17. If daysSinceLastLog > 2, gently ask how things have been via form — mention their condition by name.
18. If they have recent flares, include a form field about their most frequent symptom.
19. Forms should have 1-3 fields max. Each field 3-5 options with emojis. Make it effortless.`;

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
