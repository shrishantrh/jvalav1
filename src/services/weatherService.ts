import { supabase } from "@/integrations/supabase/client";

export interface EnvironmentalData {
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    country?: string;
  };
  weather: {
    temperature: number;
    humidity: number;
    pressure: number;
    condition: string;
    windSpeed: number;
  };
  airQuality: {
    pollen: number;
    pollutants: number;
    aqi: number;
  };
  season: 'spring' | 'summer' | 'fall' | 'winter';
}

export const fetchWeatherData = async (latitude: number, longitude: number): Promise<EnvironmentalData | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-weather', {
      body: { latitude, longitude }
    });

    if (error) {
      console.error('Weather API error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
};

export const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000
      });
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
  } catch (error) {
    console.log('Using default location for demo purposes');
    return {
      latitude: 40.7128,
      longitude: -74.0060
    };
  }
};