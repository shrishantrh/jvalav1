export type EntryType = 'flare' | 'medication' | 'trigger' | 'recovery' | 'energy' | 'note' | 'wellness';

export type FlareSeverity = 'none' | 'mild' | 'moderate' | 'severe';
export type EnergyLevel = 'very-low' | 'low' | 'moderate' | 'good' | 'high';

export interface FlareEntry {
  id: string;
  timestamp: Date;
  type: EntryType;
  
  // Flare-specific fields
  severity?: FlareSeverity;
  symptoms?: string[];
  
  // Energy-specific fields
  energyLevel?: EnergyLevel;
  
  // Medication-specific fields
  medications?: string[];
  
  // Trigger-specific fields
  triggers?: string[];
  
  // General fields
  note?: string;
  
  // Photo and voice note fields
  photos?: string[];
  voiceTranscript?: string;
  
  context?: {
    activity?: string;
    location?: string;
    mood?: string;
  };

  // Follow-ups for tracking progress
  followUps?: {
    timestamp: string;
    note: string;
  }[];

  // Environmental data
  environmentalData?: {
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
      city?: string;
      country?: string;
    };
    weather?: {
      temperature: number;
      humidity: number;
      pressure: number;
      condition: string;
      windSpeed: number;
    };
    airQuality?: {
      pollen: number;
      pollutants: number;
      aqi: number;
    };
    season?: 'spring' | 'summer' | 'fall' | 'winter';
  };

  // Physiological data (from wearables)
  physiologicalData?: {
    heartRate?: number;
    heart_rate?: number; // snake_case alias
    heartRateVariability?: number;
    heart_rate_variability?: number;
    bloodPressure?: {
      systolic: number;
      diastolic: number;
    };
    sleepHours?: number;
    sleep_hours?: number;
    sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
    sleep_quality?: string;
    stressLevel?: number; // 1-10 scale
    steps?: number;
    activeMinutes?: number;
    active_minutes?: number;
    caloriesBurned?: number;
    calories_burned?: number;
    distance?: number;
    syncedAt?: string;
    synced_at?: string;
    source?: 'fitbit' | 'apple_health' | 'google_fit' | 'simulated' | string;
  };
}

export interface Symptom {
  id: string;
  name: string;
  icon: string;
  category?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  type: EntryType;
  icon: string;
  defaultData?: Partial<FlareEntry>;
}