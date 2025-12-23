import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "mild" | "moderate" | "severe";

type EntryData = {
  type: "flare" | "medication" | "trigger" | "recovery" | "energy" | "note";
  severity?: Severity;
  symptoms?: string[];
  medications?: string[];
  triggers?: string[];
};

type Visualization = {
  type: string;
  title: string;
  data: any[];
  insight?: string;
};

type AssistantReply = {
  response: string;
  shouldLog: boolean;
  entryData: EntryData | null;
  visualization: Visualization | null;
  confidence?: number;
  evidenceSources?: string[];
  suggestedFollowUp?: string;
};

type ChatRequest = {
  message: string;
  userSymptoms?: string[];
  userConditions?: string[];
  history?: { role: "user" | "assistant"; content: string }[];
  userId?: string;
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
  const pick = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
  return { min: s[0], p25: pick(0.25), median: pick(0.5), p75: pick(0.75), max: s[s.length - 1] };
};

const severityToScore = (sev: string | null): number | null => {
  if (!sev) return null;
  if (sev === "mild") return 1;
  if (sev === "moderate") return 2;
  if (sev === "severe") return 3;
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM & TRIGGER EXTRACTION (deterministic)
// ─────────────────────────────────────────────────────────────────────────────
const COMMON_SYMPTOMS = [
  "headache", "migraine", "dizziness", "dizzy", "fatigue", "tired", "exhausted",
  "nausea", "nauseous", "pain", "ache", "aching", "stiff", "stiffness",
  "brain fog", "foggy", "confusion", "confused", "anxiety", "anxious",
  "joint pain", "muscle pain", "back pain", "neck pain", "stomach pain",
  "bloating", "cramping", "cramps", "inflammation", "swelling", "swollen",
  "sensitivity", "light sensitivity", "sound sensitivity", "insomnia",
  "trouble sleeping", "hot flash", "chills", "fever", "rash", "itching",
  "numbness", "tingling", "weakness", "tremor", "palpitations", "shortness of breath",
  "chest tightness", "blurred vision", "dry eyes", "tinnitus", "vertigo",
  "depression", "mood swings", "irritability", "crying", "restless",
];

const COMMON_TRIGGERS = [
  "stress", "stressed", "anxiety", "lack of sleep", "poor sleep", "bad sleep",
  "alcohol", "caffeine", "coffee", "sugar", "processed food", "gluten", "dairy",
  "weather", "weather change", "barometric pressure", "humidity", "heat", "cold",
  "bright light", "loud noise", "strong smell", "perfume", "smoke",
  "exercise", "overexertion", "sitting too long", "travel", "flying",
  "hormones", "period", "menstruation", "ovulation", "dehydration",
  "skipped meal", "fasting", "overwork", "screen time", "late night",
];

const COMMON_MEDICATIONS = [
  "ibuprofen", "advil", "motrin", "tylenol", "acetaminophen", "aspirin",
  "naproxen", "aleve", "excedrin", "sumatriptan", "imitrex", "rizatriptan",
  "maxalt", "zolmitriptan", "zomig", "topiramate", "topamax", "amitriptyline",
  "propranolol", "metoprolol", "gabapentin", "pregabalin", "lyrica",
  "prednisone", "steroids", "antihistamine", "benadryl", "zyrtec", "claritin",
  "melatonin", "magnesium", "b2", "riboflavin", "coq10", "butterbur",
  "cbd", "thc", "cannabis", "marijuana", "zofran", "ondansetron",
];

function extractSymptoms(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const s of COMMON_SYMPTOMS) {
    if (lower.includes(s)) {
      // Normalize to title case
      found.push(s.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" "));
    }
  }
  return [...new Set(found)];
}

function extractTriggers(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const t of COMMON_TRIGGERS) {
    if (lower.includes(t)) {
      found.push(t.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" "));
    }
  }
  return [...new Set(found)];
}

function extractMedications(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const m of COMMON_MEDICATIONS) {
    if (lower.includes(m)) {
      found.push(m.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" "));
    }
  }
  return [...new Set(found)];
}

