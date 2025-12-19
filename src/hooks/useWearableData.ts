import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface WearableData {
  heartRate?: number;
  heartRateVariability?: number;
  steps?: number;
  sleepHours?: number;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  activeMinutes?: number;
  caloriesBurned?: number;
  lastSyncedAt?: Date;
  source?: 'apple_health' | 'google_fit' | 'simulated';
}

interface WearableConnection {
  id: string;
  name: string;
  type: 'apple_health' | 'google_fit';
  connected: boolean;
  lastSync?: Date;
}

// Simulated wearable data generator for web demo
const generateSimulatedData = (): WearableData => {
  const now = new Date();
  const hourOfDay = now.getHours();
  
  // Generate realistic data based on time of day
  const baseHeartRate = 70;
  const heartRateVariation = Math.sin(hourOfDay * Math.PI / 12) * 10;
  
  return {
    heartRate: Math.round(baseHeartRate + heartRateVariation + (Math.random() * 10 - 5)),
    heartRateVariability: Math.round(35 + Math.random() * 30),
    steps: Math.round(hourOfDay * 500 + Math.random() * 1000),
    sleepHours: hourOfDay < 12 ? Math.round((6 + Math.random() * 2) * 10) / 10 : undefined,
    sleepQuality: ['poor', 'fair', 'good', 'excellent'][Math.floor(Math.random() * 4)] as WearableData['sleepQuality'],
    activeMinutes: Math.round(hourOfDay * 3 + Math.random() * 20),
    caloriesBurned: Math.round(hourOfDay * 80 + Math.random() * 200),
    lastSyncedAt: now,
    source: 'simulated',
  };
};

export const useWearableData = () => {
  const [data, setData] = useState<WearableData | null>(null);
  const [connections, setConnections] = useState<WearableConnection[]>([
    { id: 'apple-health', name: 'Apple Health', type: 'apple_health', connected: false },
    { id: 'google-fit', name: 'Google Fit', type: 'google_fit', connected: false },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Check for stored connection state
  useEffect(() => {
    const storedConnections = localStorage.getItem('wearable_connections');
    if (storedConnections) {
      try {
        const parsed = JSON.parse(storedConnections);
        setConnections(parsed);
      } catch (e) {
        console.error('Error parsing stored connections:', e);
      }
    }
  }, []);

  const connectDevice = useCallback(async (type: 'apple_health' | 'google_fit'): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // In a real app, this would trigger OAuth flow or native health API
      // For web demo, we simulate the connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const updatedConnections = connections.map(conn => 
        conn.type === type 
          ? { ...conn, connected: true, lastSync: new Date() }
          : conn
      );
      
      setConnections(updatedConnections);
      localStorage.setItem('wearable_connections', JSON.stringify(updatedConnections));
      
      toast({
        title: 'Device Connected',
        description: `Successfully connected to ${type === 'apple_health' ? 'Apple Health' : 'Google Fit'}`,
      });
      
      // Immediately fetch data after connecting
      await syncData(type);
      
      return true;
    } catch (error) {
      console.error('Error connecting device:', error);
      toast({
        title: 'Connection Failed',
        description: 'Could not connect to the health service. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [connections, toast]);

  const disconnectDevice = useCallback(async (type: 'apple_health' | 'google_fit') => {
    const updatedConnections = connections.map(conn => 
      conn.type === type 
        ? { ...conn, connected: false, lastSync: undefined }
        : conn
    );
    
    setConnections(updatedConnections);
    localStorage.setItem('wearable_connections', JSON.stringify(updatedConnections));
    
    // Clear data if no devices connected
    if (!updatedConnections.some(c => c.connected)) {
      setData(null);
    }
    
    toast({
      title: 'Device Disconnected',
      description: `Disconnected from ${type === 'apple_health' ? 'Apple Health' : 'Google Fit'}`,
    });
  }, [connections, toast]);

  const syncData = useCallback(async (type?: 'apple_health' | 'google_fit'): Promise<WearableData | null> => {
    const hasConnection = connections.some(c => c.connected);
    if (!hasConnection) {
      // Use simulated data for demo
      const simulated = generateSimulatedData();
      setData(simulated);
      return simulated;
    }
    
    setIsSyncing(true);
    
    try {
      // Simulate API call to health service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In production, this would call the actual health API
      const newData = generateSimulatedData();
      newData.source = type || 'simulated';
      
      setData(newData);
      
      // Update last sync time
      const updatedConnections = connections.map(conn => 
        (type ? conn.type === type : conn.connected)
          ? { ...conn, lastSync: new Date() }
          : conn
      );
      setConnections(updatedConnections);
      localStorage.setItem('wearable_connections', JSON.stringify(updatedConnections));
      
      return newData;
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
  const getDataForEntry = useCallback((): Record<string, any> | null => {
    if (!data) return null;
    
    return {
      heart_rate: data.heartRate,
      heart_rate_variability: data.heartRateVariability,
      steps: data.steps,
      sleep_hours: data.sleepHours,
      sleep_quality: data.sleepQuality,
      active_minutes: data.activeMinutes,
      calories_burned: data.caloriesBurned,
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

  // Initial data load
  useEffect(() => {
    const hasConnection = connections.some(c => c.connected);
    if (hasConnection && !data) {
      syncData();
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
  };
};
