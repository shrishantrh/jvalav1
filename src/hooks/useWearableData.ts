import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface WearableData {
  heartRate?: number;
  heartRateVariability?: number;
  steps?: number;
  sleepHours?: number;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  activeMinutes?: number;
  caloriesBurned?: number;
  distance?: number;
  lastSyncedAt?: Date;
  source?: 'fitbit' | 'apple_health' | 'google_fit' | 'simulated';
}

interface WearableConnection {
  id: string;
  name: string;
  type: 'fitbit' | 'apple_health' | 'google_fit';
  connected: boolean;
  lastSync?: Date;
}

export const useWearableData = () => {
  const [data, setData] = useState<WearableData | null>(null);
  const [connections, setConnections] = useState<WearableConnection[]>([
    { id: 'fitbit', name: 'Fitbit', type: 'fitbit', connected: false },
    { id: 'apple-health', name: 'Apple Health', type: 'apple_health', connected: false },
    { id: 'google-fit', name: 'Google Fit', type: 'google_fit', connected: false },
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

  const syncData = useCallback(async (type?: 'fitbit' | 'apple_health' | 'google_fit'): Promise<WearableData | null> => {
    setIsSyncing(true);
    
    try {
      const { data: fitbitData, error } = await supabase.functions.invoke('fitbit-data');
      
      if (error) {
        console.error('Error fetching Fitbit data:', error);
        return null;
      }

      if (fitbitData?.error) {
        console.log('Fitbit data error:', fitbitData.error);
        return null;
      }

      const wearableData: WearableData = {
        heartRate: fitbitData.heartRate,
        steps: fitbitData.steps,
        activeMinutes: fitbitData.activeMinutes,
        caloriesBurned: fitbitData.caloriesBurned,
        sleepHours: fitbitData.sleepHours,
        sleepQuality: fitbitData.sleepQuality,
        distance: fitbitData.distance,
        lastSyncedAt: new Date(fitbitData.lastSyncedAt),
        source: 'fitbit',
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
  }, []);

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

  const connectDevice = useCallback(async (type: 'fitbit' | 'apple_health' | 'google_fit'): Promise<boolean> => {
    setIsLoading(true);
    
    try {
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
        description: `${type === 'apple_health' ? 'Apple Health' : 'Google Fit'} integration requires the mobile app.`,
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
  }, [toast]);

  const disconnectDevice = useCallback(async (type: 'fitbit' | 'apple_health' | 'google_fit') => {
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
    
    toast({
      title: 'Device Disconnected',
      description: `Disconnected from ${type === 'fitbit' ? 'Fitbit' : type === 'apple_health' ? 'Apple Health' : 'Google Fit'}`,
    });
  }, [toast]);

  const getDataForEntry = useCallback((): Record<string, unknown> | null => {
    if (!data) return null;
    
    return {
      heart_rate: data.heartRate,
      heart_rate_variability: data.heartRateVariability,
      steps: data.steps,
      sleep_hours: data.sleepHours,
      sleep_quality: data.sleepQuality,
      active_minutes: data.activeMinutes,
      calories_burned: data.caloriesBurned,
      distance: data.distance,
      synced_at: data.lastSyncedAt?.toISOString(),
      source: data.source,
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
