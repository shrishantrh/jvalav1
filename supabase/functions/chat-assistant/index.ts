import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "mild" | "moderate" | "severe";

type ChatRequest = {
  message: string;
  userSymptoms?: string[];
  userConditions?: string[];
  history?: { role: "user" | "assistant"; content: string }[];
  userId?: string;
};

type AssistantReply = {
  response: string;
  shouldLog: boolean;
  entryData: null | {
    type: "flare" | "medication" | "trigger" | "recovery" | "energy" | "note";
    severity?: Severity;
    symptoms?: string[];
    medications?: string[];
    triggers?: string[];
  };
  visualization: null | {
    type: string;
    title: string;
    data: any[];
    insight?: string;
  };
};

const replyJson = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clampStr = (v: unknown, max = 2000) => {
  const s = typeof v === "string" ? v : String(v ?? "");
  return s.length > max ? s.slice(0, max) : s;
};

const asNum = (v: any): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

const quantiles = (arr: number[]) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const pick = (p: number) => {
    const idx = Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))));
    return s[idx];
  };
  return { min: s[0], p25: pick(0.25), median: pick(0.5), p75: pick(0.75), max: s[s.length - 1] };
};

const severityToScore = (sev: string | null): number | null => {
  if (!sev) return null;
  if (sev === "mild") return 1;
  if (sev === "moderate") return 2;
  if (sev === "severe") return 3;
  return null;
};

const isGreeting = (m: string) =>
  /^(hi|hello|hey|yo|sup|good (morning|afternoon|evening)|morning|afternoon|evening)\b/i.test(
    m.trim(),
  );

const wantsPatterns = (m: string) =>
  /\b(patterns?|trends?|insights?|what (do you|are you) seeing|correlation|correlate)\b/i.test(m);

const wantsCause = (m: string) =>
  /\b(cause|causing|triggering|why|what triggers)\b/i.test(m);

const wantsBodyMetrics = (m: string) =>
  /\b(body metrics|wearable|heart ?rate|hrv|sleep|steps|spo2|blood oxygen|temperature|stress|physio)\b/i.test(
    m,
  );

const wantsMedication = (m: string) => /\b(med(s)?|medication|ibuprofen|tylenol|advil|dose|dosage)\b/i.test(m);

function extractMetric(p: any, key: string): number | null {
  // Tries a few likely locations; keep robust without assuming exact device schema.
  // This is intentionally conservative: we only use numeric values.
  switch (key) {
    case "hr":
      return (
        asNum(p?.heartRate?.current) ??
        asNum(p?.heartRate?.resting) ??
        asNum(p?.vitals?.heartRate) ??
        asNum(p?.activity?.heartRate)
      );
    case "hrv":
      return asNum(p?.hrv?.current) ?? asNum(p?.hrv?.daily) ?? asNum(p?.vitals?.hrv);
    case "sleep_hours": {
      const d = asNum(p?.sleep?.duration);
      if (d == null) return null;
      // If duration seems like seconds/minutes, attempt simple normalization.
      if (d > 24 * 60) return d / 3600; // seconds
      if (d > 24) return d / 60; // minutes
      return d; // already hours
    }
    case "steps":
      return asNum(p?.activity?.steps) ?? asNum(p?.steps);
    case "spo2":
      return asNum(p?.bloodOxygen?.current) ?? asNum(p?.bloodOxygen?.avg) ?? asNum(p?.vitals?.spo2);
    case "stress":
      return asNum(p?.stress?.level) ?? asNum(p?.stress);
    case "temp":
      return asNum(p?.temperature?.skin) ?? asNum(p?.temperature?.core) ?? asNum(p?.vitals?.temperature);
    default:
      return null;
  }
}

