import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Compact condition knowledge — key info + proactive triggers
const CK: Record<string, [string, string]> = {
  'Asthma': ['Sleep disruption bidirectional. Peak 4-6AM (cortisol dip). Triggers: cold/dry air, humidity>60%, AQI, GERD, stress, exercise. Caffeine mild bronchodilator. Barometric drops precede flares.', 'After meals(GERD), before exercise, weather changes, evening(nocturnal), spring/fall pollen'],
  'Migraine': ['Sleep #1 trigger (<6h/>9h risky). Threshold model: triggers stack. Dehydration, skipped meals, alcohol, aged cheese, MSG, lights, weather. Prodrome 24-48h. HRV drops 12-24h before. Mg 400mg/day preventive.', 'After skipped meals, dehydration, after alcohol, pressure changes, cycle days 1-3/24-28, after poor sleep'],
  'Eczema': ['Sleep loss impairs barrier. Triggers: humidity<30%, temp extremes, sweat, stress, wool, SLS, dust mites. Hot showers strip lipids. Nocturnal scratching. Fall→winter worst.', 'After shower, season changes, dry weather, stress, dairy/gluten, evening itch, post-exercise'],
  'Acne': ['Sleep loss→cortisol→sebum→breakouts 48-72h. Dairy(skim milk IGF-1), high-glycemic foods. Exercise helps but shower within 30min.', 'After dairy/sugar, post-exercise, bedtime skincare, cycle tracking, stress'],
  'Anxiety': ['Bidirectional with sleep (amygdala+60%). Caffeine>200mg worsens. HRV biomarker. Exercise=SSRIs for mild-moderate. Blood sugar crashes mimic anxiety. Alcohol rebound 4-8h.', 'Morning, after caffeine, after meals(sugar), before social events, evening, after alcohol'],
  'IBS': ['Gut-brain axis. FODMAPs: onions,garlic,wheat,dairy,apples. Large meals=gastrocolic reflex. Caffeine→urgency. Cycle: progesterone slows(luteal), prostaglandins increase(menses).', 'After every meal(30-90min), morning bowels, FODMAP foods, stress, caffeine, cycle days'],
  'Lower Back Pain': ['Poor sleep→+50% pain sensitivity. Sedentary>6h dangerous. Cold/pressure drops increase stiffness. 10lbs overweight=40lbs lumbar force.', 'After 2h+ sitting, morning stiffness, after exercise, weather changes, after lifting, evening'],
  'Fibromyalgia': ['Central sensitization. Sleep critical(alpha-wave intrusion 90%). Weather sensitivity. Exercise paradox. Fibro fog. 30-70% comorbid IBS/TMJ/migraine/anxiety.', 'Morning pain/fatigue, after sleep, weather changes, after activity(pacing), evening, stress'],
  'Endometriosis': ['Cyclical and non-cyclical pain. Anti-inflammatory diet helps. GI overlap 50-80%. Cycle mapping critical.', 'Cycle days 1-5/24-28, after meals(GI), post-exercise, evening pain, stress'],
  'GERD': ['Nighttime worst. No eating 3h before bed. Coffee,chocolate,alcohol,spicy,citrus,fatty,mint. Left-side sleeping -75% reflux.', 'After every meal(20-60min), before bed, after coffee/alcohol, after spicy/fatty, morning reflux'],
  'Diabetes': ['Postprandial spikes 60-90min. Dawn phenomenon 4-8AM. Exercise lowers glucose but intense can spike. Poor sleep=-25-30% insulin sensitivity.', 'Before/after every meal, morning fasting, post-exercise, before bed, after stress, after alcohol'],
  'Hypertension': ['Sodium<2300mg. DASH diet -8-14mmHg. 150min/week exercise -5-8mmHg. Sleep apnea in 50% resistant HTN. Caffeine acute +5-10mmHg 2-3h.', 'Morning BP, after meals(sodium), post-exercise, stress, medication timing, after caffeine'],
  'Depression': ['Consistent wake time>sleep duration. Behavioral activation. Exercise releases BDNF. Social isolation worsens. Alcohol crash 24-48h. Mediterranean diet -30% risk.', 'Morning mood, mid-afternoon energy, evening reflection, after social events, activity prompts, meal regularity'],
  'ADHD': ['Executive function=dopamine. Delayed sleep phase common. Hyperfocus→skipped meals/dehydration. Exercise +dopamine 2-3h.', 'Medication timing, meal reminders, hydration, evening wind-down, sleep routine, activity breaks'],
  'Psoriasis': ['T-cell mediated. Stress #1. Alcohol worsens. Cold/dry flares. UV therapeutic. Koebner phenomenon.', 'After stress, cold/dry weather, after alcohol, illness onset, skin injury, after shower(moisturize)'],
  'Rheumatoid Arthritis': ['Morning stiffness>30min=active. Worst morning(IL-6 surge). Cold/pressure drops. Omega-3 3g/day. Fatigue in 80%.', 'Morning stiffness, after meals(inflammatory), weather changes, evening fatigue, medication timing, after exercise'],
  'Crohn\'s Disease': ['Stress most consistent trigger. Diet highly individual. Smoking strongest risk. Extra-intestinal: fatigue,joints,skin.', 'After every meal(30-120min), morning bowels, stress, medication adherence, hydration, sleep, fatigue'],
  'Ulcerative Colitis': ['NSAIDs trigger flares. Probiotics(VSL#3) maintain remission. Vagus→gut inflammation.', 'After meals, medication adherence, stress, morning symptoms, NSAID alert, evening, sleep quality'],
  'Lupus': ['UV triggers flares(60-80% photosensitive). SPF50+ always. Fatigue most debilitating. Raynaud\'s: cold→vasospasm.', 'Before sun exposure, morning fatigue, stress, illness onset, medication timing, evening joint/skin, cold weather'],
  'PCOS': ['Insulin resistance 70-80%. Low-glycemic critical. 5% weight loss restores ovulation. 150min/week exercise improves insulin.', 'Meal tracking(glycemic), exercise, cycle tracking, stress, skin/hair, weight, energy'],
  'Chronic Fatigue Syndrome': ['PEM 12-72h after exceeding threshold. Activity pacing critical. HR below anaerobic threshold. Non-restorative sleep.', 'Morning energy, activity pacing every 2h, post-activity(24-72h PEM), evening energy, HR alerts'],
  'Allergies': ['Pollen highest 5-10AM. Priming effect. Cross-reactivity: birch→apples/carrots. Saline irrigation -30-40%.', 'Morning symptoms, after outdoor time, pollen/weather, indoor air, before/after meds, seasonal transitions'],
  'Hypothyroidism': ['Levothyroxine empty stomach 30-60min before food. Calcium/iron/coffee reduce absorption(space 4h). Cold intolerance.', 'Medication timing(morning empty stomach), energy, cold sensitivity, bowels, mood/brain fog, weight'],
  'Cough': ['Can be viral(acute<3wk), post-nasal drip, asthma-variant, GERD-related, or ACE-inhibitor. Cold/dry air irritates airways. Exercise-induced in some. Hydration helps thin mucus.', 'After exercise/exertion, cold air exposure, dusty environments, post-meals(GERD), morning, evening, after talking a lot'],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub as string;

    const { query, clientTimezone, chatHistory } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [entriesRes, profileRes, correlationsRes, medsRes, engagementRes, discoveriesRes] = await Promise.all([
      supabase.from("flare_entries").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(1000),
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("correlations").select("*").eq("user_id", userId).order("confidence", { ascending: false }),
      supabase.from("medication_logs").select("*").eq("user_id", userId).order("taken_at", { ascending: false }).limit(500),
      supabase.from("engagement").select("*").eq("user_id", userId).single(),
      supabase.from("discoveries").select("*").eq("user_id", userId).gte("confidence", 0.25).order("confidence", { ascending: false }).limit(30),
    ]);

    const entries = entriesRes.data || [];
    const profile = profileRes.data;
    const correlations = correlationsRes.data || [];
    const medications = medsRes.data || [];
    const engagement = engagementRes.data;
    const discoveries = discoveriesRes.data || [];
    const flares = entries.filter((e: any) => e.entry_type === "flare" || e.severity);
    const now = Date.now();
    const oneDay = 86400000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;
    const sevToNum = (s: string) => s === 'mild' ? 1 : s === 'moderate' ? 2 : s === 'severe' ? 3 : 0;

    const thisWeekFlares = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneWeek);
    const lastWeekFlares = flares.filter((e: any) => { const a = now - new Date(e.timestamp).getTime(); return a >= oneWeek && a < 2 * oneWeek; });
    const thisMonthFlares = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneMonth);
    const lastMonthFlares = flares.filter((e: any) => { const a = now - new Date(e.timestamp).getTime(); return a >= oneMonth && a < 2 * oneMonth; });

    const calcSev = (l: any[]) => l.length ? l.reduce((a, e) => a + sevToNum(e.severity || ''), 0) / l.length : 0;
    const stats = {
      total: flares.length,
      thisWeek: thisWeekFlares.length, lastWeek: lastWeekFlares.length,
      thisMonth: thisMonthFlares.length, lastMonth: lastMonthFlares.length,
      avgSeverity: calcSev(flares),
      mildCount: flares.filter((e: any) => e.severity === "mild").length,
      moderateCount: flares.filter((e: any) => e.severity === "moderate").length,
      severeCount: flares.filter((e: any) => e.severity === "severe").length,
    };

    // Symptom/trigger counts
    const symptomCounts: Record<string, number> = {};
    const triggerCounts: Record<string, number> = {};
    flares.forEach((e: any) => {
      (e.symptoms || []).forEach((s: string) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
      (e.triggers || []).forEach((t: string) => { triggerCounts[t] = (triggerCounts[t] || 0) + 1; });
    });

    const userTz = clientTimezone || profile?.timezone || 'UTC';
    const getLocalHour = (d: Date): number => {
      try {
        const p = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: userTz }).formatToParts(d);
        return parseInt(p.find(x => x.type === "hour")?.value || "0", 10);
      } catch { return d.getUTCHours(); }
    };
    const getLocalDay = (d: Date): number => {
      try {
        const s = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: userTz }).format(d);
        return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(s);
      } catch { return d.getUTCDay(); }
    };

    // Time patterns
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, { count: number }> = {};
    flares.forEach((e: any) => {
      const d = new Date(e.timestamp);
      hourCounts[getLocalHour(d)] = (hourCounts[getLocalHour(d)] || 0) + 1;
      const day = getLocalDay(d);
      if (!dayCounts[day]) dayCounts[day] = { count: 0 };
      dayCounts[day].count++;
    });

    // Location/weather
    const locationCounts: Record<string, { count: number; lat?: number; lng?: number }> = {};
    const weatherCounts: Record<string, { count: number; severity: number[] }> = {};
    flares.forEach((e: any) => {
      const city = e.city || e.environmental_data?.location?.city;
      if (city) {
        if (!locationCounts[city]) locationCounts[city] = { count: 0, lat: e.latitude, lng: e.longitude };
        locationCounts[city].count++;
      }
      const w = e.environmental_data?.weather?.condition?.toLowerCase();
      if (w) {
        if (!weatherCounts[w]) weatherCounts[w] = { count: 0, severity: [] };
        weatherCounts[w].count++;
        weatherCounts[w].severity.push(sevToNum(e.severity || 'mild'));
      }
    });

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
      weeklyBreakdown.push({ week: `${sl}–${el}`, total: wf.length });
    }

    // Med effectiveness
    const medEffectiveness: any[] = [];
    const uniqueMeds = [...new Set(medications.map((m: any) => m.medication_name))];
    for (const medName of uniqueMeds) {
      const doses = medications.filter((m: any) => m.medication_name === medName);
      let sevBefore = 0, cntB = 0, sevAfter = 0, cntA = 0;
      for (const dose of doses) {
        const dt = new Date(dose.taken_at).getTime();
        flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t >= dt - oneDay && t < dt; }).forEach((f: any) => { sevBefore += sevToNum(f.severity || 'mild'); cntB++; });
        flares.filter((f: any) => { const t = new Date(f.timestamp).getTime(); return t > dt && t <= dt + oneDay; }).forEach((f: any) => { sevAfter += sevToNum(f.severity || 'mild'); cntA++; });
      }
      const ab = cntB > 0 ? sevBefore / cntB : 0, aa = cntA > 0 ? sevAfter / cntA : 0;
      medEffectiveness.push({ name: medName, timesTaken: doses.length, severityReduction: ab > 0 ? `${Math.round(((ab - aa) / ab) * 100)}%` : '0%' });
    }

    // Trigger→symptom
    const tsMap: Record<string, Record<string, number>> = {};
    flares.forEach((f: any) => { (f.triggers || []).forEach((t: string) => { if (!tsMap[t]) tsMap[t] = {}; (f.symptoms || []).forEach((s: string) => { tsMap[t][s] = (tsMap[t][s] || 0) + 1; }); }); });
    const triggerOutcomes = Object.entries(tsMap).map(([t, syms]) => ({ trigger: t, topSymptoms: Object.entries(syms).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, c]) => ({ symptom: s, count: c })) })).slice(0, 10);

    const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const dataContext = {
      overview: { totalFlares: stats.total, severity: { mild: stats.mildCount, moderate: stats.moderateCount, severe: stats.severeCount }, avgSeverity: stats.avgSeverity.toFixed(1), thisWeek: stats.thisWeek, lastWeek: stats.lastWeek, thisMonth: stats.thisMonth, lastMonth: stats.lastMonth },
      dailyFlares30d, weeklyBreakdown, medEffectiveness, triggerOutcomes,
      topSymptoms: Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, c]) => ({ name: n, count: c })),
      topTriggers: Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, c]) => ({ name: n, count: c })),
      locations: Object.entries(locationCounts).map(([c, d]) => ({ city: c, count: d.count })).sort((a, b) => b.count - a.count).slice(0, 8),
      locationMapData: Object.entries(locationCounts).map(([c, d]) => ({ city: c, count: d.count, lat: d.lat || 0, lng: d.lng || 0 })).slice(0, 20),
      weather: Object.entries(weatherCounts).map(([c, d]) => ({ condition: c, count: d.count, avgSeverity: (d.severity.reduce((a, b) => a + b, 0) / d.severity.length).toFixed(1) })).sort((a, b) => b.count - a.count).slice(0, 8),
      byDayOfWeek: dayNames.map((n, i) => ({ day: n, count: dayCounts[i]?.count || 0 })),
      byHour: Object.entries(hourCounts).map(([h, c]) => ({ hour: `${h}:00`, count: c })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour)),
      correlations: correlations.slice(0, 12).map((c: any) => ({ trigger: c.trigger_value, outcome: c.outcome_value, confidence: Math.round((c.confidence || 0) * 100), occurrences: c.occurrence_count })),
      discoveries: discoveries.map((d: any) => ({ type: d.discovery_type, category: d.category, factorA: d.factor_a, relationship: d.relationship, confidence: Math.round((d.confidence || 0) * 100), lift: d.lift?.toFixed(1), occurrences: d.occurrence_count, totalExposures: d.total_exposures, avgDelayHours: d.avg_delay_hours?.toFixed(1), status: d.status, evidence: d.evidence_summary })),
      profile: { name: profile?.full_name, conditions: profile?.conditions || [], knownSymptoms: profile?.known_symptoms || [], knownTriggers: profile?.known_triggers || [], timezone: userTz },
      engagement: { streak: engagement?.current_streak || 0, longestStreak: engagement?.longest_streak || 0, totalLogs: engagement?.total_logs || 0 },
    };

    const userName = profile?.full_name?.split(' ')[0] || 'there';
    const userConditions = profile?.conditions || [];
    const userSex = profile?.biological_sex || null;
    const userAge = profile?.date_of_birth ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400000)) : null;

    // Build condition knowledge
    const condKnowledge = userConditions.map((c: string) => {
      const ck = CK[c] || Object.entries(CK).find(([k]) => c.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(c.toLowerCase()))?.[1];
      return ck ? `${c}: ${ck[0]} PROACTIVE: ${ck[1]}` : `${c}: Track patterns. Sleep, stress, diet, environment commonly influence.`;
    }).join('\n');

    const condProactiveTriggers = userConditions.map((c: string) => {
      const ck = CK[c]; return ck ? `${c}: ${ck[1]}` : '';
    }).filter(Boolean).join('\n');

    const localHourNow = (() => { try { const p = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: userTz }).formatToParts(new Date()); return parseInt(p.find(x => x.type === "hour")?.value || "12", 10); } catch { return 12; } })();
    const timeOfDay = localHourNow < 6 ? 'late_night' : localHourNow < 10 ? 'morning' : localHourNow < 14 ? 'midday' : localHourNow < 18 ? 'afternoon' : localHourNow < 22 ? 'evening' : 'night';

    const mealCtx = localHourNow >= 7 && localHourNow < 10 ? 'Breakfast window.' : localHourNow >= 12 && localHourNow < 14 ? 'Lunch time.' : localHourNow >= 18 && localHourNow < 20 ? 'Dinner time.' : localHourNow >= 20 && localHourNow < 23 ? 'Post-dinner. GERD: stop eating 3h before bed.' : '';

    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    const recentEntries = entries.filter((e: any) => new Date(e.timestamp).getTime() > twoHoursAgo);
    const recentCtx = recentEntries.length > 0 ? `Recent(2h): ${recentEntries.map((e: any) => `${e.entry_type}${e.severity ? `(${e.severity})` : ''}${e.note ? `: "${e.note.substring(0, 40)}"` : ''}`).join('; ')}` : '';

    const systemPrompt = `You are Jvala's AI — ${userName}'s personal health companion.

══ IDENTITY RULES (ABSOLUTE) ══
- You are the ASSISTANT. You NEVER speak as the user. NEVER say "I'm doing well" or "I just logged" — those are user actions.
- You NEVER answer questions directed at you about YOUR feelings/state. Redirect to the user's health.
- You are NOT a generic chatbot. You are a specialized health intelligence that ALREADY KNOWS this user's full medical profile.
- NEVER ask the user to clarify data YOU tracked. If a discovery factor is "wellness", "morning", "monday" etc., those are YOUR internal categories — explain what the data means, don't ask "what do you mean by wellness?"

══ ANTI-DEFLECTION RULES ══
- When a user clicks a discovery or asks about a pattern, you MUST explain it with statistical evidence and clinical reasoning. NEVER deflect with "tell me more" or "what do you mean by X?"
- Discovery factors are system-generated labels. YOU understand them. Example: "wellness" = wellness check-ins the user logged. "morning" = time-of-day pattern. Explain the correlation, its strength, and what it means clinically.
- If a user asks about ANY discovery factor, respond with: 1) What the factor means in context, 2) The statistical evidence (confidence, lift, occurrences), 3) A clinical hypothesis for WHY this pattern exists, 4) An actionable recommendation.

══ PROACTIVE ══
Time: ${timeOfDay} (${localHourNow}:00 ${userTz}). ${mealCtx} ${recentCtx}
Condition triggers: ${condProactiveTriggers || 'None set.'}

RULES:
- You HAVE the user's full profile. Conditions: ${userConditions.join(', ') || 'none'}. Known symptoms: ${(profile?.known_symptoms || []).slice(0, 10).join(', ')}. Known triggers: ${(profile?.known_triggers || []).slice(0, 10).join(', ')}. Sex: ${userSex || 'unknown'}. ${userAge ? `Age: ${userAge}.` : ''}
- USE this proactively. Ask condition-specific questions without being asked.
- NEVER fake biometric tracking. For sleep/HR/steps without wearable, frame as self-reported. Suggest connecting wearable for auto-tracking.
- When user corrects a medication date (e.g. "that was yesterday"), update the timestamp via shouldLog. Never say you can't.

${stats.total < 15 ? `══ EXPLORATORY MODE (${stats.total} logs) ══
You are in DEEP INVESTIGATION mode. Your goal: build a complete picture of this person's health.
- Ask SCENARIO questions: "Does your cough get worse after running vs bowling vs walking?" "Is it worse indoors or outdoors?"
- Probe TIMING: "Does it hit harder in the morning or evening?" "How long does a coughing episode last?"
- Explore ENVIRONMENTS: "Are you around dust, smoke, or pets?" "Does cold air make it worse?"
- Cross-reference PROFILE symptoms not yet logged: ${(profile?.known_symptoms || []).join(', ')} — ask about ones they haven't logged.
- Investigate HISTORY: "When did this first start?" "Has anything changed recently — new environment, diet, stress?"
- ONE focused, specific question per message. Make them THINK about scenarios they haven't considered.` : ''}

