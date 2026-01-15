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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

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

    // Time patterns
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};
    flares.forEach((e: any) => {
      const d = new Date(e.timestamp);
      hourCounts[d.getHours()] = (hourCounts[d.getHours()] || 0) + 1;
      dayCounts[d.getDay()] = (dayCounts[d.getDay()] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Location data
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

    // Weather analysis
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

    // Medication analysis
    const medEffectiveness: Record<string, { timesLogged: number; flaresWithin24h: number }> = {};
    medications.forEach((med: any) => {
      const medTime = new Date(med.taken_at).getTime();
      const flaresAfter = flares.filter((f: any) => {
        const flareTime = new Date(f.timestamp).getTime();
        return flareTime > medTime && flareTime < medTime + 24 * 60 * 60 * 1000;
      });
      const name = med.medication_name;
      if (!medEffectiveness[name]) {
        medEffectiveness[name] = { timesLogged: 0, flaresWithin24h: 0 };
      }
      medEffectiveness[name].timesLogged++;
      medEffectiveness[name].flaresWithin24h += flaresAfter.length;
    });

    // Build compact data summary for Claude
    const dataSummary = {
      totalFlares: stats.total,
      mildCount: stats.mildCount,
      moderateCount: stats.moderateCount,
      severeCount: stats.severeCount,
      avgSeverity: stats.avgSeverity.toFixed(1),
      thisWeek: stats.thisWeek,
      lastWeek: stats.lastWeek,
      thisMonth: stats.thisMonth,
      lastMonth: stats.lastMonth,
      daysSinceLast: stats.daysSinceLast,
      topSymptoms: topSymptoms.slice(0, 8),
      topTriggers: topTriggers.slice(0, 8),
      topLocations: topLocations.slice(0, 5),
      weatherPatterns: weatherAnalysis.slice(0, 5),
      tempPatterns: Object.entries(tempRanges).filter(([_, d]) => d.count > 0).map(([r, d]) => ({ range: r, count: d.count })),
      peakHours: peakHours.map(([h, c]) => `${h}:00 (${c})`),
      peakDays: Object.entries(dayCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, c]) => `${dayNames[parseInt(d)]} (${c})`),
      medications: Object.entries(medEffectiveness).map(([n, d]) => ({ name: n, logged: d.timesLogged, flaresAfter: d.flaresWithin24h })),
      correlations: correlations.slice(0, 10).map((c: any) => ({ trigger: c.trigger_value, outcome: c.outcome_value, confidence: Math.round((c.confidence || 0) * 100), count: c.occurrence_count })),
      streak: engagement?.current_streak || 0,
      conditions: profile?.conditions || [],
    };

    const systemPrompt = `You are Jvala, a warm and insightful health companion. You speak naturally like a friend who happens to be really good with data.

YOUR VOICE:
- Conversational, not clinical. Like texting a smart friend.
- SHORT responses. 2-3 sentences max for simple questions. Never write essays.
- Lead with the insight, not the data. The chart shows the numbers.
- Use "you" and "your", not "the user" or "the data shows".

CRITICAL RULES:
1. NEVER write more than 3 sentences in your response text
2. Let the visualization do the heavy lifting - don't repeat all the numbers in text
3. If you generate a chart, your text should be a brief insight about what it shows
4. Be direct: "Cold weather hits you hardest" not "Based on your data, cold weather conditions appear to be associated with..."
5. ALWAYS generate a visualization if data would help - but only ONE, and pick the most relevant type

RESPONSE STYLE EXAMPLES:
✓ "Cold weather's your biggest trigger - 109 of your flares happened below 50°F. Overcast days also seem to hit harder."
✗ "Your flare data indicates interesting correlations between your location, weather, and flare occurrences. Grayslake accounts for the highest number of flares at 56, with Urbana following at 35..."

✓ "You're doing better this month - down 15% from last month with milder flares overall."
✗ "This month, you've experienced 39 flares. Unfortunately, I don't have direct access to..."

USER'S HEALTH DATA:
${JSON.stringify(dataSummary, null, 2)}

Answer the user's question with a brief, insightful response and generate a relevant visualization.`;

    const tools = [
      {
        name: "respond_with_insight",
        description: "Respond with a brief insight and optional visualization",
        input_schema: {
          type: "object",
          required: ["response"],
          properties: {
            response: { 
              type: "string", 
              description: "Your response - MAX 3 sentences. Be conversational, not clinical." 
            },
            visualization: {
              type: "object",
              description: "A chart to show data. Only include if it adds value.",
              properties: {
                type: { 
                  type: "string", 
                  enum: ["bar_chart", "pie_chart", "line_chart", "pattern_summary", "comparison"] 
                },
                title: { type: "string", description: "Short chart title (3-5 words)" },
                data: { 
                  type: "array", 
                  items: { 
                    type: "object", 
                    properties: { 
                      label: { type: "string" }, 
                      value: { type: "number" },
                      extra: { type: "string" }
                    } 
                  } 
                },
              },
              required: ["type", "title", "data"],
            },
            dynamicFollowUps: {
              type: "array",
              items: { type: "string" },
              description: "2-3 short follow-up questions (under 8 words each)",
            },
          },
        },
      },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: query }],
        tools,
        tool_choice: { type: "tool", name: "respond_with_insight" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Claude error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Claude error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Claude response:", JSON.stringify(data, null, 2));
    
    // Extract tool use from Claude's response
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    
    if (toolUse?.input) {
      return new Response(JSON.stringify(toolUse.input), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fallback to text response
    const textContent = data.content?.find((c: any) => c.type === "text");
    return new Response(JSON.stringify({ response: textContent?.text || "I'm here to help with your health patterns." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