function computeBodyMetrics(entries: any[]) {
  const withPhysio = entries.filter((e) => e?.physiological_data);
  const flaresWithPhysio = withPhysio.filter((e) => e?.entry_type === "flare");

  const collect = (subset: any[]) => {
    const hr: number[] = [];
    const hrv: number[] = [];
    const sleep: number[] = [];
    const steps: number[] = [];
    const spo2: number[] = [];
    const stress: number[] = [];
    const temp: number[] = [];

    for (const e of subset) {
      const p = e.physiological_data;
      const vHr = extractMetric(p, "hr");
      const vHrv = extractMetric(p, "hrv");
      const vSleep = extractMetric(p, "sleep_hours");
      const vSteps = extractMetric(p, "steps");
      const vSpo2 = extractMetric(p, "spo2");
      const vStress = extractMetric(p, "stress");
      const vTemp = extractMetric(p, "temp");

      if (vHr != null) hr.push(vHr);
      if (vHrv != null) hrv.push(vHrv);
      if (vSleep != null) sleep.push(vSleep);
      if (vSteps != null) steps.push(vSteps);
      if (vSpo2 != null) spo2.push(vSpo2);
      if (vStress != null) stress.push(vStress);
      if (vTemp != null) temp.push(vTemp);
    }

    return {
      count: subset.length,
      hr: { avg: avg(hr), q: quantiles(hr) },
      hrv: { avg: avg(hrv), q: quantiles(hrv) },
      sleep_hours: { avg: avg(sleep), q: quantiles(sleep) },
      steps: { avg: avg(steps), q: quantiles(steps) },
      spo2: { avg: avg(spo2), q: quantiles(spo2) },
      stress: { avg: avg(stress), q: quantiles(stress) },
      temp: { avg: avg(temp), q: quantiles(temp) },
    };
  };

  const bySeverity = {
    mild: collect(flaresWithPhysio.filter((e) => e?.severity === "mild")),
    moderate: collect(flaresWithPhysio.filter((e) => e?.severity === "moderate")),
    severe: collect(flaresWithPhysio.filter((e) => e?.severity === "severe")),
  };

  return {
    hasWearableData: withPhysio.length > 0,
    flareEntriesWithWearableData: flaresWithPhysio.length,
    latestPhysio: withPhysio[0]?.physiological_data ?? null,
    overall: collect(flaresWithPhysio),
    bySeverity,
  };
}

function summarizeFlares(entries: any[]) {
  const flares = entries.filter((e) => e?.entry_type === "flare");
  const sevCounts: Record<string, number> = { mild: 0, moderate: 0, severe: 0, unknown: 0 };
  const symptomCounts: Record<string, number> = {};
  const triggerCounts: Record<string, number> = {};
  const hourBuckets: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const dayCounts: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weatherCounts: Record<string, number> = {};

  const sevScores: number[] = [];

  for (const e of flares) {
    const sev = (e?.severity as string | null) ?? null;
    if (sev === "mild" || sev === "moderate" || sev === "severe") sevCounts[sev]++;
    else sevCounts.unknown++;

    const score = severityToScore(sev);
    if (score != null) sevScores.push(score);

    for (const s of e?.symptoms ?? []) symptomCounts[s] = (symptomCounts[s] || 0) + 1;
    for (const t of e?.triggers ?? []) triggerCounts[t] = (triggerCounts[t] || 0) + 1;

    const d = new Date(e.timestamp);
    const hour = d.getHours();
    if (hour >= 5 && hour < 12) hourBuckets.morning++;
    else if (hour >= 12 && hour < 17) hourBuckets.afternoon++;
    else if (hour >= 17 && hour < 21) hourBuckets.evening++;
    else hourBuckets.night++;

    dayCounts[days[d.getDay()]]++;

    const w = e?.environmental_data?.weather?.condition || e?.environmental_data?.condition;
    if (typeof w === "string" && w.trim()) weatherCounts[w] = (weatherCounts[w] || 0) + 1;
  }

  const top = (obj: Record<string, number>, n = 5) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }));

  const lastFlare = flares[0];
  const daysSinceLast = lastFlare
    ? Math.floor((Date.now() - new Date(lastFlare.timestamp).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    flareCount: flares.length,
    severityCounts: sevCounts,
    avgSeverity: avg(sevScores),
    daysSinceLast,
    topSymptoms: top(symptomCounts, 8),
    topTriggers: top(triggerCounts, 8),
    hourBuckets,
    dayCounts,
    topWeather: top(weatherCounts, 6),
  };
}