══ PERSONALITY & FORMATTING ══
Smart friend texting. Warm, casual, brief. 1-3 sentences unless complex analysis. Use name sparingly(<25%). No corporate speak. Supportive emojis (💜, 👍) for negative contexts (pain, flares). Never celebratory for bad health events.
FORMATTING: Use **bold** for key medical terms, trigger names, stats, and important findings. Use bullet points for lists of 3+ items. This makes responses scannable and impactful. Example: "**Cold air** is your #1 confirmed trigger at **2.7x** lift."

══ PROACTIVE VISUALS ══
You CAN and SHOULD include charts/figures WITHOUT the user asking when they would genuinely enhance understanding. Use respond_with_visualization proactively for:
- Showing a comparison (this week vs last week) when discussing trends
- A severity breakdown pie chart when summarizing a period
- A timeline/line_chart when discussing "how things have been going"
- A pattern_summary when explaining multiple correlations
- A gauge chart for risk assessment ("your flare risk today")
- A comparison card when the user asks "am I getting better?"
DO NOT force a chart into every message. Use them when data tells a story better visually than text. Aim for ~1 in every 3-4 responses to include a figure.

══ CRITICAL ══
- NEVER say "I don't have access to your info" or "could you clarify what [system term] means." You have ALL data below.
- For health questions: use clinical knowledge. Be specific to THEIR conditions.
- For symptom insights: cross-reference symptoms with environmental data, time patterns, triggers, discoveries. Provide a clinical HYPOTHESIS for why patterns exist. End with a probing follow-up question.
- ONLY refuse: diagnosing new conditions, prescribing dosages, replacing doctor for emergencies.

