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
  type?: string;
  environmental_data?: {
    weather?: { condition: string; temperature: number; humidity: number };
    airQuality?: { pollen: number; aqi: number };
    location?: { city: string };
  };
}

interface MedicationDetails {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

interface UserContext {
  conditions: string[];
  knownSymptoms: string[];
  knownTriggers: string[];
  recentEntries: FlareEntry[];
  currentLocation?: { latitude: number; longitude: number; city?: string };
  medications?: MedicationDetails[];
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

// Advanced NLP-based trigger extraction
function extractTriggersFromNotes(entries: FlareEntry[]): Record<string, { count: number; severities: string[] }> {
  const potentialTriggers: Record<string, { count: number; severities: string[] }> = {};
  
  // More comprehensive patterns for trigger detection
  const triggerPatterns = [
    // Food patterns
    /(?:ate|eat|eating|had|drank|drinking)\s+(?:some\s+)?(\w+(?:\s+\w+)?(?:\s+\w+)?)/gi,
    /after\s+(?:eating|having|drinking)\s+(\w+(?:\s+\w+)?)/gi,
    // Activity patterns
    /(?:after|during|while)\s+(\w+ing)/gi,
    // Environmental patterns
    /(?:exposure\s+to|exposed\s+to|around)\s+(\w+(?:\s+\w+)?)/gi,
    // Explicit trigger mentions
    /(?:triggered\s+by|caused\s+by|because\s+of|due\s+to)\s+(\w+(?:\s+\w+)?)/gi,
    // Time-based patterns
    /(?:woke\s+up\s+with|started\s+after|began\s+when)\s+(\w+(?:\s+\w+)?)/gi,
  ];
  
  const stopWords = ['the', 'and', 'some', 'lot', 'bit', 'too', 'much', 'very', 'really', 'today', 'yesterday', 'just', 'like', 'been', 'have', 'had', 'was', 'were', 'that', 'this', 'with'];
  
  entries.forEach(entry => {
    if (!entry.note) return;
    const note = entry.note.toLowerCase();
    
    triggerPatterns.forEach(pattern => {
      const matches = note.matchAll(pattern);
      for (const match of matches) {
        let trigger = match[1]?.trim();
        if (!trigger || trigger.length < 3) continue;
        
        // Filter out stop words
        const words = trigger.split(' ').filter(w => !stopWords.includes(w) && w.length > 2);
        trigger = words.join(' ');
        
        if (trigger.length > 2) {
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
  
  // Weekly summary
  const last7Days = entries.filter(e => {
    const daysDiff = (Date.now() - new Date(e.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });
  
  const weekSummary = {
    totalFlares: last7Days.filter(e => e.type === 'flare' || e.severity).length,
    severeCount: last7Days.filter(e => e.severity === 'severe').length,
    medicationLogs: last7Days.filter(e => e.type === 'medication').length,
    wellnessLogs: last7Days.filter(e => e.type === 'wellness').length,
  };
  
  return {
    totalFlares: last30Days.length,
    severePercentage: Math.round((severeSeverityCount / last30Days.length) * 100),
    topTriggers,
    topSymptoms,
    weatherTriggers,
    peakTime: peakTime[0],
    conditions,
    weekSummary
  };
}

// Detect if user is asking about weather/outdoor activities
function detectWeatherQuery(message: string, currentLocation?: any): { needsWeather: boolean; destination?: string; isCurrentLocation: boolean } {
  const lowerMsg = message.toLowerCase();
  
  // Travel detection - more patterns
  const travelPatterns = [
    /travel(?:ing|s|led)?\s+to\s+([a-zA-Z\s,]+)/i,
    /going\s+to\s+([a-zA-Z\s,]+)/i,
    /trip\s+to\s+([a-zA-Z\s,]+)/i,
    /flying\s+to\s+([a-zA-Z\s,]+)/i,
    /visiting\s+([a-zA-Z\s,]+)/i,
    /heading\s+to\s+([a-zA-Z\s,]+)/i,
    /vacation\s+(?:in|to)\s+([a-zA-Z\s,]+)/i,
    /moving\s+to\s+([a-zA-Z\s,]+)/i,
  ];
  
  for (const pattern of travelPatterns) {
    const match = lowerMsg.match(pattern);
    if (match) {
      const destination = match[1].trim().replace(/[,.]$/, '');
      // Filter out non-location words
      if (!['work', 'home', 'bed', 'sleep', 'dinner', 'lunch', 'breakfast'].includes(destination)) {
        return { needsWeather: true, destination, isCurrentLocation: false };
      }
    }
  }
  
  // Current location weather queries
  const currentWeatherKeywords = [
    'weather', 'temperature', 'humidity', 'pollen', 'air quality', 'aqi',
    'outside', 'outdoor', 'go out', 'walk', 'run', 'jog', 'exercise', 'workout',
    'hiking', 'bike', 'cycling', 'today', 'right now', 'currently'
  ];
  
  const needsCurrentWeather = currentWeatherKeywords.some(kw => lowerMsg.includes(kw));
  
  if (needsCurrentWeather && currentLocation) {
    return { needsWeather: true, isCurrentLocation: true };
  }
  
  return { needsWeather: false, isCurrentLocation: false };
}

// Classify user message intent
function classifyIntent(message: string): { type: string; confidence: number; extractedData: any } {
  const lower = message.toLowerCase();
  
  // Positive/wellness patterns
  const positivePatterns = [
    /feeling\s+(good|great|better|amazing|wonderful|fantastic|well|fine|okay)/i,
    /feel\s+(good|great|better|amazing|wonderful|fantastic|well|fine|okay)/i,
    /doing\s+(good|great|better|well|okay|fine)/i,
    /(good|great|better)\s+day/i,
    /no\s+(pain|symptoms|issues|problems|flares?)/i,
    /pain\s*free/i,
    /symptom\s*free/i,
  ];
  
  for (const pattern of positivePatterns) {
    if (pattern.test(lower)) {
      return { type: 'wellness', confidence: 0.9, extractedData: { energyLevel: 'good' } };
    }
  }
  
  // Medication patterns
  const medicationPatterns = [
    /took\s+(my\s+)?(medication|medicine|meds?|pills?|insulin|dose)/i,
    /taking\s+(my\s+)?(medication|medicine|meds?|pills?)/i,
    /had\s+(my\s+)?(medication|medicine|meds?|pills?)/i,
    /(medication|medicine|meds?|pills?)\s+taken/i,
    /(\d+)\s*(?:units?|mg|ml)\s+(?:of\s+)?(\w+)/i,
  ];
  
  for (const pattern of medicationPatterns) {
    const match = lower.match(pattern);
    if (match) {
      return { type: 'medication', confidence: 0.9, extractedData: { note: message } };
    }
  }
  
  // Energy patterns
  const energyPatterns = [
    /(low|no|zero)\s+energy/i,
    /feeling\s+(tired|exhausted|drained|fatigued)/i,
    /(high|lots?\s+of|full\s+of)\s+energy/i,
    /very\s+(tired|exhausted)/i,
    /so\s+tired/i,
  ];
  
  for (const pattern of energyPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const isLow = /(low|no|zero|tired|exhausted|drained|fatigued)/.test(match[0]);
      return { type: 'energy', confidence: 0.85, extractedData: { energyLevel: isLow ? 'low' : 'high' } };
    }
  }
  
  // Flare/symptom patterns
  const flarePatterns = [
    /feeling\s+(terrible|awful|bad|horrible|sick|unwell|rough|worse)/i,
    /(severe|bad|terrible|horrible)\s+(pain|headache|migraine)/i,
    /having\s+a\s+(flare|attack|episode)/i,
    /(headache|migraine|nausea|dizzy|dizziness|pain|cramp)/i,
  ];
  
  for (const pattern of flarePatterns) {
    if (pattern.test(lower)) {
      // Try to extract severity
      let severity = 'moderate';
      if (/(severe|terrible|horrible|awful|worst)/i.test(lower)) severity = 'severe';
      else if (/(mild|slight|little|bit)/i.test(lower)) severity = 'mild';
      
      // Try to extract symptoms
      const symptoms: string[] = [];
      const symptomList = ['headache', 'migraine', 'nausea', 'dizziness', 'fatigue', 'pain', 'cramping', 'brain fog'];
      symptomList.forEach(s => {
        if (lower.includes(s)) symptoms.push(s);
      });
      
      return { 
        type: 'flare', 
        confidence: 0.8, 
        extractedData: { severity, symptoms: symptoms.length > 0 ? symptoms : undefined } 
      };
    }
  }
  
  // Query patterns
  const queryPatterns = [
    /(how|what).*(week|today|patterns?|triggers?|symptoms?)/i,
    /(show|tell|give).*(summary|report|analysis|insights?)/i,
    /(any|are\s+there).*(patterns?|correlations?|trends?)/i,
  ];
  
  for (const pattern of queryPatterns) {
    if (pattern.test(lower)) {
      return { type: 'query', confidence: 0.8, extractedData: {} };
    }
  }
  
  return { type: 'unknown', confidence: 0, extractedData: {} };
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
    console.log('💊 User medications:', userContext.medications);
    
    // Classify the intent first
    const intent = classifyIntent(message);
    console.log('🎯 Detected intent:', intent.type, 'confidence:', intent.confidence);
    
    // Analyze the user's history
    const userAnalysis = analyzeUserHistory(userContext.recentEntries || [], userContext.conditions || []);
    
    // Check if we need to fetch weather
    const weatherQuery = detectWeatherQuery(message, userContext.currentLocation);
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
- Pollen (approximate): ${current?.humidity > 50 && current?.temp_f > 50 ? 'Moderate-High' : 'Low-Moderate'}

Today's Forecast:
- High: ${forecast?.maxtemp_f || 'Unknown'}°F, Low: ${forecast?.mintemp_f || 'Unknown'}°F
- Condition: ${forecast?.condition?.text || 'Unknown'}
- Chance of rain: ${forecast?.daily_chance_of_rain || 0}%

Tomorrow's Forecast:
- Condition: ${tomorrow?.condition?.text || 'Unknown'}
- High: ${tomorrow?.maxtemp_f || 'Unknown'}°F

YOU MUST USE THIS DATA to give SPECIFIC advice. Include the actual numbers in your response.`;
    }
    
    // Build medication info
    let medicationInfo = '';
    if (userContext.medications && userContext.medications.length > 0) {
      medicationInfo = `
USER'S MEDICATIONS:
${userContext.medications.map(m => `- ${m.name}${m.dosage ? ` (${m.dosage})` : ''}${m.frequency ? ` - ${m.frequency}` : ''}${m.notes ? ` - Notes: ${m.notes}` : ''}`).join('\n')}`;
    }
    
    // Build context-aware system prompt
    const systemPrompt = `You are Jvala, an intelligent health companion with REAL DATA about this specific user. You are warm, caring, and knowledgeable.

CRITICAL RULES:
- NEVER give generic advice like "listen to your body" or "stay hydrated" without backing it with data
- NEVER say "I don't have access to real-time data" - if weather data is provided, USE IT with specific numbers
- When weather data is provided, YOU MUST include specific numbers like "72°F" and "humidity at 65%"
- ONLY give advice that is BACKED BY USER'S DATA or REAL WEATHER DATA when provided
- Keep responses SHORT (2-3 sentences max) unless answering a detailed query
- Be warm, personable, supportive - like a knowledgeable friend
- When citing data, be specific: "Your 12 logged flares show..." not "Based on data..."
- For weekly summaries, use markdown formatting with bullet points

USER'S HEALTH PROFILE:
- Conditions being tracked: ${userContext.conditions?.length ? userContext.conditions.join(', ') : 'None specified'}
- Known symptoms: ${userContext.knownSymptoms?.join(', ') || 'None specified'}
- Known triggers: ${userContext.knownTriggers?.join(', ') || 'None specified'}
${medicationInfo}

USER'S FLARE HISTORY ANALYSIS:
${userAnalysis ? `
- Total entries (30 days): ${userAnalysis.totalFlares}
- Severe flares: ${userAnalysis.severePercentage}%
- Peak flare time: ${userAnalysis.peakTime}
- Top triggers: ${userAnalysis.topTriggers.map(t => `${t.name} (${t.count}x)`).join(', ') || 'Still building data'}
- Top symptoms: ${userAnalysis.topSymptoms.map(s => `${s.name} (${s.count}x)`).join(', ') || 'Still building data'}
- Weather correlations: ${userAnalysis.weatherTriggers.map(w => `${w.condition} (${w.count}x)`).join(', ') || 'Not enough data yet'}

THIS WEEK (last 7 days):
- Flares: ${userAnalysis.weekSummary.totalFlares}
- Severe: ${userAnalysis.weekSummary.severeCount}
- Medication logs: ${userAnalysis.weekSummary.medicationLogs}
- Wellness logs: ${userAnalysis.weekSummary.wellnessLogs}
` : 'No flare history yet - need more data to identify patterns.'}

${weatherInfo}

DETECTED USER INTENT: ${intent.type} (confidence: ${intent.confidence})
${intent.type !== 'unknown' ? `Extracted data: ${JSON.stringify(intent.extractedData)}` : ''}

RESPONSE FORMAT (MUST be valid JSON):
{
  "response": "Your data-backed, warm response here. Use markdown for lists.",
  "isAIGenerated": true,
  "dataUsed": ["list", "data_sources", "used"],
  "weatherUsed": ${weatherData ? 'true' : 'false'},
  "shouldLog": true/false (set true if user is reporting symptoms/feelings/medications),
  "entryData": { "type": "flare|medication|wellness|energy", "severity": "mild|moderate|severe", "symptoms": [], "energyLevel": "low|moderate|high|good" } or null,
  "suggestedFollowUp": "optional follow-up question" or null
}

LOGGING RULES:
- "feeling good/great/better/amazing" → shouldLog: true, entryData: { type: "wellness", energyLevel: "good" }
- "took medication/meds/pills" → shouldLog: true, entryData: { type: "medication" }
- "low energy/tired/exhausted" → shouldLog: true, entryData: { type: "energy", energyLevel: "low" }
- Any symptom mention → shouldLog: true, entryData: { type: "flare", severity: based on words, symptoms: extracted }
- Questions/queries about patterns → shouldLog: false

WEEKLY SUMMARY FORMAT (when user asks "my week" or similar):
Use this markdown format:
**Your Week at a Glance** 📊

• **Flares:** X logged (Y severe)
• **Medications:** X times logged
• **Wellness:** X positive entries
• **Top symptom:** [symptom]
• **Main trigger:** [trigger]

[One personalized insight based on data]`;

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
            weatherUsed: parsed.weatherUsed || false,
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