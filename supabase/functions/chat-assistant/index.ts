import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, getAIApiKey, getAIEndpointUrl } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const replyJson = (body: any, status = 200) =>
  new Response(JSON.stringify({ ok: body?.ok ?? status < 400, ...body }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clamp = (str: unknown, max = 2000): string => {
  const s = typeof str === "string" ? str : String(str ?? "");
  return s.length > max ? s.slice(0, max) : s;
};

const sevToNum = (s: string) => s === "mild" ? 1 : s === "moderate" ? 2 : s === "severe" ? 3 : 0;
const avg = (arr: number[]): number | null => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const median = (arr: number[]): number | null => { if (!arr.length) return null; const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
const stddev = (arr: number[]): number | null => { const a = avg(arr); if (a == null || arr.length < 2) return null; return Math.sqrt(arr.reduce((s,v) => s + (v-a)**2, 0) / arr.length); };
const formatNum = (n: number | null, d = 1): string => n == null ? "N/A" : d === 0 ? String(Math.round(n)) : n.toFixed(d);
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);
const pearson = (xs: number[], ys: number[]): number | null => {
  if (xs.length < 3 || xs.length !== ys.length) return null;
  const mx = avg(xs)!, my = avg(ys)!;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i]-mx, dy = ys[i]-my; num += dx*dy; dx2 += dx*dx; dy2 += dy*dy; }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
};
const ewma = (arr: number[], alpha = 0.3): number[] => {
  if (!arr.length) return [];
  const result = [arr[0]];
  for (let i = 1; i < arr.length; i++) result.push(alpha * arr[i] + (1 - alpha) * result[i - 1]);
  return result;
};
const cv = (arr: number[]): number | null => { const m = avg(arr); const s = stddev(arr); return m && s ? s / m : null; };
const percentile = (arr: number[], p: number): number | null => { if (!arr.length) return null; const s = [...arr].sort((a,b)=>a-b); const i = (p/100)*(s.length-1); const f = Math.floor(i); return f === i ? s[f] : s[f] + (s[f+1]-s[f])*(i-f); };
const linSlope = (ys: number[]): number | null => { if (ys.length < 3) return null; const n=ys.length; let sx=0,sy=0,sxy=0,sxx=0; for(let i=0;i<n;i++){sx+=i;sy+=ys[i];sxy+=i*ys[i];sxx+=i*i;} return (n*sxy-sx*sy)/(n*sxx-sx*sx); };
const roc = (arr: number[], window = 3): number | null => { if (arr.length < window + 1) return null; const recent = avg(arr.slice(-window))!; const prior = avg(arr.slice(-2*window, -window))!; return recent - prior; };
const entropy = (counts: number[]): number => { const total = counts.reduce((a,b)=>a+b,0); if (total === 0) return 0; return -counts.filter(c=>c>0).reduce((s,c)=>{const p=c/total;return s+p*Math.log2(p);},0); };
// #135 — Weighted moving average
const wma = (arr: number[]): number | null => { if (arr.length < 2) return null; const n = arr.length; let num = 0, den = 0; for (let i = 0; i < n; i++) { const w = i + 1; num += arr[i] * w; den += w; } return num / den; };
// #136 — Interquartile range
const iqr = (arr: number[]): number | null => { const q1 = percentile(arr, 25); const q3 = percentile(arr, 75); return q1 != null && q3 != null ? q3 - q1 : null; };
// #137 — Streak calculator (consecutive days meeting condition)
const calcStreak = (boolArr: boolean[]): number => { let max = 0, cur = 0; for (const v of boolArr) { if (v) { cur++; max = Math.max(max, cur); } else cur = 0; } return max; };
// #138 — Z-score calculation
const zScore = (val: number, mean: number, sd: number): number | null => sd === 0 ? null : (val - mean) / sd;
// #139 — Exponential decay weighting (recent entries matter more)
const decayWeight = (dayAge: number, halfLife = 7): number => Math.exp(-0.693 * dayAge / halfLife);
// #140 — Simple moving average
const sma = (arr: number[], window: number): number[] => { const result: number[] = []; for (let i = window - 1; i < arr.length; i++) { result.push(avg(arr.slice(i - window + 1, i + 1))!); } return result; };
// #167 — Kendall's tau rank correlation (more robust than Pearson for ordinal data)
const kendallTau = (xs: number[], ys: number[]): number | null => {
  if (xs.length < 4 || xs.length !== ys.length) return null;
  let conc = 0, disc = 0; const n = xs.length;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) {
    const dx = xs[i] - xs[j], dy = ys[i] - ys[j];
    if (dx * dy > 0) conc++; else if (dx * dy < 0) disc++;
  }
  return (conc - disc) / (n * (n - 1) / 2);
};
// #168 — Autocorrelation (does flare today predict flare tomorrow?)
const autocorrelation = (arr: number[], lag = 1): number | null => {
  if (arr.length < lag + 3) return null;
  const m = avg(arr)!;
  let num = 0, den = 0;
  for (let i = 0; i < arr.length - lag; i++) { num += (arr[i] - m) * (arr[i + lag] - m); den += (arr[i] - m) ** 2; }
  return den === 0 ? 0 : num / den;
};
// #169 — Exponential growth/decay detector
const growthRate = (arr: number[]): number | null => {
  if (arr.length < 3) return null;
  const pos = arr.filter(v => v > 0);
  if (pos.length < 3) return null;
  const logVals = pos.map(v => Math.log(v));
  return linSlope(logVals);
};
// #170 — Moving variance (detect volatility spikes)
const movingVariance = (arr: number[], w = 5): number[] => {
  const result: number[] = [];
  for (let i = w - 1; i < arr.length; i++) {
    const slice = arr.slice(i - w + 1, i + 1);
    const m = avg(slice)!;
    result.push(slice.reduce((s, v) => s + (v - m) ** 2, 0) / w);
  }
  return result;
};
// #171 — Cumulative sum for change-point detection
const cusum = (arr: number[]): { changePoint: number | null; magnitude: number } => {
  if (arr.length < 6) return { changePoint: null, magnitude: 0 };
  const m = avg(arr)!;
  let s = 0, maxS = 0, minS = 0, cpMax = 0, cpMin = 0;
  for (let i = 0; i < arr.length; i++) { s += arr[i] - m; if (s > maxS) { maxS = s; cpMax = i; } if (s < minS) { minS = s; cpMin = i; } }
  return maxS - minS > 0 ? { changePoint: maxS > -minS ? cpMax : cpMin, magnitude: Math.abs(maxS - minS) / arr.length } : { changePoint: null, magnitude: 0 };
};
// #172 — Runs test (are flare sequences random or patterned?)
const runsTest = (boolArr: boolean[]): { runs: number; expected: number; isRandom: boolean } => {
  if (boolArr.length < 5) return { runs: 0, expected: 0, isRandom: true };
  let runs = 1;
  for (let i = 1; i < boolArr.length; i++) if (boolArr[i] !== boolArr[i - 1]) runs++;
  const n1 = boolArr.filter(v => v).length, n0 = boolArr.length - n1;
  const expected = n1 > 0 && n0 > 0 ? 1 + (2 * n1 * n0) / (n1 + n0) : boolArr.length;
  return { runs, expected: Math.round(expected * 10) / 10, isRandom: Math.abs(runs - expected) < 2 };
};

// ─── Web search via Firecrawl ─────────────────────────────────────────────
async function searchWeb(query: string): Promise<{ results: Array<{ title: string; url: string; snippet: string }>; error?: string }> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return { results: [], error: "Not configured" };
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!r.ok) return { results: [], error: `${r.status}` };
    const d = await r.json();
    return { results: (d.data || []).map((x: any) => ({ title: x.title || "Source", url: x.url || "", snippet: (x.markdown || "").substring(0, 800) })) };
  } catch (e) { return { results: [], error: String(e) }; }
}

// ─── Expanded condition knowledge (35+ conditions) ────────────────────────
const CK: Record<string, [string, string]> = {
  'Asthma': ['Sleep disruption bidirectional. Peak 4-6AM. Triggers: cold/dry air, humidity>60%, AQI, GERD, stress, exercise. Barometric drops precede flares.', 'After meals(GERD), before exercise, weather changes, evening, spring/fall pollen'],
  'Migraine': ['Sleep #1 trigger (<6h/>9h). Threshold model: triggers stack. Dehydration, skipped meals, alcohol, aged cheese, MSG. HRV drops 12-24h before. Mg 400mg/day preventive.', 'After skipped meals, dehydration, after alcohol, pressure changes, cycle days 1-3/24-28'],
  'Eczema': ['Sleep loss impairs barrier. Triggers: humidity<30%, temp extremes, sweat, stress, wool, SLS. Hot showers strip lipids.', 'After shower, season changes, dry weather, stress, dairy/gluten, evening itch'],
  'Acne': ['Sleep loss→cortisol→sebum→breakouts 48-72h. Dairy(skim milk IGF-1), high-glycemic foods.', 'After dairy/sugar, post-exercise, bedtime skincare, cycle tracking, stress'],
  'Anxiety': ['Bidirectional with sleep (amygdala+60%). Caffeine>200mg worsens. HRV biomarker. Exercise=SSRIs for mild-mod. Blood sugar crashes mimic anxiety.', 'Morning, after caffeine, after meals(sugar), before social events, evening, after alcohol'],
  'IBS': ['Gut-brain axis. FODMAPs: onions,garlic,wheat,dairy,apples. Large meals=gastrocolic reflex. Caffeine→urgency.', 'After every meal(30-90min), morning bowels, FODMAP foods, stress, caffeine, cycle days'],
  'Lower Back Pain': ['Poor sleep→+50% pain sensitivity. Sedentary>6h dangerous. Cold/pressure drops increase stiffness.', 'After 2h+ sitting, morning stiffness, after exercise, weather changes, after lifting, evening'],
  'Fibromyalgia': ['Central sensitization. Sleep critical(alpha-wave intrusion 90%). Weather sensitivity. Exercise paradox.', 'Morning pain/fatigue, after sleep, weather changes, after activity(pacing), evening, stress'],
  'GERD': ['Nighttime worst. No eating 3h before bed. Coffee,chocolate,alcohol,spicy,citrus,fatty,mint. Left-side sleeping -75% reflux.', 'After every meal, before bed, after coffee/alcohol, after spicy/fatty, morning reflux'],
  'Diabetes': ['Postprandial spikes 60-90min. Dawn phenomenon 4-8AM. Exercise lowers glucose but intense can spike. Poor sleep=-25-30% insulin sensitivity.', 'Before/after every meal, morning fasting, post-exercise, before bed, after stress'],
  'Depression': ['Consistent wake time>sleep duration. Behavioral activation. Exercise releases BDNF. Mediterranean diet -30% risk.', 'Morning mood, mid-afternoon energy, evening reflection, after social events, meal regularity'],
  'PCOS': ['Insulin resistance 70-80%. Low-glycemic critical. 5% weight loss restores ovulation.', 'Meal tracking(glycemic), exercise, cycle tracking, stress, skin/hair, weight, energy'],
  'Allergies': ['Pollen highest 5-10AM. Priming effect. Cross-reactivity: birch→apples/carrots. Saline irrigation -30-40%.', 'Morning symptoms, after outdoor time, pollen/weather, indoor air, seasonal transitions'],
  'Cough': ['Can be viral, post-nasal drip, asthma-variant, GERD-related. Cold/dry air irritates airways. Hydration thins mucus.', 'After exercise, cold air, dusty environments, post-meals(GERD), morning, evening'],
  'Rheumatoid Arthritis': ['Morning stiffness>30min=active. Worst morning(IL-6 surge). Cold/pressure drops. Omega-3 3g/day.', 'Morning stiffness, after meals(inflammatory), weather changes, evening fatigue, medication timing'],
  'Endometriosis': ['Cyclical and non-cyclical pain. Anti-inflammatory diet helps. GI overlap 50-80%. Cycle mapping critical.', 'Cycle days 1-5/24-28, after meals(GI), post-exercise, evening pain, stress'],
  'Psoriasis': ['T-cell mediated. Stress #1. Alcohol worsens. Cold/dry flares. UV therapeutic.', 'After stress, cold/dry weather, after alcohol, illness onset, skin injury'],
  'Chronic Fatigue Syndrome': ['PEM 12-72h after exceeding threshold. Activity pacing critical. HR below anaerobic threshold.', 'Morning energy, activity pacing every 2h, post-activity(24-72h PEM), evening energy'],
  'Hypothyroidism': ['Levothyroxine empty stomach 30-60min before food. Calcium/iron/coffee reduce absorption.', 'Medication timing(morning empty stomach), energy, cold sensitivity, bowels, mood/brain fog'],
  'Lupus': ['UV triggers flares(60-80% photosensitive). SPF50+ always. Fatigue most debilitating.', 'Before sun exposure, morning fatigue, stress, illness onset, medication timing'],
  "Crohn's Disease": ['Avoid NSAIDs. Stress not a cause but worsens. Low-residue diet during flares. Vitamin B12/iron/D deficiency common.', 'After meals, morning urgency, after fatty/high-fiber, stress, post-NSAID, cold weather'],
  'Ulcerative Colitis': ['Left-sided most common. Probiotics as effective as mesalamine for maintenance. Nighttime symptoms=severe.', 'After meals, morning, stress, after dairy, nighttime urgency, seasonal transitions'],
  'Osteoarthritis': ['Weight: each 1lb lost = 4lb less knee load. Worst after inactivity(gelling). Humid+cold=worse.', 'Morning stiffness(short), after sitting, weather changes, after overuse, evening, stairs/hills'],
  'Insomnia': ['Sleep restriction therapy most effective. CBT-I > medication. Blue light 2h before bed. Core body temp must drop 1-2°F.', 'Bedtime routine, caffeine cutoff(2pm), evening stress, screen time, exercise timing'],
  'ADHD': ['Medication timing critical. Protein breakfast improves efficacy. Exercise 30min = methylphenidate. Screen time worsens.', 'Morning routine/medication, transitions between tasks, afternoon slump, evening wind-down, meal timing'],
  'Chronic Pain': ['Gate control theory. Cold therapy=acute, heat=chronic. Catastrophizing strongest predictor. Graded exposure.', 'Morning assessment, after activity, weather changes, stress, sleep quality, social isolation'],
  'Heart Disease': ['Resting HR >75=concern. HRV critical biomarker. Mediterranean diet gold standard. Omega-3 2-4g/day.', 'Morning vitals, post-exercise, stress, after meals, medication timing, sleep apnea screening'],
  'Hypertension': ['White coat effect +20-30mmHg. Home monitoring essential. DASH diet. Potassium 3500-5000mg/day. Sleep apnea in 50%.', 'Morning readings, post-exercise, stress, sodium intake, medication timing, alcohol'],
  'Gout': ['Uric acid >6.8mg/dL crystallizes. Purines: organ meats, shellfish, beer. Cherry extract 500mg 2x/day. Hydration critical.', 'After high-purine meals, after alcohol(especially beer), dehydration, morning, cold weather'],
  'Rosacea': ['Triggers: heat, sun, alcohol, spicy, stress. Demodex mites. Azelaic acid 15% effective. SPF critical.', 'After spicy/hot food, sun exposure, after alcohol, hot showers, stress, temperature changes'],
  'Tinnitus': ['Stress/anxiety amplifies perception. Masking sounds. TMJ in 30%. Caffeine controversial. Hearing loss correlation.', 'Quiet environments, stress, jaw clenching, after loud exposure, sleep time, caffeine'],
  'Vertigo': ['BPPV most common. Epley maneuver 80% effective. Vestibular migraine underdiagnosed. Avoid quick head turns.', 'Position changes, morning, after head movement, stress, menstrual cycle, dehydration'],
  'POTS': ['Tilt table diagnostic. Salt 5-10g/day + 2-3L water. Compression garments. Counter-maneuvers. Exercise recondition.', 'Standing up, morning, hot environments, after meals, prolonged standing, dehydration'],
  'Interstitial Cystitis': ['Bladder instillation. Avoid citrus/caffeine/alcohol/spicy. Stress exacerbates. Pelvic floor PT.', 'After trigger foods, stress, cold weather, sitting, bladder fullness, sexual activity'],
  'TMJ': ['Bruxism biggest factor. Stress-jaw tension link. Soft diet during flares. Moist heat.', 'Morning jaw pain, after stress, after chewing, teeth grinding, posture, cold weather'],
  "Raynaud's": ['Cold #1 trigger. Stress secondary. Layer extremities. Calcium channel blockers. Biofeedback effective.', 'Cold exposure, stress, air conditioning, holding cold objects, morning, winter'],
  'Ankylosing Spondylitis': ['HLA-B27 positive in 90%. Morning stiffness improves with activity. NSAIDs first-line. TNF inhibitors. Gut-joint axis.', 'Morning stiffness(>30min), after prolonged sitting, weather changes, stress, post-infection'],
  'Multiple Sclerosis': ['Heat sensitivity (Uhthoff phenomenon). Vitamin D critical. Fatigue #1 symptom. Stress precipitates relapses.', 'Heat exposure, stress, infection onset, fatigue tracking, cognitive fog, exercise tolerance'],
  'Celiac Disease': ['Strict gluten-free only treatment. Cross-contamination threshold ~10mg/day. Iron/B12/folate/calcium deficiency common.', 'After meals(gluten risk), dining out, energy levels, GI symptoms, skin changes'],
  'Hashimotos': ['TSH fluctuates. Selenium 200mcg may help. Gluten cross-reactivity. Stress worsens antibodies.', 'Morning energy, cold sensitivity, weight changes, mood, hair/skin, medication timing'],
  'Sjogrens Syndrome': ['Dryness hallmark. Hydroxychloroquine. Omega-3 for dry eyes. Fatigue management. Dental care critical.', 'Morning dryness, eye symptoms, fatigue, joint pain, dental issues, stress'],
};

