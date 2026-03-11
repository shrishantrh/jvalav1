import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Compact condition knowledge (same as limitless-ai)
const CK: Record<string, [string, string]> = {
  'Asthma': ['Sleep disruption bidirectional. Peak 4-6AM. Triggers: cold/dry air, humidity>60%, AQI, GERD, stress.', 'After meals, before exercise, weather changes, evening'],
  'Migraine': ['Sleep #1 trigger. Threshold model. Dehydration, skipped meals, alcohol, weather.', 'After skipped meals, dehydration, pressure changes, cycle days'],
  'Eczema': ['Humidity<30%, temp extremes, sweat, stress. Hot showers strip lipids.', 'After shower, season changes, dry weather, stress'],
  'Acne': ['Sleep loss→cortisol→sebum 48-72h. Dairy, high-glycemic foods.', 'After dairy/sugar, post-exercise, stress'],
  'IBS': ['Gut-brain axis. FODMAPs. Large meals. Caffeine→urgency.', 'After meals, morning, FODMAP foods, stress, caffeine'],
  'Fibromyalgia': ['Central sensitization. Sleep critical. Weather sensitivity. Exercise paradox.', 'Morning pain, after sleep, weather changes, after activity'],
  'GERD': ['Nighttime worst. No eating 3h before bed. Left-side sleeping helps.', 'After meals, before bed, after coffee/alcohol'],
  'Diabetes': ['Postprandial spikes 60-90min. Dawn phenomenon 4-8AM.', 'Before/after meals, morning fasting, post-exercise'],
  'Depression': ['Consistent wake time matters. Exercise releases BDNF.', 'Morning mood, afternoon energy, evening reflection'],
  'Anxiety': ['Bidirectional with sleep. Caffeine>200mg worsens. HRV biomarker.', 'Morning, after caffeine, after meals, evening'],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    const TELNYX_PHONE_NUMBER = Deno.env.get("TELNYX_PHONE_NUMBER");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!TELNYX_API_KEY) throw new Error("TELNYX_API_KEY not configured");
    if (!TELNYX_PHONE_NUMBER) throw new Error("TELNYX_PHONE_NUMBER not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    
    // Telnyx webhook format
    const eventType = body?.data?.event_type;
    if (eventType !== "message.received") {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = body?.data?.payload;
    const fromPhone = payload?.from?.phone_number;
    const messageBody = payload?.text?.trim();

    if (!fromPhone || !messageBody) {
      return new Response(JSON.stringify({ error: "Missing phone or message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Normalize phone number (strip + and spaces)
    const normalizedPhone = fromPhone.replace(/[\s\-\(\)]/g, '').replace(/^\+?1/, '+1');

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up user by phone number
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone_number", normalizedPhone)
      .single();

    if (profileErr || !profile) {
      // Unknown number — send onboarding reply
      await sendSMS(TELNYX_API_KEY, TELNYX_PHONE_NUMBER, fromPhone,
        "Hey! 👋 This is Jvala. To get started texting me, link your phone number in the Jvala app: Settings → Profile → Phone Number. Then text me anytime to log symptoms, ask questions, or get insights!");
      return new Response(JSON.stringify({ ok: true, unregistered: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = profile.id;

    // Save inbound message
    await supabase.from("sms_conversations").insert({
      user_id: userId,
      phone_number: normalizedPhone,
      role: "user",
      content: messageBody,
    });

    // Load last 20 messages for context
    const { data: history } = await supabase
      .from("sms_conversations")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const chatHistory = (history || []).reverse();

    // ═══ Fetch all user health data (same as limitless-ai) ═══
    const [entriesRes, correlationsRes, medsRes, engagementRes, discoveriesRes] = await Promise.all([
      supabase.from("flare_entries").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(500),
      supabase.from("correlations").select("*").eq("user_id", userId).order("confidence", { ascending: false }).limit(20),
      supabase.from("medication_logs").select("*").eq("user_id", userId).order("taken_at", { ascending: false }).limit(200),
      supabase.from("engagement").select("*").eq("user_id", userId).single(),
      supabase.from("discoveries").select("*").eq("user_id", userId).gte("confidence", 0.3).order("confidence", { ascending: false }).limit(15),
    ]);

    const entries = entriesRes.data || [];
    const flares = entries.filter((e: any) => e.entry_type === "flare" || e.severity);
    const medications = medsRes.data || [];
    const correlations = correlationsRes.data || [];
    const discoveries = discoveriesRes.data || [];
    const engagement = engagementRes.data;

    const now = Date.now();
    const oneDay = 86400000;
    const oneWeek = 7 * oneDay;
    const sevToNum = (s: string) => s === 'mild' ? 1 : s === 'moderate' ? 2 : s === 'severe' ? 3 : 0;

    const thisWeekFlares = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneWeek);
    const calcSev = (l: any[]) => l.length ? l.reduce((a: number, e: any) => a + sevToNum(e.severity || ''), 0) / l.length : 0;

    // Symptom/trigger counts
    const symptomCounts: Record<string, number> = {};
    const triggerCounts: Record<string, number> = {};
    flares.forEach((e: any) => {
      (e.symptoms || []).forEach((s: string) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
      (e.triggers || []).forEach((t: string) => { triggerCounts[t] = (triggerCounts[t] || 0) + 1; });
    });

    const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n}(${c})`).join(', ');
    const topTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n}(${c})`).join(', ');

    // Med effectiveness (simplified)
    const uniqueMeds = [...new Set(medications.map((m: any) => m.medication_name))];
    const medSummary = uniqueMeds.slice(0, 5).map(name => {
      const count = medications.filter((m: any) => m.medication_name === name).length;
      return `${name}(${count}x)`;
    }).join(', ');

    const topDiscoveries = discoveries.slice(0, 5).map((d: any) =>
      `${d.factor_a} ${d.relationship} (${Math.round(d.confidence * 100)}% confidence, ${d.lift?.toFixed(1) || '?'}x lift)`
    ).join('; ');

    const userConditions = profile.conditions || [];
    const condKnowledge = userConditions.map((c: string) => {
      const ck = CK[c] || Object.entries(CK).find(([k]) => c.toLowerCase().includes(k.toLowerCase()))?.[1];
      return ck ? `${c}: ${ck[0]}` : '';
    }).filter(Boolean).join(' ');

    const userName = profile.full_name?.split(' ')[0] || 'there';
    const userTz = profile.timezone || 'UTC';
    const localHourNow = (() => { try { const p = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: userTz }).formatToParts(new Date()); return parseInt(p.find((x: any) => x.type === "hour")?.value || "12", 10); } catch { return 12; } })();

    // ═══ System prompt — optimized for SMS (concise responses) ═══
    const systemPrompt = `You are Jvala AI texting ${userName} via SMS. Same brain as the app — you know everything about their health.

══ SMS RULES ══
- Keep responses under 300 characters when possible. Be punchy.
- No markdown formatting (no **bold**, no bullets). Plain text only.
- Use emojis sparingly but naturally 💜
- You're texting like a smart friend. Casual, warm, brief.

══ LOGGING VIA TEXT ══
When the user describes symptoms/flares, extract and return structured data using the create_log tool.
Examples of things to log:
- "bad migraine after wine" → severity: severe, symptoms: [migraine], triggers: [wine]
- "mild stomach pain" → severity: mild, symptoms: [stomach pain]
- "took ibuprofen" → medication log
- "feeling great today" → entry_type: wellness, energy_level: high

══ PROFILE ══
Name: ${userName}. Conditions: ${userConditions.join(', ') || 'none'}.
Known symptoms: ${(profile.known_symptoms || []).slice(0, 8).join(', ')}.
Known triggers: ${(profile.known_triggers || []).slice(0, 8).join(', ')}.
Streak: ${engagement?.current_streak || 0} days. Total logs: ${engagement?.total_logs || 0}.

══ DATA SNAPSHOT ══
This week: ${thisWeekFlares.length} flares (avg severity ${calcSev(thisWeekFlares).toFixed(1)}).
All-time: ${flares.length} flares. Avg severity: ${calcSev(flares).toFixed(1)}.
Top symptoms: ${topSymptoms || 'none yet'}.
Top triggers: ${topTriggers || 'none yet'}.
Meds: ${medSummary || 'none logged'}.
Discoveries: ${topDiscoveries || 'none yet'}.

══ CLINICAL KNOWLEDGE ══
${condKnowledge}

══ RULES ══
- NEVER say "I can't access your data." You HAVE it above.
- For health questions: give specific, data-backed answers.
- You CAN create logs from text. Use the create_log tool.
- You CAN log medications. Use the log_medication tool.
- Keep it conversational. This is texting, not a doctor's note.
- Time: ${localHourNow}:00 ${userTz}`;

    // ═══ Tools for structured actions ═══
    const tools = [
      {
        type: "function",
        function: {
          name: "create_log",
          description: "Create a flare/symptom log entry from the user's text message",
          parameters: {
            type: "object",
            required: ["response", "entry_type"],
            properties: {
              response: { type: "string", description: "Reply to send back to user" },
              entry_type: { type: "string", enum: ["flare", "wellness", "activity"] },
              severity: { type: "string", enum: ["mild", "moderate", "severe"] },
              symptoms: { type: "array", items: { type: "string" } },
              triggers: { type: "array", items: { type: "string" } },
              note: { type: "string" },
              energy_level: { type: "string", enum: ["low", "medium", "high"] },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "log_medication",
          description: "Log that the user took a medication",
          parameters: {
            type: "object",
            required: ["response", "medication_name"],
            properties: {
              response: { type: "string" },
              medication_name: { type: "string" },
              dosage: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "respond_only",
          description: "Just respond to the user without creating any log",
          parameters: {
            type: "object",
            required: ["response"],
            properties: {
              response: { type: "string" },
            },
          },
        },
      },
    ];

    // ═══ Call AI ═══
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: messageBody },
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: aiMessages, tools, temperature: 0.7 }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      await sendSMS(TELNYX_API_KEY, TELNYX_PHONE_NUMBER, fromPhone,
        "Sorry, I'm having a moment 😅 Try again in a sec!");
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let replyText = "Got it! 💜";

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        replyText = parsed.response || replyText;

        if (toolCall.function.name === "create_log") {
          // Create flare entry
          await supabase.from("flare_entries").insert({
            user_id: userId,
            entry_type: parsed.entry_type || "flare",
            severity: parsed.severity || null,
            symptoms: parsed.symptoms || [],
            triggers: parsed.triggers || [],
            note: parsed.note || `[via SMS] ${messageBody}`,
            energy_level: parsed.energy_level || null,
            timestamp: new Date().toISOString(),
          });

          // Update engagement
          const today = new Date().toISOString().split('T')[0];
          if (engagement) {
            const lastLog = engagement.last_log_date;
            const yesterday = new Date(Date.now() - oneDay).toISOString().split('T')[0];
            const newStreak = lastLog === yesterday ? (engagement.current_streak || 0) + 1 :
                             lastLog === today ? (engagement.current_streak || 0) : 1;
            await supabase.from("engagement").update({
              current_streak: newStreak,
              longest_streak: Math.max(newStreak, engagement.longest_streak || 0),
              last_log_date: today,
              total_logs: (engagement.total_logs || 0) + 1,
            }).eq("user_id", userId);
          }
        } else if (toolCall.function.name === "log_medication") {
          await supabase.from("medication_logs").insert({
            user_id: userId,
            medication_name: parsed.medication_name,
            dosage: parsed.dosage || "standard",
            taken_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error("Tool parse error:", e);
      }
    } else {
      // Fallback: plain text response
      replyText = aiData.choices?.[0]?.message?.content || replyText;
    }

    // Strip any markdown from response (SMS is plain text)
    replyText = replyText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,3}\s/g, '').trim();

    // Save outbound message
    await supabase.from("sms_conversations").insert({
      user_id: userId,
      phone_number: normalizedPhone,
      role: "assistant",
      content: replyText,
    });

    // Send SMS via Telnyx
    await sendSMS(TELNYX_API_KEY, TELNYX_PHONE_NUMBER, fromPhone, replyText);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("SMS webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendSMS(apiKey: string, from: string, to: string, text: string) {
  // Split long messages (SMS limit ~160 chars, but Telnyx handles concatenation up to 1600)
  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      text,
      type: "SMS",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Telnyx send error:", response.status, errText);
    throw new Error(`Telnyx error: ${response.status}`);
  }

  return await response.json();
}
