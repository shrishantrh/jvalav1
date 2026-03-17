import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/capacitor";
import { getCached, setCache, withRetry } from "@/lib/apiResilience";
import { logAPICall } from "@/lib/observability";

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

// Round coords to ~1km grid so nearby calls share cache
const roundCoord = (n: number) => Math.round(n * 100) / 100;

export const fetchWeatherData = async (
  latitude: number,
  longitude: number
): Promise<EnvironmentalData | null> => {
  const cacheKey = `weather_${roundCoord(latitude)}_${roundCoord(longitude)}`;
  const start = performance.now();

  const isUnknown = (value?: string | null) => !value || value.trim().toLowerCase() === "unknown";

  const normalizeLocation = (data: EnvironmentalData): EnvironmentalData => {
    const location = (data as any)?.location ?? {};
    const resolvedCity = !isUnknown(location.city)
      ? location.city
      : location.region || location.county || location.state || location.country || undefined;

    return {
      ...data,
      location: {
        ...location,
        city: resolvedCity,
        address: location.address || resolvedCity,
      },
    };
  };

  const cached = getCached<EnvironmentalData>(cacheKey);
  if (cached) {
    const normalizedCached = normalizeLocation(cached);
    if (!isUnknown(normalizedCached.location?.city)) {
      logAPICall({
        service: "weather",
        latencyMs: Math.round(performance.now() - start),
        status: "success",
        cached: true,
      });
      return normalizedCached;
    }
  }

  let result: EnvironmentalData | null = null;

  try {
    result = await withRetry(
      async () => {
        const { data, error } = await supabase.functions.invoke("get-weather", {
          body: { latitude, longitude },
        });
        if (error) throw new Error(error.message || "Weather API error");
        return data as EnvironmentalData;
      },
      { maxRetries: 2, baseDelayMs: 300, circuitName: "weather-api" }
    );
  } catch (error) {
    console.error("Weather fetch failed:", error);
    result = null;
  }

  if (!result) {
    logAPICall({
      service: "weather",
      latencyMs: Math.round(performance.now() - start),
      status: "error",
      cached: false,
    });
    return null;
  }

  const normalized = normalizeLocation(result);
  setCache(cacheKey, normalized, 5 * 60 * 1000);

  logAPICall({
    service: "weather",
    latencyMs: Math.round(performance.now() - start),
    status: "success",
    cached: false,
  });

  return normalized;
};

export const getCurrentLocation = async (): Promise<
  { latitude: number; longitude: number; isDefault?: boolean } | null
> => {
  try {
    // Native iOS/Android (Capacitor): prefer injected plugin proxy so we don't depend on bundling.
    if (isNative) {
      const injected = (window as any)?.Capacitor?.Plugins?.Geolocation;
      const Geolocation = injected
        ? injected
        : // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - optional native-only dependency
          (await import("@capacitor/geolocation")).Geolocation;

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