// ─── Advanced data analysis ──────────────────────────────────────────────
function analyzeAllData(entries: any[], medLogs: any[], correlations: any[], discoveries: any[], foodLogs: any[], profile: any, userTz: string, activityLogs: any[], predLogs: any[] = []) {
  const now = Date.now();
  const oneDay = 86400000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;
  const flares = entries.filter((e: any) => e?.entry_type === "flare" || e?.severity);
  const totalFlares = flares.length;
  const sortedFlares = [...flares].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getLocalHour = (d: Date): number => {
    try {
      const p = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: userTz }).formatToParts(d);
      return parseInt(p.find(x => x.type === "hour")?.value || "0", 10);
    } catch { return d.getUTCHours(); }
  };
  const getLocalDay = (d: Date): string => {
    try { return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: userTz }).format(d); }
    catch { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]; }
  };
  const getTimeOfDay = (h: number) => h < 6 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
  const fmtDate = (d: Date) => { try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(d); } catch { return d.toLocaleDateString(); } };
  const getMonth = (d: Date): string => { try { return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: userTz }).format(d); } catch { return d.toLocaleDateString(); } };

  const sevCounts = { mild: 0, moderate: 0, severe: 0 };
  const sevScores: number[] = [];
  const symptomCounts: Record<string, number> = {};
  const triggerCounts: Record<string, number> = {};
  const hourCounts: number[] = Array(24).fill(0);
  const hourBuckets: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const dayCounts: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  const weatherData: Record<string, { count: number; severities: number[] }> = {};
  const cityCounts: Record<string, number> = {};

  const thisWeek = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneWeek);
  const lastWeek = flares.filter((e: any) => { const a = now - new Date(e.timestamp).getTime(); return a >= oneWeek && a < 2 * oneWeek; });
  const thisMonth = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneMonth);
  const lastMonth = flares.filter((e: any) => { const a = now - new Date(e.timestamp).getTime(); return a >= oneMonth && a < 2 * oneMonth; });

  const symptomPairs: Record<string, number> = {};
  const sevByTimeOfDay: Record<string, number[]> = { morning: [], afternoon: [], evening: [], night: [] };
  const sevByDay: Record<string, number[]> = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
  let weekendFlares = 0, weekdayFlares = 0;
  const durations: number[] = [];
  let multiSymptomCount = 0;
  const notesWithContent: string[] = [];
  const triggerPairs: Record<string, number> = {};
  const monthCounts: Record<string, number> = {};
  const symptomSeverity: Record<string, number[]> = {};
  const triggerSeverity: Record<string, number[]> = {};
  let nightFlares = 0;
  const durationBySev: Record<string, number[]> = { mild: [], moderate: [], severe: [] };
  let maxConsecutiveSevere = 0, currentConsecutiveSevere = 0;
  let firstHalfMonth = 0, secondHalfMonth = 0;
  const noteLengthVsSev: { length: number; severity: number }[] = [];
  const triggerDelays: Record<string, number[]> = {};
  const citySeverity: Record<string, number[]> = {};
  const mealToFlareDelays: number[] = [];
  let flaresWithPhotos = 0;
  let escalationWindows = 0;
  const recoveryTimes: number[] = [];
  const triggersBySevLevel: Record<string, Record<string, number>> = { mild: {}, moderate: {}, severe: {} };

  // #105 — Symptom-trigger co-occurrence matrix
  const symptomTriggerMatrix: Record<string, Record<string, number>> = {};
  // #106 — Severity by medication presence
  const sevWithMed: number[] = [], sevWithoutMed: number[] = [];
  // #107 — Flare burst detection (3+ flares in 12h)
  let flareBursts = 0;
  // #108 — Note sentiment tracking
  let negNotes = 0, posNotes = 0;
  // #109 — Time-to-next-flare after each severity level
  const timeToNextBySev: Record<string, number[]> = { mild: [], moderate: [], severe: [] };
  // #110 — Energy-severity correlation
  const energySevPairs: { energy: number; severity: number }[] = [];
  // #111 — Medication polypharmacy detection
  const dailyMedCounts: Record<string, number> = {};
  // #112 — Symptom persistence (same symptom appearing in consecutive flares)
  const symptomPersistence: Record<string, number> = {};
  // #113 — Weekend vs weekday severity
  const weekendSevs: number[] = [], weekdaySevs: number[] = [];

  for (const e of flares) {
    const sev = e?.severity as string;
    if (sev === "mild" || sev === "moderate" || sev === "severe") sevCounts[sev]++;
    const score = sevToNum(sev);
    if (score) sevScores.push(score);

    if (sev === "severe") { currentConsecutiveSevere++; maxConsecutiveSevere = Math.max(maxConsecutiveSevere, currentConsecutiveSevere); }
    else { currentConsecutiveSevere = 0; }
    
    if (e?.photos?.length) flaresWithPhotos++;
    
    // Medication presence tracking
    if (e?.medications?.length > 0) { if (score) sevWithMed.push(score); }
    else { if (score) sevWithoutMed.push(score); }
    
    // Energy-severity correlation
    if (e?.energy_level && score) {
      const eVal = e.energy_level === "high" ? 3 : e.energy_level === "medium" ? 2 : 1;
      energySevPairs.push({ energy: eVal, severity: score });
    }

    const symptoms = e?.symptoms ?? [];
    for (const s of symptoms) {
      symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      if (score) { if (!symptomSeverity[s]) symptomSeverity[s] = []; symptomSeverity[s].push(score); }
    }
    if (symptoms.length >= 2) {
      multiSymptomCount++;
      for (let i = 0; i < symptoms.length; i++) {
        for (let j = i+1; j < symptoms.length; j++) {
          const pair = [symptoms[i], symptoms[j]].sort().join(" + ");
          symptomPairs[pair] = (symptomPairs[pair] || 0) + 1;
        }
      }
    }
    
    const triggers = e?.triggers ?? [];
    for (const t of triggers) {
      triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      if (score) { if (!triggerSeverity[t]) triggerSeverity[t] = []; triggerSeverity[t].push(score); }
      if (sev && triggersBySevLevel[sev]) { triggersBySevLevel[sev][t] = (triggersBySevLevel[sev][t] || 0) + 1; }
    }
    if (triggers.length >= 2) {
      for (let i = 0; i < triggers.length; i++) {
        for (let j = i+1; j < triggers.length; j++) {
          const pair = [triggers[i], triggers[j]].sort().join(" + ");
          triggerPairs[pair] = (triggerPairs[pair] || 0) + 1;
        }
      }
    }

    // Symptom-trigger co-occurrence
    for (const t of triggers) {
      if (!symptomTriggerMatrix[t]) symptomTriggerMatrix[t] = {};
      for (const s of symptoms) {
        symptomTriggerMatrix[t][s] = (symptomTriggerMatrix[t][s] || 0) + 1;
      }
    }
    
    const d = new Date(e.timestamp);
    const h = getLocalHour(d);
    hourCounts[h]++;
    const tod = getTimeOfDay(h);
    hourBuckets[tod]++;
    if (score) sevByTimeOfDay[tod].push(score);
    if (h >= 22 || h < 5) nightFlares++;
    
    const dayKey = getLocalDay(d);
    if (dayCounts[dayKey] !== undefined) {
      dayCounts[dayKey]++;
      if (score) sevByDay[dayKey].push(score);
    }
    
    const isWeekend = dayKey === "Sat" || dayKey === "Sun";
    if (isWeekend) { weekendFlares++; if (score) weekendSevs.push(score); }
    else { weekdayFlares++; if (score) weekdaySevs.push(score); }
    
    const month = getMonth(d);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
    
    const dayOfMonth = d.getDate();
    if (dayOfMonth <= 15) firstHalfMonth++; else secondHalfMonth++;
    
    const w = e?.environmental_data?.weather?.condition || e?.environmental_data?.condition;
    if (typeof w === "string" && w.trim()) {
      if (!weatherData[w]) weatherData[w] = { count: 0, severities: [] };
      weatherData[w].count++;
      if (score) weatherData[w].severities.push(score);
    }
    
    if (e?.city) {
      cityCounts[e.city] = (cityCounts[e.city] || 0) + 1;
      if (score) { if (!citySeverity[e.city]) citySeverity[e.city] = []; citySeverity[e.city].push(score); }
    }
    if (e?.duration_minutes) {
      durations.push(e.duration_minutes);
      if (sev && durationBySev[sev]) durationBySev[sev].push(e.duration_minutes);
    }
    if (e?.note?.trim()) {
      notesWithContent.push(e.note);
      if (score) noteLengthVsSev.push({ length: e.note.length, severity: score });
      // Simple sentiment
      const lower = e.note.toLowerCase();
      if (/awful|terrible|horrible|worst|unbearable|excruciating|crying|miserable/.test(lower)) negNotes++;
      if (/better|improving|relieved|grateful|hopeful|manageable|progress/.test(lower)) posNotes++;
    }
  }

  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const energyEntries = entries.filter((e: any) => e?.energy_level);
  const energyMap: Record<string, number> = {};
  energyEntries.forEach((e: any) => { energyMap[e.energy_level] = (energyMap[e.energy_level] || 0) + 1; });

  // Escalation windows
  for (let i = 0; i < sortedFlares.length - 1; i++) {
    const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i+1].timestamp).getTime();
    if (gap < oneDay) {
      const s1 = sevToNum(sortedFlares[i+1].severity || ""), s2 = sevToNum(sortedFlares[i].severity || "");
      if (s2 > s1) escalationWindows++;
    }
  }

  // Recovery times from severe flares
  for (let i = 0; i < sortedFlares.length; i++) {
    if (sortedFlares[i].severity === "severe" && i > 0) {
      const gap = new Date(sortedFlares[i-1]?.timestamp || sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i].timestamp).getTime();
      if (gap > 0) recoveryTimes.push(Math.round(gap / 3600000));
    }
  }

  // Time-to-next by severity
  for (let i = 1; i < sortedFlares.length; i++) {
    const sev = sortedFlares[i].severity;
    if (sev && timeToNextBySev[sev]) {
      const gap = new Date(sortedFlares[i-1].timestamp).getTime() - new Date(sortedFlares[i].timestamp).getTime();
      if (gap > 0 && gap < 30 * oneDay) timeToNextBySev[sev].push(Math.round(gap / 3600000));
    }
  }

  // Flare bursts (3+ in 12h)
  for (let i = 0; i < sortedFlares.length - 2; i++) {
    const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i+2].timestamp).getTime();
    if (gap < 12 * 3600000) flareBursts++;
  }

  // Symptom persistence
  for (let i = 1; i < Math.min(sortedFlares.length, 30); i++) {
    const prev = sortedFlares[i-1]?.symptoms || [];
    const curr = sortedFlares[i]?.symptoms || [];
    for (const s of curr) {
      if (prev.includes(s)) symptomPersistence[s] = (symptomPersistence[s] || 0) + 1;
    }
  }

  // Polypharmacy detection
  for (const med of medLogs) {
    const day = new Date(med.taken_at).toISOString().split('T')[0];
    dailyMedCounts[day] = (dailyMedCounts[day] || 0) + 1;
  }
  const polypharmacyDays = Object.values(dailyMedCounts).filter(c => c >= 3).length;

  // Current flare-free streak
  let currentFlareFree = 0;
  if (sortedFlares.length > 0) {
    currentFlareFree = Math.floor((now - new Date(sortedFlares[0].timestamp).getTime()) / oneDay);
  }

  // Daily flares 30d with severity averages
  const dailyFlares30d: any[] = [];
  for (let i = 29; i >= 0; i--) {
    const ds = new Date(now - i * oneDay); ds.setUTCHours(0, 0, 0, 0);
    const de = new Date(ds.getTime() + oneDay);
    const df = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= ds.getTime() && t < de.getTime(); });
    const label = fmtDate(ds);
    const sevs = df.map((f: any) => sevToNum(f.severity || "")).filter((x: number) => x > 0);
    dailyFlares30d.push({ 
      date: label, flares: df.length, 
      mild: df.filter((f: any) => f.severity === 'mild').length, 
      moderate: df.filter((f: any) => f.severity === 'moderate').length, 
      severe: df.filter((f: any) => f.severity === 'severe').length,
      avgSev: sevs.length ? (sevs.reduce((a: number, b: number) => a+b, 0) / sevs.length).toFixed(1) : "0",
    });
  }

  // EWMA trend line
  const dailySevAvgs = dailyFlares30d.map(d => parseFloat(d.avgSev) || 0);
  const sevTrendLine = ewma(dailySevAvgs, 0.2);
  const trendDirection = sevTrendLine.length >= 7 
    ? (sevTrendLine[sevTrendLine.length-1] > sevTrendLine[sevTrendLine.length-7] + 0.3 ? "worsening" 
       : sevTrendLine[sevTrendLine.length-1] < sevTrendLine[sevTrendLine.length-7] - 0.3 ? "improving" : "stable")
    : "insufficient";

  // #114 — Severity slope (linear regression over 30d)
  const sevSlope = linSlope(dailySevAvgs);
  // #115 — Flare frequency slope
  const dailyFlareCounts = dailyFlares30d.map(d => d.flares);
  const freqSlope = linSlope(dailyFlareCounts);
  // #116 — Severity volatility (how much severity jumps around)
  const sevVolatility = cv(sevScores);

  // Weekly breakdown 8 weeks
  const weeklyBreakdown: any[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(now - (i + 1) * oneWeek), we = new Date(now - i * oneWeek);
    const wf = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= ws.getTime() && t < we.getTime(); });
    const sl = fmtDate(ws), el = fmtDate(we);
    const sevs = wf.map((f: any) => sevToNum(f.severity || "")).filter((x: number) => x > 0);
    weeklyBreakdown.push({ 
      week: `${sl}–${el}`, total: wf.length, 
      avgSev: sevs.length ? (sevs.reduce((s: number, v: number) => s+v, 0) / sevs.length).toFixed(1) : "0",
      severe: wf.filter((f: any) => f.severity === 'severe').length,
    });
  }

  // Medication effectiveness (enhanced)
  const medEffectiveness: any[] = [];
  const uniqueMeds = [...new Set(medLogs.map((m: any) => m.medication_name))];
  for (const medName of uniqueMeds.slice(0, 12)) {
    const doses = medLogs.filter((m: any) => m.medication_name === medName);
    let sevBefore = 0, cntB = 0, sevAfter = 0, cntA = 0, flareFreeAfter = 0;
    const beforeScores: number[] = [], afterScores: number[] = [];
    const reliefTimes: number[] = [];
    for (const dose of doses) {
      const dt = new Date(dose.taken_at).getTime();
      flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= dt - oneDay && t < dt; }).forEach((f: any) => { 
        const s = sevToNum(f.severity || "mild"); sevBefore += s; cntB++; beforeScores.push(s); 
      });
      const flaresAfter = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t > dt && t <= dt + oneDay; });
      flaresAfter.forEach((f: any) => { 
        const s = sevToNum(f.severity || "mild"); sevAfter += s; cntA++; afterScores.push(s);
      });
      if (flaresAfter.length === 0) flareFreeAfter++;
      const nextFlare = sortedFlares.find((f: any) => new Date(f.timestamp).getTime() > dt);
      if (nextFlare) reliefTimes.push((new Date(nextFlare.timestamp).getTime() - dt) / 3600000);
    }
    const ab = cntB > 0 ? sevBefore / cntB : 0, aa = cntA > 0 ? sevAfter / cntA : 0;
    const reduction = ab > 0 ? Math.round(((ab - aa) / ab) * 100) : 0;
    const lastDose = doses[0] ? new Date(doses[0].taken_at) : null;
    const hoursSinceLastDose = lastDose ? Math.round((now - lastDose.getTime()) / 3600000) : null;
    const doseTimestamps = doses.map((d: any) => new Date(d.taken_at).getHours());
    const timingConsistency = doseTimestamps.length >= 3 ? (1 - (cv(doseTimestamps) || 1)) : null;
    // #117 — Dose-response curve (does taking more often help?)
    const doseFreqPerWeek = doses.length > 0 ? (doses.length / Math.max(1, Math.floor((now - new Date(doses[doses.length-1].taken_at).getTime()) / oneWeek))) : 0;
    medEffectiveness.push({ 
      name: medName, timesTaken: doses.length, 
      severityReduction: `${reduction}%`, 
      flareFreeRate: doses.length > 0 ? `${Math.round((flareFreeAfter / doses.length) * 100)}%` : "N/A",
      avgBefore: ab.toFixed(1), avgAfter: aa.toFixed(1),
      hoursSinceLastDose,
      lastTaken: lastDose ? fmtDate(lastDose) : "N/A",
      dosage: doses[0]?.dosage || "standard",
      avgHoursToRelief: reliefTimes.length > 0 ? Math.round(avg(reliefTimes)!) : null,
      timingConsistency: timingConsistency != null ? `${Math.round(timingConsistency * 100)}%` : "N/A",
      weeklyFreq: doseFreqPerWeek.toFixed(1),
    });
  }

  // Body metrics with full physiological data extraction
  const withPhysio = entries.filter(e => e?.physiological_data);
  const flaresWithPhysio = flares.filter(e => e?.physiological_data);
  const nonFlares = entries.filter(e => e?.entry_type !== "flare" && !e?.severity && e?.physiological_data);
  
  const extractMetric = (p: any, key: string): number | null => {
    if (!p) return null;
    switch (key) {
      case "hr": return p?.heart_rate ?? p?.heartRate ?? p?.resting_heart_rate ?? p?.restingHeartRate ?? null;
      case "hrv": return p?.heart_rate_variability ?? p?.heartRateVariability ?? p?.hrv_rmssd ?? p?.hrvRmssd ?? null;
      case "sleep": { 
        const d = p?.sleep_hours ?? p?.sleepHours ?? p?.sleep_minutes ?? p?.sleepMinutes; 
        if (d == null) return null; 
        return d > 24 * 60 ? d / 3600 : d > 24 ? d / 60 : d; 
      }
      case "steps": return p?.steps ?? null;
      case "spo2": return p?.spo2 ?? p?.spo2_avg ?? p?.spo2Avg ?? null;
      case "temp": return p?.skin_temperature ?? p?.skinTemperature ?? null;
      case "rr": return p?.breathing_rate ?? p?.breathingRate ?? null;
      case "calories": return p?.calories_burned ?? p?.caloriesBurned ?? null;
      case "vo2max": return p?.vo2_max ?? p?.vo2Max ?? null;
      case "azm": return p?.active_zone_minutes_total ?? p?.activeZoneMinutesTotal ?? null;
      case "deep_sleep": return p?.deep_sleep_minutes ?? p?.deepSleepMinutes ?? null;
      case "rem_sleep": return p?.rem_sleep_minutes ?? p?.remSleepMinutes ?? null;
      case "sleep_eff": return p?.sleep_efficiency ?? p?.sleepEfficiency ?? null;
      default: return null;
    }
  };
  
  const collectMetrics = (list: any[]) => {
    const hr: number[] = [], hrv: number[] = [], sleep: number[] = [], steps: number[] = [], spo2: number[] = [], 
          temp: number[] = [], rr: number[] = [], calories: number[] = [], vo2: number[] = [], azm: number[] = [],
          deepSleep: number[] = [], remSleep: number[] = [], sleepEff: number[] = [];
    for (const e of list) {
      const p = e.physiological_data;
      const push = (arr: number[], key: string) => { const v = extractMetric(p, key); if (v != null && v > 0) arr.push(v); };
      push(hr, "hr"); push(hrv, "hrv"); push(sleep, "sleep"); push(steps, "steps"); push(spo2, "spo2");
      push(temp, "temp"); push(rr, "rr"); push(calories, "calories"); push(vo2, "vo2max"); push(azm, "azm");
      push(deepSleep, "deep_sleep"); push(remSleep, "rem_sleep"); push(sleepEff, "sleep_eff");
    }
    return { 
      hr: avg(hr), hrv: avg(hrv), sleep: avg(sleep), steps: avg(steps), spo2: avg(spo2), temp: avg(temp), rr: avg(rr),
      calories: avg(calories), vo2max: avg(vo2), azm: avg(azm), deepSleep: avg(deepSleep), remSleep: avg(remSleep), sleepEff: avg(sleepEff),
      hrvStddev: stddev(hrv), hrMedian: median(hr),
      hrP90: percentile(hr, 90), hrvP10: percentile(hrv, 10), sleepP10: percentile(sleep, 10),
    };
  };
  const overallMetrics = collectMetrics(withPhysio);
  const flareMetrics = collectMetrics(flaresWithPhysio);
  const baselineMetrics = collectMetrics(nonFlares);

  // HRV trend over last 14 days
  const hrvTrend14d: { date: string; hrv: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const ds = new Date(now - i * oneDay); ds.setUTCHours(0, 0, 0, 0);
    const de = new Date(ds.getTime() + oneDay);
    const dayEntries = entries.filter((e: any) => { const t = new Date(e.timestamp).getTime(); return t >= ds.getTime() && t < de.getTime() && e.physiological_data; });
    const hrvVals = dayEntries.map(e => extractMetric(e.physiological_data, "hrv")).filter((v): v is number => v != null && v > 0);
    if (hrvVals.length > 0) hrvTrend14d.push({ date: fmtDate(ds), hrv: Math.round(avg(hrvVals)!) });
  }

  // #118 — HR trend 14d
  const hrTrend14d: { date: string; hr: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const ds = new Date(now - i * oneDay); ds.setUTCHours(0, 0, 0, 0);
    const de = new Date(ds.getTime() + oneDay);
    const dayEntries = entries.filter((e: any) => { const t = new Date(e.timestamp).getTime(); return t >= ds.getTime() && t < de.getTime() && e.physiological_data; });
    const hrVals = dayEntries.map(e => extractMetric(e.physiological_data, "hr")).filter((v): v is number => v != null && v > 0);
    if (hrVals.length > 0) hrTrend14d.push({ date: fmtDate(ds), hr: Math.round(avg(hrVals)!) });
  }

  // Sleep-flare lag analysis
  const sleepFlareLag: { sleepHours: number; nextDayFlares: number; nextDaySev: number }[] = [];
  for (let i = 29; i >= 1; i--) {
    const dayStart = new Date(now - i * oneDay); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + oneDay);
    const nextDayStart = dayEnd;
    const nextDayEnd = new Date(nextDayStart.getTime() + oneDay);
    const dayEntries = entries.filter((e: any) => { const t = new Date(e.timestamp).getTime(); return t >= dayStart.getTime() && t < dayEnd.getTime() && e.physiological_data; });
    const sleepVals = dayEntries.map(e => extractMetric(e.physiological_data, "sleep")).filter((v): v is number => v != null && v > 0);
    if (sleepVals.length === 0) continue;
    const avgSleep = avg(sleepVals)!;
    const nextDayFlareList = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= nextDayStart.getTime() && t < nextDayEnd.getTime(); });
    const nextDaySevs = nextDayFlareList.map(f => sevToNum(f.severity || "")).filter(v => v > 0);
    sleepFlareLag.push({ sleepHours: avgSleep, nextDayFlares: nextDayFlareList.length, nextDaySev: nextDaySevs.length ? avg(nextDaySevs)! : 0 });
  }
  const sleepFlareCorrelation = sleepFlareLag.length >= 5 ? pearson(sleepFlareLag.map(d => d.sleepHours), sleepFlareLag.map(d => d.nextDayFlares)) : null;

  // Steps-flare correlation
  const stepsFlareData: { steps: number; hadFlare: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const ds = new Date(now - i * oneDay); ds.setUTCHours(0, 0, 0, 0);
    const de = new Date(ds.getTime() + oneDay);
    const dayEntries = entries.filter((e: any) => { const t = new Date(e.timestamp).getTime(); return t >= ds.getTime() && t < de.getTime() && e.physiological_data; });
    const stepVals = dayEntries.map(e => extractMetric(e.physiological_data, "steps")).filter((v): v is number => v != null && v > 0);
    if (stepVals.length === 0) continue;
    const dayFlares = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= ds.getTime() && t < de.getTime(); });
    stepsFlareData.push({ steps: Math.max(...stepVals), hadFlare: dayFlares.length > 0 ? 1 : 0 });
  }
  const stepsFlareCorr = stepsFlareData.length >= 5 ? pearson(stepsFlareData.map(d => d.steps), stepsFlareData.map(d => d.hadFlare)) : null;

  // #119 — HR-severity correlation
  const hrSevData = flaresWithPhysio.map(e => ({ hr: extractMetric(e.physiological_data, "hr"), sev: sevToNum(e.severity || "") })).filter(d => d.hr != null && d.sev > 0);
  const hrSevCorr = hrSevData.length >= 5 ? pearson(hrSevData.map(d => d.hr!), hrSevData.map(d => d.sev)) : null;

  // Exercise-flare analysis
  const exerciseAnalysis: { type: string; intensity: string; flaresAfter: number; totalSessions: number }[] = [];
  const exerciseTypes = new Set((activityLogs || []).filter((a: any) => a.activity_type === 'exercise').map((a: any) => a.activity_value || 'general'));
  for (const exType of [...exerciseTypes].slice(0, 8)) {
    const sessions = (activityLogs || []).filter((a: any) => a.activity_type === 'exercise' && (a.activity_value || 'general') === exType);
    let flaresAfterExercise = 0;
    for (const session of sessions) {
      const st = new Date(session.timestamp).getTime();
      const hasFlareAfter = flares.some((f: any) => { const ft = new Date(f.timestamp).getTime(); return ft > st && ft <= st + oneDay; });
      if (hasFlareAfter) flaresAfterExercise++;
    }
    exerciseAnalysis.push({ type: exType, intensity: sessions[0]?.intensity || 'moderate', flaresAfter: flaresAfterExercise, totalSessions: sessions.length });
  }

  // Hydration tracking
  const hydrationItems = foodLogs.filter((f: any) => /water|tea|coffee|juice|smoothie|milk|broth|soup/i.test(f.food_name || ''));
  const dailyHydration = hydrationItems.length;

  // Food analysis (enhanced)
  const today = new Date().toISOString().split("T")[0];
  const todayFoods = foodLogs.filter((f: any) => f.logged_at?.startsWith(today));
  const todayCal = todayFoods.reduce((s: number, f: any) => s + (Number(f.calories) || 0) * (Number(f.servings) || 1), 0);
  const todayProtein = todayFoods.reduce((s: number, f: any) => s + (Number(f.protein_g) || 0) * (Number(f.servings) || 1), 0);
  const todayFiber = todayFoods.reduce((s: number, f: any) => s + (Number(f.dietary_fiber_g) || 0) * (Number(f.servings) || 1), 0);
  const todaySugar = todayFoods.reduce((s: number, f: any) => s + (Number(f.total_sugars_g || f.added_sugars_g) || 0) * (Number(f.servings) || 1), 0);
  const todaySodium = todayFoods.reduce((s: number, f: any) => s + (Number(f.sodium_mg) || 0) * (Number(f.servings) || 1), 0);
  const last7dFoods = foodLogs.filter((f: any) => now - new Date(f.logged_at).getTime() < 7 * oneDay);
  const foodByDay: Record<string, any[]> = {};
  for (const f of last7dFoods) {
    const day = fmtDate(new Date(f.logged_at));
    if (!foodByDay[day]) foodByDay[day] = [];
    foodByDay[day].push(f);
  }

  // 7d macros
  const daysWithFood = Math.max(1, Object.keys(foodByDay).length);
  const macros7d = {
    avgProtein: last7dFoods.length ? Math.round(last7dFoods.reduce((s: number, f: any) => s + (Number(f.protein_g) || 0), 0) / daysWithFood) : null,
    avgFiber: last7dFoods.length ? Math.round(last7dFoods.reduce((s: number, f: any) => s + (Number(f.dietary_fiber_g) || 0), 0) / daysWithFood) : null,
    avgSugar: last7dFoods.length ? Math.round(last7dFoods.reduce((s: number, f: any) => s + (Number(f.total_sugars_g || f.added_sugars_g) || 0), 0) / daysWithFood) : null,
    avgSodium: last7dFoods.length ? Math.round(last7dFoods.reduce((s: number, f: any) => s + (Number(f.sodium_mg) || 0), 0) / daysWithFood) : null,
    avgFat: last7dFoods.length ? Math.round(last7dFoods.reduce((s: number, f: any) => s + (Number(f.total_fat_g) || 0), 0) / daysWithFood) : null,
  };

  // #120 — Diet diversity score (unique foods in last 7d)
  const uniqueFoods7d = new Set(last7dFoods.map((f: any) => f.food_name?.toLowerCase().trim())).size;
  const dietDiversityScore = Math.min(100, Math.round(uniqueFoods7d * 5)); // 20 unique foods = 100

  // Inflammatory scoring
  const inflammatoryFoods = foodLogs.filter((f: any) => {
    const sugars = Number(f.added_sugars_g || f.total_sugars_g) || 0;
    const satFat = Number(f.saturated_fat_g) || 0;
    const sodium = Number(f.sodium_mg) || 0;
    const transFat = Number(f.trans_fat_g) || 0;
    return sugars > 15 || satFat > 8 || sodium > 800 || transFat > 1;
  });
  const antiInflammatoryFoods = foodLogs.filter((f: any) => {
    const fiber = Number(f.dietary_fiber_g) || 0;
    const vitC = Number(f.vitamin_c_mg) || 0;
    const name = (f.food_name || '').toLowerCase();
    return fiber > 5 || vitC > 30 || /salmon|berr|spinach|broccoli|turmeric|ginger|olive oil|avocado|nuts|walnut|almond|kale|sweet potato|green tea/.test(name);
  });

  // #121 — Inflammatory ratio
  const inflammatoryRatio = (inflammatoryFoods.length + antiInflammatoryFoods.length) > 0
    ? (antiInflammatoryFoods.length / (inflammatoryFoods.length + antiInflammatoryFoods.length) * 100).toFixed(0)
    : "N/A";

  // Food-flare correlation
  const foodFlareCorrelation: Record<string, { count: number; total: number; severities: number[] }> = {};
  for (const flare of sortedFlares.slice(0, 50)) {
    const ft = new Date(flare.timestamp).getTime();
    const fBefore = foodLogs.filter((f: any) => {
      const t = new Date(f.logged_at).getTime();
      return t >= ft - 12 * 3600000 && t < ft - 2 * 3600000;
    });
    for (const food of fBefore) {
      const name = food.food_name;
      if (!foodFlareCorrelation[name]) foodFlareCorrelation[name] = { count: 0, total: 0, severities: [] };
      foodFlareCorrelation[name].count++;
      foodFlareCorrelation[name].severities.push(sevToNum(flare.severity || ""));
    }
  }
  for (const f of foodLogs) {
    const name = f.food_name;
    if (foodFlareCorrelation[name]) foodFlareCorrelation[name].total++;
  }
  const suspiciousFoods = Object.entries(foodFlareCorrelation)
    .filter(([_, d]) => d.count >= 2 && d.total >= 2)
    .map(([name, d]) => ({ name, count: d.count, total: d.total, rate: pct(d.count, d.total), avgSev: d.severities.length ? (d.severities.reduce((a,b)=>a+b,0)/d.severities.length).toFixed(1) : "?" }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);

  const protectiveFoods = Object.entries(foodFlareCorrelation)
    .filter(([_, d]) => d.total >= 5 && d.count <= 1)
    .map(([name, d]) => ({ name, total: d.total, flareRate: pct(d.count, d.total) }))
    .sort((a, b) => a.flareRate - b.flareRate)
    .slice(0, 5);

  // Meal type analysis
  const mealTypeCounts: Record<string, number> = {};
  for (const f of foodLogs) {
    const mt = f.meal_type || "snack";
    mealTypeCounts[mt] = (mealTypeCounts[mt] || 0) + 1;
  }

  // Late-night eating
  const lateNightEating = foodLogs.filter((f: any) => {
    const h = new Date(f.logged_at).getHours();
    return h >= 21 || h < 4;
  });
  const lateNightEatingRate = foodLogs.length > 0 ? pct(lateNightEating.length, foodLogs.length) : 0;

  // Meal regularity
  const mealHours = foodLogs.map((f: any) => new Date(f.logged_at).getHours());
  const mealRegularity = mealHours.length >= 7 ? (1 - Math.min(1, (stddev(mealHours) || 5) / 6)) : null;

  // Caffeine tracking
  const caffeineItems = foodLogs.filter((f: any) => /coffee|espresso|latte|cappuccino|caffeine|energy drink|matcha|black tea/i.test(f.food_name || ''));
  const caffeineLateCount = caffeineItems.filter((f: any) => new Date(f.logged_at).getHours() >= 14).length;

  // Alcohol tracking
  const alcoholItems = foodLogs.filter((f: any) => /beer|wine|cocktail|whiskey|vodka|rum|gin|tequila|sake|alcohol|margarita|sangria/i.test(f.food_name || ''));

  // #122 — Breakfast skip rate
  const daysTracked = new Set(foodLogs.map((f: any) => new Date(f.logged_at).toISOString().split('T')[0]));
  const breakfastDays = new Set(foodLogs.filter((f: any) => (f.meal_type === 'breakfast') || (new Date(f.logged_at).getHours() >= 6 && new Date(f.logged_at).getHours() < 10)).map((f: any) => new Date(f.logged_at).toISOString().split('T')[0]));
  const breakfastSkipRate = daysTracked.size > 3 ? pct(daysTracked.size - breakfastDays.size, daysTracked.size) : null;

  // #123 — Water intake estimation
  const waterItems = foodLogs.filter((f: any) => /\bwater\b/i.test(f.food_name || ''));
  const avgWaterPerDay = daysTracked.size > 0 ? (waterItems.length / daysTracked.size).toFixed(1) : "0";

  // Trigger-symptom mapping
  const tsMap: Record<string, Record<string, { count: number; severities: number[] }>> = {};
  flares.forEach((f: any) => { 
    (f.triggers || []).forEach((t: string) => { 
      if (!tsMap[t]) tsMap[t] = {}; 
      (f.symptoms || []).forEach((s: string) => { 
        if (!tsMap[t][s]) tsMap[t][s] = { count: 0, severities: [] };
        tsMap[t][s].count++;
        tsMap[t][s].severities.push(sevToNum(f.severity || ""));
      }); 
    }); 
  });
  const triggerOutcomes = Object.entries(tsMap).map(([t, syms]) => ({ 
    trigger: t, 
    topSymptoms: Object.entries(syms).sort((a, b) => b[1].count - a[1].count).slice(0, 3).map(([s, d]) => `${s}(${d.count}x, avg sev ${(d.severities.reduce((a,b)=>a+b,0)/d.severities.length).toFixed(1)})`)
  })).slice(0, 10);

  // Severity trajectory
  const sevTrajectory = sortedFlares.slice(0, 15).reverse().map(f => sevToNum(f.severity || ""));
  const isEscalating = sevTrajectory.length >= 4 && sevTrajectory.slice(-3).every((v, i, a) => i === 0 || v >= a[i - 1]);
  const isImproving = sevTrajectory.length >= 4 && sevTrajectory.slice(-3).every((v, i, a) => i === 0 || v <= a[i - 1]);

  // Gap analysis
  const gapsBetweenFlares: number[] = [];
  for (let i = 0; i < sortedFlares.length - 1; i++) {
    const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i + 1].timestamp).getTime();
    gapsBetweenFlares.push(Math.round(gap / oneDay));
  }
  const avgGapDays = gapsBetweenFlares.length > 0 ? Math.round(gapsBetweenFlares.reduce((a, b) => a + b, 0) / gapsBetweenFlares.length) : null;
  const maxGapDays = gapsBetweenFlares.length > 0 ? Math.max(...gapsBetweenFlares) : null;
  const minGapDays = gapsBetweenFlares.length > 0 ? Math.min(...gapsBetweenFlares) : null;

  // Medication adherence
  const medAdherence: Record<string, { expected: number; actual: number; missedDays: number }> = {};
  for (const med of uniqueMeds) {
    const doses = medLogs.filter((m: any) => m.medication_name === med);
    if (doses.length < 2) continue;
    const freq = doses[0]?.frequency || "daily";
    const first = new Date(doses[doses.length - 1].taken_at).getTime();
    const last = new Date(doses[0].taken_at).getTime();
    const daySpan = Math.max(1, Math.floor((last - first) / oneDay));
    const expectedPerDay = freq === "twice-daily" ? 2 : freq === "three-times-daily" ? 3 : 1;
    const daysWithDoses = new Set(doses.map((d: any) => new Date(d.taken_at).toISOString().split('T')[0])).size;
    medAdherence[med] = { expected: daySpan * expectedPerDay, actual: doses.length, missedDays: daySpan - daysWithDoses };
  }

  // Flare clustering
  let clusterCount = 0;
  for (let i = 0; i < sortedFlares.length - 1; i++) {
    const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i + 1].timestamp).getTime();
    if (gap < 2 * oneDay) clusterCount++;
  }

  // Cluster progression
  const clusterProgression: string[] = [];
  for (let i = 0; i < sortedFlares.length - 1; i++) {
    const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i + 1].timestamp).getTime();
    if (gap < 2 * oneDay) {
      const s1 = sevToNum(sortedFlares[i+1].severity || ""), s2 = sevToNum(sortedFlares[i].severity || "");
      if (s2 > s1) clusterProgression.push("escalating");
      else if (s2 < s1) clusterProgression.push("resolving");
      else clusterProgression.push("stable");
    }
  }

  // Health score (enhanced multi-factor)
  const sleepFactor = overallMetrics.sleep != null ? (overallMetrics.sleep >= 7 && overallMetrics.sleep <= 9 ? 10 : overallMetrics.sleep >= 6 ? 5 : 0) : 0;
  const hrvFactor = overallMetrics.hrv != null ? Math.min(10, Math.round(overallMetrics.hrv / 5)) : 0;
  const healthScore = Math.max(0, Math.min(100, Math.round(
    60
    - (thisWeek.length * 6)
    - (sevCounts.severe * 4)
    - (sevCounts.moderate * 1.5)
    + (currentFlareFree * 2)
    + (medEffectiveness.filter(m => parseInt(m.severityReduction) > 20).length * 4)
    - (isEscalating ? 12 : 0)
    + (isImproving ? 8 : 0)
    + sleepFactor
    + hrvFactor
    + (clusterCount === 0 ? 5 : -clusterCount * 2)
    + (antiInflammatoryFoods.length > inflammatoryFoods.length ? 5 : -3)
    - (escalationWindows * 3)
    + (mealRegularity != null && mealRegularity > 0.7 ? 3 : 0)
    + (dietDiversityScore > 60 ? 3 : 0) // #124 — Diet diversity bonus
    - (flareBursts * 4) // #125 — Burst penalty
    - (polypharmacyDays > 5 ? 3 : 0) // #126 — Polypharmacy awareness
  )));

  const healthScoreBreakdown = {
    flareImpact: -(thisWeek.length * 6 + sevCounts.severe * 4 + sevCounts.moderate * 1.5),
    recoveryBonus: currentFlareFree * 2,
    medBonus: medEffectiveness.filter(m => parseInt(m.severityReduction) > 20).length * 4,
    trajectoryImpact: isEscalating ? -12 : isImproving ? 8 : 0,
    sleepBonus: sleepFactor,
    hrvBonus: hrvFactor,
    dietImpact: antiInflammatoryFoods.length > inflammatoryFoods.length ? 5 : -3,
    escalationPenalty: -(escalationWindows * 3),
    mealRegularityBonus: mealRegularity != null && mealRegularity > 0.7 ? 3 : 0,
    dietDiversityBonus: dietDiversityScore > 60 ? 3 : 0,
    burstPenalty: -(flareBursts * 4),
  };

  // Worst flare details
  const worstFlare = sortedFlares.find(f => f.severity === "severe") || sortedFlares[0];
  const worstFlareDetail = worstFlare ? {
    date: fmtDate(new Date(worstFlare.timestamp)),
    severity: worstFlare.severity,
    symptoms: (worstFlare.symptoms || []).slice(0, 5).join(", "),
    triggers: (worstFlare.triggers || []).slice(0, 5).join(", "),
    note: worstFlare.note?.slice(0, 60) || "",
    meds: (worstFlare.medications || []).join(", "),
    env: worstFlare.environmental_data?.weather?.condition || "",
    physio: worstFlare.physiological_data ? `HR:${extractMetric(worstFlare.physiological_data, "hr") || '?'} HRV:${extractMetric(worstFlare.physiological_data, "hrv") || '?'}` : "",
  } : null;

  // Best period
  let bestPeriodStart: string | null = null, bestPeriodEnd: string | null = null;
  if (maxGapDays && maxGapDays > 1) {
    for (let i = 0; i < sortedFlares.length - 1; i++) {
      const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i + 1].timestamp).getTime();
      if (Math.round(gap / oneDay) === maxGapDays) {
        bestPeriodStart = fmtDate(new Date(sortedFlares[i + 1].timestamp));
        bestPeriodEnd = fmtDate(new Date(sortedFlares[i].timestamp));
        break;
      }
    }
  }

  // Hourly heatmap
  const hourlyHeatmap = hourCounts.map((c, h) => ({ hour: `${h}:00`, count: c }));
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  // Environmental correlations
  const pressureData: { pressure: number; severity: number }[] = [];
  const humidityData: { humidity: number; severity: number }[] = [];
  const tempData: { temp: number; severity: number }[] = [];
  for (const e of flares) {
    const env = e?.environmental_data;
    const score = sevToNum(e?.severity || "");
    if (env?.weather?.pressure && score) pressureData.push({ pressure: env.weather.pressure, severity: score });
    if (env?.weather?.humidity && score) humidityData.push({ humidity: env.weather.humidity, severity: score });
    if (env?.weather?.temperature != null && score) tempData.push({ temp: env.weather.temperature, severity: score });
  }

  const pressureCorr = pressureData.length >= 5 ? pearson(pressureData.map(d => d.pressure), pressureData.map(d => d.severity)) : null;
  const humidityCorr = humidityData.length >= 5 ? pearson(humidityData.map(d => d.humidity), humidityData.map(d => d.severity)) : null;
  const tempCorr = tempData.length >= 5 ? pearson(tempData.map(d => d.temp), tempData.map(d => d.severity)) : null;

  const aqiData: { aqi: number; severity: number }[] = [];
  for (const e of flares) {
    const aqi = e?.environmental_data?.airQuality?.aqi;
    const score = sevToNum(e?.severity || "");
    if (aqi && score) aqiData.push({ aqi, severity: score });
  }

  const pollenData: { level: number; severity: number }[] = [];
  for (const e of flares) {
    const pollen = e?.environmental_data?.pollen?.overall ?? e?.environmental_data?.pollen?.total;
    const score = sevToNum(e?.severity || "");
    if (pollen && score) pollenData.push({ level: pollen, severity: score });
  }

  // Dangerous triggers
  const dangerousTriggers = Object.entries(triggerSeverity)
    .filter(([_, sevs]) => sevs.length >= 2)
    .map(([trigger, sevs]) => ({ trigger, avgSev: (sevs.reduce((a,b)=>a+b,0)/sevs.length), count: sevs.length }))
    .sort((a, b) => b.avgSev - a.avgSev)
    .slice(0, 5);

  const dangerousSymptoms = Object.entries(symptomSeverity)
    .filter(([_, sevs]) => sevs.length >= 2)
    .map(([symptom, sevs]) => ({ symptom, avgSev: (sevs.reduce((a,b)=>a+b,0)/sevs.length), count: sevs.length }))
    .sort((a, b) => b.avgSev - a.avgSev)
    .slice(0, 5);

  // Trigger combo danger scoring
  const triggerComboDanger = Object.entries(triggerPairs)
    .filter(([_, c]) => c >= 2)
    .map(([combo, count]) => {
      const comboTriggers = combo.split(" + ");
      const relevantFlares = flares.filter((f: any) => comboTriggers.every(t => (f.triggers || []).includes(t)));
      const sevs = relevantFlares.map(f => sevToNum(f.severity || "")).filter(v => v > 0);
      return { combo, count, avgSev: sevs.length ? (sevs.reduce((a,b)=>a+b,0)/sevs.length).toFixed(1) : "?" };
    })
    .sort((a, b) => parseFloat(b.avgSev) - parseFloat(a.avgSev))
    .slice(0, 5);

  // Flare velocity
  const twoWeeksAgoFlares = flares.filter((e: any) => { const a = now - new Date(e.timestamp).getTime(); return a >= oneWeek && a < 2 * oneWeek; }).length;
  const flareVelocity = thisWeek.length - twoWeeksAgoFlares;

  // Med timing patterns
  const medTimingPatterns: Record<string, { morning: number; afternoon: number; evening: number; night: number }> = {};
  for (const med of medLogs) {
    const name = med.medication_name;
    if (!medTimingPatterns[name]) medTimingPatterns[name] = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const h = new Date(med.taken_at).getHours();
    const tod = getTimeOfDay(h);
    medTimingPatterns[name][tod]++;
  }

  // Med gap days
  const medDays = new Set(medLogs.map((m: any) => new Date(m.taken_at).toISOString().split('T')[0]));
  let medGapDays = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now - i * oneDay).toISOString().split('T')[0];
    if (!medDays.has(d) && medLogs.length > 0) medGapDays++;
  }

  const triggerDiversity = Object.keys(triggerCounts).length;
  const symptomDiversity = Object.keys(symptomCounts).length;
  const topPersistent = Object.entries(symptomPersistence).sort((a,b) => b[1]-a[1]).slice(0, 3);

  // #141 — Micro-nutrient deficiency risk detection
  const microNutrientFlags: string[] = [];
  const avg7dIron = last7dFoods.length ? last7dFoods.reduce((s: number, f: any) => s + (Number(f.iron_mg) || 0), 0) / daysWithFood : null;
  const avg7dVitD = last7dFoods.length ? last7dFoods.reduce((s: number, f: any) => s + (Number(f.vitamin_d_mcg) || 0), 0) / daysWithFood : null;
  const avg7dCalcium = last7dFoods.length ? last7dFoods.reduce((s: number, f: any) => s + (Number(f.calcium_mg) || 0), 0) / daysWithFood : null;
  const avg7dVitC = last7dFoods.length ? last7dFoods.reduce((s: number, f: any) => s + (Number(f.vitamin_c_mg) || 0), 0) / daysWithFood : null;
  const avg7dPotassium = last7dFoods.length ? last7dFoods.reduce((s: number, f: any) => s + (Number(f.potassium_mg) || 0), 0) / daysWithFood : null;
  if (avg7dIron != null && avg7dIron < 8) microNutrientFlags.push(`iron low (${avg7dIron.toFixed(1)}mg/day, need 8-18mg)`);
  if (avg7dVitD != null && avg7dVitD < 10) microNutrientFlags.push(`vitamin D low (${avg7dVitD.toFixed(1)}mcg/day, need 15-20mcg)`);
  if (avg7dCalcium != null && avg7dCalcium < 500) microNutrientFlags.push(`calcium low (${Math.round(avg7dCalcium)}mg/day, need 1000mg)`);
  if (avg7dVitC != null && avg7dVitC < 30) microNutrientFlags.push(`vitamin C low (${Math.round(avg7dVitC)}mg/day, need 65-90mg)`);
  if (avg7dPotassium != null && avg7dPotassium < 1500) microNutrientFlags.push(`potassium low (${Math.round(avg7dPotassium)}mg/day, need 2600-3400mg)`);

  // #142 — Stress proxy (HR/HRV ratio — higher = more stress)
  const stressProxy = overallMetrics.hr != null && overallMetrics.hrv != null && overallMetrics.hrv > 0 
    ? (overallMetrics.hr / overallMetrics.hrv).toFixed(1) : null;
  const flareStressProxy = flareMetrics.hr != null && flareMetrics.hrv != null && flareMetrics.hrv > 0 
    ? (flareMetrics.hr / flareMetrics.hrv).toFixed(1) : null;

  // #143 — Recovery quality score (based on sleep + HRV + flare-free days)
  const recoveryScore = Math.min(100, Math.max(0, Math.round(
    (overallMetrics.sleep != null ? Math.min(30, overallMetrics.sleep * 4) : 10) +
    (overallMetrics.hrv != null ? Math.min(30, overallMetrics.hrv * 0.6) : 10) +
    (currentFlareFree > 0 ? Math.min(20, currentFlareFree * 4) : 0) +
    (overallMetrics.sleepEff != null ? Math.min(20, overallMetrics.sleepEff * 0.2) : 10)
  )));

  // #144 — Circadian rhythm analysis (when are flares vs when is user active)
  const circadianProfile = {
    peakFlareWindow: hourCounts.indexOf(Math.max(...hourCounts)),
    quietWindow: hourCounts.indexOf(Math.min(...hourCounts.filter(c => c >= 0))),
    morningLoad: pct(hourBuckets.morning, totalFlares || 1),
    eveningLoad: pct(hourBuckets.evening, totalFlares || 1),
    nightLoad: pct(nightFlares, totalFlares || 1),
  };

  // #145 — Weather change velocity (pressure drops preceding flares)
  const pressureDrops: number[] = [];
  for (let i = 1; i < sortedFlares.length; i++) {
    const p1 = sortedFlares[i]?.environmental_data?.weather?.pressure;
    const p0 = sortedFlares[i-1]?.environmental_data?.weather?.pressure;
    if (p1 != null && p0 != null) pressureDrops.push(p0 - p1);
  }
  const avgPressureChange = pressureDrops.length > 0 ? avg(pressureDrops) : null;

  // #146 — Trigger seasonality (which triggers appear in which months)
  const triggerByMonth: Record<string, Record<string, number>> = {};
  for (const f of flares) {
    const m = getMonth(new Date(f.timestamp));
    for (const t of (f.triggers || [])) {
      if (!triggerByMonth[t]) triggerByMonth[t] = {};
      triggerByMonth[t][m] = (triggerByMonth[t][m] || 0) + 1;
    }
  }
  const seasonalTriggers = Object.entries(triggerByMonth)
    .filter(([_, months]) => Object.keys(months).length >= 2)
    .map(([trigger, months]) => {
      const peakMonth = Object.entries(months).sort((a,b) => b[1]-a[1])[0];
      return `${trigger} peaks in ${peakMonth[0]}(${peakMonth[1]}x)`;
    }).slice(0, 5);

  // #147 — Fatigue index (energy low% + sleep deficit + high severity ratio)
  const energyLowCount = energyEntries.filter((e: any) => e.energy_level === 'low').length;
  const fatigueIndex = Math.min(100, Math.round(
    (energyEntries.length > 0 ? (energyLowCount / energyEntries.length) * 40 : 20) +
    (overallMetrics.sleep != null && overallMetrics.sleep < 7 ? 30 : 0) +
    (sevCounts.severe / Math.max(1, totalFlares)) * 30
  ));

  // #148 — Meal-to-flare delay distribution
  for (const flare of sortedFlares.slice(0, 30)) {
    const ft = new Date(flare.timestamp).getTime();
    const nearestMeal = foodLogs.find((f: any) => {
      const t = new Date(f.logged_at).getTime();
      return t < ft && ft - t < 12 * 3600000;
    });
    if (nearestMeal) {
      mealToFlareDelays.push(Math.round((ft - new Date(nearestMeal.logged_at).getTime()) / 3600000));
    }
  }
  const avgMealToFlareDelay = mealToFlareDelays.length > 0 ? avg(mealToFlareDelays) : null;

  // #149 — Flare predictability score (how regular are flare patterns)
  const flareRegularity = gapsBetweenFlares.length >= 3 ? (1 - Math.min(1, (cv(gapsBetweenFlares) || 1))) : null;

  // #150 — Symptom severity progression (per symptom: is it getting worse?)
  const symptomTrends: Record<string, string> = {};
  for (const [symptom] of topSymptoms.slice(0, 8)) {
    const symFlares = sortedFlares.filter(f => (f.symptoms || []).includes(symptom)).slice(0, 15);
    if (symFlares.length >= 4) {
      const sevs = symFlares.reverse().map(f => sevToNum(f.severity || "")).filter(v => v > 0);
      const slope = linSlope(sevs);
      symptomTrends[symptom] = slope != null ? (slope > 0.05 ? "worsening" : slope < -0.05 ? "improving" : "stable") : "unknown";
    }
  }

  // #151 — Medication washout detection (long gaps between doses)
  const medWashouts: { med: string; gapDays: number }[] = [];
  for (const medName of uniqueMeds.slice(0, 8)) {
    const doses = medLogs.filter((m: any) => m.medication_name === medName).sort((a: any, b: any) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());
    for (let i = 0; i < doses.length - 1; i++) {
      const gap = Math.round((new Date(doses[i].taken_at).getTime() - new Date(doses[i+1].taken_at).getTime()) / oneDay);
      if (gap > 3) medWashouts.push({ med: medName, gapDays: gap });
    }
  }

  // #152 — Weekly rhythm analysis (flares per day of week normalized)
  const weekdayRhythm = Object.entries(dayCounts).map(([day, count]) => ({
    day, count, normalized: totalFlares > 0 ? (count / totalFlares * 7).toFixed(1) : "0",
  }));

  // #153 — Condition-specific severity benchmarks
  const sevP25 = percentile(sevScores, 25);
  const sevP75 = percentile(sevScores, 75);
  const sevIqr = iqr(sevScores);

  // #154 — Month-over-month trend (last 3 months)
  const monthlyTrend: { month: string; flares: number; avgSev: number }[] = [];
  for (let i = 2; i >= 0; i--) {
    const ms = new Date(now - (i + 1) * 30 * oneDay);
    const me = new Date(now - i * 30 * oneDay);
    const mf = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= ms.getTime() && t < me.getTime(); });
    const sevs = mf.map((f: any) => sevToNum(f.severity || "")).filter(v => v > 0);
    monthlyTrend.push({ month: getMonth(ms), flares: mf.length, avgSev: sevs.length ? Math.round(avg(sevs)! * 10) / 10 : 0 });
  }

  // #155 — Decay-weighted severity (recent flares matter more)
  const decayWeightedSev = sortedFlares.slice(0, 30).reduce((s, f) => {
    const daysAgo = Math.max(0, (now - new Date(f.timestamp).getTime()) / oneDay);
    const w = decayWeight(daysAgo, 7);
    return s + sevToNum(f.severity || "") * w;
  }, 0);
  const totalDecayWeight = sortedFlares.slice(0, 30).reduce((s, f) => {
    const daysAgo = Math.max(0, (now - new Date(f.timestamp).getTime()) / oneDay);
    return s + decayWeight(daysAgo, 7);
  }, 0);
  const recentWeightedSev = totalDecayWeight > 0 ? (decayWeightedSev / totalDecayWeight).toFixed(2) : "N/A";

  // #156 — Trigger exposure without flare (protective exposures)
  const triggerExposureNoFlare: Record<string, number> = {};
  for (const entry of entries.filter(e => e?.triggers?.length > 0 && e?.entry_type !== 'flare')) {
    for (const t of (entry.triggers || [])) {
      triggerExposureNoFlare[t] = (triggerExposureNoFlare[t] || 0) + 1;
    }
  }

  // #157 — Sleep architecture quality
  const sleepArchitecture = {
    avgDeepPct: overallMetrics.deepSleep != null && overallMetrics.sleep != null && overallMetrics.sleep > 0
      ? Math.round((overallMetrics.deepSleep / (overallMetrics.sleep * 60)) * 100) : null,
    avgRemPct: overallMetrics.remSleep != null && overallMetrics.sleep != null && overallMetrics.sleep > 0
      ? Math.round((overallMetrics.remSleep / (overallMetrics.sleep * 60)) * 100) : null,
  };

  // #158 — Flare-free period food analysis
  const flareFreefoods: string[] = [];
  if (maxGapDays && maxGapDays > 2) {
    for (let i = 0; i < sortedFlares.length - 1; i++) {
      const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i+1].timestamp).getTime();
      if (Math.round(gap / oneDay) === maxGapDays) {
        const freeStart = new Date(sortedFlares[i+1].timestamp).getTime();
        const freeEnd = new Date(sortedFlares[i].timestamp).getTime();
        const freePeriodFoods = foodLogs.filter((f: any) => { const t = new Date(f.logged_at).getTime(); return t >= freeStart && t <= freeEnd; });
        flareFreefoods.push(...freePeriodFoods.map((f: any) => f.food_name));
        break;
      }
    }
  }

  // #159 — Severity volatility bands
  const sev7dAvg = dailySevAvgs.slice(-7);
  const sev7dSma = sma(dailySevAvgs, 7);
  const sevUpperBand = sev7dSma.length > 0 ? (sev7dSma[sev7dSma.length - 1] + (stddev(sev7dAvg) || 0)).toFixed(1) : "N/A";
  const sevLowerBand = sev7dSma.length > 0 ? Math.max(0, sev7dSma[sev7dSma.length - 1] - (stddev(sev7dAvg) || 0)).toFixed(1) : "N/A";

  // #160 — Activity-flare response time
  const activityFlareDelays: number[] = [];
  for (const act of (activityLogs || []).filter((a: any) => a.activity_type === 'exercise')) {
    const at = new Date(act.timestamp).getTime();
    const nextFlare = sortedFlares.find(f => new Date(f.timestamp).getTime() > at && new Date(f.timestamp).getTime() < at + 2 * oneDay);
    if (nextFlare) activityFlareDelays.push(Math.round((new Date(nextFlare.timestamp).getTime() - at) / 3600000));
  }

  // #161 — Symptom entropy (how diverse/unpredictable are symptom presentations)
  const symptomEntropy = entropy(Object.values(symptomCounts));
  const triggerEntropy = entropy(Object.values(triggerCounts));

  // #162 — Food timing by meal type
  const mealTimingAvg: Record<string, number> = {};
  for (const f of foodLogs) {
    const mt = f.meal_type || 'snack';
    const h = new Date(f.logged_at).getHours();
    if (!mealTimingAvg[mt]) mealTimingAvg[mt] = 0;
    mealTimingAvg[mt] = (mealTimingAvg[mt] * ((mealTypeCounts[mt] || 1) - 1) + h) / (mealTypeCounts[mt] || 1);
  }

  // #163 — Flare duration trend
  const durationTrend = durations.length >= 5 ? linSlope(durations) : null;

  // #164 — Note keyword extraction (most common words in flare notes)
  const noteKeywords: Record<string, number> = {};
  const stopWords = new Set(['the','a','an','is','was','were','are','been','be','have','had','has','do','does','did','will','would','could','should','may','might','can','and','but','or','nor','not','so','if','then','than','when','where','what','which','who','how','this','that','these','those','it','its','my','i','me','we','our','to','for','of','in','on','at','by','from','with','as','into','through','during','after','before','above','below','just','also','very','really','too','much','more','less','up','down','out','off','over','under','again','further','about','because','until','while','no','all','any','each','few','some','such','only','get','got','still','been','being','feel','feeling','like','today','yesterday','day','time','went','go','going','bit','lot','thing','way','even','back','right','left','don','didn','doesn','can','t','m','s','ve','ll','re','d','am']);
  for (const note of notesWithContent) {
    const words = note.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    for (const w of words) noteKeywords[w] = (noteKeywords[w] || 0) + 1;
  }
  const topNoteKeywords = Object.entries(noteKeywords).sort((a,b) => b[1]-a[1]).slice(0, 10);

  // #165 — Flare day nutrition vs non-flare day nutrition
  const flareDayNutrition: { cal: number[]; sugar: number[]; protein: number[] } = { cal: [], sugar: [], protein: [] };
  const nonFlareDayNutrition: { cal: number[]; sugar: number[]; protein: number[] } = { cal: [], sugar: [], protein: [] };
  const flareDaySet = new Set(flares.map(f => new Date(f.timestamp).toISOString().split('T')[0]));
  for (const [day, items] of Object.entries(foodByDay)) {
    const dayCal = (items as any[]).reduce((s, f) => s + (Number(f.calories) || 0), 0);
    const daySugar = (items as any[]).reduce((s, f) => s + (Number(f.total_sugars_g) || 0), 0);
    const dayProtein = (items as any[]).reduce((s, f) => s + (Number(f.protein_g) || 0), 0);
    // Check if any flare on this day (approximate)
    const isFlareDay = [...flareDaySet].some(fd => fd.includes(day.slice(0, 3)));
    if (isFlareDay) { flareDayNutrition.cal.push(dayCal); flareDayNutrition.sugar.push(daySugar); flareDayNutrition.protein.push(dayProtein); }
    else { nonFlareDayNutrition.cal.push(dayCal); nonFlareDayNutrition.sugar.push(daySugar); nonFlareDayNutrition.protein.push(dayProtein); }
  }

  // #166 — HRV recovery rate (how fast HRV rebounds after flares)
  const hrvRecoveryRate: number[] = [];
  for (let i = 1; i < sortedFlares.length && i < 10; i++) {
    const flareHrv = extractMetric(sortedFlares[i].physiological_data, "hrv");
    const nextHrv = extractMetric(sortedFlares[i-1]?.physiological_data, "hrv");
    if (flareHrv != null && nextHrv != null && nextHrv > flareHrv) {
      hrvRecoveryRate.push(nextHrv - flareHrv);
    }
  }

  // #173 — Flare autocorrelation (does today's flare predict tomorrow's?)
  const dailyFlareBinary30d = dailyFlares30d.map(d => d.flares > 0 ? 1 : 0);
  const flareAutocorr1 = autocorrelation(dailyFlareBinary30d, 1);
  const flareAutocorr2 = autocorrelation(dailyFlareBinary30d, 2);

  // #174 — Change-point detection in severity
  const sevChangePoint = cusum(dailySevAvgs);
  const sevChangeDay = sevChangePoint.changePoint != null ? dailyFlares30d[sevChangePoint.changePoint]?.date : null;

  // #175 — Runs test on flare pattern (random vs clustered)
  const flareRunsTest = runsTest(dailyFlareBinary30d.map(v => v > 0));

  // #176 — Severity acceleration (2nd derivative)
  const sevAcceleration = (() => {
    const velocities: number[] = [];
    for (let i = 1; i < dailySevAvgs.length; i++) velocities.push(dailySevAvgs[i] - dailySevAvgs[i-1]);
    return linSlope(velocities);
  })();

  // #177 — Trigger latency analysis (hours between trigger exposure and flare)
  const triggerLatency: Record<string, number[]> = {};
  for (const flare of sortedFlares.slice(0, 40)) {
    const ft = new Date(flare.timestamp).getTime();
    for (const t of (flare.triggers || [])) {
      // Look for same trigger in earlier non-flare entries
      const priorTrigger = entries.find((e: any) => e.entry_type === 'trigger' && (e.triggers || []).includes(t) && new Date(e.timestamp).getTime() < ft && ft - new Date(e.timestamp).getTime() < 2 * oneDay);
      if (priorTrigger) {
        if (!triggerLatency[t]) triggerLatency[t] = [];
        triggerLatency[t].push(Math.round((ft - new Date(priorTrigger.timestamp).getTime()) / 3600000));
      }
    }
  }
  const triggerLatencySummary = Object.entries(triggerLatency)
    .filter(([_, times]) => times.length >= 2)
    .map(([trigger, times]) => `${trigger}: avg ${Math.round(avg(times)!)}h delay`)
    .slice(0, 5);

  // #178 — Symptom novelty detector (new symptoms that appeared recently)
  const recent7dSymptoms = new Set(thisWeek.flatMap((f: any) => f.symptoms || []));
  const older30dSymptoms = new Set(flares.filter((e: any) => now - new Date(e.timestamp).getTime() >= oneWeek).flatMap((f: any) => f.symptoms || []));
  const novelSymptoms = [...recent7dSymptoms].filter(s => !older30dSymptoms.has(s));

  // #179 — Recovery quality after each severity level
  const recoveryQualityBySev: Record<string, number[]> = { mild: [], moderate: [], severe: [] };
  for (let i = 0; i < sortedFlares.length - 1; i++) {
    const sev = sortedFlares[i].severity;
    if (sev && recoveryQualityBySev[sev]) {
      const gapHours = (new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i+1].timestamp).getTime()) / 3600000;
      if (gapHours > 0 && gapHours < 720) recoveryQualityBySev[sev].push(gapHours);
    }
  }

  // #180 — Medication combination effectiveness
  const medCombos: Record<string, { count: number; sevAfter: number[] }> = {};
  for (const flare of sortedFlares.slice(0, 50)) {
    const meds = flare.medications || [];
    if (meds.length >= 2) {
      const combo = meds.sort().join(" + ");
      if (!medCombos[combo]) medCombos[combo] = { count: 0, sevAfter: [] };
      medCombos[combo].count++;
      medCombos[combo].sevAfter.push(sevToNum(flare.severity || ""));
    }
  }
  const medComboEffectiveness = Object.entries(medCombos)
    .filter(([_, d]) => d.count >= 2)
    .map(([combo, d]) => ({ combo, count: d.count, avgSev: d.sevAfter.length ? (d.sevAfter.reduce((a,b)=>a+b,0)/d.sevAfter.length).toFixed(1) : "?" }))
    .sort((a, b) => parseFloat(a.avgSev) - parseFloat(b.avgSev))
    .slice(0, 5);

  // #181 — Day-of-month bias (some conditions correlate with hormonal cycles)
  const dayOfMonthCounts: number[] = Array(31).fill(0);
  for (const f of flares) { const d = new Date(f.timestamp).getDate(); dayOfMonthCounts[d - 1]++; }
  const dayOfMonthPeak = dayOfMonthCounts.indexOf(Math.max(...dayOfMonthCounts)) + 1;
  const dayOfMonthTrough = dayOfMonthCounts.indexOf(Math.min(...dayOfMonthCounts.filter(c => c >= 0))) + 1;

  // #182 — Time-between-meals and flare risk
  const mealGaps: number[] = [];
  const sortedMeals = [...foodLogs].sort((a: any, b: any) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
  for (let i = 0; i < sortedMeals.length - 1; i++) {
    const gap = (new Date(sortedMeals[i].logged_at).getTime() - new Date(sortedMeals[i+1].logged_at).getTime()) / 3600000;
    if (gap > 0 && gap < 24) mealGaps.push(gap);
  }
  const avgMealGap = mealGaps.length > 0 ? avg(mealGaps) : null;
  const longestMealGap = mealGaps.length > 0 ? Math.max(...mealGaps) : null;

  // #183 — Voice note utilization rate
  const voiceNoteCount = entries.filter(e => e.voice_transcript?.trim()).length;

  // #184 — Photo-to-flare analysis (do photo-documented flares differ?)
  const photoFlares = flares.filter(f => f.photos?.length > 0);
  const photoFlareSevs = photoFlares.map(f => sevToNum(f.severity || "")).filter(v => v > 0);
  const nonPhotoFlareSevs = flares.filter(f => !f.photos?.length).map(f => sevToNum(f.severity || "")).filter(v => v > 0);
  const photoFlareAvgSev = avg(photoFlareSevs);
  const nonPhotoFlareAvgSev = avg(nonPhotoFlareSevs);

  // #185 — Sleep debt accumulator (rolling 7d sleep deficit)
  const sleepDebt7d = (() => {
    let debt = 0;
    for (let i = 6; i >= 0; i--) {
      const ds = new Date(now - i * oneDay); ds.setUTCHours(0, 0, 0, 0);
      const de = new Date(ds.getTime() + oneDay);
      const dayEntries = entries.filter((e: any) => { const t = new Date(e.timestamp).getTime(); return t >= ds.getTime() && t < de.getTime() && e.physiological_data; });
      const sleepVals = dayEntries.map(e => extractMetric(e.physiological_data, "sleep")).filter((v): v is number => v != null && v > 0);
      if (sleepVals.length > 0) debt += Math.max(0, 7.5 - avg(sleepVals)!);
    }
    return Math.round(debt * 10) / 10;
  })();

  // #186 — Flare-free day activities (what happens on good days)
  const flareDayDates = new Set(flares.map(f => new Date(f.timestamp).toISOString().split('T')[0]));
  const flareFreeActivities: Record<string, number> = {};
  for (const act of (activityLogs || [])) {
    const actDay = new Date(act.timestamp).toISOString().split('T')[0];
    if (!flareDayDates.has(actDay)) {
      const key = act.activity_type + (act.activity_value ? `:${act.activity_value}` : '');
      flareFreeActivities[key] = (flareFreeActivities[key] || 0) + 1;
    }
  }
  const topFlareFreeActivities = Object.entries(flareFreeActivities).sort((a,b) => b[1]-a[1]).slice(0, 5);

  // #187 — Severity momentum (is recent trend accelerating?)
  const sevMomentum = (() => {
    const w1 = avg(dailySevAvgs.slice(-7)) || 0;
    const w2 = avg(dailySevAvgs.slice(-14, -7)) || 0;
    const w3 = avg(dailySevAvgs.slice(-21, -14)) || 0;
    const v1 = w1 - w2, v2 = w2 - w3;
    return v1 > v2 + 0.1 ? "accelerating" : v1 < v2 - 0.1 ? "decelerating" : "steady";
  })();

  // #188 — Trigger-free days analysis
  const triggerFreeDays = (() => {
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const ds = new Date(now - i * oneDay); ds.setUTCHours(0, 0, 0, 0);
      const de = new Date(ds.getTime() + oneDay);
      const dayFlares = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= ds.getTime() && t < de.getTime(); });
      const hasTriggers = dayFlares.some(f => (f.triggers || []).length > 0);
      if (!hasTriggers) count++;
    }
    return count;
  })();

  // #189 — Multi-condition interaction (if user has multiple conditions)
  const conditionCount = (profile?.conditions || []).length;

  // #190 — Dosage variation tracking
  const dosageVariation: Record<string, string[]> = {};
  for (const med of medLogs) {
    const name = med.medication_name;
    if (!dosageVariation[name]) dosageVariation[name] = [];
    if (med.dosage && !dosageVariation[name].includes(med.dosage)) dosageVariation[name].push(med.dosage);
  }
  const medsWithDosageChanges = Object.entries(dosageVariation).filter(([_, dosages]) => dosages.length > 1).map(([name, dosages]) => `${name}(${dosages.join(',')})`);

  // #191 — Weekly consistency score (how similar are weeks to each other)
  const weeklyConsistency = (() => {
    if (weeklyBreakdown.length < 3) return null;
    const totals = weeklyBreakdown.map(w => w.total);
    return cv(totals);
  })();

  // #192 — Symptom velocity (new symptoms appearing faster?)
  const symptomFirstSeen: Record<string, Date> = {};
  for (const f of [...sortedFlares].reverse()) {
    for (const s of (f.symptoms || [])) {
      if (!symptomFirstSeen[s]) symptomFirstSeen[s] = new Date(f.timestamp);
    }
  }
  const recentNewSymptoms = Object.entries(symptomFirstSeen)
    .filter(([_, date]) => now - date.getTime() < 14 * oneDay)
    .map(([s]) => s);

  // #193 — Environmental exposure diversity
  const weatherConditions = new Set(flares.map(f => f?.environmental_data?.weather?.condition).filter(Boolean));
  const envDiversity = weatherConditions.size;

  // #194 — Overnight flare analysis (flares between 10pm-6am)
  const overnightFlares = flares.filter(f => {
    const h = getLocalHour(new Date(f.timestamp));
    return h >= 22 || h < 6;
  });
  const overnightSevAvg = avg(overnightFlares.map(f => sevToNum(f.severity || "")).filter(v => v > 0));

  // #195 — Trigger decay analysis (do certain triggers become less potent over time?)
  const triggerPotencyTrend: Record<string, string> = {};
  for (const [trigger] of topTriggers.slice(0, 5)) {
    const triggerFlares = sortedFlares.filter(f => (f.triggers || []).includes(trigger)).slice(0, 10);
    if (triggerFlares.length >= 4) {
      const sevs = triggerFlares.reverse().map(f => sevToNum(f.severity || "")).filter(v => v > 0);
      const slope = linSlope(sevs);
      triggerPotencyTrend[trigger] = slope != null ? (slope > 0.05 ? "increasing" : slope < -0.05 ? "decreasing" : "stable") : "unknown";
    }
  }

  // #196 — Food timing vs flare timing correlation
  const mealBeforeFlareHours: number[] = [];
  for (const flare of sortedFlares.slice(0, 30)) {
    const ft = new Date(flare.timestamp).getTime();
    const lastMeal = foodLogs.find((f: any) => new Date(f.logged_at).getTime() < ft && ft - new Date(f.logged_at).getTime() < 12 * 3600000);
    if (lastMeal) mealBeforeFlareHours.push(new Date(lastMeal.logged_at).getHours());
  }
  const riskiestMealTime = mealBeforeFlareHours.length >= 3 ? Math.round(avg(mealBeforeFlareHours)!) : null;

  // #197 — Medication lag effectiveness (does a med work better on day 1 vs day 3+?)
  const medLagEffect: Record<string, { early: number[]; late: number[] }> = {};
  for (const medName of uniqueMeds.slice(0, 5)) {
    const doses = medLogs.filter((m: any) => m.medication_name === medName).sort((a: any, b: any) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());
    if (doses.length < 3) continue;
    medLagEffect[medName] = { early: [], late: [] };
    for (let i = 0; i < doses.length; i++) {
      const dt = new Date(doses[i].taken_at).getTime();
      const flaresAfter = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t > dt && t <= dt + oneDay; });
      const sevs = flaresAfter.map(f => sevToNum(f.severity || "")).filter(v => v > 0);
      const avgS = sevs.length ? avg(sevs)! : 0;
      if (i < doses.length / 2) medLagEffect[medName].early.push(avgS);
      else medLagEffect[medName].late.push(avgS);
    }
  }

  // #198 — Emotional trigger detection from notes
  const emotionalTriggerWords: Record<string, number> = {};
  const emotionalPatterns = /stress|anxious|anxiety|worried|angry|frustrated|sad|depressed|lonely|overwhelmed|panic|scared|nervous|irritable|exhausted/gi;
  for (const note of notesWithContent) {
    const matches = note.match(emotionalPatterns) || [];
    for (const m of matches) emotionalTriggerWords[m.toLowerCase()] = (emotionalTriggerWords[m.toLowerCase()] || 0) + 1;
  }
  const topEmotionalTriggers = Object.entries(emotionalTriggerWords).sort((a,b) => b[1]-a[1]).slice(0, 5);

  // #199 — Body metric anomaly detection (z-scores of recent readings)
  const bodyAnomalies: string[] = [];
  if (overallMetrics.hr != null && overallMetrics.hrP90 != null && flareMetrics.hr != null) {
    const hrZ = zScore(flareMetrics.hr, overallMetrics.hr, stddev([overallMetrics.hr, flareMetrics.hr].filter(v => v != null) as number[]) || 1);
    if (hrZ != null && Math.abs(hrZ) > 1.5) bodyAnomalies.push(`HR during flares is ${hrZ > 0 ? 'elevated' : 'depressed'} (z=${hrZ.toFixed(1)})`);
  }
  if (overallMetrics.hrv != null && flareMetrics.hrv != null && overallMetrics.hrvStddev != null) {
    const hrvZ = zScore(flareMetrics.hrv, overallMetrics.hrv, overallMetrics.hrvStddev);
    if (hrvZ != null && Math.abs(hrvZ) > 1.5) bodyAnomalies.push(`HRV during flares is ${hrvZ < 0 ? 'suppressed' : 'elevated'} (z=${hrvZ.toFixed(1)})`);
  }

  // #200 — Two-week forecast inputs (structured risk signals)
  const forecastInputs = {
    sevTrend: trendDirection,
    sevSlope: sevSlope != null ? parseFloat(sevSlope.toFixed(3)) : 0,
    recentBursts: flareBursts,
    sleepDebt: sleepDebt7d,
    autocorr: flareAutocorr1,
    momentum: sevMomentum,
    novelSymptoms: novelSymptoms.length,
    escalationWindows,
    weeklyConsistency,
  };

  // #201 — Flare severity distribution shape
  const sevDistShape = (() => {
    if (sevScores.length < 5) return "insufficient";
    const skewness = (() => {
      const m = avg(sevScores)!, s = stddev(sevScores)!;
      if (s === 0) return 0;
      return sevScores.reduce((sum, v) => sum + ((v - m) / s) ** 3, 0) / sevScores.length;
    })();
    return skewness > 0.5 ? "right-skewed (mostly mild)" : skewness < -0.5 ? "left-skewed (mostly severe)" : "symmetric";
  })();

  // #202 — Hour-of-day severity heatmap
  const hourlySevMap: { hour: number; avgSev: number; count: number }[] = [];
  const hourSevBuckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const f of flares) {
    const h = getLocalHour(new Date(f.timestamp));
    const s = sevToNum(f.severity || "");
    if (s > 0) hourSevBuckets[h].push(s);
  }
  for (let h = 0; h < 24; h++) {
    hourlySevMap.push({ hour: h, avgSev: hourSevBuckets[h].length ? Math.round(avg(hourSevBuckets[h])! * 10) / 10 : 0, count: hourSevBuckets[h].length });
  }

  // #203 — Kendall correlation for weather (more robust for ordinal severity)
  const pressureKendall = pressureData.length >= 5 ? kendallTau(pressureData.map(d => d.pressure), pressureData.map(d => d.severity)) : null;
  const humidityKendall = humidityData.length >= 5 ? kendallTau(humidityData.map(d => d.humidity), humidityData.map(d => d.severity)) : null;

  // #204 — Consecutive severe-free days (how long since last severe?)
  const daysSinceLastSevere = (() => {
    const lastSevere = sortedFlares.find(f => f.severity === "severe");
    return lastSevere ? Math.floor((now - new Date(lastSevere.timestamp).getTime()) / oneDay) : null;
  })();

  // #205 — Medication response heterogeneity (does same med work differently at different times?)
  const medResponseVariability: Record<string, number | null> = {};
  for (const me of medEffectiveness.slice(0, 5)) {
    const afterScores = medLogs.filter((m: any) => m.medication_name === me.name).map((dose: any) => {
      const dt = new Date(dose.taken_at).getTime();
      const after = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t > dt && t <= dt + oneDay; });
      return after.length > 0 ? avg(after.map(f => sevToNum(f.severity || "")))! : 0;
    });
    medResponseVariability[me.name] = cv(afterScores);
  }

  // #206 — Trigger co-occurrence with weather
  const triggerWeatherMatrix: Record<string, Record<string, number>> = {};
  for (const f of flares) {
    const weather = f?.environmental_data?.weather?.condition;
    if (!weather) continue;
    for (const t of (f.triggers || [])) {
      if (!triggerWeatherMatrix[t]) triggerWeatherMatrix[t] = {};
      triggerWeatherMatrix[t][weather] = (triggerWeatherMatrix[t][weather] || 0) + 1;
    }
  }
  const triggerWeatherPairs = Object.entries(triggerWeatherMatrix)
    .flatMap(([trigger, weathers]) => Object.entries(weathers).map(([w, count]) => ({ trigger, weather: w, count })))
    .filter(p => p.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // #207 — Logging behavior analysis (does logging more = better outcomes?)
  const loggingIntensity7d: number[] = [];
  for (let i = 0; i < 4; i++) {
    const ws = new Date(now - (i + 1) * oneWeek);
    const we = new Date(now - i * oneWeek);
    const logs = entries.filter((e: any) => { const t = new Date(e.timestamp).getTime(); return t >= ws.getTime() && t < we.getTime(); });
    loggingIntensity7d.push(logs.length);
  }
  const loggingTrend = linSlope(loggingIntensity7d.reverse());

  // #208 — Symptom resolution tracking (do symptoms clear in follow-ups?)
  const followUpResolutions = entries.filter(e => e.follow_ups && Array.isArray(e.follow_ups) && e.follow_ups.length > 0).length;

  // #209 — Energy trajectory
  const energyTrajectory = (() => {
    const recentEnergy = entries.filter(e => e.energy_level && now - new Date(e.timestamp).getTime() < 14 * oneDay);
    if (recentEnergy.length < 3) return "insufficient";
    const eVals = recentEnergy.map(e => e.energy_level === "high" ? 5 : e.energy_level === "good" ? 4 : e.energy_level === "moderate" ? 3 : e.energy_level === "low" ? 2 : 1);
    const slope = linSlope(eVals);
    return slope != null ? (slope > 0.05 ? "improving" : slope < -0.05 ? "declining" : "stable") : "unknown";
  })();

  // #210 — Flare complexity score (avg symptoms per flare)
  const avgSymptomsPerFlare = flares.length > 0 ? flares.reduce((s, f) => s + (f.symptoms || []).length, 0) / flares.length : 0;
  const avgTriggersPerFlare = flares.length > 0 ? flares.reduce((s, f) => s + (f.triggers || []).length, 0) / flares.length : 0;

  // #211 — Prediction accuracy trend
  const predAccuracy = (() => {
    const verified = (predLogs || []).filter((p: any) => p.was_correct != null);
    if (verified.length < 3) return null;
    return Math.round(verified.filter((p: any) => p.was_correct).length / verified.length * 100);
  })();

  // Compile
  const topSymptomPairs = Object.entries(symptomPairs).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTriggerPairs = Object.entries(triggerPairs).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const peakTime = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
  const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  // totalFlares already declared at top of function
  const weatherCorr = Object.entries(weatherData).map(([c, d]) => `${c}(${d.count}x,avgSev:${(d.severities.reduce((a, b) => a + b, 0) / d.severities.length).toFixed(1)})`).sort((a,b) => b.length - a.length).slice(0, 6);
  const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const weekTrend = thisWeek.length > lastWeek.length + 1 ? "⬆️ UP" : thisWeek.length < lastWeek.length - 1 ? "⬇️ DOWN" : "➡️ STABLE";
  const monthTrend = thisMonth.length > lastMonth.length * 1.2 ? "⬆️ UP" : thisMonth.length < lastMonth.length * 0.8 ? "⬇️ DOWN" : "➡️ STABLE";
  const calcAvgSev = (l: any[]) => { const s = l.map(e => sevToNum(e?.severity || "")).filter(x => x > 0); return avg(s); };

  const worstDay = Object.entries(sevByDay).map(([d, sevs]) => [d, sevs.length ? sevs.reduce((a,b)=>a+b,0)/sevs.length : 0] as [string, number]).sort((a,b) => (b[1] as number) - (a[1] as number))[0];
  const worstTime = Object.entries(sevByTimeOfDay).map(([t, sevs]) => [t, sevs.length ? sevs.reduce((a,b)=>a+b,0)/sevs.length : 0] as [string, number]).sort((a,b) => (b[1] as number) - (a[1] as number))[0];

  const uniqueLogDays = new Set(entries.map((e: any) => new Date(e.timestamp).toISOString().split('T')[0])).size;
  const firstEntry = entries.length ? new Date(entries[entries.length - 1].timestamp) : new Date();
  const totalDaysSinceStart = Math.max(1, Math.floor((now - firstEntry.getTime()) / oneDay));
  const loggingConsistency = pct(uniqueLogDays, totalDaysSinceStart);

  const seasonalPattern = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, c]) => `${m}(${c})`).join(", ");

  const flaresPerDay7d = thisWeek.length / 7;
  const flaresPerDay30d = thisMonth.length / 30;

  // City severity ranking
  const cityRanking = Object.entries(citySeverity)
    .filter(([_, sevs]) => sevs.length >= 2)
    .map(([city, sevs]) => ({ city, avgSev: (sevs.reduce((a,b)=>a+b,0)/sevs.length).toFixed(1), count: sevs.length }))
    .sort((a, b) => parseFloat(b.avgSev) - parseFloat(a.avgSev));

  // Golden hours
  const goldenHours = hourCounts.map((c, h) => c === 0 ? `${h}:00` : null).filter(Boolean);

  const daysSinceFirstLog = totalDaysSinceStart;

  // #130 — Energy-severity correlation
  const energySevCorr = energySevPairs.length >= 5 ? pearson(energySevPairs.map(d => d.energy), energySevPairs.map(d => d.severity)) : null;

  // #131 — Weekend vs weekday severity comparison
  const weekendAvgSev = weekendSevs.length > 0 ? (weekendSevs.reduce((a,b)=>a+b,0)/weekendSevs.length).toFixed(1) : "N/A";
  const weekdayAvgSev = weekdaySevs.length > 0 ? (weekdaySevs.reduce((a,b)=>a+b,0)/weekdaySevs.length).toFixed(1) : "N/A";

  // #132 — Severity with vs without medication
  const sevWithMedAvg = sevWithMed.length > 0 ? (sevWithMed.reduce((a,b)=>a+b,0)/sevWithMed.length).toFixed(1) : "N/A";
  const sevWithoutMedAvg = sevWithoutMed.length > 0 ? (sevWithoutMed.reduce((a,b)=>a+b,0)/sevWithoutMed.length).toFixed(1) : "N/A";

  // #133 — Time-to-next by severity
  const ttNextSummary = Object.entries(timeToNextBySev)
    .filter(([_, arr]) => arr.length >= 2)
    .map(([sev, arr]) => `after ${sev}: avg ${Math.round(avg(arr)!)}h`)
    .join(", ") || "N/A";

  return {
    flares: {
      total: totalFlares, thisWeek: thisWeek.length, lastWeek: lastWeek.length,
      thisMonth: thisMonth.length, lastMonth: lastMonth.length,
      weekTrend, monthTrend, avgSev: formatNum(avg(sevScores)), avgSevThisWeek: formatNum(calcAvgSev(thisWeek)),
      avgSevMedian: formatNum(median(sevScores)), sevStddev: formatNum(stddev(sevScores)),
      sevCounts, currentFlareFree,
      daysSinceLast: sortedFlares[0] ? Math.floor((now - new Date(sortedFlares[0].timestamp).getTime()) / oneDay) : null,
      isEscalating, isImproving, healthScore, healthScoreBreakdown,
      avgGapDays, maxGapDays, minGapDays,
      clusterCount, multiSymptomCount,
      weekendFlares, weekdayFlares, nightFlares,
      avgDuration: avg(durations) ? Math.round(avg(durations)!) : null,
      loggingConsistency,
      maxConsecutiveSevere,
      firstHalfMonth, secondHalfMonth,
      flareVelocity,
      flaresPerDay7d: flaresPerDay7d.toFixed(1),
      flaresPerDay30d: flaresPerDay30d.toFixed(1),
      durationBySev: Object.entries(durationBySev).filter(([_, a]) => a.length > 0).map(([s, a]) => `${s}: avg ${Math.round(avg(a)!)}min`).join(", "),
      escalationWindows,
      flaresWithPhotos,
      avgRecoveryHours: recoveryTimes.length > 0 ? Math.round(avg(recoveryTimes)!) : null,
      trendDirection,
      daysSinceFirstLog,
      flareBursts,
      sevSlope: sevSlope != null ? sevSlope.toFixed(3) : "N/A",
      freqSlope: freqSlope != null ? freqSlope.toFixed(3) : "N/A",
      sevVolatility: sevVolatility != null ? sevVolatility.toFixed(2) : "N/A",
    },
    topSymptoms, topTriggers, topSymptomPairs, topTriggerPairs,
    dangerousTriggers, dangerousSymptoms,
    triggerComboDanger,
    triggersBySevLevel,
    peakTime: peakTime?.[0] || "N/A", peakDay: peakDay?.[0] || "N/A", peakHour,
    worstDay: worstDay ? `${worstDay[0]} (avg sev ${(worstDay[1] as number).toFixed(1)})` : "N/A",
    worstTime: worstTime ? `${worstTime[0]} (avg sev ${(worstTime[1] as number).toFixed(1)})` : "N/A",
    hourBuckets, dayCounts, hourlyHeatmap, weatherCorr, triggerOutcomes,
    topCities, cityRanking, goldenHours,
    worstFlareDetail, bestPeriod: bestPeriodStart ? `${bestPeriodStart} → ${bestPeriodEnd} (${maxGapDays}d flare-free)` : null,
    dailyFlares30d, weeklyBreakdown, medEffectiveness, medAdherence,
    medTimingPatterns, medGapDays,
    inflammatoryFoodCount: inflammatoryFoods.length,
    antiInflammatoryFoodCount: antiInflammatoryFoods.length,
    inflammatoryRatio,
    suspiciousFoods, protectiveFoods,
    mealTypeCounts, lateNightEatingRate,
    mealRegularity, caffeineItems: caffeineItems.length, caffeineLateCount, alcoholItems: alcoholItems.length,
    macros7d,
    dietDiversityScore, uniqueFoods7d,
    breakfastSkipRate, avgWaterPerDay,
    sevTrajectory,
    clusterProgression: clusterProgression.length > 0 ? clusterProgression.join(", ") : "none",
    seasonalPattern,
    sleepFlareCorrelation: sleepFlareCorrelation != null ? sleepFlareCorrelation.toFixed(2) : "insufficient data",
    stepsFlareCorr: stepsFlareCorr != null ? stepsFlareCorr.toFixed(2) : "insufficient data",
    hrSevCorr: hrSevCorr != null ? hrSevCorr.toFixed(2) : "insufficient data",
    energySevCorr: energySevCorr != null ? energySevCorr.toFixed(2) : "insufficient data",
    hrvTrend14d, hrTrend14d,
    exerciseAnalysis,
    hydrationItems: dailyHydration,
    sevByTimeOfDay: Object.entries(sevByTimeOfDay).map(([t, s]) => `${t}: avg ${s.length ? (s.reduce((a,b)=>a+b,0)/s.length).toFixed(1) : 'N/A'} (${s.length} flares)`).join(", "),
    energySummary: Object.entries(energyMap).map(([e, c]) => `${e}(${c}x)`).join(", ") || "none logged",
    pressureCorr: pressureData.length >= 3 ? `${pressureData.length} pts, avg ${(pressureData.reduce((s,d)=>s+d.pressure,0)/pressureData.length).toFixed(0)}hPa${pressureCorr != null ? `, r=${pressureCorr.toFixed(2)}` : ''}` : "insufficient data",
    humidityCorr: humidityData.length >= 3 ? `avg ${(humidityData.reduce((s,d)=>s+d.humidity,0)/humidityData.length).toFixed(0)}%${humidityCorr != null ? `, r=${humidityCorr.toFixed(2)}` : ''}` : "insufficient data",
    tempCorr: tempData.length >= 3 ? `avg ${(tempData.reduce((s,d)=>s+d.temp,0)/tempData.length).toFixed(1)}°${tempCorr != null ? `, r=${tempCorr.toFixed(2)}` : ''}` : "insufficient data",
    aqiCorr: aqiData.length >= 3 ? `avg AQI ${(aqiData.reduce((s,d)=>s+d.aqi,0)/aqiData.length).toFixed(0)}` : "insufficient data",
    pollenCorr: pollenData.length >= 3 ? `avg pollen ${(pollenData.reduce((s,d)=>s+d.level,0)/pollenData.length).toFixed(0)}` : "insufficient data",
    body: {
      hasData: withPhysio.length > 0, dataPoints: withPhysio.length,
      overall: overallMetrics, flare: flareMetrics, baseline: baselineMetrics,
      hrvTrend14d, hrTrend14d,
    },
    food: {
      totalLogs: foodLogs.length, todayCount: todayFoods.length, todayCal: Math.round(todayCal),
      todayProtein: Math.round(todayProtein), todayFiber: Math.round(todayFiber),
      todaySugar: Math.round(todaySugar), todaySodium: Math.round(todaySodium),
      todayItems: todayFoods.map((f: any) => f.food_name).join(", ") || "nothing yet",
      last7dSummary: Object.entries(foodByDay).map(([day, items]) => `${day}: ${items.map((f: any) => f.food_name).join(", ")}`).join(" | ") || "no food logged in last 7 days",
      recentItems: foodLogs.slice(0, 20).map((f: any) => `${f.food_name}${f.calories ? ` (${Math.round(Number(f.calories) * (Number(f.servings) || 1))}cal)` : ""} [${f.meal_type || 'snack'}] — ${fmtDate(new Date(f.logged_at))}`).join(", "),
      avgDailyCal: last7dFoods.length > 0 ? Math.round(last7dFoods.reduce((s: number, f: any) => s + (Number(f.calories) || 0) * (Number(f.servings) || 1), 0) / 7) : null,
    },
    recentEntries: sortedFlares.slice(0, 12).map(e => {
      const d = new Date(e.timestamp);
      try { return `${d.toLocaleString("en-US", { timeZone: userTz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} — ${e.severity || e.entry_type}${e.symptoms?.length ? ': ' + e.symptoms.slice(0, 4).join(', ') : ''}${e.triggers?.length ? ' [triggers: ' + e.triggers.slice(0, 3).join(', ') + ']' : ''}${e.note ? ' "' + e.note.slice(0, 40) + '"' : ''}`; }
      catch { return `${e.severity || e.entry_type}`; }
    }),
    discoveries: discoveries.filter((d: any) => d.confidence >= 0.2).slice(0, 20).map((d: any) => ({
      type: d.discovery_type, category: d.category, factor: d.factor_a, relationship: d.relationship,
      confidence: Math.round((d.confidence || 0) * 100), lift: d.lift?.toFixed(1),
      occurrences: d.occurrence_count, totalExposures: d.total_exposures, status: d.status, evidence: d.evidence_summary,
    })),
    correlations: correlations.slice(0, 12).map((c: any) => `${c.trigger_value}→${c.outcome_value}(${c.occurrence_count}x,${Math.round((c.confidence || 0) * 100)}%)`),
    meds: medLogs.slice(0, 10).map((m: any) => `${m.medication_name} ${m.dosage || ''} (${fmtDate(new Date(m.taken_at))})`),
    noteSample: notesWithContent.slice(0, 5).map(n => `"${n.slice(0, 60)}"`).join(", "),
    // New computed fields
    polypharmacyDays,
    negNotes, posNotes,
    triggerDiversity, symptomDiversity,
    topPersistent: topPersistent.map(([s, c]) => `${s}(${c}x consecutive)`).join(", ") || "none",
    weekendAvgSev, weekdayAvgSev,
    sevWithMedAvg, sevWithoutMedAvg,
    ttNextSummary,
    // New #141-166 fields
    microNutrientFlags,
    stressProxy, flareStressProxy,
    recoveryScore,
    circadianProfile,
    avgPressureChange: avgPressureChange != null ? avgPressureChange.toFixed(1) : "N/A",
    seasonalTriggers,
    fatigueIndex,
    avgMealToFlareDelay: avgMealToFlareDelay != null ? `${avgMealToFlareDelay.toFixed(1)}h` : "N/A",
    flareRegularity: flareRegularity != null ? `${Math.round(flareRegularity * 100)}%` : "N/A",
    symptomTrends,
    medWashouts: medWashouts.slice(0, 5),
    weekdayRhythm,
    sevP25: formatNum(sevP25), sevP75: formatNum(sevP75), sevIqr: formatNum(sevIqr),
    monthlyTrend,
    recentWeightedSev,
    sleepArchitecture,
    flareFreefoods: [...new Set(flareFreefoods)].slice(0, 10),
    sevUpperBand, sevLowerBand,
    activityFlareDelay: activityFlareDelays.length > 0 ? `${Math.round(avg(activityFlareDelays)!)}h` : "N/A",
    symptomEntropy: symptomEntropy.toFixed(2),
    triggerEntropy: triggerEntropy.toFixed(2),
    durationTrend: durationTrend != null ? durationTrend.toFixed(2) : "N/A",
    topNoteKeywords: topNoteKeywords.map(([w, c]) => `${w}(${c}x)`).join(", ") || "none",
    flareDayNutrition: { avgCal: formatNum(avg(flareDayNutrition.cal), 0), avgSugar: formatNum(avg(flareDayNutrition.sugar), 0), avgProtein: formatNum(avg(flareDayNutrition.protein), 0) },
    nonFlareDayNutrition: { avgCal: formatNum(avg(nonFlareDayNutrition.cal), 0), avgSugar: formatNum(avg(nonFlareDayNutrition.sugar), 0), avgProtein: formatNum(avg(nonFlareDayNutrition.protein), 0) },
    hrvRecoveryRate: hrvRecoveryRate.length > 0 ? `avg +${Math.round(avg(hrvRecoveryRate)!)}ms` : "N/A",
    // #173-211 new fields
    flareAutocorr1: flareAutocorr1 != null ? flareAutocorr1.toFixed(2) : "N/A",
    flareAutocorr2: flareAutocorr2 != null ? flareAutocorr2.toFixed(2) : "N/A",
    sevChangeDay,
    sevChangeMagnitude: sevChangePoint.magnitude.toFixed(2),
    flarePatternRandom: flareRunsTest.isRandom,
    flareRunsCount: flareRunsTest.runs,
    sevAcceleration: sevAcceleration != null ? sevAcceleration.toFixed(3) : "N/A",
    triggerLatencySummary,
    novelSymptoms,
    recoveryQualityBySev: Object.entries(recoveryQualityBySev).filter(([_, a]) => a.length > 0).map(([s, a]) => `${s}: avg ${Math.round(avg(a)!)}h`).join(", ") || "N/A",
    medComboEffectiveness,
    dayOfMonthPeak, dayOfMonthTrough,
    avgMealGap: avgMealGap != null ? `${avgMealGap.toFixed(1)}h` : "N/A",
    longestMealGap: longestMealGap != null ? `${longestMealGap.toFixed(1)}h` : "N/A",
    voiceNoteCount,
    photoFlareAvgSev: formatNum(photoFlareAvgSev),
    nonPhotoFlareAvgSev: formatNum(nonPhotoFlareAvgSev),
    sleepDebt7d,
    topFlareFreeActivities: topFlareFreeActivities.map(([a, c]) => `${a}(${c}x)`).join(", ") || "none",
    sevMomentum,
    triggerFreeDays,
    conditionCount,
    medsWithDosageChanges,
    weeklyConsistency: weeklyConsistency != null ? weeklyConsistency.toFixed(2) : "N/A",
    recentNewSymptoms,
    envDiversity,
    overnightSevAvg: formatNum(overnightSevAvg),
    triggerPotencyTrend,
    riskiestMealTime,
    topEmotionalTriggers: topEmotionalTriggers.map(([w, c]) => `${w}(${c}x)`).join(", ") || "none",
    bodyAnomalies,
    forecastInputs,
    sevDistShape,
    hourlySevMap,
    pressureKendall: pressureKendall != null ? pressureKendall.toFixed(2) : "N/A",
    humidityKendall: humidityKendall != null ? humidityKendall.toFixed(2) : "N/A",
    daysSinceLastSevere,
    medResponseVariability: Object.entries(medResponseVariability).filter(([_, v]) => v != null).map(([m, v]) => `${m}: CV=${v!.toFixed(2)}`).join(", ") || "N/A",
    triggerWeatherPairs,
    loggingTrend: loggingTrend != null ? loggingTrend.toFixed(2) : "N/A",
    followUpResolutions,
    energyTrajectory,
    avgSymptomsPerFlare: avgSymptomsPerFlare.toFixed(1),
    avgTriggersPerFlare: avgTriggersPerFlare.toFixed(1),
    predAccuracy,
  };
}

