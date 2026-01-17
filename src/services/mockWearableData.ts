// Mock wearable data service for VC demo
// Generates realistic Fitbit data for demonstration purposes

export interface MockWearableData {
  // Core vitals
  heartRate: number;
  restingHeartRate: number;
  heartRateVariability: number;
  hrvRmssd: number;
  hrvCoverage: number;
  
  // Blood Oxygen
  spo2: number;
  spo2Avg: number;
  spo2Min: number;
  spo2Max: number;
  
  // Breathing
  breathingRate: number;
  breathingRateDeepSleep: number;
  breathingRateLightSleep: number;
  breathingRateRemSleep: number;
  
  // Temperature
  skinTemperature: number;
  
  // Cardio Fitness
  vo2Max: number;
  vo2MaxRange: string;
  
  // Active Zone Minutes
  activeZoneMinutesTotal: number;
  fatBurnMinutes: number;
  cardioMinutes: number;
  peakMinutes: number;
  
  // Sleep
  sleepHours: number;
  sleepMinutes: number;
  sleepQuality: 'poor' | 'fair' | 'good' | 'excellent';
  sleepEfficiency: number;
  deepSleepMinutes: number;
  lightSleepMinutes: number;
  remSleepMinutes: number;
  wakeSleepMinutes: number;
  timeInBed: number;
  
  // Activity
  steps: number;
  activeMinutes: number;
  fairlyActiveMinutes: number;
  veryActiveMinutes: number;
  lightlyActiveMinutes: number;
  sedentaryMinutes: number;
  caloriesBurned: number;
  caloriesBMR: number;
  activityCalories: number;
  floors: number;
  elevation: number;
  distance: number;
  
  // Metadata
  lastSyncedAt: string;
  source: 'fitbit';
  dataDate: string;
}

export interface MockEnvironmentalData {
  location: {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
    address: string;
  };
  weather: {
    temperature: number;
    humidity: number;
    pressure: number;
    condition: string;
    windSpeed: number;
  };
  airQuality: {
    aqi: number;
    pollen: number;
    pollutants: number;
    category: string;
  };
  season: 'spring' | 'summer' | 'fall' | 'winter';
}

