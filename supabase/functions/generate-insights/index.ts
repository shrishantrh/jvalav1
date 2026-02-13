import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entries } = await req.json();
    const apiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('🔍 Generating insights with AI...');
    console.log('📊 Entry count:', entries?.length || 0);

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ success: true, insights: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Analyze the actual data to prepare context for AI
    const flareEntries = entries.filter((e: any) => e.type === 'flare');
    const energyEntries = entries.filter((e: any) => e.type === 'energy');
    
    // Extract symptom frequencies
    const symptomCounts: { [key: string]: number } = {};
    flareEntries.forEach((e: any) => {
      e.symptoms?.forEach((s: string) => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    });
    
    // Time pattern analysis
    const hourCounts = new Array(24).fill(0);
    flareEntries.forEach((e: any) => {
      const hour = new Date(e.timestamp).getHours();
      hourCounts[hour]++;
    });
    
    // Environmental correlations
    const envDataPoints = entries
      .filter((e: any) => e.environmentalData?.weather)
      .map((e: any) => ({
        temperature: e.environmentalData.weather.temperature,
        humidity: e.environmentalData.weather.humidity,
        pressure: e.environmentalData.weather.pressure,
        pollen: e.environmentalData.airQuality?.pollen,
        hadFlare: e.type === 'flare' && e.severity !== 'none'
      }));
    
    // Physiological correlations
    const physioDataPoints = entries
      .filter((e: any) => e.physiologicalData)
      .map((e: any) => ({
        heartRate: e.physiologicalData.heartRate,
        sleepHours: e.physiologicalData.sleepHours,
        stressLevel: e.physiologicalData.stressLevel,
        steps: e.physiologicalData.steps,
        hadFlare: e.type === 'flare' && e.severity !== 'none'
      }));

    const analysisContext = {
      totalEntries: entries.length,
      flareCount: flareEntries.length,
      topSymptoms: Object.entries(symptomCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([symptom, count]) => ({ symptom, count })),
      peakHours: hourCounts
        .map((count, hour) => ({ hour, count }))
        .filter(h => h.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      environmentalPatterns: envDataPoints.length > 5 ? {
        avgTempOnFlare: envDataPoints.filter((p: any) => p.hadFlare).reduce((sum: number, p: any) => sum + p.temperature, 0) / envDataPoints.filter((p: any) => p.hadFlare).length,
        avgTempNoFlare: envDataPoints.filter((p: any) => !p.hadFlare).reduce((sum: number, p: any) => sum + p.temperature, 0) / envDataPoints.filter((p: any) => !p.hadFlare).length,
        avgPollenOnFlare: envDataPoints.filter((p: any) => p.hadFlare && p.pollen).reduce((sum: number, p: any) => sum + (p.pollen || 0), 0) / envDataPoints.filter((p: any) => p.hadFlare && p.pollen).length,
      } : null,
      physiologicalPatterns: physioDataPoints.length > 5 ? {
        avgSleepOnFlare: physioDataPoints.filter((p: any) => p.hadFlare && p.sleepHours).reduce((sum: number, p: any) => sum + (p.sleepHours || 0), 0) / physioDataPoints.filter((p: any) => p.hadFlare && p.sleepHours).length,
        avgSleepNoFlare: physioDataPoints.filter((p: any) => !p.hadFlare && p.sleepHours).reduce((sum: number, p: any) => sum + (p.sleepHours || 0), 0) / physioDataPoints.filter((p: any) => !p.hadFlare && p.sleepHours).length,
        avgStressOnFlare: physioDataPoints.filter((p: any) => p.hadFlare && p.stressLevel).reduce((sum: number, p: any) => sum + (p.stressLevel || 0), 0) / physioDataPoints.filter((p: any) => p.hadFlare && p.stressLevel).length,
      } : null
    };

    const systemPrompt = `You are a medical data analyst specializing in chronic condition management. Analyze health tracking data to identify meaningful patterns and provide actionable insights.

Focus on:
1. Temporal patterns (specific times, days, or periods with higher symptom occurrence)
2. Environmental correlations (temperature, humidity, air quality impacts)
3. Physiological indicators (sleep quality, stress levels, activity patterns)
4. Symptom clustering and severity trends
5. Practical, evidence-based recommendations

Be specific with numbers and patterns. Avoid generic advice. Each insight should be actionable and based on the actual data provided.`;

    const userPrompt = `Analyze this health tracking data and generate 3-5 specific, actionable insights:

DATA SUMMARY:
- Total entries tracked: ${analysisContext.totalEntries}
- Flare episodes: ${analysisContext.flareCount}
- Most common symptoms: ${analysisContext.topSymptoms.map(s => `${s.symptom} (${s.count}x)`).join(', ')}
- Peak flare times: ${analysisContext.peakHours.map(h => `${h.hour}:00 (${h.count} occurrences)`).join(', ')}

${analysisContext.environmentalPatterns ? `
ENVIRONMENTAL CORRELATIONS:
- Average temperature during flares: ${analysisContext.environmentalPatterns.avgTempOnFlare.toFixed(1)}°C
- Average temperature without flares: ${analysisContext.environmentalPatterns.avgTempNoFlare.toFixed(1)}°C
- Average pollen during flares: ${analysisContext.environmentalPatterns.avgPollenOnFlare.toFixed(0)}
` : ''}

${analysisContext.physiologicalPatterns ? `
PHYSIOLOGICAL CORRELATIONS:
- Average sleep on flare days: ${analysisContext.physiologicalPatterns.avgSleepOnFlare.toFixed(1)} hours
- Average sleep on non-flare days: ${analysisContext.physiologicalPatterns.avgSleepNoFlare.toFixed(1)} hours
- Average stress during flares: ${analysisContext.physiologicalPatterns.avgStressOnFlare.toFixed(1)}/10
` : ''}

Generate insights that are:
- Specific to this data (not generic health advice)
- Actionable (user can do something about it)
- Evidence-based (cite the numbers from above)
- Medically appropriate (no diagnosis, focus on patterns)

Return ONLY a JSON array, no other text:`;

    const aiStart = performance.now();
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_insights',
            description: 'Generate health insights from tracking data',
            parameters: {
              type: 'object',
              properties: {
                insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['pattern', 'correlation', 'recommendation', 'warning']
                      },
                      title: {
                        type: 'string',
                        description: 'Clear, specific title (max 60 chars)'
                      },
                      description: {
                        type: 'string',
                        description: 'Detailed explanation with actionable advice'
                      },
                      confidence: {
                        type: 'number',
                        minimum: 0.5,
                        maximum: 0.95,
                        description: 'Confidence level based on data quantity and clarity'
                      }
                    },
                    required: ['type', 'title', 'description', 'confidence']
                  }
                }
              },
              required: ['insights']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_insights' } }
      })
    });

    const aiLatency = Math.round(performance.now() - aiStart);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI API request failed:', response.status, errorText);
      console.info(`[ai-observability] ${JSON.stringify({ function: 'generate-insights', model: 'google/gemini-2.5-flash', tokensIn: 0, tokensOut: 0, latencyMs: aiLatency, status: response.status === 429 ? 'rate_limited' : response.status === 402 ? 'credits_exhausted' : 'error' })}`);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI credits exhausted. Please add credits to continue.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const usage = data.usage;
    console.info(`[ai-observability] ${JSON.stringify({ function: 'generate-insights', model: 'google/gemini-2.5-flash', tokensIn: usage?.prompt_tokens || 0, tokensOut: usage?.completion_tokens || 0, latencyMs: aiLatency, status: 'success' })}`);
    console.log('📤 AI response received');
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      const insights = args.insights || [];
      
      console.log('✅ Generated insights:', insights.length);
      
      return new Response(JSON.stringify({
        success: true,
        insights: insights
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, insights: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Failed to generate insights:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
      insights: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});