import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA LIMITLESS AI - Can do ANYTHING health-related
// ═══════════════════════════════════════════════════════════════════════════════
// This AI can:
// - Generate any visualization on the fly
// - Answer any health pattern question
// - Create custom analyses
// - Generate reports
// - Provide personalized recommendations
// - Handle edge cases dynamically
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

interface AIResponse {
  response: string;
  visualization?: {
    type: string;
    title: string;
    data: any[];
    config?: Record<string, any>;
  };
  action?: {
    type: string;
    data: any;
  };
  followUp?: string;
}

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

    // Fetch comprehensive user data
    const [entriesRes, profileRes, correlationsRes, medsRes, engagementRes] = await Promise.all([
      supabase.from("flare_entries").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(500),
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("correlations").select("*").eq("user_id", userId).order("confidence", { ascending: false }),
      supabase.from("medication_logs").select("*").eq("user_id", userId).order("taken_at", { ascending: false }).limit(200),
      supabase.from("engagement").select("*").eq("user_id", userId).single(),
    ]);

    const entries = entriesRes.data || [];
    const profile = profileRes.data;
    const correlations = correlationsRes.data || [];
    const medications = medsRes.data || [];
    const engagement = engagementRes.data;

    // Build comprehensive data summary
    const flares = entries.filter((e: any) => e.entry_type === "flare");
    const now = Date.now();
    const oneDay = 86400000;
    const oneWeek = 7 * oneDay;

    // Calculate all statistics
    const stats = {
      total: flares.length,
      thisWeek: flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneWeek).length,
      thisMonth: flares.filter((e: any) => now - new Date(e.timestamp).getTime() < 30 * oneDay).length,
      avgSeverity: flares.length > 0 
        ? flares.reduce((acc: number, e: any) => {
            const sev = e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : e.severity === "severe" ? 3 : 0;
            return acc + sev;
          }, 0) / flares.length
        : 0,
      daysSinceLast: flares.length > 0 
        ? Math.floor((now - new Date(flares[0].timestamp).getTime()) / oneDay)
        : null,
    };

    // Symptom frequency
    const symptomCounts: Record<string, number> = {};
    flares.forEach((e: any) => {
      (e.symptoms || []).forEach((s: string) => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    });
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Trigger frequency
    const triggerCounts: Record<string, number> = {};
    flares.forEach((e: any) => {
      (e.triggers || []).forEach((t: string) => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });
    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Time patterns
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};
    flares.forEach((e: any) => {
      const d = new Date(e.timestamp);
      hourCounts[d.getHours()] = (hourCounts[d.getHours()] || 0) + 1;
      dayCounts[d.getDay()] = (dayCounts[d.getDay()] || 0) + 1;
    });

    // Weather correlations
    const weatherCounts: Record<string, { count: number; severities: number[] }> = {};
    flares.forEach((e: any) => {
      const condition = e.environmental_data?.weather?.condition;
      if (condition) {
        if (!weatherCounts[condition]) weatherCounts[condition] = { count: 0, severities: [] };
        weatherCounts[condition].count++;
        const sev = e.severity === "mild" ? 1 : e.severity === "moderate" ? 2 : 3;
        weatherCounts[condition].severities.push(sev);
      }
    });

    // Sleep correlation
    const sleepData = entries.filter((e: any) => e.physiological_data?.sleep);
    const sleepBeforeFlares = flares
      .filter((e: any) => e.physiological_data?.sleep)
      .map((e: any) => {
        const d = e.physiological_data.sleep.duration;
        return d > 24 ? d / 60 : d;
      });
    const avgSleepBeforeFlares = sleepBeforeFlares.length > 0
      ? sleepBeforeFlares.reduce((a: number, b: number) => a + b, 0) / sleepBeforeFlares.length
      : null;

    // Build the mega prompt
    const systemPrompt = `You are Jvala's LIMITLESS AI - you can answer ANY health question, generate ANY visualization, and handle ANY edge case.

═══════════════════════════════════════════════════════════════════════════════
USER DATA (use this to answer questions)
═══════════════════════════════════════════════════════════════════════════════

CONDITIONS: ${(profile?.conditions || []).join(", ") || "Not specified"}
KNOWN SYMPTOMS: ${(profile?.known_symptoms || []).join(", ") || "AI will learn"}
KNOWN TRIGGERS: ${(profile?.known_triggers || []).join(", ") || "AI will learn"}

FLARE STATS:
- Total flares: ${stats.total}
- This week: ${stats.thisWeek}
- This month: ${stats.thisMonth}
- Average severity: ${stats.avgSeverity.toFixed(1)}/3.0
- Days since last: ${stats.daysSinceLast ?? "N/A"}

TOP SYMPTOMS: ${topSymptoms.map(([s, c]) => `${s} (${c}x)`).join(", ") || "None yet"}
TOP TRIGGERS: ${topTriggers.map(([t, c]) => `${t} (${c}x)`).join(", ") || "None yet"}

TIME PATTERNS:
- By hour: ${Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, c]) => `${h}:00 (${c}x)`).join(", ") || "N/A"}
- By day: ${Object.entries(dayCounts).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][parseInt(d)]} (${c}x)`).join(", ") || "N/A"}