// Generate realistic mock Fitbit data
export function generateMockWearableData(variant: 'healthy' | 'flare-warning' | 'flare-active' = 'healthy'): MockWearableData {
  const baseData: MockWearableData = {
    // Core vitals - vary based on health state
    heartRate: variant === 'flare-active' ? 88 : variant === 'flare-warning' ? 78 : 72,
    restingHeartRate: variant === 'flare-active' ? 75 : variant === 'flare-warning' ? 68 : 62,
    heartRateVariability: variant === 'flare-active' ? 28 : variant === 'flare-warning' ? 38 : 52,
    hrvRmssd: variant === 'flare-active' ? 26.5 : variant === 'flare-warning' ? 35.2 : 48.7,
    hrvCoverage: 94.5,
    
    // Blood Oxygen
    spo2: variant === 'flare-active' ? 96 : 98,
    spo2Avg: variant === 'flare-active' ? 95.8 : 97.5,
    spo2Min: variant === 'flare-active' ? 93 : 95,
    spo2Max: 99,
    
    // Breathing
    breathingRate: variant === 'flare-active' ? 17.2 : variant === 'flare-warning' ? 15.5 : 14.2,
    breathingRateDeepSleep: variant === 'flare-active' ? 15.5 : 13.8,
    breathingRateLightSleep: variant === 'flare-active' ? 16.2 : 14.5,
    breathingRateRemSleep: variant === 'flare-active' ? 17.0 : 15.2,
    
    // Temperature
    skinTemperature: variant === 'flare-active' ? 0.8 : variant === 'flare-warning' ? 0.3 : -0.1,
    
    // Cardio Fitness
    vo2Max: variant === 'flare-active' ? 35 : 42,
    vo2MaxRange: variant === 'flare-active' ? 'Fair' : 'Good-Excellent',
    
    // Active Zone Minutes
    activeZoneMinutesTotal: variant === 'flare-active' ? 12 : variant === 'flare-warning' ? 28 : 45,
    fatBurnMinutes: variant === 'flare-active' ? 8 : 22,
    cardioMinutes: variant === 'flare-active' ? 4 : 18,
    peakMinutes: variant === 'flare-active' ? 0 : 5,
    
    // Sleep - significantly impacted during flares
    sleepHours: variant === 'flare-active' ? 5.2 : variant === 'flare-warning' ? 6.5 : 7.8,
    sleepMinutes: variant === 'flare-active' ? 312 : variant === 'flare-warning' ? 390 : 468,
    sleepQuality: variant === 'flare-active' ? 'poor' : variant === 'flare-warning' ? 'fair' : 'good',
    sleepEfficiency: variant === 'flare-active' ? 72 : variant === 'flare-warning' ? 82 : 91,
    deepSleepMinutes: variant === 'flare-active' ? 32 : variant === 'flare-warning' ? 58 : 85,
    lightSleepMinutes: variant === 'flare-active' ? 180 : variant === 'flare-warning' ? 210 : 245,
    remSleepMinutes: variant === 'flare-active' ? 62 : variant === 'flare-warning' ? 95 : 115,
    wakeSleepMinutes: variant === 'flare-active' ? 38 : variant === 'flare-warning' ? 27 : 23,
    timeInBed: variant === 'flare-active' ? 433 : variant === 'flare-warning' ? 475 : 514,
    
    // Activity - reduced during flares
    steps: variant === 'flare-active' ? 2847 : variant === 'flare-warning' ? 5234 : 8752,
    activeMinutes: variant === 'flare-active' ? 18 : variant === 'flare-warning' ? 35 : 62,
    fairlyActiveMinutes: variant === 'flare-active' ? 12 : 28,
    veryActiveMinutes: variant === 'flare-active' ? 6 : 34,
    lightlyActiveMinutes: variant === 'flare-active' ? 95 : 185,
    sedentaryMinutes: variant === 'flare-active' ? 680 : 520,
    caloriesBurned: variant === 'flare-active' ? 1654 : variant === 'flare-warning' ? 1892 : 2234,
    caloriesBMR: 1480,
    activityCalories: variant === 'flare-active' ? 174 : variant === 'flare-warning' ? 412 : 754,
    floors: variant === 'flare-active' ? 3 : 12,
    elevation: variant === 'flare-active' ? 9.1 : 36.6,
    distance: variant === 'flare-active' ? 1.8 : variant === 'flare-warning' ? 3.4 : 6.2,
    
    // Metadata
    lastSyncedAt: new Date().toISOString(),
    source: 'fitbit',
    dataDate: new Date().toISOString().split('T')[0],
  };
  
  return baseData;
}

// Generate mock environmental data
export function generateMockEnvironmentalData(): MockEnvironmentalData {
  return {
    location: {
      latitude: 40.1020,
      longitude: -88.2272,
      city: 'Champaign',
      country: 'United States',
      address: 'University of Illinois',
    },
    weather: {
      temperature: 72,
      humidity: 58,
      pressure: 1015.2,
      condition: 'Partly Cloudy',
      windSpeed: 8.5,
    },
    airQuality: {
      aqi: 42,
      pollen: 3.2,
      pollutants: 15,
      category: 'Good',
    },
    season: 'summer',
  };
}

