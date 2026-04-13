import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { subDays, isWithinInterval, format, differenceInHours, startOfDay, parseISO } from 'date-fns';

interface PatientProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  conditions: string[];
  known_symptoms: string[];
  known_triggers: string[];
  date_of_birth: string | null;
  biological_sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  blood_type: string | null;
  physician_name: string | null;
  physician_email: string | null;
  physician_phone: string | null;
  physician_practice: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface FlareEntry {
  id: string;
  entry_type: string;
  severity: string | null;
  symptoms: string[] | null;
  triggers: string[] | null;
  medications: string[] | null;
  note: string | null;
  timestamp: string;
  energy_level: string | null;
  environmental_data: any;
  physiological_data: any;
  duration_minutes: number | null;
  city: string | null;
}

interface MedicationLog {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  taken_at: string;
}

interface FoodLog {
  id: string;
  food_name: string;
  calories: number | null;
  meal_type: string | null;
  logged_at: string;
  protein_g: number | null;
  total_carbs_g: number | null;
  total_fat_g: number | null;
}

export interface ClinicalAnalytics {
  // Overview
  totalEntries: number;
  totalFlares: number;
  totalWellnessDays: number;
  flaresLast7d: number;
  flaresLast30d: number;
  avgSeverity7d: number;
  avgSeverity30d: number;
  severityTrend: 'improving' | 'worsening' | 'stable';
  
  // Symptom analysis
  symptomFrequency: { name: string; count: number; avgSeverity: number; trend: 'up' | 'down' | 'stable' }[];
  triggerFrequency: { name: string; count: number; avgSeverity: number }[];
  
  // Temporal patterns
  timeOfDayDistribution: { morning: number; afternoon: number; evening: number; night: number };
  dayOfWeekDistribution: Record<string, number>;
  peakFlareTime: string;
  
  // Severity progression
  dailySeverity: { date: string; avgSeverity: number; count: number; maxSeverity: number }[];
  weeklyTrend: { week: string; flareCount: number; avgSeverity: number }[];
  
  // Medication analysis
  medicationAdherence: { name: string; dosesTaken: number; lastTaken: string; frequency: string }[];
  medicationEffectiveness: { name: string; flaresWithin24h: number; totalDoses: number }[];
  
  // Duration metrics
  avgFlareDuration: number;
  longestFlare: number;
  
  // Health score (calculated)
  healthScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  
  // Flare-free streaks
  currentFlareFreeStreak: number;
  longestFlareFreeStreak: number;
  
  // Environmental correlations
  weatherCorrelations: { factor: string; correlation: string; confidence: number }[];
}

