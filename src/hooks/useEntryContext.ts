import { useCallback, useRef } from 'react';
import { useWearableData } from './useWearableData';
import {
  generateMockWearableData,
  generateMockEnvironmentalData,
  MockEnvironmentalData as MockEnvData,
} from '@/services/mockWearableData';

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

interface EnvironmentalData {
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    address?: string;
    elevation?: number;
    timezone?: string;
  };
  temperature?: number;
  feelsLike?: number;
  humidity?: number;
  uvIndex?: number;
  aqi?: number;
  condition?: string;
  conditionIcon?: string;
  pressure?: number;
  windSpeed?: number;
  windDirection?: string;
  windGusts?: number;
  visibility?: number;
  dewPoint?: number;
  cloudCover?: number;
  precipitation?: number;
  precipitationType?: string | null;
  // Air quality breakdown
  pm25?: number;
  pm10?: number;
  o3?: number;
  no2?: number;
  aqiCategory?: string;
  dominantPollutant?: string;
  // Pollen
  pollenTree?: number;
  pollenGrass?: number;
  pollenWeed?: number;
  pollenMold?: number;
  // Astronomy
  sunrise?: string;
  sunset?: string;
  moonPhase?: string;
  moonIllumination?: number;
  dayLength?: string;
  // Season
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  capturedAt?: string;
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
 * for each flare entry.
 *
 * Critical rule: logging must never hang. If context cannot be collected quickly,
 * we still log the flare and attach whatever data is available.
 */
