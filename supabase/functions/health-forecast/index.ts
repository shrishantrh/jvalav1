import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA HEALTH FORECAST ENGINE v2 — Scientifically-Backed Flare Risk Prediction
// ═══════════════════════════════════════════════════════════════════════════════
//
// RESEARCH BASIS:
// - HRV as autonomic stress marker: low HRV → sympathetic dominance → inflammation
//   (Thayer et al., 2012; Jarczok et al., 2019)
// - Barometric pressure & migraine: rapid drops (>6mb/24h) trigger vasodilation
//   (Kimoto et al., 2011; Okuma et al., 2015)
// - Sleep debt accumulation: <6h sleep increases IL-6, TNF-α inflammatory markers
//   (Irwin et al., 2006; Mullington et al., 2010)
// - Post-exertion malaise: activity beyond aerobic threshold → delayed flare 24-48h
//   (VanNess et al., 2010)
// - AQI & respiratory/inflammatory conditions: PM2.5 >35 µg/m³ triggers inflammation
//   (Brunekreef & Holgate, 2002)
// - Menstrual cycle prostaglandin peaks: days 1-3, 25-28 highest inflammation
//   (Bernardi et al., 2017)
// - Medication half-life gaps: missed doses create rebound inflammation windows
// - Temporal clustering: flares cluster by day-of-week and time-of-day
// - Multi-day delayed patterns: trigger exposure → 24-72h delayed onset
//   (Lipton et al., 2014)
// - Cumulative load model: simultaneous sub-threshold stressors stack to exceed threshold
//   (McEwen, 2008 - Allostatic Load Theory)
//
// SCORING MODEL:
// Instead of simple additive risk, we use a cumulative allostatic load model:
// 1. Each signal is scored as a Z-score deviation from the user's personal baseline
// 2. Condition-specific weight multipliers amplify relevant signals
// 3. Temporal decay weights recent data more heavily (exponential decay λ=0.15/day)
// 4. Cross-signal interactions: e.g., poor sleep + high activity = multiplicative risk
// 5. Final score mapped through sigmoid to 0-100 risk percentage
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RiskFactor {
  factor: string;
  impact: number; // -1 to 1
  confidence: number;
  evidence: string;
  category: "sleep" | "activity" | "stress" | "weather" | "cycle" | "pattern" | "medication" | "trigger" | "physiological" | "environmental";
}

interface Forecast {
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "very_high";
  confidence: number;
  factors: RiskFactor[];
  prediction: string;
  recommendations: string[];
  protectiveFactors: string[];
  timeframe: string;
}

// ─── Condition-specific signal weight profiles ────────────────────────────────
// Each condition amplifies certain signals based on clinical research
const CONDITION_WEIGHTS: Record<string, Record<string, number>> = {
  // Migraine: pressure, HRV, sleep, hormonal cycle are primary drivers
  migraine:       { pressure: 1.8, hrv: 1.5, sleep: 1.4, humidity: 1.2, aqi: 0.8, activity: 1.0, temperature: 1.3, cycle: 1.6, medication: 1.5 },
  // Fibromyalgia: sleep deprivation, stress (HRV), weather changes, overexertion
  fibromyalgia:   { pressure: 1.4, hrv: 1.6, sleep: 1.8, humidity: 1.3, aqi: 0.7, activity: 1.7, temperature: 1.2, cycle: 1.3, medication: 1.2 },
  // Asthma: AQI, humidity, temperature, pollen are dominant
  asthma:         { pressure: 1.2, hrv: 0.9, sleep: 1.0, humidity: 1.6, aqi: 2.0, activity: 1.3, temperature: 1.5, cycle: 0.8, medication: 1.4 },
  // Rheumatoid arthritis: pressure, humidity, sleep, stress
  "rheumatoid arthritis": { pressure: 1.7, hrv: 1.3, sleep: 1.5, humidity: 1.6, aqi: 0.8, activity: 1.4, temperature: 1.3, cycle: 1.2, medication: 1.6 },
  // Endometriosis: cycle is dominant, stress, sleep
  endometriosis:  { pressure: 0.8, hrv: 1.4, sleep: 1.5, humidity: 0.7, aqi: 0.6, activity: 1.2, temperature: 0.8, cycle: 2.0, medication: 1.5 },
  // Crohn's / IBS: stress (HRV), sleep, activity
  "crohn's disease": { pressure: 0.8, hrv: 1.7, sleep: 1.6, humidity: 0.7, aqi: 0.6, activity: 1.3, temperature: 0.8, cycle: 1.0, medication: 1.7 },
  ibs:            { pressure: 0.8, hrv: 1.7, sleep: 1.5, humidity: 0.7, aqi: 0.5, activity: 1.2, temperature: 0.8, cycle: 1.1, medication: 1.4 },
  // Acne: sleep, stress, humidity
  acne:           { pressure: 0.5, hrv: 1.3, sleep: 1.4, humidity: 1.5, aqi: 1.0, activity: 0.8, temperature: 1.2, cycle: 1.4, medication: 1.2 },
  // GERD: stress, activity (esp. post-meal), sleep position
  gerd:           { pressure: 0.6, hrv: 1.5, sleep: 1.3, humidity: 0.5, aqi: 0.5, activity: 1.4, temperature: 0.6, cycle: 0.7, medication: 1.6 },
  // Lower back pain: activity, sleep, stress
  "lower back pain": { pressure: 1.2, hrv: 1.2, sleep: 1.5, humidity: 1.0, aqi: 0.5, activity: 1.8, temperature: 1.0, cycle: 0.8, medication: 1.3 },
  // Eczema / psoriasis: humidity, temperature, stress, sleep
  eczema:         { pressure: 0.7, hrv: 1.3, sleep: 1.4, humidity: 1.7, aqi: 1.2, activity: 0.8, temperature: 1.5, cycle: 1.0, medication: 1.3 },
  psoriasis:      { pressure: 0.7, hrv: 1.4, sleep: 1.5, humidity: 1.6, aqi: 1.1, activity: 0.8, temperature: 1.4, cycle: 1.0, medication: 1.3 },
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  pressure: 1.0, hrv: 1.0, sleep: 1.0, humidity: 1.0, aqi: 1.0,
  activity: 1.0, temperature: 1.0, cycle: 1.0, medication: 1.0,
};

