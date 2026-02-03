import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA AI INSIGHTS ENGINE - Powered by Lovable AI (Gemini)
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { userId, analysisType = 'comprehensive' } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all user data
    const [entriesResult, correlationsResult, profileResult, engagementResult] = await Promise.all([
      supabase
        .from('flare_entries')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(200),
      supabase
        .from('correlations')
        .select('*')
        .eq('user_id', userId)
        .order('confidence', { ascending: false })
        .limit(20),
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      supabase
        .from('engagement')
        .select('*')
        .eq('user_id', userId)
        .single(),
    ]);

    const entries = entriesResult.data || [];
    const correlations = correlationsResult.data || [];
    const profile = profileResult.data;
    const engagement = engagementResult.data;

    if (entries.length < 5) {
      return new Response(JSON.stringify({
        insights: [{
          type: 'info',
          title: 'Keep logging!',
          description: 'Log at least 5 entries to unlock AI insights.',
          confidence: 1,
        }],
        summary: 'Not enough data yet.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare data summary for AI
    const flares = entries.filter((e: any) => e.entry_type === 'flare');
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    const last7DaysFlares = flares.filter((f: any) => 
      now - new Date(f.timestamp).getTime() < oneWeek
    );
    const last30DaysFlares = flares.filter((f: any) => 
      now - new Date(f.timestamp).getTime() < oneMonth
    );

    // Calculate statistics
    const severityCounts = { mild: 0, moderate: 0, severe: 0 };
    const triggerCounts: Record<string, number> = {};
    const symptomCounts: Record<string, number> = {};
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};
    const weatherCounts: Record<string, number> = {};
    const medicationCounts: Record<string, number> = {};

    flares.forEach((f: any) => {
      if (f.severity) severityCounts[f.severity as keyof typeof severityCounts]++;
      
      f.triggers?.forEach((t: string) => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
      
      f.symptoms?.forEach((s: string) => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
      
      f.medications?.forEach((m: string) => {
        medicationCounts[m] = (medicationCounts[m] || 0) + 1;
      });

      const ts = new Date(f.timestamp);
      hourCounts[ts.getHours()] = (hourCounts[ts.getHours()] || 0) + 1;
      dayCounts[ts.getDay()] = (dayCounts[ts.getDay()] || 0) + 1;

      const weather = f.environmental_data?.weather?.condition;
      if (weather) {
        weatherCounts[weather] = (weatherCounts[weather] || 0) + 1;
      }
    });

    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const peakHour = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])[0];
    const peakDay = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])[0];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Build context for AI
    const dataContext = `
USER HEALTH DATA SUMMARY:
==========================

CONDITIONS: ${profile?.conditions?.join(', ') || 'Not specified'}
KNOWN TRIGGERS: ${profile?.known_triggers?.join(', ') || 'Not specified'}
TOTAL ENTRIES: ${entries.length}
TOTAL FLARES: ${flares.length}
CURRENT STREAK: ${engagement?.current_streak || 0} days

LAST 7 DAYS:
- Flares: ${last7DaysFlares.length}
- Severe: ${last7DaysFlares.filter((f: any) => f.severity === 'severe').length}
- Moderate: ${last7DaysFlares.filter((f: any) => f.severity === 'moderate').length}

LAST 30 DAYS:
- Flares: ${last30DaysFlares.length}
- Severity breakdown: ${JSON.stringify(severityCounts)}

TOP TRIGGERS (30 days):
${topTriggers.map(([t, c]) => `- ${t}: ${c} occurrences`).join('\n') || '- None identified yet'}

TOP SYMPTOMS (30 days):
${topSymptoms.map(([s, c]) => `- ${s}: ${c} occurrences`).join('\n') || '- None logged'}

PEAK FLARE TIME: ${peakHour ? `${peakHour[0]}:00 (${peakHour[1]} flares)` : 'Insufficient data'}
PEAK FLARE DAY: ${peakDay ? `${dayNames[parseInt(peakDay[0])]} (${peakDay[1]} flares)` : 'Insufficient data'}

WEATHER CORRELATIONS:
${Object.entries(weatherCounts).map(([w, c]) => `- ${w}: ${c} flares`).join('\n') || '- No weather data'}

MEDICATIONS DURING FLARES:
${Object.entries(medicationCounts).map(([m, c]) => `- ${m}: ${c} times`).join('\n') || '- No medications logged'}

LEARNED CORRELATIONS:
${correlations.slice(0, 10).map((c: any) => 
  `- ${c.trigger_value} → ${c.outcome_value} (${Math.round(c.confidence * 100)}% confidence, ${c.occurrence_count} times)`
).join('\n') || '- No strong correlations yet'}

RECENT NOTES (last 5 entries with notes):
${entries.filter((e: any) => e.note).slice(0, 5).map((e: any) => 
  `- "${e.note}" (${new Date(e.timestamp).toLocaleDateString()})`
).join('\n') || '- No notes'}
`;

    // Call Lovable AI for analysis
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are Jvala's AI Health Analyst - an expert in chronic condition pattern recognition. Analyze the user's flare tracking data and provide deeply personalized, actionable insights.

Your response MUST use the tool to return structured data with:
- summary: 2-3 sentence personalized overview
- healthScore: 0-100 based on flare frequency, severity trends, logging consistency
- trend: "improving" | "stable" | "worsening"
- insights: Array of specific insights with type, title, description, confidence, actionable
- predictions: What might happen next based on patterns
- recommendations: 3 specific actionable steps

CRITICAL GUIDELINES:
- Be SPECIFIC to their data - reference actual triggers, symptoms, times, patterns
- Calculate healthScore: Start at 75, -5 for each severe flare this week, -3 for moderate, +10 if improving trend
- Don't make medical diagnoses - focus on patterns and lifestyle factors
- Highlight BOTH problems AND progress
- Maximum 5 insights, 3 predictions, 3 recommendations
- For triggers, only mention ones with 2+ occurrences`,
          },
          {
            role: 'user',
            content: `Analyze this user's health data and provide personalized insights:\n\n${dataContext}`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_insights',
            description: 'Generate comprehensive health insights',
            parameters: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: '2-3 sentence personalized overview' },
                healthScore: { type: 'number', minimum: 0, maximum: 100 },
                trend: { type: 'string', enum: ['improving', 'stable', 'worsening'] },
                insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['pattern', 'trigger', 'recommendation', 'warning', 'success'] },
                      title: { type: 'string', description: 'Clear title max 8 words' },
                      description: { type: 'string', description: '2-3 sentence explanation with data' },
                      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                      actionable: { type: 'string', description: 'One specific action they can take' }
                    },
                    required: ['type', 'title', 'description', 'confidence', 'actionable']
                  }
                },
                predictions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      likelihood: { type: 'string', enum: ['high', 'medium', 'low'] },
                      basedOn: { type: 'string' }
                    },
                    required: ['title', 'likelihood', 'basedOn']
                  }
                },
                recommendations: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['summary', 'healthScore', 'trend', 'insights', 'predictions', 'recommendations']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_insights' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error('AI analysis failed');
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const insights = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(insights), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (parseError) {
        console.error('Failed to parse tool response:', parseError);
      }
    }

    // Fallback insights
    const fallbackInsights = {
      summary: 'Analysis complete. Keep logging for more detailed insights.',
      healthScore: 70,
      trend: 'stable',
      insights: [
        {
          type: 'pattern',
          title: `${last7DaysFlares.length} flares this week`,
          description: last7DaysFlares.length > last30DaysFlares.length / 4 
            ? 'Higher than average activity this week.'
            : 'Consistent with your usual patterns.',
          confidence: 'high',
          actionable: 'Continue logging to track trends.',
        },
      ],
      predictions: [],
      recommendations: ['Keep logging daily', 'Note any new triggers', 'Review your patterns weekly'],
    };

    return new Response(JSON.stringify(fallbackInsights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('❌ AI Insights error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
