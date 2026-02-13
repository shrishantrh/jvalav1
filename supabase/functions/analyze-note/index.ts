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
    const apiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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
          {
            role: 'system',
            content: `You are a medical symptom classifier. Analyze health notes and extract structured data. Be liberal in interpreting health complaints as flares.

Classification Rules:
- Any pain, symptom, or health complaint = "flare"
- Taking medication/pills = "medication"
- Feeling tired/exhausted/low energy = "energy"
- Feeling better/recovering = "recovery"
- Potential causes (food, weather, stress) = "trigger"`
          },
          {
            role: 'user',
            content: `Analyze this health note: "${note}"`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'classify_note',
            description: 'Classify a health note into structured data',
            parameters: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['flare', 'medication', 'trigger', 'recovery', 'energy', 'note'],
                  description: 'The type of health entry'
                },
                severity: {
                  type: 'string',
                  enum: ['mild', 'moderate', 'severe'],
                  description: 'Severity level if applicable'
                },
                energyLevel: {
                  type: 'string',
                  enum: ['very-low', 'low', 'moderate', 'good', 'high'],
                  description: 'Energy level if mentioned'
                },
                symptoms: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of symptoms mentioned'
                },
                medications: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of medications mentioned'
                },
                triggers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of potential triggers mentioned'
                }
              },
              required: ['type']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'classify_note' } }
      })
    });

    const aiLatency = Math.round(performance.now() - aiStart);
    if (!response.ok) {
      console.error('❌ Lovable AI request failed:', response.status);
      console.info(`[ai-observability] ${JSON.stringify({ function: 'analyze-note', model: 'google/gemini-2.5-flash', tokensIn: 0, tokensOut: 0, latencyMs: aiLatency, status: response.status === 429 ? 'rate_limited' : response.status === 402 ? 'credits_exhausted' : 'error' })}`);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const usage = data.usage;
    console.info(`[ai-observability] ${JSON.stringify({ function: 'analyze-note', model: 'google/gemini-2.5-flash', tokensIn: usage?.prompt_tokens || 0, tokensOut: usage?.completion_tokens || 0, latencyMs: aiLatency, status: 'success' })}`);
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
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
      } catch (e) {
        console.error('Failed to parse tool arguments:', e);
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
