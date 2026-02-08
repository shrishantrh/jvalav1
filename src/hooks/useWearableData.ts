import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isNative, platform } from '@/lib/capacitor';
import {
  isHealthAvailable,
  checkHealthPermissions,
  requestHealthPermissions,
  fetchHealthData,
  convertToPhysiologicalData,
  getHealthPlatformName,
  isHealthPluginPresent,
  AppleHealthData,
  HEALTH_FULL_READ,
  HEALTH_MINIMAL_READ,
} from '@/services/appleHealthService';

// Prevent “infinite loading” when a native plugin call never resolves.
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

const getInjectedHealthPlugin = (): any | null => {
  try {
    return (window as any)?.Capacitor?.Plugins?.Health ?? null;
  } catch {
    return null;
  }
};

export interface WearableData {
  // Core vitals
  heartRate?: number;
  restingHeartRate?: number;
  heartRateVariability?: number;
  hrvRmssd?: number;
  hrvCoverage?: number;
  hrvLowFreq?: number;
  hrvHighFreq?: number;
  
  // Blood Oxygen
  spo2?: number;
  spo2Avg?: number;
  spo2Min?: number;
  spo2Max?: number;
  
  // Breathing
  breathingRate?: number;
  breathingRateDeepSleep?: number;
  breathingRateLightSleep?: number;
  breathingRateRemSleep?: number;
  
  // Temperature
  skinTemperature?: number;
  
  // Cardio Fitness
  vo2Max?: number;
  vo2MaxRange?: string;
  
  // Active Zone Minutes
  activeZoneMinutesTotal?: number;
  fatBurnMinutes?: number;
  cardioMinutes?: number;
  peakMinutes?: number;
  
  // Sleep
  sleepHours?: number;
  sleepMinutes?: number;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  sleepStages?: {
    deep?: number;
    light?: number;
    rem?: number;
    wake?: number;
  };
  deepSleepMinutes?: number;
  lightSleepMinutes?: number;
  remSleepMinutes?: number;
  wakeSleepMinutes?: number;
  sleepEfficiency?: number;
  timeInBed?: number;
  
  // Activity
  steps?: number;
  activeMinutes?: number;
  fairlyActiveMinutes?: number;
  veryActiveMinutes?: number;
  lightlyActiveMinutes?: number;
  sedentaryMinutes?: number;
  caloriesBurned?: number;
  caloriesBMR?: number;
  activityCalories?: number;
  floors?: number;
  elevation?: number;
  distance?: number;
  
  // Oura-specific
  readinessScore?: number;
  sleepScore?: number;
  
  // Workouts (Apple Health / Health Connect)
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
  source?: 'fitbit' | 'apple_health' | 'google_fit' | 'oura' | 'simulated';
  dataDate?: string;
}

interface WearableConnection {
  id: string;
  name: string;
  type: 'fitbit' | 'apple_health' | 'google_fit' | 'oura';
  connected: boolean;
  lastSync?: Date;
  comingSoon?: boolean;
  nativeOnly?: boolean; // Only available in native apps
}

