import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  recentMentions: string[];
  pendingTrigger?: string;
}

// Activity detection patterns for correlation engine
const ACTIVITY_PATTERNS = [
  { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:a\s+)?(?:my\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' },
  { pattern: /(?:went|going|gone)\s+(?:for\s+)?(?:a\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' },
  { pattern: /(?:just\s+)?(?:finished|completed|did)\s+(?:a\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' },
  { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:a\s+)?(?:my\s+)?(walk|walking)/i, type: 'walk', intensity: 'low' },
  { pattern: /(?:went|going|gone)\s+(?:for\s+)?(?:a\s+)?(walk|walking)/i, type: 'walk', intensity: 'low' },
  { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:the\s+)?(gym|workout|exercise)/i, type: 'gym', intensity: 'high' },
  { pattern: /(?:went|going|gone)\s+(?:to\s+)?(?:the\s+)?(gym)/i, type: 'gym', intensity: 'high' },
  { pattern: /(?:just\s+)?(?:finished|completed|did)\s+(?:a\s+)?(workout|exercise)/i, type: 'gym', intensity: 'high' },
  { pattern: /(?:woke\s+up|just\s+woke|got\s+up)/i, type: 'sleep', intensity: 'low' },
  { pattern: /(?:finished|back\s+from|done\s+with)\s+work/i, type: 'work', intensity: 'moderate' },
  { pattern: /(?:long|tough|stressful)\s+(?:day\s+at\s+)?work/i, type: 'work', intensity: 'high' },
  { pattern: /(?:stressed|stress|anxious|anxiety)/i, type: 'stress', intensity: 'high' },
  { pattern: /(?:yoga|meditation|meditate)/i, type: 'relaxation', intensity: 'low' },
  { pattern: /(?:swimming|swam|swim)/i, type: 'swim', intensity: 'moderate' },
  { pattern: /(?:cycling|cycled|biking|biked)/i, type: 'cycling', intensity: 'moderate' },
  { pattern: /(?:hiking|hiked|hike)/i, type: 'hike', intensity: 'high' },
];

function detectActivity(message: string): { type: string; intensity: string; value?: string } | null {
  const lower = message.toLowerCase();
  
  for (const { pattern, type, intensity } of ACTIVITY_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      return { type, intensity, value: match[1] || undefined };
    }
  }
  
  return null;
}

// Average weather data for popular destinations by month (for future date queries)
const HISTORICAL_WEATHER: Record<string, Record<number, { avgTemp: number; humidity: number; condition: string; rain: number }>> = {
  'machu picchu': {
    1: { avgTemp: 55, humidity: 85, condition: 'Rainy season - frequent afternoon showers', rain: 75 },
    2: { avgTemp: 55, humidity: 85, condition: 'Rainy season - wettest month', rain: 80 },
    3: { avgTemp: 55, humidity: 80, condition: 'Rainy season ending', rain: 65 },
    4: { avgTemp: 54, humidity: 75, condition: 'Transition to dry season', rain: 45 },
    5: { avgTemp: 52, humidity: 65, condition: 'Dry season begins', rain: 20 },
    6: { avgTemp: 50, humidity: 60, condition: 'Dry and cool', rain: 10 },
    7: { avgTemp: 50, humidity: 55, condition: 'Driest month, cold mornings', rain: 8 },
    8: { avgTemp: 52, humidity: 55, condition: 'Dry season', rain: 12 },
    9: { avgTemp: 55, humidity: 60, condition: 'Warming up', rain: 25 },
    10: { avgTemp: 57, humidity: 70, condition: 'Transition season', rain: 40 },
    11: { avgTemp: 57, humidity: 75, condition: 'Rainy season starting', rain: 55 },
    12: { avgTemp: 56, humidity: 80, condition: 'Rainy season', rain: 65 },
  },
  'cusco': {
    1: { avgTemp: 54, humidity: 80, condition: 'Rainy season', rain: 70 },
    6: { avgTemp: 48, humidity: 50, condition: 'Dry and cold', rain: 5 },
    7: { avgTemp: 47, humidity: 45, condition: 'Coldest month, very dry', rain: 3 },
  },
  'paris': {
    1: { avgTemp: 40, humidity: 85, condition: 'Cold and gray', rain: 55 },
    7: { avgTemp: 75, humidity: 60, condition: 'Warm and pleasant', rain: 30 },
  },
  'tokyo': {
    1: { avgTemp: 42, humidity: 55, condition: 'Cold and dry', rain: 25 },
    7: { avgTemp: 80, humidity: 80, condition: 'Hot and humid', rain: 50 },
  },
};

// Get historical average weather for a destination
function getHistoricalWeather(location: string, month: number): { avgTemp: number; humidity: number; condition: string; rain: number } | null {
  const locationLower = location.toLowerCase();
  for (const [key, data] of Object.entries(HISTORICAL_WEATHER)) {
    if (locationLower.includes(key)) {
      return data[month] || data[Object.keys(data)[0] as any] || null;
    }
  }
  return null;
}

// Get weather - current or forecast
async function getWeather(query: string, dateStr?: string): Promise<any> {
  const apiKey = Deno.env.get('WEATHER_API_KEY');
  if (!apiKey) {
    console.log('No WEATHER_API_KEY configured');
    return null;
  }
  
  try {
    console.log('🌍 Fetching weather for:', query, dateStr ? `on ${dateStr}` : '');
    
    // Check if date is too far in future (>14 days)
    if (dateStr) {
      const targetDate = parseFutureDate(dateStr);
      if (targetDate) {
        const daysAway = (targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysAway > 14) {
          console.log('Date is too far in future, using historical averages');
          const historical = getHistoricalWeather(query, targetDate.getMonth() + 1);
          if (historical) {
            return {
              isFutureForecast: true,
              historical: true,
              location: { name: query },
              targetMonth: targetDate.toLocaleString('default', { month: 'long' }),
              targetYear: targetDate.getFullYear(),
              averageConditions: historical,
            };
          }
        }
      }
    }
    
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(query)}&days=14&aqi=yes`;
    
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
    // Match "jan", "january", "next jan", etc with optional day number
    const regexWithDay = new RegExp(`(?:next\\s+)?${monthNames[i]}\\w*(?:\\s+(\\d{1,2}))?`, 'i');
    const match = lower.match(regexWithDay);
    if (match) {
      const day = match[1] ? parseInt(match[1]) : 15; // Default to middle of month
      const targetDate = new Date(now.getFullYear(), i, day);
      if (targetDate < now) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      }
      return targetDate;
    }
  }
  
  return null;
}

// Improved location extraction - handles more cases
function extractLocationFromMessage(message: string): { location: string; date?: string } | null {
  const lower = message.toLowerCase();
  
  // Extract date first
  let extractedDate: string | undefined;
  const datePatterns = [
    /(?:next|this|in)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})?/i,
    /(?:on|for)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})?/i,
    /(tomorrow)/i,
    /(next\s+week)/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      extractedDate = match[0];
      break;
    }
  }
  
  // Known city mappings
  const cityPatterns = [
    { pattern: /\bmachu\s*pich?u\b/i, city: 'Machu Picchu, Peru' },
    { pattern: /\bcusco\b/i, city: 'Cusco, Peru' },
    { pattern: /\bdoor\s*county\b/i, city: 'Door County, Wisconsin' },
    { pattern: /\byellowstone\b/i, city: 'Yellowstone National Park, Wyoming' },
    { pattern: /\bgrand\s*canyon\b/i, city: 'Grand Canyon, Arizona' },
    { pattern: /\byosemite\b/i, city: 'Yosemite National Park, California' },
    { pattern: /\bparis\b/i, city: 'Paris, France' },
    { pattern: /\blondon\b/i, city: 'London, UK' },
    { pattern: /\btokyo\b/i, city: 'Tokyo, Japan' },
    { pattern: /\bsydney\b/i, city: 'Sydney, Australia' },
    { pattern: /\brome\b/i, city: 'Rome, Italy' },
    { pattern: /\bbarcelona\b/i, city: 'Barcelona, Spain' },
    { pattern: /\bamsterdam\b/i, city: 'Amsterdam, Netherlands' },
    { pattern: /\bdenver\b/i, city: 'Denver, Colorado' },
    { pattern: /\bseattle\b/i, city: 'Seattle, Washington' },
    { pattern: /\bmiami\b/i, city: 'Miami, Florida' },
    { pattern: /\bnyc\b|\bnew\s*york\b/i, city: 'New York City' },
    { pattern: /\bla\b|\blos\s*angeles\b/i, city: 'Los Angeles, California' },
    { pattern: /\bsfo\b|\bsf\b|\bsan\s*francisco\b/i, city: 'San Francisco, California' },
    { pattern: /\bchicago\b/i, city: 'Chicago, Illinois' },
    { pattern: /\bboston\b/i, city: 'Boston, Massachusetts' },
    { pattern: /\baustin\b/i, city: 'Austin, Texas' },
    { pattern: /\bdallas\b/i, city: 'Dallas, Texas' },
    { pattern: /\bhouston\b/i, city: 'Houston, Texas' },
    { pattern: /\bphoenix\b/i, city: 'Phoenix, Arizona' },
    { pattern: /\bvegas\b|\blas\s*vegas\b/i, city: 'Las Vegas, Nevada' },
    { pattern: /\batlanta\b/i, city: 'Atlanta, Georgia' },
    { pattern: /\borlando\b/i, city: 'Orlando, Florida' },
    { pattern: /\bsalt\s*lake\b/i, city: 'Salt Lake City, Utah' },
    { pattern: /\bportland\b/i, city: 'Portland, Oregon' },
    { pattern: /\bsan\s*diego\b/i, city: 'San Diego, California' },
    { pattern: /\bdelhi\b|\bnew\s*delhi\b/i, city: 'New Delhi, India' },
    { pattern: /\bmumbai\b|\bbombay\b/i, city: 'Mumbai, India' },
    { pattern: /\bbangalore\b|\bbengaluru\b/i, city: 'Bangalore, India' },
    { pattern: /\bsingapore\b/i, city: 'Singapore' },
    { pattern: /\bhong\s*kong\b/i, city: 'Hong Kong' },
    { pattern: /\bdubai\b/i, city: 'Dubai, UAE' },
  ];
  
  for (const { pattern, city } of cityPatterns) {
    if (pattern.test(lower)) {
      return { location: city, date: extractedDate };
    }
  }
  
  // Try to extract from travel patterns
  const travelPatterns = [
    /(?:going|traveling|hiking|camping|visiting|heading)\s+(?:to|in)\s+([a-zA-Z][a-zA-Z\s,]+?)(?:\s+(?:next|tomorrow|this|for|on)|[?.!]|$)/i,
    /trip\s+to\s+([a-zA-Z][a-zA-Z\s,]+?)(?:\s+(?:next|tomorrow|this|for|on)|[?.!]|$)/i,
    /weather\s+(?:in|for|at)\s+([a-zA-Z][a-zA-Z\s,]+?)(?:\?|$)/i,
    /(?:in|at)\s+([a-zA-Z][a-zA-Z\s,]+?)\s+(?:weather|anything|what)/i,
  ];
  
  for (const pattern of travelPatterns) {
    const match = message.match(pattern);
    if (match) {
      let destination = match[1].trim().replace(/[,.]$/, '');
      const stopWords = ['work', 'home', 'bed', 'sleep', 'dinner', 'lunch', 'breakfast', 'the', 'a', 'like', 'about', 'my', 'your'];
      if (!stopWords.includes(destination.toLowerCase()) && destination.length > 2) {
        return { location: destination, date: extractedDate };
      }
    }
  }
  
  return null;
}

// Analyze user's flare history comprehensively
function analyzeFlareHistory(entries: FlareEntry[], period: 'week' | 'month' | 'all' = 'month') {
  if (!entries || entries.length === 0) {
    return null;
  }
  
  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  
  // Filter by period
  let periodEntries = entries;
  let periodLabel = '';
  
  if (period === 'week') {
    periodEntries = entries.filter(e => (now - new Date(e.timestamp).getTime()) <= 7 * dayMs);
    periodLabel = 'this week';
  } else if (period === 'month') {
    periodEntries = entries.filter(e => (now - new Date(e.timestamp).getTime()) <= 30 * dayMs);
    periodLabel = 'this month';
  }
  
  const flares = periodEntries.filter(e => e.type === 'flare' || e.severity);
  
  // Previous period for comparison
  let prevPeriodEntries: FlareEntry[] = [];
  if (period === 'week') {
    prevPeriodEntries = entries.filter(e => {
      const age = (now - new Date(e.timestamp).getTime()) / dayMs;
      return age > 7 && age <= 14;
    });
  } else if (period === 'month') {
    prevPeriodEntries = entries.filter(e => {
      const age = (now - new Date(e.timestamp).getTime()) / dayMs;
      return age > 30 && age <= 60;
    });
  }
  const prevFlares = prevPeriodEntries.filter(e => e.type === 'flare' || e.severity);
  
  // Severity breakdown
  const severeCount = flares.filter(f => f.severity === 'severe').length;
  const moderateCount = flares.filter(f => f.severity === 'moderate').length;
  const mildCount = flares.filter(f => f.severity === 'mild').length;
  
  // Average severity (1-3 scale)
  const avgSeverity = flares.length > 0 
    ? flares.reduce((sum, f) => sum + (f.severity === 'severe' ? 3 : f.severity === 'moderate' ? 2 : 1), 0) / flares.length
    : 0;
  
  // Symptom frequency
  const symptomCounts: Record<string, number> = {};
  flares.forEach(f => {
    f.symptoms?.forEach(s => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
  });
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  // Trigger frequency (from explicit triggers + extracted from notes)
  const triggerCounts: Record<string, number> = {};
  flares.forEach(f => {
    f.triggers?.forEach(t => { triggerCounts[t] = (triggerCounts[t] || 0) + 1; });
    // Also extract from notes
    if (f.note) {
      const foodMatch = f.note.match(/(?:ate|eat|had)\s+(\w+)/gi);
      if (foodMatch) {
        foodMatch.forEach(m => {
          const food = m.replace(/ate|eat|had/gi, '').trim();
          if (food.length > 2) triggerCounts[food] = (triggerCounts[food] || 0) + 1;
        });
      }
    }
  });
  const topTriggers = Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  // Time patterns
  const hourCounts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  flares.forEach(f => {
    const hour = new Date(f.timestamp).getHours();
    if (hour >= 6 && hour < 12) hourCounts.morning++;
    else if (hour >= 12 && hour < 18) hourCounts.afternoon++;
    else if (hour >= 18 && hour < 22) hourCounts.evening++;
    else hourCounts.night++;
  });
  const peakTime = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  
  // Day of week patterns
  const dayCounts: Record<string, number> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  flares.forEach(f => {
    const day = dayNames[new Date(f.timestamp).getDay()];
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  
  // Weather correlations
  const weatherCounts: Record<string, number> = {};
  flares.forEach(f => {
    const condition = f.environmental_data?.weather?.condition;
    if (condition) {
      weatherCounts[condition] = (weatherCounts[condition] || 0) + 1;
    }
  });
  const topWeather = Object.entries(weatherCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  // Trend
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (flares.length > prevFlares.length * 1.3) trend = 'increasing';
  else if (flares.length < prevFlares.length * 0.7 && prevFlares.length > 0) trend = 'decreasing';
  
  // Days since last flare
  const lastFlare = flares[0];
  const daysSinceFlare = lastFlare 
    ? Math.floor((now - new Date(lastFlare.timestamp).getTime()) / dayMs)
    : null;
  
  return {
    periodLabel,
    totalFlares: flares.length,
    prevPeriodFlares: prevFlares.length,
    trend,
    severeCount,
    moderateCount,
    mildCount,
    avgSeverity: avgSeverity.toFixed(1),
    topSymptoms,
    topTriggers,
    peakTime: peakTime ? { time: peakTime[0], count: peakTime[1] } : null,
    peakDay: peakDay ? { day: peakDay[0], count: peakDay[1] } : null,
    topWeather,
    daysSinceFlare,
    medicationLogs: periodEntries.filter(e => e.type === 'medication').length,
    wellnessLogs: periodEntries.filter(e => e.type === 'wellness').length,
  };
}

// Extract conversation context for trigger linking
function extractConversationContext(history: Array<{ role: string; content: string }>): ConversationContext {
  const recentMentions: string[] = [];
  let pendingTrigger: string | undefined;
  
  const recentHistory = history.slice(-5);
  
  const foodPatterns = [
    /(?:ate|eat|eating|had|consumed|tried|drank|drinking)\s+(?:some\s+)?(\w+(?:\s+\w+)?)/gi,
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
          pendingTrigger = item;
        }
      }
    });
  });
  
  return { recentMentions: [...new Set(recentMentions)], pendingTrigger };
}

// Check if user is providing additional context for the last entry (update intent)
function isUpdateIntent(message: string, history: Array<{ role: string; content: string }>): { isUpdate: boolean; additionalInfo: string } {
  const lower = message.toLowerCase();
  
  // Patterns that indicate user is adding context to previous log
  const updatePatterns = [
    /^(?:it was|was)\s+(?:also\s+)?(.+)/i,
    /^(?:also|and|btw|by the way)\s*[,:]?\s*(.+)/i,
    /^(?:there was|it's|its)\s+(.+)/i,
    /(?:raining|rain|cold|hot|humid|windy|sunny)/i,
    /(?:stressed|stress|anxious|tired)/i,
  ];
  
  // Check if recent history has a flare log
  const recentAssistant = history.slice(-3).find(m => 
    m.role === 'assistant' && 
    (m.content.toLowerCase().includes('logged') || m.content.toLowerCase().includes('flare'))
  );
  
  if (recentAssistant) {
    for (const pattern of updatePatterns) {
      if (pattern.test(lower)) {
        return { isUpdate: true, additionalInfo: message };
      }
    }
  }
  
  return { isUpdate: false, additionalInfo: '' };
}

interface IntentResult {
  type: string;
  confidence: number;
  extractedData: any;
}

// Extract ALL intents from a message (e.g., "felt pain and took meds" = 2 intents)
function classifyMultipleIntents(message: string, userContext?: UserContext): IntentResult[] {
  const lower = message.toLowerCase();
  const intents: IntentResult[] = [];
  
  // OFF-TOPIC DETECTION - reject non-health queries first
  const offTopicPatterns = [
    /\b(?:write|code|program|script|python|javascript|java|c\+\+|html|css)\b/i,
    /\b(?:calculate|compute|math|equation|algebra|calculus)\b/i,
    /\b(?:recipe|cook|cooking|bake|baking)\b.*(?:how|make|prepare)/i,
    /\b(?:tell me a joke|sing|poem|story|write a|create a)\b/i,
    /\b(?:translate|translation)\b/i,
    /\b(?:stock|crypto|bitcoin|investment|trading)\b/i,
    /\b(?:game|gaming|play|movie|music|song|book)\b.*(?:recommend|suggest)/i,
  ];
  
  for (const pattern of offTopicPatterns) {
    if (pattern.test(lower)) {
      return [{ type: 'off_topic', confidence: 0.99, extractedData: { reason: 'non-health-query' } }];
    }
  }
  
  // Flare analysis queries - highest priority, single intent
  if (/\b(?:how(?:'s| is| are)?|what(?:'s| is)?|show|tell|give|my)\b.*\b(?:flares?|symptoms?|week|month|data|history|patterns?|triggers?|progress)\b/i.test(lower) ||
      /\bpast (?:week|month|day|year)\b/i.test(lower) ||
      /\bflares? (?:this|the|past|last)\b/i.test(lower) ||
      /\banalysis|analytics|insights?|summary\b/i.test(lower) ||
      /\bhow(?:'s| is| am| are)?\s+(?:i|my)\b/i.test(lower)) {
    const period = /\bweek\b/i.test(lower) ? 'week' : /\bmonth\b/i.test(lower) ? 'month' : 'month';
    return [{ type: 'flare_analysis', confidence: 0.95, extractedData: { period, wantsChart: true } }];
  }
  
  // Travel/weather queries - single intent
  if (/^weather\??$/i.test(lower.trim()) || /\b(?:what'?s?|how'?s?)\s+(?:the\s+)?weather\b/i.test(lower)) {
    if (userContext?.currentLocation?.city) {
      return [{ type: 'travel_query', confidence: 0.9, extractedData: { location: userContext.currentLocation.city, useCurrentLocation: true } }];
    }
    if (userContext?.currentLocation?.latitude) {
      return [{ type: 'travel_query', confidence: 0.9, extractedData: { 
        location: `${userContext.currentLocation.latitude},${userContext.currentLocation.longitude}`,
        useCurrentLocation: true 
      }}];
    }
  }
  
  const locationInfo = extractLocationFromMessage(message);
  if (locationInfo) {
    return [{ type: 'travel_query', confidence: 0.95, extractedData: locationInfo }];
  }
  
  if (/\b(?:anything|something)\s+(?:to\s+)?(?:watch|look)\s+(?:out\s+)?for\b/i.test(lower) ||
      /\bshould\s+I\s+(?:worry|be\s+careful)\b/i.test(lower)) {
    if (userContext?.currentLocation?.city) {
      return [{ type: 'travel_query', confidence: 0.85, extractedData: { 
        location: userContext.currentLocation.city, 
        useCurrentLocation: true,
        isActivityCheck: true 
      }}];
    }
  }
  
  // ===== MULTI-INTENT EXTRACTION =====
  // Now check for multiple loggable items in the same message
  
  // 1. Check for medication mentions
  const medPatterns = [
    /(?:took|take|taking|had)\s+(?:my\s+)?(\d+\s*(?:mg|ml|units?)?\s+)?(\w+)/gi,
    /(\w+)\s+(?:taken|medication|meds?)/gi,
  ];
  
  for (const pattern of medPatterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const dosage = match[1]?.trim();
      const medName = (match[2] || match[1])?.toLowerCase();
      
      // Skip common non-medication words
      const skipWords = ['my', 'the', 'a', 'it', 'that', 'this', 'some', 'pain', 'nap', 'walk', 'break', 'rest'];
      if (skipWords.includes(medName)) continue;
      
      // Check if it matches a user's medication
      const userMeds = userContext?.medications || [];
      const matchedMed = userMeds.find(m => 
        m.name.toLowerCase().includes(medName) || 
        medName.includes(m.name.toLowerCase().split(' ')[0])
      );
      
      if (matchedMed || /\b(insulin|advil|tylenol|ibuprofen|metformin|aspirin|prednisone|humira|enbrel|xanax|zoloft|lexapro|synthroid|lisinopril)\b/i.test(medName)) {
        intents.push({ 
          type: 'medication', 
          confidence: matchedMed ? 0.95 : 0.8, 
          extractedData: { 
            medicationName: matchedMed?.name || medName, 
            dosage,
            note: message,
            matched: !!matchedMed
          } 
        });
      }
    }
  }
  
  // 2. Check for symptoms/flare mentions
  const symptomPatterns = [
    { pattern: /(severe|bad|terrible|horrible|awful|worst)\s+(pain|headache|migraine|ache)/i, severity: 'severe' },
    { pattern: /(mild|slight|little|bit of)\s+(pain|headache|discomfort)/i, severity: 'mild' },
    { pattern: /having\s+a\s+(flare|attack|episode)/i, severity: 'moderate' },
    { pattern: /\b(headache|migraine|nausea|dizzy|dizziness|vertigo|fatigue|exhausted|pain|cramp|cramping|brain fog|fog|loss of appetite|joint pain|stiffness|swelling|inflammation)\b/i, severity: 'moderate' },
    { pattern: /\bfelt\s+(pain|bad|terrible|sick|awful|nauseous|dizzy)\b/i, severity: 'moderate' },
    { pattern: /\bhurting|aching|throbbing|burning\b/i, severity: 'moderate' },
  ];
  
  let detectedSymptoms: string[] = [];
  let detectedSeverity = 'moderate';
  let hasFlareIntent = false;
  
  for (const { pattern, severity } of symptomPatterns) {
    if (pattern.test(lower)) {
      hasFlareIntent = true;
      if (severity === 'severe') detectedSeverity = 'severe';
      else if (severity === 'mild' && detectedSeverity !== 'severe') detectedSeverity = 'mild';
      
      // Extract specific symptoms
      const symptomList = ['headache', 'migraine', 'nausea', 'dizziness', 'fatigue', 'pain', 'cramping', 'brain fog', 'loss of appetite', 'joint pain', 'stiffness', 'swelling', 'inflammation', 'vertigo'];
      symptomList.forEach(s => { 
        if (lower.includes(s) && !detectedSymptoms.includes(s)) {
          detectedSymptoms.push(s); 
        }
      });
    }
  }
  
  if (hasFlareIntent) {
    intents.push({ 
      type: 'flare', 
      confidence: 0.85, 
      extractedData: { severity: detectedSeverity, symptoms: detectedSymptoms } 
    });
  }
  
  // 3. Check for food/trigger mentions
  const foodMatch = lower.match(/(?:ate|eat|eating|had|consumed)\s+(?:some\s+)?(\w+(?:\s+\w+)?)/i);
  if (foodMatch) {
    const food = foodMatch[1]?.trim();
    const skipFoods = ['it', 'that', 'this', 'some', 'a', 'the', 'breakfast', 'lunch', 'dinner', 'meal'];
    if (food && !skipFoods.includes(food.toLowerCase())) {
      intents.push({ type: 'food_log', confidence: 0.9, extractedData: { food } });
    }
  }
  
  // 4. Check for wellness mentions
  if (/feeling\s+(good|great|better|amazing|wonderful|fantastic|well|fine|okay)/i.test(lower) ||
      /no\s+(pain|symptoms|issues|problems|flares?)/i.test(lower) ||
      /\b(feeling great|doing well|good day|better today)\b/i.test(lower)) {
    intents.push({ type: 'wellness', confidence: 0.9, extractedData: { energyLevel: 'good' } });
  }
  
  // 5. Check for energy mentions
  if (/(low|no|zero)\s+energy/i.test(lower) || /feeling\s+(tired|exhausted|drained|wiped)/i.test(lower)) {
    // Only add if not already captured as flare
    if (!hasFlareIntent) {
      intents.push({ type: 'energy', confidence: 0.85, extractedData: { energyLevel: 'low' } });
    }
  }
  
  // If we found multiple intents, return them all
  if (intents.length > 0) {
    // Remove duplicates by type
    const uniqueIntents = intents.filter((intent, index, self) => 
      index === self.findIndex(i => i.type === intent.type)
    );
    return uniqueIntents;
  }
  
  return [{ type: 'unknown', confidence: 0, extractedData: {} }];
}

// Backward compatibility wrapper
function classifyIntent(message: string, userContext?: UserContext): IntentResult {
  const intents = classifyMultipleIntents(message, userContext);
  return intents[0] || { type: 'unknown', confidence: 0, extractedData: {} };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── JWT Auth Guard ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authenticatedUserId = claimsData.claims.sub as string;
    // ─────────────────────────────────────────────────────────────────────

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { message, userContext, history } = await req.json() as {
      message: string;
      userContext: UserContext;
      history: Array<{ role: string; content: string }>;
    };
    // Enforce: use authenticated user ID only
    const userId = authenticatedUserId;
    
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    console.log('💬 Message:', message);
    console.log('📍 Conditions:', userContext.conditions);
    
    // === ACTIVITY DETECTION FOR CORRELATION ENGINE ===
    const detectedActivity = detectActivity(message);
    let activityLog = null;
    let correlationWarning = null;
    let shouldFollowUp = false;
    let followUpDelay = 0;
    
    if (detectedActivity && userId) {
      console.log(`🏃 Activity detected: ${detectedActivity.type} (${detectedActivity.intensity})`);
      
      // Log the activity
      const { data: newActivityLog, error: logError } = await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          activity_type: detectedActivity.type,
          activity_value: detectedActivity.value,
          intensity: detectedActivity.intensity,
          timestamp: new Date().toISOString(),
          followed_up: false,
        })
        .select()
        .single();
      
      if (!logError && newActivityLog) {
        activityLog = newActivityLog;
        shouldFollowUp = true;
        followUpDelay = detectedActivity.type === 'run' || detectedActivity.type === 'gym' ? 30 : 60;
        
        // Check for existing correlations for this activity
        const { data: existingCorrelations } = await supabase
          .from('correlations')
          .select('*')
          .eq('user_id', userId)
          .eq('trigger_type', 'activity')
          .eq('trigger_value', detectedActivity.type)
          .gte('confidence', 0.3)
          .gte('occurrence_count', 2)
          .order('confidence', { ascending: false })
          .limit(3);
        
        if (existingCorrelations && existingCorrelations.length > 0) {
          const topCorr = existingCorrelations[0];
          correlationWarning = {
            triggerType: 'activity',
            triggerValue: detectedActivity.type,
            outcomeType: topCorr.outcome_type,
            outcomeValue: topCorr.outcome_value,
            occurrenceCount: topCorr.occurrence_count,
            confidence: topCorr.confidence,
            avgDelayMinutes: topCorr.avg_delay_minutes,
          };
          console.log(`⚠️ Correlation warning: ${detectedActivity.type} → ${topCorr.outcome_value} (${topCorr.occurrence_count}x)`);
        }
      }
    }
    
    // Get ALL intents from message (supports multi-intent like "felt pain and took meds")
    const allIntents = classifyMultipleIntents(message, userContext);
    const intent = allIntents[0]; // Primary intent for backward compatibility
    console.log('🎯 Intents detected:', allIntents.map(i => `${i.type}(${i.confidence})`).join(', '));
    
    // Handle off-topic requests immediately
    if (intent.type === 'off_topic') {
      return new Response(JSON.stringify({
        response: "I'm Jvala, your health tracking assistant. I can help with logging symptoms, tracking flares, checking weather for your activities, and analyzing your health patterns. What would you like to do?",
        isAIGenerated: false,
        dataUsed: [],
        shouldLog: false,
        entryData: null,
        multipleEntries: null,
        activityLog: null,
        correlationWarning: null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const conversationContext = extractConversationContext(history || []);
    
    // Link symptoms to pending triggers
    let linkedTrigger: string | undefined;
    if ((intent.type === 'flare' || message.toLowerCase().includes('symptom')) && conversationContext.pendingTrigger) {
      linkedTrigger = conversationContext.pendingTrigger;
      console.log('🔗 Linked trigger:', linkedTrigger);
    }
    
    // === BUILD CORRELATIONS WHEN FLARE IS LOGGED ===
    let correlationsBuilt = 0;
    if (intent.type === 'flare' && userId) {
      console.log('🔍 Building correlations for flare...');
      
      // Get recent activities (last 24 hours)
      const lookbackTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentActivities } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', lookbackTime)
        .order('timestamp', { ascending: false });
      
      if (recentActivities && recentActivities.length > 0) {
        const flareTime = Date.now();
        const symptoms = intent.extractedData?.symptoms || [];
        const severity = intent.extractedData?.severity || 'moderate';
        
        for (const activity of recentActivities) {
          const activityTime = new Date(activity.timestamp).getTime();
          const delayMinutes = Math.round((flareTime - activityTime) / (1000 * 60));
          
          // Only correlate if activity was 15 min to 24 hours before
          if (delayMinutes > 15 && delayMinutes < 1440) {
            // Build correlation for activity → each symptom
            for (const symptom of symptoms) {
              const { data: existing } = await supabase
                .from('correlations')
                .select('*')
                .eq('user_id', userId)
                .eq('trigger_type', 'activity')
                .eq('trigger_value', activity.activity_type)
                .eq('outcome_type', 'symptom')
                .eq('outcome_value', symptom)
                .maybeSingle();
              
              if (existing) {
                const newCount = existing.occurrence_count + 1;
                const newAvgDelay = Math.round((existing.avg_delay_minutes * (newCount - 1) + delayMinutes) / newCount);
                const newConfidence = Math.min(Math.log2(newCount + 1) / 5, 0.7) + 0.3;
                
                await supabase
                  .from('correlations')
                  .update({
                    occurrence_count: newCount,
                    avg_delay_minutes: newAvgDelay,
                    confidence: Math.min(newConfidence, 1.0),
                    last_occurred: new Date().toISOString(),
                  })
                  .eq('id', existing.id);
              } else {
                await supabase
                  .from('correlations')
                  .insert({
                    user_id: userId,
                    trigger_type: 'activity',
                    trigger_value: activity.activity_type,
                    outcome_type: 'symptom',
                    outcome_value: symptom,
                    avg_delay_minutes: delayMinutes,
                    occurrence_count: 1,
                    confidence: 0.2,
                    last_occurred: new Date().toISOString(),
                  });
              }
              correlationsBuilt++;
            }
            
            // Mark activity as followed up
            await supabase
              .from('activity_logs')
              .update({
                followed_up: true,
                follow_up_result: { symptoms, severity, delay_minutes: delayMinutes }
              })
              .eq('id', activity.id);
          }
        }
        
        console.log(`✅ Built ${correlationsBuilt} correlations from flare`);
      }
    }
    
    // Build multiple entry data from all intents
    const multipleEntries: any[] = [];
    for (const intentItem of allIntents) {
      if (intentItem.type === 'flare') {
        multipleEntries.push({
          type: 'flare',
          severity: intentItem.extractedData.severity || 'moderate',
          symptoms: intentItem.extractedData.symptoms || [],
          triggers: linkedTrigger ? [linkedTrigger] : [],
        });
      } else if (intentItem.type === 'medication') {
        multipleEntries.push({
          type: 'medication',
          medicationName: intentItem.extractedData.medicationName,
          dosage: intentItem.extractedData.dosage,
          note: intentItem.extractedData.note,
        });
      } else if (intentItem.type === 'wellness') {
        multipleEntries.push({
          type: 'wellness',
          energyLevel: 'good',
        });
      } else if (intentItem.type === 'energy') {
        multipleEntries.push({
          type: 'energy',
          energyLevel: intentItem.extractedData.energyLevel || 'low',
        });
      } else if (intentItem.type === 'food_log') {
        // Food logs become triggers for any flare entry
        const food = intentItem.extractedData.food;
        if (food) {
          const flareEntry = multipleEntries.find(e => e.type === 'flare');
          if (flareEntry) {
            flareEntry.triggers = flareEntry.triggers || [];
            if (!flareEntry.triggers.includes(food)) {
              flareEntry.triggers.push(food);
            }
          }
        }
      }
    }
    
    console.log('📝 Multiple entries to log:', multipleEntries.length, multipleEntries.map(e => e.type).join(', '));
    
    // Analyze flare history
    const flareAnalysis = analyzeFlareHistory(
      userContext.recentEntries || [], 
      intent.extractedData?.period || 'month'
    );
    
    // Get weather for travel queries
    let weatherData = null;
    let weatherCard = null;
    let weatherInfo = '';
    let isFutureForecast = false;
    
    if (intent.type === 'travel_query' && intent.extractedData?.location) {
      const { location, date } = intent.extractedData;
      console.log('🌍 Getting weather for:', location, 'date:', date);
      weatherData = await getWeather(location, date);
      
      if (weatherData?.historical) {
        // Future forecast using historical averages
        isFutureForecast = true;
        const avg = weatherData.averageConditions;
        weatherInfo = `
HISTORICAL WEATHER DATA for ${weatherData.location.name} in ${weatherData.targetMonth}:
This is a FAR FUTURE date, so we use historical averages:
- Average Temperature: ${avg.avgTemp}°F
- Typical Humidity: ${avg.humidity}%
- Typical Conditions: ${avg.condition}
- Chance of Rain: ${avg.rain}%

NOTE: This is based on historical averages for ${weatherData.targetMonth}. Exact forecast not available this far in advance.`;

        weatherCard = {
          location: weatherData.location.name,
          country: '',
          isHistorical: true,
          historicalNote: `Average conditions for ${weatherData.targetMonth} ${weatherData.targetYear}`,
          current: {
            temp_f: avg.avgTemp,
            condition: avg.condition,
            humidity: avg.humidity,
            feelslike_f: avg.avgTemp,
          },
          forecast: {
            date: `${weatherData.targetMonth} ${weatherData.targetYear}`,
            maxtemp_f: avg.avgTemp + 5,
            mintemp_f: avg.avgTemp - 5,
            condition: avg.condition,
            daily_chance_of_rain: avg.rain,
          },
        };
      } else if (weatherData?.current) {
        const current = weatherData.current;
        const forecast = weatherData.forecast?.forecastday?.[0]?.day;
        const targetDay = weatherData.targetDayForecast?.day;
        const aqi = current?.air_quality;
        
        weatherCard = {
          location: weatherData.location?.name,
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
            daily_chance_of_rain: targetDay.daily_chance_of_rain,
          } : forecast ? {
            maxtemp_f: forecast.maxtemp_f,
            mintemp_f: forecast.mintemp_f,
            condition: forecast.condition?.text,
            daily_chance_of_rain: forecast.daily_chance_of_rain,
          } : null,
          aqi: aqi?.['us-epa-index'],
        };
        
        const relevantForecast = targetDay || forecast;
        weatherInfo = `
CURRENT WEATHER DATA for ${weatherData.location?.name}, ${weatherData.location?.country || ''}:
- Current: ${current?.condition?.text}, ${current?.temp_f}°F (feels like ${current?.feelslike_f}°F)
- Humidity: ${current?.humidity}%
- UV Index: ${current?.uv}
- AQI: ${aqi?.['us-epa-index'] || 'N/A'}

${targetDay ? `Forecast for ${weatherData.targetDayForecast?.date}:` : "Today's Forecast:"}
- High: ${relevantForecast?.maxtemp_f}°F, Low: ${relevantForecast?.mintemp_f}°F
- Condition: ${relevantForecast?.condition?.text}
- Rain chance: ${relevantForecast?.daily_chance_of_rain}%`;
      }
    }
    
    // Build flare analysis summary for AI
    let flareAnalysisInfo = '';
    if (flareAnalysis) {
      flareAnalysisInfo = `
FLARE ANALYSIS for ${flareAnalysis.periodLabel}:
- Total flares: ${flareAnalysis.totalFlares}
- Previous period: ${flareAnalysis.prevPeriodFlares} flares
- Trend: ${flareAnalysis.trend.toUpperCase()}
- Severity breakdown: ${flareAnalysis.severeCount} severe, ${flareAnalysis.moderateCount} moderate, ${flareAnalysis.mildCount} mild
- Average severity: ${flareAnalysis.avgSeverity}/3.0
${flareAnalysis.daysSinceFlare !== null ? `- Days since last flare: ${flareAnalysis.daysSinceFlare}` : ''}

Top Symptoms: ${flareAnalysis.topSymptoms.map(([s, c]) => `${s} (${c}x)`).join(', ') || 'None recorded'}
Top Triggers: ${flareAnalysis.topTriggers.map(([t, c]) => `${t} (${c}x)`).join(', ') || 'None recorded'}
Peak Time: ${flareAnalysis.peakTime ? `${flareAnalysis.peakTime.time} (${flareAnalysis.peakTime.count} flares)` : 'No pattern'}
Peak Day: ${flareAnalysis.peakDay ? `${flareAnalysis.peakDay.day} (${flareAnalysis.peakDay.count} flares)` : 'No pattern'}
Weather Correlations: ${flareAnalysis.topWeather.map(([w, c]) => `${w} (${c}x)`).join(', ') || 'Not enough data'}

Also logged: ${flareAnalysis.medicationLogs} medications, ${flareAnalysis.wellnessLogs} wellness entries`;
    }
    
    // Build system prompt
    const systemPrompt = `You are Jvala, a smart health companion. Be warm, concise, and data-driven.

CRITICAL RULES:
1. For FLARE ANALYSIS queries: Give specific numbers from the data. Never say "still gathering" or generic phrases.
2. For TRAVEL queries: 
   - If far future (>2 weeks), use HISTORICAL AVERAGES and say "Based on historical data for [Month]..."
   - If within 2 weeks, use actual forecast data
   - Compare conditions to user's known triggers
3. Keep responses SHORT (2-4 sentences max) unless detailed analysis requested
4. When symptoms follow food mentions, LINK THEM as triggers

USER PROFILE:
- Conditions: ${userContext.conditions?.join(', ') || 'General health tracking'}
- Known triggers: ${userContext.knownTriggers?.join(', ') || 'Analyzing...'}
- Known symptoms: ${userContext.knownSymptoms?.join(', ') || 'Analyzing...'}

${flareAnalysisInfo}

${weatherInfo}

INTENT: ${intent.type} (${intent.confidence})
${allIntents.length > 1 ? `MULTIPLE INTENTS DETECTED: ${allIntents.map(i => i.type).join(', ')} - acknowledge ALL items user mentioned!` : ''}
${linkedTrigger ? `IMPORTANT: User mentioned "${linkedTrigger}" recently and now has symptoms - log as trigger!` : ''}
${conversationContext.recentMentions.length ? `Recent conversation mentions: ${conversationContext.recentMentions.join(', ')}` : ''}

RESPONSE FORMAT (valid JSON):
{
  "response": "Your response with SPECIFIC DATA - if multiple items logged, confirm each one briefly",
  "isAIGenerated": true,
  "dataUsed": ["flare_history", "weather_api"],
  "weatherUsed": ${weatherData ? 'true' : 'false'},
  "shouldLog": true/false,
  "entryData": { "type": "flare|medication|wellness|energy", "severity": "mild|moderate|severe", "triggers": [], "symptoms": [] } or null
}

EXAMPLES:
- Flare analysis: "This month you had 12 flares (4 severe, 5 moderate, 3 mild). That's up from 8 last month. Your top trigger is stress (5x) and most flares happen in the evening."
- Travel (future): "January in Machu Picchu is rainy season—expect ~55°F with 75% chance of rain and 85% humidity. High humidity has triggered 6 of your past flares, so pack accordingly."
- Travel (current): "Door County is currently 30°F with mist. The high humidity (96%) matches conditions that triggered 4 of your past flares."`;

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
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          response: "Rate limited. Try again in a moment!",
          isAIGenerated: false, dataUsed: [], shouldLog: false,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Ensure linked trigger is in entry data
          let entryData = parsed.entryData;
          if (linkedTrigger && entryData?.type === 'flare') {
            entryData.triggers = entryData.triggers || [];
            if (!entryData.triggers.includes(linkedTrigger)) {
              entryData.triggers.push(linkedTrigger);
            }
          }
          
          // Build chart data for flare analysis queries
          let chartData = null;
          if (intent.type === 'flare_analysis' && flareAnalysis) {
            chartData = {
              type: 'severity',
              data: {
                severe: flareAnalysis.severeCount,
                moderate: flareAnalysis.moderateCount,
                mild: flareAnalysis.mildCount,
              }
            };
          }
          
          // Use multipleEntries if we detected more than 1 loggable item
          const shouldUseMultiple = multipleEntries.length > 1;
          
          return new Response(JSON.stringify({
            response: parsed.response,
            isAIGenerated: true,
            dataUsed: parsed.dataUsed || [],
            weatherUsed: !!weatherData,
            weatherCard,
            chartData,
            shouldLog: shouldUseMultiple ? true : (parsed.shouldLog || false),
            entryData: shouldUseMultiple ? null : entryData,
            multipleEntries: shouldUseMultiple ? multipleEntries : null,
            activityLog,
            correlationWarning,
            shouldFollowUp,
            followUpDelay,
            correlationsBuilt,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (e) {
        console.log('Parse error, returning raw');
      }
      
      // Even if AI response parsing fails, still use our detected multiple entries
      const shouldUseMultiple = multipleEntries.length > 1;
      
      return new Response(JSON.stringify({
        response: content.replace(/```json\n?|\n?```/g, '').trim(),
        isAIGenerated: true,
        dataUsed: [],
        weatherUsed: !!weatherData,
        weatherCard,
        shouldLog: shouldUseMultiple ? true : false,
        entryData: shouldUseMultiple ? null : (multipleEntries[0] || null),
        multipleEntries: shouldUseMultiple ? multipleEntries : null,
        activityLog,
        correlationWarning,
        shouldFollowUp,
        followUpDelay,
        correlationsBuilt,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ 
      response: "Could you rephrase that?",
      isAIGenerated: false, dataUsed: [], shouldLog: false, entryData: null, multipleEntries: null,
      activityLog: null, correlationWarning: null, shouldFollowUp: false, followUpDelay: 0, correlationsBuilt: 0
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ 
      response: "Something went wrong. Basic logging still works!",
      isAIGenerated: false, dataUsed: [], shouldLog: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});