function buildDeterministicAnswer({
  message,
  flareSummary,
  bodyMetrics,
  correlations,
  medLogs,
}: {
  message: string;
  flareSummary: ReturnType<typeof summarizeFlares>;
  bodyMetrics: ReturnType<typeof computeBodyMetrics>;
  correlations: any[];
  medLogs: any[];
}): AssistantReply | null {
  const m = message.toLowerCase();

  // Hard deterministic answers for the "top failure modes": patterns, causes, body metrics, meds.
  if (wantsBodyMetrics(m)) {
    if (!bodyMetrics.hasWearableData || bodyMetrics.flareEntriesWithWearableData === 0) {
      return {
        response:
          "You don't have wearable/body metrics attached to your flare logs yet. Connect a wearable in Settings → Wearables, then your flares will include heart rate, HRV, sleep, steps, etc.",
        shouldLog: false,
        entryData: null,
        visualization: null,
      };
    }

    const o = bodyMetrics.overall;
    const hr = o.hr.avg != null ? `${o.hr.avg.toFixed(0)} bpm` : "N/A";
    const hrv = o.hrv.avg != null ? `${o.hrv.avg.toFixed(0)} ms` : "N/A";
    const sleep = o.sleep_hours.avg != null ? `${o.sleep_hours.avg.toFixed(1)} h` : "N/A";

    const severeHr = bodyMetrics.bySeverity.severe.hr.avg;
    const mildHr = bodyMetrics.bySeverity.mild.hr.avg;
    let hrCompare = "";
    if (severeHr != null && mildHr != null) {
      const diff = severeHr - mildHr;
      const sign = diff >= 0 ? "+" : "";
      hrCompare = ` Severe flares average ${severeHr.toFixed(0)} bpm vs mild ${mildHr.toFixed(0)} bpm (${sign}${diff.toFixed(0)} bpm).`;
    }

    const data = [
      { name: "HR (avg)", value: o.hr.avg ?? null },
      { name: "HRV (avg)", value: o.hrv.avg ?? null },
      { name: "Sleep (avg h)", value: o.sleep_hours.avg ?? null },
      { name: "Steps (avg)", value: o.steps.avg ?? null },
      { name: "SpO2 (avg)", value: o.spo2.avg ?? null },
      { name: "Stress (avg)", value: o.stress.avg ?? null },
      { name: "Temp (avg)", value: o.temp.avg ?? null },
    ].filter((x) => x.value != null);

    return {
      response: `During flares (from ${o.count} flare entries with wearable data), your average HR is ${hr}, HRV is ${hrv}, and average sleep is ${sleep}.${hrCompare}`.trim(),
      shouldLog: false,
      entryData: null,
      visualization: {
        type: "physiological_overview",
        title: "Body metrics during flares",
        data,
        insight: "These values are computed directly from your logged wearable data attached to flare entries.",
      },
    };
  }

  if (wantsMedication(m)) {
    if (!medLogs.length) {
      return {
        response: "I don't see any medication logs yet. If you tell me what you took, I can log it and then track patterns.",
        shouldLog: false,
        entryData: null,
        visualization: null,
      };
    }

    const counts: Record<string, number> = {};
    for (const l of medLogs) counts[l.medication_name] = (counts[l.medication_name] || 0) + 1;
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ medication: name, count }));

    const recent = medLogs.slice(0, 8).map((l) => ({
      medication: l.medication_name,
      date: new Date(l.taken_at).toLocaleDateString(),
      time: new Date(l.taken_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      dosage: l.dosage ?? "standard",
    }));

    return {
      response: `Here's your medication history summary: ${top
        .slice(0, 3)
        .map((t) => `${t.medication} (${t.count}x)`)
        .join(", ")}. Want me to compare your flare severity on days you took these vs days you didn't?`,
      shouldLog: false,
      entryData: null,
      visualization: {
        type: "medication_log",
        title: "Recent medication logs",
        data: recent,
        insight: "If you log meds consistently, I can compute before/after flare comparisons.",
      },
    };
  }

  if (wantsPatterns(m)) {
    const topSym = flareSummary.topSymptoms.slice(0, 5).map((s) => `${s.name} (${s.count}x)`);
    const topTrig = flareSummary.topTriggers.slice(0, 5).map((t) => `${t.name} (${t.count}x)`);
    const topWeather = flareSummary.topWeather.slice(0, 4).map((w) => `${w.name} (${w.count}x)`);

    const bestDay = Object.entries(flareSummary.dayCounts).sort((a, b) => b[1] - a[1])[0];
    const bestTime = Object.entries(flareSummary.hourBuckets).sort((a, b) => b[1] - a[1])[0];

    const corrTop = (correlations || [])
      .slice(0, 5)
      .map((c) => `${c.trigger_type}:${c.trigger_value} → ${c.outcome_type}:${c.outcome_value}`);

    const insights: string[] = [];
    if (bestTime?.[1] > 0) insights.push(`Most flares happen in the ${bestTime[0]} (${bestTime[1]}x).`);
    if (bestDay?.[1] > 0) insights.push(`Top day is ${bestDay[0]} (${bestDay[1]}x).`);
    if (topWeather.length) insights.push(`Most common weather: ${topWeather.slice(0, 2).join(", ")}.`);
    if (corrTop.length) insights.push(`Top correlations: ${corrTop.slice(0, 2).join("; ")}.`);

    return {
      response: `Patterns from your recent flares: ${insights.join(" ")} Top symptoms: ${topSym.join(", ") || "none logged"}. Top triggers: ${topTrig.join(", ") || "none logged"}.`,
      shouldLog: false,
      entryData: null,
      visualization: {
        type: "pattern_summary",
        title: "Patterns summary",
        data: [
          { label: "Total flares", value: flareSummary.flareCount },
          { label: "Avg severity", value: flareSummary.avgSeverity ? flareSummary.avgSeverity.toFixed(1) : "N/A" },
          { label: "Most common time", value: bestTime?.[0] ?? "N/A" },
          { label: "Most common day", value: bestDay?.[0] ?? "N/A" },
        ],
        insight: "Computed directly from your logged data (not guesswork).",
      },
    };
  }

  if (wantsCause(m)) {
    const topTrig = flareSummary.topTriggers.slice(0, 6);
    const topWeather = flareSummary.topWeather.slice(0, 4);

    const corrTop = (correlations || [])
      .slice(0, 8)
      .map((c) => ({
        trigger: `${c.trigger_type}:${c.trigger_value}`,
        outcome: `${c.outcome_type}:${c.outcome_value}`,
        confidence: c.confidence,
        count: c.occurrence_count,
      }));

    const messageParts: string[] = [];
    if (corrTop.length) {
      const best = corrTop[0];
      messageParts.push(
        `Your strongest correlation is ${best.trigger} → ${best.outcome} (seen ${best.count}x).`,
      );
    }

    if (topTrig.length) messageParts.push(`Most logged triggers: ${topTrig.map((t) => `${t.name} (${t.count}x)`).join(", ")}.`);
    if (topWeather.length) messageParts.push(`Common weather during flares: ${topWeather.map((w) => `${w.name} (${w.count}x)`).join(", ")}.`);

    if (!messageParts.length) {
      return {
        response:
          "Right now there isn't enough trigger/environment detail in your logs to identify a likely cause. If you start adding triggers (even 1–2 per flare), I can quantify what's most associated with your worst flares.",
        shouldLog: false,
        entryData: null,
        visualization: null,
      };
    }

    return {
      response: messageParts.join(" "),
      shouldLog: false,
      entryData: null,
      visualization: {
        type: "trigger_frequency",
        title: "Most common triggers",
        data: topTrig.map((t) => ({ name: t.name, count: t.count })),
        insight: "These are counts from your logs; correlations may strengthen as you log more triggers consistently.",
      },
    };
  }

  return null;
}

