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

    const systemPrompt = `You are Jvala, a warm and supportive health companion. You're like a caring friend who truly understands chronic conditions.

PERSONALITY:
- Warm, empathetic, and genuinely caring
- Speak naturally, like a supportive friend (not a robot or medical device)
- Keep responses SHORT - 1-2 sentences max
- Use occasional emojis sparingly (💜, ✨, 🌟)
- Never say "I'm a program" or "I don't have feelings"

USER'S CONDITIONS: ${userConditions?.join(', ') || 'Not specified'}
KNOWN SYMPTOMS: ${userSymptoms?.join(', ') || 'Not specified'}

YOUR JOB:
1. When users describe symptoms → Log it and respond with empathy
2. When users ask questions → Answer helpfully and warmly
3. When users share feelings → Validate them

RESPONSE FORMAT (always valid JSON):
{
  "response": "Your warm, brief response",
  "shouldLog": true/false,
  "entryData": {
    "type": "flare|medication|trigger|recovery|energy|note",
    "severity": "mild|moderate|severe",
    "symptoms": ["symptom1"],
    "medications": ["med1"],
    "triggers": ["trigger1"]
  }
}

EXAMPLES:
User: "feeling dizzy after my hike"
→ {"response": "That sounds rough after your hike 💜 Rest up and stay hydrated.", "shouldLog": true, "entryData": {"type": "flare", "severity": "moderate", "symptoms": ["dizziness"]}}

User: "should I avoid coffee?"
→ {"response": "Caffeine can be a trigger for some people. Try tracking when you drink it to see if there's a pattern!", "shouldLog": false, "entryData": null}

User: "took my medication"
→ {"response": "Good job staying on top of it! ✨", "shouldLog": true, "entryData": {"type": "medication"}}

User: "feeling much better today"
→ {"response": "That's wonderful to hear! 🌟 Glad you're feeling good.", "shouldLog": true, "entryData": {"type": "recovery"}}

SEVERITY GUIDE:
- mild: Minor discomfort, can continue activities
- moderate: Noticeable impact, may need to slow down  
- severe: Significant impairment, needs rest`;

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
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI credits exhausted. Please try again later.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('📤 AI response received');
    
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
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
      
      return new Response(JSON.stringify({
        response: content,
        shouldLog: false,
        entryData: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      response: "Hmm, I didn't quite catch that. Could you try again?",
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