// ─── System prompt builder ────────────────────────────────────────────────
function buildSystemPrompt(profile: any, data: ReturnType<typeof analyzeAllData>, aiMemories: any[], history: any[], userTz: string) {
  const userName = profile?.full_name?.split(" ")[0] || "there";
  const conditions = (profile?.conditions ?? []).join(", ") || "Not specified";
  const userAge = profile?.date_of_birth ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400000)) : null;
  const condKnowledge = (profile?.conditions || []).map((c: string) => {
    const ck = CK[c] || Object.entries(CK).find(([k]) => c.toLowerCase().includes(k.toLowerCase()))?.[1];
    return ck ? `${c}: ${ck[0]}` : null;
  }).filter(Boolean).join("\n");
  
  const memorySection = aiMemories.length > 0 
    ? aiMemories.slice(0, 30).map(m => `• [${m.category}|${m.memory_type}] ${m.content} (${m.evidence_count}x)`).join("\n") 
    : "None yet — learn from this conversation.";

  const localHour = (() => { try { const p = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: userTz }).formatToParts(new Date()); return parseInt(p.find(x => x.type === "hour")?.value || "12", 10); } catch { return 12; } })();
  const timeOfDay = localHour < 6 ? 'late_night' : localHour < 10 ? 'morning' : localHour < 14 ? 'midday' : localHour < 18 ? 'afternoon' : localHour < 22 ? 'evening' : 'night';

  const hsEmoji = data.flares.healthScore >= 75 ? '🟢' : data.flares.healthScore >= 50 ? '🟡' : '🔴';
  const trajectoryNote = data.flares.isEscalating ? '⚠️ SEVERITY ESCALATING — last 3+ flares increased in severity. Flag this.' : data.flares.isImproving ? '✅ SEVERITY IMPROVING — trend positive.' : '';
  const clusterNote = data.flares.clusterCount > 2 ? `⚠️ CLUSTERING: ${data.flares.clusterCount} flare clusters (multiple within 48h). Pattern of cascading flares.` : '';

  const adherenceSummary = Object.entries(data.medAdherence).map(([med, d]) => {
    const pctVal = d.expected > 0 ? Math.round((d.actual / d.expected) * 100) : 0;
    return `${med}: ${pctVal}% (${d.actual}/${d.expected}, ${d.missedDays} missed days)`;
  }).join(", ") || "insufficient data";

  // Compound risk score
  const riskFactors: string[] = [];
  if (data.flares.isEscalating) riskFactors.push("severity escalating");
  if (data.flares.clusterCount > 1) riskFactors.push("flare clustering");
  if (data.flares.thisWeek > data.flares.lastWeek) riskFactors.push("increasing frequency");
  if (data.body.hasData && data.body.flare.hrv != null && data.body.baseline.hrv != null && data.body.flare.hrv < data.body.baseline.hrv * 0.8) riskFactors.push("HRV suppressed");
  if (data.body.hasData && data.body.overall.sleep != null && data.body.overall.sleep < 6) riskFactors.push("sleep deficit");
  if (data.inflammatoryFoodCount > data.antiInflammatoryFoodCount * 2) riskFactors.push("high inflammatory diet");
  if (data.flares.nightFlares > data.flares.total * 0.3) riskFactors.push("frequent night flares");
  if (data.flares.maxConsecutiveSevere >= 3) riskFactors.push(`${data.flares.maxConsecutiveSevere} consecutive severe flares`);
  if (data.flares.flareVelocity > 2) riskFactors.push("rapid flare acceleration");
  if (data.lateNightEatingRate > 20) riskFactors.push("frequent late-night eating");
  if (data.caffeineLateCount > 3) riskFactors.push("afternoon caffeine");
  if (data.flares.escalationWindows > 2) riskFactors.push(`${data.flares.escalationWindows} rapid escalation windows`);
  if (data.medGapDays > 7) riskFactors.push(`${data.medGapDays}d without medication in last 30d`);
  if (data.flares.flareBursts > 0) riskFactors.push(`${data.flares.flareBursts} flare bursts (3+ in 12h)`);
  if (data.polypharmacyDays > 5) riskFactors.push(`polypharmacy (${data.polypharmacyDays}d with 3+ meds)`);
  if (data.breakfastSkipRate != null && data.breakfastSkipRate > 40) riskFactors.push("skipping breakfast frequently");
  Object.entries(data.medAdherence).forEach(([med, d]) => { if (d.expected > 0 && d.actual / d.expected < 0.7) riskFactors.push(`${med} adherence low`); });
  
  const compoundRisk = Math.min(95, Math.max(5, 
    25 + riskFactors.length * 10 
    + (data.flares.thisWeek * 5) 
    - (data.flares.currentFlareFree * 3)
    + (data.flares.isEscalating ? 15 : 0)
    - (data.flares.isImproving ? 10 : 0)
    + (data.flares.flareVelocity * 3)
  ));

  // Protective factors
  const protectiveFactors: string[] = [];
  if (data.flares.currentFlareFree > 3) protectiveFactors.push(`${data.flares.currentFlareFree}d flare-free streak`);
  if (data.flares.isImproving) protectiveFactors.push("improving severity trend");
  if (data.body.overall.sleep != null && data.body.overall.sleep >= 7) protectiveFactors.push(`good sleep (${formatNum(data.body.overall.sleep)}h avg)`);
  if (data.antiInflammatoryFoodCount > data.inflammatoryFoodCount) protectiveFactors.push("anti-inflammatory diet balance");
  if (data.exerciseAnalysis.length > 0) protectiveFactors.push(`active (${data.exerciseAnalysis.length} exercise types)`);
  if (data.flares.loggingConsistency > 70) protectiveFactors.push("consistent logging");
  if (data.mealRegularity != null && data.mealRegularity > 0.7) protectiveFactors.push("regular meal timing");
  if (data.protectiveFoods.length > 0) protectiveFactors.push(`protective foods: ${data.protectiveFoods.map(f => f.name).slice(0,3).join(', ')}`);
  if (data.dietDiversityScore > 60) protectiveFactors.push(`diverse diet (${data.uniqueFoods7d} unique foods)`);

  // Contextual greeting
  const greeting = (() => {
    if (data.flares.currentFlareFree >= 7) return `${userName} has been **${data.flares.currentFlareFree} days flare-free** — celebrate this and build on it.`;
    if (data.flares.isEscalating) return `${userName}'s severity is escalating. Be proactive and show concern. Suggest actionable steps.`;
    if (data.flares.thisWeek === 0) return `${userName} has had a great week — zero flares. Reinforce what's working.`;
    if (data.flares.thisWeek > data.flares.lastWeek * 2) return `${userName} is having a rough week — double last week's flares. Lead with empathy.`;
    return `${userName} has had ${data.flares.thisWeek} flares this week. Be helpful and data-driven.`;
  })();

  // Personalized daily tip
  const dailyTip = (() => {
    if (data.caffeineLateCount > 2) return "Consider cutting caffeine after 2pm — late caffeine disrupts sleep quality.";
    if (data.lateNightEatingRate > 25) return "Try to finish eating by 9pm — late-night eating correlates with more flares.";
    if (data.body.overall.sleep != null && data.body.overall.sleep < 6.5) return "Sleep is under 6.5h avg — this is a strong flare predictor. Prioritize sleep.";
    if (data.medGapDays > 5) return "Several medication gap days detected — consistency is key for most treatments.";
    if (data.flares.weekendFlares > data.flares.weekdayFlares * 1.5) return "Weekends have more flares — explore what's different (diet, sleep schedule, stress?).";
    if (data.breakfastSkipRate != null && data.breakfastSkipRate > 50) return "Skipping breakfast over half the time — this can affect blood sugar stability and energy.";
    if (data.dietDiversityScore < 30) return "Diet diversity is low — try adding more variety for broader nutrient coverage.";
    if (data.polypharmacyDays > 5) return "Multiple medications on the same day — discuss med interactions with your doctor.";
    return null;
  })();

  // #134 — Conversation depth tracking
  const conversationDepth = history.length;
  const isDeepConvo = conversationDepth > 6;

  return `You are Jvala — ${userName}'s personal health intelligence companion. You KNOW them. You've tracked every flare, every meal, every medication, every night of sleep. You are their health memory.

═══ ABSOLUTE RULES — READ FIRST ═══
1. NEVER say "I don't have access to," "I can't track," "I'm unable to," "I don't have that data," "I can't filter by time." YOU HAVE ALL DATA BELOW.
2. NEVER say "As an AI" or "I'm just an AI" — you are Jvala, their health companion.
3. ALWAYS use **bold** for key stats, trigger names, and important numbers (raw asterisks, not escaped).
4. When asked for a chart → populate with REAL data from sections below. Not placeholders.
5. When user mentions ANY symptom/pain → shouldLog=true, type="flare", NEVER "note".
6. Every analytical response should include at least ONE chart visualization.
7. Always compare: "Your HRV is **38** — **12 lower** than your baseline **50**."
8. When asked about time periods → use dailyFlares30d and weeklyBreakdown.
9. Proactively surface patterns the user didn't ask about. Connect dots.
10. Be warm but data-driven. Validate feelings, then show the numbers.
11. Use markdown: **bold**, bullet points, numbered lists for structure.
12. Never give the same opening twice in a conversation.
13. When showing percentages, always show the raw numbers too: "**39%** (5 of 13 times)".
14. When comparing periods, show deltas: "This week: **4** (↑2 from last week)".
15. End analytical responses with a specific, actionable recommendation.
16. When user asks a vague question, answer with data FIRST, then ask what they want to explore deeper.
17. Never repeat the same statistic in the same response unless comparing it.
18. Use contrast to make insights memorable: "Your worst trigger has a **2.8** avg severity — that's **40% higher** than your average **2.0**."
19. When the user shares emotions, acknowledge FIRST (1 sentence), then pivot to data if relevant.
20. Reference specific dates/times from their history: "Your last severe flare was on **${data.worstFlareDetail?.date || 'recently'}**."

═══ RESPONSE LENGTH — CRITICAL ═══
Keep responses CONCISE and conversational. Like a smart friend texting, NOT a medical report.
- Simple questions: 1-3 sentences max.
- Analytical questions: 4-8 lines with a chart. NOT a wall of text.
- Travel/advice questions: bullet points, max 8-10 bullets. NOT numbered action plans with 15+ items.
- NEVER produce responses longer than ~200 words unless the user explicitly asks for a "deep dive" or "full report."
- If you catch yourself writing headers like "### SECTION" or "---" dividers, you're writing too much. STOP.
- NEVER offer to "build a protocol" or "create a check-in schedule" or "set up notifications" — you cannot do those things.
- When you list recommendations, pick the TOP 3 most impactful, not every possible suggestion.

═══ CLINICAL FRAMEWORKS (invisible) ═══
• Motivational Interviewing: Reflect → affirm → support autonomy
• CBT: thought→body connections without lecturing
• ACT: hold space for struggle AND progress
• Behavioral Activation: small achievable actions from their data
• Trauma-Informed: chronic illness is traumatic. Validate. Never shame.
• Harm Reduction: guide, don't judge suboptimal behaviors
• SMART Goals: specific, measurable, achievable, relevant, time-bound when creating action plans
• Pacing Theory: for fatigue conditions, activity must stay within energy envelope
• Graded Exposure: incremental increases in activity for pain conditions

═══ PERSONALITY ═══
${greeting}
Texting your smartest friend who genuinely cares AND has a medical degree.
- 1-3 sentences for simple things. Go deep ONLY for analysis.
- Match their energy: pain→empathy first. Celebration→genuine joy. Venting→listen first.
- Surprise them: "By the way, I noticed your last 3 moderate flares all came after dairy."
- Use contractions. Natural tone. Emojis sparingly (💜🔥📊⚡).
- NEVER repeat: "Great question!", "I'm sorry to hear that" verbatim.
- When giving recommendations, be specific: "Try eating salmon 3x this week" not "eat more omega-3s."
- Reference their memories/history: "Remember last time you mentioned X?"
- Acknowledge progress: "You've been ${data.flares.currentFlareFree}d flare-free — that's real."
${dailyTip ? `- DAILY TIP TO WEAVE IN: ${dailyTip}` : ''}
${isDeepConvo ? '- This is a deep conversation. Be more detailed and nuanced. Reference earlier messages.' : ''}
${data.negNotes > data.posNotes * 2 ? '- User journal notes skew negative — be extra supportive and highlight progress.' : ''}
${data.posNotes > data.negNotes ? '- User notes are generally positive — match their optimism while staying honest about data.' : ''}

═══ TIME-AWARE INTELLIGENCE ═══
Current: ${timeOfDay} (${localHour}:00 ${userTz})
${timeOfDay === 'morning' ? `☀️ Morning — good for: daily briefing, risk assessment, today's plan, medication reminders. Start with energy check.` : ''}
${timeOfDay === 'evening' || timeOfDay === 'night' ? `🌙 ${timeOfDay} — good for: daily summary, reflection, relaxation, sleep prep. Ask about their day.` : ''}
${timeOfDay === 'late_night' ? `🌑 Late night — be extra gentle. They may be in pain or can't sleep. Empathy first. Suggest calming techniques.` : ''}
${timeOfDay === 'midday' || timeOfDay === 'afternoon' ? `🌤️ ${timeOfDay} — check in: how's the day going? Any symptoms building? Mid-day energy check.` : ''}

