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

    console.log('🔍 Generating insights with Gemini API...');
    console.log('📊 Entry count:', entries?.length || 0);

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ success: true, insights: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recentEntries = entries.slice(0, 20);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze these health tracking entries and generate actionable insights. Focus on patterns, correlations, and recommendations.

Entries data: ${JSON.stringify(recentEntries.map((e: any) => ({
  type: e.type,
  severity: e.severity,
  energyLevel: e.energyLevel,
  symptoms: e.symptoms,
  timestamp: e.timestamp,
  note: e.note?.substring(0, 100),
  environmentalData: e.environmentalData,
  physiologicalData: e.physiologicalData
})))}

Return a JSON array of insights in this exact format:
[
  {
    "type": "pattern|correlation|recommendation|warning",
    "title": "Short insight title",
    "description": "Detailed explanation with actionable advice",
    "confidence": 0.85
  }
]

Generate 3-5 insights focusing on:
1. Temporal patterns (time of day, day of week, seasonal)
2. Environmental correlations (weather, temperature, air quality)
3. Physiological patterns (sleep, stress, heart rate)
4. Severity trends and triggers
5. Actionable recommendations for improvement

Be specific, medical-appropriate, and helpful. Confidence should be 0.7-0.95.`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
        }
      })
    });

    if (!response.ok) {
      console.error('❌ Gemini API request failed:', response.status, response.statusText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('📤 Gemini insights response:', data);
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (content) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const insights = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed insights:', insights);
        
        return new Response(JSON.stringify({
          success: true,
          insights: Array.isArray(insights) ? insights : []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, insights: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Failed to generate insights:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
