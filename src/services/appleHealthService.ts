/**
 * Apple Health / HealthKit Service
 * 
 * This module integrates with Apple HealthKit and Android Health Connect
 * via the @capgo/capacitor-health plugin.
 * Falls back gracefully when not running on native.
 */

import { isNative, platform } from '@/lib/capacitor';

// Types from the plugin
export type HealthDataType =
  | 'steps'
  | 'distance'
  | 'calories'
  | 'heartRate'
  | 'weight'
  | 'sleep'
  | 'respiratoryRate'
  | 'oxygenSaturation'
  | 'restingHeartRate'
  | 'heartRateVariability';
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

  // Prefer the injected Capacitor plugin proxy when present.
  // This avoids SPM/module resolution edge cases where dynamic import succeeds,
  // but the proxy isn't bound correctly and calls can hang.
  try {
    const injected = (window as any)?.Capacitor?.Plugins?.Health;
    if (injected) {
      healthPlugin = injected;
      return healthPlugin;
    }
  } catch {
    // ignore
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
export type HealthAvailability = {
  available: boolean;
  reason?: string;
};

/**
 * Fast, synchronous check for whether the native plugin is injected into this build.
 *
 * If this is false on a physical device, the app was built without the plugin
 * (most commonly: missing `npx cap sync ios`, or Xcode built an old workspace).
 */
export const isHealthPluginPresent = (): boolean => {
  if (!isNative) return false;
  try {
    const cap = (window as any)?.Capacitor;
    return Boolean(cap?.Plugins?.Health);
  } catch {
    return false;
  }
};

export const getHealthAvailability = async (): Promise<HealthAvailability> => {
  if (!isNative) return { available: false, reason: 'not_native' };

  try {
    const plugin = await loadHealthPlugin();
    if (!plugin) return { available: false, reason: 'plugin_not_loaded' };

    // Per plugin docs, isAvailable may provide a "reason" when unavailable.
    const result = (await withTimeout(plugin.isAvailable(), 8000, 'Health.isAvailable')) as any;
    return {
      available: result?.available === true,
      reason: typeof result?.reason === 'string' ? result.reason : undefined,
    };
  } catch (error) {
    console.error('Error checking Health availability:', error);
    return { available: false, reason: error instanceof Error ? error.message : 'unknown_error' };
  }
};

export const isHealthAvailable = async (): Promise<boolean> => {
  const { available } = await getHealthAvailability();
  return available;
};

/**
 * Request permissions for Health data
 *
 * IMPORTANT:
 * - On iOS, requesting too many scopes at once can be brittle during early integration.
 * - We therefore support a "minimal first" strategy (e.g., steps + heartRate), then
 *   optionally request additional scopes once the initial consent path is verified.
 */
export type HealthAuthorizationResult = {
  ok: boolean;
  status?: {
    readAuthorized: HealthDataType[];
    readDenied: HealthDataType[];
    writeAuthorized: HealthDataType[];
    writeDenied: HealthDataType[];
  };
  error?: string;
};

export const HEALTH_MINIMAL_READ: HealthDataType[] = ['steps', 'heartRate'];

export const HEALTH_FULL_READ: HealthDataType[] = [
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

export const requestHealthPermissions = async (options?: {
  mode?: 'minimal' | 'full';
  read?: HealthDataType[];
}): Promise<HealthAuthorizationResult> => {
  try {
    const plugin = await loadHealthPlugin();
    if (!plugin) return { ok: false, error: 'plugin_not_loaded' };

    const mode = options?.mode ?? 'full';
    const read = options?.read ?? (mode === 'minimal' ? HEALTH_MINIMAL_READ : HEALTH_FULL_READ);

    // requestAuthorization returns AuthorizationStatus (readAuthorized/readDenied/etc.)
    const status = (await withTimeout(
      plugin.requestAuthorization({
        read,
        write: [],
      }),
      60000,
      'Health.requestAuthorization'
    )) as any;

    return {
      ok: true,
      status: {
        readAuthorized: (status?.readAuthorized ?? []) as HealthDataType[],
        readDenied: (status?.readDenied ?? []) as HealthDataType[],
        writeAuthorized: (status?.writeAuthorized ?? []) as HealthDataType[],
        writeDenied: (status?.writeDenied ?? []) as HealthDataType[],
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error requesting Health permissions:', error);
    return { ok: false, error: message };
  }
};

/**
 * Check authorization status without prompting
 */
export const checkHealthPermissions = async (options?: {
  read?: HealthDataType[];
}): Promise<boolean> => {
  try {
    const plugin = await loadHealthPlugin();
    if (!plugin) return false;

    const read = options?.read ?? HEALTH_MINIMAL_READ;

    const status = (await withTimeout(
      plugin.checkAuthorization({ read }),
      8000,
      'Health.checkAuthorization'
    )) as any;

    // Consider it "connected" if we have at least one authorized scope.
    return Array.isArray(status?.readAuthorized) && status.readAuthorized.length > 0;
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
    const start = performance.now();
    const result = await withTimeout(
      plugin.readSamples({
        dataType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100,
        ascending: false,
      }),
      10000,
      `Health.readSamples(${dataType})`
    ) as any;
    
    const samples = result?.samples || [];
    console.log(`[health] ${dataType}: ${samples.length} samples in ${Math.round(performance.now() - start)}ms`);
    return samples;
  } catch (error) {
    console.warn(`[health] ${dataType} FAILED:`, error instanceof Error ? error.message : error);
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
  console.log('[health] fetchHealthData: starting...');
  const plugin = await loadHealthPlugin();
  if (!plugin) {
    console.warn('[health] fetchHealthData: plugin not loaded');
    return null;
  }
  
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    // Look back 12 hours for sleep data (includes last night's sleep)
    const yesterdayNight = new Date(startOfToday);
    yesterdayNight.setHours(-12);
    
    // Fetch all data types in parallel using allSettled so one hanging
    // query doesn't block all the others.
    const results = await Promise.allSettled([
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

    const extract = (r: PromiseSettledResult<HealthSample[]>): HealthSample[] =>
      r.status === 'fulfilled' ? r.value : [];

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
    ] = results.map(extract);
    
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
    
    // Fetch workouts (with its own timeout — queryWorkouts can hang on some devices)
    let workouts: AppleHealthData['workouts'] = undefined;
    try {
      const workoutResult = await withTimeout(
        plugin.queryWorkouts({
          startDate: startOfToday.toISOString(),
          endDate: now.toISOString(),
          limit: 10,
        }),
        8000,
        'Health.queryWorkouts'
      ) as any;
      
      if (workoutResult?.workouts && workoutResult.workouts.length > 0) {
        workouts = workoutResult.workouts.map((w: any) => ({
          type: w.workoutType || 'other',
          startDate: w.startDate,
          endDate: w.endDate,
          duration: Math.round(w.duration / 60),
          calories: w.totalEnergyBurned,
          distance: w.totalDistance,
        }));
      }
    } catch (error) {
      console.warn('[health] No workout data:', error instanceof Error ? error.message : error);
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
