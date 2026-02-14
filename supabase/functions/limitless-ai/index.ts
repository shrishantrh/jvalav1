import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Web Research via Firecrawl ──────────────────────────────────────────────
async function searchWeb(query: string): Promise<{ results: Array<{ title: string; url: string; snippet: string }>; error?: string }> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return { results: [], error: "Research capability not configured" };

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl error:", response.status);
      return { results: [], error: `Search failed: ${response.status}` };
    }

    const data = await response.json();
    const results = (data.data || []).map((r: any) => ({
      title: r.title || r.metadata?.title || "Source",
      url: r.url || r.metadata?.sourceURL || "",
      snippet: (r.markdown || r.description || "").substring(0, 800),
    }));

    return { results };
  } catch (e) {
    console.error("Search error:", e);
    return { results: [], error: e instanceof Error ? e.message : "Search failed" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── JWT Auth Guard ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { query, clientTimezone, chatHistory } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch ALL user data comprehensively
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

    // Time-based stats
    const thisWeekFlares = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneWeek);
    const lastWeekFlares = flares.filter((e: any) => {
      const age = now - new Date(e.timestamp).getTime();
      return age >= oneWeek && age < 2 * oneWeek;
    });
    const thisMonthFlares = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneMonth);
    const lastMonthFlares = flares.filter((e: any) => {
      const age = now - new Date(e.timestamp).getTime();
      return age >= oneMonth && age < 2 * oneMonth;
    });

    const calcSeverityScore = (list: any[]) => {
      if (!list.length) return 0;
      return list.reduce((acc, e) => acc + (e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : e.severity === "severe" ? 3 : 0), 0) / list.length;
    };

    const stats = {
      total: flares.length,
      thisWeek: thisWeekFlares.length,
      lastWeek: lastWeekFlares.length,
      thisMonth: thisMonthFlares.length,
      lastMonth: lastMonthFlares.length,
      avgSeverity: calcSeverityScore(flares),
      mildCount: flares.filter((e: any) => e.severity === "mild").length,
      moderateCount: flares.filter((e: any) => e.severity === "moderate").length,
      severeCount: flares.filter((e: any) => e.severity === "severe").length,
    };

    // Symptom analysis
    const symptomCounts: Record<string, number> = {};
    flares.forEach((e: any) => {
      (e.symptoms || []).forEach((s: string) => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    });
    const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

    // Trigger analysis
    const triggerCounts: Record<string, number> = {};
    flares.forEach((e: any) => {
      (e.triggers || []).forEach((t: string) => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });
    const topTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

    // Timezone-aware helpers
    const userTz = clientTimezone || profile?.timezone || 'UTC';
    const getLocalHour = (d: Date): number => {
      try {
        const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: userTz }).formatToParts(d);
        const hourPart = parts.find(p => p.type === "hour");
        return hourPart ? parseInt(hourPart.value, 10) : d.getUTCHours();
      } catch { return d.getUTCHours(); }
    };
    const getLocalDay = (d: Date): number => {
      try {
        const dayStr = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: userTz }).format(d);
        return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayStr);
      } catch { return d.getUTCDay(); }
    };

    // Time patterns
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, { count: number; severity: number[] }> = {};
    flares.forEach((e: any) => {
      const d = new Date(e.timestamp);
      const localHour = getLocalHour(d);
      const localDay = getLocalDay(d);
      hourCounts[localHour] = (hourCounts[localHour] || 0) + 1;
      if (!dayCounts[localDay]) dayCounts[localDay] = { count: 0, severity: [] };
      dayCounts[localDay].count++;
      dayCounts[localDay].severity.push(e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3);
    });

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Location data
    const locationCounts: Record<string, { count: number; severity: number[]; lat?: number; lng?: number; weather?: any }> = {};
    flares.forEach((e: any) => {
      const city = e.city || e.environmental_data?.location?.city;
      const lat = e.latitude || e.environmental_data?.location?.latitude;
      const lng = e.longitude || e.environmental_data?.location?.longitude;
      if (city) {
        if (!locationCounts[city]) locationCounts[city] = { count: 0, severity: [], lat, lng };
        locationCounts[city].count++;
        locationCounts[city].severity.push(e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3);
        if (e.environmental_data?.weather) locationCounts[city].weather = e.environmental_data.weather;
      }
    });

    const locationData = Object.entries(locationCounts).map(([city, data]) => {
      const avgSev = data.severity.reduce((a, b) => a + b, 0) / data.severity.length;
      return { city, lat: data.lat || 0, lng: data.lng || 0, count: data.count, severity: avgSev > 2.5 ? 'severe' : avgSev > 1.5 ? 'moderate' : 'mild' };
    });

    // Weather analysis
    const weatherCounts: Record<string, { count: number; severity: number[]; temps: number[] }> = {};
    flares.forEach((e: any) => {
      const weather = e.environmental_data?.weather;
      if (weather?.condition) {
        const cond = weather.condition.toLowerCase();
        if (!weatherCounts[cond]) weatherCounts[cond] = { count: 0, severity: [], temps: [] };
        weatherCounts[cond].count++;
        weatherCounts[cond].severity.push(e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3);
        if (weather.temperature) weatherCounts[cond].temps.push(weather.temperature);
      }
    });

    // Weekly trend
    const weeklyFlares: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now - i * oneWeek);
      const weekEnd = new Date(now - (i - 1) * oneWeek);
      const count = flares.filter((e: any) => {
        const t = new Date(e.timestamp).getTime();
        return t >= weekStart.getTime() && t < weekEnd.getTime();
      }).length;
      weeklyFlares.push({ week: `Week ${8 - i}`, count });
    }

    // Severity by hour
    const hourSeverity: Record<number, { total: number; count: number }> = {};
    flares.forEach((e: any) => {
      const h = getLocalHour(new Date(e.timestamp));
      if (!hourSeverity[h]) hourSeverity[h] = { total: 0, count: 0 };
      hourSeverity[h].total += e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3;
      hourSeverity[h].count++;
    });

    // Medication analysis
    const medStats: Record<string, { times: number; flaresAfter: number }> = {};
    medications.forEach((med: any) => {
      const medTime = new Date(med.taken_at).getTime();
      const flaresAfter = flares.filter((f: any) => {
        const t = new Date(f.timestamp).getTime();
        return t > medTime && t < medTime + oneDay;
      }).length;
      const name = med.medication_name;
      if (!medStats[name]) medStats[name] = { times: 0, flaresAfter: 0 };
      medStats[name].times++;
      medStats[name].flaresAfter += flaresAfter;
    });

    // Build data context
    const dataContext = {
      overview: {
        totalFlares: stats.total,
        severityBreakdown: { mild: stats.mildCount, moderate: stats.moderateCount, severe: stats.severeCount },
        avgSeverity: stats.avgSeverity.toFixed(1),
        thisWeek: stats.thisWeek, lastWeek: stats.lastWeek,
        thisMonth: stats.thisMonth, lastMonth: stats.lastMonth,
      },
      topSymptoms: topSymptoms.slice(0, 10).map(([name, count]) => ({ name, count })),
      topTriggers: topTriggers.slice(0, 10).map(([name, count]) => ({ name, count })),
      locations: Object.entries(locationCounts).map(([city, data]) => ({
        city, count: data.count,
        avgSeverity: (data.severity.reduce((a, b) => a + b, 0) / data.severity.length).toFixed(1),
      })).sort((a, b) => b.count - a.count).slice(0, 8),
      locationMapData: locationData.slice(0, 20),
      weather: Object.entries(weatherCounts).map(([condition, data]) => ({
        condition, count: data.count,
        avgSeverity: (data.severity.reduce((a, b) => a + b, 0) / data.severity.length).toFixed(1),
      })).sort((a, b) => b.count - a.count).slice(0, 8),
      byDayOfWeek: dayNames.map((name, i) => ({
        day: name, count: dayCounts[i]?.count || 0,
      })),
      byHour: Object.entries(hourCounts).map(([hour, count]) => ({
        hour: `${hour}:00`, count,
      })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour)),
      weeklyTrend: weeklyFlares,
      medications: Object.entries(medStats).map(([name, data]) => ({
        name, timesLogged: data.times, flaresWithin24h: data.flaresAfter,
      })),
      correlations: correlations.slice(0, 12).map((c: any) => ({
        trigger: c.trigger_value, outcome: c.outcome_value,
        confidence: Math.round((c.confidence || 0) * 100), occurrences: c.occurrence_count,
      })),
      discoveries: discoveries.map((d: any) => ({
        type: d.discovery_type,
        category: d.category,
        factorA: d.factor_a,
        factorB: d.factor_b,
        relationship: d.relationship,
        confidence: Math.round((d.confidence || 0) * 100),
        lift: d.lift?.toFixed(1),
        occurrences: d.occurrence_count,
        totalExposures: d.total_exposures,
        avgDelayHours: d.avg_delay_hours?.toFixed(1),
        status: d.status,
        evidence: d.evidence_summary,
        surfaced: !!d.surfaced_at,
      })),
      profile: {
        name: profile?.full_name || null,
        dateOfBirth: profile?.date_of_birth || null,
        biologicalSex: profile?.biological_sex || null,
        conditions: profile?.conditions || [],
        knownSymptoms: profile?.known_symptoms || [],
        knownTriggers: profile?.known_triggers || [],
        timezone: userTz,
      },
      engagement: {
        streak: engagement?.current_streak || 0,
        longestStreak: engagement?.longest_streak || 0,
        totalLogs: engagement?.total_logs || 0,
      },
    };

    const userName = profile?.full_name?.split(' ')[0] || 'there';
    const userConditions = profile?.conditions || [];
    const userAge = profile?.date_of_birth 
      ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400000))
      : null;
    const userSex = profile?.biological_sex || null;

    // Build condition-specific clinical knowledge
    const conditionKnowledge: Record<string, string> = {
      'Asthma': `ASTHMA CLINICAL KNOWLEDGE:
- Sleep disruption is bidirectional: poor sleep worsens airway inflammation; nocturnal asthma disrupts sleep. Studies show asthma symptoms peak between 4-6 AM due to circadian cortisol dips.
- Key triggers: cold/dry air, humidity >60%, rapid temp changes (>10°F in 24h), high pollen/AQI, GERD, emotional stress, exercise (especially cold air).
- Caffeine is a mild bronchodilator (theophylline analog) — 1-2 cups coffee may slightly help, but >4 cups can trigger anxiety/GERD which worsens symptoms.
- Dehydration thickens airway mucus. Aim for 2-3L water daily.
- Stress increases cortisol → airway hyperresponsiveness. HRV drops correlate with flare risk within 24-48h.
- Exercise-induced bronchoconstriction peaks 5-15 min post-exercise; warm-up reduces risk by 50%.
- Weather: thunderstorms can cause "thunderstorm asthma" (pollen grain rupture). Barometric pressure drops precede flares.`,
      
      'Migraine': `MIGRAINE CLINICAL KNOWLEDGE:
- Sleep is the #1 modifiable trigger. Both too little (<6h) and too much (>9h) increase risk. Irregular sleep schedules are worse than consistent short sleep.
- The "migraine threshold" model: triggers stack. One trigger alone may not cause an attack, but trigger1 + trigger2 + poor sleep = attack.
- Common triggers: dehydration, skipped meals (blood sugar drops), alcohol (especially red wine/histamine), aged cheeses (tyramine), MSG, bright/flickering lights, strong scents, weather changes, hormonal fluctuations.
- Caffeine: paradoxical — small amounts can abort early migraines, but regular >200mg/day creates dependency and withdrawal triggers attacks.
- Prodrome signs 24-48h before: yawning, food cravings, neck stiffness, mood changes. Tracking these enables early intervention.
- HRV drops and resting HR increases often precede migraines by 12-24h.
- Magnesium deficiency is present in 50% of migraine patients. 400mg/day magnesium glycinate is evidence-based prevention.`,
      
      'Eczema': `ECZEMA/ATOPIC DERMATITIS CLINICAL KNOWLEDGE:
- Sleep loss directly impairs skin barrier function and increases inflammatory cytokines (IL-4, IL-13). The itch-scratch-wake cycle is the main quality-of-life issue.
- Flares correlate with: low humidity (<30%), temperature extremes, sweat, stress, certain fabrics (wool), fragrances, SLS in soaps, dust mites.
- Stress → cortisol dysregulation → mast cell degranulation → histamine release → itch. This is measurable via HRV.
- Hot showers (>100°F) strip skin lipids and worsen barrier. Lukewarm <5min showers recommended.
- Gut-skin axis: emerging evidence links gut microbiome disruption to flares. Probiotics (L. rhamnosus) show moderate benefit.
- Nocturnal scratching is often unconscious. Core body temp drops at night → itch worsens.
- Weather: transitions between seasons (especially fall→winter) are highest-risk periods.`,
      
      'Acne': `ACNE CLINICAL KNOWLEDGE:
- Sleep deprivation increases cortisol → stimulates sebaceous glands → excess sebum → breakouts within 48-72h.
- Hormonal patterns: ${userSex === 'Female' ? 'Flares typically worsen 7-10 days before menstruation due to progesterone spike and androgen sensitivity. Track cycle correlation.' : 'Testosterone fluctuations affect sebum production. Stress-cortisol-androgen axis is key driver.'}
- Dairy (especially skim milk) contains IGF-1 which stimulates sebocytes. High-glycemic foods spike insulin → androgen production.
- Stress → cortisol → increased sebum + inflammatory neuropeptides in skin.
- Gut-skin axis: emerging evidence. Probiotics may help via reducing systemic inflammation.
- Exercise helps (reduces cortisol, improves circulation) but sweat left on skin can worsen follicular occlusion. Shower within 30 min.
- Humidity >70% can worsen; very low humidity impairs barrier → compensatory oil production.`,

      'Anxiety': `ANXIETY CLINICAL KNOWLEDGE:
- Sleep and anxiety are bidirectional: anxiety disrupts sleep onset; sleep deprivation amplifies amygdala reactivity by 60% (Walker et al.).
- Caffeine >200mg/day significantly worsens anxiety symptoms. Half-life is 5-6h, so afternoon coffee affects sleep and next-day anxiety.
- HRV is a biomarker: lower HRV correlates with higher anxiety. HRV biofeedback training (6 breaths/min) is evidence-based treatment.
- Exercise is as effective as SSRIs for mild-moderate anxiety (meta-analysis). 30min moderate activity, 3-5x/week.
- Blood sugar crashes trigger sympathetic nervous system → mimics/triggers anxiety. Regular meals, protein+fiber.
- Alcohol: initial anxiolytic effect but rebound anxiety 4-8h later ("hangxiety"). GABA rebound.
- Weather/seasons: reduced sunlight → lower serotonin. SAD-anxiety comorbidity is common.`,
      
      'IBS': `IBS CLINICAL KNOWLEDGE:
- The gut-brain axis makes IBS uniquely stress-sensitive. Stress directly alters gut motility, secretion, and visceral sensitivity.
- Sleep disruption worsens symptoms next day via vagal tone reduction. HRV is a proxy for vagal function.
- FODMAPs are the most evidence-based dietary trigger. Common culprits: onions, garlic, wheat, dairy, apples, beans.
- Caffeine stimulates colonic motility — can trigger urgency/cramping in IBS-D. May help IBS-C in moderation.
- Exercise (especially walking, yoga) improves GI transit and reduces bloating. High-intensity can worsen symptoms.
- Meal timing matters: large meals trigger gastrocolic reflex. Smaller, frequent meals recommended.
- Menstrual cycle affects motility: progesterone slows transit (bloating/constipation in luteal phase), prostaglandins increase it (diarrhea during menses).`,

      'Lower Back Pain': `LOWER BACK PAIN CLINICAL KNOWLEDGE:
- Chronic low back pain is strongly linked to sleep quality — poor sleep increases pain sensitivity (central sensitization) by up to 50%.
- Sedentary behavior >6h/day increases risk. Prolonged sitting compresses lumbar discs. Stand/walk every 30-45 min.
- Stress → muscle tension (especially erector spinae and psoas). HRV drops correlate with pain flares.
- Exercise is the #1 evidence-based treatment. Core stabilization, walking, swimming, yoga all show benefit.
- Cold weather and barometric pressure drops increase muscle stiffness and pain perception.
- Dehydration reduces disc hydration (discs are ~80% water). Adequate water intake supports spinal health.
- Sleep position matters: side sleeping with pillow between knees or supine with pillow under knees reduces lumbar strain.
- Weight: every 10 lbs overweight adds ~40 lbs of force on the lumbar spine.`,

      'Fibromyalgia': `FIBROMYALGIA CLINICAL KNOWLEDGE:
- Central sensitization is the core mechanism — the pain processing system is amplified. Sleep is THE critical modifier.
- Non-restorative sleep (alpha-wave intrusion into deep sleep) is present in ~90% of patients. Improving sleep quality reduces pain by 20-30%.
- Weather sensitivity is well-documented: cold, humidity, and barometric pressure changes worsen symptoms.
- Exercise paradox: activity worsens symptoms acutely but is the most evidence-based long-term treatment. Start very low, increase very slowly.
- Stress → HPA axis dysregulation → cortisol abnormalities → widespread pain amplification.
- Cognitive symptoms ("fibro fog") worsen with poor sleep and stress. Track cognitive function alongside pain.
- Comorbid conditions: 30-70% have IBS, TMJ, migraine, or anxiety. Track interactions between these.`,

      'Endometriosis': `ENDOMETRIOSIS CLINICAL KNOWLEDGE:
- Cyclical pain pattern is hallmark but many experience non-cyclical chronic pain due to central sensitization.
- Inflammatory diet (red meat, trans fats, alcohol) worsens symptoms. Anti-inflammatory diet (omega-3, turmeric, leafy greens) shows benefit.
- Sleep disruption increases systemic inflammation → worsens endo pain. Prioritize sleep hygiene.
- Stress → cortisol → inflammatory cascade → pain amplification. HRV tracking can predict flare windows.
- Exercise reduces estrogen levels and inflammation but high-intensity can increase pain acutely. Moderate exercise recommended.
- GI symptoms overlap with IBS in 50-80% of patients. Track bowel symptoms separately from pelvic pain.
- Menstrual cycle tracking is critical: map pain to cycle days to identify personal high-risk windows.`,

      'GERD': `GERD CLINICAL KNOWLEDGE:
- Nighttime reflux is the most damaging. Elevate head of bed 6-8 inches. Don't eat within 3 hours of bedtime.
- Trigger foods: coffee, chocolate, alcohol, spicy foods, citrus, tomatoes, fatty foods, mint. Individual triggers vary — tracking is key.
- Stress directly increases gastric acid secretion and esophageal sensitivity. HRV drops precede symptom worsening.
- Obesity increases intra-abdominal pressure. Even modest weight loss (5-10%) significantly improves symptoms.
- Tight clothing around waist increases reflux risk.
- Caffeine relaxes the lower esophageal sphincter. Reducing coffee may help more than any medication.
- Sleep position: left-side sleeping reduces reflux episodes by ~75% compared to right-side (anatomical reason: stomach curvature).`,
    };

    // Build condition-specific context for user's actual conditions
    const userConditionKnowledge = userConditions
      .map(c => {
        const exact = conditionKnowledge[c];
        if (exact) return exact;
        const partial = Object.entries(conditionKnowledge).find(([k]) => c.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(c.toLowerCase()));
        return partial ? partial[1] : `For ${c}: Track patterns carefully. Sleep quality, stress, diet, and environmental factors commonly influence chronic conditions. Research your specific condition's known triggers and share findings with your doctor.`;
      })
      .join('\n\n');

    const systemPrompt = `You are Jvala's AI — ${userName}'s personal health companion built into the Jvala flare-tracking app.

══ IDENTITY ══
- You know EVERYTHING about ${userName}. Their name, conditions, symptoms, triggers, meds, bio sex${userSex ? ` (${userSex})` : ''}, DOB${userAge ? ` (age ${userAge})` : ''} — it's all below.
- NEVER say "I don't have access to your personal information." You have ALL their data.
- If they ask "what's my name?" → answer "${userName}".

══ PERSONALITY ══
- Talk like a smart friend texting — warm, casual, brief.
- Do NOT start every message with "${userName}". Use their name only occasionally, naturally — maybe 1 in 4 messages.
- Keep responses 1-3 sentences for simple things. Go longer ONLY for complex analysis questions.
- Be direct. No filler, no corporate speak.
- Celebrate wins. Comfort during hard times. Be real.

══ CRITICAL: STOP REFUSING QUESTIONS ══
You are NOT a generic chatbot. You are a HEALTH COMPANION with DEEP KNOWLEDGE. When a user asks about:
- What a medication/product is used for → ANSWER using the research_and_respond tool if you don't know. Look it up. Never say "I can't tell you."
- Health tips → Give SPECIFIC tips relevant to THEIR CONDITIONS, not generic "drink water" garbage.
- How X affects their condition → Use the clinical knowledge below to give SPECIFIC physiological explanations.
- General health questions → Answer helpfully. You are here to HELP, not deflect.

The ONLY things you should NOT do:
- Diagnose new conditions
- Prescribe specific medication dosages
- Replace a doctor visit for acute/emergency symptoms

For everything else: BE HELPFUL. Add a brief "check with your doc for personalized advice" at the end if appropriate, but LEAD with useful, specific, evidence-based information.

══ WHEN TO USE WEB RESEARCH ══
Use the research_and_respond tool when:
- User asks about a specific product, medication, or supplement you don't have clinical knowledge about
- User asks about breaking news, recent studies, or current medical guidelines
- User asks "what is X used for" or "what does X do" for a specific named product
- You need factual information that isn't in your training data
- User asks about interactions between specific medications/supplements

DO NOT research when: the question is about their personal data (use the data below), or when your clinical knowledge above already covers the topic.

══ CLINICAL KNOWLEDGE — USE THIS ══
You have evidence-based knowledge about ${userName}'s conditions. When they ask health questions, tips, or how things affect their condition — USE this knowledge to give specific, actionable, condition-relevant answers.

    ${userConditionKnowledge}

══ DISCOVERIES — YOUR MOST POWERFUL FEATURE ══
The Discovery Engine continuously runs Bayesian association rule mining across ALL user data. Below are active discoveries it has found. USE THEM.

RULES:
1. When a user logs something that matches a known discovery (e.g., they eat pizza and you know pizza→breakout), PROACTIVELY mention it: "heads up — pizza has been linked to your breakouts ${'{'}X out of Y times{'}'}"
2. If a discovery has status "confirmed" or "strong", treat it as established fact in your responses.
3. If status is "emerging" or "investigating", mention it cautiously: "I'm noticing a possible pattern..."
4. NEVER ignore a high-confidence discovery when it's relevant to the conversation.
5. When you spot a NEW pattern the engine hasn't found yet (from conversational context), mention it — the engine will catch up on next analysis.

DISCOVERY DATA:
${JSON.stringify(dataContext.discoveries?.filter((d: any) => d.confidence >= 25) || [], null, 2)}

══ CONTEXT AWARENESS — CRITICAL ══
- You can see recent chat messages below. This includes ALL logs the user has made (flares, trackables, medications, energy).
- If you see someone log the same thing 3+ times in quick succession (within minutes), COMMENT on it naturally like a human friend would.
- Be aware of TIME. If it's morning and they haven't logged anything, you might ask about sleep. If it's late, acknowledge the time.
- If they ask "how does X affect my Y" — ANSWER using the clinical knowledge above, citing specific mechanisms. Don't say "I don't have enough info" when you literally have clinical research above.
- When the user logs a flare RIGHT AFTER logging food/activity, CONNECT THE DOTS using discoveries data. This is what makes you useful.

══ VISUALIZATION RULES — CRITICAL ══
- ONLY create a chart when the user EXPLICITLY asks: "show me a chart", "graph my...", "visualize", "plot", "show me data"
- For ALL other questions — even data questions — just answer conversationally in text. NO chart.

══ CHART TYPES (only when explicitly requested) ══
bar_chart, horizontal_bar, pie_chart, donut_chart, line_chart, area_chart, scatter_plot, histogram, comparison, heatmap, pattern_summary, gauge, location_map, weather_chart

Chart data format: [{ label: string, value: number, extra?: string, latitude?: number, longitude?: number, color?: string }]

══ APP NAVIGATION ══
- Connect Fitbit: Profile → Wearable Integration → Connect Fitbit
- Add medication: Profile → Medications → Add
- Export data: Insights → Export Reports
- Set reminders: Profile → Reminder Settings

══ USER DATA ══
${JSON.stringify(dataContext, null, 2)}

══ IMPORTANT ══
- Answer questions using the data above. Be specific with numbers.
- For "how do I" questions: give exact navigation path.
- Never diagnose. Never prescribe dosages. You share evidence-based observations, not medical advice. Brief disclaimer is fine but don't let it dominate.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "respond_with_visualization",
          description: "Respond with insight AND a chart. ONLY use this when the user explicitly asks for a graph/chart/visualization.",
          parameters: {
            type: "object",
            required: ["response", "chart"],
            properties: {
              response: { type: "string", description: "Brief conversational insight" },
              chart: {
                type: "object",
                required: ["type", "title", "data"],
                properties: {
                  type: { 
                    type: "string", 
                    enum: ["bar_chart", "horizontal_bar", "stacked_bar", "pie_chart", "donut_chart", "line_chart", "area_chart", "scatter_plot", "histogram", "comparison", "heatmap", "pattern_summary", "gauge", "location_map", "weather_chart"]
                  },
                  title: { type: "string" },
                  data: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" }, x: { type: "number" }, y: { type: "number" }, latitude: { type: "number" }, longitude: { type: "number" }, extra: { type: "string" }, color: { type: "string" } } } },
                  config: { type: "object", properties: { xAxis: { type: "string" }, yAxis: { type: "string" } } }
                },
              },
              dynamicFollowUps: { type: "array", items: { type: "string" }, description: "2-3 follow-up questions" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "respond_text_only",
          description: "Respond with text only. Use this for most responses — questions, observations, greetings, insights, anything that doesn't need a chart or web research.",
          parameters: {
            type: "object",
            required: ["response"],
            properties: {
              response: { type: "string", description: "Your conversational response" },
              dynamicFollowUps: { type: "array", items: { type: "string" }, description: "2-3 follow-up questions" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "research_and_respond",
          description: "Search the web for factual information before responding. Use this when the user asks about specific products, medications, supplements, recent studies, or anything you need to look up. The search will be performed and results fed back to you.",
          parameters: {
            type: "object",
            required: ["searchQuery", "userQuestion"],
            properties: {
              searchQuery: { type: "string", description: "The search query to look up on the web. Be specific and factual." },
              userQuestion: { type: "string", description: "The original user question to answer after getting search results." },
            },
          },
        },
      },
    ];

    // Build messages array with chat history for context
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory.slice(-20)) {
        aiMessages.push({
          role: msg.role === 'system' ? 'user' : msg.role,
          content: msg.content || '',
        });
      }
    }

    aiMessages.push({ role: "user", content: query });

    // First AI call
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        tools,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        
        // ── RESEARCH FLOW ──────────────────────────────────────────────────
        if (toolCall.function.name === "research_and_respond") {
          console.log("🔍 AI requested research:", parsed.searchQuery);
          
          // Do the web search
          const searchResults = await searchWeb(parsed.searchQuery);
          
          if (searchResults.results.length === 0) {
            // No results — have AI answer without research
            return new Response(JSON.stringify({
              response: "I tried to look that up but couldn't find specific results. Let me answer based on what I know.",
              visualization: null,
              citations: [],
              wasResearched: true,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Format research results for the AI
          const researchContext = searchResults.results.map((r, i) => 
            `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`
          ).join('\n\n---\n\n');

          // Second AI call with research results
          const researchMessages = [
            ...aiMessages,
            { role: "assistant", content: `I'll research "${parsed.searchQuery}" to answer this properly.` },
            { role: "user", content: `Here are the research results. Use them to answer the original question: "${parsed.userQuestion}"\n\nIMPORTANT: Cite sources using [1], [2] etc. in your response. Be specific and factual based on what you found. Keep it conversational.\n\nRESEARCH RESULTS:\n${researchContext}` },
          ];

          const researchResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: researchMessages,
              temperature: 0.5,
            }),
          });

          if (!researchResponse.ok) {
            throw new Error(`Research AI call failed: ${researchResponse.status}`);
          }

          const researchData = await researchResponse.json();
          const researchContent = researchData.choices?.[0]?.message?.content || "Couldn't process the research results.";

          // Build citations array
          const citations = searchResults.results.map((r, i) => ({
            index: i + 1,
            title: r.title,
            url: r.url,
          }));

          return new Response(JSON.stringify({
            response: researchContent,
            visualization: null,
            citations,
            wasResearched: true,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        if (toolCall.function.name === "respond_with_visualization") {
          return new Response(JSON.stringify({
            response: parsed.response,
            visualization: parsed.chart,
            dynamicFollowUps: parsed.dynamicFollowUps,
            citations: [],
            wasResearched: false,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        // respond_text_only
        return new Response(JSON.stringify({
          response: parsed.response,
          visualization: null,
          dynamicFollowUps: parsed.dynamicFollowUps,
          citations: [],
          wasResearched: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }
    }

    // Fallback to direct content (no tool call)
    const content = data.choices?.[0]?.message?.content;
    return new Response(JSON.stringify({ 
      response: content || "I'm here to help with your health data.", 
      visualization: null,
      citations: [],
      wasResearched: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