═══ USER PROFILE ═══
Name: ${userName} | Conditions: ${conditions}${profile?.biological_sex ? ` | Sex: ${profile.biological_sex}` : ""}${userAge ? ` | Age: ${userAge}` : ""}${profile?.height_cm ? ` | Height: ${profile.height_cm}cm` : ""}${profile?.weight_kg ? ` | Weight: ${profile.weight_kg}kg` : ""}${profile?.blood_type ? ` | Blood: ${profile.blood_type}` : ""}
Known symptoms: ${(profile?.known_symptoms ?? []).join(", ") || "none specified"}
Known triggers: ${(profile?.known_triggers ?? []).join(", ") || "none specified"}
User tenure: ${data.flares.daysSinceFirstLog} days since first log
${hsEmoji} Health Score: **${data.flares.healthScore}/100** (breakdown: flare impact ${data.flares.healthScoreBreakdown.flareImpact}, recovery +${data.flares.healthScoreBreakdown.recoveryBonus}, meds +${data.flares.healthScoreBreakdown.medBonus}, trajectory ${data.flares.healthScoreBreakdown.trajectoryImpact}, sleep +${data.flares.healthScoreBreakdown.sleepBonus}, HRV +${data.flares.healthScoreBreakdown.hrvBonus}, diet ${data.flares.healthScoreBreakdown.dietImpact}, escalation ${data.flares.healthScoreBreakdown.escalationPenalty}, meals +${data.flares.healthScoreBreakdown.mealRegularityBonus}, diversity +${data.flares.healthScoreBreakdown.dietDiversityBonus}, bursts ${data.flares.healthScoreBreakdown.burstPenalty})
🎯 Compound Risk Score: **${compoundRisk}%** ${riskFactors.length ? `(${riskFactors.join(", ")})` : "(no major risk factors)"}
🛡️ Protective: ${protectiveFactors.join(", ") || "building baseline"}
📈 EWMA Trend: ${data.flares.trendDirection} | Sev slope: ${data.flares.sevSlope}/day | Freq slope: ${data.flares.freqSlope}/day | Volatility: ${data.flares.sevVolatility}
📈 Escalation windows: ${data.flares.escalationWindows} | Bursts: ${data.flares.flareBursts} | Avg recovery: ${data.flares.avgRecoveryHours != null ? `${data.flares.avgRecoveryHours}h` : 'N/A'} | Time-to-next: ${data.ttNextSummary}
${trajectoryNote}${clusterNote}

