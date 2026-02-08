/**
 * Apple Health / HealthKit Service
 * 
 * This module integrates with Apple HealthKit and Android Health Connect
 * via the @capgo/capacitor-health plugin.
 * Falls back gracefully when not running on native.
 */

import { isNative, platform } from '@/lib/capacitor';

// Types from the plugin
type HealthDataType = 'steps' | 'distance' | 'calories' | 'heartRate' | 'weight' | 'sleep' | 'respiratoryRate' | 'oxygenSaturation' | 'restingHeartRate' | 'heartRateVariability';
type SleepState = 'inBed' | 'asleep' | 'awake' | 'rem' | 'deep' | 'light';

interface HealthSample {
  dataType: HealthDataType;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
  sourceName?: string;
  sleepState?: SleepState;
}

export interface AppleHealthData {
  // Heart
  heartRate?: number;
  restingHeartRate?: number;
  heartRateVariability?: number;
  
  // Blood Oxygen & Respiratory
  spo2?: number;
  respiratoryRate?: number;
  
  // Fitness
  steps?: number;
  distance?: number;
  caloriesBurned?: number;
  
  // Sleep
  sleepMinutes?: number;
  sleepHours?: number;
  inBedMinutes?: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  lightSleepMinutes?: number;
  awakeSleepMinutes?: number;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  
  // Body Measurements
  weight?: number;
  
  // Workouts
  workouts?: Array<{
    type: string;
    startDate: string;
    endDate: string;
    duration: number;
    calories?: number;
    distance?: number;
  }>;
  
  // Metadata
  lastSyncedAt?: Date;
  source: 'apple_health';
  dataDate?: string;
}

// Dynamically load the plugin only when needed
let healthPlugin: any = null;

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const loadHealthPlugin = async () => {
  if (healthPlugin) return healthPlugin;

  if (!isNative) {
    console.log('Health plugin is only available on native platforms');
    return null;
  }

  try {
    const module = await import('@capgo/capacitor-health');
    // Plugin exports a Capacitor proxy named Health
    healthPlugin = (module as any).Health;
    return healthPlugin;
  } catch (error) {
    console.error('Failed to load Health plugin:', error);
    return null;
  }
};

/**
 * Check if Apple Health / Health Connect is available
 */
export const isHealthAvailable = async (): Promise<boolean> => {
  if (!isNative) return false;

  try {
    const plugin = await loadHealthPlugin();
    if (!plugin) return false;

    const result = (await withTimeout(plugin.isAvailable(), 8000, 'Health.isAvailable')) as any;
    return result?.available === true;
  } catch (error) {
    console.error('Error checking Health availability:', error);
    return false;
  }
};

/**
 * Request permissions for Health data
 */
export const requestHealthPermissions = async (): Promise<boolean> => {
  try {
    const plugin = await loadHealthPlugin();
    if (!plugin) return false;

    // Request read access to all supported data types
    const readTypes: HealthDataType[] = [
      'steps',
      'distance',
      'calories',
      'heartRate',
      'weight',
      'sleep',
      'respiratoryRate',
      'oxygenSaturation',
      'restingHeartRate',
      'heartRateVariability',
    ];

    // NOTE: On iOS, this should trigger the Health permission sheet.
    // If it never appears, the native project is missing HealthKit capability
    // or NSHealthShareUsageDescription.
    await withTimeout(
      plugin.requestAuthorization({
        read: readTypes,
        write: [], // We don't write data
      }),
      15000,
      'Health.requestAuthorization'
    );

    return true;
  } catch (error) {
    console.error('Error requesting Health permissions:', error);
    return false;
  }
};

/**
 * Check authorization status without prompting
 */
export const checkHealthPermissions = async (): Promise<boolean> => {
  try {
    const plugin = await loadHealthPlugin();
    if (!plugin) return false;
    
    const status = await plugin.checkAuthorization({
      read: ['steps', 'heartRate', 'sleep'],
    });
    
    // If at least one type is authorized, consider it connected
    return status.readAuthorized.length > 0;
  } catch (error) {
    console.error('Error checking Health permissions:', error);
    return false;
  }
};