══ CLINICAL KNOWLEDGE ══
${condKnowledge}

══ DISCOVERIES ══
These are statistically-derived patterns from the user's own data. You UNDERSTAND what each factor means.
When the user asks about a discovery, provide: statistical evidence → clinical explanation → actionable advice.
${JSON.stringify(dataContext.discoveries?.filter((d: any) => d.confidence >= 25) || [])}

══ CHART RULES ══
You CAN create charts proactively when data enhances the message. Use respond_with_visualization.
Chart types: bar_chart, horizontal_bar, pie_chart, donut_chart, line_chart, area_chart, scatter_plot, comparison, pattern_summary, gauge, location_map, weather_chart
For gauge: data=[{label:"Risk",value:65,extra:"moderate"}]. For comparison: data=[{label:"This Week",value:3,extra:"-2 fewer"},{label:"Last Week",value:5}].

══ DATA MAPPINGS ══
"30-day flares"→dailyFlares30d. "Compare weeks"→weeklyBreakdown. "Medication effectiveness"→medEffectiveness. "Time patterns"→byHour+byDayOfWeek. "Trigger→symptom"→triggerOutcomes.

══ NAV ══
Fitbit: Profile→Wearable→Connect. Meds: Profile→Medications. Export: Insights→Export. Reminders: Profile→Reminders.

