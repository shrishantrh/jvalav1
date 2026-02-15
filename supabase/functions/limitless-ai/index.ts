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

    // Medication analysis — basic stats
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

    // ═══ PRE-COMPUTED: Daily flares for last 30 days ═══
    const sevToNum = (s: string) => s === 'mild' ? 1 : s === 'moderate' ? 2 : s === 'severe' ? 3 : 0;
    const dailyFlares30d: { date: string; flares: number; mild: number; moderate: number; severe: number; avgSeverity: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now - i * oneDay);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + oneDay);
      const dayFlares = flares.filter((f: any) => {
        const t = new Date(f.timestamp).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });
      const mild = dayFlares.filter((f: any) => f.severity === 'mild').length;
      const moderate = dayFlares.filter((f: any) => f.severity === 'moderate').length;
      const severe = dayFlares.filter((f: any) => f.severity === 'severe').length;
      const avgSev = dayFlares.length > 0 ? dayFlares.reduce((a: number, f: any) => a + sevToNum(f.severity || 'mild'), 0) / dayFlares.length : 0;
      const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(dayStart);
      dailyFlares30d.push({ date: label, flares: dayFlares.length, mild, moderate, severe, avgSeverity: Math.round(avgSev * 10) / 10 });
    }

    // ═══ PRE-COMPUTED: Weekly breakdown (last 8 weeks with severity) ═══
    const weeklyBreakdown: { week: string; total: number; mild: number; moderate: number; severe: number; avgSeverity: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date(now - (i + 1) * oneWeek);
      const wEnd = new Date(now - i * oneWeek);
      const wFlares = flares.filter((f: any) => {
        const t = new Date(f.timestamp).getTime();
        return t >= wStart.getTime() && t < wEnd.getTime();
      });
      const wMild = wFlares.filter((f: any) => f.severity === 'mild').length;
      const wMod = wFlares.filter((f: any) => f.severity === 'moderate').length;
      const wSev = wFlares.filter((f: any) => f.severity === 'severe').length;
      const wAvg = wFlares.length > 0 ? wFlares.reduce((a: number, f: any) => a + sevToNum(f.severity || 'mild'), 0) / wFlares.length : 0;
      const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(wStart);
      const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: userTz }).format(wEnd);
      weeklyBreakdown.push({ week: `${startLabel}–${endLabel}`, total: wFlares.length, mild: wMild, moderate: wMod, severe: wSev, avgSeverity: Math.round(wAvg * 10) / 10 });
    }

    // ═══ PRE-COMPUTED: Medication effectiveness ═══
    const medEffectiveness: { name: string; timesTaken: number; avgSeverityBefore: number; avgSeverityAfter: number; severityReduction: string; avgFlareFreeDaysAfter: number }[] = [];
    const uniqueMeds = [...new Set(medications.map((m: any) => m.medication_name))];
    for (const medName of uniqueMeds) {
      const doses = medications.filter((m: any) => m.medication_name === medName);
      const timesTaken = doses.length;
      let totalSevBefore = 0, countBefore = 0, totalSevAfter = 0, countAfter = 0;
      let totalFlareFreeDays = 0;

      for (const dose of doses) {
        const doseTime = new Date(dose.taken_at).getTime();
        // Flares in 24h BEFORE dose
        const before = flares.filter((f: any) => {
          const t = new Date(f.timestamp).getTime();
          return t >= doseTime - oneDay && t < doseTime;
        });
        before.forEach((f: any) => { totalSevBefore += sevToNum(f.severity || 'mild'); countBefore++; });
        // Flares in 24h AFTER dose
        const after = flares.filter((f: any) => {
          const t = new Date(f.timestamp).getTime();
          return t > doseTime && t <= doseTime + oneDay;
        });
        after.forEach((f: any) => { totalSevAfter += sevToNum(f.severity || 'mild'); countAfter++; });
        // Flare-free window after dose
        const nextFlareAfterDose = flares.find((f: any) => new Date(f.timestamp).getTime() > doseTime);
        if (nextFlareAfterDose) {
          const gap = (new Date(nextFlareAfterDose.timestamp).getTime() - doseTime) / oneDay;
          totalFlareFreeDays += Math.min(gap, 14); // cap at 14 days
        } else {
          totalFlareFreeDays += 7; // no flare found, assume 7 days
        }
      }

      const avgBefore = countBefore > 0 ? Math.round((totalSevBefore / countBefore) * 10) / 10 : 0;
      const avgAfter = countAfter > 0 ? Math.round((totalSevAfter / countAfter) * 10) / 10 : 0;
      const reduction = avgBefore > 0 ? Math.round(((avgBefore - avgAfter) / avgBefore) * 100) : 0;
      const avgFlareFree = Math.round((totalFlareFreeDays / timesTaken) * 10) / 10;

      medEffectiveness.push({
        name: medName,
        timesTaken,
        avgSeverityBefore: avgBefore,
        avgSeverityAfter: avgAfter,
        severityReduction: `${reduction}%`,
        avgFlareFreeDaysAfter: avgFlareFree,
      });
    }

    // ═══ PRE-COMPUTED: Trigger-to-symptom analysis ═══
    const triggerSymptomMap: Record<string, Record<string, number>> = {};
    flares.forEach((f: any) => {
      (f.triggers || []).forEach((t: string) => {
        if (!triggerSymptomMap[t]) triggerSymptomMap[t] = {};
        (f.symptoms || []).forEach((s: string) => {
          triggerSymptomMap[t][s] = (triggerSymptomMap[t][s] || 0) + 1;
        });
      });
    });
    const triggerOutcomes = Object.entries(triggerSymptomMap).map(([trigger, symptoms]) => ({
      trigger,
      topSymptoms: Object.entries(symptoms).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, c]) => ({ symptom: s, count: c })),
    })).sort((a, b) => b.topSymptoms.reduce((s, x) => s + x.count, 0) - a.topSymptoms.reduce((s, x) => s + x.count, 0)).slice(0, 10);

    // Build data context
    const dataContext = {
      overview: {
        totalFlares: stats.total,
        severityBreakdown: { mild: stats.mildCount, moderate: stats.moderateCount, severe: stats.severeCount },
        avgSeverity: stats.avgSeverity.toFixed(1),
        thisWeek: stats.thisWeek, lastWeek: stats.lastWeek,
        thisMonth: stats.thisMonth, lastMonth: stats.lastMonth,
      },
      dailyFlares30d,
      weeklyBreakdown,
      medicationEffectiveness: medEffectiveness,
      triggerOutcomes,
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

    // Build condition-specific clinical knowledge — expanded with proactive triggers
    const conditionKnowledge: Record<string, string> = {
      'Asthma': `ASTHMA: Sleep disruption bidirectional. Symptoms peak 4-6 AM (cortisol dip). Triggers: cold/dry air, humidity >60%, AQI, GERD, stress, exercise. Caffeine mild bronchodilator. Thunderstorm asthma risk. Barometric drops precede flares. PROACTIVE: After meals (GERD→bronchospasm), before exercise, weather changes, evening (nocturnal), spring/fall pollen.`,
      'Migraine': `MIGRAINE: Sleep #1 trigger (<6h and >9h risky). Threshold model: triggers stack. Triggers: dehydration, skipped meals, alcohol, aged cheese, MSG, lights, weather. Caffeine paradoxical. Prodrome 24-48h: yawning, cravings, neck stiffness. HRV drops 12-24h before. Magnesium 400mg/day preventive. PROACTIVE: After skipped meals, dehydration mid-afternoon, after alcohol, pressure changes, cycle days 1-3/24-28, after poor sleep.`,
      'Eczema': `ECZEMA: Sleep loss impairs barrier (IL-4/IL-13). Triggers: humidity <30%, temp extremes, sweat, stress, wool, SLS, dust mites. Hot showers strip lipids. Gut-skin axis: L. rhamnosus helps. Nocturnal scratching: core temp drops → itch. Fall→winter worst. PROACTIVE: After shower (moisturize), season changes, dry weather, stress, dairy/gluten, evening itch, post-exercise sweat.`,
      'Acne': `ACNE: Sleep loss → cortisol → sebum → breakouts 48-72h. ${userSex === 'Female' ? 'Flares 7-10d before period (progesterone).' : 'Stress-cortisol-androgen axis.'} Dairy (skim milk IGF-1), high-glycemic foods. Exercise helps but shower within 30 min. PROACTIVE: After dairy/sugar, post-exercise, bedtime skincare, cycle tracking, stress, after touching face.`,
      'Anxiety': `ANXIETY: Bidirectional with sleep (amygdala +60%). Caffeine >200mg worsens. HRV biomarker. Exercise = SSRIs for mild-moderate. Blood sugar crashes mimic anxiety. Alcohol rebound 4-8h ("hangxiety"). PROACTIVE: Morning (sleep→anxiety), after caffeine, after meals (sugar), before social events, evening wind-down, after alcohol, weather/light changes.`,
      'IBS': `IBS: Gut-brain axis: stress alters motility. FODMAPs: onions, garlic, wheat, dairy, apples. Large meals = gastrocolic reflex. Caffeine → urgency. Cycle: progesterone slows (luteal bloating), prostaglandins increase (menses diarrhea). PROACTIVE: After every meal (30-90 min window), morning bowels, FODMAP foods, stress, caffeine, cycle days.`,
      'Lower Back Pain': `LOWER BACK: Poor sleep → +50% pain sensitivity. Sedentary >6h dangerous. Cold/pressure drops increase stiffness. Disc dehydration. 10 lbs overweight = 40 lbs lumbar force. PROACTIVE: After 2h+ sitting, morning stiffness, after exercise, weather changes, after lifting, evening assessment.`,
      'Fibromyalgia': `FIBROMYALGIA: Central sensitization. Sleep is critical (alpha-wave intrusion in 90%). Weather sensitivity. Exercise paradox: acute worsening but best long-term. Fibro fog. 30-70% comorbid IBS/TMJ/migraine/anxiety. PROACTIVE: Morning pain/fatigue, after sleep, weather changes, after activity (pacing), evening energy, stress.`,
      'Endometriosis': `ENDO: Cyclical and non-cyclical pain. Anti-inflammatory diet helps. GI overlap 50-80%. Cycle mapping critical. PROACTIVE: Cycle days 1-5/24-28, after meals (GI), post-exercise, evening pain, before/after intimacy, stress.`,
      'GERD': `GERD: Nighttime worst. No eating 3h before bed. Triggers: coffee, chocolate, alcohol, spicy, citrus, fatty, mint. Left-side sleeping -75% reflux. PROACTIVE: After every meal (20-60 min), before bed, after coffee/alcohol, after spicy/fatty food, morning reflux, lying down after eating.`,
      'Diabetes': `DIABETES: Postprandial spikes 60-90 min. Dawn phenomenon 4-8 AM. Exercise lowers glucose but intense can spike (stress hormones). One night poor sleep = -25-30% insulin sensitivity. PROACTIVE: Before/after every meal, morning fasting, post-exercise, before bed, after stress, after alcohol, mid-afternoon dip.`,
      'Hypertension': `HYPERTENSION: Sodium <2300mg/day. DASH diet -8-14 mmHg. 150 min/week exercise -5-8 mmHg. Sleep apnea in 50% resistant HTN. Caffeine acute +5-10 mmHg 2-3h. PROACTIVE: Morning BP, after meals (sodium), post-exercise, stress, medication timing, evening reading, after caffeine.`,
      'Depression': `DEPRESSION: Consistent wake time > sleep duration. Behavioral activation: small activities counter inertia. Exercise releases BDNF. Social isolation worsens. Alcohol crash 24-48h. Mediterranean diet -30% risk. PROACTIVE: Morning mood, mid-afternoon energy, evening reflection, after social events, activity prompts, meal regularity, sleep consistency.`,
      'ADHD': `ADHD: Executive function = dopamine. Delayed sleep phase common. Hyperfocus → skipped meals/dehydration. Exercise +dopamine 2-3h. Time blindness. PROACTIVE: Medication timing, meal reminders, hydration during hyperfocus, evening wind-down, sleep routine, activity breaks, emotional check-ins.`,
      'Psoriasis': `PSORIASIS: T-cell mediated. Stress #1 trigger. Alcohol worsens. Cold/dry flares. UV therapeutic. Obesity → TNF-α. Koebner phenomenon. PROACTIVE: After stress, cold/dry weather, after alcohol, illness onset, skin injury, morning assessment, after shower (moisturize).`,
      'Rheumatoid Arthritis': `RA: Morning stiffness >30 min = active disease. Worst morning (IL-6 surge). Cold/pressure drops. Omega-3 3g/day. Fatigue in 80%. PROACTIVE: Morning stiffness duration, after meals (inflammatory foods), weather changes, evening fatigue, medication timing, after exercise, infection monitoring.`,
      'Crohn\'s Disease': `CROHN'S: Stress most consistent trigger. Diet highly individual. Smoking strongest risk. Extra-intestinal: fatigue, joints, skin. Adherence critical in remission. PROACTIVE: After every meal (30-120 min), morning bowels, stress, medication adherence, hydration, sleep, fatigue.`,
      'Ulcerative Colitis': `UC: NSAIDs trigger flares. Probiotics (VSL#3) maintain remission. Psychoneuroimmunology: vagus→gut inflammation. PROACTIVE: After meals, medication adherence, stress, morning symptoms, NSAID alert, evening assessment, sleep quality.`,
      'Lupus': `LUPUS: UV triggers flares (60-80% photosensitive). SPF 50+ always. Fatigue most debilitating. Triggers: UV, infection, stress, certain meds. Raynaud's: cold→vasospasm. PROACTIVE: Before sun exposure (sunscreen), morning fatigue, stress, illness onset, medication timing, evening joint/skin, cold weather.`,
      'PCOS': `PCOS: Insulin resistance 70-80%. Low-glycemic diet critical. 5% weight loss restores ovulation. 150 min/week exercise improves insulin. Anti-inflammatory diet reduces androgens. PROACTIVE: Meal tracking (glycemic), exercise logging, cycle tracking, stress, skin/hair monitoring, weight, energy.`,
      'Chronic Fatigue Syndrome': `CFS/ME: Post-exertional malaise (PEM) 12-72h after exceeding threshold. Activity pacing critical. HR below anaerobic threshold. Non-restorative sleep. Brain fog worsens with overexertion. PROACTIVE: Morning energy, activity pacing every 2h, post-activity check (24-72h PEM), evening energy, HR alerts, cognitive function.`,
      'Allergies': `ALLERGIES: Pollen highest 5-10 AM. Priming effect: threshold lowers through season. Cross-reactivity: birch→apples/carrots. Saline irrigation -30-40%. PROACTIVE: Morning symptoms, after outdoor time, pollen/weather alerts, indoor air quality, before/after meds, seasonal transitions.`,
      'Hypothyroidism': `HYPOTHYROIDISM: Levothyroxine empty stomach, 30-60 min before food. Calcium/iron/coffee reduce absorption (space 4h). Cold intolerance. Track energy, weight trends, hair/skin/bowels. PROACTIVE: Medication timing (morning, empty stomach), energy tracking, cold sensitivity, bowel regularity, mood/brain fog, weight.`,
    };

    // ── PROACTIVE INTELLIGENCE ENGINE ──
    const now_date = new Date();
    const localHourNow = (() => {
      try {
        const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: userTz }).formatToParts(now_date);
        return parseInt(parts.find(p => p.type === "hour")?.value || "12", 10);
      } catch { return 12; }
    })();

    const timeOfDay = localHourNow < 6 ? 'late_night' : localHourNow < 10 ? 'morning' : localHourNow < 14 ? 'midday' : localHourNow < 18 ? 'afternoon' : localHourNow < 22 ? 'evening' : 'night';

    const currentMealContext = (() => {
      if (localHourNow >= 7 && localHourNow < 10) return 'Breakfast window. Post-meal symptoms in 30-90 min.';
      if (localHourNow >= 10 && localHourNow < 12) return 'Post-breakfast. If eating is trigger, symptoms now. Approaching lunch.';
      if (localHourNow >= 12 && localHourNow < 14) return 'Lunch time. Track food if eating triggers symptoms.';
      if (localHourNow >= 14 && localHourNow < 16) return 'Post-lunch. Energy dip window.';
      if (localHourNow >= 16 && localHourNow < 18) return 'Afternoon. Caffeine intake may affect sleep.';
      if (localHourNow >= 18 && localHourNow < 20) return 'Dinner time. Last meal window.';
      if (localHourNow >= 20 && localHourNow < 23) return 'Post-dinner/evening. GERD: stop eating 3h before bed.';
      return 'Late night. Check on sleep issues.';
    })();

    const userMeds = profile?.metadata && typeof profile.metadata === 'object' && 'medications' in profile.metadata
      ? (profile.metadata as any).medications || []
      : [];
    const medTimingContext = userMeds.length > 0
      ? `Scheduled meds: ${userMeds.map((m: any) => `${m.name} (${m.frequency || 'as-needed'})`).join(', ')}. Near their scheduled time? Gently ask.`
      : '';

    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    const recentEntries = entries.filter((e: any) => new Date(e.timestamp).getTime() > twoHoursAgo);
    const recentContext = recentEntries.length > 0
      ? `Recent (2h): ${recentEntries.map((e: any) => `${e.entry_type}${e.severity ? ` (${e.severity})` : ''}${e.note ? `: "${e.note.substring(0, 40)}"` : ''}`).join('; ')}`
      : '';

    const conditionProactiveTriggers = userConditions.map((c: string) => {
      const knowledge = conditionKnowledge[c];
      if (!knowledge) return '';
      const match = knowledge.match(/PROACTIVE: (.+)/);
      return match ? `${c}: ${match[1]}` : '';
    }).filter(Boolean).join('\n');

    // Build condition knowledge for prompt
    const userConditionKnowledge = userConditions
      .map(c => {
        const exact = conditionKnowledge[c];
        if (exact) return exact;
        const partial = Object.entries(conditionKnowledge).find(([k]) => c.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(c.toLowerCase()));
        return partial ? partial[1] : `For ${c}: Track patterns carefully. Sleep, stress, diet, and environmental factors commonly influence chronic conditions.`;
      })
      .join('\n\n');

    const systemPrompt = `You are Jvala's AI — ${userName}'s personal health companion.

══ PROACTIVE INTELLIGENCE ══
Current time: ${timeOfDay} (${localHourNow}:00 ${userTz})
Meal context: ${currentMealContext}
${medTimingContext}
${recentContext}

CONDITION-SPECIFIC PROACTIVE TRIGGERS (use these to anticipate needs):
${conditionProactiveTriggers || 'No specific conditions set.'}

RULES FOR PROACTIVE BEHAVIOR:
- If the user just logged food and eating is a known trigger for their condition, mention the post-meal symptom window naturally.
- If it's near medication time, gently check if they've taken it (only once per session).
- If they log a trigger that matches a discovery, immediately connect the dots.
- If it's morning, briefly ask about sleep quality. If evening, ask about the day.
- If they haven't logged in a while, encourage logging without being pushy.
- Estimate meal times and check in about post-meal symptoms when relevant to their condition.
- Be SMART and SPECIFIC to THEIR conditions — not generic health advice.

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
The Discovery Engine has found the following patterns. You have this data available.

CRITICAL RULES:
1. When mentioning a discovery, weave the KEY STAT into ONE short sentence. Example: "Heads up — medication has been linked to your flares 4 out of 4 times (3.3× more likely)."
2. NEVER use the old format with "**Discovery: X**" blocks, stat paragraphs, italic lines, or 💡 emojis before discoveries. That format is BANNED.
3. NEVER output raw discovery data blocks. Just mention the relevant finding naturally in 1 sentence.
4. Include discovery details in the "discoveries" array of your respond_text_only tool call — the frontend renders them as visual cards automatically.
5. If status is "confirmed" or "strong", state it as fact. If "emerging" or "investigating", say "I'm noticing a possible pattern..."

DISCOVERY DATA:
${JSON.stringify(dataContext.discoveries?.filter((d: any) => d.confidence >= 25) || [], null, 2)}

══ CONTEXT AWARENESS — CRITICAL ══
- You can see recent chat messages below. This includes ALL logs the user has made (flares, trackables, medications, energy).
- If you see someone log the same thing 3+ times in quick succession (within minutes), COMMENT on it naturally like a human friend would.
- Be aware of TIME. If it's morning and they haven't logged anything, you might ask about sleep. If it's late, acknowledge the time.
- If they ask "how does X affect my Y" — ANSWER using the clinical knowledge above, citing specific mechanisms. Don't say "I don't have enough info" when you literally have clinical research above.
- When the user logs a flare RIGHT AFTER logging food/activity, CONNECT THE DOTS using discoveries data. This is what makes you useful.

══ CRITICAL: ANTI-DEFLECTION — READ THIS CAREFULLY ══
You have PRE-COMPUTED data sections in USER DATA below. NEVER say "I can't filter", "I can't track effectiveness", or "I can only show X".

EXACT MAPPINGS (use these when asked):
- "Show me flares over 30 days" → Use dailyFlares30d array. Each entry has { date, flares, mild, moderate, severe, avgSeverity }. Create a bar_chart or line_chart with label=date, value=flares for EACH of the 30 days.
- "Which medications helped most?" → Use medicationEffectiveness array. Rank by severityReduction %. Explain: "X reduced severity by Y%, with Z flare-free days on average after each dose."
- "Track medication effectiveness" → SAME as above. You CAN track this. The data is RIGHT THERE.
- "Time patterns" / "When do I flare most?" → Use byHour and byDayOfWeek arrays to identify peak hours and days.
- "Weekly trend" / "Compare weeks" → Use weeklyBreakdown array. Each entry has { week, total, mild, moderate, severe, avgSeverity }.
- "Trigger → symptom" → Use triggerOutcomes array showing which triggers lead to which symptoms.
- "Predict flare risk" → Use trends (this week vs last week), weather data, discoveries, and time patterns to give a % risk estimate. You ARE allowed to estimate.
- "Tell me more about X as a trigger" → The user clicked a discovery from the Trends tab. The message ALREADY CONTAINS the statistical evidence (confidence, lift, occurrences, delay). DO NOT ask clarifying questions like "what do you mean by X?". Instead: (1) explain what the data means in plain language, (2) assess evidence strength, (3) give actionable advice for their specific conditions. Same for protective factors and investigating patterns.
- When a message contains discovery stats (confidence %, lift, occurrences) → ALWAYS interpret and explain them. Never ask "are you referring to...?" — the data IS the answer.

When generating charts:
- Use ACTUAL numbers from the pre-computed arrays. NEVER use placeholder/made-up values.
- For 30-day charts: iterate dailyFlares30d, set label=date, value=flares for each entry.
- For weekly charts: iterate weeklyBreakdown, set label=week, value=total.
- For medication comparison: iterate medicationEffectiveness, set label=name, value=severityReduction number.

══ VISUALIZATION RULES ══
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

══ USER DATA (PRE-COMPUTED — USE THESE NUMBERS) ══
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
          description: "Respond with text only. Use this for most responses. If discoveries are relevant, include them in the discoveries array — the frontend will render them as visual cards.",
          parameters: {
            type: "object",
            required: ["response"],
            properties: {
              response: { type: "string", description: "Your conversational response. Do NOT include raw discovery stat blocks here — put them in the discoveries array instead." },
              discoveries: { 
                type: "array", 
                items: { 
                  type: "object",
                  required: ["factor", "confidence", "occurrences", "total", "category"],
                  properties: {
                    factor: { type: "string", description: "The trigger/factor name (e.g. 'Cold Temperature', 'Medication', 'Advil')" },
                    confidence: { type: "number", description: "Confidence percentage 0-100" },
                    lift: { type: "number", description: "How many times more likely than random (e.g. 3.3)" },
                    occurrences: { type: "number", description: "Times this factor led to a flare" },
                    total: { type: "number", description: "Total times this factor was observed" },
                    category: { type: "string", enum: ["trigger", "protective", "investigating"], description: "Whether this is a risk factor, protective factor, or under investigation" },
                    summary: { type: "string", description: "One-line plain English summary" },
                  }
                },
                description: "Structured discovery data to render as visual cards. Use when discoveries are relevant to the conversation." 
              },
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
        
        // respond_text_only — strip any leftover discovery text blocks the AI ignored instructions about
        let cleanedResponse = parsed.response || "";
        // Strip "💡 **Discovery: X**\n...\n_Status • confidence • occurrences_" blocks
        cleanedResponse = cleanedResponse
          .replace(/(?:💡\s*)?(?:\*{1,2})?Discovery:\s*[^\n]+\*{0,2}\n[\s\S]*?(?=(?:💡\s*)?(?:\*{1,2})?Discovery:|$)/gi, '')
          .replace(/_[A-Za-z]+\s*•\s*\d+%?\s*confidence\s*•\s*\d+\s*occurrences?_/gi, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        
        // Also extract discoveries from text if AI put them in response but not in discoveries array
        let discoveries = parsed.discoveries || [];
        if (discoveries.length === 0) {
          const discoveryRegex = /(?:💡\s*)?(?:\*{1,2})?Discovery:\s*([^\n*]+?)(?:\*{0,2})\n+(\d+)\s*out\s*of\s*(\d+)\s*times?\s*\((\d+)%\).*?(\d+\.?\d*)x\s*more\s*likely/gi;
          let match;
          const rawResponse = parsed.response || "";
          while ((match = discoveryRegex.exec(rawResponse)) !== null) {
            discoveries.push({
              factor: match[1].trim(),
              occurrences: parseInt(match[2]),
              total: parseInt(match[3]),
              confidence: parseInt(match[4]),
              lift: parseFloat(match[5]),
              category: "trigger",
              summary: `${match[2]}/${match[3]} times a flare followed`,
            });
          }
        }
        
        return new Response(JSON.stringify({
          response: cleanedResponse,
          visualization: null,
          discoveries,
          dynamicFollowUps: parsed.dynamicFollowUps,
          citations: [],
          wasResearched: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }
    }

    // Fallback to direct content (no tool call) — also strip discovery text
    let fallbackContent = data.choices?.[0]?.message?.content || "I'm here to help with your health data.";
    const fallbackDiscoveries: any[] = [];
    const discoveryRegex2 = /(?:💡\s*)?(?:\*{1,2})?Discovery:\s*([^\n*]+?)(?:\*{0,2})\n+(\d+)\s*out\s*of\s*(\d+)\s*times?\s*\((\d+)%\).*?(\d+\.?\d*)x\s*more\s*likely/gi;
    let m2;
    while ((m2 = discoveryRegex2.exec(fallbackContent)) !== null) {
      fallbackDiscoveries.push({
        factor: m2[1].trim(),
        occurrences: parseInt(m2[2]),
        total: parseInt(m2[3]),
        confidence: parseInt(m2[4]),
        lift: parseFloat(m2[5]),
        category: "trigger",
        summary: `${m2[2]}/${m2[3]} times a flare followed`,
      });
    }
    fallbackContent = fallbackContent
      .replace(/(?:💡\s*)?(?:\*{1,2})?Discovery:\s*[^\n]+\*{0,2}\n[\s\S]*?(?=(?:💡\s*)?(?:\*{1,2})?Discovery:|$)/gi, '')
      .replace(/_[A-Za-z]+\s*•\s*\d+%?\s*confidence\s*•\s*\d+\s*occurrences?_/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return new Response(JSON.stringify({ 
      response: fallbackContent,
      visualization: null,
      discoveries: fallbackDiscoveries,
      citations: [],
      wasResearched: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
