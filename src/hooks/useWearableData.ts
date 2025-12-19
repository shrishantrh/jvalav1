import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
}

export const useWearableData = () => {
  const [data, setData] = useState<WearableData | null>(null);
  const [connections, setConnections] = useState<WearableConnection[]>([
    { id: 'fitbit', name: 'Fitbit', type: 'fitbit', connected: false },
    { id: 'oura', name: 'Oura Ring', type: 'oura', connected: false, comingSoon: true },
    { id: 'apple-health', name: 'Apple Health', type: 'apple_health', connected: false, comingSoon: true },
    { id: 'google-fit', name: 'Google Fit', type: 'google_fit', connected: false, comingSoon: true },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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

  const syncData = useCallback(async (type?: 'fitbit' | 'apple_health' | 'google_fit' | 'oura'): Promise<WearableData | null> => {
    setIsSyncing(true);
    
    try {
      // Determine which service to sync based on type or connected devices
      const fitbitConnected = connections.find(c => c.type === 'fitbit')?.connected;
      
      // Only Fitbit is currently active
      if (!fitbitConnected && type !== 'fitbit') {
        console.log('No active wearable connections');
        return null;
      }
      
      // Fitbit sync
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

  // Check connection on mount
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      const connected = await checkFitbitConnection();
      if (connected && mounted && !hasSyncedRef.current) {
        hasSyncedRef.current = true;
        await syncData('fitbit');
      }
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, [checkFitbitConnection, syncData]);

  const connectDevice = useCallback(async (type: 'fitbit' | 'apple_health' | 'google_fit' | 'oura'): Promise<boolean> => {
    setIsLoading(true);
    
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

      toast({
        title: 'Coming Soon',
        description: `${type === 'apple_health' ? 'Apple Health' : type === 'google_fit' ? 'Google Fit' : 'Oura Ring'} integration is coming soon!`,
      });
      return false;
    } catch (error) {
      console.error('Error connecting device:', error);
      toast({
        title: 'Connection Failed',
        description: 'Could not connect to the health service.',
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