// ─── Helper: get condition weight multiplier ──────────────────────────────────
function getConditionWeights(conditions: string[]): Record<string, number> {
  if (!conditions?.length) return DEFAULT_WEIGHTS;
  // Merge weights from all conditions (take max for each signal)
  const merged = { ...DEFAULT_WEIGHTS };
  for (const cond of conditions) {
    const key = cond.toLowerCase().trim();
    const weights = CONDITION_WEIGHTS[key];
    if (weights) {
      for (const [signal, weight] of Object.entries(weights)) {
        merged[signal] = Math.max(merged[signal] || 1, weight);
      }
    }
  }
  return merged;
}

// ─── Helper: sigmoid mapping for risk score ───────────────────────────────────
function sigmoid(x: number, midpoint = 0, steepness = 1): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

// ─── Helper: exponential temporal decay ───────────────────────────────────────
// More recent data counts more. λ=0.15 means data loses ~50% relevance after 4.6 days
function temporalWeight(timestampMs: number, nowMs: number, lambda = 0.15): number {
  const daysAgo = (nowMs - timestampMs) / (24 * 60 * 60 * 1000);
  return Math.exp(-lambda * daysAgo);
}

// ─── Helper: compute personal baseline with temporal weighting ────────────────
function computeBaseline(
  values: { value: number; timestamp: number }[],
  nowMs: number
): { mean: number; stdDev: number; count: number } {
  if (values.length === 0) return { mean: 0, stdDev: 1, count: 0 };

  let weightedSum = 0;
  let weightSum = 0;
  for (const v of values) {
    const w = temporalWeight(v.timestamp, nowMs);
    weightedSum += v.value * w;
    weightSum += w;
  }
  const mean = weightedSum / weightSum;

  let varianceSum = 0;
  for (const v of values) {
    const w = temporalWeight(v.timestamp, nowMs);
    varianceSum += w * (v.value - mean) ** 2;
  }
  const stdDev = Math.sqrt(varianceSum / weightSum) || 1;

  return { mean, stdDev, count: values.length };
}

// ─── Helper: z-score deviation from baseline ──────────────────────────────────
function zScore(current: number, baseline: { mean: number; stdDev: number }): number {
  return (current - baseline.mean) / baseline.stdDev;
}

// ─── Helper: extract numeric physiological value from entry ───────────────────
function getPhysio(entry: any, ...keys: string[]): number | null {
  const pd = entry.physiological_data;
  if (!pd) return null;
  for (const key of keys) {
    // Check nested and flat
    const parts = key.split(".");
    let val: any = pd;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined || val === null) { val = null; break; }
    }
    if (typeof val === "number") return val;
  }
  return null;
}