export const useEntryContext = () => {
  const { data: wearableData, syncData, connections, getDataForEntry } = useWearableData();

  // Check if any wearable is connected
  const hasWearableConnected = connections.some((c) => c.connected);

  // Convert mock data to PhysiologicalData format
  const convertMockToPhysiological = (
    mock: ReturnType<typeof generateMockWearableData>
  ): PhysiologicalData => {
    return {
      heart_rate: mock.heartRate,
      resting_heart_rate: mock.restingHeartRate,
      heart_rate_variability: mock.heartRateVariability,
      hrv_rmssd: mock.hrvRmssd,
      hrv_coverage: mock.hrvCoverage,
      spo2: mock.spo2,
      spo2_avg: mock.spo2Avg,
      spo2_min: mock.spo2Min,
      spo2_max: mock.spo2Max,
      breathing_rate: mock.breathingRate,
      breathing_rate_deep_sleep: mock.breathingRateDeepSleep,
      breathing_rate_light_sleep: mock.breathingRateLightSleep,
      breathing_rate_rem_sleep: mock.breathingRateRemSleep,
      skin_temperature: mock.skinTemperature,
      vo2_max: mock.vo2Max,
      vo2_max_range: mock.vo2MaxRange,
      active_zone_minutes_total: mock.activeZoneMinutesTotal,
      fat_burn_minutes: mock.fatBurnMinutes,
      cardio_minutes: mock.cardioMinutes,
      peak_minutes: mock.peakMinutes,
      sleep_hours: mock.sleepHours,
      sleep_minutes: mock.sleepMinutes,
      sleep_quality: mock.sleepQuality,
      sleep_efficiency: mock.sleepEfficiency,
      deep_sleep_minutes: mock.deepSleepMinutes,
      light_sleep_minutes: mock.lightSleepMinutes,
      rem_sleep_minutes: mock.remSleepMinutes,
      wake_sleep_minutes: mock.wakeSleepMinutes,
      time_in_bed: mock.timeInBed,
      steps: mock.steps,
      active_minutes: mock.activeMinutes,
      fairly_active_minutes: mock.fairlyActiveMinutes,
      very_active_minutes: mock.veryActiveMinutes,
      lightly_active_minutes: mock.lightlyActiveMinutes,
      sedentary_minutes: mock.sedentaryMinutes,
      calories_burned: mock.caloriesBurned,
      calories_bmr: mock.caloriesBMR,
      activity_calories: mock.activityCalories,
      floors: mock.floors,
      elevation: mock.elevation,
      distance: mock.distance,
      synced_at: mock.lastSyncedAt,
      source: 'demo',
      data_date: mock.dataDate,
      // Legacy aliases
      heartRate: mock.heartRate,
      heartRateVariability: mock.heartRateVariability,
      sleepHours: mock.sleepHours,
      sleepQuality: mock.sleepQuality,
      activeMinutes: mock.activeMinutes,
      caloriesBurned: mock.caloriesBurned,
    };
  };

  // Convert mock environmental to our format
  const convertMockToEnvironmental = (mock: MockEnvData): EnvironmentalData => {
    return {
      location: {
        latitude: mock.location.latitude,
        longitude: mock.location.longitude,
        city: mock.location.city,
        country: mock.location.country,
        address: mock.location.address,
        elevation: mock.location.elevation,
        timezone: mock.location.timezone,
      },
      temperature: mock.weather.temperature,
      feelsLike: mock.weather.feelsLike,
      humidity: mock.weather.humidity,
      pressure: mock.weather.pressure,
      condition: mock.weather.condition,
      conditionIcon: mock.weather.conditionIcon,
      windSpeed: mock.weather.windSpeed,
      windDirection: mock.weather.windDirection,
      windGusts: mock.weather.windGusts,
      visibility: mock.weather.visibility,
      dewPoint: mock.weather.dewPoint,
      cloudCover: mock.weather.cloudCover,
      uvIndex: mock.weather.uvIndex,
      precipitation: mock.weather.precipitation,
      precipitationType: mock.weather.precipitationType,
      aqi: mock.airQuality.aqi,
      aqiCategory: mock.airQuality.category,
      pm25: mock.airQuality.pm25,
      pm10: mock.airQuality.pm10,
      o3: mock.airQuality.o3,
      no2: mock.airQuality.no2,
      dominantPollutant: mock.airQuality.dominantPollutant,
      pollenTree: mock.airQuality.pollenTree,
      pollenGrass: mock.airQuality.pollenGrass,
      pollenWeed: mock.airQuality.pollenWeed,
      pollenMold: mock.airQuality.pollenMold,
      sunrise: mock.astronomy.sunrise,
      sunset: mock.astronomy.sunset,
      moonPhase: mock.astronomy.moonPhase,
      moonIllumination: mock.astronomy.moonIllumination,
      dayLength: mock.astronomy.dayLength,
      season: mock.season,
      capturedAt: mock.capturedAt,
    };
  };

  // Get fresh wearable data (sync if stale) - returns ALL metrics or demo data
  const getWearableData = useCallback(async (): Promise<PhysiologicalData | null> => {
    // If no wearable connected, use demo data for polished demo experience
    if (!hasWearableConnected) {
      const variants: Array<'healthy' | 'flare-warning' | 'flare-active'> = [
        'healthy',
        'healthy',
        'flare-warning',
      ];
      const variant = variants[Math.floor(Math.random() * variants.length)];
      return convertMockToPhysiological(generateMockWearableData(variant));
    }

    // Sync if data is more than 5 minutes old (but never block logging)
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    if (!wearableData?.lastSyncedAt || wearableData.lastSyncedAt < fiveMinutesAgo) {
      const connectedDevice = connections.find((c) => c.connected);
      if (connectedDevice) {
        // 2.5s budget for a sync attempt; after that, proceed with cached/partial data.
        await withTimeout(syncData(connectedDevice.type), 2500);
      }
    }

    const fullData = getDataForEntry();
    if (!fullData) {
      // If we can't read data quickly, still return demo so the entry isn't blocked.
      return convertMockToPhysiological(generateMockWearableData('healthy'));
    }

    return fullData as PhysiologicalData;
  }, [wearableData, hasWearableConnected, connections, syncData, getDataForEntry]);

  // Get environmental data (weather, location) - uses API or falls back to demo data
  const getEnvironmentalData = useCallback(async (): Promise<{
    environmentalData: EnvironmentalData | null;
    latitude?: number;
    longitude?: number;
    city?: string;
  }> => {
    try {
      const { getCurrentLocation, fetchWeatherData } = await import('@/services/weatherService');
      const location = await withTimeout(getCurrentLocation(), 2500);

      if (!location) {
        const mockEnv = generateMockEnvironmentalData('normal');
        const converted = convertMockToEnvironmental(mockEnv);
        return {
          environmentalData: converted,
          latitude: mockEnv.location.latitude,
          longitude: mockEnv.location.longitude,
          city: mockEnv.location.city,
        };
      }

      const weatherData = await withTimeout(
        fetchWeatherData((location as any).latitude, (location as any).longitude),
        3500
      );

      if (!weatherData) {
        const mockEnv = generateMockEnvironmentalData('normal');
        const converted = convertMockToEnvironmental(mockEnv);
        converted.location = {
          latitude: (location as any).latitude,
          longitude: (location as any).longitude,
        };
        return {
          environmentalData: converted,
          latitude: (location as any).latitude,
          longitude: (location as any).longitude,
        };
      }

      return {
        environmentalData: weatherData,
        latitude: (location as any).latitude,
        longitude: (location as any).longitude,
        city: (weatherData as any).location?.city,
      };
    } catch (error) {
      console.error('Error getting environmental data:', error);
      const mockEnv = generateMockEnvironmentalData('normal');
      const converted = convertMockToEnvironmental(mockEnv);
      return {
        environmentalData: converted,
        latitude: mockEnv.location.latitude,
        longitude: mockEnv.location.longitude,
        city: mockEnv.location.city,
      };
    }
  }, []);

  // Get all context data for an entry
  const getEntryContext = useCallback(async (): Promise<EntryContextData> => {
    // Fetch both in parallel, but never block indefinitely.
    const [envResult, physioData] = await Promise.all([
      getEnvironmentalData(),
      withTimeout(getWearableData(), 2500),
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
