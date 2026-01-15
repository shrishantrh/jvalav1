import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA AI INSIGHTS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
// Claude-powered deep analysis of user health data
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
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
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

    // Build context for Claude
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

    // Call Claude for analysis
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are a health insights analyst for Jvala, a flare tracking app. Analyze the user's health data and provide actionable insights.

Your response MUST be valid JSON with this exact structure:
{
  "summary": "2-3 sentence overview of their health patterns",
  "healthScore": 0-100 number based on their data,
  "trend": "improving" | "stable" | "worsening",
  "insights": [
    {
      "type": "pattern" | "trigger" | "recommendation" | "warning" | "success",
      "title": "Short insight title",
      "description": "2-3 sentence explanation",
      "confidence": "high" | "medium" | "low",
      "actionable": "Specific action they can take"
    }
  ],
  "predictions": [
    {
      "title": "What might happen",
      "likelihood": "high" | "medium" | "low",
      "basedOn": "Evidence for this prediction"
    }
  ],
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2",
    "Specific recommendation 3"
  ]
}

Guidelines:
- Be specific and personalized to their data
- Don't make medical diagnoses
- Focus on patterns they can act on
- If data is limited, say so honestly
- Highlight both problems AND progress
- Use encouraging language
- Maximum 5 insights, 3 predictions, 3 recommendations`,
        messages: [
          {
            role: 'user',
            content: `Analyze this user's health data and provide personalized insights:\n\n${dataContext}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error('AI analysis failed');
    }

    const aiResponse = await response.json();
    const content = aiResponse.content?.[0]?.text || '';

    // Parse JSON from response
    let insights;
    try {
      // Find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Return fallback insights
      insights = {
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
    }

    return new Response(JSON.stringify(insights), {
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