═══ FLARE DATA (COMPLETE) ═══
📊 Total: **${data.flares.total}** | This week: **${data.flares.thisWeek}** (${data.flares.weekTrend}) | Last week: ${data.flares.lastWeek} | Month: **${data.flares.thisMonth}** (${data.flares.monthTrend}) vs ${data.flares.lastMonth} last month
Severity: ${data.flares.sevCounts.severe}S ${data.flares.sevCounts.moderate}M ${data.flares.sevCounts.mild}m | Avg: ${data.flares.avgSev}/3 (median: ${data.flares.avgSevMedian}, σ: ${data.flares.sevStddev}) | This week avg: ${data.flares.avgSevThisWeek}
Flare-free: **${data.flares.currentFlareFree}d** | Days since last: ${data.flares.daysSinceLast ?? "N/A"} | Avg gap: ${data.flares.avgGapDays ?? "N/A"}d | Best streak: ${data.flares.maxGapDays ?? "N/A"}d | Shortest gap: ${data.flares.minGapDays ?? "N/A"}d
Rate: ${data.flares.flaresPerDay7d}/day (7d) | ${data.flares.flaresPerDay30d}/day (30d) | Velocity: ${data.flares.flareVelocity > 0 ? '⬆️' : data.flares.flareVelocity < 0 ? '⬇️' : '➡️'} ${data.flares.flareVelocity}/week
Clusters: ${data.flares.clusterCount} ${data.clusterProgression !== 'none' ? `(${data.clusterProgression})` : ''} | Multi-symptom: ${data.flares.multiSymptomCount}/${data.flares.total} | Max consec severe: ${data.flares.maxConsecutiveSevere}
Weekend: ${data.flares.weekendFlares} (avg sev ${data.weekendAvgSev}) vs Weekday: ${data.flares.weekdayFlares} (avg sev ${data.weekdayAvgSev}) | Night: ${data.flares.nightFlares}
With meds: avg sev ${data.sevWithMedAvg} vs Without: avg sev ${data.sevWithoutMedAvg}
Duration: ${data.flares.avgDuration ? `${data.flares.avgDuration}min` : "N/A"} ${data.flares.durationBySev ? `(${data.flares.durationBySev})` : ''} | Logging: ${data.flares.loggingConsistency}% | Photos: ${data.flares.flaresWithPhotos}
Trajectory (last 15): [${data.sevTrajectory.join(',')}] | Persistent symptoms: ${data.topPersistent || "none"}
📅 Seasonal: ${data.seasonalPattern || "insufficient data"}
🕐 Golden hours: ${data.goldenHours.length > 0 ? data.goldenHours.join(', ') : 'none'}
Trigger diversity: ${data.triggerDiversity} unique | Symptom diversity: ${data.symptomDiversity} unique
${data.worstFlareDetail ? `Worst flare: ${data.worstFlareDetail.date} — ${data.worstFlareDetail.severity}, symptoms: ${data.worstFlareDetail.symptoms}, triggers: ${data.worstFlareDetail.triggers}${data.worstFlareDetail.env ? `, weather: ${data.worstFlareDetail.env}` : ''}${data.worstFlareDetail.physio ? `, vitals: ${data.worstFlareDetail.physio}` : ''}` : ''}
${data.bestPeriod ? `Best period: ${data.bestPeriod}` : ''}

