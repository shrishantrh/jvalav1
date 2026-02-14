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

    const { query, clientTimezone } = await req.json();
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

    const systemPrompt = `You are Jvala's AI — ${userName}'s personal health companion built into the Jvala flare-tracking app.

══ IDENTITY ══
- You know EVERYTHING about ${userName}. Their name, conditions, symptoms, triggers, meds, bio sex, DOB — it's all below.
- NEVER say "I don't have access to your personal information." You have ALL their data.
- If they ask "what's my name?" → answer "${userName}".

══ PERSONALITY ══
- Talk like a smart friend texting — warm, casual, brief.
- Do NOT start every message with "${userName}". Use their name only occasionally, naturally — maybe 1 in 4 messages.
- Keep responses 1-3 sentences for simple things. Go longer ONLY for complex analysis questions.
- Be direct. No filler, no corporate speak, no disclaimers about being AI.
- Celebrate wins. Comfort during hard times. Be real.

══ VISUALIZATION RULES — CRITICAL ══
- ONLY create a chart when the user EXPLICITLY asks: "show me a chart", "graph my...", "visualize", "plot", "show me data"
- For ALL other questions — even data questions — just answer conversationally in text. NO chart.
- Listing conditions, answering "what are my triggers", "how am I doing" = TEXT ONLY. No chart.
- When you DO create a chart, make it meaningful with real data ranges. Never a 0-1 Y axis for categorical data.

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
- Never diagnose. Never prescribe dosages. You share observations, not medical advice.`;

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
          description: "Respond with text only. Use this for most responses — questions, observations, greetings, insights, anything that doesn't need a chart.",
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
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        tools,
        // NO tool_choice — let the AI decide whether to use a chart or not
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
    
    // Handle tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        
        if (toolCall.function.name === "respond_with_visualization") {
          return new Response(JSON.stringify({
            response: parsed.response,
            visualization: parsed.chart,
            dynamicFollowUps: parsed.dynamicFollowUps,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        // respond_text_only — no visualization
        return new Response(JSON.stringify({
          response: parsed.response,
          visualization: null,
          dynamicFollowUps: parsed.dynamicFollowUps,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }
    }

    // Fallback to direct content (no tool call)
    const content = data.choices?.[0]?.message?.content;
    return new Response(JSON.stringify({ 
      response: content || "I'm here to help with your health data.", 
      visualization: null 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
