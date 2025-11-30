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
    const { entries, userConditions, correlations } = await req.json();

    // If no special params, use legacy suggestions mode
    if (!correlations) {
      return await handleLegacySuggestions(entries);
    }

    // New: AI Predictions mode
    if (!entries || entries.length < 5) {
      return new Response(
        JSON.stringify({ error: 'At least 5 entries required for predictions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Analyze patterns for the prompt
    const flares = entries.filter((e: any) => e.type === 'flare');
    const recentFlares = flares.slice(0, 10);
    
    const symptomFrequency: Record<string, number> = {};
    const triggerFrequency: Record<string, number> = {};
    const timePatterns: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    
    flares.forEach((f: any) => {
      f.symptoms?.forEach((s: string) => {
        symptomFrequency[s] = (symptomFrequency[s] || 0) + 1;
      });
      f.triggers?.forEach((t: string) => {
        triggerFrequency[t] = (triggerFrequency[t] || 0) + 1;
      });
      const hour = new Date(f.timestamp).getHours();
      if (hour >= 6 && hour < 12) timePatterns.morning++;
      else if (hour >= 12 && hour < 18) timePatterns.afternoon++;
      else if (hour >= 18 && hour < 22) timePatterns.evening++;
      else timePatterns.night++;
    });

    const topSymptoms = Object.entries(symptomFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s, c]) => `${s} (${c}x)`);
    
    const topTriggers = Object.entries(triggerFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, c]) => `${t} (${c}x)`);

    const peakTime = Object.entries(timePatterns)
      .sort((a, b) => b[1] - a[1])[0];

    const systemPrompt = `You are a health pattern analyst for chronic illness patients. Based on their tracking data, provide actionable predictions and insights. Be empathetic but direct. Focus on patterns that can help them prepare for or prevent flares.

Return JSON with this structure:
{
  "predictions": [
    {
      "type": "risk" | "insight",
      "title": "Short title",
      "description": "2-3 sentence explanation with actionable advice",
      "confidence": 0.0-1.0
    }
  ]
}

Generate 3-5 predictions.`;

    const userPrompt = `Patient data analysis:
- Conditions: ${userConditions?.join(', ') || 'Not specified'}
- Total entries: ${entries.length}
- Total flares: ${flares.length}
- Recent flare severities: ${recentFlares.map((f: any) => f.severity).join(', ')}

Top symptoms: ${topSymptoms.join(', ') || 'None recorded'}
Top triggers: ${topTriggers.join(', ') || 'None recorded'}
Peak flare time: ${peakTime[0]} (${peakTime[1]} flares)

${correlations?.length ? `Detected correlations:\n${correlations.map((c: any) => `- ${c.factor}: ${c.description}`).join('\n')}` : ''}

Based on this data, provide predictive insights about:
1. When they might be at higher risk for flares
2. Which symptoms tend to cluster together
3. Environmental or lifestyle factors to monitor
4. Preventive actions they could take`;

    console.log('Generating AI predictions...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limited, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    const parsed = JSON.parse(content);
    console.log('Generated predictions:', parsed.predictions?.length);

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Legacy function for simple suggestions
async function handleLegacySuggestions(entries: any[]) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  if (!entries || entries.length === 0) {
    return new Response(JSON.stringify({ success: true, suggestions: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const recentEntries = entries.slice(0, 10);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Based on recent health tracking entries, suggest 3 quick actions the user might want to track next. Be specific and practical.

Recent entries: ${JSON.stringify(recentEntries.map((e: any) => ({
  type: e.type,
  severity: e.severity,
  timestamp: e.timestamp,
  note: e.note?.substring(0, 50)
})))}

Return a JSON array of 3 short, actionable suggestions (max 30 chars each):
["Check energy level", "Log water intake", "Note sleep quality"]

Focus on:
- Missing data patterns
- Follow-up actions
- Preventive measures
- Recovery tracking`
        }]
      }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 200,
      }
    })
  });

  if (!response.ok) {
    throw new Error('API request failed');
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (content) {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const suggestions = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify({
        success: true,
        suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ success: true, suggestions: [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
