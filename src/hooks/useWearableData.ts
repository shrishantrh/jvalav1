import { useState, useEffect, useCallback } from 'react';
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

  // Check Fitbit connection status
  const checkFitbitConnection = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
      }
    } catch (error) {
      console.error('Error checking Fitbit connection:', error);
    }
  }, []);

  // Listen for OAuth callback message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'fitbit-connected') {
        checkFitbitConnection();
        syncData('fitbit');
        toast({
          title: 'Fitbit Connected',
          description: 'Your Fitbit account has been linked successfully.',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [checkFitbitConnection, toast]);

  // Check connection on mount
  useEffect(() => {
    checkFitbitConnection();
  }, [checkFitbitConnection]);

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

        // Get OAuth URL from edge function
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

        // Open OAuth in popup
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

      // For Apple Health and Google Fit - show coming soon
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
    
    // Clear data if no devices connected
    const stillConnected = connections.filter(c => c.type !== type && c.connected);
    if (stillConnected.length === 0) {
      setData(null);
    }
    
    toast({
      title: 'Device Disconnected',
      description: `Disconnected from ${type === 'fitbit' ? 'Fitbit' : type === 'apple_health' ? 'Apple Health' : 'Google Fit'}`,
    });
  }, [connections, toast]);

  const syncData = useCallback(async (type?: 'fitbit' | 'apple_health' | 'google_fit'): Promise<WearableData | null> => {
    const fitbitConnection = connections.find(c => c.type === 'fitbit' && c.connected);
    
    if (!fitbitConnection && !type) {
      return null;
    }
    
    setIsSyncing(true);
    
    try {
      if (type === 'fitbit' || fitbitConnection) {
        const { data: fitbitData, error } = await supabase.functions.invoke('fitbit-data');
        
        if (error) {
          console.error('Error fetching Fitbit data:', error);
          if (error.message?.includes('not_connected')) {
            toast({
              title: 'Fitbit Not Connected',
              description: 'Please connect your Fitbit account first.',
              variant: 'destructive',
            });
          }
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
        
        // Update last sync time
        setConnections(prev => prev.map(c => 
          c.type === 'fitbit'
            ? { ...c, lastSync: new Date() }
            : c
        ));
        
        return wearableData;
      }
      
      return null;
    } catch (error) {
      console.error('Error syncing wearable data:', error);
      toast({
        title: 'Sync Failed',
        description: 'Could not sync health data. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [connections, toast]);

  // Get current data for logging
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

  // Auto-sync every 15 minutes if connected
  useEffect(() => {
    const hasConnection = connections.some(c => c.connected);
    if (!hasConnection) return;
    
    const interval = setInterval(() => {
      syncData();
    }, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [connections, syncData]);

  // Initial data load when connected
  useEffect(() => {
    const fitbitConnected = connections.find(c => c.type === 'fitbit' && c.connected);
    if (fitbitConnected && !data) {
      syncData('fitbit');
    }
  }, [connections, data, syncData]);

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