// Generate historical mock entries for demo
export function generateMockFlareHistory(days: number = 30) {
  const entries = [];
  const now = new Date();
  
  // Pattern: flares tend to cluster, with recovery periods
  const flarePattern = [
    { day: -2, severity: 'severe', triggers: ['Poor Sleep', 'High Stress', 'Weather Change'] },
    { day: -3, severity: 'moderate', triggers: ['Poor Sleep', 'Barometric Pressure'] },
    { day: -7, severity: 'mild', triggers: ['Alcohol', 'Late Night'] },
    { day: -12, severity: 'moderate', triggers: ['Stress', 'Missed Medication'] },
    { day: -15, severity: 'severe', triggers: ['Weather Change', 'Poor Sleep', 'High Pollen'] },
    { day: -16, severity: 'moderate', triggers: ['Poor Sleep'] },
    { day: -22, severity: 'mild', triggers: ['Dehydration'] },
    { day: -25, severity: 'moderate', triggers: ['Stress', 'Poor Sleep'] },
  ];
  
  flarePattern.forEach(flare => {
    const date = new Date(now);
    date.setDate(date.getDate() + flare.day);
    
    entries.push({
      id: `demo-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: date,
      type: 'flare',
      severity: flare.severity,
      triggers: flare.triggers,
      symptoms: flare.severity === 'severe' 
        ? ['Intense Pain', 'Fatigue', 'Brain Fog', 'Nausea']
        : flare.severity === 'moderate'
          ? ['Moderate Pain', 'Fatigue', 'Stiffness']
          : ['Mild Discomfort', 'Light Fatigue'],
      physiologicalData: generateMockWearableData(
        flare.severity === 'severe' ? 'flare-active' : 
        flare.severity === 'moderate' ? 'flare-warning' : 'healthy'
      ),
      environmentalData: generateMockEnvironmentalData(),
    });
  });
  
  // Add some wellness/good days
  const wellnessDays = [-1, -5, -8, -10, -18, -20, -28];
  wellnessDays.forEach(day => {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    
    entries.push({
      id: `demo-wellness-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: date,
      type: 'wellness',
      severity: 'none',
      energyLevel: 'good',
      note: 'Feeling well today',
      physiologicalData: generateMockWearableData('healthy'),
      environmentalData: generateMockEnvironmentalData(),
    });
  });
  
  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Generate mock EHR data
export interface MockEHRData {
  diagnoses: Array<{
    code: string;
    name: string;
    date: string;
    status: 'active' | 'resolved';
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    prescribedDate: string;
    prescriber: string;
  }>;
  allergies: Array<{
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;
  labResults: Array<{
    name: string;
    value: string;
    unit: string;
    date: string;
    status: 'normal' | 'high' | 'low';
  }>;
  vitals: Array<{
    type: string;
    value: string;
    unit: string;
    date: string;
  }>;
}

export function generateMockEHRData(): MockEHRData {
  return {
    diagnoses: [
      { code: 'M79.3', name: 'Fibromyalgia', date: '2023-04-15', status: 'active' },
      { code: 'G43.909', name: 'Migraine, unspecified', date: '2022-08-20', status: 'active' },
      { code: 'F41.1', name: 'Generalized Anxiety Disorder', date: '2022-01-10', status: 'active' },
    ],
    medications: [
      { name: 'Pregabalin', dosage: '75mg', frequency: 'Twice daily', prescribedDate: '2024-01-15', prescriber: 'Dr. Sarah Chen' },
      { name: 'Sumatriptan', dosage: '50mg', frequency: 'As needed', prescribedDate: '2023-08-20', prescriber: 'Dr. Sarah Chen' },
      { name: 'Duloxetine', dosage: '60mg', frequency: 'Once daily', prescribedDate: '2024-03-01', prescriber: 'Dr. James Miller' },
    ],
    allergies: [
      { allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate' },
      { allergen: 'Sulfa drugs', reaction: 'Hives', severity: 'severe' },
    ],
    labResults: [
      { name: 'CRP (C-Reactive Protein)', value: '3.2', unit: 'mg/L', date: '2024-12-01', status: 'high' },
      { name: 'ESR', value: '28', unit: 'mm/hr', date: '2024-12-01', status: 'high' },
      { name: 'Vitamin D', value: '22', unit: 'ng/mL', date: '2024-12-01', status: 'low' },
      { name: 'TSH', value: '2.1', unit: 'mIU/L', date: '2024-12-01', status: 'normal' },
      { name: 'Hemoglobin', value: '13.5', unit: 'g/dL', date: '2024-12-01', status: 'normal' },
    ],
    vitals: [
      { type: 'Blood Pressure', value: '118/76', unit: 'mmHg', date: '2024-12-15' },
      { type: 'Heart Rate', value: '72', unit: 'bpm', date: '2024-12-15' },
      { type: 'Temperature', value: '98.4', unit: '°F', date: '2024-12-15' },
      { type: 'Weight', value: '145', unit: 'lbs', date: '2024-12-15' },
      { type: 'Height', value: '5\'6"', unit: '', date: '2024-12-15' },
    ],
  };
}

// Demo patient profile
export const DEMO_PATIENT = {
  name: 'Sarah Johnson',
  age: 34,
  gender: 'Female',
  dateOfBirth: '1990-05-15',
  conditions: ['Fibromyalgia', 'Migraine'],
  primaryPhysician: {
    name: 'Dr. Sarah Chen',
    practice: 'Midwest Rheumatology Associates',
    phone: '(217) 555-0123',
    email: 'dr.chen@midwestrheum.com',
  },
  insuranceId: 'BC-123456789',
  emergencyContact: {
    name: 'Michael Johnson',
    relationship: 'Spouse',
    phone: '(217) 555-0456',
  },
};