WEATHER: ${Object.entries(weatherCounts).slice(0, 5).map(([w, d]) => `${w} (${d.count}x)`).join(", ") || "N/A"}

LEARNED CORRELATIONS:
${correlations.slice(0, 10).map((c: any) => `- ${c.trigger_value} → ${c.outcome_value} (${Math.round((c.confidence || 0) * 100)}% confidence, ${c.occurrence_count}x)`).join("\n") || "Still learning..."}

SLEEP PATTERN: ${avgSleepBeforeFlares ? `Avg ${avgSleepBeforeFlares.toFixed(1)}h before flares` : "No sleep data yet"}

MEDICATIONS: ${medications.slice(0, 5).map((m: any) => m.medication_name).join(", ") || "None logged"}

ENGAGEMENT:
- Current streak: ${engagement?.current_streak || 0} days
- Total logs: ${engagement?.total_logs || 0}
- Badges: ${(engagement?.badges || []).join(", ") || "None yet"}

RECENT ENTRIES (last 20):
${entries.slice(0, 20).map((e: any) => {
  const d = new Date(e.timestamp);
  const symptoms = (e.symptoms || []).join(", ");
  const triggers = (e.triggers || []).join(", ");
  return `[${d.toLocaleDateString()} ${d.toLocaleTimeString()}] ${e.entry_type}${e.severity ? ` (${e.severity})` : ""}${symptoms ? ` - ${symptoms}` : ""}${triggers ? ` | Triggers: ${triggers}` : ""}${e.note ? ` | "${e.note.slice(0, 50)}"` : ""}`;
}).join("\n")}

═══════════════════════════════════════════════════════════════════════════════
YOUR CAPABILITIES
═══════════════════════════════════════════════════════════════════════════════

You can do ANYTHING:
1. Generate ANY visualization (use the visualization tool)
2. Answer ANY health pattern question with data
3. Create custom analyses on the fly
4. Generate personalized recommendations
5. Find hidden patterns no one asked about
6. Predict future risks
7. Compare time periods
8. Analyze medication effectiveness
9. Find trigger-symptom correlations
10. Handle edge cases dynamically

VISUALIZATION TYPES YOU CAN GENERATE:
- timeline: Show flares over time
- bar_chart: Compare categories
- pie_chart: Show distribution
- line_chart: Trends over time
- heatmap: Hour x Day patterns
- scatter: Correlation plots
- comparison: Before/after analysis
- severity_breakdown: Mild/moderate/severe
- symptom_frequency: Top symptoms
- trigger_frequency: Top triggers
- weather_correlation: Weather impact
- sleep_correlation: Sleep impact
- medication_timeline: Med effectiveness
- calendar_heatmap: Activity by date
- risk_gauge: Current risk level
- pattern_summary: Key insights

═══════════════════════════════════════════════════════════════════════════════
RESPONSE GUIDELINES
═══════════════════════════════════════════════════════════════════════════════

1. Be specific - use actual numbers from the data
2. Be empathetic - acknowledge their experience
3. Be actionable - give concrete next steps
4. Be proactive - mention patterns they didn't ask about if relevant
5. Generate visualizations when they'd help understanding
6. Never say you can't do something - figure it out dynamically

USER QUERY: "${query}"

Respond with insights based on their data. Include a visualization if it would help.`;

    // Define the comprehensive tool
    const tools = [
      {
        type: "function",
        function: {
          name: "respond_with_insight",
          description: "Respond to the user with insights, optionally including a visualization",
          parameters: {
            type: "object",
            additionalProperties: false,
            required: ["response"],
            properties: {
              response: {
                type: "string",
                description: "Your response to the user with data-backed insights",
              },
              visualization: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["type", "title", "data"],
                    properties: {
                      type: {
                        type: "string",
                        enum: ["timeline", "bar_chart", "pie_chart", "line_chart", "heatmap", "scatter", "comparison", "severity_breakdown", "symptom_frequency", "trigger_frequency", "weather_correlation", "sleep_correlation", "medication_timeline", "calendar_heatmap", "risk_gauge", "pattern_summary"],
                      },
                      title: { type: "string" },
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: { type: "string" },
                            value: { type: "number" },
                            category: { type: "string" },
                            date: { type: "string" },
                            extra: { type: "string" },
                          },
                        },
                      },
                      config: {
                        type: "object",
                        properties: {
                          xAxis: { type: "string" },
                          yAxis: { type: "string" },
                          colors: { type: "array", items: { type: "string" } },
                          showLegend: { type: "boolean" },
                        },
                      },
                    },
                  },
                ],
              },
              action: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: { type: "string", enum: ["log_entry", "set_reminder", "export_data", "connect_wearable", "schedule_check"] },
                      data: { type: "object" },
                    },
                  },
                ],
              },
              followUp: {
                type: "string",
                description: "A follow-up question to deepen the conversation",
              },
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
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolArgs = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;

    if (toolArgs) {
      try {
        const parsed = JSON.parse(toolArgs);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    // Fallback
    const content = data.choices?.[0]?.message?.content || "I'm here to help with your health patterns.";
    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Limitless AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