function detectSeverity(text: string): Severity | null {
  const lower = text.toLowerCase();
  const severeWords = ["severe", "terrible", "awful", "worst", "unbearable", "excruciating", "intense", "10/10", "9/10", "8/10", "really bad", "so bad", "horrible", "debilitating"];
  const moderateWords = ["moderate", "bad", "significant", "noticeable", "uncomfortable", "7/10", "6/10", "5/10", "medium", "not great"];
  const mildWords = ["mild", "slight", "little", "minor", "small", "light", "1/10", "2/10", "3/10", "4/10", "manageable", "tolerable"];

  for (const w of severeWords) if (lower.includes(w)) return "severe";
  for (const w of moderateWords) if (lower.includes(w)) return "moderate";
  for (const w of mildWords) if (lower.includes(w)) return "mild";
  return null;
}

function isReportingSymptom(text: string): boolean {
  const lower = text.toLowerCase();
  const reportPhrases = [
    "i have", "i'm having", "i am having", "i've got", "i got",
    "feeling", "i feel", "experiencing", "suffering", "dealing with",
    "my head", "my neck", "my back", "my stomach", "my joints",
    "woke up with", "started having", "been having", "hurts", "aching",
  ];
  return reportPhrases.some(p => lower.includes(p)) || extractSymptoms(text).length > 0;
}

