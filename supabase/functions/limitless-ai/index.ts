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
    const { query, userId } = await req.json();
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

    // Time patterns - by hour
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, { count: number; severity: number[] }> = {};
    flares.forEach((e: any) => {
      const d = new Date(e.timestamp);
      hourCounts[d.getHours()] = (hourCounts[d.getHours()] || 0) + 1;
      if (!dayCounts[d.getDay()]) dayCounts[d.getDay()] = { count: 0, severity: [] };
      dayCounts[d.getDay()].count++;
      dayCounts[d.getDay()].severity.push(e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3);
    });

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Location data with coordinates
    const locationData: { city: string; lat: number; lng: number; count: number; severity: string; weather?: any }[] = [];
    const locationCounts: Record<string, { count: number; severity: number[]; lat?: number; lng?: number; weather?: any }> = {};
    
    flares.forEach((e: any) => {
      const city = e.city || e.environmental_data?.location?.city;
      const lat = e.latitude || e.environmental_data?.location?.latitude;
      const lng = e.longitude || e.environmental_data?.location?.longitude;
      
      if (city) {
        if (!locationCounts[city]) {
          locationCounts[city] = { count: 0, severity: [], lat, lng };
        }
        locationCounts[city].count++;
        locationCounts[city].severity.push(e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3);
        if (e.environmental_data?.weather) {
          locationCounts[city].weather = e.environmental_data.weather;
        }
      }
    });

    // Build location array for map display
    Object.entries(locationCounts).forEach(([city, data]) => {
      const avgSev = data.severity.reduce((a, b) => a + b, 0) / data.severity.length;
      locationData.push({
        city,
        lat: data.lat || 0,
        lng: data.lng || 0,
        count: data.count,
        severity: avgSev > 2.5 ? 'severe' : avgSev > 1.5 ? 'moderate' : 'mild',
        weather: data.weather,
      });
    });

    // Weather analysis - comprehensive
    const weatherCounts: Record<string, { count: number; severity: number[]; temps: number[] }> = {};
    const recentWeather: any[] = [];
    
    flares.forEach((e: any) => {
      const weather = e.environmental_data?.weather;
      if (weather) {
        recentWeather.push({
          timestamp: e.timestamp,
          condition: weather.condition,
          temperature: weather.temperature,
          humidity: weather.humidity,
          city: e.city || e.environmental_data?.location?.city,
        });
        
        if (weather.condition) {
          const cond = weather.condition.toLowerCase();
          if (!weatherCounts[cond]) weatherCounts[cond] = { count: 0, severity: [], temps: [] };
          weatherCounts[cond].count++;
          weatherCounts[cond].severity.push(e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3);
          if (weather.temperature) weatherCounts[cond].temps.push(weather.temperature);
        }
      }
    });

    // Temperature buckets
    const tempBuckets: Record<string, number> = { "<40°F": 0, "40-55°F": 0, "55-70°F": 0, "70-85°F": 0, ">85°F": 0 };
    flares.forEach((e: any) => {
      const temp = e.environmental_data?.weather?.temperature;
      if (temp != null) {
        if (temp < 40) tempBuckets["<40°F"]++;
        else if (temp < 55) tempBuckets["40-55°F"]++;
        else if (temp < 70) tempBuckets["55-70°F"]++;
        else if (temp < 85) tempBuckets["70-85°F"]++;
        else tempBuckets[">85°F"]++;
      }
    });

    // Monthly trend
    const monthlyFlares: Record<string, number> = {};
    flares.forEach((e: any) => {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyFlares[key] = (monthlyFlares[key] || 0) + 1;
    });

    // Weekly trend (last 8 weeks)
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
      const h = new Date(e.timestamp).getHours();
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

    // Build rich data context for AI
    const dataContext = {
      overview: {
        totalFlares: stats.total,
        severityBreakdown: { mild: stats.mildCount, moderate: stats.moderateCount, severe: stats.severeCount },
        avgSeverity: stats.avgSeverity.toFixed(1),
        thisWeek: stats.thisWeek,
        lastWeek: stats.lastWeek,
        thisMonth: stats.thisMonth,
        lastMonth: stats.lastMonth,
        weekChange: stats.thisWeek - stats.lastWeek,
        monthChange: stats.thisMonth - stats.lastMonth,
      },
      topSymptoms: topSymptoms.slice(0, 10).map(([name, count]) => ({ name, count })),
      topTriggers: topTriggers.slice(0, 10).map(([name, count]) => ({ name, count })),
      locations: Object.entries(locationCounts).map(([city, data]) => ({
        city,
        count: data.count,
        avgSeverity: (data.severity.reduce((a, b) => a + b, 0) / data.severity.length).toFixed(1),
        latitude: data.lat,
        longitude: data.lng,
      })).sort((a, b) => b.count - a.count).slice(0, 8),
      locationMapData: locationData.slice(0, 20),
      weather: Object.entries(weatherCounts).map(([condition, data]) => ({
        condition,
        count: data.count,
        avgSeverity: (data.severity.reduce((a, b) => a + b, 0) / data.severity.length).toFixed(1),
        avgTemp: data.temps.length ? Math.round(data.temps.reduce((a, b) => a + b, 0) / data.temps.length) : null,
      })).sort((a, b) => b.count - a.count).slice(0, 8),
      recentWeatherConditions: recentWeather.slice(0, 10),
      temperature: Object.entries(tempBuckets).filter(([_, c]) => c > 0).map(([range, count]) => ({ range, count })),
      byDayOfWeek: dayNames.map((name, i) => ({
        day: name,
        count: dayCounts[i]?.count || 0,
        avgSeverity: dayCounts[i]?.severity.length ? (dayCounts[i].severity.reduce((a, b) => a + b, 0) / dayCounts[i].severity.length).toFixed(1) : "0",
      })),
      byHour: Object.entries(hourCounts).map(([hour, count]) => ({
        hour: `${hour}:00`,
        count,
        avgSeverity: hourSeverity[parseInt(hour)] ? (hourSeverity[parseInt(hour)].total / hourSeverity[parseInt(hour)].count).toFixed(1) : "0",
      })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour)),
      weeklyTrend: weeklyFlares,
      monthlyTrend: Object.entries(monthlyFlares).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([month, count]) => ({ month, count })),
      medications: Object.entries(medStats).map(([name, data]) => ({
        name,
        timesLogged: data.times,
        flaresWithin24h: data.flaresAfter,
        avgFlaresPerDose: data.times > 0 ? (data.flaresAfter / data.times).toFixed(1) : "0",
      })),
      correlations: correlations.slice(0, 12).map((c: any) => ({
        trigger: c.trigger_value,
        outcome: c.outcome_value,
        confidence: Math.round((c.confidence || 0) * 100),
        occurrences: c.occurrence_count,
      })),
      profile: {
        conditions: profile?.conditions || [],
        knownSymptoms: profile?.known_symptoms || [],
        knownTriggers: profile?.known_triggers || [],
      },
      engagement: {
        streak: engagement?.current_streak || 0,
        longestStreak: engagement?.longest_streak || 0,
        totalLogs: engagement?.total_logs || 0,
      },
    };

    const systemPrompt = `You are Jvala's AI Health Assistant - the smart companion built into the Jvala health tracking app. You know EVERYTHING about this app and the user's health data.

═══════════════════════════════════════════════════════════════════════════════
JVALA APP KNOWLEDGE - YOU ARE PART OF THIS APP
═══════════════════════════════════════════════════════════════════════════════

Jvala is a flare-tracking app for people with chronic conditions. YOU are the AI assistant built into it. Here's what exists in the app:

**MAIN FEATURES (accessible from bottom navigation):**
- 🏠 Home: Quick logging, streak tracking, recent entries
- 📊 Insights: Analytics, charts, patterns, correlations
- 📅 History: Calendar view of all logged entries
- 👤 Profile: Settings, integrations, medications, reminders

**LOGGING FEATURES:**
- Quick Log: One-tap severity logging (mild/moderate/severe)
- Detailed Entry: Symptoms, triggers, medications, photos, voice notes
- Voice Recording: Speak entries and they're transcribed
- Photo Capture: Add photos to entries

**PROFILE & SETTINGS (accessible via Profile tab):**
- Personal Info: Name, conditions, known symptoms/triggers
- Medications: Add/manage current medications
- Wearables: Connect Fitbit, Apple Health, Google Fit
  → Navigation: Profile tab → scroll down to "Connected Devices" or "Wearable Integration"
- Reminders: Set daily logging reminders
- Physician Access: Share data with doctors
- Export Data: Medical reports in PDF, FHIR, MedDRA formats

**INTEGRATIONS (in Profile tab):**
- Fitbit: Profile → Wearable Integration → Connect Fitbit
- Terra/Oura: Profile → Wearable Integration → Connect via Terra
- Apple Health / Google Fit: Profile → Wearable Integration section

**NAVIGATION INSTRUCTIONS:**
When users ask "how do I...", give SPECIFIC navigation:
- Connect fitness tracker: "Go to Profile (bottom right) → scroll to Wearable Integration → tap Connect Fitbit"
- Add medication: "Go to Profile → tap Medications → Add Medication"
- Export data: "Go to Insights → Export Reports"
- Set reminders: "Go to Profile → Reminder Settings"
- View history: "Tap History in the bottom nav"
- Log a flare: "Tap the + button or use Quick Log on Home"

═══════════════════════════════════════════════════════════════════════════════
YOUR PERSONALITY & RESPONSE STYLE
═══════════════════════════════════════════════════════════════════════════════
- You ARE Jvala's assistant - speak with confidence about the app
- NEVER say "I don't have access" - you have ALL their data AND know the app inside-out
- Conversational and warm, like texting a smart friend who knows the app
- SHORT responses: 1-3 sentences max. Be helpful and direct.
- For "how do I" questions: Give the exact navigation path
- For data questions: Lead with insight, show a chart

═══════════════════════════════════════════════════════════════════════════════
CHART TYPES YOU CAN CREATE (pick the BEST one for data questions)
═══════════════════════════════════════════════════════════════════════════════

1. BAR CHARTS (use for rankings, comparisons)
   - "bar_chart" or "horizontal_bar": Best for comparing things
   - Data: [{ label: "Headache", value: 45 }, { label: "Fatigue", value: 32 }]

2. PIE/DONUT (use for proportions, breakdowns)
   - "pie_chart" or "donut_chart": Best for showing parts of a whole
   - Data: [{ label: "Mild", value: 12 }, { label: "Moderate", value: 8 }, { label: "Severe", value: 3 }]

3. LINE/AREA (use for trends over time)
   - "line_chart" or "area_chart": Best for showing change over time
   - Data: [{ label: "Week 1", value: 5 }, { label: "Week 2", value: 8 }]

4. SCATTER PLOT (use for correlations between two variables)
   - "scatter_plot": Best for showing relationships
   - Data: [{ x: 45, y: 2.1, label: "Clear" }, { x: 78, y: 1.8, label: "Humid" }]
   - Config: { xAxis: "Temperature (°F)", yAxis: "Severity" }

5. HISTOGRAM (use for distributions)
   - "histogram": Best for showing frequency distributions
   - Data: [{ label: "0-2 hrs", value: 5 }, { label: "2-4 hrs", value: 12 }]

6. COMPARISON CARDS (use for before/after, this vs that)
   - "comparison": Best for simple A vs B comparisons
   - Data: [{ label: "This Month", value: 23, extra: "-15% from last month" }, { label: "Last Month", value: 27 }]

7. HEATMAP (use for patterns by day/hour)
   - "heatmap": Best for time patterns
   - Data: Array of 7 items for days, or grid data

8. PATTERN SUMMARY (use for key insights list)
   - "pattern_summary": Best for listing key findings
   - Data: [{ label: "Peak flare time", value: "3 PM", extra: "(15 flares)" }]

9. RADIAL/GAUGE (use for progress, goals)
   - "gauge": Best for showing progress toward a goal
   - Data: [{ label: "Streak", value: 7 }, { label: "Goal", value: 14 }]

10. LOCATION MAP (use for geographic questions, "where do I flare?")
   - "location_map": Shows flare locations on a map
   - Data: [{ label: "New York", value: 5, latitude: 40.7, longitude: -74.0, extra: "Mostly moderate" }]
   - Use when user asks about location patterns, "where", geographic trends, or city-based questions

11. WEATHER SUMMARY (use for weather-related questions)
   - "weather_chart": Shows weather condition correlations
   - Data: [{ label: "Rainy", value: 12, extra: "Avg severity: 2.3" }, { label: "Clear", value: 8, extra: "Avg severity: 1.5" }]
   - Use when user asks about weather patterns, temperature effects, or environmental correlations

═══════════════════════════════════════════════════════════════════════════════
WEATHER & LOCATION CAPABILITIES
═══════════════════════════════════════════════════════════════════════════════

You have FULL ACCESS to the user's weather and location data:
- Recent weather conditions during flares (temperature, humidity, condition)
- Which weather conditions correlate with more/worse flares
- Temperature ranges that trigger more flares
- Geographic locations where user has logged flares
- City-by-city breakdown of flare frequency and severity

When users ask about weather or location:
- USE the data in recentWeatherConditions, weather, temperature, locations, locationMapData
- SHOW a location_map or weather_chart visualization
- Be specific: "Your flares are 40% more likely on rainy days" not vague statements

═══════════════════════════════════════════════════════════════════════════════
RESPONSE STRATEGY
═══════════════════════════════════════════════════════════════════════════════

**For "how do I" questions:** Just give navigation. No chart needed.
Example: "How do I connect Fitbit?" → "Head to Profile → Wearable Integration → tap Connect Fitbit. It'll walk you through OAuth!"

**For data/insight questions:** Brief insight + chart
Example: "What triggers my flares?" → "Stress is your #1 trigger by far." + horizontal_bar chart

**For weather/location questions:** Use the weather or location data + appropriate chart
Example: "Where do I flare most?" → "Most of your flares happen in New York, and they tend to be more severe there." + location_map chart
Example: "Does weather affect me?" → "Rainy days are your worst - 40% more flares than clear days." + weather_chart

**For general questions about Jvala:** Explain the feature confidently.
Example: "What can you do?" → "I can analyze all your health data, spot patterns, and help you navigate the app. Try asking about your triggers or how you're trending!"

═══════════════════════════════════════════════════════════════════════════════
USER'S COMPLETE HEALTH DATA
═══════════════════════════════════════════════════════════════════════════════

${JSON.stringify(dataContext, null, 2)}

═══════════════════════════════════════════════════════════════════════════════
USER'S QUESTION: "${query}"
═══════════════════════════════════════════════════════════════════════════════

Give a helpful, confident response. Include navigation for "how to" questions. Create a chart ONLY for data questions. For weather/location questions, use location_map or weather_chart types.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "respond_with_visualization",
          description: "Respond with insight and a dynamic chart",
          parameters: {
            type: "object",
            required: ["response", "chart"],
            properties: {
              response: { 
                type: "string", 
                description: "Brief conversational insight (1-3 sentences). Let the chart do the heavy lifting." 
              },
              chart: {
                type: "object",
                description: "The visualization to display",
                required: ["type", "title", "data"],
                properties: {
                  type: { 
                    type: "string", 
                    enum: [
                      "bar_chart", "horizontal_bar", "stacked_bar",
                      "pie_chart", "donut_chart",
                      "line_chart", "area_chart", "stacked_area",
                      "scatter_plot", "histogram",
                      "comparison", "heatmap", "pattern_summary", "gauge",
                      "location_map", "weather_chart"
                    ],
                    description: "Chart type - pick the best one for the question. Use location_map for geographic/where questions, weather_chart for weather questions."
                  },
                  title: { 
                    type: "string", 
                    description: "Short chart title (3-5 words)" 
                  },
                  data: { 
                    type: "array", 
                    description: "Chart data points. For location_map: include latitude, longitude. For weather_chart: include weather conditions.",
                    items: { 
                      type: "object", 
                      properties: { 
                        label: { type: "string" }, 
                        value: { type: "number" },
                        x: { type: "number" },
                        y: { type: "number" },
                        latitude: { type: "number" },
                        longitude: { type: "number" },
                        extra: { type: "string" },
                        color: { type: "string" }
                      } 
                    } 
                  },
                  config: {
                    type: "object",
                    description: "Optional chart configuration",
                    properties: {
                      xAxis: { type: "string" },
                      yAxis: { type: "string" },
                    }
                  }
                },
              },
              dynamicFollowUps: {
                type: "array",
                items: { type: "string" },
                description: "2-3 short follow-up questions the user might ask next",
              },
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
        tool_choice: { type: "function", function: { name: "respond_with_visualization" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));
    
    // Extract tool call from Lovable AI response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        const result = {
          response: parsed.response,
          visualization: parsed.chart,
          dynamicFollowUps: parsed.dynamicFollowUps,
        };
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }
    }

    // Fallback to direct content
    const content = data.choices?.[0]?.message?.content;
    return new Response(JSON.stringify({ response: content || "I'm here to help analyze your health patterns." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
