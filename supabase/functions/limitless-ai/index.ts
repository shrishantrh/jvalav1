import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, userId, context } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch ALL user data comprehensively
    const [entriesRes, profileRes, correlationsRes, medsRes, engagementRes] = await Promise.all([
      supabase.from("flare_entries").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(1000),
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("correlations").select("*").eq("user_id", userId).order("confidence", { ascending: false }),
      supabase.from("medication_logs").select("*").eq("user_id", userId).order("taken_at", { ascending: false }).limit(500),
      supabase.from("engagement").select("*").eq("user_id", userId).single(),
    ]);

    const entries = entriesRes.data || [];
    const profile = profileRes.data;
    const correlations = correlationsRes.data || [];
    const medications = medsRes.data || [];
    const engagement = engagementRes.data;

    const flares = entries.filter((e: any) => e.entry_type === "flare" || e.severity);
    const now = Date.now();
    const oneDay = 86400000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPREHENSIVE DATA EXTRACTION - Leave NOTHING out
    // ═══════════════════════════════════════════════════════════════════════════

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
      thisWeekSeverity: calcSeverityScore(thisWeekFlares),
      lastWeekSeverity: calcSeverityScore(lastWeekFlares),
      thisMonthSeverity: calcSeverityScore(thisMonthFlares),
      lastMonthSeverity: calcSeverityScore(lastMonthFlares),
      daysSinceLast: flares.length > 0 ? Math.floor((now - new Date(flares[0].timestamp).getTime()) / oneDay) : null,
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

    // Time patterns - detailed
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};
    const monthCounts: Record<number, number> = {};
    flares.forEach((e: any) => {
      const d = new Date(e.timestamp);
      hourCounts[d.getHours()] = (hourCounts[d.getHours()] || 0) + 1;
      dayCounts[d.getDay()] = (dayCounts[d.getDay()] || 0) + 1;
      monthCounts[d.getMonth()] = (monthCounts[d.getMonth()] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // LOCATION DATA - Extract all cities and location info
    const locationCounts: Record<string, number> = {};
    const locationSeverities: Record<string, number[]> = {};
    flares.forEach((e: any) => {
      const city = e.city || e.environmental_data?.location?.city;
      if (city) {
        locationCounts[city] = (locationCounts[city] || 0) + 1;
        if (!locationSeverities[city]) locationSeverities[city] = [];
        locationSeverities[city].push(e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3);
      }
    });
    const topLocations = Object.entries(locationCounts)
      .map(([city, count]) => ({
        city,
        count,
        avgSeverity: locationSeverities[city].reduce((a, b) => a + b, 0) / locationSeverities[city].length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Weather analysis - comprehensive
    const weatherCounts: Record<string, { count: number; severities: number[]; temps: number[]; humidities: number[] }> = {};
    flares.forEach((e: any) => {
      const weather = e.environmental_data?.weather;
      if (weather?.condition) {
        const cond = weather.condition.toLowerCase();
        if (!weatherCounts[cond]) weatherCounts[cond] = { count: 0, severities: [], temps: [], humidities: [] };
        weatherCounts[cond].count++;
        weatherCounts[cond].severities.push(e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3);
        if (weather.temperature) weatherCounts[cond].temps.push(weather.temperature);
        if (weather.humidity) weatherCounts[cond].humidities.push(weather.humidity);
      }
    });
    const weatherAnalysis = Object.entries(weatherCounts)
      .map(([condition, data]) => ({
        condition,
        count: data.count,
        avgSeverity: data.severities.length ? (data.severities.reduce((a, b) => a + b, 0) / data.severities.length).toFixed(1) : "N/A",
        avgTemp: data.temps.length ? Math.round(data.temps.reduce((a, b) => a + b, 0) / data.temps.length) : null,
        avgHumidity: data.humidities.length ? Math.round(data.humidities.reduce((a, b) => a + b, 0) / data.humidities.length) : null,
      }))
      .sort((a, b) => b.count - a.count);

    // Temperature correlation
    const tempRanges: Record<string, { count: number; severities: number[] }> = {
      "cold (<50°F)": { count: 0, severities: [] },
      "cool (50-65°F)": { count: 0, severities: [] },
      "mild (65-75°F)": { count: 0, severities: [] },
      "warm (75-85°F)": { count: 0, severities: [] },
      "hot (>85°F)": { count: 0, severities: [] },
    };
    flares.forEach((e: any) => {
      const temp = e.environmental_data?.weather?.temperature;
      if (temp != null) {
        const sev = e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3;
        if (temp < 50) { tempRanges["cold (<50°F)"].count++; tempRanges["cold (<50°F)"].severities.push(sev); }
        else if (temp < 65) { tempRanges["cool (50-65°F)"].count++; tempRanges["cool (50-65°F)"].severities.push(sev); }
        else if (temp < 75) { tempRanges["mild (65-75°F)"].count++; tempRanges["mild (65-75°F)"].severities.push(sev); }
        else if (temp < 85) { tempRanges["warm (75-85°F)"].count++; tempRanges["warm (75-85°F)"].severities.push(sev); }
        else { tempRanges["hot (>85°F)"].count++; tempRanges["hot (>85°F)"].severities.push(sev); }
      }
    });

    // Medication analysis - when did they help?
    const medEffectiveness: Record<string, { timesLogged: number; flaresWithin24h: number; avgSeverityAfter: number }> = {};
    medications.forEach((med: any) => {
      const medTime = new Date(med.taken_at).getTime();
      const flaresAfter = flares.filter((f: any) => {
        const flareTime = new Date(f.timestamp).getTime();
        return flareTime > medTime && flareTime < medTime + 24 * 60 * 60 * 1000;
      });
      const name = med.medication_name;
      if (!medEffectiveness[name]) {
        medEffectiveness[name] = { timesLogged: 0, flaresWithin24h: 0, avgSeverityAfter: 0 };
      }
      medEffectiveness[name].timesLogged++;
      medEffectiveness[name].flaresWithin24h += flaresAfter.length;
      if (flaresAfter.length) {
        const severities = flaresAfter.map((f: any) => f.severity === "mild" ? 1 : f.severity === "moderate" ? 2 : 3);
        medEffectiveness[name].avgSeverityAfter = 
          (medEffectiveness[name].avgSeverityAfter * (medEffectiveness[name].timesLogged - 1) + 
           severities.reduce((a, b) => a + b, 0) / severities.length) / medEffectiveness[name].timesLogged;
      }
    });

    // Sleep correlation
    const sleepData = flares.filter((e: any) => e.physiological_data?.sleep);
    let sleepAnalysis = null;
    if (sleepData.length > 3) {
      const sleepHours = sleepData.map((e: any) => {
        const d = e.physiological_data.sleep.duration;
        return d > 24 ? d / 60 : d; // Handle minutes vs hours
      });
      const avgSleep = sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length;
      const lowSleepFlares = sleepData.filter((e: any) => {
        const d = e.physiological_data.sleep.duration;
        const hrs = d > 24 ? d / 60 : d;
        return hrs < 6;
      });
      sleepAnalysis = {
        avgSleepBeforeFlares: avgSleep.toFixed(1),
        lowSleepFlareCount: lowSleepFlares.length,
        lowSleepPercentage: ((lowSleepFlares.length / sleepData.length) * 100).toFixed(0),
      };
    }

    // Recent entries with FULL detail
    const recentEntriesDetail = entries.slice(0, 30).map((e: any) => {
      const d = new Date(e.timestamp);
      return {
        date: d.toLocaleDateString(),
        time: d.toLocaleTimeString(),
        type: e.entry_type,
        severity: e.severity,
        symptoms: e.symptoms || [],
        triggers: e.triggers || [],
        note: e.note,
        city: e.city || e.environmental_data?.location?.city,
        weather: e.environmental_data?.weather?.condition,
        temp: e.environmental_data?.weather?.temperature,
        medications: e.medications,
      };
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // BUILD THE MEGA SYSTEM PROMPT
    // ═══════════════════════════════════════════════════════════════════════════

    const systemPrompt = `You are Jvala AI - an incredibly smart, data-driven health assistant. You have COMPLETE access to this user's health data. NEVER say "I don't have access" or "I can't see" - YOU CAN SEE EVERYTHING.

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES - FOLLOW THESE EXACTLY
═══════════════════════════════════════════════════════════════════════════════

1. NEVER say "I don't have information about X" - you DO have the data below
2. NEVER say "I can't access X" - use the data provided
3. ALWAYS use specific numbers from the data
4. ALWAYS answer directly with insights, not disclaimers
5. If data is sparse, say "Based on your X logs so far..." not "I don't have data"
6. Be conversational but data-driven
7. Generate visualizations when they'd help

═══════════════════════════════════════════════════════════════════════════════
USER PROFILE
═══════════════════════════════════════════════════════════════════════════════

Conditions: ${(profile?.conditions || []).join(", ") || "Not specified yet"}
Known Symptoms: ${(profile?.known_symptoms || []).join(", ") || "Learning from logs"}
Known Triggers: ${(profile?.known_triggers || []).join(", ") || "Learning from logs"}

═══════════════════════════════════════════════════════════════════════════════
FLARE STATISTICS (use these exact numbers!)
═══════════════════════════════════════════════════════════════════════════════

TOTALS:
- All time: ${stats.total} flares
- Mild: ${stats.mildCount} | Moderate: ${stats.moderateCount} | Severe: ${stats.severeCount}
- Overall average severity: ${stats.avgSeverity.toFixed(1)}/3.0
- Days since last flare: ${stats.daysSinceLast ?? "No flares yet"}

THIS WEEK vs LAST WEEK:
- This week: ${stats.thisWeek} flares (avg severity: ${stats.thisWeekSeverity.toFixed(1)}/3.0)
- Last week: ${stats.lastWeek} flares (avg severity: ${stats.lastWeekSeverity.toFixed(1)}/3.0)
- Week-over-week change: ${stats.thisWeek > stats.lastWeek ? `+${stats.thisWeek - stats.lastWeek} more` : stats.thisWeek < stats.lastWeek ? `${stats.lastWeek - stats.thisWeek} fewer` : "same"}

THIS MONTH vs LAST MONTH:
- This month: ${stats.thisMonth} flares (avg severity: ${stats.thisMonthSeverity.toFixed(1)}/3.0)
- Last month: ${stats.lastMonth} flares (avg severity: ${stats.lastMonthSeverity.toFixed(1)}/3.0)
- Month-over-month change: ${stats.thisMonth > stats.lastMonth ? `+${stats.thisMonth - stats.lastMonth} more flares (${(((stats.thisMonth - stats.lastMonth) / Math.max(stats.lastMonth, 1)) * 100).toFixed(0)}% increase)` : stats.thisMonth < stats.lastMonth ? `${stats.lastMonth - stats.thisMonth} fewer flares (${(((stats.lastMonth - stats.thisMonth) / Math.max(stats.lastMonth, 1)) * 100).toFixed(0)}% decrease)` : "same number of flares"}

═══════════════════════════════════════════════════════════════════════════════
TOP SYMPTOMS (${topSymptoms.length} unique symptoms tracked)
═══════════════════════════════════════════════════════════════════════════════
${topSymptoms.map(([s, c], i) => `${i + 1}. ${s}: ${c} occurrences (${((c / stats.total) * 100).toFixed(0)}%)`).join("\n") || "No symptoms logged yet"}

═══════════════════════════════════════════════════════════════════════════════
TOP TRIGGERS (${topTriggers.length} unique triggers identified)
═══════════════════════════════════════════════════════════════════════════════
${topTriggers.map(([t, c], i) => `${i + 1}. ${t}: ${c} occurrences`).join("\n") || "No triggers identified yet"}

═══════════════════════════════════════════════════════════════════════════════
LOCATION DATA (cities where flares occurred)
═══════════════════════════════════════════════════════════════════════════════
${topLocations.length > 0 ? topLocations.map(l => `- ${l.city}: ${l.count} flares (avg severity: ${l.avgSeverity.toFixed(1)}/3.0)`).join("\n") : "No location data yet - location tracking will show where flares occur most"}

User's most common flare locations: ${topLocations.slice(0, 3).map(l => l.city).join(", ") || "Not enough data yet"}

═══════════════════════════════════════════════════════════════════════════════
WEATHER CORRELATIONS
═══════════════════════════════════════════════════════════════════════════════
${weatherAnalysis.length > 0 ? weatherAnalysis.slice(0, 8).map(w => 
  `- ${w.condition}: ${w.count} flares (avg severity: ${w.avgSeverity}/3.0${w.avgTemp ? `, avg temp: ${w.avgTemp}°F` : ""}${w.avgHumidity ? `, avg humidity: ${w.avgHumidity}%` : ""})`
).join("\n") : "No weather data yet"}

TEMPERATURE ANALYSIS:
${Object.entries(tempRanges).filter(([_, d]) => d.count > 0).map(([range, data]) => 
  `- ${range}: ${data.count} flares${data.severities.length ? ` (avg severity: ${(data.severities.reduce((a, b) => a + b, 0) / data.severities.length).toFixed(1)}/3.0)` : ""}`
).join("\n") || "No temperature data yet"}

═══════════════════════════════════════════════════════════════════════════════
TIME PATTERNS
═══════════════════════════════════════════════════════════════════════════════
Peak hours: ${peakHours.map(([h, c]) => `${h}:00 (${c} flares)`).join(", ") || "N/A"}
Peak days: ${Object.entries(dayCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, c]) => `${dayNames[parseInt(d)]} (${c})`).join(", ") || "N/A"}
Peak months: ${Object.entries(monthCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, c]) => `${monthNames[parseInt(m)]} (${c})`).join(", ") || "N/A"}

═══════════════════════════════════════════════════════════════════════════════
MEDICATION ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
${Object.keys(medEffectiveness).length > 0 ? Object.entries(medEffectiveness).map(([name, data]) => 
  `- ${name}: Logged ${data.timesLogged}x. Flares within 24h after: ${data.flaresWithin24h}. ${data.flaresWithin24h > 0 ? `Avg severity after: ${data.avgSeverityAfter.toFixed(1)}/3.0` : "No flares recorded after taking this medication."}`
).join("\n") : "No medication logs yet. When the user logs medications AND flares, I can analyze which medications help most."}

Raw medication logs: ${medications.slice(0, 10).map((m: any) => `${m.medication_name} (${new Date(m.taken_at).toLocaleDateString()})`).join(", ") || "None"}

═══════════════════════════════════════════════════════════════════════════════
SLEEP CORRELATION
═══════════════════════════════════════════════════════════════════════════════
${sleepAnalysis ? `Average sleep before flares: ${sleepAnalysis.avgSleepBeforeFlares} hours
Flares after <6h sleep: ${sleepAnalysis.lowSleepFlareCount} (${sleepAnalysis.lowSleepPercentage}% of flares with sleep data)` : "Not enough sleep data yet. When wearable data comes in, I'll analyze sleep-flare correlations."}

═══════════════════════════════════════════════════════════════════════════════
AI-LEARNED CORRELATIONS (from pattern analysis)
═══════════════════════════════════════════════════════════════════════════════
${correlations.slice(0, 15).map((c: any) => 
  `- ${c.trigger_value} → ${c.outcome_value}: ${Math.round((c.confidence || 0) * 100)}% confidence (seen ${c.occurrence_count}x)`
).join("\n") || "Still learning patterns..."}

═══════════════════════════════════════════════════════════════════════════════
ENGAGEMENT & STREAKS
═══════════════════════════════════════════════════════════════════════════════
Current streak: ${engagement?.current_streak || 0} days
Longest streak: ${engagement?.longest_streak || 0} days
Total logs: ${engagement?.total_logs || 0}
Badges: ${(engagement?.badges || []).join(", ") || "None yet"}

═══════════════════════════════════════════════════════════════════════════════
RECENT ENTRIES (last 30 - use for specific queries)
═══════════════════════════════════════════════════════════════════════════════
${recentEntriesDetail.map(e => 
  `[${e.date} ${e.time}] ${e.type}${e.severity ? ` (${e.severity})` : ""}${e.symptoms?.length ? ` - Symptoms: ${e.symptoms.join(", ")}` : ""}${e.triggers?.length ? ` | Triggers: ${e.triggers.join(", ")}` : ""}${e.city ? ` | Location: ${e.city}` : ""}${e.weather ? ` | Weather: ${e.weather}${e.temp ? ` ${e.temp}°F` : ""}` : ""}${e.note ? ` | Note: "${e.note.slice(0, 60)}"` : ""}`
).join("\n")}

═══════════════════════════════════════════════════════════════════════════════
VISUALIZATION CAPABILITIES
═══════════════════════════════════════════════════════════════════════════════

Generate charts to help explain data:
- severity_breakdown: Show mild/moderate/severe distribution
- symptom_frequency: Bar chart of top symptoms  
- trigger_frequency: Bar chart of top triggers
- weather_correlation: Weather conditions vs flare count
- timeline: Flares over time
- comparison: This period vs last period
- heatmap: Hour x Day patterns
- line_chart: Trends over time
- pie_chart: Distributions
- risk_gauge: Current risk level

USER'S QUESTION: "${query}"

Answer using the data above. Be specific with numbers. Generate a visualization if it helps.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "respond_with_insight",
          description: "Respond with data-backed insights",
          parameters: {
            type: "object",
            additionalProperties: false,
            required: ["response"],
            properties: {
              response: { type: "string", description: "Your response using specific data from above" },
              visualization: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["type", "title", "data"],
                    properties: {
                      type: { type: "string", enum: ["timeline", "bar_chart", "pie_chart", "line_chart", "heatmap", "scatter", "comparison", "severity_breakdown", "symptom_frequency", "trigger_frequency", "weather_correlation", "sleep_correlation", "medication_timeline", "calendar_heatmap", "risk_gauge", "pattern_summary"] },
                      title: { type: "string" },
                      data: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" }, category: { type: "string" }, date: { type: "string" }, extra: { type: "string" } } } },
                      config: { type: "object", properties: { xAxis: { type: "string" }, yAxis: { type: "string" }, colors: { type: "array", items: { type: "string" } }, showLegend: { type: "boolean" } } },
                    },
                  },
                ],
              },
              dynamicFollowUps: {
                type: "array",
                items: { type: "string" },
                description: "2-4 relevant follow-up questions based on the conversation",
              },
              followUp: { type: "string", description: "Single suggested follow-up" },
            },
          },
        },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "respond_with_insight" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolArgs = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;

    if (toolArgs) {
      try {
        const parsed = JSON.parse(toolArgs);
        return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    const content = data.choices?.[0]?.message?.content || "I'm here to help with your health patterns.";
    return new Response(JSON.stringify({ response: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
