import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/capacitor";

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
  season: "spring" | "summer" | "fall" | "winter";
}

export const fetchWeatherData = async (
  latitude: number,
  longitude: number
): Promise<EnvironmentalData | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("get-weather", {
      body: { latitude, longitude },
    });

    if (error) {
      console.error("Weather API error:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Failed to fetch weather:", error);
    return null;
  }
};

export const getCurrentLocation = async (): Promise<
  { latitude: number; longitude: number; isDefault?: boolean } | null
> => {
  try {
    // Native iOS/Android (Capacitor): use native geolocation so it actually prompts.
    if (isNative) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        isDefault: false,
      };
    }

    // Web fallback
    if (!navigator.geolocation) {
      console.warn("Geolocation not available");
      return null;
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      isDefault: false,
    };
  } catch (error: any) {
    console.warn("Geolocation error:", error?.message || error);
    return null;
  }
};