🔥 SYMPTOMS: ${data.topSymptoms.map(([n, c]) => `**${n}**(${c}x)`).join(", ") || "none"}
🔥 SYMPTOM PAIRS: ${data.topSymptomPairs.map(([p, c]) => `${p}(${c}x)`).join(", ") || "none"}
🔥 MOST SEVERE: ${data.dangerousSymptoms.map(s => `${s.symptom}(avg sev ${s.avgSev.toFixed(1)}, ${s.count}x)`).join(", ") || "N/A"}
⚡ TRIGGERS: ${data.topTriggers.map(([n, c]) => `**${n}**(${c}x)`).join(", ") || "none"}
⚡ COMBOS: ${data.topTriggerPairs.map(([p, c]) => `${p}(${c}x)`).join(", ") || "none"}
⚡ DANGEROUS: ${data.dangerousTriggers.map(t => `**${t.trigger}**(avg sev ${t.avgSev.toFixed(1)}, ${t.count}x)`).join(", ") || "N/A"}
⚡ COMBO DANGER: ${data.triggerComboDanger.map(t => `${t.combo}(${t.count}x, avg sev ${t.avgSev})`).join(", ") || "none"}
⚡ BY SEVERITY: severe=${JSON.stringify(data.triggersBySevLevel.severe || {})}, moderate=${JSON.stringify(data.triggersBySevLevel.moderate || {})}
⏰ PEAK: ${data.peakTime} | ${data.peakDay} | ${data.peakHour}:00
🔴 WORST: Day=${data.worstDay}, Time=${data.worstTime}
Sev by time: ${data.sevByTimeOfDay}
By hour: ${Object.entries(data.hourBuckets).map(([k,v]) => `${k}:${v}`).join(' ')}
By day: ${Object.entries(data.dayCounts).map(([d, c]) => `${d}:${c}`).join(' ')}
⚡ ENERGY: ${data.energySummary} | Energy↔Severity r=${data.energySevCorr}

