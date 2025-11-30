import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlareEntry {
  severity: string;
  symptoms: string[];
  triggers: string[];
  note: string;
  timestamp: string;
  environmental_data?: {
    weather?: { condition: string; temperature: number; humidity: number };
    airQuality?: { pollen: number; aqi: number };
    location?: { city: string };
  };
}

interface UserContext {
  conditions: string[];
  knownSymptoms: string[];
  knownTriggers: string[];
  recentEntries: FlareEntry[];
}

// Helper to get weather for a destination
async function getDestinationWeather(city: string): Promise<any> {
  const apiKey = Deno.env.get('WEATHER_API_KEY');
  if (!apiKey) return null;
  
  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(city)}&days=3&aqi=yes`
    );
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('Weather fetch error:', e);
    return null;
  }
}

// Analyze user's history for patterns
function analyzeUserHistory(entries: FlareEntry[], conditions: string[]) {
  if (entries.length === 0) return null;
  
  const last30Days = entries.slice(0, 50);
  
  // Find common triggers
  const triggerCounts: Record<string, number> = {};
  const symptomCounts: Record<string, number> = {};
  const weatherCounts: Record<string, number> = {};
  let severeSeverityCount = 0;
  let moderateCount = 0;
  
  last30Days.forEach(e => {
    if (e.severity === 'severe') severeSeverityCount++;
    if (e.severity === 'moderate') moderateCount++;
    
    e.triggers?.forEach(t => {
      triggerCounts[t] = (triggerCounts[t] || 0) + 1;
    });
    e.symptoms?.forEach(s => {
      symptomCounts[s] = (symptomCounts[s] || 0) + 1;
    });
    if (e.environmental_data?.weather?.condition) {
      weatherCounts[e.environmental_data.weather.condition] = 
        (weatherCounts[e.environmental_data.weather.condition] || 0) + 1;
    }
  });
  
  const topTriggers = Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
    
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
    
  const weatherTriggers = Object.entries(weatherCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([condition, count]) => ({ condition, count }));
  
  return {
    totalFlares: last30Days.length,
    severePercentage: Math.round((severeSeverityCount / last30Days.length) * 100),
    topTriggers,
    topSymptoms,
    weatherTriggers,
    conditions
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userContext, history } = await req.json() as {
      message: string;
      userContext: UserContext;
      history: Array<{ role: string; content: string }>;
    };
    
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    console.log('💬 Smart assistant message:', message);
    
    // Analyze the user's history
    const userAnalysis = analyzeUserHistory(userContext.recentEntries || [], userContext.conditions || []);
    
    // Check if user is asking about travel/destination
    let destinationWeather = null;
    const travelMatch = message.toLowerCase().match(/travel(?:ing|s)?\s+to\s+([a-zA-Z\s]+)/i) ||
                        message.toLowerCase().match(/going\s+to\s+([a-zA-Z\s]+)/i) ||
                        message.toLowerCase().match(/trip\s+to\s+([a-zA-Z\s]+)/i) ||
                        message.toLowerCase().match(/flying\s+to\s+([a-zA-Z\s]+)/i);
    
    if (travelMatch) {
      const destination = travelMatch[1].trim();
      console.log('🌍 Checking weather for:', destination);
      destinationWeather = await getDestinationWeather(destination);
    }
    
    // Build context-aware system prompt
    const systemPrompt = `You are Jvala, an intelligent health companion with REAL DATA about this specific user. You MUST use this data in your responses.

CRITICAL RULES:
- NEVER say generic advice like "listen to your body" or "stay hydrated"
- NEVER say "I'm a program" or anything robotic
- ONLY give advice that is BACKED BY THE USER'S DATA
- If you don't have enough data, say so honestly
- Keep responses SHORT (2-3 sentences max)
- Be warm but professional
- When mentioning data, cite it specifically (e.g., "Based on your 12 logged flares...")

USER'S HEALTH PROFILE:
- Conditions: ${userContext.conditions?.join(', ') || 'None specified'}
- Known symptoms: ${userContext.knownSymptoms?.join(', ') || 'None specified'}
- Known triggers: ${userContext.knownTriggers?.join(', ') || 'None specified'}

USER'S FLARE HISTORY (last 30 days):
${userAnalysis ? `
- Total flares logged: ${userAnalysis.totalFlares}
- Severe flares: ${userAnalysis.severePercentage}%
- Top triggers: ${userAnalysis.topTriggers.map(t => `${t.name} (${t.count}x)`).join(', ') || 'None identified yet'}
- Top symptoms: ${userAnalysis.topSymptoms.map(s => `${s.name} (${s.count}x)`).join(', ') || 'None identified yet'}
- Weather patterns: ${userAnalysis.weatherTriggers.map(w => `${w.condition} (${w.count}x)`).join(', ') || 'No pattern yet'}
` : 'No flare history yet - need more data to identify patterns.'}

${destinationWeather ? `
DESTINATION WEATHER DATA (user asked about travel):
City: ${destinationWeather.location?.name}, ${destinationWeather.location?.country}
Tomorrow's forecast:
- Condition: ${destinationWeather.forecast?.forecastday?.[1]?.day?.condition?.text || 'Unknown'}
- High: ${destinationWeather.forecast?.forecastday?.[1]?.day?.maxtemp_f || 'Unknown'}°F
- Humidity: ${destinationWeather.forecast?.forecastday?.[1]?.day?.avghumidity || 'Unknown'}%
- UV Index: ${destinationWeather.forecast?.forecastday?.[1]?.day?.uv || 'Unknown'}
- Air Quality (PM2.5): ${destinationWeather.forecast?.forecastday?.[1]?.day?.air_quality?.pm2_5?.toFixed(1) || 'Unknown'}

Use this REAL DATA to give specific advice about potential triggers based on the user's history.
` : ''}

RESPONSE FORMAT (MUST be valid JSON):
{
  "response": "Your data-backed response here",
  "isAIGenerated": true,
  "dataUsed": ["list", "of", "data", "sources", "used"],
  "shouldLog": true/false,
  "entryData": { ... } or null
}

EXAMPLES WITH REAL DATA:
User: "traveling to sfo tomorrow"
Response (if user has weather triggers): {"response": "SFO forecast shows partly cloudy with 65% humidity. Looking at your history, you've had 4 flares during cloudy conditions. I'd suggest having your medication ready and avoiding outdoor activities during peak humidity hours.", "isAIGenerated": true, "dataUsed": ["weather_forecast", "flare_history"], "shouldLog": false, "entryData": null}

User: "feeling dizzy"
Response: {"response": "Logged your dizziness. Based on your history, dizziness appeared in 6 of your 12 moderate-to-severe flares, often alongside fatigue. How's your energy level right now?", "isAIGenerated": true, "dataUsed": ["symptom_history"], "shouldLog": true, "entryData": {"type": "flare", "severity": "moderate", "symptoms": ["dizziness"]}}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-6),
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
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Smart response:', parsed);
          
          return new Response(JSON.stringify({
            response: parsed.response || "I need more data to help you with that.",
            isAIGenerated: true,
            dataUsed: parsed.dataUsed || [],
            shouldLog: parsed.shouldLog || false,
            entryData: parsed.entryData || null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (parseError) {
        console.log('Could not parse JSON, returning raw');
      }
      
      return new Response(JSON.stringify({
        response: content,
        isAIGenerated: true,
        dataUsed: [],
        shouldLog: false,
        entryData: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      response: "I couldn't process that. Could you try rephrasing?",
      isAIGenerated: true,
      dataUsed: [],
      shouldLog: false,
      entryData: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Smart assistant error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