══ USER DATA ══
${JSON.stringify(dataContext)}`;

    const tools = [
      { type: "function", function: { name: "respond_with_visualization", description: "Respond with chart. ONLY when user explicitly asks.", parameters: { type: "object", required: ["response", "chart"], properties: { response: { type: "string" }, chart: { type: "object", required: ["type", "title", "data"], properties: { type: { type: "string", enum: ["bar_chart","horizontal_bar","stacked_bar","pie_chart","donut_chart","line_chart","area_chart","scatter_plot","histogram","comparison","heatmap","pattern_summary","gauge","location_map","weather_chart"] }, title: { type: "string" }, data: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" }, x: { type: "number" }, y: { type: "number" }, latitude: { type: "number" }, longitude: { type: "number" }, extra: { type: "string" }, color: { type: "string" } } } }, config: { type: "object", properties: { xAxis: { type: "string" }, yAxis: { type: "string" } } } } }, dynamicFollowUps: { type: "array", items: { type: "string" } } } } } },
      { type: "function", function: { name: "respond_text_only", description: "Text response. Put discoveries in discoveries array for visual cards.", parameters: { type: "object", required: ["response"], properties: { response: { type: "string" }, discoveries: { type: "array", items: { type: "object", required: ["factor","confidence","occurrences","total","category"], properties: { factor: { type: "string" }, confidence: { type: "number" }, lift: { type: "number" }, occurrences: { type: "number" }, total: { type: "number" }, category: { type: "string", enum: ["trigger","protective","investigating"] }, summary: { type: "string" } } } }, dynamicFollowUps: { type: "array", items: { type: "string" } } } } } },
      { type: "function", function: { name: "research_and_respond", description: "Search web for specific products/meds/supplements/studies before responding.", parameters: { type: "object", required: ["searchQuery","userQuestion"], properties: { searchQuery: { type: "string" }, userQuestion: { type: "string" } } } } },
    ];

    const aiMessages: { role: string; content: string }[] = [{ role: "system", content: systemPrompt }];
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory.slice(-20)) {
        aiMessages.push({ role: msg.role === 'system' ? 'user' : msg.role, content: msg.content || '' });
      }
    }
    aiMessages.push({ role: "user", content: query });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: aiMessages, tools, temperature: 0.7 }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);

        if (toolCall.function.name === "research_and_respond") {
          const searchResults = await searchWeb(parsed.searchQuery);
          if (searchResults.results.length === 0) {
            return new Response(JSON.stringify({ response: "Couldn't find specific results. Let me answer from what I know.", visualization: null, citations: [], wasResearched: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const resCtx = searchResults.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n---\n');
          const r2 = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [...aiMessages, { role: "assistant", content: `Researching "${parsed.searchQuery}"...` }, { role: "user", content: `Research results for "${parsed.userQuestion}". Cite [1],[2] etc. Be conversational.\n\n${resCtx}` }], temperature: 0.5 }),
          });
          if (!r2.ok) throw new Error(`Research call failed: ${r2.status}`);
          const rd = await r2.json();
          return new Response(JSON.stringify({ response: rd.choices?.[0]?.message?.content || "Couldn't process results.", visualization: null, citations: searchResults.results.map((r, i) => ({ index: i + 1, title: r.title, url: r.url })), wasResearched: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (toolCall.function.name === "respond_with_visualization") {
          return new Response(JSON.stringify({ response: parsed.response, visualization: parsed.chart, dynamicFollowUps: parsed.dynamicFollowUps, citations: [], wasResearched: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // respond_text_only — strip leftover discovery blocks
        let cleaned = (parsed.response || "")
          .replace(/(?:💡\s*)?(?:\*{1,2})?Discovery:\s*[^\n]+\*{0,2}\n[\s\S]*?(?=(?:💡\s*)?(?:\*{1,2})?Discovery:|$)/gi, '')
          .replace(/_[A-Za-z]+\s*•\s*\d+%?\s*confidence\s*•\s*\d+\s*occurrences?_/gi, '')
          .replace(/\n{3,}/g, '\n\n').trim();

        let disc = parsed.discoveries || [];
        if (disc.length === 0) {
          const rx = /(?:💡\s*)?(?:\*{1,2})?Discovery:\s*([^\n*]+?)(?:\*{0,2})\n+(\d+)\s*out\s*of\s*(\d+)\s*times?\s*\((\d+)%\).*?(\d+\.?\d*)x\s*more\s*likely/gi;
          let m; const raw = parsed.response || "";
          while ((m = rx.exec(raw)) !== null) {
            disc.push({ factor: m[1].trim(), occurrences: parseInt(m[2]), total: parseInt(m[3]), confidence: parseInt(m[4]), lift: parseFloat(m[5]), category: "trigger", summary: `${m[2]}/${m[3]} times` });
          }
        }

        return new Response(JSON.stringify({ response: cleaned, visualization: null, discoveries: disc, dynamicFollowUps: parsed.dynamicFollowUps, citations: [], wasResearched: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) { console.error("Parse error:", e); }
    }

    // Fallback
    let fb = data.choices?.[0]?.message?.content || "I'm here to help.";
    const fbDisc: any[] = [];
    const rx2 = /(?:💡\s*)?(?:\*{1,2})?Discovery:\s*([^\n*]+?)(?:\*{0,2})\n+(\d+)\s*out\s*of\s*(\d+)\s*times?\s*\((\d+)%\).*?(\d+\.?\d*)x\s*more\s*likely/gi;
    let m2;
    while ((m2 = rx2.exec(fb)) !== null) { fbDisc.push({ factor: m2[1].trim(), occurrences: parseInt(m2[2]), total: parseInt(m2[3]), confidence: parseInt(m2[4]), lift: parseFloat(m2[5]), category: "trigger", summary: `${m2[2]}/${m2[3]} times` }); }
    fb = fb.replace(/(?:💡\s*)?(?:\*{1,2})?Discovery:\s*[^\n]+\*{0,2}\n[\s\S]*?(?=(?:💡\s*)?(?:\*{1,2})?Discovery:|$)/gi, '').replace(/_[A-Za-z]+\s*•\s*\d+%?\s*confidence\s*•\s*\d+\s*occurrences?_/gi, '').replace(/\n{3,}/g, '\n\n').trim();

    return new Response(JSON.stringify({ response: fb, visualization: null, discoveries: fbDisc, citations: [], wasResearched: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
