import { useMemo } from 'react';
import { FlareEntry } from '@/types/flare';
import { subDays, isWithinInterval, differenceInHours, format } from 'date-fns';

interface EnvironmentalCorrelation {
  factor: string;
  category: 'weather' | 'air_quality' | 'sleep' | 'activity' | 'physiological' | 'time';
  description: string;
  strength: number; // -1 to 1, where positive = increases flares
  confidence: number; // 0-1 based on sample size
  threshold?: string;
  evidence: string;
  occurrences: number;
  avgSeverity: number;
}

interface PatternInsight {
  type: 'risk_factor' | 'protective' | 'timing' | 'compound' | 'trend';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  actionable?: string;
  dataPoints: number;
}

interface DeepAnalytics {
  correlations: EnvironmentalCorrelation[];
  insights: PatternInsight[];
  riskFactors: string[];
  protectiveFactors: string[];
  peakRiskConditions: string[];
  weeklyTrend: {
    thisWeek: number;
    lastWeek: number;
    change: number;
    changePercent: number;
  };
  severityByCondition: Record<string, { count: number; avgSeverity: number }>;
}

const getSeverityScore = (s: string | undefined) => s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;

export const useDeepAnalytics = (entries: FlareEntry[]): DeepAnalytics => {
  return useMemo(() => {
    const now = new Date();
    const flares = entries.filter(e => e.type === 'flare');
    
    const last7Days = flares.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 7), end: now })
    );
    const prev7Days = flares.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 14), end: subDays(now, 7) })
    );
    const last30Days = flares.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 30), end: now })
    );

    const correlations: EnvironmentalCorrelation[] = [];
    const insights: PatternInsight[] = [];
    const riskFactors: string[] = [];
    const protectiveFactors: string[] = [];
    const peakRiskConditions: string[] = [];

    // Helper to extract pressure - handles both pressureMb and pressure (inHg)
    const getPressureMb = (weather: any) => {
      if (weather?.pressureMb) return weather.pressureMb;
      if (weather?.pressure) {
        // If pressure is in inHg (typically 29-31), convert to mb
        if (weather.pressure < 100) return Math.round(weather.pressure * 33.8639);
        return weather.pressure;
      }
      return null;
    };

    // Helper to extract temperature in Celsius
    const getTempC = (weather: any) => {
      if (weather?.temperatureC !== undefined) return weather.temperatureC;
      if (weather?.temperature !== undefined) {
        // If temperature is likely Fahrenheit (> 45), convert to Celsius
        if (weather.temperature > 45) return Math.round((weather.temperature - 32) * 5 / 9);
        return weather.temperature;
      }
      return null;
    };

    // ========== WEATHER CORRELATIONS ==========
    const pressureData = last30Days.filter(f => getPressureMb(f.environmentalData?.weather) !== null);
    if (pressureData.length >= 5) {
      const pressures = pressureData.map(f => ({
        pressure: getPressureMb(f.environmentalData!.weather!) as number,
        severity: getSeverityScore(f.severity)
      }));
      
      const avgPressure = pressures.reduce((a, b) => a + b.pressure, 0) / pressures.length;
      const lowPressureFlares = pressures.filter(p => p.pressure < 1010);
      const highPressureFlares = pressures.filter(p => p.pressure >= 1010);
      
      if (lowPressureFlares.length >= 3 && highPressureFlares.length >= 3) {
        const lowPressureAvgSeverity = lowPressureFlares.reduce((a, b) => a + b.severity, 0) / lowPressureFlares.length;
        const highPressureAvgSeverity = highPressureFlares.reduce((a, b) => a + b.severity, 0) / highPressureFlares.length;
        const difference = lowPressureAvgSeverity - highPressureAvgSeverity;
        
        if (Math.abs(difference) > 0.3) {
          correlations.push({
            factor: 'Barometric Pressure',
            category: 'weather',
            description: difference > 0 
              ? `Low pressure (<1010mb) correlates with ${Math.round(difference * 33)}% more severe flares`
              : `High pressure (>1010mb) correlates with more severe flares`,
            strength: difference / 2,
            confidence: Math.min(pressureData.length / 15, 1),
            threshold: difference > 0 ? '<1010mb' : '>1010mb',
            evidence: `Avg severity ${lowPressureAvgSeverity.toFixed(1)} vs ${highPressureAvgSeverity.toFixed(1)}`,
            occurrences: lowPressureFlares.length,
            avgSeverity: lowPressureAvgSeverity
          });
          
          if (difference > 0.5) {
            riskFactors.push(`Low barometric pressure (<1010mb)`);
            peakRiskConditions.push('pressure drop');
          }
        }
      }
    }

    // Humidity correlation
    const humidityData = last30Days.filter(f => f.environmentalData?.weather?.humidity);
    if (humidityData.length >= 5) {
      const humidities = humidityData.map(f => ({
        humidity: f.environmentalData!.weather!.humidity as number,
        severity: getSeverityScore(f.severity)
      }));
      
      const highHumidityFlares = humidities.filter(h => h.humidity > 75);
      const normalHumidityFlares = humidities.filter(h => h.humidity <= 75);
      
      if (highHumidityFlares.length >= 3 && normalHumidityFlares.length >= 3) {
        const highHumidityAvgSeverity = highHumidityFlares.reduce((a, b) => a + b.severity, 0) / highHumidityFlares.length;
        const normalHumidityAvgSeverity = normalHumidityFlares.reduce((a, b) => a + b.severity, 0) / normalHumidityFlares.length;
        const difference = highHumidityAvgSeverity - normalHumidityAvgSeverity;
        
        if (Math.abs(difference) > 0.3) {
          correlations.push({
            factor: 'High Humidity',
            category: 'weather',
            description: `Humidity >75% correlates with ${Math.round(Math.abs(difference) * 33)}% ${difference > 0 ? 'more' : 'less'} severe flares`,
            strength: difference / 2,
            confidence: Math.min(humidityData.length / 15, 1),
            threshold: '>75%',
            evidence: `${highHumidityFlares.length} flares at high humidity`,
            occurrences: highHumidityFlares.length,
            avgSeverity: highHumidityAvgSeverity
          });
          
          if (difference > 0.4) {
            riskFactors.push(`High humidity (>75%)`);
          }
        }
      }
    }

    // Temperature correlation
    const tempData = last30Days.filter(f => getTempC(f.environmentalData?.weather) !== null);
    if (tempData.length >= 5) {
      const temps = tempData.map(f => ({
        temp: getTempC(f.environmentalData!.weather!) as number,
        severity: getSeverityScore(f.severity)
      }));
      
      const coldFlares = temps.filter(t => t.temp < 5);
      const normalFlares = temps.filter(t => t.temp >= 5 && t.temp <= 25);
      const hotFlares = temps.filter(t => t.temp > 25);
      
      if (coldFlares.length >= 3) {
        const coldAvgSeverity = coldFlares.reduce((a, b) => a + b.severity, 0) / coldFlares.length;
        const normalAvgSeverity = normalFlares.length > 0 ? normalFlares.reduce((a, b) => a + b.severity, 0) / normalFlares.length : 2;
        const difference = coldAvgSeverity - normalAvgSeverity;
        
        if (difference > 0.3) {
          correlations.push({
            factor: 'Cold Temperature',
            category: 'weather',
            description: `Cold weather (<5°C) correlates with ${Math.round(difference * 33)}% more severe flares`,
            strength: difference / 2,
            confidence: Math.min(coldFlares.length / 10, 1),
            threshold: '<5°C / 41°F',
            evidence: `${coldFlares.length} cold-weather flares, avg severity ${coldAvgSeverity.toFixed(1)}`,
            occurrences: coldFlares.length,
            avgSeverity: coldAvgSeverity
          });
          riskFactors.push('Cold weather (<5°C)');
        }
      }
    }

    // ========== AIR QUALITY CORRELATIONS ==========
    const aqiData = last30Days.filter(f => f.environmentalData?.airQuality?.aqi);
    if (aqiData.length >= 5) {
      const aqis = aqiData.map(f => ({
        aqi: f.environmentalData!.airQuality!.aqi as number,
        severity: getSeverityScore(f.severity)
      }));
      
      const poorAirFlares = aqis.filter(a => a.aqi > 100);
      const goodAirFlares = aqis.filter(a => a.aqi <= 50);
      
      if (poorAirFlares.length >= 2) {
        const poorAirAvgSeverity = poorAirFlares.reduce((a, b) => a + b.severity, 0) / poorAirFlares.length;
        correlations.push({
          factor: 'Poor Air Quality',
          category: 'air_quality',
          description: `AQI >100 correlates with flares (${poorAirFlares.length} occurrences)`,
          strength: 0.6,
          confidence: Math.min(poorAirFlares.length / 8, 1),
          threshold: 'AQI >100',
          evidence: `Avg severity ${poorAirAvgSeverity.toFixed(1)} during poor air quality`,
          occurrences: poorAirFlares.length,
          avgSeverity: poorAirAvgSeverity
        });
        riskFactors.push('Poor air quality (AQI >100)');
      }
    }

    // ========== SLEEP CORRELATIONS ==========
    const sleepData = last30Days.filter(f => 
      f.physiologicalData?.sleepHours || f.physiologicalData?.sleep_hours
    );
    if (sleepData.length >= 5) {
      const sleeps = sleepData.map(f => ({
        hours: (f.physiologicalData?.sleepHours || f.physiologicalData?.sleep_hours) as number,
        severity: getSeverityScore(f.severity)
      }));
      
      const avgSleep = sleeps.reduce((a, b) => a + b.hours, 0) / sleeps.length;
      const poorSleepFlares = sleeps.filter(s => s.hours < 6);
      const goodSleepFlares = sleeps.filter(s => s.hours >= 7);
      
      if (poorSleepFlares.length >= 2 && goodSleepFlares.length >= 2) {
        const poorSleepAvgSeverity = poorSleepFlares.reduce((a, b) => a + b.severity, 0) / poorSleepFlares.length;
        const goodSleepAvgSeverity = goodSleepFlares.reduce((a, b) => a + b.severity, 0) / goodSleepFlares.length;
        const difference = poorSleepAvgSeverity - goodSleepAvgSeverity;
        
        if (difference > 0.2) {
          correlations.push({
            factor: 'Sleep Deficit',
            category: 'sleep',
            description: `<6 hours sleep → ${Math.round(difference * 33)}% more severe flares`,
            strength: difference / 2,
            confidence: Math.min(poorSleepFlares.length / 8, 1),
            threshold: '<6 hours',
            evidence: `${poorSleepFlares.length} flares after poor sleep vs ${goodSleepFlares.length} after good sleep`,
            occurrences: poorSleepFlares.length,
            avgSeverity: poorSleepAvgSeverity
          });
          riskFactors.push('Sleep less than 6 hours');
          peakRiskConditions.push('poor sleep');
        }
        
        if (difference < -0.2) {
          protectiveFactors.push(`Good sleep (>7 hours): ${Math.round(Math.abs(difference) * 33)}% less severe flares`);
        }
      }
      
      // Add insight about average sleep during flares
      if (avgSleep < 6.5) {
        insights.push({
          type: 'risk_factor',
          title: 'Sleep pattern detected',
          description: `Your average sleep during flares is ${avgSleep.toFixed(1)} hours. Studies show chronic conditions worsen with <7 hours sleep.`,
          confidence: sleepData.length >= 10 ? 'high' : 'medium',
          actionable: 'Aim for 7-8 hours sleep, especially when other risk factors are present',
          dataPoints: sleepData.length
        });
      }
    }

    // ========== HRV CORRELATIONS ==========
    const hrvData = last30Days.filter(f => 
      f.physiologicalData?.heartRateVariability || f.physiologicalData?.heart_rate_variability
    );
    if (hrvData.length >= 5) {
      const hrvs = hrvData.map(f => ({
        hrv: (f.physiologicalData?.heartRateVariability || f.physiologicalData?.heart_rate_variability) as number,
        severity: getSeverityScore(f.severity)
      }));
      
      const avgHrv = hrvs.reduce((a, b) => a + b.hrv, 0) / hrvs.length;
      const lowHrvFlares = hrvs.filter(h => h.hrv < avgHrv * 0.8);
      const normalHrvFlares = hrvs.filter(h => h.hrv >= avgHrv * 0.8);
      
      if (lowHrvFlares.length >= 2 && normalHrvFlares.length >= 2) {
        const lowHrvAvgSeverity = lowHrvFlares.reduce((a, b) => a + b.severity, 0) / lowHrvFlares.length;
        const normalHrvAvgSeverity = normalHrvFlares.reduce((a, b) => a + b.severity, 0) / normalHrvFlares.length;
        const difference = lowHrvAvgSeverity - normalHrvAvgSeverity;
        
        if (difference > 0.3) {
          correlations.push({
            factor: 'Low HRV (Stress)',
            category: 'physiological',
            description: `Low HRV (below your avg of ${avgHrv.toFixed(0)}ms) → more severe flares`,
            strength: difference / 2,
            confidence: Math.min(lowHrvFlares.length / 8, 1),
            threshold: `<${Math.round(avgHrv * 0.8)}ms`,
            evidence: `${lowHrvFlares.length} flares during high-stress periods`,
            occurrences: lowHrvFlares.length,
            avgSeverity: lowHrvAvgSeverity
          });
          riskFactors.push('Low HRV / high stress');
          peakRiskConditions.push('stress');
        }
      }
    }

    // ========== ACTIVITY CORRELATIONS ==========
    const activityData = last30Days.filter(f => 
      f.physiologicalData?.steps !== undefined
    );
    if (activityData.length >= 5) {
      const activities = activityData.map(f => ({
        steps: f.physiologicalData!.steps as number,
        severity: getSeverityScore(f.severity)
      }));
      
      const avgSteps = activities.reduce((a, b) => a + b.steps, 0) / activities.length;
      const sedentaryFlares = activities.filter(a => a.steps < 3000);
      const activeFlares = activities.filter(a => a.steps >= 5000);
      
      if (sedentaryFlares.length >= 2 && activeFlares.length >= 2) {
        const sedentaryAvgSeverity = sedentaryFlares.reduce((a, b) => a + b.severity, 0) / sedentaryFlares.length;
        const activeAvgSeverity = activeFlares.reduce((a, b) => a + b.severity, 0) / activeFlares.length;
        const difference = sedentaryAvgSeverity - activeAvgSeverity;
        
        if (difference > 0.3) {
          correlations.push({
            factor: 'Low Activity',
            category: 'activity',
            description: `Days with <3K steps have ${Math.round(difference * 33)}% more severe flares`,
            strength: difference / 2,
            confidence: Math.min(sedentaryFlares.length / 8, 1),
            threshold: '<3,000 steps',
            evidence: `${sedentaryFlares.length} sedentary-day flares`,
            occurrences: sedentaryFlares.length,
            avgSeverity: sedentaryAvgSeverity
          });
        }
        
        if (difference > 0.4) {
          protectiveFactors.push(`Moderate activity (5K+ steps): ${Math.round(difference * 33)}% less severe flares`);
        }
      }
    }

    // ========== TIME PATTERNS ==========
    const timeSlots: Record<string, { count: number; severities: number[] }> = {
      'morning (6-12)': { count: 0, severities: [] },
      'afternoon (12-18)': { count: 0, severities: [] },
      'evening (18-22)': { count: 0, severities: [] },
      'night (22-6)': { count: 0, severities: [] }
    };
    
    last30Days.forEach(f => {
      const hour = f.timestamp.getHours();
      let slot: string;
      if (hour >= 6 && hour < 12) slot = 'morning (6-12)';
      else if (hour >= 12 && hour < 18) slot = 'afternoon (12-18)';
      else if (hour >= 18 && hour < 22) slot = 'evening (18-22)';
      else slot = 'night (22-6)';
      
      timeSlots[slot].count++;
      timeSlots[slot].severities.push(getSeverityScore(f.severity));
    });
    
    const sortedTimeSlots = Object.entries(timeSlots)
      .filter(([_, data]) => data.count > 0)
      .map(([time, data]) => ({
        time,
        count: data.count,
        avgSeverity: data.severities.reduce((a, b) => a + b, 0) / data.severities.length,
        percentage: Math.round((data.count / last30Days.length) * 100)
      }))
      .sort((a, b) => b.count - a.count);
    
    if (sortedTimeSlots.length > 0 && sortedTimeSlots[0].percentage > 35) {
      correlations.push({
        factor: `Peak Time: ${sortedTimeSlots[0].time}`,
        category: 'time',
        description: `${sortedTimeSlots[0].percentage}% of flares occur during ${sortedTimeSlots[0].time}`,
        strength: (sortedTimeSlots[0].percentage - 25) / 50,
        confidence: Math.min(last30Days.length / 15, 1),
        threshold: sortedTimeSlots[0].time,
        evidence: `${sortedTimeSlots[0].count} of ${last30Days.length} flares`,
        occurrences: sortedTimeSlots[0].count,
        avgSeverity: sortedTimeSlots[0].avgSeverity
      });
    }

    // Day of week pattern
    const daySlots: Record<number, { count: number; severities: number[] }> = {};
    for (let i = 0; i < 7; i++) daySlots[i] = { count: 0, severities: [] };
    
    last30Days.forEach(f => {
      const day = f.timestamp.getDay();
      daySlots[day].count++;
      daySlots[day].severities.push(getSeverityScore(f.severity));
    });
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sortedDays = Object.entries(daySlots)
      .filter(([_, data]) => data.count > 0)
      .map(([day, data]) => ({
        day: dayNames[parseInt(day)],
        count: data.count,
        avgSeverity: data.severities.reduce((a, b) => a + b, 0) / data.severities.length
      }))
      .sort((a, b) => b.count - a.count);
    
    if (sortedDays.length >= 2 && sortedDays[0].count >= 3) {
      const topDayPct = Math.round((sortedDays[0].count / last30Days.length) * 100);
      if (topDayPct > 20) {
        insights.push({
          type: 'timing',
          title: `${sortedDays[0].day}s are your worst day`,
          description: `${topDayPct}% of flares (${sortedDays[0].count}) occur on ${sortedDays[0].day}s. Average severity: ${sortedDays[0].avgSeverity.toFixed(1)}/3.`,
          confidence: sortedDays[0].count >= 5 ? 'high' : 'medium',
          actionable: `Plan lighter activities on ${sortedDays[0].day}s or investigate what's different about that day`,
          dataPoints: sortedDays[0].count
        });
      }
    }

    // ========== COMPOUND RISK FACTORS ==========
    // Check for combined risk (e.g., poor sleep + low pressure)
    const compoundRiskFlares = last30Days.filter(f => {
      const poorSleep = (f.physiologicalData?.sleepHours || f.physiologicalData?.sleep_hours || 8) < 6;
      const lowPressure = (getPressureMb(f.environmentalData?.weather) || 1013) < 1010;
      return poorSleep && lowPressure;
    });
    
    if (compoundRiskFlares.length >= 2) {
      const compoundAvgSeverity = compoundRiskFlares.reduce((a, b) => a + getSeverityScore(b.severity), 0) / compoundRiskFlares.length;
      if (compoundAvgSeverity > 2) {
        insights.push({
          type: 'compound',
          title: 'Compound risk detected',
          description: `When poor sleep (<6h) + low pressure occur together, your avg severity is ${compoundAvgSeverity.toFixed(1)}/3 (${compoundRiskFlares.length} occurrences).`,
          confidence: compoundRiskFlares.length >= 4 ? 'high' : 'medium',
          actionable: 'Monitor both factors together - the combination is worse than either alone',
          dataPoints: compoundRiskFlares.length
        });
        peakRiskConditions.push('poor sleep + low pressure');
      }
    }

    // ========== TREND ANALYSIS ==========
    const weeklyTrend = {
      thisWeek: last7Days.length,
      lastWeek: prev7Days.length,
      change: last7Days.length - prev7Days.length,
      changePercent: prev7Days.length > 0 ? Math.round(((last7Days.length - prev7Days.length) / prev7Days.length) * 100) : 0
    };
    
    if (weeklyTrend.change > 2) {
      insights.push({
        type: 'trend',
        title: 'Flare frequency increasing',
        description: `${weeklyTrend.thisWeek} flares this week vs ${weeklyTrend.lastWeek} last week (+${weeklyTrend.change}). This is a ${weeklyTrend.changePercent}% increase.`,
        confidence: 'high',
        actionable: 'Review your recent triggers and environmental conditions for changes',
        dataPoints: weeklyTrend.thisWeek + weeklyTrend.lastWeek
      });
    } else if (weeklyTrend.change < -2) {
      insights.push({
        type: 'trend',
        title: 'Flares decreasing',
        description: `${weeklyTrend.thisWeek} flares this week vs ${weeklyTrend.lastWeek} last week (${weeklyTrend.change}). Great progress!`,
        confidence: 'high',
        actionable: 'Keep doing what you\'re doing - identify what changed',
        dataPoints: weeklyTrend.thisWeek + weeklyTrend.lastWeek
      });
    }

    // ========== SEVERITY BY CONDITION ==========
    const severityByCondition: Record<string, { count: number; avgSeverity: number }> = {};
    last30Days.forEach(f => {
      const condition = f.environmentalData?.weather?.condition || 'Unknown';
      if (!severityByCondition[condition]) {
        severityByCondition[condition] = { count: 0, avgSeverity: 0 };
      }
      severityByCondition[condition].count++;
      severityByCondition[condition].avgSeverity = 
        (severityByCondition[condition].avgSeverity * (severityByCondition[condition].count - 1) + getSeverityScore(f.severity)) / 
        severityByCondition[condition].count;
    });

    // Sort correlations by strength
    correlations.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength));

    return {
      correlations: correlations.slice(0, 8),
      insights,
      riskFactors,
      protectiveFactors,
      peakRiskConditions,
      weeklyTrend,
      severityByCondition
    };
  }, [entries]);
};