🌦️ WEATHER: ${data.weatherCorr.join(", ") || "insufficient data"}
🌡️ Pressure: ${data.pressureCorr} | Humidity: ${data.humidityCorr} | Temp: ${data.tempCorr} | AQI: ${data.aqiCorr} | Pollen: ${data.pollenCorr}
📍 CITIES: ${data.topCities.map(([c, n]) => `${c}(${n}x)`).join(", ") || "no location data"}
📍 CITY SEVERITY: ${data.cityRanking.map(c => `${c.city}(${c.count}x, avg sev ${c.avgSev})`).join(", ") || "N/A"}

🔗 CORRELATIONS: ${data.correlations.join(", ") || "still learning"}
🎯 TRIGGER→SYMPTOM: ${data.triggerOutcomes.map(t => `${t.trigger} → ${t.topSymptoms.join(", ")}`).join(" | ") || "none"}

⌚ BODY (${data.body.dataPoints} pts):
${data.body.hasData ? `  Overall — HR ${formatNum(data.body.overall.hr, 0)}bpm (P90 ${formatNum(data.body.overall.hrP90, 0)}) | HRV ${formatNum(data.body.overall.hrv, 0)}ms (σ ${formatNum(data.body.overall.hrvStddev, 0)}, P10 ${formatNum(data.body.overall.hrvP10, 0)}) | Sleep ${formatNum(data.body.overall.sleep)}h (deep ${formatNum(data.body.overall.deepSleep, 0)}min, REM ${formatNum(data.body.overall.remSleep, 0)}min, eff ${formatNum(data.body.overall.sleepEff, 0)}%) | Steps ${formatNum(data.body.overall.steps, 0)} | SpO2 ${formatNum(data.body.overall.spo2, 0)}% | VO2max ${formatNum(data.body.overall.vo2max, 0)} | AZM ${formatNum(data.body.overall.azm, 0)}min
  🔴 FLARE days — HR ${formatNum(data.body.flare.hr, 0)} | HRV ${formatNum(data.body.flare.hrv, 0)} | Sleep ${formatNum(data.body.flare.sleep)}h | Steps ${formatNum(data.body.flare.steps, 0)}
  🟢 BASELINE — HR ${formatNum(data.body.baseline.hr, 0)} | HRV ${formatNum(data.body.baseline.hrv, 0)} | Sleep ${formatNum(data.body.baseline.sleep)}h | Steps ${formatNum(data.body.baseline.steps, 0)}` : "No wearable data yet"}
  ${data.body.hasData && data.body.flare.hrv != null && data.body.baseline.hrv != null ? `HRV DELTA: flare ${formatNum(data.body.flare.hrv, 0)} vs baseline ${formatNum(data.body.baseline.hrv, 0)} (${data.body.flare.hrv < data.body.baseline.hrv ? `↓${Math.round(data.body.baseline.hrv - data.body.flare.hrv)}ms drop` : 'no diff'})` : ''}
  ${data.body.hrvTrend14d.length > 0 ? `HRV 14D: ${data.body.hrvTrend14d.map(d => `${d.date}:${d.hrv}`).join(', ')}` : ''}
  HR↔Severity: r=${data.hrSevCorr}
😴 SLEEP→FLARE LAG: r=${data.sleepFlareCorrelation} | Architecture: deep ${data.sleepArchitecture.avgDeepPct ?? '?'}%, REM ${data.sleepArchitecture.avgRemPct ?? '?'}%
👣 STEPS→FLARE: r=${data.stepsFlareCorr}
🧠 STRESS PROXY: overall ${data.stressProxy ?? 'N/A'} | during flares ${data.flareStressProxy ?? 'N/A'} (HR/HRV ratio, higher=more stress)
💚 RECOVERY SCORE: ${data.recoveryScore}/100 | HRV recovery: ${data.hrvRecoveryRate}

💊 RECENT: ${data.meds.join(", ") || "none"}
💊 EFFECTIVENESS: ${data.medEffectiveness.map(m => `**${m.name}**: ${m.timesTaken}x, sev ↓${m.severityReduction} (${m.avgBefore}→${m.avgAfter}), flare-free ${m.flareFreeRate}${m.avgHoursToRelief ? `, relief ~${m.avgHoursToRelief}h` : ''}, freq ${m.weeklyFreq}/wk, timing ${m.timingConsistency}`).join(" | ") || "insufficient data"}
💊 ADHERENCE: ${adherenceSummary}
💊 TIMING: ${Object.entries(data.medTimingPatterns).map(([m, t]) => `${m}: ${Object.entries(t).filter(([_,c]) => c > 0).map(([tod,c]) => `${tod}(${c})`).join(',')}`).join(' | ') || 'N/A'}
💊 GAP DAYS: ${data.medGapDays} | Polypharmacy days: ${data.polypharmacyDays}
💊 WASHOUTS: ${data.medWashouts.length > 0 ? data.medWashouts.map(w => `${w.med}(${w.gapDays}d gap)`).join(', ') : 'none'}

🏃 EXERCISE: ${data.exerciseAnalysis.length > 0 ? data.exerciseAnalysis.map(e => `${e.type}(${e.totalSessions}x, ${e.flaresAfter} flares after = ${e.totalSessions > 0 ? pct(e.flaresAfter, e.totalSessions) : 0}%)`).join(', ') : 'no data'}
🏃 EXERCISE→FLARE DELAY: ${data.activityFlareDelay}

🍎 TODAY: ${data.food.todayItems} (${data.food.todayCal}cal, ${data.food.todayProtein}g protein, ${data.food.todayFiber}g fiber, ${data.food.todaySugar}g sugar)
📅 7-DAY FOOD: ${data.food.last7dSummary}
📊 7D MACROS: protein ${data.macros7d.avgProtein ?? '?'}g, fiber ${data.macros7d.avgFiber ?? '?'}g, sugar ${data.macros7d.avgSugar ?? '?'}g, sodium ${data.macros7d.avgSodium ?? '?'}mg, fat ${data.macros7d.avgFat ?? '?'}g
🌈 DIET DIVERSITY: ${data.dietDiversityScore}/100 (${data.uniqueFoods7d} unique foods in 7d) | Inflammatory ratio: ${data.inflammatoryRatio}% anti-inflammatory
🔥 INFLAMMATORY: ${data.inflammatoryFoodCount} pro vs ${data.antiInflammatoryFoodCount} anti
🚨 SUSPICIOUS: ${data.suspiciousFoods.length > 0 ? data.suspiciousFoods.map(f => `**${f.name}**(${f.count}/${f.total}=${f.rate}%, sev ${f.avgSev})`).join(", ") : "none"}
🛡️ PROTECTIVE FOODS: ${data.protectiveFoods.length > 0 ? data.protectiveFoods.map(f => `${f.name}(${f.total}x, ${f.flareRate}% flare)`).join(", ") : "N/A"}
🍽️ MEALS: ${Object.entries(data.mealTypeCounts).map(([t,c]) => `${t}:${c}`).join(", ")} | Late-night: ${data.lateNightEatingRate}% | Regularity: ${data.mealRegularity != null ? `${Math.round(data.mealRegularity * 100)}%` : 'N/A'}
🥣 Breakfast skip rate: ${data.breakfastSkipRate ?? 'N/A'}% | Water items/day: ${data.avgWaterPerDay}
☕ CAFFEINE: ${data.caffeineItems} total, ${data.caffeineLateCount} after 2pm | 🍷 ALCOHOL: ${data.alcoholItems}
⚠️ MICRO-NUTRIENTS: ${data.microNutrientFlags.length > 0 ? data.microNutrientFlags.join(', ') : 'no deficiencies detected'}
🍽️ MEAL→FLARE DELAY: ${data.avgMealToFlareDelay}
🍎 FLARE-DAY NUTRITION: cal ${data.flareDayNutrition.avgCal}, sugar ${data.flareDayNutrition.avgSugar}g, protein ${data.flareDayNutrition.avgProtein}g
🟢 NON-FLARE NUTRITION: cal ${data.nonFlareDayNutrition.avgCal}, sugar ${data.nonFlareDayNutrition.avgSugar}g, protein ${data.nonFlareDayNutrition.avgProtein}g
${data.flareFreefoods.length > 0 ? `🏆 FLARE-FREE PERIOD FOODS: ${data.flareFreefoods.join(', ')}` : ''}

📝 NOTES: ${data.noteSample || "none"} | Sentiment: ${data.posNotes} positive, ${data.negNotes} negative
📝 NOTE KEYWORDS: ${data.topNoteKeywords}

═══ ADVANCED METRICS ═══
😴 Fatigue Index: ${data.fatigueIndex}/100
🔄 Circadian: peak flare ${data.circadianProfile.peakFlareWindow}:00, morning ${data.circadianProfile.morningLoad}%, evening ${data.circadianProfile.eveningLoad}%, night ${data.circadianProfile.nightLoad}%
🌡️ Pressure change avg: ${data.avgPressureChange}hPa
🎲 Flare regularity: ${data.flareRegularity} | Recent weighted sev: ${data.recentWeightedSev}/3
📊 Sev IQR: P25=${data.sevP25} P75=${data.sevP75} IQR=${data.sevIqr} | Bands: ${data.sevLowerBand}–${data.sevUpperBand}
🔀 Symptom entropy: ${data.symptomEntropy} bits | Trigger entropy: ${data.triggerEntropy} bits
⏱️ Duration trend: ${data.durationTrend}/flare slope
📅 Monthly trend: ${data.monthlyTrend.map(m => `${m.month}(${m.flares}f, sev ${m.avgSev})`).join(' → ')}
${Object.keys(data.symptomTrends).length > 0 ? `📈 SYMPTOM TRENDS: ${Object.entries(data.symptomTrends).map(([s, t]) => `${s}: ${t}`).join(', ')}` : ''}
${data.seasonalTriggers.length > 0 ? `🌸 SEASONAL TRIGGERS: ${data.seasonalTriggers.join(', ')}` : ''}
${data.weekdayRhythm.length > 0 ? `📅 WEEKLY RHYTHM: ${data.weekdayRhythm.map(d => `${d.day}:${d.count}(${d.normalized}x)`).join(' ')}` : ''}