function isMedicationReport(text: string): boolean {
  const lower = text.toLowerCase();
  const phrases = ["took", "taking", "just had", "popped", "used", "applied", "started"];
  return phrases.some(p => lower.includes(p)) && extractMedications(text).length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────
const isGreeting = (m: string) =>
  /^(hi|hello|hey|yo|sup|good (morning|afternoon|evening)|morning|afternoon|evening)\b/i.test(m.trim());

const wantsPatterns = (m: string) =>
  /\b(patterns?|trends?|insights?|what (do you|are you) seeing|correlation|correlate|analyze|analysis)\b/i.test(m);

const wantsCause = (m: string) =>
  /\b(cause|causing|triggering|why|what triggers|what's causing|whats causing)\b/i.test(m);

const wantsBodyMetrics = (m: string) =>
  /\b(body metrics|wearable|heart ?rate|hrv|sleep|steps|spo2|blood oxygen|temperature|stress|physio|biometrics|vitals)\b/i.test(m);

const wantsMedication = (m: string) =>
  /\b(med(s)?|medication|drug|prescription|ibuprofen|tylenol|advil|dose|dosage|pill|pills|treatment)\b/i.test(m);

const wantsComparison = (m: string) =>
  /\b(compar|vs|versus|this week|last week|this month|last month|better|worse|improvement|progress)\b/i.test(m);

const wantsRecommendation = (m: string) =>
  /\b(recommend|suggestion|advice|should i|what can i|help me|tips?|how (can|do) i)\b/i.test(m);

const wantsFlareHistory = (m: string) =>
  /\b(history|recent|last|previous|past|when did|how many|count|total|all my)\b/i.test(m);

const wantsSeverityInfo = (m: string) =>
  /\b(severity|severe|mild|moderate|how bad|worst|intensity)\b/i.test(m);

const wantsTimeAnalysis = (m: string) =>
  /\b(time|when|morning|afternoon|evening|night|day of week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend)\b/i.test(m);

const wantsWeatherAnalysis = (m: string) =>
  /\b(weather|rain|sunny|cloudy|overcast|humidity|pressure|barometric|temperature|hot|cold|climate)\b/i.test(m);

// ─────────────────────────────────────────────────────────────────────────────
// WEARABLE/PHYSIOLOGICAL DATA EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
function extractMetric(p: any, key: string): number | null {
  switch (key) {
    case "hr":
      return asNum(p?.heartRate?.current) ?? asNum(p?.heartRate?.resting) ?? asNum(p?.vitals?.heartRate) ?? asNum(p?.activity?.heartRate);
    case "hrv":
      return asNum(p?.hrv?.current) ?? asNum(p?.hrv?.daily) ?? asNum(p?.vitals?.hrv);
    case "sleep_hours": {
      const d = asNum(p?.sleep?.duration);
      if (d == null) return null;
      if (d > 24 * 60) return d / 3600;
      if (d > 24) return d / 60;
      return d;
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
    const hr: number[] = [], hrv: number[] = [], sleep: number[] = [], steps: number[] = [];
    const spo2: number[] = [], stress: number[] = [], temp: number[] = [];

    for (const e of subset) {
      const p = e.physiological_data;
      const vHr = extractMetric(p, "hr"); if (vHr != null) hr.push(vHr);
      const vHrv = extractMetric(p, "hrv"); if (vHrv != null) hrv.push(vHrv);
      const vSleep = extractMetric(p, "sleep_hours"); if (vSleep != null) sleep.push(vSleep);
      const vSteps = extractMetric(p, "steps"); if (vSteps != null) steps.push(vSteps);
      const vSpo2 = extractMetric(p, "spo2"); if (vSpo2 != null) spo2.push(vSpo2);
      const vStress = extractMetric(p, "stress"); if (vStress != null) stress.push(vStress);
      const vTemp = extractMetric(p, "temp"); if (vTemp != null) temp.push(vTemp);
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

  return {
    hasWearableData: withPhysio.length > 0,
    flareEntriesWithWearableData: flaresWithPhysio.length,
    latestPhysio: withPhysio[0]?.physiological_data ?? null,
    overall: collect(flaresWithPhysio),
    bySeverity: {
      mild: collect(flaresWithPhysio.filter((e) => e?.severity === "mild")),
      moderate: collect(flaresWithPhysio.filter((e) => e?.severity === "moderate")),
      severe: collect(flaresWithPhysio.filter((e) => e?.severity === "severe")),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FLARE SUMMARIZATION
// ─────────────────────────────────────────────────────────────────────────────
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

  // Time-based analysis
  const thisWeekFlares: any[] = [];
  const lastWeekFlares: any[] = [];
  const thisMonthFlares: any[] = [];
  const lastMonthFlares: any[] = [];
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;

  for (const e of flares) {
    const sev = (e?.severity as string | null) ?? null;
    if (sev === "mild" || sev === "moderate" || sev === "severe") sevCounts[sev]++;
    else sevCounts.unknown++;

    const score = severityToScore(sev);
    if (score != null) sevScores.push(score);

    for (const s of e?.symptoms ?? []) symptomCounts[s] = (symptomCounts[s] || 0) + 1;
    for (const t of e?.triggers ?? []) triggerCounts[t] = (triggerCounts[t] || 0) + 1;

    const d = new Date(e.timestamp);
    const ts = d.getTime();
    const hour = d.getHours();
    if (hour >= 5 && hour < 12) hourBuckets.morning++;
    else if (hour >= 12 && hour < 17) hourBuckets.afternoon++;
    else if (hour >= 17 && hour < 21) hourBuckets.evening++;
    else hourBuckets.night++;

    dayCounts[days[d.getDay()]]++;

    const w = e?.environmental_data?.weather?.condition || e?.environmental_data?.condition;
    if (typeof w === "string" && w.trim()) weatherCounts[w] = (weatherCounts[w] || 0) + 1;

    // Time period buckets
    if (now - ts < oneWeek) thisWeekFlares.push(e);
    else if (now - ts < 2 * oneWeek) lastWeekFlares.push(e);

    const thisMonth = new Date().getMonth();
    const entryMonth = d.getMonth();
    if (entryMonth === thisMonth) thisMonthFlares.push(e);
    else if (entryMonth === (thisMonth - 1 + 12) % 12) lastMonthFlares.push(e);
  }

  const top = (obj: Record<string, number>, n = 5) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  const lastFlare = flares[0];
  const daysSinceLast = lastFlare ? Math.floor((now - new Date(lastFlare.timestamp).getTime()) / oneDay) : null;

  // Compute severity averages per time period
  const avgSevForList = (list: any[]) => {
    const scores = list.map(e => severityToScore(e?.severity)).filter((s): s is number => s != null);
    return avg(scores);
  };

  return {
    flareCount: flares.length,
    severityCounts: sevCounts,
    avgSeverity: avg(sevScores),
    daysSinceLast,
    topSymptoms: top(symptomCounts, 10),
    topTriggers: top(triggerCounts, 10),
    hourBuckets,
    dayCounts,
    topWeather: top(weatherCounts, 8),
    thisWeek: { count: thisWeekFlares.length, avgSeverity: avgSevForList(thisWeekFlares) },
    lastWeek: { count: lastWeekFlares.length, avgSeverity: avgSevForList(lastWeekFlares) },
    thisMonth: { count: thisMonthFlares.length, avgSeverity: avgSevForList(thisMonthFlares) },
    lastMonth: { count: lastMonthFlares.length, avgSeverity: avgSevForList(lastMonthFlares) },
    recentEntries: flares.slice(0, 10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC ANSWER BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function buildDeterministicAnswer({
  message,
  flareSummary,
  bodyMetrics,
  correlations,
  medLogs,
  profile,
}: {
  message: string;
  flareSummary: ReturnType<typeof summarizeFlares>;
  bodyMetrics: ReturnType<typeof computeBodyMetrics>;
  correlations: any[];
  medLogs: any[];
  profile: any;
}): AssistantReply | null {
  const m = message.toLowerCase();

  // ── SYMPTOM/MEDICATION REPORTING ──
  if (isMedicationReport(message)) {
    const meds = extractMedications(message);
    return {
      response: `Got it, logging ${meds.join(", ")}. Hope it helps! 💊`,
      shouldLog: true,
      entryData: { type: "medication", medications: meds },
      visualization: null,
      confidence: 0.95,
      evidenceSources: ["Text extraction"],
    };
  }

  if (isReportingSymptom(message) && !wantsPatterns(m) && !wantsCause(m)) {
    const symptoms = extractSymptoms(message);
    const triggers = extractTriggers(message);
    const severity = detectSeverity(message);
    const meds = extractMedications(message);

    if (symptoms.length > 0 || severity) {
      // Check if this symptom is common for them
      const userTopSymptoms = flareSummary.topSymptoms.slice(0, 5).map(s => s.name.toLowerCase());
      const matchingSymptom = symptoms.find(s => userTopSymptoms.includes(s.toLowerCase()));
      
      let context = "";
      if (matchingSymptom) {
        const match = flareSummary.topSymptoms.find(s => s.name.toLowerCase() === matchingSymptom.toLowerCase());
        if (match) context = ` That's your #${flareSummary.topSymptoms.indexOf(match) + 1} most common symptom (${match.count}x logged).`;
      }

      const sevText = severity ? ` Severity: ${severity}.` : "";
      const trigText = triggers.length ? ` Possible triggers: ${triggers.join(", ")}.` : "";

      return {
        response: `Logged: ${symptoms.join(", ") || severity + " flare"}.${context}${sevText}${trigText} Take care 💜`,
        shouldLog: true,
        entryData: {
          type: "flare",
          severity: severity ?? undefined,
          symptoms: symptoms.length ? symptoms : undefined,
          triggers: triggers.length ? triggers : undefined,
          medications: meds.length ? meds : undefined,
        },
        visualization: null,
        confidence: 0.9,
        evidenceSources: ["Text extraction", "Symptom matching"],
        suggestedFollowUp: triggers.length === 0 ? "Any idea what triggered this?" : undefined,
      };
    }
  }

  // ── BODY METRICS ──
  if (wantsBodyMetrics(m)) {
    if (!bodyMetrics.hasWearableData || bodyMetrics.flareEntriesWithWearableData === 0) {
      return {
        response: "No wearable data attached to your flares yet. Connect Fitbit, Oura, or Apple Watch in Settings → Wearables to track HR, HRV, sleep during flares.",
        shouldLog: false,
        entryData: null,
        visualization: null,
        confidence: 1.0,
        evidenceSources: ["Database check"],
      };
    }

    const o = bodyMetrics.overall;
    const hr = o.hr.avg != null ? `${o.hr.avg.toFixed(0)} bpm` : "N/A";
    const hrv = o.hrv.avg != null ? `${o.hrv.avg.toFixed(0)} ms` : "N/A";
    const sleep = o.sleep_hours.avg != null ? `${o.sleep_hours.avg.toFixed(1)} h` : "N/A";

    let hrCompare = "";
    const severeHr = bodyMetrics.bySeverity.severe.hr.avg;
    const mildHr = bodyMetrics.bySeverity.mild.hr.avg;
    if (severeHr != null && mildHr != null) {
      const diff = severeHr - mildHr;
      hrCompare = ` Severe flares: ${severeHr.toFixed(0)} bpm vs mild: ${mildHr.toFixed(0)} bpm.`;
    }

    const data = [
      { name: "HR (avg)", value: o.hr.avg },
      { name: "HRV (avg)", value: o.hrv.avg },
      { name: "Sleep (h)", value: o.sleep_hours.avg },
      { name: "Steps", value: o.steps.avg },
    ].filter(x => x.value != null);

    return {
      response: `From ${o.count} flares with wearable data: Avg HR ${hr}, HRV ${hrv}, sleep ${sleep}.${hrCompare}`,
      shouldLog: false,
      entryData: null,
      visualization: {
        type: "physiological_overview",
        title: "Body metrics during flares",
        data,
        insight: `Based on ${o.count} flare entries with wearable data.`,
      },
      confidence: o.count >= 10 ? 0.85 : o.count >= 5 ? 0.7 : 0.5,
      evidenceSources: [`${o.count} flare entries with wearable data`],
      suggestedFollowUp: o.count < 10 ? "Log more flares with your wearable connected for better accuracy." : undefined,
    };
  }

  // ── MEDICATION ANALYSIS ──
  if (wantsMedication(m) && !isMedicationReport(message)) {
    if (!medLogs.length) {
      return {
        response: "No medication logs yet. Tell me when you take something and I'll track it.",
        shouldLog: false,
        entryData: null,
        visualization: null,
        confidence: 1.0,
        evidenceSources: ["Database check"],
      };
    }

    const counts: Record<string, number> = {};
    for (const l of medLogs) counts[l.medication_name] = (counts[l.medication_name] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const recent = medLogs.slice(0, 8).map(l => ({
      medication: l.medication_name,
      date: new Date(l.taken_at).toLocaleDateString(),
      time: new Date(l.taken_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));

    return {
      response: `Your meds: ${top.slice(0, 4).map(([n, c]) => `${n} (${c}x)`).join(", ")}. Last taken: ${recent[0]?.medication} on ${recent[0]?.date}.`,
      shouldLog: false,
      entryData: null,
      visualization: { type: "medication_log", title: "Recent medications", data: recent, insight: `${medLogs.length} total medication logs.` },
      confidence: 0.95,
      evidenceSources: [`${medLogs.length} medication logs`],
    };
  }

  // ── COMPARISON (this week vs last week, etc.) ──
  if (wantsComparison(m)) {
    const tw = flareSummary.thisWeek;
    const lw = flareSummary.lastWeek;
    const tm = flareSummary.thisMonth;
    const lm = flareSummary.lastMonth;

    let compText = "";
    let vizData: any[] = [];

    if (m.includes("month")) {
      const diff = tm.count - lm.count;
      const trend = diff > 0 ? "more" : diff < 0 ? "fewer" : "same";
      compText = `This month: ${tm.count} flares (avg severity ${tm.avgSeverity?.toFixed(1) ?? "N/A"}). Last month: ${lm.count} flares. That's ${Math.abs(diff)} ${trend}.`;
      vizData = [
        { metric: "Flares", thisMonth: tm.count, lastMonth: lm.count },
        { metric: "Avg Severity", thisMonth: tm.avgSeverity ?? 0, lastMonth: lm.avgSeverity ?? 0 },
      ];
    } else {
      const diff = tw.count - lw.count;
      const trend = diff > 0 ? "more" : diff < 0 ? "fewer" : "same";
      compText = `This week: ${tw.count} flares (avg severity ${tw.avgSeverity?.toFixed(1) ?? "N/A"}). Last week: ${lw.count} flares. That's ${Math.abs(diff)} ${trend}.`;
      vizData = [
        { metric: "Flares", thisWeek: tw.count, lastWeek: lw.count },
        { metric: "Avg Severity", thisWeek: tw.avgSeverity ?? 0, lastWeek: lw.avgSeverity ?? 0 },
      ];
    }

    return {
      response: compText,
      shouldLog: false,
      entryData: null,
      visualization: { type: "comparative_analysis", title: "Period comparison", data: vizData },
      confidence: 0.9,
      evidenceSources: ["Flare entry timestamps"],
    };
  }

  // ── TIME OF DAY / DAY OF WEEK ──
  if (wantsTimeAnalysis(m)) {
    const bestTime = Object.entries(flareSummary.hourBuckets).sort((a, b) => b[1] - a[1])[0];
    const bestDay = Object.entries(flareSummary.dayCounts).sort((a, b) => b[1] - a[1])[0];

    const timeData = Object.entries(flareSummary.hourBuckets).map(([period, count]) => ({ period, count }));
    const dayData = Object.entries(flareSummary.dayCounts).map(([day, count]) => ({ name: day, count }));

    return {
      response: `Peak flare time: ${bestTime[0]} (${bestTime[1]}x). Worst day: ${bestDay[0]} (${bestDay[1]}x). Morning has ${flareSummary.hourBuckets.morning}, afternoon ${flareSummary.hourBuckets.afternoon}, evening ${flareSummary.hourBuckets.evening}, night ${flareSummary.hourBuckets.night}.`,
      shouldLog: false,
      entryData: null,
      visualization: { type: "time_of_day", title: "Flares by time of day", data: timeData, insight: `Based on ${flareSummary.flareCount} flares.` },
      confidence: flareSummary.flareCount >= 20 ? 0.85 : 0.6,
      evidenceSources: [`${flareSummary.flareCount} flare entries`],
    };
  }

  // ── WEATHER ──
  if (wantsWeatherAnalysis(m)) {
    if (!flareSummary.topWeather.length) {
      return {
        response: "No weather data attached to your flares. Make sure location is enabled when logging.",
        shouldLog: false,
        entryData: null,
        visualization: null,
        confidence: 1.0,
        evidenceSources: ["Database check"],
      };
    }

    const weatherData = flareSummary.topWeather.map(w => ({ name: w.name, count: w.count }));
    return {
      response: `Weather during flares: ${flareSummary.topWeather.slice(0, 4).map(w => `${w.name} (${w.count}x)`).join(", ")}.`,
      shouldLog: false,
      entryData: null,
      visualization: { type: "weather_correlation", title: "Weather during flares", data: weatherData },
      confidence: 0.8,
      evidenceSources: ["Environmental data from entries"],
    };
  }

  // ── PATTERNS ──
  if (wantsPatterns(m)) {
    const topSym = flareSummary.topSymptoms.slice(0, 5);
    const topTrig = flareSummary.topTriggers.slice(0, 5);
    const bestTime = Object.entries(flareSummary.hourBuckets).sort((a, b) => b[1] - a[1])[0];
    const bestDay = Object.entries(flareSummary.dayCounts).sort((a, b) => b[1] - a[1])[0];
    const corrTop = correlations.slice(0, 3);

    const insights: string[] = [];
    if (bestTime[1] > 0) insights.push(`${bestTime[0]} flares (${bestTime[1]}x)`);
    if (bestDay[1] > 0) insights.push(`${bestDay[0]}s (${bestDay[1]}x)`);
    if (topSym.length) insights.push(`Top symptom: ${topSym[0].name} (${topSym[0].count}x)`);
    if (topTrig.length) insights.push(`Top trigger: ${topTrig[0].name} (${topTrig[0].count}x)`);

    const vizData = [
      { label: "Total flares", value: flareSummary.flareCount },
      { label: "Avg severity", value: flareSummary.avgSeverity?.toFixed(1) ?? "N/A" },
      { label: "Peak time", value: bestTime[0] },
      { label: "Peak day", value: bestDay[0] },
    ];

    return {
      response: `Patterns: ${insights.join(". ")}. Correlations: ${corrTop.map(c => `${c.trigger_value}→${c.outcome_value}`).join(", ") || "logging more will reveal these"}.`,
      shouldLog: false,
      entryData: null,
      visualization: { type: "pattern_summary", title: "Your patterns", data: vizData, insight: `Based on ${flareSummary.flareCount} flares.` },
      confidence: flareSummary.flareCount >= 15 ? 0.8 : 0.5,
      evidenceSources: [`${flareSummary.flareCount} flare entries`, `${correlations.length} correlations`],
      suggestedFollowUp: flareSummary.flareCount < 15 ? "Keep logging - patterns get clearer with more data." : undefined,
    };
  }

  // ── CAUSES ──
  if (wantsCause(m)) {
    const topTrig = flareSummary.topTriggers.slice(0, 6);
    const corrTop = correlations.slice(0, 5);

    if (!topTrig.length && !corrTop.length) {
      return {
        response: "Not enough trigger data yet. Start logging what you did/ate/felt before flares and I'll find patterns.",
        shouldLog: false,
        entryData: null,
        visualization: null,
        confidence: 1.0,
        evidenceSources: ["Database check"],
        suggestedFollowUp: "What were you doing before your last flare?",
      };
    }

    const parts: string[] = [];
    if (corrTop.length) {
      parts.push(`Strongest correlation: ${corrTop[0].trigger_value} → ${corrTop[0].outcome_value} (${corrTop[0].occurrence_count}x).`);
    }
    if (topTrig.length) {
      parts.push(`Most logged triggers: ${topTrig.slice(0, 3).map(t => `${t.name} (${t.count}x)`).join(", ")}.`);
    }

    return {
      response: parts.join(" "),
      shouldLog: false,
      entryData: null,
      visualization: { type: "trigger_frequency", title: "Top triggers", data: topTrig.map(t => ({ name: t.name, count: t.count })) },
      confidence: corrTop.length >= 3 ? 0.8 : 0.6,
      evidenceSources: [`${topTrig.reduce((s, t) => s + t.count, 0)} trigger logs`, `${correlations.length} correlations`],
    };
  }

  // ── FLARE HISTORY ──
  if (wantsFlareHistory(m)) {
    const recent = flareSummary.recentEntries.slice(0, 10).map(e => ({
      date: new Date(e.timestamp).toLocaleDateString(),
      severity: e.severity || "unknown",
      symptoms: (e.symptoms || []).slice(0, 3).join(", "),
    }));

    return {
      response: `Last ${Math.min(flareSummary.flareCount, 10)} flares: ${recent.slice(0, 5).map(r => `${r.date} (${r.severity})`).join(", ")}. Total: ${flareSummary.flareCount} flares logged.`,
      shouldLog: false,
      entryData: null,
      visualization: { type: "timeline", title: "Recent flares", data: recent.map((r, i) => ({ date: r.date, value: severityToScore(r.severity) ?? 1 })) },
      confidence: 0.95,
      evidenceSources: [`${flareSummary.flareCount} flare entries`],
    };
  }

  // ── SEVERITY ──
  if (wantsSeverityInfo(m)) {
    const data = [
      { name: "Mild", value: flareSummary.severityCounts.mild, color: "hsl(42, 85%, 55%)" },
      { name: "Moderate", value: flareSummary.severityCounts.moderate, color: "hsl(25, 85%, 58%)" },
      { name: "Severe", value: flareSummary.severityCounts.severe, color: "hsl(355, 75%, 52%)" },
    ];

    return {
      response: `Severity breakdown: ${flareSummary.severityCounts.severe} severe, ${flareSummary.severityCounts.moderate} moderate, ${flareSummary.severityCounts.mild} mild. Average: ${flareSummary.avgSeverity?.toFixed(1) ?? "N/A"}/3.`,
      shouldLog: false,
      entryData: null,
      visualization: { type: "severity_breakdown", title: "Severity distribution", data },
      confidence: 0.95,
      evidenceSources: [`${flareSummary.flareCount} flare entries`],
    };
  }

  // ── RECOMMENDATIONS (basic) ──
  if (wantsRecommendation(m)) {
    const tips: string[] = [];
    
    if (flareSummary.topTriggers.length) {
      tips.push(`Avoid "${flareSummary.topTriggers[0].name}" - your top trigger (${flareSummary.topTriggers[0].count}x).`);
    }
    if (flareSummary.hourBuckets.morning > flareSummary.hourBuckets.evening) {
      tips.push("Your flares peak in the morning - consider preventive measures before bed or upon waking.");
    }
    if (bodyMetrics.hasWearableData && bodyMetrics.overall.sleep_hours.avg && bodyMetrics.overall.sleep_hours.avg < 7) {
      tips.push(`Your avg sleep is ${bodyMetrics.overall.sleep_hours.avg.toFixed(1)}h during flares - prioritizing sleep might help.`);
    }
    if (!tips.length) {
      tips.push("Keep logging consistently - the more data, the better recommendations I can give.");
    }

    return {
      response: tips.join(" "),
      shouldLog: false,
      entryData: null,
      visualization: null,
      confidence: 0.6,
      evidenceSources: ["Pattern analysis"],
      suggestedFollowUp: "Want me to dig deeper into any specific area?",
    };
  }

  // ── GREETING ──
  if (isGreeting(m)) {
    const daysSince = flareSummary.daysSinceLast;
    let greeting = "Hey! How are you feeling?";
    if (daysSince != null && daysSince === 0) greeting = "Hey! I see you logged something today. How are you now?";
    else if (daysSince != null && daysSince > 3) greeting = `Hey! It's been ${daysSince} days since your last log. How are you doing?`;

    return {
      response: greeting,
      shouldLog: false,
      entryData: null,
      visualization: null,
      confidence: 1.0,
      evidenceSources: [],
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODEL CALL WITH TOOL USE
// ─────────────────────────────────────────────────────────────────────────────
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
        description: "Return the assistant response with optional logging and visualization.",
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
                    type: { type: "string", enum: ["flare", "medication", "trigger", "recovery", "energy", "note"] },
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
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, tools, tool_choice: { type: "function", function: { name: "reply" } } }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error:", resp.status, t);
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI gateway error: ${resp.status}`);
  }

  const data = await resp.json();
  const toolArgsStr = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
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
      console.error("Failed to parse tool args:", e);
    }
  }

  const content = data.choices?.[0]?.message?.content;
  return { response: typeof content === "string" && content.trim() ? content : "OK.", shouldLog: false, entryData: null, visualization: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, history = [], userId }: ChatRequest = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    if (!message || typeof message !== "string") return replyJson({ error: "Invalid message" }, 400);

    console.log("💬 chat-assistant:", message);

    if (!userId) {
      return replyJson({
        response: "Please sign in so I can use your health data to help you.",
        shouldLog: false,
        entryData: null,
        visualization: null,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const [{ data: profile }, { data: entries }, { data: medLogs }, { data: correlations }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("flare_entries").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(200),
      supabase.from("medication_logs").select("*").eq("user_id", userId).order("taken_at", { ascending: false }).limit(200),
      supabase.from("correlations").select("*").eq("user_id", userId).order("confidence", { ascending: false }).limit(50),
    ]);

    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeMeds = Array.isArray(medLogs) ? medLogs : [];
    const safeCorr = Array.isArray(correlations) ? correlations : [];

    const flareSummary = summarizeFlares(safeEntries);
    const bodyMetrics = computeBodyMetrics(safeEntries);

    // Try deterministic answer first
    const det = buildDeterministicAnswer({ message, flareSummary, bodyMetrics, correlations: safeCorr, medLogs: safeMeds, profile });
    if (det) return replyJson(det);

    // Fallback to model
    const system = `You are a health assistant with the user's data. Be specific, use numbers. Never say "I don't know" - explain what's missing instead.

USER: ${profile?.full_name ?? "User"}
CONDITIONS: ${(profile?.conditions ?? []).join(", ")}
FLARES: ${flareSummary.flareCount} total, ${flareSummary.severityCounts.severe} severe, ${flareSummary.severityCounts.moderate} moderate, ${flareSummary.severityCounts.mild} mild
AVG SEVERITY: ${flareSummary.avgSeverity?.toFixed(1) ?? "N/A"}/3
TOP SYMPTOMS: ${flareSummary.topSymptoms.slice(0, 5).map(s => `${s.name}(${s.count})`).join(", ")}
TOP TRIGGERS: ${flareSummary.topTriggers.slice(0, 5).map(t => `${t.name}(${t.count})`).join(", ")}
HAS WEARABLE DATA: ${bodyMetrics.hasWearableData}
MEDICATIONS: ${safeMeds.length} logs
CORRELATIONS: ${safeCorr.slice(0, 3).map(c => `${c.trigger_value}→${c.outcome_value}`).join("; ")}`;

    let modelReply: AssistantReply;
    try {
      modelReply = await callModel({ apiKey, system, history, userMessage: message });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Unknown";
      if (err === "RATE_LIMIT") return replyJson({ error: "Rate limit. Try again shortly." }, 429);
      if (err === "CREDITS_EXHAUSTED") return replyJson({ error: "AI credits exhausted." }, 402);
      throw e;
    }

    if (!modelReply.response?.trim()) {
      modelReply.response = "I can help with patterns, triggers, body metrics, medications, or log symptoms. What do you need?";
    }

    return replyJson(modelReply);
  } catch (error) {
    console.error("❌ chat-assistant error:", error);
    return replyJson({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