/**
 * Query health data for a specific type
 */
const queryHealthData = async (
  plugin: any,
  dataType: HealthDataType,
  startDate: Date,
  endDate: Date
): Promise<HealthSample[]> => {
  try {
    const result = await plugin.readSamples({
      dataType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: 100,
      ascending: false,
    });
    
    return result.samples || [];
  } catch (error) {
    console.log(`No data for ${dataType}:`, error);
    return [];
  }
};

/**
 * Get the most recent value from health data array
 */
const getMostRecent = (samples: HealthSample[]): number | undefined => {
  if (!samples || samples.length === 0) return undefined;
  // Already sorted descending
  return samples[0]?.value;
};

/**
 * Sum values from health data array for a time period
 */
const sumValues = (samples: HealthSample[]): number => {
  return samples.reduce((sum, sample) => sum + (sample.value || 0), 0);
};

/**
 * Calculate sleep quality from total hours
 */
const calculateSleepQuality = (hours: number): 'poor' | 'fair' | 'good' | 'excellent' => {
  if (hours >= 7.5) return 'excellent';
  if (hours >= 6.5) return 'good';
  if (hours >= 5) return 'fair';
  return 'poor';
};

/**
 * Fetch comprehensive health data from Apple Health / Health Connect
 */
export const fetchHealthData = async (): Promise<AppleHealthData | null> => {
  const plugin = await loadHealthPlugin();
  if (!plugin) return null;
  
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    // Look back 12 hours for sleep data (includes last night's sleep)
    const yesterdayNight = new Date(startOfToday);
    yesterdayNight.setHours(-12);
    
    // Fetch all data types in parallel
    const [
      heartRateData,
      restingHRData,
      hrvData,
      spo2Data,
      respRateData,
      stepsData,
      distanceData,
      caloriesData,
      sleepData,
      weightData,
    ] = await Promise.all([
      queryHealthData(plugin, 'heartRate', startOfToday, now),
      queryHealthData(plugin, 'restingHeartRate', startOfToday, now),
      queryHealthData(plugin, 'heartRateVariability', startOfToday, now),
      queryHealthData(plugin, 'oxygenSaturation', startOfToday, now),
      queryHealthData(plugin, 'respiratoryRate', startOfToday, now),
      queryHealthData(plugin, 'steps', startOfToday, now),
      queryHealthData(plugin, 'distance', startOfToday, now),
      queryHealthData(plugin, 'calories', startOfToday, now),
      queryHealthData(plugin, 'sleep', yesterdayNight, now),
      queryHealthData(plugin, 'weight', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now),
    ]);
    
    // Process sleep data - separate by sleep state
    let totalSleepMinutes = 0;
    let inBedMinutes = 0;
    let deepSleepMinutes = 0;
    let remSleepMinutes = 0;
    let lightSleepMinutes = 0;
    let awakeSleepMinutes = 0;
    
    sleepData.forEach((sample: HealthSample) => {
      // Value is in minutes for sleep data
      const durationMinutes = sample.value || 0;
      
      switch (sample.sleepState) {
        case 'inBed':
          inBedMinutes += durationMinutes;
          break;
        case 'asleep':
          totalSleepMinutes += durationMinutes;
          break;
        case 'deep':
          deepSleepMinutes += durationMinutes;
          totalSleepMinutes += durationMinutes;
          break;
        case 'rem':
          remSleepMinutes += durationMinutes;
          totalSleepMinutes += durationMinutes;
          break;
        case 'light':
          lightSleepMinutes += durationMinutes;
          totalSleepMinutes += durationMinutes;
          break;
        case 'awake':
          awakeSleepMinutes += durationMinutes;
          break;
        default:
          // Unknown sleep state, count as general sleep
          totalSleepMinutes += durationMinutes;
      }
    });
    
    // Fetch workouts
    let workouts: AppleHealthData['workouts'] = undefined;
    try {
      const workoutResult = await plugin.queryWorkouts({
        startDate: startOfToday.toISOString(),
        endDate: now.toISOString(),
        limit: 10,
      });
      
      if (workoutResult.workouts && workoutResult.workouts.length > 0) {
        workouts = workoutResult.workouts.map((w: any) => ({
          type: w.workoutType || 'other',
          startDate: w.startDate,
          endDate: w.endDate,
          duration: Math.round(w.duration / 60), // Convert seconds to minutes
          calories: w.totalEnergyBurned,
          distance: w.totalDistance,
        }));
      }
    } catch (error) {
      console.log('No workout data available:', error);
    }
    
    const sleepHours = Math.round(totalSleepMinutes / 60 * 10) / 10;
    
    // Build the health data object
    const healthData: AppleHealthData = {
      source: 'apple_health',
      lastSyncedAt: new Date(),
      dataDate: startOfToday.toISOString().split('T')[0],
      
      // Heart
      heartRate: getMostRecent(heartRateData),
      restingHeartRate: getMostRecent(restingHRData),
      heartRateVariability: getMostRecent(hrvData),
      
      // Blood Oxygen & Respiratory
      spo2: getMostRecent(spo2Data),
      respiratoryRate: getMostRecent(respRateData),
      
      // Fitness
      steps: Math.round(sumValues(stepsData)),
      distance: Math.round(sumValues(distanceData)),
      caloriesBurned: Math.round(sumValues(caloriesData)),
      
      // Sleep
      sleepMinutes: Math.round(totalSleepMinutes),
      sleepHours,
      inBedMinutes: Math.round(inBedMinutes),
      deepSleepMinutes: Math.round(deepSleepMinutes),
      remSleepMinutes: Math.round(remSleepMinutes),
      lightSleepMinutes: Math.round(lightSleepMinutes),
      awakeSleepMinutes: Math.round(awakeSleepMinutes),
      sleepQuality: sleepHours > 0 ? calculateSleepQuality(sleepHours) : undefined,
      
      // Body Measurements
      weight: getMostRecent(weightData),
      
      // Workouts
      workouts,
    };
    
    return healthData;
  } catch (error) {
    console.error('Error fetching Health data:', error);
    return null;
  }
};

