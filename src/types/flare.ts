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

  // Comprehensive physiological data (from wearables like Fitbit)
  physiologicalData?: {
    // Core vitals
    heartRate?: number;
    heart_rate?: number;
    restingHeartRate?: number;
    resting_heart_rate?: number;
    heartRateVariability?: number;
    heart_rate_variability?: number;
    hrvRmssd?: number;
    hrv_rmssd?: number;
    hrvCoverage?: number;
    hrv_coverage?: number;
    hrvLowFreq?: number;
    hrv_low_freq?: number;
    hrvHighFreq?: number;
    hrv_high_freq?: number;
    
    // Blood Oxygen
    spo2?: number;
    spo2Avg?: number;
    spo2_avg?: number;
    spo2Min?: number;
    spo2_min?: number;
    spo2Max?: number;
    spo2_max?: number;
    
    // Breathing
    breathingRate?: number;
    breathing_rate?: number;
    breathingRateDeepSleep?: number;
    breathing_rate_deep_sleep?: number;
    breathingRateLightSleep?: number;
    breathing_rate_light_sleep?: number;
    breathingRateRemSleep?: number;
    breathing_rate_rem_sleep?: number;
    
    // Temperature
    skinTemperature?: number;
    skin_temperature?: number;
    
    // Cardio Fitness
    vo2Max?: number;
    vo2_max?: number;
    vo2MaxRange?: string;
    vo2_max_range?: string;
    
    // Active Zone Minutes
    activeZoneMinutesTotal?: number;
    active_zone_minutes_total?: number;
    fatBurnMinutes?: number;
    fat_burn_minutes?: number;
    cardioMinutes?: number;
    cardio_minutes?: number;
    peakMinutes?: number;
    peak_minutes?: number;
    
    // Sleep
    sleepHours?: number;
    sleep_hours?: number;
    sleepMinutes?: number;
    sleep_minutes?: number;
    sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent' | string;
    sleep_quality?: string;
    sleepStages?: {
      deep?: number;
      light?: number;
      rem?: number;
      wake?: number;
    };
    sleep_stages?: {
      deep?: number;
      light?: number;
      rem?: number;
      wake?: number;
    };
    deepSleepMinutes?: number;
    deep_sleep_minutes?: number;
    lightSleepMinutes?: number;
    light_sleep_minutes?: number;
    remSleepMinutes?: number;
    rem_sleep_minutes?: number;
    wakeSleepMinutes?: number;
    wake_sleep_minutes?: number;
    sleepEfficiency?: number;
    sleep_efficiency?: number;
    timeInBed?: number;
    time_in_bed?: number;
    
    // Activity
    steps?: number;
    activeMinutes?: number;
    active_minutes?: number;
    fairlyActiveMinutes?: number;
    fairly_active_minutes?: number;
    veryActiveMinutes?: number;
    very_active_minutes?: number;
    lightlyActiveMinutes?: number;
    lightly_active_minutes?: number;
    sedentaryMinutes?: number;
    sedentary_minutes?: number;
    caloriesBurned?: number;
    calories_burned?: number;
    caloriesBMR?: number;
    calories_bmr?: number;
    activityCalories?: number;
    activity_calories?: number;
    floors?: number;
    elevation?: number;
    distance?: number;
    
    // Legacy fields
    bloodPressure?: {
      systolic: number;
      diastolic: number;
    };
    stressLevel?: number;
    
    // Metadata
    syncedAt?: string;
    synced_at?: string;
    source?: 'fitbit' | 'apple_health' | 'google_fit' | 'oura' | 'simulated' | string;
    dataDate?: string;
    data_date?: string;
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