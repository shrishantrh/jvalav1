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
    const { latitude, longitude } = await req.json();
    
    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const weatherApiKey = Deno.env.get('WEATHER_API_KEY');
    if (!weatherApiKey) {
      console.error('WEATHER_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Weather API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch current weather with AQI from WeatherAPI.com
    const weatherUrl = `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${latitude},${longitude}&days=1&aqi=yes`;
    console.log('Fetching weather for:', latitude, longitude);
    
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error('Weather API error:', weatherResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch weather data' }),
        { status: weatherResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const weatherData = await weatherResponse.json();
    console.log('Weather data received successfully');

    const current = weatherData.current;
    const forecastDay = weatherData.forecast?.forecastday?.[0];
    const astro = forecastDay?.astro || {};

    // Extract location data
    const location = {
      latitude,
      longitude,
      address: weatherData.location.name,
      city: weatherData.location.name,
      region: weatherData.location.region,
      country: weatherData.location.country,
      timezone: weatherData.location.tz_id,
      localtime: weatherData.location.localtime,
    };

    // Comprehensive weather data
    const weather = {
      temperature: Math.round(current.temp_f), // Fahrenheit
      temperatureC: Math.round(current.temp_c),
      feelsLike: Math.round(current.feelslike_f),
      feelsLikeC: Math.round(current.feelslike_c),
      humidity: current.humidity,
      pressure: Math.round(current.pressure_mb * 0.02953), // Convert to inHg
      pressureMb: Math.round(current.pressure_mb),
      condition: current.condition.text,
      conditionIcon: current.condition.icon,
      windSpeed: Math.round(current.wind_mph),
      windSpeedKph: Math.round(current.wind_kph),
      windDirection: current.wind_dir,
      windDegree: current.wind_degree,
      windGusts: Math.round(current.gust_mph),
      visibility: Math.round(current.vis_miles),
      visibilityKm: Math.round(current.vis_km),
      uvIndex: current.uv,
      dewPoint: Math.round(current.dewpoint_f || (current.temp_f - ((100 - current.humidity) / 5))),
      cloudCover: current.cloud,
      precipitation: current.precip_in,
      precipitationMm: current.precip_mm,
      isDay: current.is_day === 1,
    };

    // Air quality with detailed breakdown
    const aq = current.air_quality || {};
    const airQuality = {
      aqi: Math.round(aq['us-epa-index'] || 50),
      aqiCategory: getAqiCategory(aq['us-epa-index'] || 50),
      pm25: Math.round(aq.pm2_5 || 0),
      pm10: Math.round(aq.pm10 || 0),
      o3: Math.round(aq.o3 || 0),
      no2: Math.round(aq.no2 || 0),
      so2: Math.round(aq.so2 || 0),
      co: Math.round(aq.co || 0),
      dominantPollutant: getDominantPollutant(aq),
      // Estimated pollen based on season, temperature, and wind
      pollenTree: estimatePollen('tree', weather.temperatureC, current.humidity, weather.windSpeed),
      pollenGrass: estimatePollen('grass', weather.temperatureC, current.humidity, weather.windSpeed),
      pollenWeed: estimatePollen('weed', weather.temperatureC, current.humidity, weather.windSpeed),
      pollenMold: estimatePollen('mold', weather.temperatureC, current.humidity, weather.windSpeed),
    };

    // Astronomy data
    const astronomy = {
      sunrise: astro.sunrise,
      sunset: astro.sunset,
      moonrise: astro.moonrise,
      moonset: astro.moonset,
      moonPhase: astro.moon_phase,
      moonIllumination: parseInt(astro.moon_illumination) || 0,
    };

    // Calculate day length
    const dayLength = calculateDayLength(astro.sunrise, astro.sunset);

    // Determine season based on current month and hemisphere
    const month = new Date().getMonth() + 1;
    const isNorthernHemisphere = latitude > 0;
    let season: 'spring' | 'summer' | 'fall' | 'winter';
    
    if (isNorthernHemisphere) {
      if (month >= 3 && month <= 5) season = 'spring';
      else if (month >= 6 && month <= 8) season = 'summer';
      else if (month >= 9 && month <= 11) season = 'fall';
      else season = 'winter';
    } else {
      if (month >= 3 && month <= 5) season = 'fall';
      else if (month >= 6 && month <= 8) season = 'winter';
      else if (month >= 9 && month <= 11) season = 'spring';
      else season = 'summer';
    }

    const result = {
      location,
      weather,
      airQuality,
      astronomy,
      dayLength,
      season,
      capturedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-weather function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getAqiCategory(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

function getDominantPollutant(aq: any): string {
  const pollutants = {
    pm25: aq.pm2_5 || 0,
    pm10: aq.pm10 || 0,
    o3: aq.o3 || 0,
    no2: aq.no2 || 0,
  };
  return Object.entries(pollutants).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'pm25';
}

function estimatePollen(type: 'tree' | 'grass' | 'weed' | 'mold', tempC: number, humidity: number, windMph: number): number {
  const month = new Date().getMonth() + 1;
  let base = 0;
  
  // Seasonal patterns
  if (type === 'tree') {
    if (month >= 2 && month <= 5) base = 60;
    else if (month >= 6 && month <= 8) base = 20;
    else base = 10;
  } else if (type === 'grass') {
    if (month >= 5 && month <= 8) base = 70;
    else if (month >= 3 && month <= 4 || month >= 9 && month <= 10) base = 30;
    else base = 10;
  } else if (type === 'weed') {
    if (month >= 8 && month <= 10) base = 75;
    else if (month >= 6 && month <= 7) base = 25;
    else base = 10;
  } else if (type === 'mold') {
    // Mold is humidity-dependent
    base = humidity > 70 ? 60 : humidity > 50 ? 40 : 20;
  }
  
  // Temperature modifier
  if (tempC < 5 || tempC > 35) base *= 0.3;
  else if (tempC > 15 && tempC < 30) base *= 1.2;
  
  // Wind modifier (more wind = more pollen spread but also dispersal)
  if (windMph > 10 && windMph < 25) base *= 1.3;
  else if (windMph > 25) base *= 0.8;
  
  // Rain reduces pollen
  if (humidity > 85) base *= 0.5;
  
  return Math.min(100, Math.max(0, Math.round(base + (Math.random() * 15 - 7))));
}

function calculateDayLength(sunrise: string, sunset: string): string {
  try {
    const parseTime = (timeStr: string) => {
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period?.toLowerCase() === 'pm' && hours !== 12) hours += 12;
      if (period?.toLowerCase() === 'am' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };
    
    const sunriseMin = parseTime(sunrise);
    const sunsetMin = parseTime(sunset);
    const diff = sunsetMin - sunriseMin;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m`;
  } catch {
    return '12h 0m';
  }
}