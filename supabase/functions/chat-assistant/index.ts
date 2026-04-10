import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, getAIApiKey, getAIEndpointUrl } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const replyJson = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clamp = (str: unknown, max = 2000): string => {
  const s = typeof str === "string" ? str : String(str ?? "");
  return s.length > max ? s.slice(0, max) : s;
};

const sevToNum = (s: string) => s === "mild" ? 1 : s === "moderate" ? 2 : s === "severe" ? 3 : 0;
const avg = (arr: number[]): number | null => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const formatNum = (n: number | null, d = 1): string => n == null ? "N/A" : d === 0 ? String(Math.round(n)) : n.toFixed(d);

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

// ─── Expanded condition knowledge (30+ conditions) ────────────────────────
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
  'Crohn\'s Disease': ['Avoid NSAIDs. Stress not a cause but worsens. Low-residue diet during flares. Vitamin B12/iron/D deficiency common.', 'After meals, morning urgency, after fatty/high-fiber, stress, post-NSAID, cold weather'],
  'Ulcerative Colitis': ['Left-sided most common. Probiotics (E. coli Nissle) as effective as mesalamine for maintenance. Nighttime symptoms=severe.', 'After meals, morning, stress, after dairy, nighttime urgency, seasonal transitions'],
  'Osteoarthritis': ['Weight: each 1lb lost = 4lb less knee load. Worst after inactivity(gelling). Humid+cold=worse. Glucosamine+chondroitin mixed evidence.', 'Morning stiffness(short), after sitting, weather changes, after overuse, evening, stairs/hills'],
  'Insomnia': ['Sleep restriction therapy most effective. CBT-I > medication. Blue light 2h before bed. Core body temp must drop 1-2°F.', 'Bedtime routine, caffeine cutoff(2pm), evening stress, screen time, exercise timing'],
  'ADHD': ['Medication timing critical. Protein breakfast improves efficacy. Exercise 30min = methylphenidate. Screen time worsens.', 'Morning routine/medication, transitions between tasks, afternoon slump, evening wind-down, meal timing'],
  'Chronic Pain': ['Gate control theory. Cold therapy=acute, heat=chronic. Catastrophizing strongest predictor. Graded exposure.', 'Morning assessment, after activity, weather changes, stress, sleep quality, social isolation'],
  'Heart Disease': ['Resting HR >75=concern. HRV critical biomarker. Mediterranean diet gold standard. Omega-3 2-4g/day.', 'Morning vitals, post-exercise, stress, after meals, medication timing, sleep apnea screening'],
  'Hypertension': ['White coat effect +20-30mmHg. Home monitoring essential. DASH diet. Potassium 3500-5000mg/day. Sleep apnea in 50%.', 'Morning readings, post-exercise, stress, sodium intake, medication timing, alcohol'],
  'Gout': ['Uric acid >6.8mg/dL crystallizes. Purines: organ meats, shellfish, beer. Cherry extract 500mg 2x/day. Hydration critical.', 'After high-purine meals, after alcohol(especially beer), dehydration, morning, cold weather'],
  'Rosacea': ['Triggers: heat, sun, alcohol, spicy, stress. Demodex mites. Azelaic acid 15% effective. SPF critical.', 'After spicy/hot food, sun exposure, after alcohol, hot showers, stress, temperature changes'],
  'Tinnitus': ['Stress/anxiety amplifies perception. Masking sounds. TMJ in 30%. Caffeine controversial. Hearing loss correlation.', 'Quiet environments, stress, jaw clenching, after loud exposure, sleep time, caffeine'],
  'Vertigo': ['BPPV most common. Epley maneuver 80% effective. Vestibular migraine underdiagnosed. Avoid quick head turns.', 'Position changes, morning, after head movement, stress, menstrual cycle, dehydration'],
};

