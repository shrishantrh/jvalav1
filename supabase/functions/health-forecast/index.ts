import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA HEALTH FORECAST ENGINE v4 — Bayesian-EWMA + Verification Loop
// ═══════════════════════════════════════════════════════════════════════════════
//
// v4 ADDITIONS:
// - Prediction logging for Brier score calibration
// - Historical accuracy tracking (rolling 30-day Brier)
// - Auth fix: getUser() instead of getClaims()
// - Retroactive verification: auto-check if flares happened after past predictions
// - Interaction-aware severity forecasting (not just binary flare/no-flare)
//
// CORE MODEL (unchanged from v3):
// 1. EWMA baselines (α=0.15) for adaptive personal norms
// 2. Bayesian risk updating via likelihood ratios
// 3. Slope-based trend detection
// 4. Cross-signal interaction matrix
// 5. Condition-specific LR multipliers
// 6. Multi-day lag detection
// 7. Confidence calibration
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RiskFactor {
  factor: string;
  impact: number;
  confidence: number;
  evidence: string;
  category: "sleep" | "activity" | "stress" | "weather" | "cycle" | "pattern" | "medication" | "trigger" | "physiological" | "environmental";
  likelihoodRatio?: number;
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
  modelVersion: string;
  // v4: accuracy tracking
  accuracy?: {
    brierScore: number | null;
    totalPredictions: number;
    correctPredictions: number;
    calibrationNote: string;
  };
  // v4: unverified prediction to check
  pendingVerification?: {
    id: string;
    predictedAt: string;
    riskScore: number;
    riskLevel: string;
  };
}

// ─── EWMA Engine ──────────────────────────────────────────────────────────────
class EWMABaseline {
  mean: number;
  variance: number;
  count: number;
  alpha: number;
  
  constructor(alpha = 0.15) {
    this.mean = 0;
    this.variance = 0;
    this.count = 0;
    this.alpha = alpha;
  }

  feedSorted(values: number[]) {
    if (values.length === 0) return;
    this.mean = values[0];
    this.variance = 0;
    this.count = 1;
    for (let i = 1; i < values.length; i++) this.update(values[i]);
  }

  update(value: number) {
    this.count++;
    const diff = value - this.mean;
    this.mean = this.alpha * value + (1 - this.alpha) * this.mean;
    this.variance = (1 - this.alpha) * (this.variance + this.alpha * diff * diff);
  }

  get stdDev(): number { return Math.sqrt(Math.max(this.variance, 0.0001)); }
  zScore(value: number): number { return (value - this.mean) / this.stdDev; }
  isAnomaly(value: number, L = 2): boolean { return Math.abs(this.zScore(value)) > L; }
  get isReady(): boolean { return this.count >= 5; }
}

// ─── Bayesian Risk Updater ────────────────────────────────────────────────────
class BayesianRisk {
  probability: number;

  constructor(prior: number) {
    this.probability = Math.max(0.01, Math.min(0.99, prior));
  }

  update(likelihoodRatio: number, confidence: number) {
    const effectiveLR = 1 + confidence * (likelihoodRatio - 1);
    const odds = this.probability / (1 - this.probability);
    const posteriorOdds = odds * effectiveLR;
    this.probability = posteriorOdds / (1 + posteriorOdds);
    this.probability = Math.max(0.01, Math.min(0.99, this.probability));
  }

  get riskPercent(): number { return Math.round(this.probability * 100); }
}

// ─── Slope Detector ───────────────────────────────────────────────────────────
function computeSlope(values: { value: number; timestampMs: number }[]): { slope: number; r2: number } | null {
  if (values.length < 3) return null;
  const n = values.length;
  const msPerDay = 86400000;
  const t0 = values[0].timestampMs;
  const points = values.map(v => ({ x: (v.timestampMs - t0) / msPerDay, y: v.value }));
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of points) { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumX2 += p.x * p.x; }
  
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const ssRes = points.reduce((acc, p) => { const pred = (sumY / n) + slope * (p.x - sumX / n); return acc + (p.y - pred) ** 2; }, 0);
  const ssTot = points.reduce((acc, p) => acc + (p.y - sumY / n) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, r2 };
}

// ─── LR from historical data ─────────────────────────────────────────────────
function computeLR(entriesWithSignal: number, totalEntries: number, flaresWithSignal: number, totalFlares: number): number {
  if (totalFlares === 0 || totalEntries === 0) return 1;
  const nonFlareEntries = totalEntries - totalFlares;
  const nonFlaresWithSignal = entriesWithSignal - flaresWithSignal;
  const sensitivity = totalFlares > 0 ? flaresWithSignal / totalFlares : 0;
  const fpr = nonFlareEntries > 0 ? Math.max(nonFlaresWithSignal, 0) / nonFlareEntries : 0;
  if (fpr < 0.01) return Math.min(sensitivity / 0.01, 20);
  return Math.min(sensitivity / fpr, 20);
}

