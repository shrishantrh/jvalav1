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
  currentLocation?: { latitude: number; longitude: number; city?: string };
}

// Helper to get weather for a destination or current location
async function getWeather(query: string): Promise<any> {
  const apiKey = Deno.env.get('WEATHER_API_KEY');
  if (!apiKey) {
    console.log('No WEATHER_API_KEY configured');
    return null;
  }
  
  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(query)}&days=3&aqi=yes`
    );
    if (!response.ok) {
      console.error('Weather API error:', response.status);
      return null;
    }
    return await response.json();
  } catch (e) {
    console.error('Weather fetch error:', e);
    return null;
  }
}

// Extract potential triggers from notes
function extractTriggersFromNotes(entries: FlareEntry[]): Record<string, { count: number; severities: string[] }> {
  const potentialTriggers: Record<string, { count: number; severities: string[] }> = {};
  
  const foodKeywords = ['ate', 'eat', 'eating', 'had', 'drank', 'drinking', 'after'];
  const triggerPatterns = [
    /ate\s+(\w+(?:\s+\w+)?)/gi,
    /had\s+(\w+(?:\s+\w+)?)/gi,
    /eating\s+(\w+(?:\s+\w+)?)/gi,
    /after\s+(\w+(?:\s+\w+)?)/gi,
    /from\s+(\w+(?:\s+\w+)?)/gi,
  ];
  
  entries.forEach(entry => {
    if (!entry.note) return;
    const note = entry.note.toLowerCase();
    
    triggerPatterns.forEach(pattern => {
      const matches = note.matchAll(pattern);
      for (const match of matches) {
        const trigger = match[1].trim();
        if (trigger.length > 2 && !['the', 'and', 'some', 'lot', 'bit'].includes(trigger)) {
          if (!potentialTriggers[trigger]) {
            potentialTriggers[trigger] = { count: 0, severities: [] };
          }
          potentialTriggers[trigger].count++;
          if (entry.severity) potentialTriggers[trigger].severities.push(entry.severity);
        }
      }
    });
    
    // Also count explicitly set triggers
    entry.triggers?.forEach(t => {
      const trigger = t.toLowerCase();
      if (!potentialTriggers[trigger]) {
        potentialTriggers[trigger] = { count: 0, severities: [] };
      }
      potentialTriggers[trigger].count++;
      if (entry.severity) potentialTriggers[trigger].severities.push(entry.severity);
    });
  });
  
  return potentialTriggers;
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
  
  // Extract triggers from notes too
  const noteTriggers = extractTriggersFromNotes(last30Days);
  Object.entries(noteTriggers).forEach(([trigger, data]) => {
    if (data.count >= 2) { // Only count if mentioned at least twice
      triggerCounts[trigger] = (triggerCounts[trigger] || 0) + data.count;
    }
  });
  
  const topTriggers = Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
    
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
    
  const weatherTriggers = Object.entries(weatherCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([condition, count]) => ({ condition, count }));
  
  // Time of day analysis
  const hourCounts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  last30Days.forEach(e => {
    const hour = new Date(e.timestamp).getHours();
    if (hour >= 6 && hour < 12) hourCounts.morning++;
    else if (hour >= 12 && hour < 18) hourCounts.afternoon++;
    else if (hour >= 18 && hour < 22) hourCounts.evening++;
    else hourCounts.night++;
  });
  
  const peakTime = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  
  return {
    totalFlares: last30Days.length,
    severePercentage: Math.round((severeSeverityCount / last30Days.length) * 100),
    topTriggers,
    topSymptoms,
    weatherTriggers,
    peakTime: peakTime[0],
    conditions
  };
}

// Detect if user is asking about weather/outdoor activities
function detectWeatherQuery(message: string): { needsWeather: boolean; destination?: string; isCurrentLocation: boolean } {
  const lowerMsg = message.toLowerCase();
  
  // Travel detection
  const travelMatch = lowerMsg.match(/travel(?:ing|s)?\s+to\s+([a-zA-Z\s]+)/i) ||
                      lowerMsg.match(/going\s+to\s+([a-zA-Z\s]+)/i) ||
                      lowerMsg.match(/trip\s+to\s+([a-zA-Z\s]+)/i) ||
                      lowerMsg.match(/flying\s+to\s+([a-zA-Z\s]+)/i) ||
                      lowerMsg.match(/visiting\s+([a-zA-Z\s]+)/i);
  
  if (travelMatch) {
    return { needsWeather: true, destination: travelMatch[1].trim(), isCurrentLocation: false };
  }
  
  // Current location weather queries
  const currentWeatherKeywords = [
    'run', 'running', 'jog', 'jogging', 'walk', 'walking', 'outside', 'outdoor',
    'weather', 'pollen', 'allergy', 'allergies', 'air quality', 'aqi',
    'exercise', 'workout', 'hiking', 'bike', 'cycling', 'today', 'now'
  ];
  
  if (currentWeatherKeywords.some(kw => lowerMsg.includes(kw))) {
    return { needsWeather: true, isCurrentLocation: true };
  }
  
  return { needsWeather: false, isCurrentLocation: false };
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
    console.log('📍 User conditions:', userContext.conditions);
    console.log('📍 User location:', userContext.currentLocation);
    
    // Analyze the user's history
    const userAnalysis = analyzeUserHistory(userContext.recentEntries || [], userContext.conditions || []);
    
    // Check if we need to fetch weather
    const weatherQuery = detectWeatherQuery(message);
    let weatherData = null;
    let weatherLocation = '';
    
    if (weatherQuery.needsWeather) {
      if (weatherQuery.destination) {
        console.log('🌍 Fetching weather for destination:', weatherQuery.destination);
        weatherData = await getWeather(weatherQuery.destination);
        weatherLocation = weatherQuery.destination;
      } else if (weatherQuery.isCurrentLocation && userContext.currentLocation) {
        const query = userContext.currentLocation.city || 
          `${userContext.currentLocation.latitude},${userContext.currentLocation.longitude}`;
        console.log('🌍 Fetching weather for current location:', query);
        weatherData = await getWeather(query);
        weatherLocation = userContext.currentLocation.city || 'your area';
      }
    }
    
    // Build weather info string
    let weatherInfo = '';
    if (weatherData) {
      const current = weatherData.current;
      const forecast = weatherData.forecast?.forecastday?.[0]?.day;
      const tomorrow = weatherData.forecast?.forecastday?.[1]?.day;
      const aqi = current?.air_quality;
      
      weatherInfo = `
