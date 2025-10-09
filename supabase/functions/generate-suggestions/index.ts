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
  } catch (error) {
    console.error('Failed to generate suggestions:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