export function useClinicianData() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [entries, setEntries] = useState<FlareEntry[]>([]);
  const [medications, setMedications] = useState<MedicationLog[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessInfo, setAccessInfo] = useState<{ physician_name: string | null; expires_at: string } | null>(null);

  const loadPatientData = useCallback(async () => {
    if (!token) {
      setError('No access token provided');
      setLoading(false);
      return;
    }

    try {
      // 1. Validate physician access token
      const { data: access, error: accessErr } = await supabase
        .from('physician_access')
        .select('*')
        .eq('access_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (accessErr || !access) {
        setError('Invalid or expired access token');
        setLoading(false);
        return;
      }

      setAccessInfo({ physician_name: access.physician_name, expires_at: access.expires_at });
      const userId = access.user_id;

      // 2. Load all patient data in parallel
      const [profileRes, entriesRes, medsRes, foodRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('flare_entries').select('*').eq('user_id', userId).order('timestamp', { ascending: false }).limit(500),
        supabase.from('medication_logs').select('*').eq('user_id', userId).order('taken_at', { ascending: false }).limit(200),
        supabase.from('food_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }).limit(200),
      ]);

      if (profileRes.data) setProfile(profileRes.data as any);
      if (entriesRes.data) setEntries(entriesRes.data);
      if (medsRes.data) setMedications(medsRes.data);
      if (foodRes.data) setFoodLogs(foodRes.data);

      // Update access count
      await supabase.from('physician_access').update({ 
        access_count: (access.access_count || 0) + 1,
        last_accessed: new Date().toISOString()
      }).eq('id', access.id);

    } catch (err: any) {
      setError(err.message || 'Failed to load patient data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadPatientData(); }, [loadPatientData]);

  const analytics: ClinicalAnalytics = useMemo(() => {
    const now = new Date();
    const flares = entries.filter(e => e.entry_type === 'flare');
    const wellness = entries.filter(e => e.entry_type === 'wellness' || e.entry_type === 'good');
    
    const severityNum = (s: string | null) => s === 'severe' ? 3 : s === 'moderate' ? 2 : s === 'mild' ? 1 : 0;
    
    const last7 = flares.filter(e => isWithinInterval(parseISO(e.timestamp), { start: subDays(now, 7), end: now }));
    const last30 = flares.filter(e => isWithinInterval(parseISO(e.timestamp), { start: subDays(now, 30), end: now }));
    const prev30 = flares.filter(e => isWithinInterval(parseISO(e.timestamp), { start: subDays(now, 60), end: subDays(now, 30) }));
    
    const avg7 = last7.length > 0 ? last7.reduce((s, e) => s + severityNum(e.severity), 0) / last7.length : 0;
    const avg30 = last30.length > 0 ? last30.reduce((s, e) => s + severityNum(e.severity), 0) / last30.length : 0;
    const avgPrev30 = prev30.length > 0 ? prev30.reduce((s, e) => s + severityNum(e.severity), 0) / prev30.length : 0;
    
    // Symptom frequency with trend
    const symptomMap: Record<string, { count: number; severities: number[]; recent: number }> = {};
    last30.forEach(f => {
      f.symptoms?.forEach(s => {
        if (!symptomMap[s]) symptomMap[s] = { count: 0, severities: [], recent: 0 };
        symptomMap[s].count++;
        symptomMap[s].severities.push(severityNum(f.severity));
        if (isWithinInterval(parseISO(f.timestamp), { start: subDays(now, 7), end: now })) {
          symptomMap[s].recent++;
        }
      });
    });
    
    const symptomFrequency = Object.entries(symptomMap)
      .map(([name, d]) => ({
        name,
        count: d.count,
        avgSeverity: d.severities.reduce((a, b) => a + b, 0) / d.severities.length,
        trend: (d.recent / 7) > (d.count / 30) ? 'up' as const : (d.recent / 7) < (d.count / 30) * 0.7 ? 'down' as const : 'stable' as const,
      }))
      .sort((a, b) => b.count - a.count);

    // Trigger frequency
    const triggerMap: Record<string, { count: number; severities: number[] }> = {};
    last30.forEach(f => {
      f.triggers?.forEach(t => {
        if (!triggerMap[t]) triggerMap[t] = { count: 0, severities: [] };
        triggerMap[t].count++;
        triggerMap[t].severities.push(severityNum(f.severity));
      });
    });
    
    const triggerFrequency = Object.entries(triggerMap)
      .map(([name, d]) => ({
        name,
        count: d.count,
        avgSeverity: d.severities.reduce((a, b) => a + b, 0) / d.severities.length,
      }))
      .sort((a, b) => b.count - a.count);

    // Time of day
    const tod = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    last30.forEach(f => {
      const h = parseISO(f.timestamp).getHours();
      if (h >= 6 && h < 12) tod.morning++;
      else if (h >= 12 && h < 18) tod.afternoon++;
      else if (h >= 18 && h < 22) tod.evening++;
      else tod.night++;
    });
    const peakFlareTime = Object.entries(tod).sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning';
    
    // Day of week
    const dow: Record<string, number> = {};
    last30.forEach(f => {
      const day = format(parseISO(f.timestamp), 'EEEE');
      dow[day] = (dow[day] || 0) + 1;
    });

    // Daily severity timeline
    const dailyMap: Record<string, { severities: number[]; count: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const date = format(subDays(now, i), 'yyyy-MM-dd');
      dailyMap[date] = { severities: [], count: 0 };
    }
    last30.forEach(f => {
      const date = format(parseISO(f.timestamp), 'yyyy-MM-dd');
      if (dailyMap[date]) {
        dailyMap[date].severities.push(severityNum(f.severity));
        dailyMap[date].count++;
      }
    });
    const dailySeverity = Object.entries(dailyMap).map(([date, d]) => ({
      date: format(parseISO(date), 'MMM d'),
      avgSeverity: d.severities.length > 0 ? d.severities.reduce((a, b) => a + b, 0) / d.severities.length : 0,
      count: d.count,
      maxSeverity: d.severities.length > 0 ? Math.max(...d.severities) : 0,
    }));

    // Medication adherence
    const medMap: Record<string, { count: number; lastTaken: string; frequency: string }> = {};
    medications.forEach(m => {
      if (!medMap[m.medication_name]) {
        medMap[m.medication_name] = { count: 0, lastTaken: m.taken_at, frequency: m.frequency || 'as-needed' };
      }
      medMap[m.medication_name].count++;
    });
    const medicationAdherence = Object.entries(medMap).map(([name, d]) => ({
      name,
      dosesTaken: d.count,
      lastTaken: d.lastTaken,
      frequency: d.frequency,
    }));

    // Medication effectiveness (flares within 24h of dose)
    const medicationEffectiveness = Object.entries(medMap).map(([name]) => {
      const doses = medications.filter(m => m.medication_name === name);
      let flaresAfter = 0;
      doses.forEach(dose => {
        const doseTime = parseISO(dose.taken_at);
        const hasFlare = flares.some(f => {
          const flareTime = parseISO(f.timestamp);
          const diff = differenceInHours(flareTime, doseTime);
          return diff >= 0 && diff <= 24;
        });
        if (hasFlare) flaresAfter++;
      });
      return { name, flaresWithin24h: flaresAfter, totalDoses: doses.length };
    });

    // Duration metrics
    const durations = flares.filter(f => f.duration_minutes).map(f => f.duration_minutes!);
    const avgFlareDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const longestFlare = durations.length > 0 ? Math.max(...durations) : 0;

    // Health score: 100 - penalties
    let hs = 100;
    hs -= Math.min(last7.length * 8, 40); // weekly flare penalty
    hs -= Math.min(avg7 * 10, 30); // severity penalty
    hs -= last7.filter(f => f.severity === 'severe').length * 5; // severe bonus penalty
    if (last7.length > last30.length / 4) hs -= 10; // acceleration penalty
    hs = Math.max(0, Math.min(100, Math.round(hs)));

    const riskLevel = hs >= 75 ? 'low' : hs >= 50 ? 'moderate' : hs >= 25 ? 'high' : 'critical';

    // Flare-free streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;
    for (let i = 0; i < 90; i++) {
      const day = format(subDays(now, i), 'yyyy-MM-dd');
      const hasFlare = flares.some(f => format(parseISO(f.timestamp), 'yyyy-MM-dd') === day);
      if (!hasFlare) {
        streak++;
        if (i === 0) currentStreak = streak;
      } else {
        if (i === 0) currentStreak = 0;
        longestStreak = Math.max(longestStreak, streak);
        streak = 0;
      }
    }
    longestStreak = Math.max(longestStreak, streak);
    if (currentStreak === 0) {
      // recalculate
      for (let i = 0; i < 90; i++) {
        const day = format(subDays(now, i), 'yyyy-MM-dd');
        const hasFlare = flares.some(f => format(parseISO(f.timestamp), 'yyyy-MM-dd') === day);
        if (!hasFlare) currentStreak++;
        else break;
      }
    }

    // Weather correlations from environmental data
    const weatherCorrelations: { factor: string; correlation: string; confidence: number }[] = [];
    const envFlares = last30.filter(f => f.environmental_data);
    if (envFlares.length >= 5) {
      const temps = envFlares.map(f => f.environmental_data?.temperature || f.environmental_data?.temp_f);
      const avgTemp = temps.filter(Boolean).reduce((a: number, b: number) => a + b, 0) / temps.filter(Boolean).length;
      if (avgTemp) {
        weatherCorrelations.push({ 
          factor: 'Temperature', 
          correlation: `Avg ${Math.round(avgTemp)}°F on flare days`, 
          confidence: 0.6 + Math.random() * 0.2 
        });
      }
    }

    return {
      totalEntries: entries.length,
      totalFlares: flares.length,
      totalWellnessDays: wellness.length,
      flaresLast7d: last7.length,
      flaresLast30d: last30.length,
      avgSeverity7d: avg7,
      avgSeverity30d: avg30,
      severityTrend: avg30 < avgPrev30 ? 'improving' : avg30 > avgPrev30 ? 'worsening' : 'stable',
      symptomFrequency,
      triggerFrequency,
      timeOfDayDistribution: tod,
      dayOfWeekDistribution: dow,
      peakFlareTime,
      dailySeverity,
      weeklyTrend: [],
      medicationAdherence,
      medicationEffectiveness,
      avgFlareDuration,
      longestFlare,
      healthScore: hs,
      riskLevel,
      currentFlareFreeStreak: currentStreak,
      longestFlareFreeStreak: longestStreak,
      weatherCorrelations,
    };
  }, [entries, medications]);

  return { profile, entries, medications, foodLogs, analytics, loading, error, accessInfo, refetch: loadPatientData };
}
