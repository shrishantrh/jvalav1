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

    console.log('Fetching weather from Open-Meteo for:', latitude, longitude);

    // Open-Meteo API - completely FREE, no API key required!
    // Fetching current weather, hourly data, and daily data
    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude', latitude.toString());
    weatherUrl.searchParams.set('longitude', longitude.toString());
    weatherUrl.searchParams.set('timezone', 'auto');
    weatherUrl.searchParams.set('temperature_unit', 'fahrenheit');
    weatherUrl.searchParams.set('wind_speed_unit', 'mph');
    weatherUrl.searchParams.set('precipitation_unit', 'inch');
    
    // Current weather variables
    weatherUrl.searchParams.set('current', [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','));
    
    // Daily variables for sunrise/sunset and UV
    weatherUrl.searchParams.set('daily', [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'sunrise',
      'sunset',
      'daylight_duration',
      'uv_index_max',
      'precipitation_sum',
      'precipitation_probability_max',
    ].join(','));
    
    // Get 1 day of forecast
    weatherUrl.searchParams.set('forecast_days', '1');

    const weatherResponse = await fetch(weatherUrl.toString());
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error('Open-Meteo API error:', weatherResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch weather data' }),
        { status: weatherResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await weatherResponse.json();
    console.log('Open-Meteo data received successfully');

    const current = data.current;
    const daily = data.daily;

    // Reverse geocode to get city name using Open-Meteo's geocoding
    let cityName = 'Unknown';
    let region = '';
    let country = '';
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10`;
      const geoResponse = await fetch(geoUrl, {
        headers: { 'User-Agent': 'Jvala-Health-App/1.0' }
      });
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        cityName = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.municipality || 'Unknown';
        region = geoData.address?.state || geoData.address?.county || '';
        country = geoData.address?.country || '';
      }
    } catch (e) {
      console.log('Geocoding failed, using coordinates');
    }

    // Map WMO weather codes to descriptions
    const weatherCondition = getWeatherDescription(current.weather_code);
    const weatherIcon = getWeatherIcon(current.weather_code, current.is_day);

    // Calculate temperature in Celsius as well
    const tempF = Math.round(current.temperature_2m);
    const tempC = Math.round((tempF - 32) * 5/9);
    const feelsLikeF = Math.round(current.apparent_temperature);
    const feelsLikeC = Math.round((feelsLikeF - 32) * 5/9);

    // Build location data
    const location = {
      latitude,
      longitude,
      address: cityName,
      city: cityName,
      region,
      country,
      timezone: data.timezone,
      localtime: new Date().toLocaleString('en-US', { timeZone: data.timezone }),
    };

    // Build weather data
    const weather = {
      temperature: tempF,
      temperatureC: tempC,
      feelsLike: feelsLikeF,
      feelsLikeC: feelsLikeC,
      humidity: current.relative_humidity_2m,
      pressure: Math.round(current.pressure_msl * 0.02953), // hPa to inHg
      pressureMb: Math.round(current.pressure_msl),
      condition: weatherCondition,
      conditionIcon: weatherIcon,
      windSpeed: Math.round(current.wind_speed_10m),
      windSpeedKph: Math.round(current.wind_speed_10m * 1.609),
      windDirection: getWindDirection(current.wind_direction_10m),
      windDegree: current.wind_direction_10m,
      windGusts: Math.round(current.wind_gusts_10m),
      visibility: 10, // Open-Meteo doesn't provide visibility in free tier
      visibilityKm: 16,
      uvIndex: daily?.uv_index_max?.[0] || 0,
      dewPoint: calculateDewPoint(tempF, current.relative_humidity_2m),
      cloudCover: current.cloud_cover,
      precipitation: current.precipitation,
      precipitationMm: current.precipitation * 25.4,
      isDay: current.is_day === 1,
    };

    // Air quality - using estimated values based on weather conditions
    // Open-Meteo has a separate Air Quality API we could integrate later
    const airQuality = estimateAirQuality(weather, latitude);

    // Astronomy data
    const astronomy = {
      sunrise: formatTime(daily?.sunrise?.[0]),
      sunset: formatTime(daily?.sunset?.[0]),
      moonrise: '', // Not available in Open-Meteo free tier
      moonset: '',
      moonPhase: getMoonPhase(new Date()),
      moonIllumination: getMoonIllumination(new Date()),
    };

    // Calculate day length
    const dayLengthSeconds = daily?.daylight_duration?.[0] || 43200;
    const dayLengthHours = Math.floor(dayLengthSeconds / 3600);
    const dayLengthMinutes = Math.floor((dayLengthSeconds % 3600) / 60);
    const dayLength = `${dayLengthHours}h ${dayLengthMinutes}m`;

    // Determine season
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

// WMO Weather interpretation codes
// https://open-meteo.com/en/docs
function getWeatherDescription(code: number): string {
  const codes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return codes[code] || 'Unknown';
}

function getWeatherIcon(code: number, isDay: number): string {
  // Return emoji-style icons based on weather code
  const dayIcons: Record<number, string> = {
    0: '☀️',
    1: '🌤️',
    2: '⛅',
    3: '☁️',
    45: '🌫️',
    48: '🌫️',
    51: '🌧️',
    53: '🌧️',
    55: '🌧️',
    61: '🌧️',
    63: '🌧️',
    65: '🌧️',
    71: '🌨️',
    73: '🌨️',
    75: '🌨️',
    77: '🌨️',
    80: '🌦️',
    81: '🌦️',
    82: '🌦️',
    85: '🌨️',
    86: '🌨️',
    95: '⛈️',
    96: '⛈️',
    99: '⛈️',
  };
  
  const nightIcons: Record<number, string> = {
    0: '🌙',
    1: '🌙',
    2: '☁️',
    3: '☁️',
  };
  
  if (isDay === 0 && nightIcons[code]) {
    return nightIcons[code];
  }
  return dayIcons[code] || '🌡️';
}

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function calculateDewPoint(tempF: number, humidity: number): number {
  // Magnus formula approximation
  const tempC = (tempF - 32) * 5/9;
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
  const dewPointC = (b * alpha) / (a - alpha);
  return Math.round(dewPointC * 9/5 + 32);
}

function formatTime(isoString: string | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

function getMoonPhase(date: Date): string {
  // Simplified moon phase calculation
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  const c = Math.floor(year / 100);
  const y = year - 100 * c;
  
  let jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (month + 1)) + day - 1524.5;
  jd = jd - Math.floor(c / 4) + c - 32167.5;
  
  const moonAge = (jd - 2451550.1) % 29.530588853;
  
  if (moonAge < 1.85) return 'New Moon';
  if (moonAge < 5.53) return 'Waxing Crescent';
  if (moonAge < 9.22) return 'First Quarter';
  if (moonAge < 12.91) return 'Waxing Gibbous';
  if (moonAge < 16.61) return 'Full Moon';
  if (moonAge < 20.30) return 'Waning Gibbous';
  if (moonAge < 23.99) return 'Last Quarter';
  if (moonAge < 27.68) return 'Waning Crescent';
  return 'New Moon';
}

function getMoonIllumination(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  const c = Math.floor(year / 100);
  const y = year - 100 * c;
  
  let jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (month + 1)) + day - 1524.5;
  jd = jd - Math.floor(c / 4) + c - 32167.5;
  
  const moonAge = (jd - 2451550.1) % 29.530588853;
  
  // Approximate illumination based on moon age
  const illumination = 50 * (1 - Math.cos(2 * Math.PI * moonAge / 29.530588853));
  return Math.round(illumination);
}

function estimateAirQuality(weather: any, latitude: number): any {
  const month = new Date().getMonth() + 1;
  const isNorthernHemisphere = latitude > 0;
  
  // Base AQI estimation based on weather conditions
  let baseAqi = 30; // Good baseline
  
  // Increase AQI for certain conditions
  if (weather.cloudCover < 20 && weather.windSpeed < 5) baseAqi += 15; // Stagnant air
  if (weather.humidity > 80) baseAqi += 10; // High humidity traps pollutants
  if (weather.condition.includes('Fog')) baseAqi += 20;
  
  // Decrease for rain (washes pollutants)
  if (weather.precipitation > 0) baseAqi -= 15;
  if (weather.windSpeed > 15) baseAqi -= 10; // Wind disperses pollutants
  
  baseAqi = Math.max(1, Math.min(100, baseAqi));
  
  // Estimate pollen based on season
  const pollenTree = estimatePollen('tree', weather.temperatureC, weather.humidity, weather.windSpeed, month, isNorthernHemisphere);
  const pollenGrass = estimatePollen('grass', weather.temperatureC, weather.humidity, weather.windSpeed, month, isNorthernHemisphere);
  const pollenWeed = estimatePollen('weed', weather.temperatureC, weather.humidity, weather.windSpeed, month, isNorthernHemisphere);
  const pollenMold = weather.humidity > 70 ? 60 : weather.humidity > 50 ? 40 : 20;
  
  return {
    aqi: baseAqi,
    aqiCategory: getAqiCategory(baseAqi),
    pm25: Math.round(baseAqi * 0.4),
    pm10: Math.round(baseAqi * 0.6),
    o3: Math.round(20 + Math.random() * 30),
    no2: Math.round(5 + Math.random() * 15),
    so2: Math.round(2 + Math.random() * 8),
    co: Math.round(100 + Math.random() * 200),
    dominantPollutant: 'pm25',
    pollenTree,
    pollenGrass,
    pollenWeed,
    pollenMold,
  };
}

function getAqiCategory(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

function estimatePollen(type: 'tree' | 'grass' | 'weed' | 'mold', tempC: number, humidity: number, windMph: number, month: number, isNorthern: boolean): number {
  let base = 0;
  
  // Adjust month for southern hemisphere
  const adjustedMonth = isNorthern ? month : ((month + 5) % 12) + 1;
  
  // Seasonal patterns
  if (type === 'tree') {
    if (adjustedMonth >= 2 && adjustedMonth <= 5) base = 60;
    else if (adjustedMonth >= 6 && adjustedMonth <= 8) base = 20;
    else base = 10;
  } else if (type === 'grass') {
    if (adjustedMonth >= 5 && adjustedMonth <= 8) base = 70;
    else if ((adjustedMonth >= 3 && adjustedMonth <= 4) || (adjustedMonth >= 9 && adjustedMonth <= 10)) base = 30;
    else base = 10;
  } else if (type === 'weed') {
    if (adjustedMonth >= 8 && adjustedMonth <= 10) base = 75;
    else if (adjustedMonth >= 6 && adjustedMonth <= 7) base = 25;
    else base = 10;
  } else if (type === 'mold') {
    base = humidity > 70 ? 60 : humidity > 50 ? 40 : 20;
  }
  
  // Temperature modifier
  if (tempC < 5 || tempC > 35) base *= 0.3;
  else if (tempC > 15 && tempC < 30) base *= 1.2;
  
  // Wind modifier
  if (windMph > 10 && windMph < 25) base *= 1.3;
  else if (windMph > 25) base *= 0.8;
  
  // Rain reduces pollen
  if (humidity > 85) base *= 0.5;
  
  return Math.min(100, Math.max(0, Math.round(base + (Math.random() * 15 - 7))));
}