export const useWearableData = () => {
  const [data, setData] = useState<WearableData | null>(null);
  const [connections, setConnections] = useState<WearableConnection[]>(() => {
    // Determine which connections to show based on platform
    const isIOS = isNative && platform === 'ios';
    const isAndroid = isNative && platform === 'android';
    
    return [
      { id: 'fitbit', name: 'Fitbit', type: 'fitbit', connected: false },
      { id: 'oura', name: 'Oura Ring', type: 'oura', connected: false, comingSoon: true },
      { 
        id: 'apple-health', 
        name: 'Apple Health', 
        type: 'apple_health', 
        connected: false, 
        // Available on iOS native, coming soon on web
        comingSoon: !isIOS,
        nativeOnly: true,
      },
      { 
        id: 'google-fit', 
        name: 'Health Connect', 
        type: 'google_fit', 
        connected: false, 
        // Available on Android native, coming soon on web
        comingSoon: !isAndroid,
        nativeOnly: true,
      },
    ];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const { toast } = useToast();
  const hasSyncedRef = useRef(false);

  // Check Fitbit connection status
  const checkFitbitConnection = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: tokenData } = await supabase
        .from('fitbit_tokens')
        .select('updated_at')
        .eq('user_id', user.id)
        .single();

      if (tokenData) {
        setConnections(prev => prev.map(c => 
          c.type === 'fitbit' 
            ? { ...c, connected: true, lastSync: new Date(tokenData.updated_at) }
            : c
        ));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking Fitbit connection:', error);
      return false;
    }
  }, []);

  // Check Apple Health / Health Connect connection
  const checkNativeHealthConnection = useCallback(async () => {
    if (!isNative) return false;

    try {
      // Never let the app hang on mount because a native plugin call never resolves.
      // If availability can't be determined quickly, treat it as unavailable.
      const available = await withTimeout(isHealthAvailable(), 3500, 'Health.isAvailable');
      setHealthAvailable(available);

      if (!available) return false;

      const hasPermissions = await withTimeout(
        checkHealthPermissions(),
        6000,
        'Health.checkAuthorization'
      );

      if (hasPermissions) {
        const healthType = platform === 'ios' ? 'apple_health' : 'google_fit';
        setConnections(prev =>
          prev.map(c => (c.type === healthType ? { ...c, connected: true, comingSoon: false } : c))
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking native health connection:', error);
      setHealthAvailable(false);
      return false;
    }
  }, []);

  const syncData = useCallback(async (type?: 'fitbit' | 'apple_health' | 'google_fit' | 'oura'): Promise<WearableData | null> => {
    setIsSyncing(true);
    
    try {
      // Check for Apple Health / Health Connect sync
      if (type === 'apple_health' || type === 'google_fit') {
        // Native plugin calls can occasionally hang; never let a flare log wait forever on this.
        const healthData = await withTimeout(fetchHealthData(), 12000, 'Health.fetchHealthData').catch(() => null);
        if (!healthData) {
          console.log('No native health data available');
          return null;
        }
        
        // Convert to WearableData format
        const wearableData: WearableData = {
          heartRate: healthData.heartRate,
          restingHeartRate: healthData.restingHeartRate,
          heartRateVariability: healthData.heartRateVariability,
          spo2: healthData.spo2,
          breathingRate: healthData.respiratoryRate,
          steps: healthData.steps,
          distance: healthData.distance,
          caloriesBurned: healthData.caloriesBurned,
          sleepHours: healthData.sleepHours,
          sleepMinutes: healthData.sleepMinutes,
          sleepQuality: healthData.sleepQuality,
          deepSleepMinutes: healthData.deepSleepMinutes,
          remSleepMinutes: healthData.remSleepMinutes,
          lightSleepMinutes: healthData.lightSleepMinutes,
          wakeSleepMinutes: healthData.awakeSleepMinutes,
          timeInBed: healthData.inBedMinutes,
          workouts: healthData.workouts,
          lastSyncedAt: healthData.lastSyncedAt,
          source: 'apple_health',
          dataDate: healthData.dataDate,
        };
        
        setData(wearableData);
        setConnections(prev => prev.map(c => 
          c.type === type ? { ...c, lastSync: new Date() } : c
        ));
        
        return wearableData;
      }
      // Fitbit sync
      const fitbitConnected = connections.find(c => c.type === 'fitbit')?.connected;
      
      if (!fitbitConnected && type !== 'fitbit') {
        // Check if native health is connected
        const appleConnected = connections.find(c => c.type === 'apple_health')?.connected;
        const googleConnected = connections.find(c => c.type === 'google_fit')?.connected;
        
        if (appleConnected) {
          return syncData('apple_health');
        } else if (googleConnected) {
          return syncData('google_fit');
        }
        
        console.log('No active wearable connections');
        return null;
      }
      
      // Fitbit sync via edge function
      const { data: fitbitData, error } = await supabase.functions.invoke('fitbit-data');
      
      if (error) {
        console.error('Error fetching Fitbit data:', error);
        return null;
      }

      if (fitbitData?.error) {
        console.log('Fitbit data error:', fitbitData.error);
        return null;
      }

      // Map all comprehensive Fitbit data
      const wearableData: WearableData = {
        // Core vitals
        heartRate: fitbitData.heartRate,
        restingHeartRate: fitbitData.restingHeartRate,
        heartRateVariability: fitbitData.hrv || fitbitData.hrvRmssd,
        hrvRmssd: fitbitData.hrvRmssd,
        hrvCoverage: fitbitData.hrvCoverage,
        hrvLowFreq: fitbitData.hrvLowFreq,
        hrvHighFreq: fitbitData.hrvHighFreq,
        
        // Blood Oxygen
        spo2: fitbitData.spo2,
        spo2Avg: fitbitData.spo2Avg,
        spo2Min: fitbitData.spo2Min,
        spo2Max: fitbitData.spo2Max,
        
        // Breathing
        breathingRate: fitbitData.breathingRate,
        breathingRateDeepSleep: fitbitData.breathingRateDeepSleep,
        breathingRateLightSleep: fitbitData.breathingRateLightSleep,
        breathingRateRemSleep: fitbitData.breathingRateRemSleep,
        
        // Temperature
        skinTemperature: fitbitData.skinTemperature,
        
        // Cardio Fitness
        vo2Max: fitbitData.vo2Max,
        vo2MaxRange: fitbitData.vo2MaxRange,
        
        // Active Zone Minutes
        activeZoneMinutesTotal: fitbitData.activeZoneMinutesTotal,
        fatBurnMinutes: fitbitData.fatBurnMinutes,
        cardioMinutes: fitbitData.cardioMinutes,
        peakMinutes: fitbitData.peakMinutes,
        
        // Sleep
        sleepHours: fitbitData.sleepHours,
        sleepMinutes: fitbitData.sleepMinutes,
        sleepQuality: fitbitData.sleepQuality,
        sleepStages: fitbitData.sleepStages,
        deepSleepMinutes: fitbitData.deepSleepMinutes,
        lightSleepMinutes: fitbitData.lightSleepMinutes,
        remSleepMinutes: fitbitData.remSleepMinutes,
        wakeSleepMinutes: fitbitData.wakeSleepMinutes,
        sleepEfficiency: fitbitData.sleepEfficiency,
        timeInBed: fitbitData.timeInBed,
        
        // Activity
        steps: fitbitData.steps,
        activeMinutes: fitbitData.activeMinutes,
        fairlyActiveMinutes: fitbitData.fairlyActiveMinutes,
        veryActiveMinutes: fitbitData.veryActiveMinutes,
        lightlyActiveMinutes: fitbitData.lightlyActiveMinutes,
        sedentaryMinutes: fitbitData.sedentaryMinutes,
        caloriesBurned: fitbitData.caloriesBurned,
        caloriesBMR: fitbitData.caloriesBMR,
        activityCalories: fitbitData.activityCalories,
        floors: fitbitData.floors,
        elevation: fitbitData.elevation,
        distance: fitbitData.distance,
        
        // Metadata
        lastSyncedAt: new Date(fitbitData.lastSyncedAt),
        source: 'fitbit',
        dataDate: fitbitData.dataDate,
      };
      
      setData(wearableData);
      setConnections(prev => prev.map(c => 
        c.type === 'fitbit' ? { ...c, lastSync: new Date() } : c
      ));
      
      return wearableData;
    } catch (error) {
      console.error('Error syncing wearable data:', error);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [connections]);

  // Listen for OAuth callback message
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'fitbit-connected') {
        await checkFitbitConnection();
        await syncData('fitbit');
        toast({
          title: 'Fitbit Connected',
          description: 'Your Fitbit account has been linked successfully.',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [checkFitbitConnection, syncData, toast]);

  // Check connections on mount
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      // Check Fitbit connection
      const fitbitConnected = await checkFitbitConnection();
      if (fitbitConnected && mounted && !hasSyncedRef.current) {
        hasSyncedRef.current = true;
        await syncData('fitbit');
      }
      
      // Check native health connection (Apple Health / Health Connect)
      if (isNative && mounted) {
        const nativeConnected = await checkNativeHealthConnection();
        if (nativeConnected && !hasSyncedRef.current) {
          hasSyncedRef.current = true;
          const healthType = platform === 'ios' ? 'apple_health' : 'google_fit';
          await syncData(healthType as 'apple_health' | 'google_fit');
        }
      }
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, [checkFitbitConnection, checkNativeHealthConnection, syncData]);

  const connectDevice = useCallback(async (type: 'fitbit' | 'apple_health' | 'google_fit' | 'oura'): Promise<boolean> => {
    setIsLoading(true);

    // Used to surface *where* we hung when the native bridge doesn't respond.
    // This keeps future debugging to one run instead of trial-and-error.
    let phase: string = 'starting';
    
    try {
      // Check if device is coming soon
      const connection = connections.find(c => c.type === type);
      if (connection?.comingSoon) {
        toast({
          title: 'Coming Soon',
          description: `${connection.name} integration is coming soon!`,
        });
        return false;
      }
      
      if (type === 'fitbit') {
        phase = 'fitbit_auth';
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({
            title: 'Not logged in',
            description: 'Please log in to connect Fitbit.',
            variant: 'destructive',
          });
          return false;
        }

        const { data, error } = await supabase.functions.invoke('fitbit-auth', {
          body: { 
            user_id: user.id,
            redirect_uri: window.location.origin
          }
        });

        if (error || !data?.auth_url) {
          console.error('Error getting auth URL:', error);
          toast({
            title: 'Connection Failed',
            description: 'Could not initiate Fitbit connection.',
            variant: 'destructive',
          });
          return false;
        }

        const width = 500;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        window.open(
          data.auth_url,
          'fitbit-auth',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        return true;
      }
      
      // Handle Apple Health / Health Connect
      if (type === 'apple_health' || type === 'google_fit') {
        if (!isNative) {
          toast({
            title: 'Requires the mobile app',
            description: `${getHealthPlatformName()} only works when running on your iPhone/Android app (not the browser).`,
            variant: 'destructive',
          });
          return false;
        }

        // 1) First verify the plugin is actually present in *this* native build.
        // If this is missing, JS-to-native calls can hang forever (exactly what you're seeing).
        phase = 'checking_plugin_presence';
        if (!isHealthPluginPresent()) {
          toast({
            title: `${getHealthPlatformName()} not available in this build`,
            description:
              `The native health plugin isn’t present, so iOS can’t show the permission sheet. Fix: run npx cap sync ios, open ios/App/App.xcworkspace in Xcode, ensure HealthKit capability is enabled, then Clean Build Folder and reinstall the app (delete it from the iPhone first).`,
            variant: 'destructive',
          });
          return false;
        }

        // 2) Verify availability (helpful when HealthKit capability/usage strings are missing).
        // IMPORTANT: On some misconfigured builds Health.isAvailable() can hang; if it times out,
        // we still try requestAuthorization() directly so the permission sheet can appear.
        phase = 'checking_availability';
        console.log(`[wearables] ${type}: checking availability...`);

        let available: boolean | null = null;
        try {
          available = await withTimeout(isHealthAvailable(), 6000, 'Health.isAvailable');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/timed out/i.test(msg)) {
            console.warn('[wearables] Health.isAvailable timed out; attempting requestAuthorization anyway');
            available = null; // unknown
          } else {
            throw e;
          }
        }

        if (available === false) {
          toast({
            title: `${getHealthPlatformName()} unavailable`,
            description:
              `This device/app build can’t access ${getHealthPlatformName()}. In Xcode, enable the HealthKit capability and add Health usage descriptions, then rebuild.`,
            variant: 'destructive',
          });
          return false;
        }

        // 2) Request permissions (this should show the Health permission sheet)
        // User expectation: request the full set upfront so they can approve everything in one go.
        // If the full request fails (some iOS builds can be brittle), we fall back to minimal so the
        // connection can still complete, then instruct the user to enable additional scopes in Health.
        phase = 'requesting_permissions';
        console.log(`[wearables] ${type}: requesting permissions (full)...`);
        toast({
          title: `Connect ${getHealthPlatformName()}`,
          description: 'Requesting permission in the Health app…',
        });

        // IMPORTANT: Prefer calling the injected native proxy directly.
        // When projects use SPM, importing the module can sometimes produce a proxy that exists
        // in JS but isn’t bound to the native implementation, resulting in a hung Promise.
        const injected = getInjectedHealthPlugin();

        let ok = false;
        let lastError: string | undefined;

        // Try FULL first (one permission sheet)
        try {
          if (injected) {
            await withTimeout(
              injected.requestAuthorization({ read: HEALTH_FULL_READ, write: [] }),
              60000,
              'Health.requestAuthorization(full)'
            );
          } else {
            const result = await withTimeout(
              requestHealthPermissions({ mode: 'full' }),
              60000,
              'Health.requestAuthorization(full)'
            );
            if ((result as any)?.ok !== true) {
              throw new Error((result as any)?.error || 'full_authorization_failed');
            }
          }
          ok = true;
        } catch (e) {
          ok = false;
          lastError = e instanceof Error ? e.message : String(e);
        }

        // Fallback: minimal so the connection can still complete
        if (!ok) {
          console.warn('[wearables] full authorization failed; falling back to minimal:', lastError);

          try {
            if (injected) {
              await withTimeout(
                injected.requestAuthorization({ read: HEALTH_MINIMAL_READ, write: [] }),
                60000,
                'Health.requestAuthorization(minimal)'
              );
            } else {
              const result = await withTimeout(
                requestHealthPermissions({ mode: 'minimal' }),
                60000,
                'Health.requestAuthorization(minimal)'
              );
              if ((result as any)?.ok !== true) {
                throw new Error((result as any)?.error || 'minimal_authorization_failed');
              }
            }

            ok = true;
            toast({
              title: 'Connected with limited permissions',
              description:
                'We connected, but iOS didn’t accept the full permission request in one step. Open Health → Sharing → Apps → Jvala to enable additional data types.',
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast({
              title: 'Permission Request Failed',
              description: msg,
              variant: 'destructive',
            });
            return false;
          }
        }

        phase = 'confirming_authorization';
        console.log(`[wearables] ${type}: checking authorization...`);

        // iOS can successfully grant permissions but the JS bridge sometimes times out / flakes here.
        // If the user just approved in the Health sheet, treat a timeout as “likely authorized” and proceed.
        let authorized = false;
        try {
          authorized = await withTimeout(checkHealthPermissions(), 9000, 'Health.checkAuthorization');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/timed out/i.test(msg)) {
            console.warn('[wearables] checkAuthorization timed out; proceeding as connected');
            authorized = true;
            toast({
              title: 'Connected (verification timed out)',
              description: 'Permissions appear granted, but iOS didn’t respond in time. You can continue; use Sync to confirm data is flowing.',
            });
          } else {
            throw e;
          }
        }

        if (!authorized) {
          toast({
            title: 'Not authorized yet',
            description: `We didn’t receive permission. Open the Health app → Sharing → Apps → Jvala and enable access, then try again.`,
            variant: 'destructive',
          });
          return false;
        }
        // Update connection status immediately (don’t block the UI on the initial data read).
        setConnections(prev =>
          prev.map(c => (c.type === type ? { ...c, connected: true, comingSoon: false } : c))
        );

        toast({
          title: `${getHealthPlatformName()} Connected`,
          description: 'Permissions granted. Syncing your health data…',
        });

        // Kick off initial sync in the background. If it fails, we’ll surface a toast.
        // IMPORTANT: Don’t await this; the user should never be stuck in a spinner after granting access.
        void (async () => {
          try {
            phase = 'initial_sync';
            console.log(`[wearables] ${type}: syncing data (background)...`);
            const newData = await withTimeout(syncData(type), 25000, 'Wearables.syncData');
            if (!newData) {
              toast({
                title: 'Connected, but no data yet',
                description: `We connected to ${getHealthPlatformName()}, but couldn’t read any data yet. Try “Sync” again in a moment.`,
              });
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast({
              title: 'Health sync failed',
              description: msg,
              variant: 'destructive',
            });
          }
        })();

        return true;
      }

      toast({
        title: 'Coming Soon',
        description: `${type === 'oura' ? 'Oura Ring' : type} integration is coming soon!`,
      });
      return false;
    } catch (error) {
      console.error('Error connecting device:', error);

      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error';

      const isTimeout = /timed out/i.test(message);

       toast({
         title: isTimeout ? 'Connection timed out' : 'Connection Failed',
         description: isTimeout
           ? `The ${getHealthPlatformName()} permission flow didn’t return in time during: ${phase}. If the Health app opened, finish the permission steps there, then return to Jvala and try Connect again. If it never opened, this points to a native build configuration issue (HealthKit capability/usage strings) or the plugin not being included in the build.`
           : message,
         variant: 'destructive',
       });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast, connections]);

  const disconnectDevice = useCallback(async (type: 'fitbit' | 'apple_health' | 'google_fit' | 'oura') => {
    if (type === 'fitbit') {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('fitbit_tokens')
            .delete()
            .eq('user_id', user.id);
        }
      } catch (error) {
        console.error('Error disconnecting Fitbit:', error);
      }
    }

    setConnections(prev => prev.map(c => 
      c.type === type 
        ? { ...c, connected: false, lastSync: undefined }
        : c
    ));
    
    setData(null);
    hasSyncedRef.current = false;
    
    const deviceNames: Record<string, string> = {
      fitbit: 'Fitbit',
      oura: 'Oura Ring',
      apple_health: 'Apple Health',
      google_fit: 'Google Fit'
    };
    
    toast({
      title: 'Device Disconnected',
      description: `Disconnected from ${deviceNames[type]}`,
    });
  }, [toast]);

  const getDataForEntry = useCallback((): Record<string, unknown> | null => {
    if (!data) return null;
    
    // Return comprehensive physiological data for flare entries
    return {
      // Core vitals
      heart_rate: data.heartRate,
      resting_heart_rate: data.restingHeartRate,
      heart_rate_variability: data.heartRateVariability,
      hrv_rmssd: data.hrvRmssd,
      hrv_coverage: data.hrvCoverage,
      hrv_low_freq: data.hrvLowFreq,
      hrv_high_freq: data.hrvHighFreq,
      
      // Blood Oxygen
      spo2: data.spo2,
      spo2_avg: data.spo2Avg,
      spo2_min: data.spo2Min,
      spo2_max: data.spo2Max,
      
      // Breathing
      breathing_rate: data.breathingRate,
      breathing_rate_deep_sleep: data.breathingRateDeepSleep,
      breathing_rate_light_sleep: data.breathingRateLightSleep,
      breathing_rate_rem_sleep: data.breathingRateRemSleep,
      
      // Temperature
      skin_temperature: data.skinTemperature,
      
      // Cardio Fitness
      vo2_max: data.vo2Max,
      vo2_max_range: data.vo2MaxRange,
      
      // Active Zone Minutes
      active_zone_minutes_total: data.activeZoneMinutesTotal,
      fat_burn_minutes: data.fatBurnMinutes,
      cardio_minutes: data.cardioMinutes,
      peak_minutes: data.peakMinutes,
      
      // Sleep
      sleep_hours: data.sleepHours,
      sleep_minutes: data.sleepMinutes,
      sleep_quality: data.sleepQuality,
      sleep_stages: data.sleepStages,
      deep_sleep_minutes: data.deepSleepMinutes,
      light_sleep_minutes: data.lightSleepMinutes,
      rem_sleep_minutes: data.remSleepMinutes,
      wake_sleep_minutes: data.wakeSleepMinutes,
      sleep_efficiency: data.sleepEfficiency,
      time_in_bed: data.timeInBed,
      
      // Activity
      steps: data.steps,
      active_minutes: data.activeMinutes,
      fairly_active_minutes: data.fairlyActiveMinutes,
      very_active_minutes: data.veryActiveMinutes,
      lightly_active_minutes: data.lightlyActiveMinutes,
      sedentary_minutes: data.sedentaryMinutes,
      calories_burned: data.caloriesBurned,
      calories_bmr: data.caloriesBMR,
      activity_calories: data.activityCalories,
      floors: data.floors,
      elevation: data.elevation,
      distance: data.distance,
      
      // Metadata
      synced_at: data.lastSyncedAt?.toISOString(),
      source: data.source,
      data_date: data.dataDate,
    };
  }, [data]);

  return {
    data,
    connections,
    isLoading,
    isSyncing,
    connectDevice,
    disconnectDevice,
    syncData,
    getDataForEntry,
    checkFitbitConnection,
  };
};
