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
 */
export const useEntryContext = () => {
  const { data: wearableData, syncData, connections, getDataForEntry } = useWearableData();

  // Check if any wearable is connected
  const hasWearableConnected = connections.some((c) => c.connected);

  // Get fresh wearable data (sync if stale) - returns REAL metrics or null
  const getWearableData = useCallback(async (): Promise<Record<string, unknown> | null> => {
    const persistedNativeConnection = (() => {
      try {
        return localStorage.getItem('jvala_health_connected') === '1';
      } catch {
        return false;
      }
    })();

    const connectedDevice =
      connections.find((c) => c.connected) ??
      (persistedNativeConnection
        ? connections.find(
            (c) => (c.type === 'apple_health' || c.type === 'google_fit') && !c.comingSoon
          )
        : undefined);

    const cachedNow = (getDataForEntry() as Record<string, unknown> | null) ?? null;
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Use cached wearable metrics immediately so flare logs always carry the latest known snapshot.
    if (cachedNow) {
      // Refresh stale data in background; never block logging when we already have metrics.
      if (connectedDevice && (!wearableData?.lastSyncedAt || wearableData.lastSyncedAt < fiveMinutesAgo)) {
        void withTimeout(syncData(connectedDevice.type), 15000);
      }
      return cachedNow;
    }

    if (!connectedDevice && !hasWearableConnected && !persistedNativeConnection) {
      return null;
    }

    if (connectedDevice) {
      await withTimeout(syncData(connectedDevice.type), 15000);
      return (getDataForEntry() as Record<string, unknown> | null) ?? null;
    }

    return null;
  }, [wearableData, hasWearableConnected, connections, syncData, getDataForEntry]);

  // Get environmental data (weather, location) - uses API or returns null
  const getEnvironmentalData = useCallback(async (): Promise<{
    environmentalData: any | null;
    latitude?: number;
    longitude?: number;
    city?: string;
  }> => {
    try {
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
    // Fetch both in parallel. Wearable query gets a larger budget to avoid losing metrics on fresh connect.
    const [envResult, physioData] = await Promise.all([
      getEnvironmentalData(),
      withTimeout(getWearableData(), 14000),
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