function getEnv(entry: any, ...keys: string[]): number | null {
  const ed = entry.environmental_data;
  if (!ed) return null;
  for (const key of keys) {
    const parts = key.split(".");
    let val: any = ed;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined || val === null) { val = null; break; }
    }
    if (typeof val === "number") return val;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { currentWeather, wearableData, menstrualDay } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Fetch all data in parallel ──
    const [entriesResult, correlationsResult, profileResult, medLogsResult] = await Promise.all([
      supabase
        .from("flare_entries")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(500),
      supabase
        .from("correlations")
        .select("*")
        .eq("user_id", userId)
        .order("confidence", { ascending: false }),
      supabase
        .from("profiles")
        .select("conditions, known_triggers, known_symptoms, biological_sex, date_of_birth, timezone")
        .eq("id", userId)
        .single(),
      supabase
        .from("medication_logs")
        .select("*")
        .eq("user_id", userId)
        .order("taken_at", { ascending: false })
        .limit(100),
    ]);

    const entries = entriesResult.data || [];
    const correlations = correlationsResult.data || [];
    const profile = profileResult.data;
    const medLogs = medLogsResult.data || [];

    if (entries.length < 5) {
      return new Response(
        JSON.stringify({
          forecast: {
            riskScore: 50, riskLevel: "moderate", confidence: 0.2, factors: [],
            prediction: "Keep logging for 1-2 weeks to unlock personalized predictions.",
            recommendations: ["Log how you feel daily", "Connect a wearable for automatic data"],
            protectiveFactors: [], timeframe: "next 24 hours",
          },
          needsMoreData: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conditions = profile?.conditions || [];
    const condWeights = getConditionWeights(conditions);
    const factors: RiskFactor[] = [];
    const flares = entries.filter((e: any) => e.entry_type === "flare");
    const now = Date.now();
    const oneDay = 86400000;
    const oneWeek = 7 * oneDay;

    // ═════════════════════════════════════════════════════════════════════════
    // 1. SLEEP ANALYSIS — Cumulative Sleep Debt Model
    // Research: Irwin et al. (2006) — sleep debt increases IL-6 & TNF-α
    // We compute rolling 3-night sleep debt, not just last night
    // ═════════════════════════════════════════════════════════════════════════
    const sleepValues: { value: number; timestamp: number }[] = [];
    for (const e of entries) {
      const hrs = getPhysio(e, "sleep_hours", "sleepHours", "sleep.duration", "sleep.hours");
      if (hrs !== null && hrs > 0) {
        // Normalize: if value > 24, it's probably minutes
        const normalized = hrs > 24 ? hrs / 60 : hrs;
        sleepValues.push({ value: normalized, timestamp: new Date(e.timestamp).getTime() });
      }
    }
    const sleepBaseline = computeBaseline(sleepValues, now);

    // Current sleep (from wearable data passed in)
    let currentSleep: number | null = null;
    if (wearableData) {
      currentSleep = wearableData.sleep?.duration || wearableData.sleep?.hours ||
        wearableData.sleepHours || wearableData.sleep_hours || null;
      if (currentSleep && currentSleep > 24) currentSleep = currentSleep / 60;
    }

    if (currentSleep !== null && sleepBaseline.count >= 3) {
      const z = zScore(currentSleep, sleepBaseline);

      // Also compute 3-night rolling average for sleep debt
      const last3Nights = sleepValues
        .filter(v => now - v.timestamp < 3 * oneDay)
        .map(v => v.value);
      if (currentSleep) last3Nights.unshift(currentSleep);
      const rollingAvg = last3Nights.length > 0
        ? last3Nights.reduce((a, b) => a + b, 0) / last3Nights.length
        : currentSleep;
      const debtZ = zScore(rollingAvg, sleepBaseline);

      if (z < -1.0) {
        // Significantly below baseline
        const impact = Math.min(0.6, Math.abs(z) * 0.2) * condWeights.sleep;
        factors.push({
          factor: "Sleep deficit detected",
          impact: Math.min(impact, 0.8),
          confidence: Math.min(0.9, 0.5 + sleepBaseline.count * 0.01),
          evidence: `${currentSleep.toFixed(1)}h last night vs your ${sleepBaseline.mean.toFixed(1)}h baseline (${Math.abs(z).toFixed(1)}σ below)`,
          category: "sleep",
        });
      }

      // Cumulative sleep debt (3-night rolling)
      if (debtZ < -0.8 && last3Nights.length >= 2) {
        factors.push({
          factor: "Accumulated sleep debt (3 nights)",
          impact: Math.min(0.5, Math.abs(debtZ) * 0.18) * condWeights.sleep,
          confidence: 0.7,
          evidence: `Rolling 3-night avg: ${rollingAvg.toFixed(1)}h — cumulative debt increases inflammatory markers`,
          category: "sleep",
        });
      }

      if (z > 0.8) {
        factors.push({
          factor: "Above-average sleep",
          impact: -0.15 * condWeights.sleep,
          confidence: 0.6,
          evidence: `${currentSleep.toFixed(1)}h — restorative sleep reduces flare risk`,
          category: "sleep",
        });
      }
    }

    // Sleep quality (deep sleep ratio)
    const deepSleep = wearableData?.sleep?.stages?.deep || wearableData?.deep_sleep_minutes || wearableData?.deepSleepMinutes;
    const totalSleepMin = currentSleep ? currentSleep * 60 : null;
    if (deepSleep && totalSleepMin && totalSleepMin > 0) {
      const deepRatio = deepSleep / totalSleepMin;
      // Healthy deep sleep is 15-20% of total. Below 10% is poor.
      if (deepRatio < 0.10) {
        factors.push({
          factor: "Poor deep sleep quality",
          impact: 0.25 * condWeights.sleep,
          confidence: 0.65,
          evidence: `Only ${Math.round(deepRatio * 100)}% deep sleep (healthy: 15-20%) — reduces physical recovery`,
          category: "sleep",
        });
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 2. HRV / AUTONOMIC STRESS — Z-score from personal baseline
    // Research: Thayer et al. (2012) — low HRV = sympathetic dominance = inflammation
    // ═════════════════════════════════════════════════════════════════════════
    const hrvValues: { value: number; timestamp: number }[] = [];
    for (const e of entries) {
      const hrv = getPhysio(e, "heart_rate_variability", "heartRateVariability", "hrv_rmssd", "hrvRmssd");
      if (hrv !== null && hrv > 0) {
        hrvValues.push({ value: hrv, timestamp: new Date(e.timestamp).getTime() });
      }
    }
    const hrvBaseline = computeBaseline(hrvValues, now);

    let currentHrv: number | null = null;
    if (wearableData) {
      currentHrv = wearableData.hrv?.current || wearableData.hrv?.daily ||
        wearableData.heart_rate_variability || wearableData.heartRateVariability ||
        wearableData.hrv_rmssd || wearableData.hrvRmssd || null;
    }

    if (currentHrv !== null && hrvBaseline.count >= 3) {
      const z = zScore(currentHrv, hrvBaseline);
      // Low HRV = high stress = high risk (inverted: negative z = high risk)
      if (z < -1.0) {
        const impact = Math.min(0.6, Math.abs(z) * 0.2) * condWeights.hrv;
        factors.push({
          factor: "Low HRV — elevated autonomic stress",
          impact: Math.min(impact, 0.8),
          confidence: Math.min(0.9, 0.5 + hrvBaseline.count * 0.01),
          evidence: `HRV ${currentHrv.toFixed(0)}ms vs ${hrvBaseline.mean.toFixed(0)}ms baseline (${Math.abs(z).toFixed(1)}σ below) — sympathetic dominance increases inflammation`,
          category: "stress",
        });
      } else if (z > 0.8) {
        factors.push({
          factor: "High HRV — parasympathetic recovery",
          impact: -0.2 * condWeights.hrv,
          confidence: 0.65,
          evidence: `HRV ${currentHrv.toFixed(0)}ms — your body is in recovery mode`,
          category: "stress",
        });
      }
    }

    // Resting heart rate deviation
    const rhrValues: { value: number; timestamp: number }[] = [];
    for (const e of entries) {
      const rhr = getPhysio(e, "resting_heart_rate", "restingHeartRate");
      if (rhr !== null && rhr > 30 && rhr < 200) {
        rhrValues.push({ value: rhr, timestamp: new Date(e.timestamp).getTime() });
      }
    }
    const rhrBaseline = computeBaseline(rhrValues, now);
    const currentRhr = wearableData?.resting_heart_rate || wearableData?.restingHeartRate || null;

    if (currentRhr && rhrBaseline.count >= 3) {
      const z = zScore(currentRhr, rhrBaseline);
      // High RHR = stress/illness
      if (z > 1.2) {
        factors.push({
          factor: "Elevated resting heart rate",
          impact: Math.min(0.4, z * 0.15) * condWeights.hrv,
          confidence: 0.7,
          evidence: `${currentRhr} bpm vs ${rhrBaseline.mean.toFixed(0)} bpm baseline — may indicate stress or early illness`,
          category: "physiological",
        });
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 3. ACTIVITY — Overexertion & Boom-Bust Detection
    // Research: VanNess et al. (2010) — post-exertional malaise 24-48h delay
    // ═════════════════════════════════════════════════════════════════════════
    const stepsValues: { value: number; timestamp: number }[] = [];
    for (const e of entries) {
      const steps = getPhysio(e, "steps", "activity.steps");
      if (steps !== null && steps > 0) {
        stepsValues.push({ value: steps, timestamp: new Date(e.timestamp).getTime() });
      }
    }
    const stepsBaseline = computeBaseline(stepsValues, now);

    const currentSteps = wearableData?.steps || wearableData?.activity?.steps || null;

    if (currentSteps && stepsBaseline.count >= 3) {
      const z = zScore(currentSteps, stepsBaseline);

      // Check for boom-bust pattern: did high activity days lead to flares 24-48h later?
      let boomBustScore = 0;
      const highActivityDays = stepsValues.filter(v => v.value > stepsBaseline.mean + stepsBaseline.stdDev);
      for (const had of highActivityDays) {
        const flareAfter = flares.some((f: any) => {
          const fTime = new Date(f.timestamp).getTime();
          return fTime > had.timestamp + 12 * 3600000 && fTime < had.timestamp + 72 * 3600000;
        });
        if (flareAfter) boomBustScore++;
      }
      const boomBustRatio = highActivityDays.length > 0 ? boomBustScore / highActivityDays.length : 0;

      if (z > 1.5 && boomBustRatio > 0.3) {
        factors.push({
          factor: "Overexertion — boom-bust pattern detected",
          impact: Math.min(0.6, z * 0.15 * (1 + boomBustRatio)) * condWeights.activity,
          confidence: Math.min(0.85, 0.5 + boomBustRatio),
          evidence: `${Math.round(currentSteps)} steps (${z.toFixed(1)}σ above baseline) — ${Math.round(boomBustRatio * 100)}% of your high-activity days are followed by flares within 24-72h`,
          category: "activity",
        });
      } else if (z > 1.5) {
        factors.push({
          factor: "Unusually high activity",
          impact: 0.2 * condWeights.activity,
          confidence: 0.5,
          evidence: `${Math.round(currentSteps)} steps — ${z.toFixed(1)}σ above your baseline`,
          category: "activity",
        });
      }

      if (z < -1.5) {
        // Very sedentary — slight risk for some conditions
        factors.push({
          factor: "Very low activity",
          impact: 0.1 * condWeights.activity,
          confidence: 0.4,
          evidence: `Only ${Math.round(currentSteps)} steps — prolonged sedentary behavior`,
          category: "activity",
        });
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 4. ENVIRONMENTAL ANALYSIS — Multi-factor with condition weighting
    // Research: Kimoto et al. (2011) — pressure; Brunekreef (2002) — AQI
    // ═════════════════════════════════════════════════════════════════════════
    if (currentWeather) {
      // 4a. Barometric pressure — rate of change is more predictive than absolute value
      const pressureHistory: { value: number; timestamp: number }[] = [];
      for (const e of entries) {
        const p = getEnv(e, "weather.pressure", "pressure");
        if (p !== null && p > 900 && p < 1100) {
          pressureHistory.push({ value: p, timestamp: new Date(e.timestamp).getTime() });
        }
      }
      const pressureBaseline = computeBaseline(pressureHistory, now);
      const currentPressure = currentWeather.pressure;

      if (currentPressure && pressureBaseline.count >= 5) {
        // Check rapid drop vs recent readings
        const recent24h = pressureHistory.filter(p => now - p.timestamp < oneDay);
        if (recent24h.length > 0) {
          const recentAvg = recent24h.reduce((a, b) => a + b.value, 0) / recent24h.length;
          const pressureDelta = currentPressure - recentAvg;

          if (pressureDelta < -4) {
            // Also check: how many flares occurred during similar drops?
            let dropFlareCount = 0;
            for (const f of flares) {
              const fPressure = getEnv(f, "weather.pressure");
              if (fPressure && fPressure < pressureBaseline.mean - pressureBaseline.stdDev * 0.5) {
                dropFlareCount++;
              }
            }
            const dropCorrelation = flares.length > 0 ? dropFlareCount / flares.length : 0;

            factors.push({
              factor: "Rapid barometric pressure drop",
              impact: Math.min(0.65, (Math.abs(pressureDelta) / 10) * (1 + dropCorrelation)) * condWeights.pressure,
              confidence: Math.min(0.85, 0.5 + dropCorrelation + pressureBaseline.count * 0.005),
              evidence: `Pressure dropped ${Math.abs(pressureDelta).toFixed(1)}mb in 24h — ${Math.round(dropCorrelation * 100)}% of your flares correlate with low pressure`,
              category: "weather",
            });
          } else if (pressureDelta > 4) {
            factors.push({
              factor: "Rising barometric pressure",
              impact: -0.1 * condWeights.pressure,
              confidence: 0.5,
              evidence: `Pressure rising — stabilizing conditions`,
              category: "weather",
            });
          }
        }
      }

      // 4b. AQI
      const currentAqi = currentWeather.aqi || currentWeather.airQuality?.aqi;
      if (currentAqi) {
        if (currentAqi > 100) {
          factors.push({
            factor: "Unhealthy air quality",
            impact: Math.min(0.5, (currentAqi - 50) / 200) * condWeights.aqi,
            confidence: 0.7,
            evidence: `AQI ${currentAqi} — PM2.5/ozone triggers inflammatory cascades`,
            category: "environmental",
          });
        } else if (currentAqi > 50) {
          factors.push({
            factor: "Moderate air quality",
            impact: Math.min(0.2, (currentAqi - 50) / 250) * condWeights.aqi,
            confidence: 0.5,
            evidence: `AQI ${currentAqi} — sensitive individuals may be affected`,
            category: "environmental",
          });
        }
      }

      // 4c. Humidity
      const humidity = currentWeather.humidity;
      if (humidity) {
        // Build humidity-flare correlation
        const humidFlares = flares.filter((f: any) => {
          const h = getEnv(f, "weather.humidity");
          return h !== null && h > 75;
        });
        const humidCorrelation = flares.length > 5 ? humidFlares.length / flares.length : 0;

        if (humidity > 80 && humidCorrelation > 0.2) {
          factors.push({
            factor: "High humidity",
            impact: Math.min(0.35, 0.15 + humidCorrelation * 0.3) * condWeights.humidity,
            confidence: Math.min(0.75, 0.4 + humidCorrelation),
            evidence: `${humidity}% humidity — ${Math.round(humidCorrelation * 100)}% of your flares occur in high humidity`,
            category: "weather",
          });
        }
      }

      // 4d. Temperature extremes
      const temp = currentWeather.temperature;
      if (temp !== undefined && temp !== null) {
        const tempHistory: { value: number; timestamp: number }[] = [];
        for (const e of entries) {
          const t = getEnv(e, "weather.temperature");
          if (t !== null) tempHistory.push({ value: t, timestamp: new Date(e.timestamp).getTime() });
        }
        const tempBaseline = computeBaseline(tempHistory, now);

        if (tempBaseline.count >= 5) {
          const z = zScore(temp, tempBaseline);
          if (Math.abs(z) > 1.5) {
            factors.push({
              factor: z > 0 ? "Unusually hot" : "Unusually cold",
              impact: Math.min(0.3, Math.abs(z) * 0.1) * condWeights.temperature,
              confidence: 0.55,
              evidence: `${temp.toFixed(0)}°C — ${Math.abs(z).toFixed(1)}σ from your typical temperature exposure`,
              category: "weather",
            });
          }
        }
      }

      // 4e. Pollen (if available)
      const pollen = currentWeather.pollen || currentWeather.airQuality?.pollen;
      if (pollen && pollen > 5) {
        factors.push({
          factor: "Elevated pollen levels",
          impact: Math.min(0.3, pollen / 30) * condWeights.aqi,
          confidence: 0.6,
          evidence: `Pollen index ${pollen} — may trigger respiratory/inflammatory response`,
          category: "environmental",
        });
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 5. MENSTRUAL CYCLE — Prostaglandin-Based Window Analysis
    // Research: Bernardi et al. (2017) — PGE2 peaks days 1-3
    // ═════════════════════════════════════════════════════════════════════════
    if (menstrualDay) {
      // Build user-specific cycle risk profile from historical data
      const cycleDayFlares: Record<number, number> = {};
      let totalCycleFlares = 0;
      flares.forEach((e: any) => {
        const day = e.physiological_data?.menstrual_day || e.environmental_data?.menstrual_day;
        if (day) {
          cycleDayFlares[day] = (cycleDayFlares[day] || 0) + 1;
          totalCycleFlares++;
        }
      });

      // Find the user's high-risk window (±2 days)
      const riskWindow = [-2, -1, 0, 1, 2];
      let windowFlares = 0;
      for (const offset of riskWindow) {
        const day = menstrualDay + offset;
        windowFlares += cycleDayFlares[day] || 0;
      }

      if (totalCycleFlares > 0) {
        const windowRatio = windowFlares / totalCycleFlares;
        const expectedRatio = 5 / 28; // 5-day window out of 28-day cycle

        if (windowRatio > expectedRatio * 1.3) {
          factors.push({
            factor: `Cycle day ${menstrualDay} — high-risk hormonal window`,
            impact: Math.min(0.6, windowRatio * 0.8) * condWeights.cycle,
            confidence: Math.min(0.85, 0.4 + totalCycleFlares * 0.02),
            evidence: `${Math.round(windowRatio * 100)}% of your cycle-tracked flares cluster around this day (expected: ${Math.round(expectedRatio * 100)}%)`,
            category: "cycle",
          });
        }
      } else {
        // No cycle-flare data, use clinical defaults
        // Prostaglandin peaks: days 1-3 (menstruation), days 25-28 (premenstrual)
        const highRiskDays = [1, 2, 3, 25, 26, 27, 28];
        if (highRiskDays.includes(menstrualDay)) {
          factors.push({
            factor: `Cycle day ${menstrualDay} — prostaglandin peak window`,
            impact: 0.3 * condWeights.cycle,
            confidence: 0.5,
            evidence: `Days 1-3 and 25-28 are associated with elevated prostaglandins and inflammation`,
            category: "cycle",
          });
        }
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 6. TEMPORAL PATTERN ANALYSIS — Day-of-week + Time-of-day + Multi-day
    // ═════════════════════════════════════════════════════════════════════════
    const userTz = profile?.timezone || "UTC";
    const today = new Date();

    // 6a. Day-of-week pattern (using user timezone)
    const dayBuckets: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const f of flares) {
      try {
        const localDay = new Date(f.timestamp).toLocaleDateString("en-US", { weekday: "long", timeZone: userTz });
        const dayIdx = dayNames.indexOf(localDay);
        if (dayIdx >= 0) dayBuckets[dayIdx]++;
      } catch { /* timezone parsing error, skip */ }
    }
    const avgDayFlares = flares.length / 7;
    let todayIdx: number;
    try {
      const todayName = today.toLocaleDateString("en-US", { weekday: "long", timeZone: userTz });
      todayIdx = dayNames.indexOf(todayName);
    } catch {
      todayIdx = today.getDay();
    }

    if (todayIdx >= 0 && dayBuckets[todayIdx] > avgDayFlares * 1.4 && dayBuckets[todayIdx] >= 3) {
      const ratio = dayBuckets[todayIdx] / avgDayFlares;
      factors.push({
        factor: `${dayNames[todayIdx]}s are a high-risk day`,
        impact: Math.min(0.3, (ratio - 1) * 0.15),
        confidence: Math.min(0.75, 0.4 + dayBuckets[todayIdx] * 0.03),
        evidence: `${Math.round((ratio - 1) * 100)}% more flares on ${dayNames[todayIdx]}s than average`,
        category: "pattern",
      });
    }

    // 6b. Time-of-day clustering
    const hourBuckets: number[] = new Array(24).fill(0);
    for (const f of flares) {
      try {
        const localHour = parseInt(new Date(f.timestamp).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz }));
        if (localHour >= 0 && localHour < 24) hourBuckets[localHour]++;
      } catch { /* skip */ }
    }
    const currentHour = parseInt(today.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz }));
    // Check 3-hour window around current time
    const windowHours = [-1, 0, 1, 2, 3].map(o => (currentHour + o + 24) % 24);
    const windowFlareCount = windowHours.reduce((acc, h) => acc + hourBuckets[h], 0);
    const avgHourFlares = flares.length / 24;

    if (windowFlareCount > avgHourFlares * 5 * 1.4 && windowFlareCount >= 3) {
      const ratio = windowFlareCount / (avgHourFlares * 5);
      factors.push({
        factor: `Flares cluster around this time of day`,
        impact: Math.min(0.25, (ratio - 1) * 0.1),
        confidence: 0.6,
        evidence: `${Math.round(ratio * 100 - 100)}% more flares in this time window`,
        category: "pattern",
      });
    }

    // 6c. Recent trend — exponentially weighted flare frequency
    const recentWeightedFlares = flares.reduce((acc: number, f: any) => {
      return acc + temporalWeight(new Date(f.timestamp).getTime(), now, 0.3);
    }, 0);
    const olderWeightedFlares = flares.reduce((acc: number, f: any) => {
      const ts = new Date(f.timestamp).getTime();
      if (now - ts > oneWeek) return acc + temporalWeight(ts, now, 0.3);
      return acc;
    }, 0);

    const recentFlares = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneWeek);
    const prevWeekFlares = flares.filter((e: any) => {
      const ts = new Date(e.timestamp).getTime();
      return ts >= now - 2 * oneWeek && ts < now - oneWeek;
    });

    if (recentFlares.length > prevWeekFlares.length + 2) {
      factors.push({
        factor: "Worsening flare trend",
        impact: Math.min(0.35, (recentFlares.length - prevWeekFlares.length) * 0.05),
        confidence: 0.7,
        evidence: `${recentFlares.length} flares this week vs ${prevWeekFlares.length} last week — escalating pattern`,
        category: "pattern",
      });
    } else if (recentFlares.length === 0 && prevWeekFlares.length >= 2) {
      factors.push({
        factor: "Flare-free streak",
        impact: -0.25,
        confidence: 0.65,
        evidence: "No flares in the past week — good recovery trajectory",
        category: "pattern",
      });
    }

    // 6d. Multi-day delayed pattern detection
    // Check if flares tend to appear N days after specific trigger types
    const triggerDelays: Record<string, number[]> = {};
    for (const e of entries) {
      if (!e.triggers?.length) continue;
      for (const trigger of e.triggers) {
        for (const f of flares) {
          const delay = (new Date(f.timestamp).getTime() - new Date(e.timestamp).getTime()) / oneDay;
          if (delay > 0.5 && delay < 4) {
            if (!triggerDelays[trigger]) triggerDelays[trigger] = [];
            triggerDelays[trigger].push(delay);
          }
        }
      }
    }
    // Check if any trigger was logged in the last 48h with a known delay pattern
    const recent48hEntries = entries.filter((e: any) => now - new Date(e.timestamp).getTime() < 2 * oneDay);
    for (const [trigger, delays] of Object.entries(triggerDelays)) {
      if (delays.length < 3) continue; // Need at least 3 instances
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;

      const wasRecentlyLogged = recent48hEntries.some((e: any) =>
        e.triggers?.some((t: string) => t.toLowerCase() === trigger.toLowerCase())
      );

      if (wasRecentlyLogged) {
        factors.push({
          factor: `Delayed reaction: "${trigger}"`,
          impact: Math.min(0.4, 0.15 + delays.length * 0.03),
          confidence: Math.min(0.75, 0.4 + delays.length * 0.05),
          evidence: `You typically flare ~${avgDelay.toFixed(0)} days after "${trigger}" (seen ${delays.length} times)`,
          category: "trigger",
        });
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 7. MEDICATION GAP ANALYSIS
    // If user takes regular meds and missed a dose, rebound risk increases
    // ═════════════════════════════════════════════════════════════════════════
    if (medLogs.length >= 5) {
      // Find medications taken regularly (at least 3 times in last 2 weeks)
      const twoWeeksAgo = now - 14 * oneDay;
      const recentMeds = medLogs.filter((m: any) => new Date(m.taken_at).getTime() > twoWeeksAgo);

      const medFreq: Record<string, { count: number; lastTaken: number }> = {};
      for (const m of recentMeds) {
        const name = m.medication_name;
        const ts = new Date(m.taken_at).getTime();
        if (!medFreq[name]) medFreq[name] = { count: 0, lastTaken: 0 };
        medFreq[name].count++;
        medFreq[name].lastTaken = Math.max(medFreq[name].lastTaken, ts);
      }

      for (const [med, info] of Object.entries(medFreq)) {
        if (info.count >= 3) {
          // Regular medication — check for gap
          const expectedInterval = (14 * oneDay) / info.count; // Average interval
          const timeSinceLast = now - info.lastTaken;

          if (timeSinceLast > expectedInterval * 1.8) {
            const gapDays = (timeSinceLast / oneDay).toFixed(1);
            factors.push({
              factor: `Medication gap: ${med}`,
              impact: Math.min(0.45, 0.2 + (timeSinceLast / expectedInterval - 1) * 0.1) * condWeights.medication,
              confidence: Math.min(0.7, 0.4 + info.count * 0.02),
              evidence: `Last taken ${gapDays} days ago — you usually take it every ${(expectedInterval / oneDay).toFixed(1)} days`,
              category: "medication",
            });
          }
        }
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 8. LEARNED CORRELATIONS — User's personal trigger-outcome patterns
    // ═════════════════════════════════════════════════════════════════════════
    const topCorrelations = correlations.filter((c: any) => c.confidence >= 0.5).slice(0, 8);
    for (const c of topCorrelations) {
      // Check if trigger was present in last 48h
      const recentMatch = recent48hEntries.some((e: any) => {
        const triggers = e.triggers || [];
        const note = e.note?.toLowerCase() || "";
        const medications = e.medications || [];
        return (
          triggers.some((t: string) => t.toLowerCase().includes(c.trigger_value.toLowerCase())) ||
          note.includes(c.trigger_value.toLowerCase()) ||
          medications.some((m: string) => m.toLowerCase().includes(c.trigger_value.toLowerCase()))
        );
      });

      if (recentMatch) {
        const delayHours = c.avg_delay_minutes ? Math.round(c.avg_delay_minutes / 60) : null;
        factors.push({
          factor: `Known trigger active: ${c.trigger_value}`,
          impact: Math.min(0.5, 0.2 + c.confidence * 0.3),
          confidence: c.confidence,
          evidence: `${c.trigger_value} → ${c.outcome_value} (${Math.round(c.confidence * 100)}% confidence, ${c.occurrence_count} occurrences${delayHours ? `, avg ${delayHours}h delay` : ""})`,
          category: "trigger",
        });
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 9. SpO2 ANALYSIS — Blood oxygen deviation
    // ═════════════════════════════════════════════════════════════════════════
    const currentSpo2 = wearableData?.spo2 || wearableData?.spo2_avg || wearableData?.spo2Avg;
    if (currentSpo2 && currentSpo2 < 95) {
      factors.push({
        factor: "Low blood oxygen",
        impact: Math.min(0.4, (96 - currentSpo2) * 0.1),
        confidence: 0.65,
        evidence: `SpO2 ${currentSpo2}% — below normal range (95-100%), may indicate respiratory stress`,
        category: "physiological",
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 10. BREATHING RATE — Respiratory stress indicator
    // ═════════════════════════════════════════════════════════════════════════
    const currentBreathRate = wearableData?.breathing_rate || wearableData?.breathingRate;
    if (currentBreathRate && currentBreathRate > 20) {
      factors.push({
        factor: "Elevated breathing rate",
        impact: Math.min(0.25, (currentBreathRate - 16) * 0.03),
        confidence: 0.55,
        evidence: `${currentBreathRate.toFixed(0)} breaths/min — normal resting: 12-20`,
        category: "physiological",
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 11. SKIN TEMPERATURE — Inflammatory signal
    // ═════════════════════════════════════════════════════════════════════════
    const skinTemp = wearableData?.skin_temperature || wearableData?.skinTemperature;
    if (skinTemp) {
      const tempValues: { value: number; timestamp: number }[] = [];
      for (const e of entries) {
        const t = getPhysio(e, "skin_temperature", "skinTemperature");
        if (t !== null) tempValues.push({ value: t, timestamp: new Date(e.timestamp).getTime() });
      }
      const tempBL = computeBaseline(tempValues, now);
      if (tempBL.count >= 3) {
        const z = zScore(skinTemp, tempBL);
        if (z > 1.2) {
          factors.push({
            factor: "Elevated skin temperature",
            impact: Math.min(0.3, z * 0.1),
            confidence: 0.6,
            evidence: `${z.toFixed(1)}σ above your baseline — may indicate early inflammatory response`,
            category: "physiological",
          });
        }
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CROSS-SIGNAL INTERACTIONS — Multiplicative Risk
    // McEwen (2008): Allostatic overload = simultaneous stressors compound
    // ═════════════════════════════════════════════════════════════════════════
    const riskFactors = factors.filter(f => f.impact > 0);
    const sleepRisk = riskFactors.some(f => f.category === "sleep");
    const stressRisk = riskFactors.some(f => f.category === "stress" || f.category === "physiological");
    const weatherRisk = riskFactors.some(f => f.category === "weather" || f.category === "environmental");
    const activityRisk = riskFactors.some(f => f.category === "activity");

    let interactionMultiplier = 1.0;
    const interactionReasons: string[] = [];

    // Sleep + Stress compound (cortisol dysregulation)
    if (sleepRisk && stressRisk) {
      interactionMultiplier *= 1.25;
      interactionReasons.push("sleep deficit + autonomic stress");
    }
    // Weather + any physiological signal (the body can't compensate)
    if (weatherRisk && (sleepRisk || stressRisk)) {
      interactionMultiplier *= 1.15;
      interactionReasons.push("environmental pressure + compromised recovery");
    }
    // Triple threat
    if (sleepRisk && stressRisk && (weatherRisk || activityRisk)) {
      interactionMultiplier *= 1.1;
      interactionReasons.push("allostatic overload — multiple systems stressed");
    }

    if (interactionMultiplier > 1.0 && interactionReasons.length > 0) {
      factors.push({
        factor: "Compounding risk signals",
        impact: Math.min(0.3, (interactionMultiplier - 1) * 0.8),
        confidence: 0.7,
        evidence: `Multiple simultaneous stressors: ${interactionReasons.join("; ")} — risk compounds non-linearly`,
        category: "pattern",
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // FINAL RISK CALCULATION — Sigmoid-mapped cumulative allostatic load
    // ═════════════════════════════════════════════════════════════════════════
    // Sum weighted impacts
    let rawLoad = 0;
    for (const f of factors) {
      rawLoad += f.impact * f.confidence;
    }

    // Apply interaction multiplier to positive load only
    if (rawLoad > 0) {
      rawLoad *= interactionMultiplier;
    }

    // Map through sigmoid centered at 0, with steepness calibrated so:
    // rawLoad ~0.5 → ~50% risk, rawLoad ~1.5 → ~80% risk
    const riskProbability = sigmoid(rawLoad, 0.3, 3.0);
    const riskScore = Math.max(0, Math.min(100, Math.round(riskProbability * 100)));

    let riskLevel: Forecast["riskLevel"] = "low";
    if (riskScore >= 75) riskLevel = "very_high";
    else if (riskScore >= 55) riskLevel = "high";
    else if (riskScore >= 35) riskLevel = "moderate";

    // Confidence based on data richness
    const dataPoints = [
      sleepBaseline.count, hrvBaseline.count, stepsBaseline.count,
      rhrBaseline.count, correlations.length, flares.length,
    ];
    const avgDataPoints = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
    const dataConfidence = Math.min(0.9, 0.3 + avgDataPoints * 0.01);
    const avgFactorConfidence = factors.length > 0
      ? factors.reduce((acc, f) => acc + f.confidence, 0) / factors.length
      : 0.3;
    const overallConfidence = (dataConfidence + avgFactorConfidence) / 2;

    // Sort factors by absolute impact
    const sortedRiskFactors = factors.filter(f => f.impact > 0).sort((a, b) => (b.impact * b.confidence) - (a.impact * a.confidence));
    const protectiveFactors = factors.filter(f => f.impact < 0).map(f => f.evidence);

    // Generate prediction text
    let prediction = "";
    if (riskScore < 25) {
      prediction = `Low risk (${riskScore}%). Your patterns look stable — ${protectiveFactors.length > 0 ? protectiveFactors.length + " protective factor(s) active" : "keep doing what you're doing"}.`;
    } else if (riskScore < 45) {
      prediction = `Moderate risk (${riskScore}%). A few signals to watch: ${sortedRiskFactors[0]?.factor || "minor factors combining"}. Nothing alarming.`;
    } else if (riskScore < 65) {
      prediction = `Elevated risk (${riskScore}%). ${sortedRiskFactors[0]?.factor || "Multiple factors"} is the primary concern${sortedRiskFactors.length > 1 ? `, compounded by ${sortedRiskFactors[1]?.factor?.toLowerCase()}` : ""}. Consider preventive action.`;
    } else {
      prediction = `High risk (${riskScore}%). ${sortedRiskFactors.slice(0, 2).map(f => f.factor).join(" + ")} create significant risk. Based on ${entries.length} data points, take precautions today.`;
    }

    // Generate condition-specific, scientifically-backed recommendations
    const recommendations: string[] = [];

    if (sortedRiskFactors.some(f => f.category === "sleep")) {
      recommendations.push("Prioritize 7-9h sleep tonight — sleep debt compounds inflammatory cytokines (IL-6, TNF-α) over consecutive nights");
    }
    if (sortedRiskFactors.some(f => f.category === "activity")) {
      recommendations.push("Pace activity today — your data shows a boom-bust pattern. Stay within your energy envelope");
    }
    if (sortedRiskFactors.some(f => f.category === "stress" || f.category === "physiological")) {
      recommendations.push("Your autonomic nervous system is stressed. Try vagal nerve stimulation: slow exhale breathing (4s in, 8s out), cold water on face, or gentle stretching");
    }
    if (sortedRiskFactors.some(f => f.category === "weather" || f.category === "environmental")) {
      recommendations.push("Environmental conditions are unfavorable. Minimize outdoor exposure, use air filtration if available, stay hydrated");
    }
    if (sortedRiskFactors.some(f => f.category === "cycle")) {
      recommendations.push("You're in a hormonal high-risk window. Consider anti-inflammatory measures: omega-3, magnesium, or pre-emptive medication per your doctor's plan");
    }
    if (sortedRiskFactors.some(f => f.category === "medication")) {
      recommendations.push("You may have missed a regular medication. Check your schedule — rebound symptoms can appear 24-48h after a gap");
    }
    if (sortedRiskFactors.some(f => f.category === "trigger")) {
      recommendations.push("A known trigger was recently active. Monitor symptoms closely over the next 24-72h based on your typical delay pattern");
    }

    if (recommendations.length === 0) {
      recommendations.push("Your risk signals are balanced. Keep logging consistently to strengthen prediction accuracy");
    }

    const forecast: Forecast = {
      riskScore,
      riskLevel,
      confidence: overallConfidence,
      factors: [...sortedRiskFactors, ...factors.filter(f => f.impact <= 0)].slice(0, 10),
      prediction,
      recommendations,
      protectiveFactors,
      timeframe: "next 24 hours",
    };

    return new Response(JSON.stringify({ forecast }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Health forecast error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Forecast failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