async function callModel({
  apiKey,
  system,
  history,
  userMessage,
}: {
  apiKey: string;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
}): Promise<AssistantReply> {
  const tools = [
    {
      type: "function",
      function: {
        name: "reply",
        description:
          "Return the assistant response and optional logging and visualization instructions.",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["response", "shouldLog", "entryData", "visualization"],
          properties: {
            response: { type: "string" },
            shouldLog: { type: "boolean" },
            entryData: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["type"],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["flare", "medication", "trigger", "recovery", "energy", "note"],
                    },
                    severity: { type: "string", enum: ["mild", "moderate", "severe"] },
                    symptoms: { type: "array", items: { type: "string" } },
                    medications: { type: "array", items: { type: "string" } },
                    triggers: { type: "array", items: { type: "string" } },
                  },
                },
              ],
            },
            visualization: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "title", "data"],
                  properties: {
                    type: { type: "string" },
                    title: { type: "string" },
                    data: { type: "array", items: {} },
                    insight: { type: "string" },
                  },
                },
              ],
            },
          },
        },
      },
    },
  ];

  const messages = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role, content: clampStr(m.content, 2000) })),
    { role: "user", content: clampStr(userMessage, 4000) },
  ];

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools,
      tool_choice: { type: "function", function: { name: "reply" } },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error:", resp.status, t);

    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI gateway error: ${resp.status}`);
  }

  const data = await resp.json();
  const msg = data.choices?.[0]?.message;

  // Prefer tool call output.
  const toolArgsStr = msg?.tool_calls?.[0]?.function?.arguments;
  if (toolArgsStr) {
    try {
      const parsed = JSON.parse(toolArgsStr);
      return {
        response: parsed.response || "OK.",
        shouldLog: Boolean(parsed.shouldLog),
        entryData: parsed.entryData ?? null,
        visualization: parsed.visualization ?? null,
      };
    } catch (e) {
      console.error("Failed to parse tool arguments:", e);
    }
  }

  // Fallback to plain content.
  const content = msg?.content;
  return {
    response: typeof content === "string" && content.trim() ? content : "OK.",
    shouldLog: false,
    entryData: null,
    visualization: null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, history = [], userId }: ChatRequest = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    if (!message || typeof message !== "string") return replyJson({ error: "Invalid message" }, 400);

    console.log("💬 chat-assistant message:", message);

    // If no userId, we can still answer generically (but we should ask for login in product UI).
    if (!userId) {
      const fallback: AssistantReply = {
        response:
          "I can help, but I'm missing your account context. Please sign in so I can use your logs, patterns, and wearable data.",
        shouldLog: false,
        entryData: null,
        visualization: null,
      };
      return replyJson(fallback);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const [{ data: profile }, { data: entries }, { data: medLogs }, { data: correlations }] =
      await Promise.all([
        supabase.from("profiles").select("id, full_name, conditions, known_symptoms, known_triggers, timezone").eq("id", userId).single(),
        supabase.from("flare_entries").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(150),
        supabase.from("medication_logs").select("*").eq("user_id", userId).order("taken_at", { ascending: false }).limit(150),
        supabase.from("correlations").select("*").eq("user_id", userId).order("confidence", { ascending: false }).limit(50),
      ]);

    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeMeds = Array.isArray(medLogs) ? medLogs : [];
    const safeCorr = Array.isArray(correlations) ? correlations : [];

    const flareSummary = summarizeFlares(safeEntries);
    const bodyMetrics = computeBodyMetrics(safeEntries);

    // Deterministic, data-first answers for common "stupid AI" failures.
    if (wantsBodyMetrics(message) || wantsPatterns(message) || wantsCause(message) || wantsMedication(message)) {
      const det = buildDeterministicAnswer({
        message,
        flareSummary,
        bodyMetrics,
        correlations: safeCorr,
        medLogs: safeMeds,
      });
      if (det) return replyJson(det);
    }

    // For everything else: tool-called reply but with compact, structured context.
    const system = `You are an intelligence layer for a health tracking app.

