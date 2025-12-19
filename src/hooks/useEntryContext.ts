import { useCallback, useRef } from 'react';
import { useWearableData, WearableData } from './useWearableData';

interface EnvironmentalData {
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
  temperature?: number;
  humidity?: number;
  uvIndex?: number;
  aqi?: number;
  condition?: string;
  pressure?: number;
  windSpeed?: number;
}

interface PhysiologicalData {
  heart_rate?: number;
  heart_rate_variability?: number;
  steps?: number;
  sleep_hours?: number;
  sleep_quality?: string;
  active_minutes?: number;
  calories_burned?: number;
  distance?: number;
  synced_at?: string;
  source?: string;
}

interface EntryContextData {
  environmentalData: EnvironmentalData | null;
  physiologicalData: PhysiologicalData | null;
  latitude?: number;
  longitude?: number;
  city?: string;
}

/**
 * Hook that collects both environmental (weather) and physiological (wearable) data
 * for each flare entry. This ensures consistent tracking of context.
 */
export const useEntryContext = () => {
  const { data: wearableData, syncData, connections } = useWearableData();
  const lastSyncRef = useRef<Date | null>(null);

  // Check if any wearable is connected
  const hasWearableConnected = connections.some(c => c.connected);

  // Get fresh wearable data (sync if stale)
  const getWearableData = useCallback(async (): Promise<PhysiologicalData | null> => {
    if (!hasWearableConnected) return null;

    // Sync if data is more than 5 minutes old
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (!wearableData?.lastSyncedAt || wearableData.lastSyncedAt < fiveMinutesAgo) {
      // Find the connected device type
      const connectedDevice = connections.find(c => c.connected);
      if (connectedDevice) {
        await syncData(connectedDevice.type);
      }
    }

    if (!wearableData) return null;

    return {
      heart_rate: wearableData.heartRate,
      heart_rate_variability: wearableData.heartRateVariability,
      steps: wearableData.steps,
      sleep_hours: wearableData.sleepHours,
      sleep_quality: wearableData.sleepQuality,
      active_minutes: wearableData.activeMinutes,
      calories_burned: wearableData.caloriesBurned,
      distance: wearableData.distance,
      synced_at: wearableData.lastSyncedAt?.toISOString(),
      source: wearableData.source,
    };
  }, [wearableData, hasWearableConnected, connections, syncData]);

  // Get environmental data (weather, location)
  const getEnvironmentalData = useCallback(async (): Promise<{
    environmentalData: EnvironmentalData | null;
    latitude?: number;
    longitude?: number;
    city?: string;
  }> => {
    try {
      const { getCurrentLocation, fetchWeatherData } = await import('@/services/weatherService');
      const location = await getCurrentLocation();
      
      if (!location) return { environmentalData: null };

      const weatherData = await fetchWeatherData(location.latitude, location.longitude);
      
      if (!weatherData) {
        return {
          environmentalData: {
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
            }
          },
          latitude: location.latitude,
          longitude: location.longitude,
        };
      }

      return {
        environmentalData: weatherData,
        latitude: location.latitude,
        longitude: location.longitude,
        city: weatherData.location?.city,
      };
    } catch (error) {
      console.error('Error getting environmental data:', error);
      return { environmentalData: null };
    }
  }, []);

  // Get all context data for an entry
  const getEntryContext = useCallback(async (): Promise<EntryContextData> => {
    // Fetch both in parallel
    const [envResult, physioData] = await Promise.all([
      getEnvironmentalData(),
      getWearableData(),
    ]);

    return {
      environmentalData: envResult.environmentalData,
      physiologicalData: physioData,
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
