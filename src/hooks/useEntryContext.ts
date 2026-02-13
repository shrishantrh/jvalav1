import { useCallback } from 'react';
import { useWearableData } from './useWearableData';
import { fetchWeatherData, getCurrentLocation } from '@/services/weatherService';

// Small helper: context collection must NEVER block logging.
const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(null), ms);
  });

  try {
    return (await Promise.race([promise, timeoutPromise])) as T | null;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

interface EntryContextData {
  environmentalData: any | null;
  physiologicalData: Record<string, unknown> | null;
  latitude?: number;
  longitude?: number;
  city?: string;
}

/**
 * Hook that collects both environmental (weather) and physiological (wearable) data
 * for each flare entry.
 *
 * Critical rule: logging must never hang. If context cannot be collected quickly,
 * we still log the flare and attach whatever data is available.
 *
 * IMPORTANT: Per product requirement, we do NOT generate dummy/mock context.
 */
export const useEntryContext = () => {
  const { data: wearableData, syncData, connections, getDataForEntry } = useWearableData();

  // Check if any wearable is connected
  const hasWearableConnected = connections.some((c) => c.connected);

  // Get fresh wearable data (sync if stale) - returns REAL metrics or null
  const getWearableData = useCallback(async (): Promise<Record<string, unknown> | null> => {
    // Important: do not rely solely on "connected" flags.
    // If we already have cached wearable data, attach it.
    const cachedNow = (getDataForEntry() as Record<string, unknown> | null) ?? null;
    if (cachedNow) return cachedNow;

    if (!hasWearableConnected) return null;

    // Sync if data is more than 5 minutes old (but never block logging)
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    if (!wearableData?.lastSyncedAt || wearableData.lastSyncedAt < fiveMinutesAgo) {
      const connectedDevice = connections.find((c) => c.connected);
      if (connectedDevice) {
        // 10s budget for a sync attempt on native (sequential health queries take longer)
        await withTimeout(syncData(connectedDevice.type), 10000);
      }
    }

    return (getDataForEntry() as Record<string, unknown> | null) ?? null;
  }, [wearableData, hasWearableConnected, connections, syncData, getDataForEntry]);

  // Get environmental data (weather, location) - uses API or returns null
  const getEnvironmentalData = useCallback(async (): Promise<{
    environmentalData: any | null;
    latitude?: number;
    longitude?: number;
    city?: string;
  }> => {
    try {
      // NOTE: These are statically imported to keep the permission prompt reliably
      // tied to the user's tap (no async dynamic import breaking the gesture chain).
      const location = await withTimeout(getCurrentLocation(), 2500);

      if (!location) {
        return { environmentalData: null };
      }

      const weatherData = await withTimeout(fetchWeatherData(location.latitude, location.longitude), 3500);

      return {
        environmentalData: weatherData ?? null,
        latitude: location.latitude,
        longitude: location.longitude,
        city: (weatherData as any)?.location?.city,
      };
    } catch (error) {
      console.error('Error getting environmental data:', error);
      return { environmentalData: null };
    }
  }, []);

  // Get all context data for an entry
  const getEntryContext = useCallback(async (): Promise<EntryContextData> => {
    // Fetch both in parallel, but never block indefinitely.
    // Give wearable data more time on native (health queries run sequentially).
    const [envResult, physioData] = await Promise.all([
      getEnvironmentalData(),
      withTimeout(getWearableData(), 8000),
    ]);

    return {
      environmentalData: envResult.environmentalData,
      physiologicalData: physioData ?? null,
      latitude: envResult.latitude,
      longitude: envResult.longitude,
      city: envResult.city,
    };
  }, [getEnvironmentalData, getWearableData]);

  return {
    getEntryContext,
    getWearableData,
    getEnvironmentalData,
    hasWearableConnected,
    currentWearableData: wearableData,
  };
};