RULES:
- Use the provided USER DATA only; don't invent missing metrics.
- If data is missing, say what is missing and what to log/connect to answer next time.
- Prefer specific numbers and time windows.
- Do not refuse with "I don't know"; instead explain the limiting factor.

USER DATA (most recent):
- Name: ${profile?.full_name ?? ""}
- Conditions: ${(profile?.conditions ?? []).join(", ")}
- Known symptoms: ${(profile?.known_symptoms ?? []).join(", ")}
- Known triggers: ${(profile?.known_triggers ?? []).join(", ")}

FLARES:
- Total flares (last ${safeEntries.length} entries): ${flareSummary.flareCount}
- Severity: mild ${flareSummary.severityCounts.mild}, moderate ${flareSummary.severityCounts.moderate}, severe ${flareSummary.severityCounts.severe}
- Avg severity: ${flareSummary.avgSeverity ? flareSummary.avgSeverity.toFixed(1) : "N/A"}/3
- Days since last flare: ${flareSummary.daysSinceLast ?? "N/A"}
- Top symptoms: ${flareSummary.topSymptoms.slice(0, 6).map((s) => `${s.name}(${s.count})`).join(", ")}
- Top triggers: ${flareSummary.topTriggers.slice(0, 6).map((t) => `${t.name}(${t.count})`).join(", ")}
- Weather: ${flareSummary.topWeather.slice(0, 4).map((w) => `${w.name}(${w.count})`).join(", ")}

