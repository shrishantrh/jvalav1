import { useState, useEffect } from 'react';

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  condition: string;
  windSpeed: number;
}

interface AirQualityData {
  pollen: number;
  pollutants: number;
  aqi: number;
}

export const useLocationWeatherData = () => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentSeason = (): 'spring' | 'summer' | 'fall' | 'winter' => {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  };

  const collectEnvironmentalData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;
      
      // For demo purposes, we'll simulate API calls since we don't have real API keys
      // In a real app, you'd integrate with services like OpenWeatherMap, etc.
      
      const locationData: LocationData = {
        latitude,
        longitude,
        address: "Sample Address",
        city: "Sample City",
        country: "Sample Country"
      };

      // Simulate weather data (normally from OpenWeatherMap API)
      const weatherData: WeatherData = {
        temperature: Math.round(15 + Math.random() * 20), // 15-35°C
        humidity: Math.round(30 + Math.random() * 50), // 30-80%
        pressure: Math.round(1000 + Math.random() * 50), // 1000-1050 hPa
        condition: ['sunny', 'cloudy', 'rainy', 'partly-cloudy'][Math.floor(Math.random() * 4)],
        windSpeed: Math.round(Math.random() * 20) // 0-20 km/h
      };

      // Simulate air quality data (normally from AirNow or similar API)
      const airQualityData: AirQualityData = {
        pollen: Math.round(Math.random() * 100), // 0-100 scale
        pollutants: Math.round(Math.random() * 150), // 0-150 AQI
        aqi: Math.round(50 + Math.random() * 100) // 50-150 AQI
      };

      setLocation(locationData);
      setWeather(weatherData);
      setAirQuality(airQualityData);
    } catch (err) {
      setError('Failed to collect environmental data');
      console.error('Environmental data collection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPhysiologicalData = () => {
    // Simulate physiological data (normally from health apps/devices)
    return {
      heartRate: Math.round(60 + Math.random() * 40), // 60-100 bpm
      heartRateVariability: Math.round(20 + Math.random() * 80), // 20-100 ms
      bloodPressure: {
        systolic: Math.round(110 + Math.random() * 30), // 110-140
        diastolic: Math.round(70 + Math.random() * 20)  // 70-90
      },
      sleepHours: Math.round((6 + Math.random() * 3) * 10) / 10, // 6-9 hours
      sleepQuality: (['poor', 'fair', 'good', 'excellent'] as const)[Math.floor(Math.random() * 4)],
      stressLevel: Math.round(1 + Math.random() * 9), // 1-10
      steps: Math.round(3000 + Math.random() * 12000) // 3000-15000 steps
    };
  };

  return {
    location,
    weather,
    airQuality,
    loading,
    error,
    collectEnvironmentalData,
    getPhysiologicalData,
    getCurrentSeason
  };
};