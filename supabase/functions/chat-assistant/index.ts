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
const median = (arr: number[]): number | null => { if (!arr.length) return null; const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
const stddev = (arr: number[]): number | null => { const a = avg(arr); if (a == null || arr.length < 2) return null; return Math.sqrt(arr.reduce((s,v) => s + (v-a)**2, 0) / arr.length); };
const formatNum = (n: number | null, d = 1): string => n == null ? "N/A" : d === 0 ? String(Math.round(n)) : n.toFixed(d);
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);

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
  'Raynaud\'s': ['Cold #1 trigger. Stress secondary. Layer extremities. Calcium channel blockers. Biofeedback effective.', 'Cold exposure, stress, air conditioning, holding cold objects, morning, winter'],
};

// ─── Advanced data analysis ──────────────────────────────────────────────
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
  const fmtDate = (d: Date) => { try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(d); } catch { return d.toLocaleDateString(); } };

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

  // #1 — Symptom co-occurrence matrix
  const symptomPairs: Record<string, number> = {};
  // #2 — Hour-level granularity 
  // #3 — City tracking
  // #4 — Severity by time of day
  const sevByTimeOfDay: Record<string, number[]> = { morning: [], afternoon: [], evening: [], night: [] };
  // #5 — Severity by day of week
  const sevByDay: Record<string, number[]> = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
  // #6 — Weekend vs weekday
  let weekendFlares = 0, weekdayFlares = 0;
  // #7 — Flare duration tracking
  const durations: number[] = [];
  // #8 — Multi-symptom flares
  let multiSymptomCount = 0;
  // #9 — Note sentiment tracking
  const notesWithContent: string[] = [];
  // #10 — Trigger co-occurrence
  const triggerPairs: Record<string, number> = {};

  for (const e of flares) {
    const sev = e?.severity as string;
    if (sev === "mild" || sev === "moderate" || sev === "severe") sevCounts[sev]++;
    const score = sevToNum(sev);
    if (score) sevScores.push(score);
    
    const symptoms = e?.symptoms ?? [];
    for (const s of symptoms) symptomCounts[s] = (symptomCounts[s] || 0) + 1;
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
    for (const t of triggers) triggerCounts[t] = (triggerCounts[t] || 0) + 1;
    if (triggers.length >= 2) {
      for (let i = 0; i < triggers.length; i++) {
        for (let j = i+1; j < triggers.length; j++) {
          const pair = [triggers[i], triggers[j]].sort().join(" + ");
          triggerPairs[pair] = (triggerPairs[pair] || 0) + 1;
        }
      }
    }
    
    const d = new Date(e.timestamp);
    const h = getLocalHour(d);
    hourCounts[h]++;
    const tod = getTimeOfDay(h);
    hourBuckets[tod]++;
    if (score) sevByTimeOfDay[tod].push(score);
    
    const dayKey = getLocalDay(d);
    if (dayCounts[dayKey] !== undefined) {
      dayCounts[dayKey]++;
      if (score) sevByDay[dayKey].push(score);
    }
    
    const isWeekend = dayKey === "Sat" || dayKey === "Sun";
    if (isWeekend) weekendFlares++; else weekdayFlares++;
    
    const w = e?.environmental_data?.weather?.condition || e?.environmental_data?.condition;
    if (typeof w === "string" && w.trim()) {
      if (!weatherData[w]) weatherData[w] = { count: 0, severities: [] };
      weatherData[w].count++;
      if (score) weatherData[w].severities.push(score);
    }
    
    if (e?.city) cityCounts[e.city] = (cityCounts[e.city] || 0) + 1;
    if (e?.duration_minutes) durations.push(e.duration_minutes);
    if (e?.note?.trim()) notesWithContent.push(e.note);
  }

  // #11 — Current flare-free streak
  let currentFlareFree = 0;
  if (sortedFlares.length > 0) {
    currentFlareFree = Math.floor((now - new Date(sortedFlares[0].timestamp).getTime()) / oneDay);
  }

  // #12 — Daily flares 30d with severity averages
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

  // #13 — Weekly breakdown 8 weeks
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

  // #14 — Medication effectiveness (enhanced)
  const medEffectiveness: any[] = [];
  const uniqueMeds = [...new Set(medLogs.map((m: any) => m.medication_name))];
  for (const medName of uniqueMeds.slice(0, 12)) {
    const doses = medLogs.filter((m: any) => m.medication_name === medName);
    let sevBefore = 0, cntB = 0, sevAfter = 0, cntA = 0, flareFreeAfter = 0;
    const beforeScores: number[] = [], afterScores: number[] = [];
    for (const dose of doses) {
      const dt = new Date(dose.taken_at).getTime();
      flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= dt - oneDay && t < dt; }).forEach((f: any) => { 
        const s = sevToNum(f.severity || "mild"); sevBefore += s; cntB++; beforeScores.push(s); 
      });
      flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t > dt && t <= dt + oneDay; }).forEach((f: any) => { 
        const s = sevToNum(f.severity || "mild"); sevAfter += s; cntA++; afterScores.push(s);
      });
      const flaresAfter24h = flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t > dt && t <= dt + oneDay; });
      if (flaresAfter24h.length === 0) flareFreeAfter++;
    }
    const ab = cntB > 0 ? sevBefore / cntB : 0, aa = cntA > 0 ? sevAfter / cntA : 0;
    const reduction = ab > 0 ? Math.round(((ab - aa) / ab) * 100) : 0;
    // #15 — Time since last dose
    const lastDose = doses[0] ? new Date(doses[0].taken_at) : null;
    const hoursSinceLastDose = lastDose ? Math.round((now - lastDose.getTime()) / 3600000) : null;
    medEffectiveness.push({ 
      name: medName, timesTaken: doses.length, 
      severityReduction: `${reduction}%`, 
      flareFreeRate: doses.length > 0 ? `${Math.round((flareFreeAfter / doses.length) * 100)}%` : "N/A",
      avgBefore: ab.toFixed(1), avgAfter: aa.toFixed(1),
      hoursSinceLastDose,
      lastTaken: lastDose ? fmtDate(lastDose) : "N/A",
      dosage: doses[0]?.dosage || "standard",
    });
  }

  // #16 — Body metrics with full physiological data extraction
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
    };
  };
  const overallMetrics = collectMetrics(withPhysio);
  const flareMetrics = collectMetrics(flaresWithPhysio);
  const baselineMetrics = collectMetrics(nonFlares);

  // #17 — Food analysis (enhanced)
  const today = new Date().toISOString().split("T")[0];
  const todayFoods = foodLogs.filter((f: any) => f.logged_at?.startsWith(today));
  const todayCal = todayFoods.reduce((s: number, f: any) => s + (Number(f.calories) || 0) * (Number(f.servings) || 1), 0);
  const todayProtein = todayFoods.reduce((s: number, f: any) => s + (Number(f.protein_g) || 0) * (Number(f.servings) || 1), 0);
  const todayFiber = todayFoods.reduce((s: number, f: any) => s + (Number(f.dietary_fiber_g) || 0) * (Number(f.servings) || 1), 0);
  const last7dFoods = foodLogs.filter((f: any) => now - new Date(f.logged_at).getTime() < 7 * oneDay);
  const foodByDay: Record<string, any[]> = {};
  for (const f of last7dFoods) {
    const day = fmtDate(new Date(f.logged_at));
    if (!foodByDay[day]) foodByDay[day] = [];
    foodByDay[day].push(f);
  }

  // #18 — Inflammatory scoring
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

  // #19 — Food-flare correlation (2-12h window)
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

  // #20 — Meal type analysis
  const mealTypeCounts: Record<string, number> = {};
  for (const f of foodLogs) {
    const mt = f.meal_type || "snack";
    mealTypeCounts[mt] = (mealTypeCounts[mt] || 0) + 1;
  }

  // #21 — Trigger-symptom mapping (enhanced with severity)
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

  // #22 — Severity trajectory
  const sevTrajectory = sortedFlares.slice(0, 15).reverse().map(f => sevToNum(f.severity || ""));
  const isEscalating = sevTrajectory.length >= 4 && sevTrajectory.slice(-3).every((v, i, a) => i === 0 || v >= a[i - 1]);
  const isImproving = sevTrajectory.length >= 4 && sevTrajectory.slice(-3).every((v, i, a) => i === 0 || v <= a[i - 1]);

  // #23 — Gap analysis (recovery periods)
  const gapsBetweenFlares: number[] = [];
  for (let i = 0; i < sortedFlares.length - 1; i++) {
    const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i + 1].timestamp).getTime();
    gapsBetweenFlares.push(Math.round(gap / oneDay));
  }
  const avgGapDays = gapsBetweenFlares.length > 0 ? Math.round(gapsBetweenFlares.reduce((a, b) => a + b, 0) / gapsBetweenFlares.length) : null;
  const maxGapDays = gapsBetweenFlares.length > 0 ? Math.max(...gapsBetweenFlares) : null;
  const minGapDays = gapsBetweenFlares.length > 0 ? Math.min(...gapsBetweenFlares) : null;

  // #24 — Medication adherence
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

  // #25 — Flare clustering (multiple flares within 48h)
  let clusterCount = 0;
  for (let i = 0; i < sortedFlares.length - 1; i++) {
    const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i + 1].timestamp).getTime();
    if (gap < 2 * oneDay) clusterCount++;
  }

  // #26 — Health score (enhanced multi-factor)
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
  )));

  // #27 — Worst flare details
  const worstFlare = sortedFlares.find(f => f.severity === "severe") || sortedFlares[0];
  const worstFlareDetail = worstFlare ? {
    date: fmtDate(new Date(worstFlare.timestamp)),
    severity: worstFlare.severity,
    symptoms: (worstFlare.symptoms || []).slice(0, 5).join(", "),
    triggers: (worstFlare.triggers || []).slice(0, 5).join(", "),
  } : null;

  // #28 — Best period (longest gap context)
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

  // #29 — Hourly heatmap data
  const hourlyHeatmap = hourCounts.map((c, h) => ({ hour: `${h}:00`, count: c }));
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  // #30 — Environmental pressure/humidity analysis
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

  // #31 — Air quality correlation
  const aqiData: { aqi: number; severity: number }[] = [];
  for (const e of flares) {
    const aqi = e?.environmental_data?.airQuality?.aqi;
    const score = sevToNum(e?.severity || "");
    if (aqi && score) aqiData.push({ aqi, severity: score });
  }

  // Compile
  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topSymptomPairs = Object.entries(symptomPairs).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTriggerPairs = Object.entries(triggerPairs).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const peakTime = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
  const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  const totalFlares = flares.length;
  const weatherCorr = Object.entries(weatherData).map(([c, d]) => `${c}(${d.count}x,avgSev:${(d.severities.reduce((a, b) => a + b, 0) / d.severities.length).toFixed(1)})`).sort((a,b) => b.length - a.length).slice(0, 6);
  const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const weekTrend = thisWeek.length > lastWeek.length + 1 ? "⬆️ UP" : thisWeek.length < lastWeek.length - 1 ? "⬇️ DOWN" : "➡️ STABLE";
  const monthTrend = thisMonth.length > lastMonth.length * 1.2 ? "⬆️ UP" : thisMonth.length < lastMonth.length * 0.8 ? "⬇️ DOWN" : "➡️ STABLE";
  const calcAvgSev = (l: any[]) => { const s = l.map(e => sevToNum(e?.severity || "")).filter(x => x > 0); return avg(s); };

  // #32 — Worst day of week
  const worstDay = Object.entries(sevByDay).map(([d, sevs]) => [d, sevs.length ? sevs.reduce((a,b)=>a+b,0)/sevs.length : 0] as [string, number]).sort((a,b) => (b[1] as number) - (a[1] as number))[0];
  // #33 — Worst time of day
  const worstTime = Object.entries(sevByTimeOfDay).map(([t, sevs]) => [t, sevs.length ? sevs.reduce((a,b)=>a+b,0)/sevs.length : 0] as [string, number]).sort((a,b) => (b[1] as number) - (a[1] as number))[0];

  // #34 — Logging consistency (days with at least 1 entry / total days)
  const uniqueLogDays = new Set(entries.map((e: any) => new Date(e.timestamp).toISOString().split('T')[0])).size;
  const firstEntry = entries.length ? new Date(entries[entries.length - 1].timestamp) : new Date();
  const totalDaysSinceStart = Math.max(1, Math.floor((now - firstEntry.getTime()) / oneDay));
  const loggingConsistency = pct(uniqueLogDays, totalDaysSinceStart);

  // #35 — Energy level analysis
  const energyEntries = entries.filter((e: any) => e?.energy_level);
  const energyMap: Record<string, number> = {};
  energyEntries.forEach((e: any) => { energyMap[e.energy_level] = (energyMap[e.energy_level] || 0) + 1; });

  return {
    flares: {
      total: totalFlares, thisWeek: thisWeek.length, lastWeek: lastWeek.length,
      thisMonth: thisMonth.length, lastMonth: lastMonth.length,
      weekTrend, monthTrend, avgSev: formatNum(avg(sevScores)), avgSevThisWeek: formatNum(calcAvgSev(thisWeek)),
      avgSevMedian: formatNum(median(sevScores)), sevStddev: formatNum(stddev(sevScores)),
      sevCounts, currentFlareFree,
      daysSinceLast: sortedFlares[0] ? Math.floor((now - new Date(sortedFlares[0].timestamp).getTime()) / oneDay) : null,
      isEscalating, isImproving, healthScore,
      avgGapDays, maxGapDays, minGapDays,
      clusterCount, multiSymptomCount,
      weekendFlares, weekdayFlares,
      avgDuration: avg(durations) ? Math.round(avg(durations)!) : null,
      loggingConsistency,
    },
    topSymptoms, topTriggers, topSymptomPairs, topTriggerPairs,
    peakTime: peakTime?.[0] || "N/A", peakDay: peakDay?.[0] || "N/A", peakHour,
    worstDay: worstDay ? `${worstDay[0]} (avg sev ${(worstDay[1] as number).toFixed(1)})` : "N/A",
    worstTime: worstTime ? `${worstTime[0]} (avg sev ${(worstTime[1] as number).toFixed(1)})` : "N/A",
    hourBuckets, dayCounts, hourlyHeatmap, weatherCorr, triggerOutcomes,
    topCities, worstFlareDetail, bestPeriod: bestPeriodStart ? `${bestPeriodStart} → ${bestPeriodEnd} (${maxGapDays}d flare-free)` : null,
    dailyFlares30d, weeklyBreakdown, medEffectiveness, medAdherence,
    inflammatoryFoodCount: inflammatoryFoods.length,
    antiInflammatoryFoodCount: antiInflammatoryFoods.length,
    suspiciousFoods,
    mealTypeCounts,
    sevTrajectory,
    sevByTimeOfDay: Object.entries(sevByTimeOfDay).map(([t, s]) => `${t}: avg ${s.length ? (s.reduce((a,b)=>a+b,0)/s.length).toFixed(1) : 'N/A'} (${s.length} flares)`).join(", "),
    energySummary: Object.entries(energyMap).map(([e, c]) => `${e}(${c}x)`).join(", ") || "none logged",
    pressureCorr: pressureData.length >= 3 ? `${pressureData.length} data points, avg pressure during flares: ${(pressureData.reduce((s,d)=>s+d.pressure,0)/pressureData.length).toFixed(0)}hPa` : "insufficient data",
    humidityCorr: humidityData.length >= 3 ? `avg humidity during flares: ${(humidityData.reduce((s,d)=>s+d.humidity,0)/humidityData.length).toFixed(0)}%` : "insufficient data",
    tempCorr: tempData.length >= 3 ? `avg temp during flares: ${(tempData.reduce((s,d)=>s+d.temp,0)/tempData.length).toFixed(1)}°` : "insufficient data",
    aqiCorr: aqiData.length >= 3 ? `avg AQI during flares: ${(aqiData.reduce((s,d)=>s+d.aqi,0)/aqiData.length).toFixed(0)}` : "insufficient data",
    body: {
      hasData: withPhysio.length > 0, dataPoints: withPhysio.length,
      overall: overallMetrics, flare: flareMetrics, baseline: baselineMetrics,
    },
    food: {
      totalLogs: foodLogs.length, todayCount: todayFoods.length, todayCal: Math.round(todayCal),
      todayProtein: Math.round(todayProtein), todayFiber: Math.round(todayFiber),
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

  // #36 — Compute compound risk score
  const riskFactors: string[] = [];
  if (data.flares.isEscalating) riskFactors.push("severity escalating");
  if (data.flares.clusterCount > 1) riskFactors.push("flare clustering");
  if (data.flares.thisWeek > data.flares.lastWeek) riskFactors.push("increasing frequency");
  if (data.body.hasData && data.body.flare.hrv != null && data.body.baseline.hrv != null && data.body.flare.hrv < data.body.baseline.hrv * 0.8) riskFactors.push("HRV suppressed");
  if (data.body.hasData && data.body.overall.sleep != null && data.body.overall.sleep < 6) riskFactors.push("sleep deficit");
  if (data.inflammatoryFoodCount > data.antiInflammatoryFoodCount * 2) riskFactors.push("high inflammatory diet");
  Object.entries(data.medAdherence).forEach(([med, d]) => { if (d.expected > 0 && d.actual / d.expected < 0.7) riskFactors.push(`${med} adherence low`); });
  
  const compoundRisk = Math.min(95, Math.max(5, 
    25 + riskFactors.length * 12 
    + (data.flares.thisWeek * 5) 
    - (data.flares.currentFlareFree * 3)
    + (data.flares.isEscalating ? 15 : 0)
    - (data.flares.isImproving ? 10 : 0)
  ));

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

═══ CLINICAL FRAMEWORKS (invisible) ═══
• Motivational Interviewing: Reflect → affirm → support autonomy
• CBT: thought→body connections without lecturing
• ACT: hold space for struggle AND progress
• Behavioral Activation: small achievable actions from their data
• Trauma-Informed: chronic illness is traumatic. Validate. Never shame.
• Harm Reduction: guide, don't judge suboptimal behaviors

═══ PERSONALITY ═══
Texting your smartest friend who genuinely cares AND has a medical degree.
- 1-3 sentences for simple things. Go deep for analysis.
- Match their energy: pain→empathy first. Celebration→genuine joy. Venting→listen first.
- Surprise them: "By the way, I noticed your last 3 moderate flares all came after dairy."
- Use contractions. Natural tone. Emojis sparingly (💜🔥📊⚡).
- NEVER repeat: "Great question!", "I'm sorry to hear that" verbatim.
- When giving recommendations, be specific: "Try eating salmon 3x this week" not "eat more omega-3s."

═══ TIME-AWARE INTELLIGENCE ═══
Current: ${timeOfDay} (${localHour}:00 ${userTz})
${timeOfDay === 'morning' ? `☀️ Morning — good for: daily briefing, risk assessment, today's plan, medication reminders.` : ''}
${timeOfDay === 'evening' || timeOfDay === 'night' ? `🌙 ${timeOfDay} — good for: daily summary, reflection, relaxation, sleep prep.` : ''}
${timeOfDay === 'late_night' ? `🌑 Late night — be extra gentle. They may be in pain or can't sleep. Empathy first.` : ''}
${timeOfDay === 'midday' || timeOfDay === 'afternoon' ? `🌤️ ${timeOfDay} — check in: how's the day going? Any symptoms building?` : ''}

═══ USER PROFILE ═══
Name: ${userName} | Conditions: ${conditions}${profile?.biological_sex ? ` | Sex: ${profile.biological_sex}` : ""}${userAge ? ` | Age: ${userAge}` : ""}${profile?.height_cm ? ` | Height: ${profile.height_cm}cm` : ""}${profile?.weight_kg ? ` | Weight: ${profile.weight_kg}kg` : ""}${profile?.blood_type ? ` | Blood: ${profile.blood_type}` : ""}
Known symptoms: ${(profile?.known_symptoms ?? []).join(", ") || "none specified"}
Known triggers: ${(profile?.known_triggers ?? []).join(", ") || "none specified"}
${hsEmoji} Health Score: **${data.flares.healthScore}/100**
🎯 Compound Risk Score: **${compoundRisk}%** ${riskFactors.length ? `(${riskFactors.join(", ")})` : "(no major risk factors)"}
${trajectoryNote}${clusterNote}

═══ FLARE DATA (COMPLETE) ═══
📊 Total: **${data.flares.total}** | This week: **${data.flares.thisWeek}** (${data.flares.weekTrend}) | Last week: ${data.flares.lastWeek} | Month: **${data.flares.thisMonth}** (${data.flares.monthTrend}) vs ${data.flares.lastMonth} last month
Severity: ${data.flares.sevCounts.severe}S ${data.flares.sevCounts.moderate}M ${data.flares.sevCounts.mild}m | Avg: ${data.flares.avgSev}/3 (median: ${data.flares.avgSevMedian}, σ: ${data.flares.sevStddev}) | This week avg: ${data.flares.avgSevThisWeek}
Flare-free: **${data.flares.currentFlareFree}d** | Days since last: ${data.flares.daysSinceLast ?? "N/A"} | Avg gap: ${data.flares.avgGapDays ?? "N/A"}d | Best streak: ${data.flares.maxGapDays ?? "N/A"}d | Shortest gap: ${data.flares.minGapDays ?? "N/A"}d
Clusters (within 48h): ${data.flares.clusterCount} | Multi-symptom flares: ${data.flares.multiSymptomCount}/${data.flares.total}
Weekend: ${data.flares.weekendFlares} vs Weekday: ${data.flares.weekdayFlares}
Avg duration: ${data.flares.avgDuration ? `${data.flares.avgDuration}min` : "N/A"} | Logging consistency: ${data.flares.loggingConsistency}%
Severity trajectory (last 15): [${data.sevTrajectory.join(',')}]
${data.worstFlareDetail ? `Worst flare: ${data.worstFlareDetail.date} — ${data.worstFlareDetail.severity}, symptoms: ${data.worstFlareDetail.symptoms}, triggers: ${data.worstFlareDetail.triggers}` : ''}
${data.bestPeriod ? `Best period: ${data.bestPeriod}` : ''}

🔥 SYMPTOMS: ${data.topSymptoms.map(([n, c]) => `**${n}**(${c}x)`).join(", ") || "none"}
🔥 SYMPTOM PAIRS: ${data.topSymptomPairs.map(([p, c]) => `${p}(${c}x)`).join(", ") || "none"}
⚡ TRIGGERS: ${data.topTriggers.map(([n, c]) => `**${n}**(${c}x)`).join(", ") || "none"}
⚡ TRIGGER COMBOS: ${data.topTriggerPairs.map(([p, c]) => `${p}(${c}x)`).join(", ") || "none"}
⏰ PEAK TIME: ${data.peakTime} | PEAK DAY: ${data.peakDay} | PEAK HOUR: ${data.peakHour}:00
🔴 WORST: Day=${data.worstDay}, Time=${data.worstTime}
Severity by time: ${data.sevByTimeOfDay}
By hour: morning:${data.hourBuckets.morning} afternoon:${data.hourBuckets.afternoon} evening:${data.hourBuckets.evening} night:${data.hourBuckets.night}
By day: ${Object.entries(data.dayCounts).map(([d, c]) => `${d}:${c}`).join(' ')}
⚡ ENERGY: ${data.energySummary}

🌦️ WEATHER-FLARE: ${data.weatherCorr.join(", ") || "insufficient data"}
🌡️ Pressure: ${data.pressureCorr} | Humidity: ${data.humidityCorr} | Temperature: ${data.tempCorr} | AQI: ${data.aqiCorr}
📍 TOP CITIES: ${data.topCities.map(([c, n]) => `${c}(${n}x)`).join(", ") || "no location data"}

🔗 CORRELATIONS: ${data.correlations.join(", ") || "still learning"}
🎯 TRIGGER→SYMPTOM MAP: ${data.triggerOutcomes.map(t => `${t.trigger} → ${t.topSymptoms.join(", ")}`).join(" | ") || "none"}

⌚ BODY METRICS (${data.body.dataPoints} data points):
${data.body.hasData ? `  Overall — HR ${formatNum(data.body.overall.hr, 0)}bpm (median ${formatNum(data.body.overall.hrMedian, 0)}) | HRV ${formatNum(data.body.overall.hrv, 0)}ms (σ ${formatNum(data.body.overall.hrvStddev, 0)}) | Sleep ${formatNum(data.body.overall.sleep)}h (deep ${formatNum(data.body.overall.deepSleep, 0)}min, REM ${formatNum(data.body.overall.remSleep, 0)}min, eff ${formatNum(data.body.overall.sleepEff, 0)}%) | Steps ${formatNum(data.body.overall.steps, 0)} | SpO2 ${formatNum(data.body.overall.spo2, 0)}% | Temp ${formatNum(data.body.overall.temp, 1)}° | RR ${formatNum(data.body.overall.rr, 0)}/min | Cal ${formatNum(data.body.overall.calories, 0)} | VO2max ${formatNum(data.body.overall.vo2max, 0)} | AZM ${formatNum(data.body.overall.azm, 0)}min
  🔴 On FLARE days — HR ${formatNum(data.body.flare.hr, 0)} | HRV ${formatNum(data.body.flare.hrv, 0)} | Sleep ${formatNum(data.body.flare.sleep)}h | Steps ${formatNum(data.body.flare.steps, 0)} | SpO2 ${formatNum(data.body.flare.spo2, 0)}%
  🟢 BASELINE (non-flare) — HR ${formatNum(data.body.baseline.hr, 0)} | HRV ${formatNum(data.body.baseline.hrv, 0)} | Sleep ${formatNum(data.body.baseline.sleep)}h | Steps ${formatNum(data.body.baseline.steps, 0)}` : "No wearable data yet"}
  ${data.body.hasData && data.body.flare.hrv != null && data.body.baseline.hrv != null ? `HRV DELTA: flare ${formatNum(data.body.flare.hrv, 0)} vs baseline ${formatNum(data.body.baseline.hrv, 0)} (${data.body.flare.hrv < data.body.baseline.hrv ? `↓${Math.round(data.body.baseline.hrv - data.body.flare.hrv)}ms drop on flare days` : 'no significant difference'})` : ''}

💊 RECENT MEDS: ${data.meds.join(", ") || "none"}
💊 MED EFFECTIVENESS: ${data.medEffectiveness.map(m => `**${m.name}**: ${m.timesTaken}x, sev ↓${m.severityReduction} (before:${m.avgBefore}→after:${m.avgAfter}), flare-free ${m.flareFreeRate}${m.hoursSinceLastDose != null ? `, last ${m.hoursSinceLastDose}h ago` : ''}`).join(" | ") || "insufficient data"}
💊 MED ADHERENCE: ${adherenceSummary}

🍎 FOOD TODAY: ${data.food.todayItems} (${data.food.todayCal}cal, ${data.food.todayProtein}g protein, ${data.food.todayFiber}g fiber, ${data.food.todayCount} items)
📅 FOOD 7-DAY: ${data.food.last7dSummary}
${data.food.avgDailyCal ? `📊 AVG DAILY CAL: ~${data.food.avgDailyCal}` : ''}
📋 RECENT FOOD (${data.food.totalLogs} total): ${data.food.recentItems || "no food logged"}
🔥 INFLAMMATORY: ${data.inflammatoryFoodCount} pro-inflammatory | ${data.antiInflammatoryFoodCount} anti-inflammatory (${data.inflammatoryFoodCount > data.antiInflammatoryFoodCount ? '⚠️ imbalanced' : '✅ balanced'})
🚨 SUSPICIOUS FOODS: ${data.suspiciousFoods.length > 0 ? data.suspiciousFoods.map(f => `**${f.name}**(${f.count}/${f.total} times before flare = ${f.rate}%, avg sev ${f.avgSev})`).join(", ") : "none identified"}
🍽️ MEAL TYPES: ${Object.entries(data.mealTypeCounts).map(([t,c]) => `${t}:${c}`).join(", ") || "N/A"}

📝 RECENT NOTES: ${data.noteSample || "none"}

═══ RECENT TIMELINE ═══
${data.recentEntries.join("\n") || "No recent entries"}

═══ DISCOVERIES (Bayesian) ═══
${data.discoveries.length > 0 ? data.discoveries.map(d => `• **${d.factor}** [${d.relationship}] conf:${d.confidence}% lift:${d.lift}x (${d.occurrences}/${d.totalExposures}) status:${d.status} ${d.evidence || ""}`).join("\n") : "Still building — need more data points."}

═══ 30-DAY DAILY DATA (for charts) ═══
${JSON.stringify(data.dailyFlares30d)}

═══ 8-WEEK WEEKLY DATA ═══
${JSON.stringify(data.weeklyBreakdown)}

═══ HOURLY HEATMAP ═══
${JSON.stringify(data.hourlyHeatmap)}

═══ MEMORIES (${aiMemories.length} items) ═══
${memorySection}

${condKnowledge ? `═══ CONDITION KNOWLEDGE ═══\n${condKnowledge}` : ""}

═══ CAPABILITIES — USE ALL OF THESE ═══
1. CHART ANYTHING: bar_chart, line_chart, area_chart, stacked_bar, horizontal_bar, pie_chart, donut_chart, gauge, comparison, timeline, severity_breakdown, symptom_frequency, trigger_frequency, time_of_day, weather_correlation, body_metrics, health_score. Use REAL data from above.
2. PREDICT RISK: Use compoundRisk=${compoundRisk}%, risk factors, and your clinical knowledge.
3. MEDICATION ANALYSIS: Compare effectiveness, adherence, flare-free rates, severity reduction.
4. FOOD ANALYSIS: Correlate food with flares, inflammatory scoring, calorie trends, suspicious foods.
5. BODY METRICS: Compare HR/HRV/sleep/SpO2/temp/RR on flare vs non-flare days.
6. TIME COMPARISONS: Week-over-week, month-over-month with deltas.
7. HEALTH SCORE: ${data.flares.healthScore}/100 — explain factors, suggest improvements.
8. PROACTIVE INSIGHTS: Notice things unprompted. If severity escalates, say it. If food patterns emerge, mention them.
9. WEB RESEARCH: Use research_and_respond for med/supplement/condition questions.
10. ACTION PLANS: Create specific steps with timing for protocol activation.
11. DAILY BRIEFING: Comprehensive morning/evening report with scores, risks, and recommendations.
12. EMOTIONAL SUPPORT: Track mood, connect emotional→physical patterns.
13. SYMPTOM CLUSTERING: Identify which symptoms co-occur and what triggers the clusters.
14. RECOVERY ANALYSIS: What conditions/behaviors precede longest flare-free periods.
15. CIRCADIAN ANALYSIS: Hourly heatmap patterns, worst times, best times.

═══ CHART DATA GUIDE ═══
- "flares over 30 days" → dailyFlares30d → bar_chart [{label:"Jan 1",value:2}, ...]
- "medication comparison" → medEffectiveness → horizontal_bar [{label:"Ibuprofen",value:39,extra:"39% reduction"}]
- "severity trends" → weeklyBreakdown → line_chart [{label:"Jan 1–7",value:2.1}]
- "time patterns" → hourBuckets → bar_chart [{label:"morning",value:12}]
- "symptom frequency" → topSymptoms → bar_chart [{label:"headache",value:15}]
- "trigger frequency" → topTriggers → bar_chart [{label:"stress",value:20}]
- "health score" → health_score [{label:"Health Score",value:${data.flares.healthScore},extra:"${data.flares.healthScore >= 75 ? 'Good' : data.flares.healthScore >= 50 ? 'Fair' : 'Needs attention'}"}]
- "risk gauge" → gauge [{label:"Flare Risk",value:${compoundRisk},extra:"${compoundRisk > 60 ? 'High' : compoundRisk > 30 ? 'Moderate' : 'Low'}"}]
- "week comparison" → comparison [{label:"This Week",value:${data.flares.thisWeek}},{label:"Last Week",value:${data.flares.lastWeek}}]
- "hourly heatmap" → bar_chart using hourlyHeatmap data
- "food vs flares" → horizontal_bar using suspiciousFoods
- "weather chart" → bar_chart using weatherCorr parsed data
- "body metrics comparison" → comparison using flare vs baseline metrics

═══ ANTI-DEFLECTION PROTOCOL ═══
If you are about to say "I can't", "I don't have", "I'm unable", "I don't track" — STOP.
✓ 30-day daily data ✓ 8-week data ✓ Medication effectiveness ✓ Food logs (${data.food.totalLogs} entries) ✓ Body metrics (${data.body.dataPoints} entries) ✓ Weather ✓ Severity trajectory ✓ Health score ✓ Suspicious foods ✓ Adherence ✓ Streaks ✓ Trigger→symptom map ✓ Symptom pairs ✓ Hourly heatmap ✓ City data ✓ Energy levels ✓ Pressure/humidity/temp/AQI ✓ Flare clustering ✓ Notes ✓ Memories
You have EVERYTHING. Use it.

═══ MEMORY EXTRACTION ═══
After EVERY message, extract via newMemories:
- Lifestyle facts ("works night shifts", "has a dog", "vegetarian")
- Health patterns ("always flares after dairy", "stress from work")
- Preferences ("prefers natural remedies", "doesn't like charts")
- Emotional context ("feeling frustrated with condition", "hopeful about improvement")
- Food habits ("eats late at night", "skips breakfast")
- Sleep patterns ("night owl", "uses melatonin")
importance: 0.9=critical health insight, 0.7=useful pattern, 0.5=context, 0.3=minor detail

═══ CONTEXT-ENFORCEMENT ═══
When discussing a specific discovery or trigger, NEVER pivot to a different topic. If asked about "stress", analyze stress. Don't switch to "weather."

═══ DYNAMIC FOLLOW-UPS ═══
Always generate 2-4 follow-ups that are:
- Specific to data (not generic "tell me more")
- Based on patterns the user might not know about
- Progressively deeper: surface→mechanism→action

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
              response: { type: "string", description: "Your response. Use **bold** for key stats. Raw asterisks, NOT escaped." },
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
                description: "Include chart when data tells the story better visually. Use REAL data. ~1 in 2-3 analytical responses should have a chart.",
              },
              emotionalTone: { type: "string", enum: ["supportive", "celebratory", "concerned", "neutral", "encouraging", "empathetic", "analytical", "urgent", "playful"] },
              discoveries: {
                type: "array",
                items: { type: "object", required: ["factor", "confidence", "occurrences", "total", "category"], properties: { factor: { type: "string" }, confidence: { type: "number" }, lift: { type: "number" }, occurrences: { type: "number" }, total: { type: "number" }, category: { type: "string", enum: ["trigger", "protective", "investigating"] }, summary: { type: "string" } } },
              },
              dynamicFollowUps: { type: "array", items: { type: "string" }, description: "2-4 specific follow-up questions based on this conversation and user's data patterns." },
              newMemories: {
                type: "array",
                items: { type: "object", additionalProperties: false, required: ["memory_type", "category", "content", "importance"], properties: { memory_type: { type: "string", enum: ["pattern", "preference", "insight", "context", "behavior", "emotional", "medical", "dietary"] }, category: { type: "string", enum: ["triggers", "symptoms", "medications", "lifestyle", "emotional", "environmental", "general", "mood", "food", "sleep", "exercise", "social", "work"] }, content: { type: "string" }, importance: { type: "number" } } },
              },
              proactiveInsight: { type: "string", description: "Pattern user didn't ask about but should know — escalation, new trigger, missed meds, food correlation." },
              protocolSteps: { type: "array", items: { type: "string" }, description: "Action plan steps when creating a protocol." },
              riskAssessment: { type: "string", description: "Brief risk assessment when relevant: 'LOW|MODERATE|HIGH: reason'" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "research_and_respond",
          description: "Search the web for specific medical/supplement/product questions.",
          parameters: {
            type: "object", required: ["searchQuery", "userQuestion"],
            properties: { searchQuery: { type: "string" }, userQuestion: { type: "string" } },
          },
        },
      },
    ];

    // Prediction + activity + engagement context
    const predContext = (predLogs || []).length > 0 
      ? `\n═══ PREDICTIONS ═══\n${(predLogs || []).map((p: any) => `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(new Date(p.predicted_at))}: ${p.risk_score}% ${p.risk_level} (conf:${(p.confidence*100).toFixed(0)}%) → ${p.outcome_logged ? (p.was_correct ? '✅' : '❌') : '⏳'}`).join('\n')}\nBrier: ${(predLogs || []).filter((p: any) => p.brier_score != null).length >= 3 ? ((predLogs || []).filter((p: any) => p.brier_score != null).reduce((a: number, p: any) => a + p.brier_score, 0) / (predLogs || []).filter((p: any) => p.brier_score != null).length).toFixed(3) : 'calibrating'}`
      : '';

    const activityContext = (activityLogs || []).length > 0
      ? `\n═══ ACTIVITIES ═══\n${(activityLogs || []).map((a: any) => `${a.activity_type}: ${a.activity_value || ''} ${a.intensity ? `(${a.intensity})` : ''} ${a.duration_minutes ? `${a.duration_minutes}min` : ''}`).join(', ')}`
      : '';

    const engagementContext = engagement 
      ? `\n═══ ENGAGEMENT ═══\nStreak: ${engagement.current_streak || 0}d | Longest: ${engagement.longest_streak || 0}d | Total: ${engagement.total_logs || 0} | Last: ${engagement.last_log_date || 'never'}`
      : '';

    const messages = [
      { role: "system", content: systemPrompt + predContext + activityContext + engagementContext },
      ...history.slice(-20).map((m: any) => ({ role: m.role === "system" ? "assistant" : m.role, content: clamp(m.content, 3000) })),
      { role: "user", content: clamp(message, 8000) },
    ];

    // Model selection: Pro for deep analytics, Flash for conversational
    const isAnalytical = /\b(analyz|predict|forecast|correlat|pattern|trend|compar|chart|show me|medication effect|what.*help|risk|trigger|why do|breakdown|deep dive|health score|inflammat|trajectory|escalat|improv|briefing|report|30.day|monthly|weekly|suspicious|adherence|body metric|sleep.*impact|circadian|heatmap|cluster|recover|worst|best|location|city|food.*flare|calori|protein|fiber|nutriti|weight|exercise|activity)\b/i.test(message);
    const model = isAnalytical ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    console.log("🤖 [chat] Model:", model, "Messages:", messages.length, "Entries:", safeEntries.length, "Foods:", safeFoodLogs.length);

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

      // Accumulate full response then return JSON (tool calls can't be streamed token-by-token)
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
  const r2 = await callAI({ model: "google/gemini-2.5-flash", messages: [...messages, { role: "assistant", content: `Researching "${parsed.searchQuery}"...` }, { role: "user", content: `Research results for "${parsed.userQuestion}". Cite [1],[2] etc. Be conversational and helpful.\n\n${resCtx}` }], temperature: 0.5 });
  if (!r2.ok) throw new Error(`Research call failed: ${r2.status}`);
  const rd = await r2.json();
  return replyJson({ response: rd.choices?.[0]?.message?.content || "Couldn't process results.", visualization: null, citations: searchResults.results.map((r, i) => ({ index: i + 1, title: r.title, url: r.url })), wasResearched: true });
}