WEARABLE DATA:
- Has wearable data: ${bodyMetrics.hasWearableData}
- Flare entries with wearable data: ${bodyMetrics.flareEntriesWithWearableData}
- Wearable averages during flares (if present): HR ${bodyMetrics.overall.hr.avg != null ? bodyMetrics.overall.hr.avg.toFixed(0) : "N/A"}, HRV ${bodyMetrics.overall.hrv.avg != null ? bodyMetrics.overall.hrv.avg.toFixed(0) : "N/A"}, Sleep ${bodyMetrics.overall.sleep_hours.avg != null ? bodyMetrics.overall.sleep_hours.avg.toFixed(1) : "N/A"}

MEDICATION LOGS: ${safeMeds.length}
TOP CORRELATIONS: ${safeCorr.slice(0, 5).map((c) => `${c.trigger_type}:${c.trigger_value}→${c.outcome_type}:${c.outcome_value}`).join("; ")}`;

    let modelReply: AssistantReply;
    try {
      modelReply = await callModel({ apiKey, system, history, userMessage: message });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Unknown";
      if (err === "RATE_LIMIT") return replyJson({ error: "Rate limit exceeded. Try again in a moment." }, 429);
      if (err === "CREDITS_EXHAUSTED") return replyJson({ error: "AI credits exhausted. Please try again later." }, 402);
      throw e;
    }

    // Last line of defense: never return an empty answer.
    if (!modelReply.response || !modelReply.response.trim()) {
      modelReply.response = "Tell me what you want to figure out (patterns, triggers, meds, or body metrics) and I'll pull it from your logs.";
    }

    return replyJson(modelReply);
  } catch (error) {
    console.error("❌ chat-assistant error:", error);
    return replyJson({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
