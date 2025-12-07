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

interface ConversationContext {
  recentMentions: string[]; // Foods, activities mentioned in last few messages
  pendingTrigger?: string; // Something mentioned that might be a trigger
}

// Helper to get weather for a destination with optional date
async function getWeather(query: string, dateStr?: string): Promise<any> {
  const apiKey = Deno.env.get('WEATHER_API_KEY');
  if (!apiKey) {
    console.log('No WEATHER_API_KEY configured');
    return null;
  }
  
  try {
    console.log('🌍 Fetching weather for:', query, dateStr ? `on ${dateStr}` : '');
    
    let url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(query)}&days=14&aqi=yes`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Weather API error:', response.status);
      return null;
    }
    const data = await response.json();
    console.log('✅ Weather data received for:', data.location?.name);
    
    if (dateStr && data.forecast?.forecastday) {
      const targetDate = parseFutureDate(dateStr);
      if (targetDate) {
        const matchingDay = data.forecast.forecastday.find((day: any) => 
          day.date === targetDate.toISOString().split('T')[0]
        );
        if (matchingDay) {
          data.targetDayForecast = matchingDay;
        }
      }
    }
    
    return data;
  } catch (e) {
    console.error('Weather fetch error:', e);
    return null;
  }
}

function parseFutureDate(dateStr: string): Date | null {
  const lower = dateStr.toLowerCase();
  const now = new Date();
  
  if (lower.includes('tomorrow')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  
  if (lower.includes('next week')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d;
  }
  
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  for (let i = 0; i < monthNames.length; i++) {
    const regex = new RegExp(`${monthNames[i]}\\w*\\s+(\\d{1,2})`, 'i');
    const match = lower.match(regex);
    if (match) {
      const day = parseInt(match[1]);
      const targetDate = new Date(now.getFullYear(), i, day);
      if (targetDate < now) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      }
      return targetDate;
    }
  }
  
  return null;
}

function extractLocationFromMessage(message: string): { location: string; date?: string } | null {
  const lower = message.toLowerCase();
  
  const cityPatterns = [
    { pattern: /\bsfo\b/i, city: 'San Francisco' },
    { pattern: /\blax\b/i, city: 'Los Angeles' },
    { pattern: /\bjfk\b/i, city: 'New York' },
    { pattern: /\bnyc\b/i, city: 'New York' },
    { pattern: /\bord\b/i, city: 'Chicago' },
    { pattern: /\bdfw\b/i, city: 'Dallas' },
    { pattern: /\bsea\b/i, city: 'Seattle' },
    { pattern: /\bmia\b/i, city: 'Miami' },
    { pattern: /\batl\b/i, city: 'Atlanta' },
    { pattern: /\bden\b/i, city: 'Denver' },
    { pattern: /\blas\b/i, city: 'Las Vegas' },
    { pattern: /\bphx\b/i, city: 'Phoenix' },
    { pattern: /\bsf\b/i, city: 'San Francisco' },
    { pattern: /\bla\b/i, city: 'Los Angeles' },
    { pattern: /\bdc\b/i, city: 'Washington DC' },
    { pattern: /\bmachu\s*pichu\b/i, city: 'Machu Picchu, Peru' },
    { pattern: /\bmachu\s*picchu\b/i, city: 'Machu Picchu, Peru' },
    { pattern: /\bcusco\b/i, city: 'Cusco, Peru' },
    { pattern: /\bparis\b/i, city: 'Paris, France' },
    { pattern: /\blondon\b/i, city: 'London, UK' },
    { pattern: /\btokyo\b/i, city: 'Tokyo, Japan' },
    { pattern: /\bsydney\b/i, city: 'Sydney, Australia' },
  ];
  
  let extractedDate: string | undefined;
  const datePatterns = [
    /(?:on|for)\s+(jan(?:uary)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(feb(?:ruary)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(mar(?:ch)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(apr(?:il)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(may\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(jun(?:e)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(jul(?:y)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(aug(?:ust)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(sep(?:tember)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(oct(?:ober)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(nov(?:ember)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:on|for)\s+(dec(?:ember)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(next\s+jan(?:uary)?\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(tomorrow)/i,
    /(next\s+week)/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      extractedDate = match[1];
      break;
    }
  }
  
  for (const { pattern, city } of cityPatterns) {
    if (pattern.test(lower)) {
      return { location: city, date: extractedDate };
    }
  }
  
  const travelPatterns = [
    /travel(?:ing|s|led)?\s+to\s+([a-zA-Z\s,]+?)(?:\s+(?:tomorrow|today|next|this|for|on)|$)/i,
    /going\s+(?:on\s+a\s+)?(?:hike|trip|vacation)?\s*(?:to|in)\s+([a-zA-Z\s,]+?)(?:\s+(?:tomorrow|today|next|this|for|on)|$)/i,
    /trip\s+to\s+([a-zA-Z\s,]+?)(?:\s+(?:tomorrow|today|next|this|for|on)|$)/i,
    /flying\s+to\s+([a-zA-Z\s,]+?)(?:\s+(?:tomorrow|today|next|this|for|on)|$)/i,
    /visiting\s+([a-zA-Z\s,]+?)(?:\s+(?:tomorrow|today|next|this|for|on)|$)/i,
    /heading\s+to\s+([a-zA-Z\s,]+?)(?:\s+(?:tomorrow|today|next|this|for|on)|$)/i,
    /vacation\s+(?:in|to)\s+([a-zA-Z\s,]+?)(?:\s+(?:tomorrow|today|next|this|for|on)|$)/i,
    /mountain\s+hike\s+(?:to|in)\s+([a-zA-Z\s,]+?)(?:\s+(?:tomorrow|today|next|this|for|on)|$)/i,
    /hike\s+(?:to|in|at)\s+([a-zA-Z\s,]+?)(?:\s+(?:tomorrow|today|next|this|for|on)|$)/i,
    /weather\s+in\s+([a-zA-Z\s,]+?)(?:\?|$)/i,
    /weather\s+(?:like|for)\s+([a-zA-Z\s,]+?)(?:\?|$)/i,
    /(?:in|at)\s+([a-zA-Z\s,]+?)\s+(?:weather|temperature|pollen)/i,
  ];
  
  for (const pattern of travelPatterns) {
    const match = message.match(pattern);
    if (match) {
      let destination = match[1].trim().replace(/[,.]$/, '');
      const stopWords = ['work', 'home', 'bed', 'sleep', 'dinner', 'lunch', 'breakfast', 'the', 'a', 'like', 'about'];
      if (!stopWords.includes(destination.toLowerCase()) && destination.length > 2) {
        return { location: destination, date: extractedDate };
      }
    }
  }
  
  return null;
}

// Extract potential triggers from conversation context
function extractPotentialTriggers(history: Array<{ role: string; content: string }>): ConversationContext {
  const recentMentions: string[] = [];
  let pendingTrigger: string | undefined;
  
  // Look at last 5 messages for context
  const recentHistory = history.slice(-5);
  
  const foodPatterns = [
    /(?:ate|eat|eating|had|consumed|tried|drank|drinking)\s+(?:some\s+)?(\w+(?:\s+\w+)?)/gi,
    /(\w+)\s+(?:for\s+)?(?:breakfast|lunch|dinner|snack)/gi,
  ];
  
  recentHistory.forEach(msg => {
    if (msg.role !== 'user') return;
    const content = msg.content.toLowerCase();
    
    foodPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const item = match[1]?.trim();
        if (item && item.length > 2 && item.length < 20) {
          recentMentions.push(item);
          pendingTrigger = item; // Last mentioned item is pending
        }
      }
    });
  });
  
  return { recentMentions: [...new Set(recentMentions)], pendingTrigger };
}

// Advanced trigger extraction from notes
function extractTriggersFromNotes(entries: FlareEntry[]): Record<string, { count: number; severities: string[] }> {
  const potentialTriggers: Record<string, { count: number; severities: string[] }> = {};
  
  const triggerPatterns = [
    /(?:ate|eat|eating|had|drank|drinking)\s+(?:some\s+)?(\w+(?:\s+\w+)?(?:\s+\w+)?)/gi,
    /after\s+(?:eating|having|drinking)\s+(\w+(?:\s+\w+)?)/gi,
    /(?:after|during|while)\s+(\w+ing)/gi,
    /(?:exposure\s+to|exposed\s+to|around)\s+(\w+(?:\s+\w+)?)/gi,
    /(?:triggered\s+by|caused\s+by|because\s+of|due\s+to)\s+(\w+(?:\s+\w+)?)/gi,
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

function analyzeUserHistory(entries: FlareEntry[], conditions: string[]) {
  if (entries.length === 0) return null;
  
  const last30Days = entries.slice(0, 50);
  
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
  
  // Also extract triggers from notes
  const noteTriggers = extractTriggersFromNotes(last30Days);
  Object.entries(noteTriggers).forEach(([trigger, data]) => {
    if (data.count >= 2) {
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
  
  const hourCounts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  last30Days.forEach(e => {
    const hour = new Date(e.timestamp).getHours();
    if (hour >= 6 && hour < 12) hourCounts.morning++;
    else if (hour >= 12 && hour < 18) hourCounts.afternoon++;
    else if (hour >= 18 && hour < 22) hourCounts.evening++;
    else hourCounts.night++;
  });
  
  const peakTime = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  
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

function needsWeatherInfo(message: string): boolean {
  const lower = message.toLowerCase();
  const weatherKeywords = [
    'weather', 'temperature', 'humidity', 'pollen', 'air quality', 'aqi',
    'outside', 'outdoor', 'go out', 'travel', 'trip', 'flying', 'going to',
    'visiting', 'vacation', 'heading to', 'watch out', 'be careful', 'forecast',
    'hike', 'hiking', 'mountain', 'altitude', 'meters', 'climb'
  ];
  return weatherKeywords.some(kw => lower.includes(kw));
}

function classifyIntent(message: string): { type: string; confidence: number; extractedData: any } {
  const lower = message.toLowerCase();
  
  // Food/consumption patterns - important for trigger tracking
  const foodPatterns = [
    /(?:ate|eat|eating|had|consumed|tried|drank|drinking)\s+(\w+)/i,
  ];
  
  for (const pattern of foodPatterns) {
    const match = lower.match(pattern);
    if (match) {
      return { type: 'food_log', confidence: 0.9, extractedData: { food: match[1] } };
    }
  }
  
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
    if (pattern.test(lower)) {
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
      let severity = 'moderate';
      if (/(severe|terrible|horrible|awful|worst)/i.test(lower)) severity = 'severe';
      else if (/(mild|slight|little|bit)/i.test(lower)) severity = 'mild';
      
      const symptoms: string[] = [];
      const symptomList = ['headache', 'migraine', 'nausea', 'dizziness', 'fatigue', 'pain', 'cramping', 'brain fog', 'loss of appetite'];
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
  
  // Travel query
  if (needsWeatherInfo(message)) {
    return { type: 'travel_query', confidence: 0.9, extractedData: {} };
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
    
    // Extract conversation context for trigger detection
    const conversationContext = extractPotentialTriggers(history || []);
    console.log('🔍 Conversation context:', conversationContext);
    
    // Classify the intent
    const intent = classifyIntent(message);
    console.log('🎯 Detected intent:', intent.type, 'confidence:', intent.confidence);
    
    // If user is reporting a symptom and we have a pending trigger, link them
    let linkedTrigger: string | undefined;
    if ((intent.type === 'flare' || message.toLowerCase().includes('symptom')) && conversationContext.pendingTrigger) {
      linkedTrigger = conversationContext.pendingTrigger;
      console.log('🔗 Linking symptom to potential trigger:', linkedTrigger);
    }
    
    // Analyze user's history
    const userAnalysis = analyzeUserHistory(userContext.recentEntries || [], userContext.conditions || []);
    
    // Get weather data
    let weatherData = null;
    let weatherLocation = '';
    let targetDate = '';
    
    const locationInfo = extractLocationFromMessage(message);
    if (locationInfo) {
      console.log('🌍 Extracted location:', locationInfo.location, 'Date:', locationInfo.date);
      weatherData = await getWeather(locationInfo.location, locationInfo.date);
      weatherLocation = locationInfo.location;
      targetDate = locationInfo.date || '';
    } else if (needsWeatherInfo(message) && userContext.currentLocation) {
      const query = userContext.currentLocation.city || 
        `${userContext.currentLocation.latitude},${userContext.currentLocation.longitude}`;
      console.log('🌍 Using current location for weather:', query);
      weatherData = await getWeather(query);
      weatherLocation = userContext.currentLocation.city || 'your current location';
    }
    
    // Build weather info
    let weatherInfo = '';
    let weatherCard = null;
    if (weatherData) {
      const current = weatherData.current;
      const forecast = weatherData.forecast?.forecastday?.[0]?.day;
      const tomorrow = weatherData.forecast?.forecastday?.[1]?.day;
      const targetDay = weatherData.targetDayForecast?.day;
      const aqi = current?.air_quality;
      
      weatherCard = {
        location: weatherData.location?.name || weatherLocation,
        country: weatherData.location?.country,
        current: {
          temp_f: current?.temp_f,
          temp_c: current?.temp_c,
          condition: current?.condition?.text,
          icon: current?.condition?.icon,
          humidity: current?.humidity,
          uv: current?.uv,
          feelslike_f: current?.feelslike_f,
        },
        forecast: targetDay ? {
          date: weatherData.targetDayForecast?.date,
          maxtemp_f: targetDay.maxtemp_f,
          mintemp_f: targetDay.mintemp_f,
          condition: targetDay.condition?.text,
          icon: targetDay.condition?.icon,
          daily_chance_of_rain: targetDay.daily_chance_of_rain,
        } : forecast ? {
          maxtemp_f: forecast.maxtemp_f,
          mintemp_f: forecast.mintemp_f,
          condition: forecast.condition?.text,
          icon: forecast.condition?.icon,
          daily_chance_of_rain: forecast.daily_chance_of_rain,
        } : null,
        aqi: aqi?.['us-epa-index'],
      };
      
      const relevantForecast = targetDay || forecast;
      
      weatherInfo = `
REAL-TIME WEATHER DATA for ${weatherData.location?.name || weatherLocation}, ${weatherData.location?.country || ''}:
${targetDay ? `(Forecast for ${weatherData.targetDayForecast?.date})` : ''}

Current Conditions:
- Condition: ${current?.condition?.text || 'Unknown'}
- Temperature: ${current?.temp_f || 'Unknown'}°F (feels like ${current?.feelslike_f}°F)
- Humidity: ${current?.humidity || 'Unknown'}%
- UV Index: ${current?.uv || 'Unknown'} ${current?.uv >= 6 ? '(HIGH - protect yourself!)' : ''}
- Air Quality (US EPA): ${aqi?.['us-epa-index'] || 'Unknown'} (1=Good, 6=Hazardous)
- PM2.5: ${aqi?.pm2_5?.toFixed(1) || 'Unknown'}

${targetDay ? `Forecast for ${weatherData.targetDayForecast?.date}:` : "Today's Forecast:"}
- High: ${relevantForecast?.maxtemp_f || 'Unknown'}°F, Low: ${relevantForecast?.mintemp_f || 'Unknown'}°F
- Condition: ${relevantForecast?.condition?.text || 'Unknown'}
- Chance of rain: ${relevantForecast?.daily_chance_of_rain || 0}%

Tomorrow's Forecast:
- Condition: ${tomorrow?.condition?.text || 'Unknown'}
- High: ${tomorrow?.maxtemp_f || 'Unknown'}°F, Low: ${tomorrow?.mintemp_f || 'Unknown'}°F

CRITICAL: Use specific numbers from this data in your response.`;
    }
    
    // Build medication info
    let medicationInfo = '';
    if (userContext.medications && userContext.medications.length > 0) {
      medicationInfo = `
USER'S MEDICATIONS:
${userContext.medications.map(m => `- ${m.name}${m.dosage ? ` (${m.dosage})` : ''}${m.frequency ? ` - ${m.frequency}` : ''}${m.notes ? ` - Notes: ${m.notes}` : ''}`).join('\n')}`;
    }
    
    // Build trigger summary - be specific
    const triggerSummary = userAnalysis?.topTriggers?.length 
      ? userAnalysis.topTriggers.map(t => `${t.name} (${t.count}x)`).join(', ')
      : 'Tracking patterns from notes...';
    
    const symptomSummary = userAnalysis?.topSymptoms?.length
      ? userAnalysis.topSymptoms.map(s => `${s.name} (${s.count}x)`).join(', ')
      : 'Building symptom patterns...';
      
    const weatherSummary = userAnalysis?.weatherTriggers?.length
      ? userAnalysis.weatherTriggers.map(w => `${w.condition} (${w.count}x)`).join(', ')
      : 'Analyzing weather correlations...';
    
    // Build context-aware system prompt
    const systemPrompt = `You are Jvala, a smart health companion with REAL DATA about this user. Be warm, caring, and data-driven.

CRITICAL RULES:
1. NEVER say "still gathering data", "None identified yet", "no data available"
2. When weather data is provided, USE SPECIFIC NUMBERS (e.g., "72°F, 65% humidity")
3. Be PROACTIVE about concerning patterns
4. Keep responses SHORT (2-4 sentences) unless it's a detailed query
5. For food logs, note what they ate and ask how they're feeling
6. When symptoms follow food mentions in conversation, LINK THEM as potential triggers

USER'S HEALTH PROFILE:
- Conditions: ${userContext.conditions?.length ? userContext.conditions.join(', ') : 'General health tracking'}
- Known symptoms: ${userContext.knownSymptoms?.join(', ') || 'Building profile...'}
- Known triggers: ${userContext.knownTriggers?.join(', ') || 'Analyzing patterns...'}
${medicationInfo}

CONVERSATION CONTEXT:
- Recently mentioned foods/activities: ${conversationContext.recentMentions.join(', ') || 'None'}
${linkedTrigger ? `- IMPORTANT: User mentioned "${linkedTrigger}" recently and now has symptoms. This should be logged as a potential trigger!` : ''}

USER'S FLARE HISTORY (${userAnalysis?.totalFlares || 0} entries):
${userAnalysis ? `
- Total entries: ${userAnalysis.totalFlares}
- Severe flares: ${userAnalysis.severePercentage}%
- Peak time: ${userAnalysis.peakTime}
- Top triggers: ${triggerSummary}
- Top symptoms: ${symptomSummary}
- Weather correlations: ${weatherSummary}

THIS WEEK:
- Flares: ${userAnalysis.weekSummary.totalFlares}
- Severe: ${userAnalysis.weekSummary.severeCount}
- Medications: ${userAnalysis.weekSummary.medicationLogs}
- Wellness: ${userAnalysis.weekSummary.wellnessLogs}
` : 'First-time user - welcome them!'}

${weatherInfo}

DETECTED INTENT: ${intent.type} (confidence: ${intent.confidence})
${intent.extractedData?.food ? `FOOD MENTIONED: ${intent.extractedData.food}` : ''}

RESPONSE FORMAT (valid JSON):
{
  "response": "Your personalized response",
  "isAIGenerated": true,
  "dataUsed": ["weather_api", "flare_history", "user_profile"],
  "weatherUsed": ${weatherData ? 'true' : 'false'},
  "shouldLog": true/false,
  "entryData": { 
    "type": "flare|medication|wellness|energy", 
    "severity": "mild|moderate|severe", 
    "energyLevel": "low|moderate|high|good",
    "triggers": ["trigger1", "trigger2"],
    "symptoms": ["symptom1"]
  } or null
}

LOGGING RULES:
- Food mentions → shouldLog: false (just note it, don't log yet)
- "feeling good/great/better" → shouldLog: true, type: "wellness"
- "took medication/meds" → shouldLog: true, type: "medication"
- "low energy/tired" → shouldLog: true, type: "energy"
- Symptom with recent food mention → shouldLog: true, type: "flare", triggers: [the food]${linkedTrigger ? `, include "${linkedTrigger}" in triggers!` : ''}
- Questions → shouldLog: false`;

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
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Smart response:', parsed.response?.substring(0, 100));
          
          // If we detected a linked trigger, ensure it's in the entry data
          let entryData = parsed.entryData;
          if (linkedTrigger && entryData && entryData.type === 'flare') {
            entryData.triggers = entryData.triggers || [];
            if (!entryData.triggers.includes(linkedTrigger)) {
              entryData.triggers.push(linkedTrigger);
            }
          }
          
          return new Response(JSON.stringify({
            response: parsed.response || "I need more context to help with that.",
            isAIGenerated: true,
            dataUsed: parsed.dataUsed || [],
            weatherUsed: weatherData ? true : false,
            weatherCard: weatherCard,
            shouldLog: parsed.shouldLog || false,
            entryData: entryData,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (parseError) {
        console.log('Could not parse JSON, returning raw content');
      }
      
      return new Response(JSON.stringify({
        response: content.replace(/```json\n?|\n?```/g, '').trim(),
        isAIGenerated: true,
        dataUsed: [],
        weatherUsed: weatherData ? true : false,
        weatherCard: weatherCard,
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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});