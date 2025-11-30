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
    const { message, userSymptoms, userConditions, history } = await req.json();
    const apiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('💬 Chat message:', message);

    const systemPrompt = `You are Jvala, a compassionate health assistant for chronic condition tracking. You help users:

1. LOG health entries by understanding their messages (pain, symptoms, medication, energy levels)
2. ANSWER questions about their health patterns, travel advice, triggers, etc.

USER CONTEXT:
- Known conditions: ${userConditions?.join(', ') || 'Not specified'}
- Known symptoms: ${userSymptoms?.join(', ') || 'Not specified'}

RESPONSE FORMAT:
Always respond with valid JSON containing:
{
  "response": "Your conversational response to the user",
  "shouldLog": true/false,
  "entryData": {
    "type": "flare|medication|trigger|recovery|energy|note",
    "severity": "mild|moderate|severe" (for flares),
    "energyLevel": "very-low|low|moderate|good|high" (for energy),
    "symptoms": ["symptom1", "symptom2"],
    "medications": ["med1"],
    "triggers": ["trigger1"]
  }
}

RULES:
- If user describes symptoms/pain → shouldLog: true, type: "flare", extract severity and symptoms
- If user mentions taking medication → shouldLog: true, type: "medication"  
- If user mentions feeling tired/exhausted → shouldLog: true, type: "energy"
- If user asks a question (weather, travel, patterns) → shouldLog: false, answer helpfully
- If user says "traveling to [place]" → shouldLog: false, give relevant health advice for that location
- Be warm, supportive, and concise (1-2 sentences max for response)
- For logged entries, confirm what was logged

SEVERITY GUIDE:
- mild: Minor discomfort, can continue activities
- moderate: Noticeable impact, may need to slow down  
- severe: Significant impairment, may need rest/intervention`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('📤 AI response:', data);
    
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      // Try to parse as JSON
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Parsed response:', parsed);
          
          return new Response(JSON.stringify({
            response: parsed.response || "Got it!",
            shouldLog: parsed.shouldLog || false,
            entryData: parsed.entryData || null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (parseError) {
        console.log('Could not parse as JSON, returning raw response');
      }
      
      // Return raw response if not JSON
      return new Response(JSON.stringify({
        response: content,
        shouldLog: false,
        entryData: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      response: "I'm having trouble understanding. Could you rephrase that?",
      shouldLog: false,
      entryData: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