// ─── Data analysis ────────────────────────────────────────────────────────
function analyzeAllData(entries: any[], medLogs: any[], correlations: any[], discoveries: any[], foodLogs: any[], profile: any, userTz: string) {
  const now = Date.now();
  const oneDay = 86400000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;
  const flares = entries.filter((e: any) => e?.entry_type === "flare" || e?.severity);
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

  const sevCounts = { mild: 0, moderate: 0, severe: 0 };
  const sevScores: number[] = [];
  const symptomCounts: Record<string, number> = {};
  const triggerCounts: Record<string, number> = {};
  const hourBuckets: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const dayCounts: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  const weatherData: Record<string, { count: number; severities: number[] }> = {};

  const thisWeek = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneWeek);
  const lastWeek = flares.filter((e: any) => { const a = now - new Date(e.timestamp).getTime(); return a >= oneWeek && a < 2 * oneWeek; });
  const thisMonth = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneMonth);
  const lastMonth = flares.filter((e: any) => { const a = now - new Date(e.timestamp).getTime(); return a >= oneMonth && a < 2 * oneMonth; });

  for (const e of flares) {
    const sev = e?.severity as string;
    if (sev === "mild" || sev === "moderate" || sev === "severe") sevCounts[sev]++;
    const score = sevToNum(sev);
    if (score) sevScores.push(score);
    for (const s of e?.symptoms ?? []) symptomCounts[s] = (symptomCounts[s] || 0) + 1;
    for (const t of e?.triggers ?? []) triggerCounts[t] = (triggerCounts[t] || 0) + 1;
    const d = new Date(e.timestamp);
    const h = getLocalHour(d);
    hourBuckets[getTimeOfDay(h)]++;
    const dayKey = getLocalDay(d);
    if (dayCounts[dayKey] !== undefined) dayCounts[dayKey]++;
    const w = e?.environmental_data?.weather?.condition || e?.environmental_data?.condition;
    if (typeof w === "string" && w.trim()) {
      if (!weatherData[w]) weatherData[w] = { count: 0, severities: [] };
      weatherData[w].count++;
      if (score) weatherData[w].severities.push(score);
    }
  }

  let currentFlareFree = 0;
  if (sortedFlares.length > 0) {
    currentFlareFree = Math.floor((now - new Date(sortedFlares[0].timestamp).getTime()) / oneDay);
  }

  // Daily flares 30d
  const dailyFlares30d: any[] = [];
  for (let i = 29; i >= 0; i--) {
    const ds = new Date(now - i * oneDay); ds.setUTCHours(0, 0, 0, 0);
    const de = new Date(ds.getTime() + oneDay);
    const df = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= ds.getTime() && t < de.getTime(); });
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(ds);
    dailyFlares30d.push({ date: label, flares: df.length, mild: df.filter((f: any) => f.severity === 'mild').length, moderate: df.filter((f: any) => f.severity === 'moderate').length, severe: df.filter((f: any) => f.severity === 'severe').length });
  }

  // Weekly breakdown 8 weeks
  const weeklyBreakdown: any[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(now - (i + 1) * oneWeek), we = new Date(now - i * oneWeek);
    const wf = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= ws.getTime() && t < we.getTime(); });
    const sl = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(ws);
    const el = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(we);
    weeklyBreakdown.push({ week: `${sl}–${el}`, total: wf.length, avgSev: wf.length ? (wf.reduce((s: number, f: any) => s + sevToNum(f.severity || ""), 0) / wf.length).toFixed(1) : "0" });
  }

  // Medication effectiveness
  const medEffectiveness: any[] = [];
  const uniqueMeds = [...new Set(medLogs.map((m: any) => m.medication_name))];
  for (const medName of uniqueMeds.slice(0, 10)) {
    const doses = medLogs.filter((m: any) => m.medication_name === medName);
    let sevBefore = 0, cntB = 0, sevAfter = 0, cntA = 0, flareFreeAfter = 0;
    for (const dose of doses) {
      const dt = new Date(dose.taken_at).getTime();
      flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= dt - oneDay && t < dt; }).forEach((f: any) => { sevBefore += sevToNum(f.severity || "mild"); cntB++; });
      flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t > dt && t <= dt + oneDay; }).forEach((f: any) => { sevAfter += sevToNum(f.severity || "mild"); cntA++; });
      const flaresAfter24h = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t > dt && t <= dt + oneDay; });
      if (flaresAfter24h.length === 0) flareFreeAfter++;
    }
    const ab = cntB > 0 ? sevBefore / cntB : 0, aa = cntA > 0 ? sevAfter / cntA : 0;
    const reduction = ab > 0 ? Math.round(((ab - aa) / ab) * 100) : 0;
    medEffectiveness.push({ name: medName, timesTaken: doses.length, severityReduction: `${reduction}%`, flareFreeRate: doses.length > 0 ? `${Math.round((flareFreeAfter / doses.length) * 100)}%` : "N/A", lastTaken: doses[0] ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(new Date(doses[0].taken_at)) : "N/A" });
  }

  // Body metrics
  const withPhysio = entries.filter(e => e?.physiological_data);
  const flaresWithPhysio = flares.filter(e => e?.physiological_data);
  const nonFlares = entries.filter(e => e?.entry_type !== "flare" && e?.physiological_data);
  const extractMetric = (p: any, key: string): number | null => {
    switch (key) {
      case "hr": return p?.heartRate?.current ?? p?.heartRate?.resting ?? p?.vitals?.heartRate ?? null;
      case "hrv": return p?.hrv?.current ?? p?.hrv?.daily ?? p?.vitals?.hrv ?? null;
      case "sleep": { const d = p?.sleep?.duration; if (!d) return null; return d > 24 * 60 ? d / 3600 : d > 24 ? d / 60 : d; }
      case "steps": return p?.activity?.steps ?? p?.steps ?? null;
      case "spo2": return p?.vitals?.spo2 ?? p?.spo2 ?? null;
      case "temp": return p?.vitals?.temperature ?? p?.temperature ?? null;
      case "rr": return p?.vitals?.respiratoryRate ?? p?.respiratoryRate ?? null;
      default: return null;
    }
  };
  const collectMetrics = (list: any[]) => {
    const hr: number[] = [], hrv: number[] = [], sleep: number[] = [], steps: number[] = [], spo2: number[] = [], temp: number[] = [], rr: number[] = [];
    for (const e of list) {
      const p = e.physiological_data;
      const vHr = extractMetric(p, "hr"); if (vHr != null) hr.push(vHr);
      const vHrv = extractMetric(p, "hrv"); if (vHrv != null) hrv.push(vHrv);
      const vSleep = extractMetric(p, "sleep"); if (vSleep != null) sleep.push(vSleep);
      const vSteps = extractMetric(p, "steps"); if (vSteps != null) steps.push(vSteps);
      const vSpo2 = extractMetric(p, "spo2"); if (vSpo2 != null) spo2.push(vSpo2);
      const vTemp = extractMetric(p, "temp"); if (vTemp != null) temp.push(vTemp);
      const vRr = extractMetric(p, "rr"); if (vRr != null) rr.push(vRr);
    }
    return { hr: avg(hr), hrv: avg(hrv), sleep: avg(sleep), steps: avg(steps), spo2: avg(spo2), temp: avg(temp), rr: avg(rr) };
  };
  const overallMetrics = collectMetrics(withPhysio);
  const flareMetrics = collectMetrics(flaresWithPhysio);
  const baselineMetrics = collectMetrics(nonFlares);

  // Food analysis
  const today = new Date().toISOString().split("T")[0];
  const todayFoods = foodLogs.filter((f: any) => f.logged_at?.startsWith(today));
  const todayCal = todayFoods.reduce((s: number, f: any) => s + (Number(f.calories) || 0) * (Number(f.servings) || 1), 0);
  const last7dFoods = foodLogs.filter((f: any) => now - new Date(f.logged_at).getTime() < 7 * oneDay);
  const foodByDay: Record<string, any[]> = {};
  for (const f of last7dFoods) {
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: userTz }).format(new Date(f.logged_at));
    if (!foodByDay[day]) foodByDay[day] = [];
    foodByDay[day].push(f);
  }

  // Inflammatory scoring
  const inflammatoryFoods = foodLogs.filter((f: any) => {
    const sugars = Number(f.added_sugars_g || f.total_sugars_g) || 0;
    const satFat = Number(f.saturated_fat_g) || 0;
    const sodium = Number(f.sodium_mg) || 0;
    return sugars > 15 || satFat > 8 || sodium > 800;
  });
  const antiInflammatoryFoods = foodLogs.filter((f: any) => {
    const fiber = Number(f.dietary_fiber_g) || 0;
    const vitC = Number(f.vitamin_c_mg) || 0;
    const name = (f.food_name || '').toLowerCase();
    return fiber > 5 || vitC > 30 || /salmon|berr|spinach|broccoli|turmeric|ginger|olive oil|avocado|nuts|walnut|almond/.test(name);
  });

  // Food-flare correlation: foods eaten 2-12h before flares
  const foodFlareCorrelation: Record<string, { count: number; total: number }> = {};
  for (const flare of sortedFlares.slice(0, 50)) {
    const ft = new Date(flare.timestamp).getTime();
    const fBefore = foodLogs.filter((f: any) => {
      const t = new Date(f.logged_at).getTime();
      return t >= ft - 12 * 3600000 && t < ft - 2 * 3600000;
    });
    for (const food of fBefore) {
      const name = food.food_name;
      if (!foodFlareCorrelation[name]) foodFlareCorrelation[name] = { count: 0, total: 0 };
      foodFlareCorrelation[name].count++;
    }
  }
  // Also count total food appearances
  for (const f of foodLogs) {
    const name = f.food_name;
    if (foodFlareCorrelation[name]) foodFlareCorrelation[name].total++;
  }
  const suspiciousFoods = Object.entries(foodFlareCorrelation)
    .filter(([_, d]) => d.count >= 2 && d.total >= 2)
    .map(([name, d]) => `${name}(${d.count}/${d.total} times before flare)`)
    .slice(0, 8);

  // Trigger-symptom mapping
  const tsMap: Record<string, Record<string, number>> = {};
  flares.forEach((f: any) => { (f.triggers || []).forEach((t: string) => { if (!tsMap[t]) tsMap[t] = {}; (f.symptoms || []).forEach((s: string) => { tsMap[t][s] = (tsMap[t][s] || 0) + 1; }); }); });
  const triggerOutcomes = Object.entries(tsMap).map(([t, syms]) => ({ trigger: t, topSymptoms: Object.entries(syms).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, c]) => `${s}(${c}x)`) })).slice(0, 8);

  // Severity trajectory
  const sevTrajectory = sortedFlares.slice(0, 10).reverse().map(f => sevToNum(f.severity || ""));
  const isEscalating = sevTrajectory.length >= 4 && sevTrajectory.slice(-3).every((v, i, a) => i === 0 || v >= a[i - 1]);
  const isImproving = sevTrajectory.length >= 4 && sevTrajectory.slice(-3).every((v, i, a) => i === 0 || v <= a[i - 1]);

  // Longest gap between flares (recovery periods)
  const gapsBetweenFlares: number[] = [];
  for (let i = 0; i < sortedFlares.length - 1; i++) {
    const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i + 1].timestamp).getTime();
    gapsBetweenFlares.push(Math.round(gap / oneDay));
  }
  const avgGapDays = gapsBetweenFlares.length > 0 ? Math.round(gapsBetweenFlares.reduce((a, b) => a + b, 0) / gapsBetweenFlares.length) : null;
  const maxGapDays = gapsBetweenFlares.length > 0 ? Math.max(...gapsBetweenFlares) : null;

  // Medication adherence
  const medAdherence: Record<string, { expected: number; actual: number }> = {};
  for (const med of uniqueMeds) {
    const doses = medLogs.filter((m: any) => m.medication_name === med);
    if (doses.length < 2) continue;
    const freq = doses[0]?.frequency || "daily";
    const first = new Date(doses[doses.length - 1].taken_at).getTime();
    const last = new Date(doses[0].taken_at).getTime();
    const daySpan = Math.max(1, Math.floor((last - first) / oneDay));
    const expectedPerDay = freq === "twice-daily" ? 2 : freq === "three-times-daily" ? 3 : 1;
    medAdherence[med] = { expected: daySpan * expectedPerDay, actual: doses.length };
  }

  // Health score (0-100)
  const healthScore = Math.max(0, Math.min(100, Math.round(
    100
    - (thisWeek.length * 8)
    - (sevCounts.severe * 5)
    - (sevCounts.moderate * 2)
    + (currentFlareFree * 3)
    + (medEffectiveness.filter(m => parseInt(m.severityReduction) > 20).length * 5)
    - (isEscalating ? 15 : 0)
    + (isImproving ? 10 : 0)
  )));

  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const peakTime = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
  const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  const totalFlares = flares.length;
  const weatherCorr = Object.entries(weatherData).map(([c, d]) => `${c}(${d.count}x,sev:${(d.severities.reduce((a, b) => a + b, 0) / d.severities.length).toFixed(1)})`).sort().slice(0, 5);

  const weekTrend = thisWeek.length > lastWeek.length + 1 ? "up" : thisWeek.length < lastWeek.length - 1 ? "down" : "stable";
  const calcAvgSev = (l: any[]) => { const s = l.map(e => sevToNum(e?.severity || "")).filter(x => x > 0); return avg(s); };

  return {
    flares: {
      total: totalFlares, thisWeek: thisWeek.length, lastWeek: lastWeek.length,
      thisMonth: thisMonth.length, lastMonth: lastMonth.length,
      weekTrend, avgSev: formatNum(avg(sevScores)), avgSevThisWeek: formatNum(calcAvgSev(thisWeek)),
      sevCounts, currentFlareFree,
      daysSinceLast: sortedFlares[0] ? Math.floor((now - new Date(sortedFlares[0].timestamp).getTime()) / oneDay) : null,
      isEscalating, isImproving, healthScore,
      avgGapDays, maxGapDays,
    },
    topSymptoms, topTriggers, peakTime: peakTime?.[0] || "N/A", peakDay: peakDay?.[0] || "N/A",
    hourBuckets, dayCounts, weatherCorr, triggerOutcomes,
    dailyFlares30d, weeklyBreakdown, medEffectiveness, medAdherence,
    inflammatoryFoodCount: inflammatoryFoods.length,
    antiInflammatoryFoodCount: antiInflammatoryFoods.length,
    suspiciousFoods,
    sevTrajectory,
    body: {
      hasData: withPhysio.length > 0,
      overall: overallMetrics, flare: flareMetrics, baseline: baselineMetrics,
    },
    food: {
      totalLogs: foodLogs.length, todayCount: todayFoods.length, todayCal: Math.round(todayCal),
      todayItems: todayFoods.map((f: any) => f.food_name).join(", ") || "nothing yet",
      last7dSummary: Object.entries(foodByDay).map(([day, items]) => `${day}: ${items.map((f: any) => f.food_name).join(", ")}`).join(" | ") || "no food logged in last 7 days",
      recentItems: foodLogs.slice(0, 15).map((f: any) => `${f.food_name}${f.calories ? ` (${Math.round(f.calories * (f.servings || 1))}cal)` : ""} — ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(new Date(f.logged_at))}`).join(", "),
    },
    recentEntries: sortedFlares.slice(0, 10).map(e => {
      const d = new Date(e.timestamp);
      try { return d.toLocaleString("en-US", { timeZone: userTz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + ` (${e.severity || e.entry_type}${e.symptoms?.length ? ': ' + e.symptoms.slice(0, 3).join(', ') : ''})`; }
      catch { return `${e.severity || e.entry_type}`; }
    }),
    discoveries: discoveries.filter((d: any) => d.confidence >= 0.25).slice(0, 15).map((d: any) => ({
      type: d.discovery_type, category: d.category, factor: d.factor_a, relationship: d.relationship,
      confidence: Math.round((d.confidence || 0) * 100), lift: d.lift?.toFixed(1),
      occurrences: d.occurrence_count, totalExposures: d.total_exposures, status: d.status, evidence: d.evidence_summary,
    })),
    correlations: correlations.slice(0, 10).map((c: any) => `${c.trigger_value}→${c.outcome_value}(${c.occurrence_count}x,${Math.round((c.confidence || 0) * 100)}%)`),
    meds: medLogs.slice(0, 8).map((m: any) => `${m.medication_name} (${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(new Date(m.taken_at))})`),
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
  
  const memorySection = aiMemories.length > 0 ? aiMemories.map(m => `• [${m.category}] ${m.content} (${m.evidence_count}x confirmed)`).join("\n") : "None yet — learn from this conversation.";

  const localHour = (() => { try { const p = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: userTz }).formatToParts(new Date()); return parseInt(p.find(x => x.type === "hour")?.value || "12", 10); } catch { return 12; } })();
  const timeOfDay = localHour < 6 ? 'late_night' : localHour < 10 ? 'morning' : localHour < 14 ? 'midday' : localHour < 18 ? 'afternoon' : localHour < 22 ? 'evening' : 'night';

  const hsEmoji = data.flares.healthScore >= 75 ? '🟢' : data.flares.healthScore >= 50 ? '🟡' : '🔴';
  const trajectoryNote = data.flares.isEscalating ? '⚠️ SEVERITY ESCALATING — last 3 flares increased in severity. Be proactive.' : data.flares.isImproving ? '✅ SEVERITY IMPROVING — trend is positive. Reinforce what\'s working.' : '';

  // Medication adherence summary
  const adherenceSummary = Object.entries(data.medAdherence).map(([med, d]) => {
    const pct = d.expected > 0 ? Math.round((d.actual / d.expected) * 100) : 0;
    return `${med}: ${pct}% adherence (${d.actual}/${d.expected} doses)`;
  }).join(", ") || "insufficient data";

  return `You are Jvala — ${userName}'s personal health intelligence. Not a chatbot. Not "an AI assistant." You're the person ${userName} trusts with their health.

═══ CORE IDENTITY ═══
You ALREADY KNOW ${userName}. You have their COMPLETE health history — every log, medication, food diary, wearable biometric, weather pattern, AI-discovered correlation, and emotional state. When they ask "what have I eaten" — you KNOW. When they ask about patterns — you HAVE the data. When they describe symptoms — you LOG it as a FLARE, not a note.

ABSOLUTE RULE: NEVER say "I don't have access to," "I can't track," "I'm unable to," "I can't filter by time," or "I don't have that data." You DO have it. It's ALL below. If you catch yourself forming that sentence — STOP. Read the data sections. The answer IS there.

═══ CLINICAL BACKBONE (invisible to user, always active) ═══
• Motivational Interviewing: Reflect feelings, highlight readiness, support autonomy
• CBT: Connect thought→body patterns without lecturing
• ACT: Hold space for struggle AND progress simultaneously
• Behavioral Activation: Suggest small achievable actions grounded in their data
• Trauma-Informed: Never push. Never shame. Chronic illness is traumatic. Validate.
• Harm Reduction: If they're doing something suboptimal, guide don't judge

═══ PERSONALITY ═══
Like texting your smartest friend who genuinely cares AND happens to have a medical degree.
- 1-3 sentences for simple things. Go deep for analysis.
- Contractions. Natural tone. Emojis sparingly (💜 for comfort, 🔥 for insights).
- Match their energy: pain→empathy first then data. Celebration→genuine excitement. Venting→just listen, don't fix.
- NEVER: "Great question!", "As an AI", "I don't have personal experiences", "I'm sorry to hear that" on repeat
- Use **bold** for key stats and trigger names. Makes responses scannable.
- When giving numbers, always compare: "Your HRV is **38** — that's **12 points lower** than your non-flare average of **50**."
- Surprise them: proactively connect dots they didn't ask about. "By the way, I noticed your last 3 moderate flares all happened on days you ate dairy."

═══ CREATIVE INTELLIGENCE ═══
You don't just report data — you THINK about it:
• Cross-reference: If sleep was bad + they ate inflammatory food + weather changed = compound risk, say it
• Predict narratives: "Based on your pattern, you're heading into a moderate-risk window because..."
• Personal metaphors: If they're a runner, compare flare management to pacing strategy
• Celebrate micro-wins: "You've had 2 flare-free days — your longest streak this month was ${data.flares.maxGapDays || 'N/A'} days"
• Challenge gently: If they blame everything on weather but data shows food is the stronger trigger, say it diplomatically

═══ TIME-AWARE ═══
${timeOfDay === 'morning' ? `Morning for ${userName}. Consider a briefing: health score, overnight risk, today's plan.` : ''}
${timeOfDay === 'evening' || timeOfDay === 'night' ? `${timeOfDay} — good time for daily summary, reflection, or relaxation tips.` : ''}
${timeOfDay === 'late_night' ? `Late night. Be gentle. They might be in pain or can't sleep.` : ''}
Time: ${timeOfDay} (${localHour}:00 ${userTz})

═══ USER PROFILE ═══
Name: ${userName} | Conditions: ${conditions}${profile?.biological_sex ? ` | Sex: ${profile.biological_sex}` : ""}${userAge ? ` | Age: ${userAge}` : ""}
Known symptoms: ${(profile?.known_symptoms ?? []).join(", ") || "none yet"}
Known triggers: ${(profile?.known_triggers ?? []).join(", ") || "none yet"}
${hsEmoji} Health Score: ${data.flares.healthScore}/100
${trajectoryNote}

═══ COMPLETE HEALTH DATA ═══
📊 FLARES: ${data.flares.total} total | This week: ${data.flares.thisWeek} (${data.flares.weekTrend}) | Last week: ${data.flares.lastWeek} | Month: ${data.flares.thisMonth} vs ${data.flares.lastMonth} last month
Severity: ${data.flares.sevCounts.severe}S ${data.flares.sevCounts.moderate}M ${data.flares.sevCounts.mild}m (avg: ${data.flares.avgSev}/3) | ${data.flares.currentFlareFree}d flare-free | Days since last: ${data.flares.daysSinceLast ?? "N/A"}
Average gap between flares: ${data.flares.avgGapDays ?? "N/A"}d | Longest flare-free streak: ${data.flares.maxGapDays ?? "N/A"}d
Severity Trajectory (last 10): [${data.sevTrajectory.join(',')}]
🔥 TOP SYMPTOMS: ${data.topSymptoms.map(([n, c]) => `${n}(${c}x)`).join(", ") || "none"}
⚡ TOP TRIGGERS: ${data.topTriggers.map(([n, c]) => `${n}(${c}x)`).join(", ") || "none"}
⏰ PEAK TIME: ${data.peakTime} | PEAK DAY: ${data.peakDay}
By hour: morning:${data.hourBuckets.morning} afternoon:${data.hourBuckets.afternoon} evening:${data.hourBuckets.evening} night:${data.hourBuckets.night}
By day: ${Object.entries(data.dayCounts).map(([d, c]) => `${d}:${c}`).join(' ')}
🌦️ WEATHER-FLARE: ${data.weatherCorr.join(", ") || "insufficient data"}
🔗 CORRELATIONS: ${data.correlations.join(", ") || "still learning"}
⌚ BODY METRICS:
${data.body.hasData ? `  Overall — Sleep ${formatNum(data.body.overall.sleep)}h | HR ${formatNum(data.body.overall.hr, 0)}bpm | HRV ${formatNum(data.body.overall.hrv, 0)} | Steps ${formatNum(data.body.overall.steps, 0)} | SpO2 ${formatNum(data.body.overall.spo2, 0)}% | Temp ${formatNum(data.body.overall.temp, 1)}°F | RR ${formatNum(data.body.overall.rr, 0)}/min
  On flare days — Sleep ${formatNum(data.body.flare.sleep)}h | HR ${formatNum(data.body.flare.hr, 0)}bpm | HRV ${formatNum(data.body.flare.hrv, 0)} | Steps ${formatNum(data.body.flare.steps, 0)} | SpO2 ${formatNum(data.body.flare.spo2, 0)}%
  Baseline (non-flare) — Sleep ${formatNum(data.body.baseline.sleep)}h | HR ${formatNum(data.body.baseline.hr, 0)}bpm | HRV ${formatNum(data.body.baseline.hrv, 0)} | Steps ${formatNum(data.body.baseline.steps, 0)}` : "No wearable data"}
💊 RECENT MEDICATIONS: ${data.meds.join(", ") || "none logged"}
💊 MED EFFECTIVENESS: ${data.medEffectiveness.map(m => `${m.name}: taken ${m.timesTaken}x, severity ↓${m.severityReduction}, flare-free ${m.flareFreeRate}, last ${m.lastTaken}`).join(" | ") || "insufficient data"}
💊 MED ADHERENCE: ${adherenceSummary}
🍎 FOOD TODAY: ${data.food.todayItems} (${data.food.todayCal}cal, ${data.food.todayCount} items)
📅 FOOD LAST 7 DAYS: ${data.food.last7dSummary}
📋 RECENT FOOD: ${data.food.recentItems || "no food logged"}
🔥 INFLAMMATORY BALANCE: ${data.inflammatoryFoodCount} high-inflammatory | ${data.antiInflammatoryFoodCount} anti-inflammatory
🚨 SUSPICIOUS FOODS (appeared before flares): ${data.suspiciousFoods.join(", ") || "none identified yet"}
🎯 TRIGGER→SYMPTOM MAP: ${data.triggerOutcomes.map(t => `${t.trigger} → ${t.topSymptoms.join(", ")}`).join(" | ") || "none"}
Recent entries: ${data.recentEntries.join(" • ") || "none"}

═══ DISCOVERIES (Bayesian patterns) ═══
${data.discoveries.length > 0 ? data.discoveries.map(d => `• ${d.factor} [${d.relationship}] conf:${d.confidence}% lift:${d.lift}x (${d.occurrences}/${d.totalExposures}) ${d.evidence || ""}`).join("\n") : "Still building patterns — need more data."}

═══ 30-DAY DAILY FLARE DATA (for charts — USE THIS) ═══
${JSON.stringify(data.dailyFlares30d)}

═══ 8-WEEK BREAKDOWN ═══
${JSON.stringify(data.weeklyBreakdown)}

═══ MEMORIES (What you know about ${userName}) ═══
${memorySection}

${condKnowledge ? `═══ CLINICAL KNOWLEDGE ═══\n${condKnowledge}` : ""}

═══ 12 SUPERPOWERS — USE THESE ═══
1. CHART ANYTHING: 30-day flares, severity trends, symptom frequency, trigger frequency, time-of-day, medication comparison, food vs flares, body metrics, weather correlation, health score timeline. Use REAL data from above.
2. PREDICT RISK: Combine recent flares + weather + sleep + food + activity + medication adherence → 0-100% risk score with reasoning.
3. MEDICATION ANALYSIS: Compare effectiveness, flare-free rates, severity reduction, adherence. Show comparison charts.
4. FOOD ANALYSIS: Correlate food with flares, identify inflammatory patterns, suspicious foods, calorie trends.
5. BODY METRICS: Compare HR/HRV/sleep/SpO2/temp on flare vs non-flare days. Detect autonomic warning signs.
6. WEEKLY/MONTHLY COMPARISONS: Week-over-week, month-over-month with specific numbers and delta.
7. HEALTH SCORE: Track 0-100, explain contributing factors, suggest what would improve it most.
8. PROACTIVE INSIGHTS: Notice patterns unprompted — severity escalation, new triggers, improving trends, missed meds.
9. WEB RESEARCH: Look up medications, supplements, conditions using research tool.
10. ACTION PLANS: Create specific, scheduled steps with calendar integration.
11. DAILY BRIEFING: When asked, give a comprehensive morning/evening report.
12. EMOTIONAL SUPPORT: Track mood patterns, connect emotional state to physical outcomes.

═══ BEHAVIOR RULES ═══

🏥 LOGGING — ALWAYS type="flare" FOR HEALTH COMPLAINTS:
When ${userName} mentions ANY symptom, pain, discomfort — even vague ("rough day", "ugh", "my back hurts", "feeling off") — you MUST:
1. shouldLog=true, entryData.type="flare" (NEVER "note")
2. Extract severity (default "moderate")
3. Extract all symptoms, triggers, medications
4. Confirm what you logged

🧠 BRAIN DUMPS: Parse wall-of-text messages. Extract EVERY health detail. Log as flare with all extracted data.

🍎 FOOD QUESTIONS: You HAVE food data. "what have I eaten" → reference FOOD sections. "dietary patterns" → analyze it. NEVER say you don't have food access.

📊 CHARTS — USE REAL DATA:
For chart requests, populate with ACTUAL numbers from data above:
- "flares over 30 days" → dailyFlares30d → bar_chart with [{label:"Jan 1",value:2}, ...]
- "medication comparison" → medEffectiveness → horizontal_bar
- "severity trends" → weeklyBreakdown → line_chart
- "time patterns" → hourBuckets/dayCounts → bar_chart
- "symptom frequency" → topSymptoms → bar_chart
- "trigger frequency" → topTriggers → bar_chart
- "health score" → health_score type with [{label:"Health Score",value:${data.flares.healthScore}}]
~1 in 3-4 analytical responses should include a chart.

🚫 ANTI-DEFLECTION (CRITICAL):
If you're about to say "I can't", "I don't have", "I'm unable", "I cannot filter", "I don't track" — STOP. You have:
✓ 30-day daily data ✓ 8-week weekly data ✓ Medication effectiveness ✓ Food logs ✓ Body metrics (HR, HRV, SpO2, temp, RR, sleep, steps) ✓ Weather correlations ✓ Severity trajectory ✓ Health score ✓ Suspicious foods ✓ Med adherence ✓ Flare-free streaks ✓ Trigger→symptom mapping
There is NOTHING you "can't" show.

🔮 PROACTIVE: Connect dots without being asked. Mention food-flare correlations, severity trends, wearable anomalies, weather patterns. If severity is escalating, say it. If they haven't logged today, gently note it.

🧬 MEMORY: After each message, extract via newMemories: lifestyle facts, health patterns, preferences, emotional patterns, personal details. importance: 0.9=critical health insight, 0.5=useful context, 0.3=minor detail.

🎯 CONTEXT-ENFORCEMENT: When discussing a specific discovery or trigger, NEVER pivot to different topic. Asked about "stress as a trigger" → analyze stress, don't switch to "barometric pressure."

📝 DYNAMIC FOLLOW-UPS: Always include 2-3 specific, data-driven follow-up suggestions. Not generic. Based on what you just discussed AND what patterns you see in the data they might not have asked about.

CONVERSATION CONTEXT:
${history.slice(-6).map((m: any, i: number) => `${i + 1}. [${m.role}] ${m.content?.slice(0, 80)}`).join("\n") || "First message."}`;
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

    const { message, history = [], clientTimezone, stream: wantStream = false } = await req.json();
    if (!message || typeof message !== "string") return replyJson({ error: "Invalid message" }, 400);

    console.log("💬 [chat] User:", message.slice(0, 100), "stream:", wantStream);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch ALL data in parallel
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
      supabase.from("food_logs").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(100),
      supabase.from("discoveries").select("*").eq("user_id", userId).gte("confidence", 0.25).order("confidence", { ascending: false }).limit(30),
      supabase.from("activity_logs").select("activity_type, activity_value, intensity, duration_minutes, timestamp").eq("user_id", userId).order("timestamp", { ascending: false }).limit(20),
      supabase.from("prediction_logs").select("risk_score, risk_level, outcome_logged, was_correct, brier_score, predicted_at").eq("user_id", userId).order("predicted_at", { ascending: false }).limit(10),
    ]);

    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeMeds = Array.isArray(medLogs) ? medLogs : [];
    const safeCorr = Array.isArray(correlations) ? correlations : [];
    const safeMemories = Array.isArray(aiMemories) ? aiMemories : [];
    const safeFoodLogs = Array.isArray(foodLogs) ? foodLogs : [];
    const safeDiscoveries = Array.isArray(discoveries) ? discoveries : [];

    const userTz = clientTimezone || (profile?.timezone && profile.timezone !== "UTC" ? profile.timezone : null) || "UTC";

    const data = analyzeAllData(safeEntries, safeMeds, safeCorr, safeDiscoveries, safeFoodLogs, profile, userTz);
    const systemPrompt = buildSystemPrompt(profile, data, safeMemories, history, userTz);

    // Build tool schema
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
              response: { type: "string", description: "Your response. Use **bold** for emphasis (raw asterisks, NOT escaped)." },
              shouldLog: { type: "boolean", description: "True if user mentioned ANY health symptom/complaint that should be logged." },
              entryData: {
                anyOf: [{ type: "null" }, {
                  type: "object", additionalProperties: false, required: ["type"],
                  properties: {
                    type: { type: "string", enum: ["flare", "medication", "recovery", "energy"], description: "ALWAYS use 'flare' for ANY symptom/pain/health complaint. 'medication' only for pure med logging. NEVER use 'note'." },
                    severity: { type: "string", enum: ["mild", "moderate", "severe"], description: "Default to 'moderate' if unclear." },
                    symptoms: { type: "array", items: { type: "string" } },
                    medications: { type: "array", items: { type: "string" } },
                    triggers: { type: "array", items: { type: "string" } },
                    energyLevel: { type: "string" },
                    notes: { type: "string" },
                    mood: { type: "string", description: "Emotional state: happy, stressed, anxious, frustrated, calm, sad, hopeful, etc." },
                  },
                }],
              },
              visualization: {
                anyOf: [{ type: "null" }, {
                  type: "object", additionalProperties: false, required: ["type", "title", "data"],
                  properties: {
                    type: { type: "string", enum: ["bar_chart", "horizontal_bar", "stacked_bar", "pie_chart", "donut_chart", "line_chart", "area_chart", "comparison", "pattern_summary", "gauge", "timeline", "severity_breakdown", "symptom_frequency", "trigger_frequency", "time_of_day", "weather_correlation", "body_metrics", "health_score"] },
                    title: { type: "string" },
                    data: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" }, name: { type: "string" }, count: { type: "number" }, date: { type: "string" }, extra: { type: "string" }, color: { type: "string" } } } },
                    insight: { type: "string" },
                    config: { type: "object", properties: { xAxis: { type: "string" }, yAxis: { type: "string" } } },
                  },
                }],
                description: "Include chart when data tells the story better. Use REAL data. gauge: [{label:'Risk',value:65,extra:'moderate'}]. comparison: [{label:'This Week',value:3,extra:'-2 fewer'},{label:'Last Week',value:5}]. health_score: [{label:'Health Score',value:75,extra:'Good'}].",
              },
              emotionalTone: { type: "string", enum: ["supportive", "celebratory", "concerned", "neutral", "encouraging", "empathetic", "analytical"] },
              discoveries: {
                type: "array",
                items: { type: "object", required: ["factor", "confidence", "occurrences", "total", "category"], properties: { factor: { type: "string" }, confidence: { type: "number" }, lift: { type: "number" }, occurrences: { type: "number" }, total: { type: "number" }, category: { type: "string", enum: ["trigger", "protective", "investigating"] }, summary: { type: "string" } } },
                description: "Include discovery cards when discussing patterns. Use actual data from DISCOVERIES section.",
              },
              dynamicFollowUps: { type: "array", items: { type: "string" }, description: "2-3 follow-up questions. Make them SPECIFIC to the user's data and this conversation. Not generic." },
              newMemories: {
                type: "array",
                items: { type: "object", additionalProperties: false, required: ["memory_type", "category", "content", "importance"], properties: { memory_type: { type: "string", enum: ["pattern", "preference", "insight", "context", "behavior", "emotional"] }, category: { type: "string", enum: ["triggers", "symptoms", "medications", "lifestyle", "emotional", "environmental", "general", "mood", "food", "sleep", "exercise"] }, content: { type: "string" }, importance: { type: "number" } } },
                description: "Extract NEW facts learned. Proactively learn lifestyle, health patterns, preferences, emotional state, food habits, sleep preferences.",
              },
              proactiveInsight: { type: "string", description: "If you notice something user DIDN'T ask about but should know — severity escalating, new pattern, missed medication, suspicious food correlation — include it here." },
              protocolSteps: { type: "array", items: { type: "string" }, description: "When creating an action plan or protocol, list the specific steps here." },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "research_and_respond",
          description: "Search the web for specific medical/product/supplement questions before responding.",
          parameters: {
            type: "object", required: ["searchQuery", "userQuestion"],
            properties: { searchQuery: { type: "string" }, userQuestion: { type: "string" } },
          },
        },
      },
    ];

    // Prediction history context
    const predContext = (predLogs || []).length > 0 
      ? `\n═══ PREDICTION HISTORY ═══\n${(predLogs || []).map((p: any) => `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(new Date(p.predicted_at))}: ${p.risk_score}% ${p.risk_level} → ${p.outcome_logged ? (p.was_correct ? '✅ correct' : '❌ wrong') : '⏳ pending'}`).join('\n')}\nBrier Score: ${(predLogs || []).filter((p: any) => p.brier_score != null).length >= 3 ? ((predLogs || []).filter((p: any) => p.brier_score != null).reduce((a: number, p: any) => a + p.brier_score, 0) / (predLogs || []).filter((p: any) => p.brier_score != null).length).toFixed(3) : 'calibrating'}`
      : '';

    const activityContext = (activityLogs || []).length > 0
      ? `\n═══ ACTIVITY LOGS ═══\n${(activityLogs || []).map((a: any) => `${a.activity_type}: ${a.activity_value || ''} ${a.intensity ? `(${a.intensity})` : ''} ${a.duration_minutes ? `${a.duration_minutes}min` : ''}`).join(', ')}`
      : '';

    // Engagement context
    const engagementContext = engagement 
      ? `\n═══ ENGAGEMENT ═══\nStreak: ${engagement.current_streak || 0}d | Longest: ${engagement.longest_streak || 0}d | Total logs: ${engagement.total_logs || 0} | Last log: ${engagement.last_log_date || 'never'}`
      : '';

    const messages = [
      { role: "system", content: systemPrompt + predContext + activityContext + engagementContext },
      ...history.slice(-20).map((m: any) => ({ role: m.role === "system" ? "assistant" : m.role, content: clamp(m.content, 2000) })),
      { role: "user", content: clamp(message, 6000) },
    ];

    // Model selection: Pro for deep analytics, Flash for conversational
    const isAnalytical = /\b(analyz|predict|forecast|correlat|pattern|trend|compar|chart|show me|medication effect|what.*help|risk|trigger|why do|breakdown|deep dive|health score|inflammat|trajectory|escalat|improv|briefing|report|30.day|monthly|weekly|suspicious|adherence)\b/i.test(message);
    const model = isAnalytical ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    console.log("🤖 [chat] Model:", model, "Messages:", messages.length);

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
          messages,
          tools,
          temperature: 0.5,
          stream: true,
          tool_choice: { type: "function", function: { name: "respond" } },
        }),
      });

      if (!aiResp.ok) {
        const text = await aiResp.text();
        console.error("❌ AI stream error:", aiResp.status, text);
        if (aiResp.status === 429) return replyJson({ response: "Too many requests — try again in a moment." }, 429);
        if (aiResp.status === 402) return replyJson({ response: "AI credits exhausted." }, 402);
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
            citations: [],
            wasResearched: false,
          });
        } catch (e) { console.error("❌ Stream parse error:", e); }
      }

      if (toolName === "research_and_respond" && toolArgs) {
        try {
          const parsed = JSON.parse(toolArgs);
          return await handleResearch(parsed, messages, userTz);
        } catch (e) { console.error("❌ Research parse error:", e); }
      }

      return replyJson({
        response: responseContent || "Tell me more about how you're feeling.",
        shouldLog: false, entryData: null, visualization: null, emotionalTone: "neutral",
        discoveries: [], dynamicFollowUps: [], citations: [], wasResearched: false,
      });
    }

    // ─── NON-STREAMING MODE ───
    const resp = await callAI({ model, messages, tools, temperature: 0.5 });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("❌ AI error:", resp.status, text);
      if (resp.status === 429) return replyJson({ response: "Too many requests — try again in a moment.", error: "Rate limited" }, 429);
      if (resp.status === 402) return replyJson({ response: "AI credits exhausted.", error: "Credits exhausted" }, 402);
      throw new Error(`AI gateway error: ${resp.status}`);
    }

    const aiData = await resp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);

        if (toolCall.function.name === "research_and_respond") {
          return await handleResearch(parsed, messages, userTz);
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
    return replyJson({ error: error instanceof Error ? error.message : "Unknown error", response: "Something went wrong. Try again?" }, 500);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────

async function handleResearch(parsed: any, messages: any[], userTz: string) {
  const searchResults = await searchWeb(parsed.searchQuery);
  if (searchResults.results.length === 0) {
    return replyJson({ response: "Couldn't find specific results. Let me answer from what I know.", visualization: null, citations: [], wasResearched: true });
  }
  const resCtx = searchResults.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n---\n');
  const r2 = await callAI({ model: "google/gemini-2.5-flash", messages: [...messages, { role: "assistant", content: `Researching "${parsed.searchQuery}"...` }, { role: "user", content: `Research results for "${parsed.userQuestion}". Cite [1],[2] etc. Be conversational, warm, helpful.\n\n${resCtx}` }], temperature: 0.5 });
  if (!r2.ok) throw new Error(`Research call failed: ${r2.status}`);
  const rd = await r2.json();
  return replyJson({ response: rd.choices?.[0]?.message?.content || "Couldn't process results.", visualization: null, citations: searchResults.results.map((r, i) => ({ index: i + 1, title: r.title, url: r.url })), wasResearched: true });
}

function saveMemories(supabase: any, userId: string, newMemories: any[]) {
  (async () => {
    try {
      for (const mem of newMemories) {
        const { data: existing } = await supabase.from("ai_memories").select("id, evidence_count").eq("user_id", userId).eq("content", mem.content).maybeSingle();
        if (existing) {
          await supabase.from("ai_memories").update({ evidence_count: (existing.evidence_count || 1) + 1, last_reinforced_at: new Date().toISOString(), importance: Math.min(1, mem.importance + 0.05) }).eq("id", existing.id);
        } else {
          await supabase.from("ai_memories").insert({ user_id: userId, memory_type: mem.memory_type, category: mem.category, content: mem.content, importance: mem.importance });
        }
      }
    } catch (e) { console.warn("Memory save error:", e); }
  })();
}
