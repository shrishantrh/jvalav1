export type EntryType = 'flare' | 'medication' | 'trigger' | 'recovery' | 'energy' | 'note';

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

  // Physiological data
  physiologicalData?: {
    heartRate?: number;
    heartRateVariability?: number;
    bloodPressure?: {
      systolic: number;
      diastolic: number;
    };
    sleepHours?: number;
    sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
    stressLevel?: number; // 1-10 scale
    steps?: number;
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