// ─── Condition weight profiles ────────────────────────────────────────────────
const CONDITION_LR_MULTIPLIERS: Record<string, Record<string, number>> = {
  migraine:       { sleep: 1.6, hrv: 1.5, pressure: 2.0, humidity: 1.3, aqi: 0.8, activity: 1.0, temperature: 1.4, cycle: 1.8, medication: 1.5 },
  fibromyalgia:   { sleep: 2.0, hrv: 1.7, pressure: 1.5, humidity: 1.3, aqi: 0.7, activity: 1.8, temperature: 1.2, cycle: 1.3, medication: 1.2 },
  asthma:         { sleep: 1.0, hrv: 0.9, pressure: 1.2, humidity: 1.7, aqi: 2.5, activity: 1.3, temperature: 1.6, cycle: 0.8, medication: 1.5 },
  "rheumatoid arthritis": { sleep: 1.5, hrv: 1.4, pressure: 1.8, humidity: 1.7, aqi: 0.8, activity: 1.5, temperature: 1.4, cycle: 1.2, medication: 1.7 },
  endometriosis:  { sleep: 1.5, hrv: 1.4, pressure: 0.8, humidity: 0.7, aqi: 0.6, activity: 1.2, temperature: 0.8, cycle: 2.5, medication: 1.6 },
  "crohn's disease": { sleep: 1.7, hrv: 1.8, pressure: 0.8, humidity: 0.7, aqi: 0.6, activity: 1.3, temperature: 0.8, cycle: 1.0, medication: 1.8 },
  ibs:            { sleep: 1.5, hrv: 1.8, pressure: 0.8, humidity: 0.7, aqi: 0.5, activity: 1.2, temperature: 0.8, cycle: 1.1, medication: 1.5 },
  acne:           { sleep: 1.5, hrv: 1.3, pressure: 0.5, humidity: 1.6, aqi: 1.0, activity: 0.8, temperature: 1.3, cycle: 1.5, medication: 1.2 },
  gerd:           { sleep: 1.3, hrv: 1.6, pressure: 0.6, humidity: 0.5, aqi: 0.5, activity: 1.5, temperature: 0.6, cycle: 0.7, medication: 1.7 },
  "lower back pain": { sleep: 1.6, hrv: 1.2, pressure: 1.3, humidity: 1.0, aqi: 0.5, activity: 2.0, temperature: 1.0, cycle: 0.8, medication: 1.3 },
  eczema:         { sleep: 1.5, hrv: 1.3, pressure: 0.7, humidity: 1.8, aqi: 1.3, activity: 0.8, temperature: 1.6, cycle: 1.0, medication: 1.3 },
  psoriasis:      { sleep: 1.6, hrv: 1.4, pressure: 0.7, humidity: 1.7, aqi: 1.1, activity: 0.8, temperature: 1.5, cycle: 1.0, medication: 1.4 },
  lupus:          { sleep: 1.8, hrv: 1.6, pressure: 1.2, humidity: 1.4, aqi: 1.0, activity: 1.6, temperature: 1.3, cycle: 1.5, medication: 1.6 },
  "multiple sclerosis": { sleep: 1.7, hrv: 1.5, pressure: 1.0, humidity: 1.2, aqi: 0.8, activity: 1.7, temperature: 1.5, cycle: 1.2, medication: 1.5 },
  "ankylosing spondylitis": { sleep: 1.6, hrv: 1.3, pressure: 1.6, humidity: 1.5, aqi: 0.7, activity: 1.8, temperature: 1.3, cycle: 1.0, medication: 1.5 },
};

const DEFAULT_LR_MULT: Record<string, number> = {
  sleep: 1.0, hrv: 1.0, pressure: 1.0, humidity: 1.0, aqi: 1.0,
  activity: 1.0, temperature: 1.0, cycle: 1.0, medication: 1.0,
};

function getConditionMultipliers(conditions: string[]): Record<string, number> {
  if (!conditions?.length) return DEFAULT_LR_MULT;
  const merged = { ...DEFAULT_LR_MULT };
  for (const cond of conditions) {
    const key = cond.toLowerCase().trim();
    const mults = CONDITION_LR_MULTIPLIERS[key];
    if (mults) {
      for (const [signal, mult] of Object.entries(mults)) {
        merged[signal] = Math.max(merged[signal] || 1, mult);
      }
    }
  }
  return merged;
}

function deepGet(obj: any, path: string): number | null {
  if (!obj) return null;
  const parts = path.split(".");
  let val: any = obj;
  for (const p of parts) { val = val?.[p]; if (val === undefined || val === null) return null; }
  return typeof val === "number" ? val : null;
}

function getPhysio(entry: any, ...paths: string[]): number | null {
  for (const p of paths) { const v = deepGet(entry.physiological_data, p); if (v !== null) return v; }
  return null;
}

function getEnv(entry: any, ...paths: string[]): number | null {
  for (const p of paths) { const v = deepGet(entry.environmental_data, p); if (v !== null) return v; }
  return null;
}

// ─── Brier Score Calculator ───────────────────────────────────────────────────
// Brier = mean((predicted_probability - actual_outcome)^2)
// Lower = better. 0 = perfect. 0.25 = random coin flip.
function computeBrierScore(predictions: Array<{ riskScore: number; hadFlare: boolean }>): number | null {
  if (predictions.length === 0) return null;
  const sum = predictions.reduce((acc, p) => {
    const prob = p.riskScore / 100;
    const actual = p.hadFlare ? 1 : 0;
    return acc + (prob - actual) ** 2;
  }, 0);
  return sum / predictions.length;
}

