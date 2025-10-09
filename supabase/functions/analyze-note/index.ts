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
    const { note } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('🤖 Analyzing note with Gemini API:', note);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this health note and return ONLY valid JSON. Be liberal in interpreting health complaints as flares.

Note: "${note}"

Classification Rules:
- Any pain, symptom, or health complaint = "flare"
- Taking medication/pills = "medication"
- Feeling tired/exhausted/low energy = "energy"
- Feeling better/recovering = "recovery"
- Potential causes (food, weather, stress) = "trigger"

Return ONLY this JSON structure (no markdown, no explanation):
{
  "type": "flare|medication|trigger|recovery|energy|note",
  "severity": "mild|moderate|severe",
  "energyLevel": "very-low|low|moderate|good|high",
  "symptoms": ["headache", "joint pain"],
  "medications": ["medication name"],
  "triggers": ["trigger name"]
}

Examples:
"I have a headache" → {"type":"flare","severity":"moderate","symptoms":["headache"]}
"Headache is bad" → {"type":"flare","severity":"severe","symptoms":["headache"]}
"My joints hurt" → {"type":"flare","severity":"moderate","symptoms":["joint pain"]}
"Feeling tired" → {"type":"energy","energyLevel":"low"}
"Took ibuprofen" → {"type":"medication","medications":["ibuprofen"]}
"Feeling better" → {"type":"recovery"}

Return JSON now:`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000,
        }
      })
    });

    if (!response.ok) {
      console.error('❌ Gemini API request failed:', response.status, response.statusText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('📤 Gemini API response:', data);
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed AI result:', parsed);
        
        return new Response(JSON.stringify({
          success: true,
          result: {
            type: parsed.type,
            ...(parsed.severity && { severity: parsed.severity }),
            ...(parsed.energyLevel && { energyLevel: parsed.energyLevel }),
            ...(parsed.symptoms && { symptoms: parsed.symptoms }),
            ...(parsed.medications && { medications: parsed.medications }),
            ...(parsed.triggers && { triggers: parsed.triggers }),
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ success: false, result: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Failed to analyze note:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
