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

// Comprehensive physiological data - matches all Fitbit metrics
export interface PhysiologicalData {
  // Core vitals
  heart_rate?: number;
  resting_heart_rate?: number;
  heart_rate_variability?: number;
  hrv_rmssd?: number;
  hrv_coverage?: number;
  hrv_low_freq?: number;
  hrv_high_freq?: number;
  
  // Blood Oxygen
  spo2?: number;
  spo2_avg?: number;
  spo2_min?: number;
  spo2_max?: number;
  
  // Breathing
  breathing_rate?: number;
  breathing_rate_deep_sleep?: number;
  breathing_rate_light_sleep?: number;
  breathing_rate_rem_sleep?: number;
  
  // Temperature
  skin_temperature?: number;
  
  // Cardio Fitness
  vo2_max?: number;
  vo2_max_range?: string;
  
  // Active Zone Minutes
  active_zone_minutes_total?: number;
  fat_burn_minutes?: number;
  cardio_minutes?: number;
  peak_minutes?: number;
  
  // Sleep
  sleep_hours?: number;
  sleep_minutes?: number;
  sleep_quality?: string;
  sleep_stages?: {
    deep?: number;
    light?: number;
    rem?: number;
    wake?: number;
  };
  deep_sleep_minutes?: number;
  light_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  wake_sleep_minutes?: number;
  sleep_efficiency?: number;
  time_in_bed?: number;
  
  // Activity
  steps?: number;
  active_minutes?: number;
  fairly_active_minutes?: number;
  very_active_minutes?: number;
  lightly_active_minutes?: number;
  sedentary_minutes?: number;
  calories_burned?: number;
  calories_bmr?: number;
  activity_calories?: number;
  floors?: number;
  elevation?: number;
  distance?: number;
  
  // Metadata
  synced_at?: string;
  source?: string;
  data_date?: string;
  
  // Legacy camelCase aliases for backward compatibility
  heartRate?: number;
  heartRateVariability?: number;
  sleepHours?: number;
  sleepQuality?: string;
  activeMinutes?: number;
  caloriesBurned?: number;
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
  const { data: wearableData, syncData, connections, getDataForEntry } = useWearableData();
  const lastSyncRef = useRef<Date | null>(null);

  // Check if any wearable is connected
  const hasWearableConnected = connections.some(c => c.connected);

  // Get fresh wearable data (sync if stale) - now returns ALL Fitbit metrics
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

    // Use getDataForEntry which returns all comprehensive data
    const fullData = getDataForEntry();
    if (!fullData) return null;
    
    return fullData as PhysiologicalData;
  }, [wearableData, hasWearableConnected, connections, syncData, getDataForEntry]);

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
