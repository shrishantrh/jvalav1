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
    const body = await req.json();
    const { conditions, biologicalSex, age, entries, correlations } = body;

    // ─── Condition Research Mode (onboarding) ───
    if (conditions && Array.isArray(conditions) && conditions.length > 0 && !entries) {
      return await handleConditionResearch(conditions, biologicalSex, age);
    }

    // ─── AI Predictions Mode ───
    if (correlations && entries) {
      return await handlePredictions(entries, conditions, correlations);
    }

    // ─── Legacy Suggestions Mode ───
    if (entries) {
      return await handleLegacySuggestions(entries);
    }

    return new Response(
      JSON.stringify({ success: true, suggestions: [], symptoms: [], triggers: [], logCategories: [] }),
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

// ─── Condition Research: AI generates condition-specific symptoms, triggers, and UI categories ───
async function handleConditionResearch(conditions: string[], biologicalSex?: string, age?: number) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    // Fallback without AI
    console.warn('LOVABLE_API_KEY not set, returning empty suggestions');
    return new Response(
      JSON.stringify({ success: true, symptoms: [], triggers: [], logCategories: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const conditionList = conditions.join(', ');
  const demographicContext = [
    biologicalSex ? `Biological sex: ${biologicalSex}` : '',
    age ? `Age: ${age}` : '',
  ].filter(Boolean).join('. ');

  const prompt = `You are a clinical health researcher. A patient is setting up a health tracking app for these conditions: ${conditionList}.
${demographicContext ? `Patient demographics: ${demographicContext}.` : ''}

Research these conditions thoroughly — whether they are common chronic diseases, skin conditions, mental health, rare diseases, or even custom/non-standard health concerns. For ANY condition, use your medical knowledge to provide:

1. **symptoms**: The 8-15 most clinically relevant symptoms or manifestations a patient would want to track daily. Use patient-friendly language. For skin conditions, include things like "Breakout", "Redness", "Scarring". For pain conditions, include pain locations. Be SPECIFIC to the actual conditions, not generic.

2. **triggers**: The 8-12 most evidence-based triggers or aggravating factors for these specific conditions. Include dietary, environmental, hormonal, lifestyle, and stress-related triggers backed by research. Be SPECIFIC — e.g., for acne include "Dairy intake", "High-glycemic foods", "Touching face", "Hormonal changes".

3. **logCategories**: 2-4 custom quick-log button categories that replace generic "Flare" terminology with condition-appropriate terms. Each category should have:
   - "id": unique snake_case identifier
   - "label": what the button says (e.g., "Breakout" for acne, "Episode" for anxiety, "Flare" for RA)
   - "icon": one of: "flame", "zap", "heart", "activity", "alert", "sun", "moon", "droplets", "thermometer", "eye", "brain", "shield"
   - "severityLabels": custom severity labels that make sense (e.g., for acne: ["Few spots", "Moderate breakout", "Severe breakout"])
   - "color": a CSS color in HSL format for the button accent

Return ONLY valid JSON with this exact structure:
{
  "symptoms": ["symptom1", "symptom2", ...],
  "triggers": ["trigger1", "trigger2", ...],
  "logCategories": [
    {
      "id": "breakout",
      "label": "Breakout",
      "icon": "flame",
      "severityLabels": ["Minor", "Moderate", "Severe"],
      "color": "hsl(0 70% 50%)"
    }
  ]
}`;

  console.log(`Researching conditions: ${conditionList}`);

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', response.status, errorText);
    return new Response(
      JSON.stringify({ success: true, symptoms: [], triggers: [], logCategories: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;

  if (!content) {
    console.error('No content in AI response');
    return new Response(
      JSON.stringify({ success: true, symptoms: [], triggers: [], logCategories: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const parsed = JSON.parse(content);
    console.log(`Research complete: ${parsed.symptoms?.length || 0} symptoms, ${parsed.triggers?.length || 0} triggers, ${parsed.logCategories?.length || 0} categories`);

    return new Response(
      JSON.stringify({
        success: true,
        symptoms: parsed.symptoms || [],
        triggers: parsed.triggers || [],
        logCategories: parsed.logCategories || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Failed to parse AI response:', e, content);
    return new Response(
      JSON.stringify({ success: true, symptoms: [], triggers: [], logCategories: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Predictions Mode ───
async function handlePredictions(entries: any[], userConditions: string[], correlations: any[]) {
  if (!entries || entries.length < 5) {
    return new Response(
      JSON.stringify({ error: 'At least 5 entries required for predictions' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const flares = entries.filter((e: any) => e.type === 'flare');
  const recentFlares = flares.slice(0, 10);
  
  const symptomFrequency: Record<string, number> = {};
  const triggerFrequency: Record<string, number> = {};
  const timePatterns: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  
  flares.forEach((f: any) => {
    f.symptoms?.forEach((s: string) => { symptomFrequency[s] = (symptomFrequency[s] || 0) + 1; });
    f.triggers?.forEach((t: string) => { triggerFrequency[t] = (triggerFrequency[t] || 0) + 1; });
    const hour = new Date(f.timestamp).getHours();
    if (hour >= 6 && hour < 12) timePatterns.morning++;
    else if (hour >= 12 && hour < 18) timePatterns.afternoon++;
    else if (hour >= 18 && hour < 22) timePatterns.evening++;
    else timePatterns.night++;
  });

  const topSymptoms = Object.entries(symptomFrequency).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, c]) => `${s} (${c}x)`);
  const topTriggers = Object.entries(triggerFrequency).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, c]) => `${t} (${c}x)`);
  const peakTime = Object.entries(timePatterns).sort((a, b) => b[1] - a[1])[0];

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: `You are a health pattern analyst. Return JSON: { "predictions": [{ "type": "risk"|"insight", "title": "...", "description": "...", "confidence": 0.0-1.0 }] }. Generate 3-5 predictions.` },
        { role: 'user', content: `Conditions: ${userConditions?.join(', ') || 'Not specified'}. Total entries: ${entries.length}. Flares: ${flares.length}. Recent severities: ${recentFlares.map((f: any) => f.severity).join(', ')}. Top symptoms: ${topSymptoms.join(', ')}. Top triggers: ${topTriggers.join(', ')}. Peak time: ${peakTime[0]} (${peakTime[1]}). ${correlations?.length ? `Correlations: ${correlations.map((c: any) => `${c.factor}: ${c.description}`).join('; ')}` : ''}` }
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (response.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    throw new Error(`AI API error: ${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content');
  const parsed = JSON.parse(content);
  return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Legacy Suggestions ───
async function handleLegacySuggestions(entries: any[]) {
  if (!entries || entries.length === 0) {
    return new Response(JSON.stringify({ success: true, suggestions: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ success: true, suggestions: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const recentEntries = entries.slice(0, 10);

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: `Based on recent health entries, suggest 3 quick actions. Return JSON: { "suggestions": ["...", "...", "..."] }. Recent: ${JSON.stringify(recentEntries.map((e: any) => ({ type: e.type, severity: e.severity, timestamp: e.timestamp })))}` }
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) return new Response(JSON.stringify({ success: true, suggestions: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  if (content) {
    try {
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify({ success: true, suggestions: parsed.suggestions || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e) { /* fall through */ }
  }

  return new Response(JSON.stringify({ success: true, suggestions: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
