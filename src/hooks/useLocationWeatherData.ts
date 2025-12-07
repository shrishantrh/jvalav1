import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  condition: string;
  windSpeed: number;
}

interface AirQualityData {
  pollen: number;
  pollutants: number;
  aqi: number;
}

export const useLocationWeatherData = () => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentSeason = (): 'spring' | 'summer' | 'fall' | 'winter' => {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  };

  const collectEnvironmentalData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get real location from browser
      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Call the real weather API
      const { data, error: apiError } = await supabase.functions.invoke('get-weather', {
        body: { latitude, longitude }
      });

      if (apiError) {
        throw new Error(apiError.message || 'Weather API error');
      }

      if (data) {
        setLocation(data.location);
        setWeather(data.weather);
        setAirQuality(data.airQuality);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to collect environmental data';
      setError(errorMessage);
      console.error('Environmental data collection error:', err);
      
      // Don't set fake data - just leave as null so UI can handle it
    } finally {
      setLoading(false);
    }
  };

  const getPhysiologicalData = () => {
    // Simulate physiological data (normally from health apps/devices)
    // TODO: Integrate with HealthKit / Google Fit when available
    return {
      heartRate: Math.round(60 + Math.random() * 40),
      heartRateVariability: Math.round(20 + Math.random() * 80),
      bloodPressure: {
        systolic: Math.round(110 + Math.random() * 30),
        diastolic: Math.round(70 + Math.random() * 20)
      },
      sleepHours: Math.round((6 + Math.random() * 3) * 10) / 10,
      sleepQuality: (['poor', 'fair', 'good', 'excellent'] as const)[Math.floor(Math.random() * 4)],
      stressLevel: Math.round(1 + Math.random() * 9),
      steps: Math.round(3000 + Math.random() * 12000)
    };
  };

  return {
    location,
    weather,
    airQuality,
    loading,
    error,
    collectEnvironmentalData,
    getPhysiologicalData,
    getCurrentSeason
  };
};