/**
 * Convert Apple Health data to the standard PhysiologicalData format
 * used by the rest of the app
 */
export const convertToPhysiologicalData = (data: AppleHealthData): Record<string, unknown> => {
  return {
    // Core vitals
    heart_rate: data.heartRate,
    resting_heart_rate: data.restingHeartRate,
    heart_rate_variability: data.heartRateVariability,
    
    // Blood Oxygen
    spo2: data.spo2,
    
    // Breathing
    breathing_rate: data.respiratoryRate,
    
    // Sleep
    sleep_hours: data.sleepHours,
    sleep_minutes: data.sleepMinutes,
    sleep_quality: data.sleepQuality,
    deep_sleep_minutes: data.deepSleepMinutes,
    rem_sleep_minutes: data.remSleepMinutes,
    light_sleep_minutes: data.lightSleepMinutes,
    wake_sleep_minutes: data.awakeSleepMinutes,
    time_in_bed: data.inBedMinutes,
    
    // Activity
    steps: data.steps,
    distance: data.distance,
    calories_burned: data.caloriesBurned,
    
    // Body Measurements
    weight_kg: data.weight,
    
    // Workouts
    workouts: data.workouts,
    
    // Metadata
    synced_at: data.lastSyncedAt?.toISOString(),
    source: 'apple_health',
    data_date: data.dataDate,
  };
};

/**
 * Get platform-specific name
 */
export const getHealthPlatformName = (): string => {
  if (platform === 'ios') return 'Apple Health';
  if (platform === 'android') return 'Health Connect';
  return 'Health';
};