REAL-TIME WEATHER DATA for ${weatherData.location?.name || weatherLocation}:
Current:
- Condition: ${current?.condition?.text || 'Unknown'}
- Temperature: ${current?.temp_f || 'Unknown'}°F (feels like ${current?.feelslike_f}°F)
- Humidity: ${current?.humidity || 'Unknown'}%
- UV Index: ${current?.uv || 'Unknown'}
- Air Quality (US EPA): ${aqi?.['us-epa-index'] || 'Unknown'} (1=Good, 6=Hazardous)
- PM2.5: ${aqi?.pm2_5?.toFixed(1) || 'Unknown'}
- Pollen (approximate based on season): ${current?.humidity > 50 && current?.temp_f > 50 ? 'Moderate-High' : 'Low-Moderate'}

Today's Forecast:
- High: ${forecast?.maxtemp_f || 'Unknown'}°F, Low: ${forecast?.mintemp_f || 'Unknown'}°F
- Condition: ${forecast?.condition?.text || 'Unknown'}
- Chance of rain: ${forecast?.daily_chance_of_rain || 0}%

Tomorrow's Forecast:
- Condition: ${tomorrow?.condition?.text || 'Unknown'}
- High: ${tomorrow?.maxtemp_f || 'Unknown'}°F
- Humidity: ${tomorrow?.avghumidity || 'Unknown'}%
- UV Index: ${tomorrow?.uv || 'Unknown'}

