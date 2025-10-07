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

    // Fetch current weather from WeatherAPI.com
    const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${latitude},${longitude}&aqi=yes`;
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

    // Extract location data
    const location = {
      latitude,
      longitude,
      address: weatherData.location.name,
      city: weatherData.location.name,
      country: weatherData.location.country,
    };

    // Extract weather data
    const weather = {
      temperature: Math.round(weatherData.current.temp_c),
      humidity: weatherData.current.humidity,
      pressure: Math.round(weatherData.current.pressure_mb),
      condition: weatherData.current.condition.text.toLowerCase(),
      windSpeed: Math.round(weatherData.current.wind_kph),
    };

    // Extract air quality data
    const airQuality = {
      pollen: Math.round((weatherData.current.air_quality?.pm2_5 || 0) * 2), // Convert PM2.5 to 0-100 scale
      pollutants: Math.round(weatherData.current.air_quality?.pm10 || 0),
      aqi: Math.round(weatherData.current.air_quality?.['us-epa-index'] || 50),
    };

    // Determine season based on current month
    const month = new Date().getMonth() + 1;
    let season: 'spring' | 'summer' | 'fall' | 'winter';
    if (month >= 3 && month <= 5) season = 'spring';
    else if (month >= 6 && month <= 8) season = 'summer';
    else if (month >= 9 && month <= 11) season = 'fall';
    else season = 'winter';

    const result = {
      location,
      weather,
      airQuality,
      season,
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