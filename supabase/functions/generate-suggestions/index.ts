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

    return jsonResponse({ success: true, suggestions: [], symptoms: [], triggers: [], logCategories: [] });

  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Extract JSON from AI response that may contain markdown fences or extra text
function extractJSON(raw: string): any {
  // Try direct parse first
  try { return JSON.parse(raw); } catch {}

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // Find first { and last }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }

  return null;
}

// ─── Condition Research ───
async function handleConditionResearch(conditions: string[], biologicalSex?: string, age?: number) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.warn('LOVABLE_API_KEY not set');
    return jsonResponse({ success: true, symptoms: [], triggers: [], logCategories: [] });
  }

  const conditionList = conditions.join(', ');
  const demographicContext = [
    biologicalSex ? `Biological sex: ${biologicalSex}` : '',
    age ? `Age: ${age}` : '',
  ].filter(Boolean).join('. ');

  const prompt = `You are a clinical health researcher. A patient is setting up a health tracking app for these conditions: ${conditionList}.
${demographicContext ? `Patient demographics: ${demographicContext}.` : ''}

Research ALL of these conditions thoroughly. For ANY condition (common or rare, standard medical term or colloquial), use your medical knowledge to provide:

1. **symptoms**: 10-15 most clinically relevant symptoms across ALL the listed conditions combined. Use patient-friendly language. Be SPECIFIC to each condition.

2. **triggers**: 8-12 most evidence-based triggers across ALL conditions. Include dietary, environmental, hormonal, lifestyle triggers. Be SPECIFIC.

3. **logCategories**: One logging category PER condition. Each must have:
   - "id": unique snake_case identifier  
   - "label": condition-appropriate term (e.g., "Breakout" for acne, "Attack" for asthma, "Flare" for arthritis)
   - "icon": one of: "flame", "zap", "heart", "activity", "alert", "sun", "moon", "droplets", "thermometer", "eye", "brain", "shield"
   - "severityLabels": array of exactly 3 SHORT severity labels appropriate for that condition (e.g. ["Few spots", "Moderate breakout", "Severe cystic"])
   - "color": a CSS color in HSL format like "hsl(200 70% 50%)"
   - "symptoms": array of 4-8 symptoms SPECIFIC to this condition only (e.g. for acne: ["Forehead breakout", "Chin acne", "Oily skin", "Blackheads", "Cystic bumps"]; for asthma: ["Wheezing", "Chest tightness", "Shortness of breath", "Nighttime coughing"])

IMPORTANT: You MUST cover ALL conditions listed: ${conditionList}. Each logCategory MUST have its own specific symptoms array. Do not mix symptoms between conditions.

Respond with ONLY this JSON object, no other text:
{"symptoms":["..."],"triggers":["..."],"logCategories":[{"id":"...","label":"...","icon":"...","severityLabels":["...","...","..."],"color":"hsl(...)","symptoms":["...","...."]}]}`;

  console.log(`Researching conditions: ${conditionList}`);

  try {
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return jsonResponse({ success: true, symptoms: [], triggers: [], logCategories: [] });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return jsonResponse({ success: true, symptoms: [], triggers: [], logCategories: [] });
    }

    console.log('Raw AI response length:', content.length);

    const parsed = extractJSON(content);
    if (!parsed) {
      console.error('Failed to extract JSON from AI response. First 500 chars:', content.slice(0, 500));
      return jsonResponse({ success: true, symptoms: [], triggers: [], logCategories: [] });
    }

    const symptoms = Array.isArray(parsed.symptoms) ? parsed.symptoms : [];
    const triggers = Array.isArray(parsed.triggers) ? parsed.triggers : [];
    const logCategories = Array.isArray(parsed.logCategories) ? parsed.logCategories : [];

    console.log(`Research complete: ${symptoms.length} symptoms, ${triggers.length} triggers, ${logCategories.length} categories`);

    return jsonResponse({ success: true, symptoms, triggers, logCategories });
  } catch (e) {
    console.error('Condition research error:', e);
    return jsonResponse({ success: true, symptoms: [], triggers: [], logCategories: [] });
  }
}

// ─── Predictions Mode ───
async function handlePredictions(entries: any[], userConditions: string[], correlations: any[]) {
  if (!entries || entries.length < 5) {
    return jsonResponse({ error: 'At least 5 entries required for predictions' }, 400);
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
    }),
  });

  if (!response.ok) {
    if (response.status === 429) return jsonResponse({ error: 'Rate limited' }, 429);
    if (response.status === 402) return jsonResponse({ error: 'AI credits exhausted' }, 402);
    throw new Error(`AI API error: ${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content');
  const parsed = extractJSON(content);
  if (!parsed) throw new Error('Failed to parse predictions');
  return jsonResponse(parsed);
}

// ─── Legacy Suggestions ───
async function handleLegacySuggestions(entries: any[]) {
  if (!entries || entries.length === 0) {
    return jsonResponse({ success: true, suggestions: [] });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return jsonResponse({ success: true, suggestions: [] });
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
    }),
  });

  if (!response.ok) return jsonResponse({ success: true, suggestions: [] });

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  if (content) {
    const parsed = extractJSON(content);
    if (parsed?.suggestions) {
      return jsonResponse({ success: true, suggestions: parsed.suggestions });
    }
  }

  return jsonResponse({ success: true, suggestions: [] });
}