USE THIS DATA to give SPECIFIC advice. Compare to user's historical weather triggers.`;
    }
    
    // Build context-aware system prompt
    const systemPrompt = `You are Jvala, an intelligent health companion with REAL DATA about this specific user. You are warm, caring, and knowledgeable.

CRITICAL RULES:
- NEVER give generic advice like "listen to your body" or "stay hydrated" without backing it with data
- NEVER say "I don't have access to real-time data" - if weather data is provided, USE IT
- ONLY give advice that is BACKED BY USER'S DATA or REAL WEATHER DATA when provided
- If you genuinely lack data, be honest but offer to help in other ways
- Keep responses SHORT (2-3 sentences max)
- Be warm, personable, supportive - like a knowledgeable friend
- When citing data, be specific: "Your 12 logged flares show..." not "Based on data..."
- If user mentions travel to a destination, proactively offer to check tomorrow's conditions there

USER'S HEALTH PROFILE:
- Conditions being tracked: ${userContext.conditions?.length ? userContext.conditions.join(', ') : 'None specified'}
- Known symptoms: ${userContext.knownSymptoms?.join(', ') || 'None specified'}
- Known triggers: ${userContext.knownTriggers?.join(', ') || 'None specified'}

USER'S FLARE HISTORY ANALYSIS:
${userAnalysis ? `
- Total flares logged: ${userAnalysis.totalFlares}
- Severe flares: ${userAnalysis.severePercentage}%
- Peak flare time: ${userAnalysis.peakTime}
- Top triggers (from data + notes): ${userAnalysis.topTriggers.map(t => `${t.name} (${t.count}x)`).join(', ') || 'Still building data'}
- Top symptoms: ${userAnalysis.topSymptoms.map(s => `${s.name} (${s.count}x)`).join(', ') || 'Still building data'}
- Weather patterns during flares: ${userAnalysis.weatherTriggers.map(w => `${w.condition} (${w.count}x)`).join(', ') || 'Not enough weather data yet'}
` : 'No flare history yet - need more data to identify patterns.'}

${weatherInfo}

RESPONSE FORMAT (MUST be valid JSON):
{
  "response": "Your data-backed, warm response here",
  "isAIGenerated": true,
  "dataUsed": ["list", "of", "data_sources"],
  "shouldLog": true/false,
  "entryData": { ... } or null,
  "suggestedFollowUp": "optional follow-up question to show as button" or null
}

EXAMPLES:
User: "going for a run, anything to watch out for?"
Response (with weather data): {"response": "Right now in ${weatherLocation || 'your area'}, it's 72°F with moderate UV. Based on your history, you've had 3 flares during high humidity days. Current humidity is 65% - I'd suggest a shorter route and having water handy. Air quality looks good at EPA index 2! 💪", "isAIGenerated": true, "dataUsed": ["current_weather", "flare_history", "air_quality"], "shouldLog": false}

User: "feeling dizzy and tired"
Response: {"response": "I've logged dizziness and fatigue - a moderate flare. Looking at your pattern, these often appear together (6 of your 12 flares). Last time this happened, you mentioned stress was a factor. How's your stress been? 💜", "isAIGenerated": true, "dataUsed": ["symptom_history", "pattern_analysis"], "shouldLog": true, "entryData": {"type": "flare", "severity": "moderate", "symptoms": ["dizziness", "fatigue"]}, "suggestedFollowUp": "How's my week looking?"}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-8),
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
          response: "I'm getting a lot of requests right now. Give me a moment and try again! 💜",
          isAIGenerated: false,
          dataUsed: [],
          shouldLog: false,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          response: "AI features are temporarily limited. Basic logging still works!",
          isAIGenerated: false,
          dataUsed: [],
          shouldLog: false,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Smart response:', parsed.response?.substring(0, 100));
          
          return new Response(JSON.stringify({
            response: parsed.response || "I need more context to help with that.",
            isAIGenerated: true,
            dataUsed: parsed.dataUsed || [],
            shouldLog: parsed.shouldLog || false,
            entryData: parsed.entryData || null,
            suggestedFollowUp: parsed.suggestedFollowUp || null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (parseError) {
        console.log('Could not parse JSON, returning raw content');
      }
      
      // If no valid JSON, return the raw content
      return new Response(JSON.stringify({
        response: content.replace(/```json\n?|\n?```/g, '').trim(),
        isAIGenerated: true,
        dataUsed: [],
        shouldLog: false,
        entryData: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      response: "I couldn't process that. Could you rephrase?",
      isAIGenerated: false,
      dataUsed: [],
      shouldLog: false,
      entryData: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Smart assistant error:', error);
    return new Response(JSON.stringify({ 
      response: "Something went wrong. Basic logging still works though!",
      isAIGenerated: false,
      dataUsed: [],
      shouldLog: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 200, // Return 200 so frontend doesn't break
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