// ─── Auto-verify past predictions ─────────────────────────────────────────────
async function autoVerifyPredictions(supabase: any, userId: string, flares: any[]) {
  const { data: unverified } = await supabase
    .from("prediction_logs")
    .select("id, predicted_at, risk_score, risk_level, timeframe")
    .eq("user_id", userId)
    .eq("outcome_logged", false)
    .lt("predicted_at", new Date(Date.now() - 24 * 3600000).toISOString())
    .order("predicted_at", { ascending: false })
    .limit(10);

  if (!unverified?.length) return;

  for (const pred of unverified) {
    const predTime = new Date(pred.predicted_at).getTime();
    const windowEnd = predTime + 36 * 3600000; // 36h window
    
    const flaresInWindow = flares.filter((f: any) => {
      const ft = new Date(f.timestamp).getTime();
      return ft >= predTime && ft <= windowEnd;
    });

    const hadFlare = flaresInWindow.length > 0;
    const maxSeverity = flaresInWindow.reduce((max: string, f: any) => {
      const sevOrder: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };
      return (sevOrder[f.severity] || 0) > (sevOrder[max] || 0) ? f.severity : max;
    }, "none");

    // Brier score: (predicted_prob - actual)^2
    const predictedProb = pred.risk_score / 100;
    const actual = hadFlare ? 1 : 0;
    const brier = (predictedProb - actual) ** 2;

    // Was prediction correct?
    const wasCorrect = (pred.risk_level === "low" && !hadFlare) ||
      (pred.risk_level === "moderate" && !hadFlare) ||
      ((pred.risk_level === "high" || pred.risk_level === "very_high") && hadFlare);

    await supabase.from("prediction_logs").update({
      outcome_logged: true,
      outcome_severity: hadFlare ? maxSeverity : "none",
      outcome_flare_count: flaresInWindow.length,
      verified_at: new Date().toISOString(),
      was_correct: wasCorrect,
      brier_score: brier,
    }).eq("id", pred.id);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth (FIXED: use getUser instead of getClaims) ──
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
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { currentWeather, wearableData, menstrualDay } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Fetch all data in parallel ──
    const [entriesResult, correlationsResult, profileResult, medLogsResult, predHistoryResult] = await Promise.all([
      supabase.from("flare_entries").select("*").eq("user_id", userId)
        .order("timestamp", { ascending: true }).limit(1000),
      supabase.from("correlations").select("*").eq("user_id", userId)
        .order("confidence", { ascending: false }),
      supabase.from("profiles")
        .select("conditions, known_triggers, known_symptoms, biological_sex, date_of_birth, timezone")
        .eq("id", userId).single(),
      supabase.from("medication_logs").select("*").eq("user_id", userId)
        .order("taken_at", { ascending: false }).limit(200),
      supabase.from("prediction_logs").select("*").eq("user_id", userId)
        .order("predicted_at", { ascending: false }).limit(60),
    ]);

    const entries = entriesResult.data || [];
    const correlations = correlationsResult.data || [];
    const profile = profileResult.data;
    const medLogs = medLogsResult.data || [];
    const predHistory = predHistoryResult.data || [];

    // Auto-verify past predictions
    const flares = entries.filter((e: any) => e.entry_type === "flare");
    await autoVerifyPredictions(supabase, userId, flares);

    // Calculate historical accuracy
    const verifiedPreds = predHistory.filter((p: any) => p.outcome_logged && p.brier_score !== null);
    const brierScore = verifiedPreds.length >= 3
      ? verifiedPreds.reduce((a: number, p: any) => a + p.brier_score, 0) / verifiedPreds.length
      : null;
    const correctCount = verifiedPreds.filter((p: any) => p.was_correct).length;
    
    // Find pending verification (prediction > 24h old, not verified)
    const pendingPred = predHistory.find((p: any) => 
      !p.outcome_logged && 
      Date.now() - new Date(p.predicted_at).getTime() > 20 * 3600000
    );

    if (entries.length < 5) {
      return new Response(
        JSON.stringify({
          forecast: {
            riskScore: 50, riskLevel: "moderate", confidence: 0.15, factors: [],
            prediction: "Keep logging for 1-2 weeks to unlock personalized predictions.",
            recommendations: ["Log daily to build your personal baselines", "Connect a wearable for 25+ automatic data points"],
            protectiveFactors: [], timeframe: "next 24 hours", modelVersion: "v4-bayesian-ewma-verified",
            accuracy: { brierScore: null, totalPredictions: 0, correctPredictions: 0, calibrationNote: "Not enough data yet" },
          },
          needsMoreData: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conditions = profile?.conditions || [];
    const condMult = getConditionMultipliers(conditions);
    const factors: RiskFactor[] = [];
    const now = Date.now();
    const oneDay = 86400000;
    const nonFlares = entries.filter((e: any) => e.entry_type !== "flare");

    // ── Compute base flare rate (prior) ──
    const observationDays = Math.max(1, (now - new Date(entries[0].timestamp).getTime()) / oneDay);
    const baseFlareRate = Math.min(0.8, flares.length / observationDays);
    const bayesian = new BayesianRisk(baseFlareRate);

    // ═══ SIGNAL 1: SLEEP ═══
    const sleepEWMA = new EWMABaseline(0.12);
    const sleepTimeSeries: { value: number; timestampMs: number }[] = [];
    
    for (const e of entries) {
      const hrs = getPhysio(e, "sleep_hours", "sleepHours", "sleep.duration", "sleep.hours");
      if (hrs !== null && hrs > 0) {
        const normalized = hrs > 24 ? hrs / 60 : hrs;
        sleepTimeSeries.push({ value: normalized, timestampMs: new Date(e.timestamp).getTime() });
      }
    }
    sleepEWMA.feedSorted(sleepTimeSeries.map(v => v.value));

    let currentSleep: number | null = null;
    if (wearableData) {
      currentSleep = wearableData.sleep?.duration || wearableData.sleep?.hours || wearableData.sleepHours || wearableData.sleep_hours || null;
      if (currentSleep && currentSleep > 24) currentSleep /= 60;
    }

    if (currentSleep !== null && sleepEWMA.isReady) {
      const z = sleepEWMA.zScore(currentSleep);
      const poorSleepThreshold = sleepEWMA.mean - sleepEWMA.stdDev;
      let flaresAfterPoorSleep = 0, entriesWithPoorSleep = 0;
      for (let i = 0; i < entries.length; i++) {
        const sleepVal = getPhysio(entries[i], "sleep_hours", "sleepHours", "sleep.duration", "sleep.hours");
        if (sleepVal !== null) {
          const norm = sleepVal > 24 ? sleepVal / 60 : sleepVal;
          if (norm < poorSleepThreshold) {
            entriesWithPoorSleep++;
            const entryTime = new Date(entries[i].timestamp).getTime();
            if (flares.some((f: any) => { const ft = new Date(f.timestamp).getTime(); return ft > entryTime && ft < entryTime + 36 * 3600000; })) flaresAfterPoorSleep++;
          }
        }
      }

      const empiricalLR = entriesWithPoorSleep >= 3 
        ? computeLR(entriesWithPoorSleep, entries.length, flaresAfterPoorSleep, flares.length)
        : (z < -1.5 ? 2.5 : z < -1.0 ? 1.8 : z < -0.5 ? 1.3 : z > 0.5 ? 0.7 : 1.0);
      const adjustedLR = empiricalLR * condMult.sleep;

      if (z < -1.0) {
        bayesian.update(adjustedLR, Math.min(0.9, 0.5 + sleepEWMA.count * 0.008));
        factors.push({ factor: "Sleep deficit", impact: Math.min(0.7, Math.abs(z) * 0.2), confidence: Math.min(0.9, 0.5 + sleepEWMA.count * 0.008), evidence: `${currentSleep.toFixed(1)}h vs baseline ${sleepEWMA.mean.toFixed(1)}h (${Math.abs(z).toFixed(1)}σ below)`, category: "sleep", likelihoodRatio: adjustedLR });
      } else if (z > 0.8) {
        bayesian.update(Math.max(0.3, 1 / adjustedLR), 0.6);
        factors.push({ factor: "Above-average sleep", impact: -0.15, confidence: 0.6, evidence: `${currentSleep.toFixed(1)}h — restorative`, category: "sleep", likelihoodRatio: 1 / adjustedLR });
      }

      // 3-night sleep debt
      const last3 = sleepTimeSeries.filter(v => now - v.timestampMs < 3 * oneDay);
      if (currentSleep) last3.push({ value: currentSleep, timestampMs: now });
      if (last3.length >= 2) {
        const rolling = last3.reduce((a, b) => a + b.value, 0) / last3.length;
        const rollingZ = sleepEWMA.zScore(rolling);
        if (rollingZ < -0.8) {
          bayesian.update(1.4 * condMult.sleep, 0.65);
          factors.push({ factor: "Cumulative sleep debt (3 nights)", impact: Math.min(0.4, Math.abs(rollingZ) * 0.15), confidence: 0.65, evidence: `Rolling avg: ${rolling.toFixed(1)}h — cumulative debt elevates IL-6/TNF-α`, category: "sleep" });
        }
      }

      // Sleep slope
      const recentSleep = sleepTimeSeries.filter(v => now - v.timestampMs < 7 * oneDay);
      if (recentSleep.length >= 3) {
        const slopeResult = computeSlope(recentSleep);
        if (slopeResult && slopeResult.slope < -0.3 && slopeResult.r2 > 0.3) {
          bayesian.update(1.5, 0.6 * slopeResult.r2);
          factors.push({ factor: "Deteriorating sleep trend", impact: Math.min(0.3, Math.abs(slopeResult.slope) * 0.2), confidence: 0.6 * slopeResult.r2, evidence: `Losing ${Math.abs(slopeResult.slope).toFixed(1)}h/day over past week`, category: "sleep" });
        }
      }
    }

    // Deep sleep ratio
    const deepSleep = wearableData?.sleep?.stages?.deep || wearableData?.deep_sleep_minutes || wearableData?.deepSleepMinutes;
    const totalSleepMin = currentSleep ? currentSleep * 60 : null;
    if (deepSleep && totalSleepMin && totalSleepMin > 0) {
      const deepRatio = deepSleep / totalSleepMin;
      if (deepRatio < 0.10) {
        bayesian.update(1.6 * condMult.sleep, 0.6);
        factors.push({ factor: "Poor deep sleep quality", impact: 0.25, confidence: 0.6, evidence: `${Math.round(deepRatio * 100)}% deep sleep (healthy: 15-20%)`, category: "sleep" });
      }
    }

    // ═══ SIGNAL 2: HRV ═══
    const hrvEWMA = new EWMABaseline(0.12);
    const hrvTimeSeries: { value: number; timestampMs: number }[] = [];
    for (const e of entries) {
      const hrv = getPhysio(e, "heart_rate_variability", "heartRateVariability", "hrv_rmssd", "hrvRmssd");
      if (hrv !== null && hrv > 0 && hrv < 300) hrvTimeSeries.push({ value: hrv, timestampMs: new Date(e.timestamp).getTime() });
    }
    hrvEWMA.feedSorted(hrvTimeSeries.map(v => v.value));

    let currentHrv: number | null = null;
    if (wearableData) {
      currentHrv = wearableData.hrv?.current || wearableData.hrv?.daily || wearableData.heart_rate_variability || wearableData.heartRateVariability || wearableData.hrv_rmssd || wearableData.hrvRmssd || null;
    }

    if (currentHrv !== null && hrvEWMA.isReady) {
      const z = hrvEWMA.zScore(currentHrv);
      const lowHrvThreshold = hrvEWMA.mean - hrvEWMA.stdDev;
      let flaresAfterLowHrv = 0, entriesLowHrv = 0;
      for (const e of entries) {
        const h = getPhysio(e, "heart_rate_variability", "heartRateVariability", "hrv_rmssd", "hrvRmssd");
        if (h !== null && h < lowHrvThreshold) {
          entriesLowHrv++;
          const et = new Date(e.timestamp).getTime();
          if (flares.some((f: any) => { const ft = new Date(f.timestamp).getTime(); return ft > et && ft < et + 36 * 3600000; })) flaresAfterLowHrv++;
        }
      }
      const hrvLR = entriesLowHrv >= 3 ? computeLR(entriesLowHrv, entries.length, flaresAfterLowHrv, flares.length) : (z < -1.5 ? 2.8 : z < -1.0 ? 2.0 : 1.0);
      const adjustedHrvLR = hrvLR * condMult.hrv;

      if (z < -1.0) {
        bayesian.update(adjustedHrvLR, Math.min(0.85, 0.5 + hrvEWMA.count * 0.008));
        factors.push({ factor: "Low HRV — autonomic stress", impact: Math.min(0.65, Math.abs(z) * 0.2), confidence: Math.min(0.85, 0.5 + hrvEWMA.count * 0.008), evidence: `HRV ${currentHrv.toFixed(0)}ms vs baseline ${hrvEWMA.mean.toFixed(0)}ms (${Math.abs(z).toFixed(1)}σ below)`, category: "stress", likelihoodRatio: adjustedHrvLR });
      } else if (z > 0.8) {
        bayesian.update(0.5, 0.6);
        factors.push({ factor: "High HRV — parasympathetic recovery", impact: -0.2, confidence: 0.6, evidence: `HRV ${currentHrv.toFixed(0)}ms — vagal tone indicates recovery`, category: "stress" });
      }

      const recentHrv = hrvTimeSeries.filter(v => now - v.timestampMs < 5 * oneDay);
      if (recentHrv.length >= 3) {
        const slope = computeSlope(recentHrv);
        if (slope && slope.slope < -2 && slope.r2 > 0.3) {
          bayesian.update(1.4, 0.55 * slope.r2);
          factors.push({ factor: "Declining HRV trend", impact: 0.2, confidence: 0.55 * slope.r2, evidence: `HRV dropping ${Math.abs(slope.slope).toFixed(1)}ms/day`, category: "stress" });
        }
      }
    }

    // Resting HR
    const rhrEWMA = new EWMABaseline(0.1);
    const rhrSeries: { value: number; timestampMs: number }[] = [];
    for (const e of entries) {
      const rhr = getPhysio(e, "resting_heart_rate", "restingHeartRate");
      if (rhr !== null && rhr > 30 && rhr < 200) rhrSeries.push({ value: rhr, timestampMs: new Date(e.timestamp).getTime() });
    }
    rhrEWMA.feedSorted(rhrSeries.map(v => v.value));
    const currentRhr = wearableData?.resting_heart_rate || wearableData?.restingHeartRate;
    if (currentRhr && rhrEWMA.isReady) {
      const z = rhrEWMA.zScore(currentRhr);
      if (z > 1.5) {
        bayesian.update(1.8 * condMult.hrv, 0.7);
        factors.push({ factor: "Elevated resting HR", impact: Math.min(0.4, z * 0.12), confidence: 0.7, evidence: `${currentRhr} bpm vs baseline ${rhrEWMA.mean.toFixed(0)} bpm`, category: "physiological" });
      }
    }

    // ═══ SIGNAL 3: ACTIVITY ═══
    const stepsEWMA = new EWMABaseline(0.1);
    const stepsSeries: { value: number; timestampMs: number }[] = [];
    for (const e of entries) {
      const steps = getPhysio(e, "steps", "activity.steps");
      if (steps !== null && steps > 0) stepsSeries.push({ value: steps, timestampMs: new Date(e.timestamp).getTime() });
    }
    stepsEWMA.feedSorted(stepsSeries.map(v => v.value));
    const currentSteps = wearableData?.steps || wearableData?.activity?.steps;
    if (currentSteps && stepsEWMA.isReady) {
      const z = stepsEWMA.zScore(currentSteps);
      const highThreshold = stepsEWMA.mean + stepsEWMA.stdDev;
      let highActivityDays = 0, flaresAfterHigh = 0;
      for (const e of entries) {
        const s = getPhysio(e, "steps", "activity.steps");
        if (s !== null && s > highThreshold) {
          highActivityDays++;
          const et = new Date(e.timestamp).getTime();
          if (flares.some((f: any) => { const ft = new Date(f.timestamp).getTime(); return ft > et + 12 * 3600000 && ft < et + 72 * 3600000; })) flaresAfterHigh++;
        }
      }
      const boomBustRate = highActivityDays > 0 ? flaresAfterHigh / highActivityDays : 0;
      const activityLR = highActivityDays >= 3 ? computeLR(highActivityDays, entries.length, flaresAfterHigh, flares.length) : (z > 2 ? 2.0 : 1.0);

      if (z > 1.5 && boomBustRate > 0.25) {
        const adj = activityLR * condMult.activity;
        bayesian.update(adj, Math.min(0.8, 0.4 + boomBustRate));
        factors.push({ factor: "Overexertion — boom-bust pattern", impact: Math.min(0.55, z * 0.12 * (1 + boomBustRate)), confidence: Math.min(0.8, 0.4 + boomBustRate), evidence: `${Math.round(currentSteps)} steps (${z.toFixed(1)}σ above) — ${Math.round(boomBustRate * 100)}% followed by flares`, category: "activity", likelihoodRatio: adj });
      } else if (z > 1.5) {
        bayesian.update(1.3 * condMult.activity, 0.5);
        factors.push({ factor: "Unusually high activity", impact: 0.15, confidence: 0.5, evidence: `${Math.round(currentSteps)} steps — ${z.toFixed(1)}σ above baseline`, category: "activity" });
      }
    }

    // ═══ SIGNAL 4: ENVIRONMENTAL ═══
    if (currentWeather) {
      // Pressure
      const pressureEWMA = new EWMABaseline(0.15);
      const pressureSeries: { value: number; timestampMs: number }[] = [];
      for (const e of entries) {
        const p = getEnv(e, "weather.pressure", "pressure");
        if (p !== null && p > 900 && p < 1100) pressureSeries.push({ value: p, timestampMs: new Date(e.timestamp).getTime() });
      }
      pressureEWMA.feedSorted(pressureSeries.map(v => v.value));
      const currentPressure = currentWeather.pressure;
      if (currentPressure && pressureEWMA.isReady) {
        const recent24h = pressureSeries.filter(p => now - p.timestampMs < oneDay);
        if (recent24h.length > 0) {
          const recentAvg = recent24h.reduce((a, b) => a + b.value, 0) / recent24h.length;
          const delta = currentPressure - recentAvg;
          const lowPressureThreshold = pressureEWMA.mean - pressureEWMA.stdDev;
          let flaresLowP = 0, entriesLowP = 0;
          for (const e of entries) {
            const p = getEnv(e, "weather.pressure");
            if (p !== null && p < lowPressureThreshold) { entriesLowP++; if (e.entry_type === "flare") flaresLowP++; }
          }
          const pressureLR = entriesLowP >= 3 ? computeLR(entriesLowP, entries.length, flaresLowP, flares.length) : (delta < -6 ? 2.5 : delta < -4 ? 1.8 : 1.0);
          if (delta < -4) {
            const adj = pressureLR * condMult.pressure;
            bayesian.update(adj, Math.min(0.8, 0.4 + pressureEWMA.count * 0.005));
            factors.push({ factor: "Rapid barometric pressure drop", impact: Math.min(0.6, Math.abs(delta) / 10 * condMult.pressure), confidence: Math.min(0.8, 0.4 + pressureEWMA.count * 0.005), evidence: `${Math.abs(delta).toFixed(1)}mb drop in 24h`, category: "weather", likelihoodRatio: adj });
          } else if (delta > 4) {
            bayesian.update(0.7, 0.5);
            factors.push({ factor: "Rising barometric pressure", impact: -0.1, confidence: 0.5, evidence: "Pressure stabilizing — generally protective", category: "weather" });
          }
        }
        const recentPressure = pressureSeries.filter(v => now - v.timestampMs < 3 * oneDay);
        if (recentPressure.length >= 3) {
          const slope = computeSlope(recentPressure);
          if (slope && slope.slope < -3 && slope.r2 > 0.4) {
            bayesian.update(1.5 * condMult.pressure, 0.6);
            factors.push({ factor: "Multi-day pressure decline", impact: 0.2, confidence: 0.6, evidence: `Pressure falling ${Math.abs(slope.slope).toFixed(1)}mb/day`, category: "weather" });
          }
        }
      }

      // AQI
      const currentAqi = currentWeather.aqi || currentWeather.airQuality?.aqi;
      if (currentAqi && currentAqi > 50) {
        const aqiLR = currentAqi > 150 ? 3.0 : currentAqi > 100 ? 2.0 : 1.3;
        const adj = aqiLR * condMult.aqi;
        bayesian.update(adj, currentAqi > 100 ? 0.75 : 0.5);
        factors.push({ factor: currentAqi > 100 ? "Unhealthy air quality" : "Moderate air quality", impact: Math.min(0.5, (currentAqi - 30) / 200), confidence: currentAqi > 100 ? 0.75 : 0.5, evidence: `AQI ${currentAqi}`, category: "environmental", likelihoodRatio: adj });
      }

      // Humidity
      const humidity = currentWeather.humidity;
      if (humidity) {
        let humidFlares = 0, humidEntries = 0;
        for (const e of entries) {
          const h = getEnv(e, "weather.humidity");
          if (h !== null && h > 75) { humidEntries++; if (e.entry_type === "flare") humidFlares++; }
        }
        const humidLR = humidEntries >= 3 ? computeLR(humidEntries, entries.length, humidFlares, flares.length) : 1.0;
        if (humidity > 80 && humidLR > 1.2) {
          const adj = humidLR * condMult.humidity;
          bayesian.update(adj, Math.min(0.7, 0.3 + humidEntries * 0.02));
          factors.push({ factor: "High humidity", impact: Math.min(0.3, (humidLR - 1) * 0.3), confidence: Math.min(0.7, 0.3 + humidEntries * 0.02), evidence: `${humidity}% — ${humidFlares}/${humidEntries} high-humidity entries were flares`, category: "weather", likelihoodRatio: adj });
        }
      }

      // Temperature
      const temp = currentWeather.temperature;
      if (temp !== undefined) {
        const tempEWMA = new EWMABaseline(0.12);
        const tempSeries: number[] = [];
        for (const e of entries) { const t = getEnv(e, "weather.temperature"); if (t !== null) tempSeries.push(t); }
        tempEWMA.feedSorted(tempSeries);
        if (tempEWMA.isReady) {
          const z = tempEWMA.zScore(temp);
          if (Math.abs(z) > 1.5) {
            bayesian.update(1.5 * condMult.temperature, 0.5);
            factors.push({ factor: z > 0 ? "Unusually hot" : "Unusually cold", impact: Math.min(0.25, Math.abs(z) * 0.08), confidence: 0.5, evidence: `${temp.toFixed(0)}°C — ${Math.abs(z).toFixed(1)}σ from baseline`, category: "weather" });
          }
        }
      }

      // Pollen
      const pollen = currentWeather.pollen || currentWeather.airQuality?.pollen;
      if (pollen && pollen > 5) {
        bayesian.update(1.3 * condMult.aqi, 0.55);
        factors.push({ factor: "Elevated pollen", impact: Math.min(0.25, pollen / 30), confidence: 0.55, evidence: `Pollen index ${pollen}`, category: "environmental" });
      }
    }

    // ═══ SIGNAL 5: MENSTRUAL CYCLE ═══
    if (menstrualDay) {
      const cycleDayFlares: Record<number, number> = {};
      let totalCycleFlares = 0;
      for (const f of flares) {
        const day = f.physiological_data?.menstrual_day || f.environmental_data?.menstrual_day;
        if (day) { cycleDayFlares[day] = (cycleDayFlares[day] || 0) + 1; totalCycleFlares++; }
      }
      if (totalCycleFlares >= 5) {
        const window = [-2, -1, 0, 1, 2];
        let windowFlares = 0;
        for (const offset of window) windowFlares += cycleDayFlares[menstrualDay + offset] || 0;
        const windowProb = windowFlares / totalCycleFlares;
        const expectedProb = 5 / 28;
        const cycleLR = windowProb / expectedProb;
        if (cycleLR > 1.2) {
          const adj = cycleLR * condMult.cycle;
          bayesian.update(adj, Math.min(0.85, 0.4 + totalCycleFlares * 0.015));
          factors.push({ factor: `Cycle day ${menstrualDay} — high-risk window`, impact: Math.min(0.55, (cycleLR - 1) * 0.3), confidence: Math.min(0.85, 0.4 + totalCycleFlares * 0.015), evidence: `${Math.round(windowProb * 100)}% of cycle-tracked flares cluster here`, category: "cycle", likelihoodRatio: adj });
        }
      } else {
        const highRiskDays = [1, 2, 3, 25, 26, 27, 28];
        if (highRiskDays.includes(menstrualDay)) {
          bayesian.update(1.6 * condMult.cycle, 0.45);
          factors.push({ factor: `Cycle day ${menstrualDay} — prostaglandin peak`, impact: 0.3, confidence: 0.45, evidence: "Days 1-3, 25-28: elevated PGE2 and inflammation", category: "cycle" });
        }
      }
    }

    // ═══ SIGNAL 6: TEMPORAL PATTERNS ═══
    const userTz = profile?.timezone || "UTC";
    const today = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const dayBuckets: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dayTotalBuckets: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const e of entries) {
      try {
        const d = new Date(e.timestamp);
        const localDay = d.toLocaleDateString("en-US", { weekday: "long", timeZone: userTz });
        const idx = dayNames.indexOf(localDay);
        if (idx >= 0) { dayTotalBuckets[idx]++; if (e.entry_type === "flare") dayBuckets[idx]++; }
      } catch { /* skip */ }
    }

    let todayIdx: number;
    try { todayIdx = dayNames.indexOf(today.toLocaleDateString("en-US", { weekday: "long", timeZone: userTz })); } catch { todayIdx = today.getDay(); }

    if (todayIdx >= 0 && dayBuckets[todayIdx] >= 3 && dayTotalBuckets[todayIdx] > 0) {
      const dayFlareRate = dayBuckets[todayIdx] / dayTotalBuckets[todayIdx];
      const overallFlareRate = flares.length / entries.length;
      const dayLR = overallFlareRate > 0 ? dayFlareRate / overallFlareRate : 1;
      if (dayLR > 1.3) {
        bayesian.update(dayLR, Math.min(0.7, 0.3 + dayBuckets[todayIdx] * 0.03));
        factors.push({ factor: `${dayNames[todayIdx]}s are high-risk`, impact: Math.min(0.3, (dayLR - 1) * 0.15), confidence: Math.min(0.7, 0.3 + dayBuckets[todayIdx] * 0.03), evidence: `${Math.round(dayFlareRate * 100)}% flare rate vs ${Math.round(overallFlareRate * 100)}% overall`, category: "pattern", likelihoodRatio: dayLR });
      }
    }

    // Hour-of-day
    const hourBuckets: number[] = new Array(24).fill(0);
    const hourTotalBuckets: number[] = new Array(24).fill(0);
    for (const e of entries) {
      try {
        const h = parseInt(new Date(e.timestamp).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz }));
        if (h >= 0 && h < 24) { hourTotalBuckets[h]++; if (e.entry_type === "flare") hourBuckets[h]++; }
      } catch { /* skip */ }
    }
    let currentHour: number;
    try { currentHour = parseInt(today.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz })); } catch { currentHour = today.getHours(); }
    const windowHours = [-1, 0, 1, 2, 3].map(o => (currentHour + o + 24) % 24);
    const windowFlareCount = windowHours.reduce((a, h) => a + hourBuckets[h], 0);
    const windowTotalCount = windowHours.reduce((a, h) => a + hourTotalBuckets[h], 0);
    if (windowFlareCount >= 3 && windowTotalCount > 0) {
      const windowRate = windowFlareCount / windowTotalCount;
      const overallRate = flares.length / entries.length;
      const hourLR = overallRate > 0 ? windowRate / overallRate : 1;
      if (hourLR > 1.3) {
        bayesian.update(hourLR, 0.55);
        factors.push({ factor: "High-risk time window", impact: Math.min(0.2, (hourLR - 1) * 0.1), confidence: 0.55, evidence: `${Math.round(windowRate * 100)}% flare rate in this time window`, category: "pattern" });
      }
    }

    // Recent trend
    const recentFlares = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < 7 * oneDay);
    const prevWeekFlares = flares.filter((e: any) => { const ts = new Date(e.timestamp).getTime(); return ts >= now - 14 * oneDay && ts < now - 7 * oneDay; });
    if (recentFlares.length > prevWeekFlares.length + 2) {
      bayesian.update(1.6, 0.7);
      factors.push({ factor: "Worsening flare trend", impact: Math.min(0.3, (recentFlares.length - prevWeekFlares.length) * 0.04), confidence: 0.7, evidence: `${recentFlares.length} flares this week vs ${prevWeekFlares.length} last week`, category: "pattern" });
    } else if (recentFlares.length === 0 && prevWeekFlares.length >= 2) {
      bayesian.update(0.5, 0.6);
      factors.push({ factor: "Flare-free streak", impact: -0.25, confidence: 0.6, evidence: "No flares in 7 days — good recovery", category: "pattern" });
    }

    // ═══ SIGNAL 7: MULTI-DAY LAG ═══
    const recent48h = entries.filter((e: any) => now - new Date(e.timestamp).getTime() < 2 * oneDay);
    const triggerLags: Record<string, { delays: number[]; count: number }> = {};
    for (const e of entries) {
      if (!e.triggers?.length) continue;
      for (const trigger of e.triggers) {
        const tKey = trigger.toLowerCase();
        if (!triggerLags[tKey]) triggerLags[tKey] = { delays: [], count: 0 };
        const et = new Date(e.timestamp).getTime();
        for (const f of flares) {
          const delay = (new Date(f.timestamp).getTime() - et) / oneDay;
          if (delay > 0.5 && delay < 5) { triggerLags[tKey].delays.push(delay); triggerLags[tKey].count++; }
        }
      }
    }
    for (const [trigger, data] of Object.entries(triggerLags)) {
      if (data.delays.length < 3) continue;
      const avgDelay = data.delays.reduce((a, b) => a + b, 0) / data.delays.length;
      const stdDelay = Math.sqrt(data.delays.reduce((a, d) => a + (d - avgDelay) ** 2, 0) / data.delays.length);
      const consistency = stdDelay < 1.5 ? 0.8 : stdDelay < 2.5 ? 0.5 : 0.3;
      const wasRecent = recent48h.some((e: any) => e.triggers?.some((t: string) => t.toLowerCase() === trigger));
      if (wasRecent) {
        const lagLR = 1 + data.count * 0.1 * consistency;
        bayesian.update(lagLR, consistency);
        factors.push({ factor: `Delayed trigger: "${trigger}"`, impact: Math.min(0.4, 0.1 + data.count * 0.02 * consistency), confidence: consistency, evidence: `Flares ~${avgDelay.toFixed(0)} days after "${trigger}" (${data.count} instances)`, category: "trigger", likelihoodRatio: lagLR });
      }
    }

    // ═══ SIGNAL 8: MEDICATION GAPS ═══
    if (medLogs.length >= 5) {
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
          const expectedInterval = (14 * oneDay) / info.count;
          const gap = now - info.lastTaken;
          if (gap > expectedInterval * 1.8) {
            const gapRatio = gap / expectedInterval;
            const medLR = Math.min(1.5 + (gapRatio - 1.8) * 0.3, 4) * condMult.medication;
            bayesian.update(medLR, Math.min(0.7, 0.4 + info.count * 0.02));
            factors.push({ factor: `Medication gap: ${med}`, impact: Math.min(0.45, (gapRatio - 1) * 0.12), confidence: Math.min(0.7, 0.4 + info.count * 0.02), evidence: `Last taken ${(gap / oneDay).toFixed(1)} days ago (usual interval: ${(expectedInterval / oneDay).toFixed(1)} days)`, category: "medication", likelihoodRatio: medLR });
          }
        }
      }
    }

    // ═══ SIGNAL 9: LEARNED CORRELATIONS ═══
    const topCorrelations = correlations.filter((c: any) => c.confidence >= 0.5).slice(0, 8);
    for (const c of topCorrelations) {
      const recentMatch = recent48h.some((e: any) => {
        const triggers = e.triggers || [];
        const note = e.note?.toLowerCase() || "";
        const medications = e.medications || [];
        return triggers.some((t: string) => t.toLowerCase().includes(c.trigger_value.toLowerCase())) || note.includes(c.trigger_value.toLowerCase()) || medications.some((m: string) => m.toLowerCase().includes(c.trigger_value.toLowerCase()));
      });
      if (recentMatch) {
        const corrLR = 1 + c.confidence * 2;
        bayesian.update(corrLR, c.confidence);
        factors.push({ factor: `Known trigger: ${c.trigger_value}`, impact: Math.min(0.45, c.confidence * 0.4), confidence: c.confidence, evidence: `${c.trigger_value} → ${c.outcome_value} (${Math.round(c.confidence * 100)}% confidence, ${c.occurrence_count}× observed)`, category: "trigger", likelihoodRatio: corrLR });
      }
    }

    // ═══ SIGNAL 10: SpO2, Breathing Rate, Skin Temperature ═══
    const spo2 = wearableData?.spo2 || wearableData?.spo2_avg || wearableData?.spo2Avg;
    if (spo2 && spo2 < 95) {
      bayesian.update(2.0, 0.65);
      factors.push({ factor: "Low blood oxygen", impact: Math.min(0.35, (96 - spo2) * 0.08), confidence: 0.65, evidence: `SpO2 ${spo2}%`, category: "physiological" });
    }
    const breathRate = wearableData?.breathing_rate || wearableData?.breathingRate;
    if (breathRate && breathRate > 20) {
      bayesian.update(1.5, 0.5);
      factors.push({ factor: "Elevated breathing rate", impact: Math.min(0.2, (breathRate - 16) * 0.025), confidence: 0.5, evidence: `${breathRate.toFixed(0)} breaths/min`, category: "physiological" });
    }
    const skinTemp = wearableData?.skin_temperature || wearableData?.skinTemperature;
    if (skinTemp) {
      const stEWMA = new EWMABaseline(0.12);
      const stSeries: number[] = [];
      for (const e of entries) { const t = getPhysio(e, "skin_temperature", "skinTemperature"); if (t !== null) stSeries.push(t); }
      stEWMA.feedSorted(stSeries);
      if (stEWMA.isReady && stEWMA.zScore(skinTemp) > 1.2) {
        bayesian.update(1.6, 0.55);
        factors.push({ factor: "Elevated skin temperature", impact: 0.2, confidence: 0.55, evidence: `${stEWMA.zScore(skinTemp).toFixed(1)}σ above baseline`, category: "physiological" });
      }
    }

    // ═══ CROSS-SIGNAL INTERACTIONS ═══
    const riskFactors = factors.filter(f => f.impact > 0);
    const hasSleep = riskFactors.some(f => f.category === "sleep");
    const hasStress = riskFactors.some(f => f.category === "stress" || f.category === "physiological");
    const hasWeather = riskFactors.some(f => f.category === "weather" || f.category === "environmental");
    const hasMedGap = riskFactors.some(f => f.category === "medication");
    const interactions: string[] = [];
    if (hasSleep && hasStress) { bayesian.update(1.4, 0.7); interactions.push("sleep deficit × autonomic stress"); }
    if (hasWeather && (hasSleep || hasStress)) { bayesian.update(1.25, 0.6); interactions.push("environmental pressure × weakened recovery"); }
    if (hasMedGap && (hasSleep || hasStress || hasWeather)) { bayesian.update(1.3, 0.65); interactions.push("medication gap × active stressors"); }
    const activeCategories = new Set(riskFactors.map(f => f.category)).size;
    if (activeCategories >= 3) { bayesian.update(1.3, 0.6); interactions.push("allostatic overload (3+ stress systems)"); }
    if (interactions.length > 0) {
      factors.push({ factor: "Compounding risk signals", impact: Math.min(0.3, interactions.length * 0.08), confidence: 0.7, evidence: `Cross-signal: ${interactions.join("; ")}`, category: "pattern" });
    }

    // ═══ FINAL RISK SCORE ═══
    const riskScore = bayesian.riskPercent;
    let riskLevel: Forecast["riskLevel"] = "low";
    if (riskScore >= 75) riskLevel = "very_high";
    else if (riskScore >= 55) riskLevel = "high";
    else if (riskScore >= 35) riskLevel = "moderate";

    // Confidence calibration
    const signalDiversity = [sleepEWMA.isReady, hrvEWMA.isReady, stepsEWMA.isReady, rhrEWMA.isReady, correlations.length > 0, !!currentWeather, medLogs.length > 0].filter(Boolean).length;
    const dataRichness = Math.min(0.9, 0.2 + signalDiversity * 0.08 + entries.length * 0.001);
    const avgFactorConf = factors.length > 0 ? factors.reduce((a, f) => a + f.confidence, 0) / factors.length : 0.3;
    const overallConfidence = Math.min(0.95, (dataRichness + avgFactorConf) / 2);

    const sortedRisk = factors.filter(f => f.impact > 0).sort((a, b) => (b.impact * b.confidence) - (a.impact * a.confidence));
    const protectiveFactors = factors.filter(f => f.impact < 0).map(f => f.evidence);

    // Prediction text
    const topFactor = sortedRisk[0]?.factor || "various factors";
    let prediction = "";
    if (riskScore < 25) {
      prediction = `Low risk (${riskScore}%). ${factors.length} signals analyzed — stable outlook${protectiveFactors.length > 0 ? ` with ${protectiveFactors.length} protective factor(s)` : ""}.`;
    } else if (riskScore < 45) {
      prediction = `Moderate risk (${riskScore}%). Primary signal: ${topFactor}. Base rate: ${Math.round(baseFlareRate * 100)}%/day, updated by ${factors.filter(f => f.likelihoodRatio).length} likelihood ratios.`;
    } else if (riskScore < 65) {
      prediction = `Elevated risk (${riskScore}%). ${topFactor} is the strongest signal${sortedRisk.length > 1 ? `, compounded by ${sortedRisk[1]?.factor?.toLowerCase()}` : ""}.`;
    } else {
      prediction = `High risk (${riskScore}%). ${sortedRisk.slice(0, 2).map(f => f.factor).join(" + ")} driving risk. ${activeCategories} stress systems active.`;
    }

    // Recommendations
    const recommendations: string[] = [];
    if (sortedRisk.some(f => f.category === "sleep")) recommendations.push("Prioritize 7-9h sleep — cumulative sleep debt elevates IL-6/TNF-α within 48h");
    if (sortedRisk.some(f => f.category === "activity")) recommendations.push("Pace activity within your energy envelope — your data shows boom-bust patterns");
    if (sortedRisk.some(f => f.category === "stress" || f.category === "physiological")) recommendations.push("Vagal stimulation: 4s in, 8s out breathing or cold water on face");
    if (sortedRisk.some(f => f.category === "weather" || f.category === "environmental")) recommendations.push("Environmental conditions unfavorable — minimize exposure, stay hydrated");
    if (sortedRisk.some(f => f.category === "cycle")) recommendations.push("Hormonal high-risk window — consider anti-inflammatory support per your care plan");
    if (sortedRisk.some(f => f.category === "medication")) recommendations.push("Medication gap detected — rebound symptoms can appear 24-48h after missed dose");
    if (sortedRisk.some(f => f.category === "trigger")) recommendations.push("Known trigger active — monitor closely for the next 24-72h");
    if (recommendations.length === 0) recommendations.push("Signals balanced. Keep logging consistently — each entry strengthens accuracy");

    // Accuracy stats
    let calibrationNote = "Building prediction history...";
    if (verifiedPreds.length >= 10) {
      if (brierScore !== null && brierScore < 0.15) calibrationNote = "Model is well-calibrated — predictions closely match outcomes";
      else if (brierScore !== null && brierScore < 0.25) calibrationNote = "Good calibration — improving with more data";
      else calibrationNote = "Model is still calibrating — accuracy improves with consistent logging";
    } else if (verifiedPreds.length >= 3) {
      calibrationNote = `Calibrating (${verifiedPreds.length}/10 predictions verified)`;
    }

    const forecast: Forecast = {
      riskScore,
      riskLevel,
      confidence: overallConfidence,
      factors: [...sortedRisk, ...factors.filter(f => f.impact <= 0)].slice(0, 12),
      prediction,
      recommendations,
      protectiveFactors,
      timeframe: "next 24 hours",
      modelVersion: "v4-bayesian-ewma-verified",
      accuracy: {
        brierScore,
        totalPredictions: verifiedPreds.length,
        correctPredictions: correctCount,
        calibrationNote,
      },
      pendingVerification: pendingPred ? {
        id: pendingPred.id,
        predictedAt: pendingPred.predicted_at,
        riskScore: pendingPred.risk_score,
        riskLevel: pendingPred.risk_level,
      } : undefined,
    };

    // ── Store this prediction (fire-and-forget) ──
    // Don't store if we already have a prediction from the last 6 hours
    const recentPred = predHistory.find((p: any) => 
      Date.now() - new Date(p.predicted_at).getTime() < 6 * 3600000
    );
    if (!recentPred) {
      supabase.from("prediction_logs").insert({
        user_id: userId,
        risk_score: riskScore,
        risk_level: riskLevel,
        confidence: overallConfidence,
        factors: sortedRisk.slice(0, 8).map(f => ({ factor: f.factor, impact: f.impact, category: f.category, evidence: f.evidence })),
        timeframe: "next 24 hours",
        model_version: "v4-bayesian-ewma-verified",
      }).then(() => console.log("📊 Prediction logged")).catch((e: any) => console.warn("Prediction log failed:", e));
    }

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
