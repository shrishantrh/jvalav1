import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

export interface BiometricSummary {
  hr: { avg: number | null; min: number | null; max: number | null; trend: number[] };
  hrv: { avg: number | null; trend: number[] };
  sleep: { avgHours: number | null; trend: number[] };
  steps: { avgDaily: number | null; trend: number[] };
  spo2: { avg: number | null };
  skinTemp: { avg: number | null };
  environment: {
    avgPressure: number | null;
    avgHumidity: number | null;
    avgAqi: number | null;
  };
  severityTrend: number[];
  flaresByDay: { date: string; count: number }[];
  topSymptoms: { name: string; count: number }[];
  topTriggers: { name: string; count: number }[];
}

function extractNum(obj: any, ...keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== null && v !== undefined && v !== '' && !isNaN(Number(v))) return Number(v);
  }
  return null;
}

export function usePatientBiometrics(patientId: string | undefined) {
  const [data, setData] = useState<BiometricSummary | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [foodLogs, setFoodLogs] = useState<any[]>([]);
  const [medLogs, setMedLogs] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [discoveries, setDiscoveries] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    const sb = supabase as any;
    const since = subDays(new Date(), 30).toISOString();

    const [eRes, fRes, mRes, aRes, dRes, pRes] = await Promise.all([
      sb.from('flare_entries').select('*').eq('user_id', patientId).gte('timestamp', since).order('timestamp', { ascending: true }),
      sb.from('food_logs').select('*').eq('user_id', patientId).gte('logged_at', since).order('logged_at', { ascending: true }),
      sb.from('medication_logs').select('*').eq('user_id', patientId).gte('taken_at', since).order('taken_at', { ascending: true }),
      sb.from('activity_logs').select('*').eq('user_id', patientId).gte('timestamp', since).order('timestamp', { ascending: true }),
      sb.from('discoveries').select('*').eq('user_id', patientId).order('confidence', { ascending: false }).limit(20),
      sb.from('prediction_logs').select('*').eq('user_id', patientId).gte('predicted_at', since).order('predicted_at', { ascending: true }),
    ]);

    const allEntries = eRes.data || [];
    setEntries(allEntries);
    setFoodLogs(fRes.data || []);
    setMedLogs(mRes.data || []);
    setActivityLogs(aRes.data || []);
    setDiscoveries(dRes.data || []);
    setPredictions(pRes.data || []);

    const flares = allEntries.filter((e: any) => e.entry_type === 'flare');
    
    // Extract physiological data
    const hrs: number[] = [];
    const hrvs: number[] = [];
    const sleeps: number[] = [];
    const stepss: number[] = [];
    const spo2s: number[] = [];
    const skinTemps: number[] = [];
    const pressures: number[] = [];
    const humidities: number[] = [];
    const aqis: number[] = [];

    allEntries.forEach((e: any) => {
      const p = e.physiological_data;
      const env = e.environmental_data;
      if (p) {
        const hr = extractNum(p, 'heartRate', 'heart_rate', 'hr');
        if (hr) hrs.push(hr);
        const hrv = extractNum(p, 'hrv', 'heartRateVariability');
        if (hrv) hrvs.push(hrv);
        const sl = extractNum(p, 'sleepHours', 'sleep_hours', 'sleep');
        if (sl) sleeps.push(sl);
        const st = extractNum(p, 'steps');
        if (st) stepss.push(st);
        const o2 = extractNum(p, 'spo2', 'oxygenSaturation');
        if (o2) spo2s.push(o2);
        const sk = extractNum(p, 'skinTemp', 'skin_temperature');
        if (sk) skinTemps.push(sk);
      }
      if (env) {
        const pr = extractNum(env, 'pressure', 'barometric_pressure');
        if (pr) pressures.push(pr);
        const hu = extractNum(env, 'humidity');
        if (hu) humidities.push(hu);
        const aq = extractNum(env, 'aqi', 'air_quality_index');
        if (aq) aqis.push(aq);
      }
    });

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const sevNum = (s: string | null) => s === 'severe' ? 3 : s === 'moderate' ? 2 : s === 'mild' ? 1 : 0;

    // Severity trend (daily)
    const sevByDay = new Map<string, number[]>();
    flares.forEach((f: any) => {
      const d = f.timestamp.slice(0, 10);
      if (!sevByDay.has(d)) sevByDay.set(d, []);
      sevByDay.get(d)!.push(sevNum(f.severity));
    });
    const severityTrend = Array.from(sevByDay.values()).map(arr => Math.max(...arr));

    // Flares by day
    const flareCountByDay = new Map<string, number>();
    flares.forEach((f: any) => {
      const d = f.timestamp.slice(0, 10);
      flareCountByDay.set(d, (flareCountByDay.get(d) || 0) + 1);
    });
    const flaresByDay = Array.from(flareCountByDay.entries()).map(([date, count]) => ({ date, count }));

    // Top symptoms/triggers
    const symCount = new Map<string, number>();
    const trigCount = new Map<string, number>();
    flares.forEach((f: any) => {
      (f.symptoms || []).forEach((s: string) => symCount.set(s, (symCount.get(s) || 0) + 1));
      (f.triggers || []).forEach((t: string) => trigCount.set(t, (trigCount.get(t) || 0) + 1));
    });
    const topSymptoms = Array.from(symCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
    const topTriggers = Array.from(trigCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

    setData({
      hr: { avg: avg(hrs), min: hrs.length ? Math.min(...hrs) : null, max: hrs.length ? Math.max(...hrs) : null, trend: hrs },
      hrv: { avg: avg(hrvs), trend: hrvs },
      sleep: { avgHours: avg(sleeps), trend: sleeps },
      steps: { avgDaily: avg(stepss), trend: stepss },
      spo2: { avg: avg(spo2s) },
      skinTemp: { avg: avg(skinTemps) },
      environment: { avgPressure: avg(pressures), avgHumidity: avg(humidities), avgAqi: avg(aqis) },
      severityTrend,
      flaresByDay,
      topSymptoms,
      topTriggers,
    });
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  return { data, entries, foodLogs, medLogs, activityLogs, discoveries, predictions, loading, refetch: load };
}