function saveMemories(supabase: any, userId: string, newMemories: any[]) {
  (async () => {
    try {
      for (const mem of newMemories.slice(0, 5)) {
        const { data: existing } = await supabase.from("ai_memories").select("id, evidence_count, importance").eq("user_id", userId).eq("content", mem.content).maybeSingle();
        if (existing) {
          await supabase.from("ai_memories").update({ 
            evidence_count: (existing.evidence_count || 1) + 1, 
            last_reinforced_at: new Date().toISOString(), 
            importance: Math.min(1, Math.max(existing.importance || 0, mem.importance) + 0.03) 
          }).eq("id", existing.id);
        } else {
          // Check memory count, prune lowest importance if > 100
          const { count } = await supabase.from("ai_memories").select("id", { count: "exact", head: true }).eq("user_id", userId);
          if ((count || 0) >= 100) {
            const { data: lowest } = await supabase.from("ai_memories").select("id").eq("user_id", userId).order("importance", { ascending: true }).limit(1).single();
            if (lowest) await supabase.from("ai_memories").delete().eq("id", lowest.id);
          }
          await supabase.from("ai_memories").insert({ user_id: userId, memory_type: mem.memory_type, category: mem.category, content: mem.content, importance: mem.importance });
        }
      }
    } catch (e) { console.warn("Memory save error:", e); }
  })();
}