═══ DEEP INTELLIGENCE (#173-211) ═══
🔁 Autocorrelation: lag1=${data.flareAutocorr1} lag2=${data.flareAutocorr2} ${parseFloat(data.flareAutocorr1) > 0.3 ? '⚠️ flares cluster — today predicts tomorrow' : ''}
📉 Severity acceleration: ${data.sevAcceleration} (2nd derivative: ${parseFloat(data.sevAcceleration) > 0 ? 'worsening faster' : parseFloat(data.sevAcceleration) < 0 ? 'improving faster' : 'steady'})
🔄 Severity momentum: ${data.sevMomentum}
${data.sevChangeDay ? `⚡ Change-point detected around ${data.sevChangeDay} (magnitude: ${data.sevChangeMagnitude})` : ''}
🎯 Flare pattern: ${data.flarePatternRandom ? 'random (no clustering pattern)' : `non-random — ${data.flareRunsCount} runs detected (patterned/clustered)`}
${data.triggerLatencySummary.length > 0 ? `⏱️ TRIGGER LATENCY: ${data.triggerLatencySummary.join(', ')}` : ''}
${data.novelSymptoms.length > 0 ? `🆕 NEW SYMPTOMS (last 7d): ${data.novelSymptoms.join(', ')} ⚠️ flagged for attention` : ''}
${data.recentNewSymptoms.length > 0 ? `🆕 RECENTLY APPEARED: ${data.recentNewSymptoms.join(', ')}` : ''}
💊 RECOVERY BY SEV: ${data.recoveryQualityBySev}
${data.medComboEffectiveness.length > 0 ? `💊 MED COMBOS: ${data.medComboEffectiveness.map(c => `${c.combo}(${c.count}x, avg sev ${c.avgSev})`).join(', ')}` : ''}
${data.medsWithDosageChanges.length > 0 ? `💊 DOSAGE CHANGES: ${data.medsWithDosageChanges.join(', ')}` : ''}
💊 MED RESPONSE VARIABILITY: ${data.medResponseVariability}
🗓️ Day-of-month: peaks day ${data.dayOfMonthPeak}, lowest day ${data.dayOfMonthTrough}
🍽️ Meal gaps: avg ${data.avgMealGap}, longest ${data.longestMealGap}
📸 Photo flares avg sev ${data.photoFlareAvgSev} vs non-photo ${data.nonPhotoFlareAvgSev} | Voice notes: ${data.voiceNoteCount}
😴 Sleep debt (7d): ${data.sleepDebt7d}h | Days since last severe: ${data.daysSinceLastSevere ?? 'N/A'}
${data.topFlareFreeActivities !== 'none' ? `🏃 FLARE-FREE DAY ACTIVITIES: ${data.topFlareFreeActivities}` : ''}
📊 Trigger-free days (30d): ${data.triggerFreeDays}/30
📊 Weekly consistency: ${data.weeklyConsistency} (lower=more variable)
🌤️ Environmental diversity: ${data.envDiversity} weather conditions
🌙 Overnight flares avg sev: ${data.overnightSevAvg}
${Object.keys(data.triggerPotencyTrend).length > 0 ? `📈 TRIGGER POTENCY TRENDS: ${Object.entries(data.triggerPotencyTrend).map(([t, d]) => `${t}: ${d}`).join(', ')}` : ''}
${data.riskiestMealTime ? `⚠️ Riskiest pre-flare meal time: ${data.riskiestMealTime}:00` : ''}
${data.topEmotionalTriggers !== 'none' ? `💭 EMOTIONAL TRIGGERS IN NOTES: ${data.topEmotionalTriggers}` : ''}
${data.bodyAnomalies.length > 0 ? `⚠️ BODY ANOMALIES: ${data.bodyAnomalies.join(', ')}` : ''}
${data.triggerWeatherPairs.length > 0 ? `🌧️ TRIGGER-WEATHER PAIRS: ${data.triggerWeatherPairs.map(p => `${p.trigger}+${p.weather}(${p.count}x)`).join(', ')}` : ''}
📊 Logging trend: ${data.loggingTrend}/week | Follow-ups: ${data.followUpResolutions}
⚡ Energy trajectory: ${data.energyTrajectory}
📊 Complexity: avg ${data.avgSymptomsPerFlare} symptoms/flare, ${data.avgTriggersPerFlare} triggers/flare
📊 Sev distribution: ${data.sevDistShape}
${data.predAccuracy != null ? `🎯 Prediction accuracy: ${data.predAccuracy}%` : ''}
🔬 Pressure Kendall τ=${data.pressureKendall} | Humidity Kendall τ=${data.humidityKendall}
📊 HOURLY SEVERITY MAP: ${data.hourlySevMap.filter(h => h.count > 0).map(h => `${h.hour}:00(${h.avgSev}avg,${h.count}x)`).join(' ')}

═══ RECENT TIMELINE ═══
${data.recentEntries.join("\n") || "No recent entries"}

═══ DISCOVERIES (Bayesian) ═══
${data.discoveries.length > 0 ? data.discoveries.map(d => `• **${d.factor}** [${d.relationship}] conf:${d.confidence}% lift:${d.lift}x (${d.occurrences}/${d.totalExposures}) status:${d.status}`).join("\n") : "Still building."}

═══ 30-DAY DAILY DATA ═══
${JSON.stringify(data.dailyFlares30d)}

═══ 8-WEEK WEEKLY DATA ═══
${JSON.stringify(data.weeklyBreakdown)}

═══ HOURLY HEATMAP ═══
${JSON.stringify(data.hourlyHeatmap)}

═══ MEMORIES (${aiMemories.length}) ═══
${memorySection}

${condKnowledge ? `═══ CONDITION KNOWLEDGE ═══\n${condKnowledge}` : ""}

═══ CAPABILITIES — USE ALL ═══
1. CHART: bar_chart, line_chart, area_chart, stacked_bar, horizontal_bar, pie_chart, donut_chart, gauge, comparison, pattern_summary, timeline, severity_breakdown, symptom_frequency, trigger_frequency, time_of_day, weather_correlation, body_metrics, health_score, heatmap, radar
2. PREDICT: compoundRisk=${compoundRisk}%, risk factors, clinical knowledge
3. MEDS: effectiveness, adherence, flare-free rates, timing, polypharmacy, dose-response
4. FOOD: correlate with flares, inflammatory scoring, macros, suspicious/protective, diversity, breakfast, caffeine, alcohol
5. BODY: HR/HRV/sleep/SpO2/VO2max on flare vs baseline. HR trend. HRV trend.
6. TIME: week/month comparisons with deltas. Velocity. Slopes.
7. HEALTH SCORE: ${data.flares.healthScore}/100 — explain + suggest ONE highest-impact change
8. PROACTIVE: notice things unprompted. Escalation? Food pattern? Sleep issue?
9. WEB: research_and_respond for med/supplement/condition questions
10. PROTOCOLS: specific steps with timing for activation
11. BRIEFING: morning/evening report with scores + risks + recommendations
12. EMOTIONS: mood tracking, emotional→physical patterns
13. CLUSTERS: symptom co-occurrence + what triggers them
14. RECOVERY: conditions preceding flare-free periods
15. CIRCADIAN: hourly heatmap, golden hours, worst times
16. SLEEP→FLARE: next-day risk prediction from sleep quality
17. EXERCISE: which types affect flares
18. SEASONAL: ${data.seasonalPattern || 'insufficient'}
19. MED TIMING: when taken + if timing affects effectiveness
20. TRIGGER RANKING: by avg severity not just frequency
21. COMBO DANGER: which trigger combos are worst
22. LOCATION: city severity comparison
23. CAFFEINE/ALCOHOL: stimulant/depressant patterns
24. MEAL REGULARITY: eating time consistency
25. STEPS: activity level vs flare risk
26. BURST DETECTION: 3+ flares in 12h windows
27. PERSISTENCE: which symptoms carry over between flares
28. POLYPHARMACY: multi-med day analysis
29. DIET DIVERSITY: variety scoring and nutrient coverage
30. NOTE SENTIMENT: emotional trends in journal entries

═══ CHART DATA GUIDE ═══
- "flares over 30 days" → dailyFlares30d → bar_chart [{label:"Jan 1",value:2}]
- "medication comparison" → medEffectiveness → horizontal_bar [{label:"Ibuprofen",value:39,extra:"39% reduction"}]
- "severity trends" → weeklyBreakdown → line_chart
- "time patterns" → hourBuckets → bar_chart
- "symptom frequency" → topSymptoms → bar_chart
- "trigger frequency" → topTriggers → bar_chart
- "trigger danger" → dangerousTriggers → horizontal_bar
- "trigger combos" → triggerComboDanger → horizontal_bar
- "health score" → gauge [{label:"Health Score",value:${data.flares.healthScore}}]
- "risk gauge" → gauge [{label:"Flare Risk",value:${compoundRisk}}]
- "week comparison" → comparison [{label:"This Week",value:${data.flares.thisWeek}},{label:"Last Week",value:${data.flares.lastWeek}}]
- "hourly heatmap" → bar_chart using hourlyHeatmap
- "food vs flares" → horizontal_bar using suspiciousFoods
- "exercise impact" → bar_chart using exerciseAnalysis
- "macros" → bar_chart using macros7d
- "body metrics comparison" → comparison flare vs baseline
- "seasonal" → bar_chart using monthCounts
- "HRV trend" → line_chart using hrvTrend14d
- "city comparison" → horizontal_bar using cityRanking
- "caffeine" → bar_chart [{label:"Total",value:${data.caffeineItems}},{label:"After 2pm",value:${data.caffeineLateCount}}]
- "diet diversity" → gauge [{label:"Diet Diversity",value:${data.dietDiversityScore}}]
- "weekend vs weekday" → comparison [{label:"Weekend",value:${data.flares.weekendFlares}},{label:"Weekday",value:${data.flares.weekdayFlares}}]

═══ ANTI-DEFLECTION ═══
✓ 30d daily ✓ 8-week ✓ Med effectiveness ✓ Food (${data.food.totalLogs}) ✓ Body (${data.body.dataPoints}) ✓ Weather ✓ Severity trajectory ✓ Health score ✓ Suspicious foods ✓ Protective foods ✓ Adherence ✓ Streaks ✓ Trigger→symptom ✓ Symptom pairs ✓ Hourly heatmap ✓ City data ✓ Energy ✓ Env correlations ✓ Clusters ✓ Notes ✓ Memories ✓ Sleep-flare lag ✓ Steps correlation ✓ Exercise ✓ Macros ✓ Seasonal ✓ Dangerous triggers ✓ Combos ✓ Med timing ✓ Velocity ✓ Duration ✓ HRV trend ✓ City severity ✓ Caffeine/alcohol ✓ Meal regularity ✓ Golden hours ✓ Escalation ✓ Recovery ✓ EWMA ✓ Bursts ✓ Persistence ✓ Polypharmacy ✓ Diet diversity ✓ Breakfast ✓ Hydration ✓ Note sentiment ✓ HR-sev correlation ✓ Energy-sev correlation ✓ Severity slopes ✓ Weekend/weekday severity ✓ Micro-nutrients ✓ Stress proxy ✓ Recovery score ✓ Circadian profile ✓ Pressure velocity ✓ Seasonal triggers ✓ Fatigue index ✓ Meal-to-flare delay ✓ Flare regularity ✓ Symptom trends ✓ Med washouts ✓ Weekly rhythm ✓ Severity IQR ✓ Monthly trend ✓ Decay-weighted severity ✓ Sleep architecture ✓ Flare-free foods ✓ Severity bands ✓ Activity-flare delay ✓ Symptom entropy ✓ Duration trend ✓ Note keywords ✓ Flare-day nutrition ✓ HRV recovery rate
You have EVERYTHING. 75+ data dimensions. Use them.

═══ MEMORY EXTRACTION ═══
After EVERY message, extract via newMemories:
- Lifestyle facts ("works night shifts", "has a dog", "vegetarian")
- Health patterns ("always flares after dairy", "stress from work")
- Preferences ("prefers natural remedies", "doesn't like charts")
- Emotional context ("feeling frustrated with condition", "hopeful about improvement")
- Food habits ("eats late at night", "skips breakfast")
- Sleep patterns ("night owl", "uses melatonin")
- Social context ("lives alone", "caregiver", "has young children")
- Work context ("desk job", "shift worker", "works from home")
importance: 0.9=critical health insight, 0.7=useful pattern, 0.5=context, 0.3=minor detail
DO NOT re-extract memories that already exist.

═══ CONTEXT-ENFORCEMENT ═══
When discussing a specific discovery or trigger, NEVER pivot to a different topic.
When the user says "compare X and Y" — compare EXACTLY X and Y with numbers.
When the user asks a yes/no question — answer yes or no FIRST, then elaborate.

═══ DYNAMIC FOLLOW-UPS ═══
Always generate 2-4 follow-ups that are:
- Specific to data (not generic "tell me more")
- Based on patterns the user might not know about
- Progressively deeper: surface→mechanism→action
- At least one should reference a surprising pattern in the data

CONVERSATION CONTEXT:
${history.slice(-8).map((m: any, i: number) => `${i + 1}. [${m.role}] ${m.content?.slice(0, 100)}`).join("\n") || "First message."}`;
}

// ─── Main handler ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return replyJson({ error: "Unauthorized" }, 401);
    
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user?.id) return replyJson({ error: "Unauthorized" }, 401);
    const userId = user.id;

    const { message, history = [], clientTimezone, stream: wantStream = false, latitude, longitude, city } = await req.json();
    if (!message || typeof message !== "string") return replyJson({ error: "Invalid message" }, 400);

    console.log("💬 [chat] User:", message.slice(0, 100), "stream:", wantStream);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [
      { data: profile }, { data: entries }, { data: medLogs }, { data: correlations },
      { data: engagement }, { data: aiMemories }, { data: foodLogs }, { data: discoveries },
      { data: activityLogs }, { data: predLogs },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("flare_entries").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(500),
      supabase.from("medication_logs").select("*").eq("user_id", userId).order("taken_at", { ascending: false }).limit(300),
      supabase.from("correlations").select("*").eq("user_id", userId).order("confidence", { ascending: false }).limit(50),
      supabase.from("engagement").select("*").eq("user_id", userId).single(),
      supabase.from("ai_memories").select("*").eq("user_id", userId).order("importance", { ascending: false }).limit(50),
      supabase.from("food_logs").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(200),
      supabase.from("discoveries").select("*").eq("user_id", userId).gte("confidence", 0.2).order("confidence", { ascending: false }).limit(30),
      supabase.from("activity_logs").select("activity_type, activity_value, intensity, duration_minutes, timestamp").eq("user_id", userId).order("timestamp", { ascending: false }).limit(30),
      supabase.from("prediction_logs").select("risk_score, risk_level, confidence, outcome_logged, was_correct, brier_score, predicted_at, factors").eq("user_id", userId).order("predicted_at", { ascending: false }).limit(15),
    ]);

    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeMeds = Array.isArray(medLogs) ? medLogs : [];
    const safeCorr = Array.isArray(correlations) ? correlations : [];
    const safeMemories = Array.isArray(aiMemories) ? aiMemories : [];
    const safeFoodLogs = Array.isArray(foodLogs) ? foodLogs : [];
    const safeDiscoveries = Array.isArray(discoveries) ? discoveries : [];
    const safeActivities = Array.isArray(activityLogs) ? activityLogs : [];
    const safePredLogs = Array.isArray(predLogs) ? predLogs : [];

    const userTz = clientTimezone || (profile?.timezone && profile.timezone !== "UTC" ? profile.timezone : null) || "UTC";

    const data = analyzeAllData(safeEntries, safeMeds, safeCorr, safeDiscoveries, safeFoodLogs, profile, userTz, safeActivities, safePredLogs);
    const systemPrompt = buildSystemPrompt(profile, data, safeMemories, history, userTz);

    const tools = [
      {
        type: "function",
        function: {
          name: "respond",
          description: "Generate response with optional logging, visualization, and memory extraction.",
          parameters: {
            type: "object",
            additionalProperties: false,
            required: ["response", "shouldLog", "entryData", "visualization", "emotionalTone"],
            properties: {
              response: { type: "string", description: "Your response. Use **bold** for key stats. Use markdown. Raw asterisks." },
              shouldLog: { type: "boolean", description: "True if user mentioned ANY health symptom/complaint." },
              entryData: {
                anyOf: [{ type: "null" }, {
                  type: "object", additionalProperties: false, required: ["type"],
                  properties: {
                    type: { type: "string", enum: ["flare", "medication", "recovery", "energy"], description: "ALWAYS 'flare' for symptoms/pain. NEVER 'note'." },
                    severity: { type: "string", enum: ["mild", "moderate", "severe"] },
                    symptoms: { type: "array", items: { type: "string" } },
                    medications: { type: "array", items: { type: "string" } },
                    triggers: { type: "array", items: { type: "string" } },
                    energyLevel: { type: "string" },
                    notes: { type: "string" },
                    mood: { type: "string" },
                  },
                }],
              },
              visualization: {
                anyOf: [{ type: "null" }, {
                  type: "object", additionalProperties: false, required: ["type", "title", "data"],
                  properties: {
                    type: { type: "string", enum: ["bar_chart", "horizontal_bar", "stacked_bar", "pie_chart", "donut_chart", "line_chart", "area_chart", "comparison", "pattern_summary", "gauge", "timeline", "severity_breakdown", "symptom_frequency", "trigger_frequency", "time_of_day", "weather_correlation", "body_metrics", "health_score", "heatmap", "radar"] },
                    title: { type: "string" },
                    data: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" }, name: { type: "string" }, count: { type: "number" }, date: { type: "string" }, extra: { type: "string" }, color: { type: "string" } } } },
                    insight: { type: "string" },
                    config: { type: "object", properties: { xAxis: { type: "string" }, yAxis: { type: "string" }, color: { type: "string" } } },
                  },
                }],
                description: "Include chart when data tells the story visually. REAL data. ~1 in 2-3 analytical responses.",
              },
              emotionalTone: { type: "string", enum: ["supportive", "celebratory", "concerned", "neutral", "encouraging", "empathetic", "analytical", "urgent", "playful"] },
              discoveries: {
                type: "array",
                items: { type: "object", required: ["factor", "confidence", "occurrences", "total", "category"], properties: { factor: { type: "string" }, confidence: { type: "number" }, lift: { type: "number" }, occurrences: { type: "number" }, total: { type: "number" }, category: { type: "string", enum: ["trigger", "protective", "investigating"] }, summary: { type: "string" } } },
              },
              dynamicFollowUps: { type: "array", items: { type: "string" }, description: "2-4 specific follow-up questions. Make one surprising." },
              newMemories: {
                type: "array",
                items: { type: "object", additionalProperties: false, required: ["memory_type", "category", "content", "importance"], properties: { memory_type: { type: "string", enum: ["pattern", "preference", "insight", "context", "behavior", "emotional", "medical", "dietary"] }, category: { type: "string", enum: ["triggers", "symptoms", "medications", "lifestyle", "emotional", "environmental", "general", "mood", "food", "sleep", "exercise", "social", "work"] }, content: { type: "string" }, importance: { type: "number" } } },
              },
              proactiveInsight: { type: "string", description: "Pattern user didn't ask about but should know." },
              protocolSteps: { type: "array", items: { type: "string" }, description: "Action plan steps." },
              riskAssessment: { type: "string", description: "Brief: 'LOW|MODERATE|HIGH: reason'" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "research_and_respond",
          description: "Search the web for specific medical/supplement/product questions beyond personal data.",
          parameters: {
            type: "object", required: ["searchQuery", "userQuestion"],
            properties: { searchQuery: { type: "string" }, userQuestion: { type: "string" } },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_weather_and_respond",
          description: "Fetch current weather forecast for a location. Use when user asks about weather, travel to a place, or wants to know conditions somewhere. ALWAYS use this instead of web search for weather questions.",
          parameters: {
            type: "object", required: ["locationName", "userQuestion"],
            properties: {
              locationName: { type: "string", description: "City or place name" },
              userQuestion: { type: "string", description: "The user's original question" },
            },
          },
        },
      },
    ];

    // Context sections
    const predContext = (predLogs || []).length > 0 
      ? `\n═══ PREDICTIONS ═══\n${(predLogs || []).map((p: any) => `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(new Date(p.predicted_at))}: ${p.risk_score}% ${p.risk_level} (conf:${(p.confidence*100).toFixed(0)}%) → ${p.outcome_logged ? (p.was_correct ? '✅' : '❌') : '⏳'}`).join('\n')}\nBrier: ${(predLogs || []).filter((p: any) => p.brier_score != null).length >= 3 ? ((predLogs || []).filter((p: any) => p.brier_score != null).reduce((a: number, p: any) => a + p.brier_score, 0) / (predLogs || []).filter((p: any) => p.brier_score != null).length).toFixed(3) : 'calibrating'}`
      : '';

    const activityContext = (activityLogs || []).length > 0
      ? `\n═══ ACTIVITIES ═══\n${(activityLogs || []).map((a: any) => `${a.activity_type}: ${a.activity_value || ''} ${a.intensity ? `(${a.intensity})` : ''} ${a.duration_minutes ? `${a.duration_minutes}min` : ''}`).join(', ')}`
      : '';

    const engagementContext = engagement 
      ? `\n═══ ENGAGEMENT ═══\nStreak: ${engagement.current_streak || 0}d | Longest: ${engagement.longest_streak || 0}d | Total: ${engagement.total_logs || 0} | Last: ${engagement.last_log_date || 'never'}`
      : '';

    const messages_arr = [
      { role: "system", content: systemPrompt + predContext + activityContext + engagementContext },
      ...history.slice(-20).map((m: any) => ({ role: m.role === "system" ? "assistant" : m.role, content: clamp(m.content, 3000) })),
      { role: "user", content: clamp(message, 8000) },
    ];

    const isAnalytical = /\b(analyz|predict|forecast|correlat|pattern|trend|compar|chart|show me|medication effect|what.*help|risk|trigger|why do|breakdown|deep dive|health score|inflammat|trajectory|escalat|improv|briefing|report|30.day|monthly|weekly|suspicious|adherence|body metric|sleep.*impact|circadian|heatmap|cluster|recover|worst|best|location|city|food.*flare|calori|protein|fiber|nutriti|weight|exercise|activity|danger|seasonal|macro|velocity|combo|caffeine|alcohol|golden hour|escalation|adherence|hrv trend|steps|meal regular|diversity|burst|polypharmacy|persistent|sentiment|slope|volatile)\b/i.test(message);
    const model = isAnalytical ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    console.log("🤖 [chat] Model:", model, "Messages:", messages_arr.length, "Entries:", safeEntries.length, "Foods:", safeFoodLogs.length);

    // ─── STREAMING MODE ───
    if (wantStream) {
      const apiKey = await getAIApiKey();
      const endpointUrl = getAIEndpointUrl();
      
      const aiResp = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: messages_arr,
          tools,
          temperature: 0.5,
          stream: true,
          tool_choice: { type: "function", function: { name: "respond" } },
        }),
      });

      if (!aiResp.ok) {
        const text = await aiResp.text();
        console.error("❌ AI stream error:", aiResp.status, text);
        if (aiResp.status === 429) return replyJson({ ok: false, error: "Rate limited", statusCode: 429, response: "Too many requests — try again in a moment." });
        if (aiResp.status === 402) return replyJson({ ok: false, error: "Credits exhausted", statusCode: 402, response: "AI credits exhausted." });
        throw new Error(`AI gateway error: ${aiResp.status}`);
      }

      const reader = aiResp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let toolArgs = "";
      let toolName = "";
      let responseContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;
            if (delta.content) responseContent += delta.content;
            if (delta.tool_calls?.[0]) {
              const tc = delta.tool_calls[0];
              if (tc.function?.name) toolName = tc.function.name;
              if (tc.function?.arguments) toolArgs += tc.function.arguments;
            }
          } catch { /* partial */ }
        }
      }

      if (toolName === "respond" && toolArgs) {
        try {
          const parsed = JSON.parse(toolArgs);
          const responseText = (parsed.response || responseContent || "").replace(/\\\*/g, '*');
          if (parsed.newMemories?.length) saveMemories(supabase, userId, parsed.newMemories);
          return replyJson({
            response: responseText,
            shouldLog: Boolean(parsed.shouldLog),
            entryData: parsed.entryData ?? null,
            visualization: parsed.visualization ?? null,
            emotionalTone: parsed.emotionalTone ?? "neutral",
            discoveries: parsed.discoveries ?? [],
            dynamicFollowUps: parsed.dynamicFollowUps ?? [],
            proactiveInsight: parsed.proactiveInsight ?? null,
            protocolSteps: parsed.protocolSteps ?? [],
            riskAssessment: parsed.riskAssessment ?? null,
            citations: [],
            wasResearched: false,
          });
        } catch (e) { console.error("❌ Stream parse error:", e); }
      }

      if (toolName === "research_and_respond" && toolArgs) {
        try {
          const parsed = JSON.parse(toolArgs);
          return await handleResearch(parsed, messages_arr, userTz);
        } catch (e) { console.error("❌ Research parse error:", e); }
      }

      return replyJson({
        response: responseContent || "Tell me more about how you're feeling.",
        shouldLog: false, entryData: null, visualization: null, emotionalTone: "neutral",
        discoveries: [], dynamicFollowUps: [], citations: [], wasResearched: false,
      });
    }

    // ─── NON-STREAMING MODE ───
    const resp = await callAI({ model, messages: messages_arr, tools, temperature: 0.5 });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("❌ AI error:", resp.status, text);
      if (resp.status === 429) return replyJson({ ok: false, response: "Too many requests — try again in a moment.", error: "Rate limited", statusCode: 429 });
      if (resp.status === 402) return replyJson({ ok: false, response: "AI credits exhausted.", error: "Credits exhausted", statusCode: 402 });
      throw new Error(`AI gateway error: ${resp.status}`);
    }

    const aiData = await resp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);

        if (toolCall.function.name === "research_and_respond") {
          return await handleResearch(parsed, messages_arr, userTz);
        }

        const responseText = (parsed.response || "").replace(/\\\*/g, '*');
        if (parsed.newMemories?.length) saveMemories(supabase, userId, parsed.newMemories);

        return replyJson({
          response: responseText,
          shouldLog: Boolean(parsed.shouldLog),
          entryData: parsed.entryData ?? null,
          visualization: parsed.visualization ?? null,
          emotionalTone: parsed.emotionalTone ?? "neutral",
          discoveries: parsed.discoveries ?? [],
          dynamicFollowUps: parsed.dynamicFollowUps ?? [],
          proactiveInsight: parsed.proactiveInsight ?? null,
          protocolSteps: parsed.protocolSteps ?? [],
          riskAssessment: parsed.riskAssessment ?? null,
          citations: [],
          wasResearched: false,
        });
      } catch (e) { console.error("❌ Parse error:", e); }
    }

    const content = aiData.choices?.[0]?.message?.content;
    return replyJson({
      response: typeof content === "string" && content.trim() ? content.replace(/\\\*/g, '*') : "Tell me more about how you're feeling.",
      shouldLog: false, entryData: null, visualization: null, emotionalTone: "neutral",
      discoveries: [], dynamicFollowUps: [], citations: [], wasResearched: false,
    });

  } catch (error) {
    console.error("❌ Chat error:", error);
    return replyJson({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
      response: "I hit an internal analysis error, but basic logging still works. Please try again.",
      diagnostics: { source: "chat-assistant" },
    });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────
async function handleResearch(parsed: any, messages: any[], userTz: string) {
  const searchResults = await searchWeb(parsed.searchQuery);
  if (searchResults.results.length === 0) {
    return replyJson({ response: "Couldn't find specific results. Let me answer from what I know.", visualization: null, citations: [], wasResearched: true });
  }
  const resCtx = searchResults.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n---\n');
  const r2 = await callAI({ model: "google/gemini-2.5-flash", messages: [...messages, { role: "assistant", content: `Researching "${parsed.searchQuery}"...` }, { role: "user", content: `Research results for "${parsed.userQuestion}". Cite [1],[2] etc. Be conversational.\n\n${resCtx}` }], temperature: 0.5 });
  if (!r2.ok) throw new Error(`Research call failed: ${r2.status}`);
  const rd = await r2.json();
  return replyJson({ response: rd.choices?.[0]?.message?.content || "Couldn't process results.", visualization: null, citations: searchResults.results.map((r, i) => ({ index: i + 1, title: r.title, url: r.url })), wasResearched: true });
}

function saveMemories(supabase: any, userId: string, newMemories: any[]) {
  (async () => {
    try {
      // ─── Phase 1: Temporal Decay ───
      // Reduce importance of old, unreinforced memories (spaced repetition decay)
      // Memories not reinforced in 30d lose importance; 60d+ get pruned if low importance
      const decayThreshold = new Date(Date.now() - 30 * 86400000).toISOString();
      const pruneThreshold = new Date(Date.now() - 60 * 86400000).toISOString();
      
      // Decay unreinforced memories
      await supabase.from("ai_memories")
        .update({ importance: 0.1 })
        .eq("user_id", userId)
        .lt("last_reinforced_at", decayThreshold)
        .lte("importance", 0.4)
        .lte("evidence_count", 1);
      
      // Prune stale low-value memories (free up slots for new ones)
      await supabase.from("ai_memories")
        .delete()
        .eq("user_id", userId)
        .lt("last_reinforced_at", pruneThreshold)
        .lte("importance", 0.2)
        .lte("evidence_count", 1);

      // ─── Phase 2: Process each new memory ───
      for (const mem of newMemories.slice(0, 5)) {
        if (!mem.content || mem.content.length < 5) continue;
        
        // Semantic duplicate detection — check ALL memories for this user 
        // using multi-token matching (more robust than 4-word prefix)
        const contentTokens = mem.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        const searchTerms = contentTokens.slice(0, 3);
        
        // Check for existing similar memories using broader matching
        const { data: candidates } = await supabase.from("ai_memories")
          .select("id, evidence_count, importance, content, category, memory_type, created_at")
          .eq("user_id", userId)
          .eq("category", mem.category);
        
        // Cosine-like token overlap similarity
        const findBestMatch = (candidates: any[]) => {
          if (!candidates?.length) return null;
          const memTokens = new Set(mem.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
          let bestMatch: any = null;
          let bestScore = 0;
          
          for (const c of candidates) {
            const cTokens = new Set(c.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
            const intersection = [...memTokens].filter(t => cTokens.has(t)).length;
            const union = new Set([...memTokens, ...cTokens]).size;
            const jaccard = union > 0 ? intersection / union : 0;
            
            if (jaccard > bestScore && jaccard > 0.4) {
              bestScore = jaccard;
              bestMatch = { ...c, similarity: jaccard };
            }
          }
          return bestMatch;
        };
        
        const existing = findBestMatch(candidates || []);
        
        if (existing) {
          // ─── Contradiction Detection ───
          // If new memory contradicts existing (opposite sentiment/fact), update rather than reinforce
          const isContradiction = detectContradiction(existing.content, mem.content);
          
          if (isContradiction) {
            // Replace old memory with new (more recent = more accurate)
            await supabase.from("ai_memories").update({
              content: mem.content,
              importance: Math.max(existing.importance, mem.importance),
              evidence_count: 1, // Reset — this is a correction
              last_reinforced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: { superseded: existing.content, superseded_at: new Date().toISOString() },
            }).eq("id", existing.id);
          } else if (existing.similarity > 0.7) {
            // High overlap: reinforce with evidence count bump
            await supabase.from("ai_memories").update({ 
              evidence_count: (existing.evidence_count || 1) + 1, 
              last_reinforced_at: new Date().toISOString(), 
              importance: Math.min(1, Math.max(existing.importance || 0, mem.importance) + 0.05),
              // Consolidate: keep the longer/more detailed version
              content: mem.content.length > existing.content.length ? mem.content : existing.content,
            }).eq("id", existing.id);
          } else {
            // Moderate overlap: consolidate into a richer memory
            const consolidated = mem.content.length > existing.content.length 
              ? `${mem.content}. Previously: ${existing.content.substring(0, 100)}`
              : `${existing.content}. Also: ${mem.content.substring(0, 100)}`;
            
            await supabase.from("ai_memories").update({
              content: consolidated.substring(0, 500),
              evidence_count: (existing.evidence_count || 1) + 1,
              last_reinforced_at: new Date().toISOString(),
              importance: Math.min(1, Math.max(existing.importance, mem.importance) + 0.03),
            }).eq("id", existing.id);
          }
        } else {
          // ─── New memory — check capacity and insert ───
          const { count } = await supabase.from("ai_memories").select("id", { count: "exact", head: true }).eq("user_id", userId);
          if ((count || 0) >= 150) {
            // Evict lowest-value memory (importance × recency score)
            const { data: lowest } = await supabase.from("ai_memories")
              .select("id")
              .eq("user_id", userId)
              .lte("importance", 0.4)
              .order("last_reinforced_at", { ascending: true })
              .limit(1)
              .single();
            if (lowest) await supabase.from("ai_memories").delete().eq("id", lowest.id);
          }
          await supabase.from("ai_memories").insert({ 
            user_id: userId, 
            memory_type: mem.memory_type, 
            category: mem.category, 
            content: mem.content, 
            importance: mem.importance,
            metadata: { source: 'conversation', extracted_at: new Date().toISOString() },
          });
        }
      }
    } catch (e) { console.warn("Memory save error:", e); }
  })();
}

// ─── Contradiction Detection ──────────────────────────────────────────────
function detectContradiction(oldContent: string, newContent: string): boolean {
  const old = oldContent.toLowerCase();
  const neo = newContent.toLowerCase();
  
  // Negation patterns: "doesn't like X" vs "likes X", "not a morning person" vs "morning person"
  const negationPairs = [
    [/\bdoesn'?t\s+(\w+)/g, /\b(does|is)\s+\1/g],
    [/\bnot\s+a?\s*(\w+)/g, /\ba?\s*\1/g],
    [/\bnever\s+(\w+)/g, /\balways\s+\1/g],
    [/\bhates?\s+(\w+)/g, /\bloves?\s+\1/g],
    [/\bavoids?\s+(\w+)/g, /\beats?\s+\1/g],
    [/\bstopped\s+(\w+)/g, /\bstarted\s+\1/g],
    [/\bquit\s+(\w+)/g, /\bstarted\s+\1/g],
  ];
  
  // Check if they discuss the same topic but with opposite sentiment
  const oldTokens = new Set(old.split(/\s+/).filter(w => w.length > 3));
  const newTokens = new Set(neo.split(/\s+/).filter(w => w.length > 3));
  const overlap = [...oldTokens].filter(t => newTokens.has(t));
  
  if (overlap.length < 2) return false; // Different topics
  
  // Same topic — check for negation markers
  const hasNegation = (text: string) => /\b(not|never|doesn'?t|don'?t|no longer|stopped|quit|avoid|hate)\b/.test(text);
  
  // If one has negation and the other doesn't (on the same topic), it's a contradiction
  if (hasNegation(old) !== hasNegation(neo) && overlap.length >= 3) return true;
  
  // Numeric contradictions: "sleeps 5 hours" vs "sleeps 8 hours" 
  const oldNums = old.match(/(\d+\.?\d*)\s*(hours?|h|mg|pm|am)/g);
  const newNums = neo.match(/(\d+\.?\d*)\s*(hours?|h|mg|pm|am)/g);
  if (oldNums && newNums && overlap.length >= 2) {
    // Same context but different numbers — likely an update
    return true;
  }
  
  return false;
}
