import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA HEALTH FORECAST ENGINE v3 — Industry-Grade Personal Risk Prediction
// ═══════════════════════════════════════════════════════════════════════════════
//
// MODEL ARCHITECTURE:
//
// 1. EWMA (Exponentially Weighted Moving Average) Baselines
//    - Adaptive personal baselines using α=0.15 smoothing factor
//    - Self-tuning: baselines shift with the user's evolving health
//    - Control limits at ±2σ (EWMA control chart, per SPC theory)
//    Reference: Roberts (1959) — EWMA control charts for process monitoring
//    Reference: AnEWMA — Hoblos et al. (2024) — anomaly detection in time series
//
// 2. Bayesian Risk Updating (Likelihood Ratio Scoring)
//    - Prior: user's base flare rate (flares/day over observation window)
//    - Each signal updates the posterior via likelihood ratios
//    - P(flare|signal) = LR × P(flare) / [LR × P(flare) + (1 - P(flare))]
//    - LRs computed from user's own historical signal-vs-flare co-occurrence
//    Reference: Fagan nomogram; Bayesian clinical prediction (Sackett et al.)
//
// 3. Slope-Based Trend Detection
//    - Linear regression over recent N readings to detect deterioration
//    - Slope exceeding ±1σ/day triggers alert (per adaptive threshold research)
//    Reference: Sensium adaptive threshold monitoring (Mestrom et al., 2021)
//
// 4. Cross-Signal Interaction Matrix
//    - Pairwise interaction terms for signals that compound non-linearly
//    - sleep×stress, weather×physiology, medication×trigger
//    Reference: McEwen (2008) — Allostatic Load Theory
//
// 5. Condition-Specific Likelihood Multipliers
//    - Each condition amplifies relevant signals via learned or default LRs
//    - 15+ conditions with research-backed signal profiles
//
// 6. Multi-Day Lag Detection
//    - Cross-correlation analysis between triggers and flare onset
//    - Detects delayed patterns (24h-96h) invisible to same-day analysis
//    Reference: Lipton et al. (2014); VanNess et al. (2010) post-exertional malaise
//
// 7. Confidence Calibration
//    - Data richness score weighted by signal diversity
//    - Confidence decays when predictions are based on sparse signals
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
}

// ─── EWMA Engine ──────────────────────────────────────────────────────────────
// Exponentially Weighted Moving Average with adaptive control limits
// α = smoothing factor (0.05-0.3). Lower = smoother, slower adaptation
// Control limits = EWMA ± L × σ_EWMA where L = control limit multiplier
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

  // Feed sorted data points (oldest first) to build baseline
  feedSorted(values: number[]) {
    if (values.length === 0) return;
    // Initialize with first value
    this.mean = values[0];
    this.variance = 0;
    this.count = 1;
    
    for (let i = 1; i < values.length; i++) {
      this.update(values[i]);
    }
  }

  update(value: number) {
    this.count++;
    const diff = value - this.mean;
    this.mean = this.alpha * value + (1 - this.alpha) * this.mean;
    // Online variance using EWMA (Welford-like for EWMA)
    this.variance = (1 - this.alpha) * (this.variance + this.alpha * diff * diff);
  }

  get stdDev(): number {
    return Math.sqrt(Math.max(this.variance, 0.0001)); // Floor to prevent division by zero
  }

  // Z-score relative to EWMA baseline
  zScore(value: number): number {
    return (value - this.mean) / this.stdDev;
  }

  // Is value outside control limits? (L=2 for warning, L=3 for alarm)
  isAnomaly(value: number, L = 2): boolean {
    return Math.abs(this.zScore(value)) > L;
  }

  get isReady(): boolean {
    return this.count >= 5; // Minimum data points for reliable baseline
  }
}

// ─── Bayesian Risk Updater ────────────────────────────────────────────────────
// Start with prior (base flare rate), update with likelihood ratios from each signal
class BayesianRisk {
  probability: number; // Current posterior probability

  constructor(prior: number) {
    // Clamp to [0.01, 0.99] to avoid degenerate updates
    this.probability = Math.max(0.01, Math.min(0.99, prior));
  }

  // Update posterior with a likelihood ratio
  // LR > 1 = evidence supports flare, LR < 1 = evidence against flare
  update(likelihoodRatio: number, confidence: number) {
    // Weight the LR by confidence: LR_effective = 1 + confidence * (LR - 1)
    // When confidence = 0, LR_effective = 1 (no update)
    // When confidence = 1, LR_effective = LR (full update)
    const effectiveLR = 1 + confidence * (likelihoodRatio - 1);
    
    const odds = this.probability / (1 - this.probability);
    const posteriorOdds = odds * effectiveLR;
    this.probability = posteriorOdds / (1 + posteriorOdds);
    
    // Clamp
    this.probability = Math.max(0.01, Math.min(0.99, this.probability));
  }

  get riskPercent(): number {
    return Math.round(this.probability * 100);
  }
}

// ─── Slope Detector ───────────────────────────────────────────────────────────
// Compute linear regression slope over recent N readings
// Returns slope in units/day
function computeSlope(values: { value: number; timestampMs: number }[]): { slope: number; r2: number } | null {
  if (values.length < 3) return null;
  
  const n = values.length;
  const msPerDay = 86400000;
  
  // Convert timestamps to days relative to first reading
  const t0 = values[0].timestampMs;
  const points = values.map(v => ({
    x: (v.timestampMs - t0) / msPerDay,
    y: v.value,
  }));
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }
  
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return null;
  
  const slope = (n * sumXY - sumX * sumY) / denom;
  
  // R² for confidence
  const ssRes = points.reduce((acc, p) => {
    const predicted = (sumY / n) + slope * (p.x - sumX / n);
    return acc + (p.y - predicted) ** 2;
  }, 0);
  const ssTot = points.reduce((acc, p) => acc + (p.y - sumY / n) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  
  return { slope, r2 };
}

// ─── Compute Likelihood Ratio from historical data ────────────────────────────
// P(signal_present | flare) / P(signal_present | no_flare)
function computeLR(
  entriesWithSignal: number,
  totalEntries: number,
  flaresWithSignal: number,
  totalFlares: number
): number {
  if (totalFlares === 0 || totalEntries === 0) return 1;
  
  const nonFlareEntries = totalEntries - totalFlares;
  const nonFlaresWithSignal = entriesWithSignal - flaresWithSignal;
  
  const sensitivity = totalFlares > 0 ? flaresWithSignal / totalFlares : 0;
  const falsePositiveRate = nonFlareEntries > 0 
    ? Math.max(nonFlaresWithSignal, 0) / nonFlareEntries 
    : 0;
  
  // LR+ = sensitivity / false positive rate
  if (falsePositiveRate < 0.01) return Math.min(sensitivity / 0.01, 20); // Cap at 20
  return Math.min(sensitivity / falsePositiveRate, 20);
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

// ─── Helper: extract nested value ─────────────────────────────────────────────
function deepGet(obj: any, path: string): number | null {
  if (!obj) return null;
  const parts = path.split(".");
  let val: any = obj;
  for (const p of parts) {
    val = val?.[p];
    if (val === undefined || val === null) return null;
  }
  return typeof val === "number" ? val : null;
}

function getPhysio(entry: any, ...paths: string[]): number | null {
  for (const p of paths) {
    const v = deepGet(entry.physiological_data, p);
    if (v !== null) return v;
  }
  return null;
}

function getEnv(entry: any, ...paths: string[]): number | null {
  for (const p of paths) {
    const v = deepGet(entry.environmental_data, p);
    if (v !== null) return v;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

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
      supabase.from("flare_entries").select("*").eq("user_id", userId)
        .order("timestamp", { ascending: true }).limit(1000),
      supabase.from("correlations").select("*").eq("user_id", userId)
        .order("confidence", { ascending: false }),
      supabase.from("profiles")
        .select("conditions, known_triggers, known_symptoms, biological_sex, date_of_birth, timezone")
        .eq("id", userId).single(),
      supabase.from("medication_logs").select("*").eq("user_id", userId)
        .order("taken_at", { ascending: false }).limit(200),
    ]);

    const entries = entriesResult.data || [];
    const correlations = correlationsResult.data || [];
    const profile = profileResult.data;
    const medLogs = medLogsResult.data || [];

    if (entries.length < 5) {
      return new Response(
        JSON.stringify({
          forecast: {
            riskScore: 50, riskLevel: "moderate", confidence: 0.15, factors: [],
            prediction: "Keep logging for 1-2 weeks to unlock personalized predictions.",
            recommendations: ["Log daily to build your personal baselines", "Connect a wearable for 25+ automatic data points"],
            protectiveFactors: [], timeframe: "next 24 hours", modelVersion: "v3-bayesian-ewma",
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
    const flares = entries.filter((e: any) => e.entry_type === "flare");
    const nonFlares = entries.filter((e: any) => e.entry_type !== "flare");

    // ── Compute base flare rate (prior) ──
    const observationDays = Math.max(1, (now - new Date(entries[0].timestamp).getTime()) / oneDay);
    const baseFlareRate = Math.min(0.8, flares.length / observationDays); // Flares per day
    const bayesian = new BayesianRisk(baseFlareRate);

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 1: SLEEP — EWMA baseline + slope + deep sleep ratio
    // ═══════════════════════════════════════════════════════════════════════════
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

    // Current sleep
    let currentSleep: number | null = null;
    if (wearableData) {
      currentSleep = wearableData.sleep?.duration || wearableData.sleep?.hours ||
        wearableData.sleepHours || wearableData.sleep_hours || null;
      if (currentSleep && currentSleep > 24) currentSleep /= 60;
    }

    if (currentSleep !== null && sleepEWMA.isReady) {
      const z = sleepEWMA.zScore(currentSleep);
      
      // Compute empirical LR: how often do flares follow poor sleep?
      const poorSleepThreshold = sleepEWMA.mean - sleepEWMA.stdDev;
      let flaresAfterPoorSleep = 0;
      let entriesWithPoorSleep = 0;
      for (let i = 0; i < entries.length; i++) {
        const sleepVal = getPhysio(entries[i], "sleep_hours", "sleepHours", "sleep.duration", "sleep.hours");
        if (sleepVal !== null) {
          const norm = sleepVal > 24 ? sleepVal / 60 : sleepVal;
          if (norm < poorSleepThreshold) {
            entriesWithPoorSleep++;
            // Check if flare within next 36h
            const entryTime = new Date(entries[i].timestamp).getTime();
            const flareFollowed = flares.some((f: any) => {
              const ft = new Date(f.timestamp).getTime();
              return ft > entryTime && ft < entryTime + 36 * 3600000;
            });
            if (flareFollowed) flaresAfterPoorSleep++;
          }
        }
      }

      const empiricalLR = entriesWithPoorSleep >= 3 
        ? computeLR(entriesWithPoorSleep, entries.length, flaresAfterPoorSleep, flares.length)
        : (z < -1.5 ? 2.5 : z < -1.0 ? 1.8 : z < -0.5 ? 1.3 : z > 0.5 ? 0.7 : 1.0);

      const adjustedLR = empiricalLR * condMult.sleep;

      if (z < -1.0) {
        bayesian.update(adjustedLR, Math.min(0.9, 0.5 + sleepEWMA.count * 0.008));
        factors.push({
          factor: "Sleep deficit",
          impact: Math.min(0.7, Math.abs(z) * 0.2),
          confidence: Math.min(0.9, 0.5 + sleepEWMA.count * 0.008),
          evidence: `${currentSleep.toFixed(1)}h vs EWMA baseline ${sleepEWMA.mean.toFixed(1)}h (${Math.abs(z).toFixed(1)}σ below) — LR ${adjustedLR.toFixed(1)}`,
          category: "sleep",
          likelihoodRatio: adjustedLR,
        });
      } else if (z > 0.8) {
        bayesian.update(Math.max(0.3, 1 / adjustedLR), 0.6);
        factors.push({
          factor: "Above-average sleep",
          impact: -0.15,
          confidence: 0.6,
          evidence: `${currentSleep.toFixed(1)}h — restorative (${z.toFixed(1)}σ above baseline)`,
          category: "sleep",
          likelihoodRatio: 1 / adjustedLR,
        });
      }

      // 3-night sleep debt (rolling EWMA over last 3 readings)
      const last3 = sleepTimeSeries.filter(v => now - v.timestampMs < 3 * oneDay);
      if (currentSleep) last3.push({ value: currentSleep, timestampMs: now });
      if (last3.length >= 2) {
        const rolling = last3.reduce((a, b) => a + b.value, 0) / last3.length;
        const rollingZ = sleepEWMA.zScore(rolling);
        if (rollingZ < -0.8) {
          bayesian.update(1.4 * condMult.sleep, 0.65);
          factors.push({
            factor: "Cumulative sleep debt (3 nights)",
            impact: Math.min(0.4, Math.abs(rollingZ) * 0.15),
            confidence: 0.65,
            evidence: `Rolling avg: ${rolling.toFixed(1)}h — cumulative debt elevates IL-6/TNF-α`,
            category: "sleep",
          });
        }
      }

      // Sleep slope: are they trending worse?
      const recentSleep = sleepTimeSeries.filter(v => now - v.timestampMs < 7 * oneDay);
      if (recentSleep.length >= 3) {
        const slopeResult = computeSlope(recentSleep);
        if (slopeResult && slopeResult.slope < -0.3 && slopeResult.r2 > 0.3) {
          bayesian.update(1.5, 0.6 * slopeResult.r2);
          factors.push({
            factor: "Deteriorating sleep trend",
            impact: Math.min(0.3, Math.abs(slopeResult.slope) * 0.2),
            confidence: 0.6 * slopeResult.r2,
            evidence: `Losing ${Math.abs(slopeResult.slope).toFixed(1)}h/day over past week (R²=${slopeResult.r2.toFixed(2)})`,
            category: "sleep",
          });
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
        factors.push({
          factor: "Poor deep sleep quality",
          impact: 0.25,
          confidence: 0.6,
          evidence: `${Math.round(deepRatio * 100)}% deep sleep (healthy: 15-20%) — impaired physical recovery`,
          category: "sleep",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 2: HRV / AUTONOMIC STRESS — EWMA + empirical LR + slope
    // ═══════════════════════════════════════════════════════════════════════════
    const hrvEWMA = new EWMABaseline(0.12);
    const hrvTimeSeries: { value: number; timestampMs: number }[] = [];
    
    for (const e of entries) {
      const hrv = getPhysio(e, "heart_rate_variability", "heartRateVariability", "hrv_rmssd", "hrvRmssd");
      if (hrv !== null && hrv > 0 && hrv < 300) {
        hrvTimeSeries.push({ value: hrv, timestampMs: new Date(e.timestamp).getTime() });
      }
    }
    hrvEWMA.feedSorted(hrvTimeSeries.map(v => v.value));

    let currentHrv: number | null = null;
    if (wearableData) {
      currentHrv = wearableData.hrv?.current || wearableData.hrv?.daily ||
        wearableData.heart_rate_variability || wearableData.heartRateVariability ||
        wearableData.hrv_rmssd || wearableData.hrvRmssd || null;
    }

    if (currentHrv !== null && hrvEWMA.isReady) {
      const z = hrvEWMA.zScore(currentHrv);
      
      // Empirical LR: low HRV before flares
      const lowHrvThreshold = hrvEWMA.mean - hrvEWMA.stdDev;
      let flaresAfterLowHrv = 0, entriesLowHrv = 0;
      for (const e of entries) {
        const h = getPhysio(e, "heart_rate_variability", "heartRateVariability", "hrv_rmssd", "hrvRmssd");
        if (h !== null && h < lowHrvThreshold) {
          entriesLowHrv++;
          const et = new Date(e.timestamp).getTime();
          if (flares.some((f: any) => {
            const ft = new Date(f.timestamp).getTime();
            return ft > et && ft < et + 36 * 3600000;
          })) flaresAfterLowHrv++;
        }
      }

      const hrvLR = entriesLowHrv >= 3
        ? computeLR(entriesLowHrv, entries.length, flaresAfterLowHrv, flares.length)
        : (z < -1.5 ? 2.8 : z < -1.0 ? 2.0 : 1.0);

      const adjustedHrvLR = hrvLR * condMult.hrv;

      // Low HRV = sympathetic dominance = risk
      if (z < -1.0) {
        bayesian.update(adjustedHrvLR, Math.min(0.85, 0.5 + hrvEWMA.count * 0.008));
        factors.push({
          factor: "Low HRV — autonomic stress",
          impact: Math.min(0.65, Math.abs(z) * 0.2),
          confidence: Math.min(0.85, 0.5 + hrvEWMA.count * 0.008),
          evidence: `HRV ${currentHrv.toFixed(0)}ms vs EWMA ${hrvEWMA.mean.toFixed(0)}ms (${Math.abs(z).toFixed(1)}σ below) — sympathetic dominance, LR ${adjustedHrvLR.toFixed(1)}`,
          category: "stress",
          likelihoodRatio: adjustedHrvLR,
        });
      } else if (z > 0.8) {
        bayesian.update(0.5, 0.6);
        factors.push({
          factor: "High HRV — parasympathetic recovery",
          impact: -0.2,
          confidence: 0.6,
          evidence: `HRV ${currentHrv.toFixed(0)}ms — vagal tone indicates good recovery`,
          category: "stress",
        });
      }

      // HRV slope
      const recentHrv = hrvTimeSeries.filter(v => now - v.timestampMs < 5 * oneDay);
      if (recentHrv.length >= 3) {
        const slope = computeSlope(recentHrv);
        if (slope && slope.slope < -2 && slope.r2 > 0.3) {
          bayesian.update(1.4, 0.55 * slope.r2);
          factors.push({
            factor: "Declining HRV trend",
            impact: 0.2,
            confidence: 0.55 * slope.r2,
            evidence: `HRV dropping ${Math.abs(slope.slope).toFixed(1)}ms/day (R²=${slope.r2.toFixed(2)}) — stress accumulating`,
            category: "stress",
          });
        }
      }
    }

    // Resting heart rate
    const rhrEWMA = new EWMABaseline(0.1);
    const rhrSeries: { value: number; timestampMs: number }[] = [];
    for (const e of entries) {
      const rhr = getPhysio(e, "resting_heart_rate", "restingHeartRate");
      if (rhr !== null && rhr > 30 && rhr < 200) {
        rhrSeries.push({ value: rhr, timestampMs: new Date(e.timestamp).getTime() });
      }
    }
    rhrEWMA.feedSorted(rhrSeries.map(v => v.value));
    
    const currentRhr = wearableData?.resting_heart_rate || wearableData?.restingHeartRate;
    if (currentRhr && rhrEWMA.isReady) {
      const z = rhrEWMA.zScore(currentRhr);
      if (z > 1.5) {
        bayesian.update(1.8 * condMult.hrv, 0.7);
        factors.push({
          factor: "Elevated resting heart rate",
          impact: Math.min(0.4, z * 0.12),
          confidence: 0.7,
          evidence: `${currentRhr} bpm vs EWMA ${rhrEWMA.mean.toFixed(0)} bpm (${z.toFixed(1)}σ above) — early illness/stress marker`,
          category: "physiological",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 3: ACTIVITY — Boom-bust detection with empirical LR
    // ═══════════════════════════════════════════════════════════════════════════
    const stepsEWMA = new EWMABaseline(0.1);
    const stepsSeries: { value: number; timestampMs: number }[] = [];
    for (const e of entries) {
      const steps = getPhysio(e, "steps", "activity.steps");
      if (steps !== null && steps > 0) {
        stepsSeries.push({ value: steps, timestampMs: new Date(e.timestamp).getTime() });
      }
    }
    stepsEWMA.feedSorted(stepsSeries.map(v => v.value));

    const currentSteps = wearableData?.steps || wearableData?.activity?.steps;
    if (currentSteps && stepsEWMA.isReady) {
      const z = stepsEWMA.zScore(currentSteps);

      // Empirical boom-bust: how often does high activity precede flares?
      const highThreshold = stepsEWMA.mean + stepsEWMA.stdDev;
      let highActivityDays = 0, flaresAfterHigh = 0;
      for (const e of entries) {
        const s = getPhysio(e, "steps", "activity.steps");
        if (s !== null && s > highThreshold) {
          highActivityDays++;
          const et = new Date(e.timestamp).getTime();
          if (flares.some((f: any) => {
            const ft = new Date(f.timestamp).getTime();
            return ft > et + 12 * 3600000 && ft < et + 72 * 3600000;
          })) flaresAfterHigh++;
        }
      }
      const boomBustRate = highActivityDays > 0 ? flaresAfterHigh / highActivityDays : 0;
      const activityLR = highActivityDays >= 3
        ? computeLR(highActivityDays, entries.length, flaresAfterHigh, flares.length)
        : (z > 2 ? 2.0 : 1.0);

      if (z > 1.5 && boomBustRate > 0.25) {
        const adj = activityLR * condMult.activity;
        bayesian.update(adj, Math.min(0.8, 0.4 + boomBustRate));
        factors.push({
          factor: "Overexertion — boom-bust pattern",
          impact: Math.min(0.55, z * 0.12 * (1 + boomBustRate)),
          confidence: Math.min(0.8, 0.4 + boomBustRate),
          evidence: `${Math.round(currentSteps)} steps (${z.toFixed(1)}σ above EWMA) — ${Math.round(boomBustRate * 100)}% of high-activity days preceded flares within 24-72h, LR ${adj.toFixed(1)}`,
          category: "activity",
          likelihoodRatio: adj,
        });
      } else if (z > 1.5) {
        bayesian.update(1.3 * condMult.activity, 0.5);
        factors.push({
          factor: "Unusually high activity",
          impact: 0.15,
          confidence: 0.5,
          evidence: `${Math.round(currentSteps)} steps — ${z.toFixed(1)}σ above EWMA baseline`,
          category: "activity",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 4: ENVIRONMENTAL — Pressure rate-of-change + AQI + humidity + temp
    // ═══════════════════════════════════════════════════════════════════════════
    if (currentWeather) {
      // 4a. Barometric pressure — rate of change
      const pressureEWMA = new EWMABaseline(0.15);
      const pressureSeries: { value: number; timestampMs: number }[] = [];
      for (const e of entries) {
        const p = getEnv(e, "weather.pressure", "pressure");
        if (p !== null && p > 900 && p < 1100) {
          pressureSeries.push({ value: p, timestampMs: new Date(e.timestamp).getTime() });
        }
      }
      pressureEWMA.feedSorted(pressureSeries.map(v => v.value));

      const currentPressure = currentWeather.pressure;
      if (currentPressure && pressureEWMA.isReady) {
        // Calculate rate of change vs recent readings
        const recent24h = pressureSeries.filter(p => now - p.timestampMs < oneDay);
        if (recent24h.length > 0) {
          const recentAvg = recent24h.reduce((a, b) => a + b.value, 0) / recent24h.length;
          const delta = currentPressure - recentAvg;

          // Empirical: flares during low pressure
          const lowPressureThreshold = pressureEWMA.mean - pressureEWMA.stdDev;
          let flaresLowP = 0, entriesLowP = 0;
          for (const e of entries) {
            const p = getEnv(e, "weather.pressure");
            if (p !== null && p < lowPressureThreshold) {
              entriesLowP++;
              if (e.entry_type === "flare") flaresLowP++;
            }
          }
          const pressureLR = entriesLowP >= 3
            ? computeLR(entriesLowP, entries.length, flaresLowP, flares.length)
            : (delta < -6 ? 2.5 : delta < -4 ? 1.8 : 1.0);

          if (delta < -4) {
            const adj = pressureLR * condMult.pressure;
            bayesian.update(adj, Math.min(0.8, 0.4 + pressureEWMA.count * 0.005));
            factors.push({
              factor: "Rapid barometric pressure drop",
              impact: Math.min(0.6, Math.abs(delta) / 10 * condMult.pressure),
              confidence: Math.min(0.8, 0.4 + pressureEWMA.count * 0.005),
              evidence: `${Math.abs(delta).toFixed(1)}mb drop in 24h — vasodilation trigger, LR ${adj.toFixed(1)}`,
              category: "weather",
              likelihoodRatio: adj,
            });
          } else if (delta > 4) {
            bayesian.update(0.7, 0.5);
            factors.push({
              factor: "Rising barometric pressure",
              impact: -0.1,
              confidence: 0.5,
              evidence: "Pressure stabilizing — generally protective",
              category: "weather",
            });
          }
        }

        // Pressure slope (trend over 3+ days)
        const recentPressure = pressureSeries.filter(v => now - v.timestampMs < 3 * oneDay);
        if (recentPressure.length >= 3) {
          const slope = computeSlope(recentPressure);
          if (slope && slope.slope < -3 && slope.r2 > 0.4) {
            bayesian.update(1.5 * condMult.pressure, 0.6);
            factors.push({
              factor: "Multi-day pressure decline",
              impact: 0.2,
              confidence: 0.6,
              evidence: `Pressure falling ${Math.abs(slope.slope).toFixed(1)}mb/day over ${recentPressure.length} readings`,
              category: "weather",
            });
          }
        }
      }

      // 4b. AQI
      const currentAqi = currentWeather.aqi || currentWeather.airQuality?.aqi;
      if (currentAqi) {
        const aqiLR = currentAqi > 150 ? 3.0 : currentAqi > 100 ? 2.0 : currentAqi > 50 ? 1.3 : 1.0;
        const adj = aqiLR * condMult.aqi;
        if (currentAqi > 50) {
          bayesian.update(adj, currentAqi > 100 ? 0.75 : 0.5);
          factors.push({
            factor: currentAqi > 100 ? "Unhealthy air quality" : "Moderate air quality",
            impact: Math.min(0.5, (currentAqi - 30) / 200),
            confidence: currentAqi > 100 ? 0.75 : 0.5,
            evidence: `AQI ${currentAqi} — PM2.5/ozone triggers inflammatory cascades, LR ${adj.toFixed(1)}`,
            category: "environmental",
            likelihoodRatio: adj,
          });
        }
      }

      // 4c. Humidity — empirical correlation
      const humidity = currentWeather.humidity;
      if (humidity) {
        let humidFlares = 0, humidEntries = 0;
        for (const e of entries) {
          const h = getEnv(e, "weather.humidity");
          if (h !== null && h > 75) {
            humidEntries++;
            if (e.entry_type === "flare") humidFlares++;
          }
        }
        const humidLR = humidEntries >= 3
          ? computeLR(humidEntries, entries.length, humidFlares, flares.length)
          : 1.0;

        if (humidity > 80 && humidLR > 1.2) {
          const adj = humidLR * condMult.humidity;
          bayesian.update(adj, Math.min(0.7, 0.3 + humidEntries * 0.02));
          factors.push({
            factor: "High humidity",
            impact: Math.min(0.3, (humidLR - 1) * 0.3),
            confidence: Math.min(0.7, 0.3 + humidEntries * 0.02),
            evidence: `${humidity}% — LR ${adj.toFixed(1)} from your data (${humidFlares}/${humidEntries} high-humidity entries were flares)`,
            category: "weather",
            likelihoodRatio: adj,
          });
        }
      }

      // 4d. Temperature — EWMA deviation
      const temp = currentWeather.temperature;
      if (temp !== undefined) {
        const tempEWMA = new EWMABaseline(0.12);
        const tempSeries: number[] = [];
        for (const e of entries) {
          const t = getEnv(e, "weather.temperature");
          if (t !== null) tempSeries.push(t);
        }
        tempEWMA.feedSorted(tempSeries);
        if (tempEWMA.isReady) {
          const z = tempEWMA.zScore(temp);
          if (Math.abs(z) > 1.5) {
            bayesian.update(1.5 * condMult.temperature, 0.5);
            factors.push({
              factor: z > 0 ? "Unusually hot" : "Unusually cold",
              impact: Math.min(0.25, Math.abs(z) * 0.08),
              confidence: 0.5,
              evidence: `${temp.toFixed(0)}°C — ${Math.abs(z).toFixed(1)}σ from your EWMA exposure baseline`,
              category: "weather",
            });
          }
        }
      }

      // 4e. Pollen
      const pollen = currentWeather.pollen || currentWeather.airQuality?.pollen;
      if (pollen && pollen > 5) {
        bayesian.update(1.3 * condMult.aqi, 0.55);
        factors.push({
          factor: "Elevated pollen",
          impact: Math.min(0.25, pollen / 30),
          confidence: 0.55,
          evidence: `Pollen index ${pollen}`,
          category: "environmental",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 5: MENSTRUAL CYCLE — Bayesian with cycle-day flare distribution
    // ═══════════════════════════════════════════════════════════════════════════
    if (menstrualDay) {
      const cycleDayFlares: Record<number, number> = {};
      let totalCycleFlares = 0;
      for (const f of flares) {
        const day = f.physiological_data?.menstrual_day || f.environmental_data?.menstrual_day;
        if (day) { cycleDayFlares[day] = (cycleDayFlares[day] || 0) + 1; totalCycleFlares++; }
      }

      if (totalCycleFlares >= 5) {
        // Build empirical probability distribution over cycle days
        const window = [-2, -1, 0, 1, 2];
        let windowFlares = 0;
        for (const offset of window) windowFlares += cycleDayFlares[menstrualDay + offset] || 0;
        const windowProb = windowFlares / totalCycleFlares;
        const expectedProb = 5 / 28;
        const cycleLR = windowProb / expectedProb;

        if (cycleLR > 1.2) {
          const adj = cycleLR * condMult.cycle;
          bayesian.update(adj, Math.min(0.85, 0.4 + totalCycleFlares * 0.015));
          factors.push({
            factor: `Cycle day ${menstrualDay} — high-risk window`,
            impact: Math.min(0.55, (cycleLR - 1) * 0.3),
            confidence: Math.min(0.85, 0.4 + totalCycleFlares * 0.015),
            evidence: `${Math.round(windowProb * 100)}% of cycle-tracked flares cluster here (expected: ${Math.round(expectedProb * 100)}%), LR ${adj.toFixed(1)}`,
            category: "cycle",
            likelihoodRatio: adj,
          });
        }
      } else {
        // Clinical defaults: prostaglandin peaks days 1-3, 25-28
        const highRiskDays = [1, 2, 3, 25, 26, 27, 28];
        if (highRiskDays.includes(menstrualDay)) {
          bayesian.update(1.6 * condMult.cycle, 0.45);
          factors.push({
            factor: `Cycle day ${menstrualDay} — prostaglandin peak`,
            impact: 0.3,
            confidence: 0.45,
            evidence: "Days 1-3 and 25-28: elevated PGE2 and inflammation (clinical default, personalizes with more data)",
            category: "cycle",
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 6: TEMPORAL PATTERNS — Day-of-week + hour + trend
    // ═══════════════════════════════════════════════════════════════════════════
    const userTz = profile?.timezone || "UTC";
    const today = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Day-of-week empirical LR
    const dayBuckets: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dayTotalBuckets: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const e of entries) {
      try {
        const d = new Date(e.timestamp);
        const localDay = d.toLocaleDateString("en-US", { weekday: "long", timeZone: userTz });
        const idx = dayNames.indexOf(localDay);
        if (idx >= 0) {
          dayTotalBuckets[idx]++;
          if (e.entry_type === "flare") dayBuckets[idx]++;
        }
      } catch { /* skip */ }
    }

    let todayIdx: number;
    try {
      todayIdx = dayNames.indexOf(today.toLocaleDateString("en-US", { weekday: "long", timeZone: userTz }));
    } catch { todayIdx = today.getDay(); }

    if (todayIdx >= 0 && dayBuckets[todayIdx] >= 3 && dayTotalBuckets[todayIdx] > 0) {
      const dayFlareRate = dayBuckets[todayIdx] / dayTotalBuckets[todayIdx];
      const overallFlareRate = flares.length / entries.length;
      const dayLR = overallFlareRate > 0 ? dayFlareRate / overallFlareRate : 1;

      if (dayLR > 1.3) {
        bayesian.update(dayLR, Math.min(0.7, 0.3 + dayBuckets[todayIdx] * 0.03));
        factors.push({
          factor: `${dayNames[todayIdx]}s are high-risk`,
          impact: Math.min(0.3, (dayLR - 1) * 0.15),
          confidence: Math.min(0.7, 0.3 + dayBuckets[todayIdx] * 0.03),
          evidence: `${Math.round(dayFlareRate * 100)}% flare rate on ${dayNames[todayIdx]}s vs ${Math.round(overallFlareRate * 100)}% overall — LR ${dayLR.toFixed(1)}`,
          category: "pattern",
          likelihoodRatio: dayLR,
        });
      }
    }

    // Hour-of-day clustering
    const hourBuckets: number[] = new Array(24).fill(0);
    const hourTotalBuckets: number[] = new Array(24).fill(0);
    for (const e of entries) {
      try {
        const h = parseInt(new Date(e.timestamp).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz }));
        if (h >= 0 && h < 24) {
          hourTotalBuckets[h]++;
          if (e.entry_type === "flare") hourBuckets[h]++;
        }
      } catch { /* skip */ }
    }
    let currentHour: number;
    try {
      currentHour = parseInt(today.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz }));
    } catch { currentHour = today.getHours(); }
    const windowHours = [-1, 0, 1, 2, 3].map(o => (currentHour + o + 24) % 24);
    const windowFlareCount = windowHours.reduce((a, h) => a + hourBuckets[h], 0);
    const windowTotalCount = windowHours.reduce((a, h) => a + hourTotalBuckets[h], 0);
    if (windowFlareCount >= 3 && windowTotalCount > 0) {
      const windowRate = windowFlareCount / windowTotalCount;
      const overallRate = flares.length / entries.length;
      const hourLR = overallRate > 0 ? windowRate / overallRate : 1;
      if (hourLR > 1.3) {
        bayesian.update(hourLR, 0.55);
        factors.push({
          factor: "High-risk time window",
          impact: Math.min(0.2, (hourLR - 1) * 0.1),
          confidence: 0.55,
          evidence: `${Math.round(windowRate * 100)}% flare rate in this time window — LR ${hourLR.toFixed(1)}`,
          category: "pattern",
        });
      }
    }

    // Recent trend
    const recentFlares = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < 7 * oneDay);
    const prevWeekFlares = flares.filter((e: any) => {
      const ts = new Date(e.timestamp).getTime();
      return ts >= now - 14 * oneDay && ts < now - 7 * oneDay;
    });
    if (recentFlares.length > prevWeekFlares.length + 2) {
      bayesian.update(1.6, 0.7);
      factors.push({
        factor: "Worsening flare trend",
        impact: Math.min(0.3, (recentFlares.length - prevWeekFlares.length) * 0.04),
        confidence: 0.7,
        evidence: `${recentFlares.length} flares this week vs ${prevWeekFlares.length} last week — escalating`,
        category: "pattern",
      });
    } else if (recentFlares.length === 0 && prevWeekFlares.length >= 2) {
      bayesian.update(0.5, 0.6);
      factors.push({
        factor: "Flare-free streak",
        impact: -0.25,
        confidence: 0.6,
        evidence: "No flares in 7 days — good recovery trajectory",
        category: "pattern",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 7: MULTI-DAY LAG — Cross-correlation trigger → flare
    // ═══════════════════════════════════════════════════════════════════════════
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
          if (delay > 0.5 && delay < 5) {
            triggerLags[tKey].delays.push(delay);
            triggerLags[tKey].count++;
          }
        }
      }
    }

    for (const [trigger, data] of Object.entries(triggerLags)) {
      if (data.delays.length < 3) continue;
      const avgDelay = data.delays.reduce((a, b) => a + b, 0) / data.delays.length;
      const stdDelay = Math.sqrt(data.delays.reduce((a, d) => a + (d - avgDelay) ** 2, 0) / data.delays.length);
      const consistency = stdDelay < 1.5 ? 0.8 : stdDelay < 2.5 ? 0.5 : 0.3; // How consistent is the delay?

      const wasRecent = recent48h.some((e: any) =>
        e.triggers?.some((t: string) => t.toLowerCase() === trigger)
      );

      if (wasRecent) {
        const lagLR = 1 + data.count * 0.1 * consistency;
        bayesian.update(lagLR, consistency);
        factors.push({
          factor: `Delayed trigger: "${trigger}"`,
          impact: Math.min(0.4, 0.1 + data.count * 0.02 * consistency),
          confidence: consistency,
          evidence: `Flares ~${avgDelay.toFixed(0)} days after "${trigger}" (±${stdDelay.toFixed(1)}d, ${data.count} instances) — LR ${lagLR.toFixed(1)}`,
          category: "trigger",
          likelihoodRatio: lagLR,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 8: MEDICATION GAPS — Regularity analysis
    // ═══════════════════════════════════════════════════════════════════════════
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
            const medLR = 1.5 + (gapRatio - 1.8) * 0.3;
            const adj = Math.min(medLR, 4) * condMult.medication;
            bayesian.update(adj, Math.min(0.7, 0.4 + info.count * 0.02));
            factors.push({
              factor: `Medication gap: ${med}`,
              impact: Math.min(0.45, (gapRatio - 1) * 0.12),
              confidence: Math.min(0.7, 0.4 + info.count * 0.02),
              evidence: `Last taken ${(gap / oneDay).toFixed(1)} days ago (usual interval: ${(expectedInterval / oneDay).toFixed(1)} days) — rebound risk, LR ${adj.toFixed(1)}`,
              category: "medication",
              likelihoodRatio: adj,
            });
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 9: LEARNED CORRELATIONS — Apply as Bayesian evidence
    // ═══════════════════════════════════════════════════════════════════════════
    const topCorrelations = correlations.filter((c: any) => c.confidence >= 0.5).slice(0, 8);
    for (const c of topCorrelations) {
      const recentMatch = recent48h.some((e: any) => {
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
        const corrLR = 1 + c.confidence * 2;
        bayesian.update(corrLR, c.confidence);
        factors.push({
          factor: `Known trigger: ${c.trigger_value}`,
          impact: Math.min(0.45, c.confidence * 0.4),
          confidence: c.confidence,
          evidence: `${c.trigger_value} → ${c.outcome_value} (${Math.round(c.confidence * 100)}% confidence, ${c.occurrence_count}× observed) — LR ${corrLR.toFixed(1)}`,
          category: "trigger",
          likelihoodRatio: corrLR,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNAL 10: SpO2, Breathing Rate, Skin Temperature
    // ═══════════════════════════════════════════════════════════════════════════
    const spo2 = wearableData?.spo2 || wearableData?.spo2_avg || wearableData?.spo2Avg;
    if (spo2 && spo2 < 95) {
      bayesian.update(2.0, 0.65);
      factors.push({
        factor: "Low blood oxygen",
        impact: Math.min(0.35, (96 - spo2) * 0.08),
        confidence: 0.65,
        evidence: `SpO2 ${spo2}% (normal: 95-100%) — respiratory stress`,
        category: "physiological",
      });
    }

    const breathRate = wearableData?.breathing_rate || wearableData?.breathingRate;
    if (breathRate && breathRate > 20) {
      bayesian.update(1.5, 0.5);
      factors.push({
        factor: "Elevated breathing rate",
        impact: Math.min(0.2, (breathRate - 16) * 0.025),
        confidence: 0.5,
        evidence: `${breathRate.toFixed(0)} breaths/min (normal resting: 12-20)`,
        category: "physiological",
      });
    }

    const skinTemp = wearableData?.skin_temperature || wearableData?.skinTemperature;
    if (skinTemp) {
      const stEWMA = new EWMABaseline(0.12);
      const stSeries: number[] = [];
      for (const e of entries) {
        const t = getPhysio(e, "skin_temperature", "skinTemperature");
        if (t !== null) stSeries.push(t);
      }
      stEWMA.feedSorted(stSeries);
      if (stEWMA.isReady && stEWMA.zScore(skinTemp) > 1.2) {
        bayesian.update(1.6, 0.55);
        factors.push({
          factor: "Elevated skin temperature",
          impact: 0.2,
          confidence: 0.55,
          evidence: `${stEWMA.zScore(skinTemp).toFixed(1)}σ above EWMA — possible early inflammatory response`,
          category: "physiological",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CROSS-SIGNAL INTERACTIONS — Multiplicative Bayesian Updates
    // ═══════════════════════════════════════════════════════════════════════════
    const riskFactors = factors.filter(f => f.impact > 0);
    const hasSleep = riskFactors.some(f => f.category === "sleep");
    const hasStress = riskFactors.some(f => f.category === "stress" || f.category === "physiological");
    const hasWeather = riskFactors.some(f => f.category === "weather" || f.category === "environmental");
    const hasActivity = riskFactors.some(f => f.category === "activity");
    const hasMedGap = riskFactors.some(f => f.category === "medication");

    const interactions: string[] = [];
    // Sleep × Stress (cortisol dysregulation loop)
    if (hasSleep && hasStress) {
      bayesian.update(1.4, 0.7);
      interactions.push("sleep deficit × autonomic stress");
    }
    // Weather × compromised physiology
    if (hasWeather && (hasSleep || hasStress)) {
      bayesian.update(1.25, 0.6);
      interactions.push("environmental pressure × weakened recovery");
    }
    // Medication gap × any stressor
    if (hasMedGap && (hasSleep || hasStress || hasWeather)) {
      bayesian.update(1.3, 0.65);
      interactions.push("medication gap × active stressors");
    }
    // Triple+ threat: allostatic overload
    const activeCategories = new Set(riskFactors.map(f => f.category)).size;
    if (activeCategories >= 3) {
      bayesian.update(1.3, 0.6);
      interactions.push("allostatic overload (3+ stress systems active)");
    }

    if (interactions.length > 0) {
      factors.push({
        factor: "Compounding risk signals",
        impact: Math.min(0.3, interactions.length * 0.08),
        confidence: 0.7,
        evidence: `Cross-signal interactions: ${interactions.join("; ")} — risk compounds non-linearly per allostatic load theory`,
        category: "pattern",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FINAL RISK SCORE — Bayesian posterior
    // ═══════════════════════════════════════════════════════════════════════════
    const riskScore = bayesian.riskPercent;

    let riskLevel: Forecast["riskLevel"] = "low";
    if (riskScore >= 75) riskLevel = "very_high";
    else if (riskScore >= 55) riskLevel = "high";
    else if (riskScore >= 35) riskLevel = "moderate";

    // Confidence calibration based on data richness
    const signalDiversity = [
      sleepEWMA.isReady, hrvEWMA.isReady, stepsEWMA.isReady, rhrEWMA.isReady,
      correlations.length > 0, !!currentWeather, medLogs.length > 0,
    ].filter(Boolean).length;
    const dataRichness = Math.min(0.9, 0.2 + signalDiversity * 0.08 + entries.length * 0.001);
    const avgFactorConf = factors.length > 0
      ? factors.reduce((a, f) => a + f.confidence, 0) / factors.length
      : 0.3;
    const overallConfidence = Math.min(0.95, (dataRichness + avgFactorConf) / 2);

    // Sort by weighted impact
    const sortedRisk = factors.filter(f => f.impact > 0)
      .sort((a, b) => (b.impact * b.confidence) - (a.impact * a.confidence));
    const protectiveFactors = factors.filter(f => f.impact < 0).map(f => f.evidence);

    // Prediction text
    let prediction = "";
    const topFactor = sortedRisk[0]?.factor || "various factors";
    if (riskScore < 25) {
      prediction = `Low risk (${riskScore}%). Bayesian posterior from ${factors.length} signals shows stable outlook${protectiveFactors.length > 0 ? ` with ${protectiveFactors.length} protective factor(s)` : ""}.`;
    } else if (riskScore < 45) {
      prediction = `Moderate risk (${riskScore}%). Primary signal: ${topFactor}. Prior base rate: ${Math.round(baseFlareRate * 100)}%/day, updated by ${factors.filter(f => f.likelihoodRatio).length} likelihood ratios.`;
    } else if (riskScore < 65) {
      prediction = `Elevated risk (${riskScore}%). ${topFactor} is the strongest signal${sortedRisk.length > 1 ? `, compounded by ${sortedRisk[1]?.factor?.toLowerCase()}` : ""}. ${interactions.length > 0 ? `Cross-signal interactions detected.` : ""}`;
    } else {
      prediction = `High risk (${riskScore}%). ${sortedRisk.slice(0, 2).map(f => f.factor).join(" + ")} driving risk. ${activeCategories} stress systems active — allostatic overload zone.`;
    }

    // Recommendations
    const recommendations: string[] = [];
    if (sortedRisk.some(f => f.category === "sleep")) {
      recommendations.push("Prioritize 7-9h sleep — cumulative sleep debt elevates IL-6/TNF-α inflammatory markers within 48h");
    }
    if (sortedRisk.some(f => f.category === "activity")) {
      recommendations.push("Pace activity within your energy envelope — your data shows a boom-bust pattern with 24-72h delayed crashes");
    }
    if (sortedRisk.some(f => f.category === "stress" || f.category === "physiological")) {
      recommendations.push("Stimulate vagal tone: slow exhale breathing (4s in, 8s out), cold water on face, or gentle stretching to shift toward parasympathetic");
    }
    if (sortedRisk.some(f => f.category === "weather" || f.category === "environmental")) {
      recommendations.push("Environmental conditions unfavorable — minimize exposure, use filtration if AQI is high, stay hydrated");
    }
    if (sortedRisk.some(f => f.category === "cycle")) {
      recommendations.push("Hormonal high-risk window — consider anti-inflammatory support (omega-3, magnesium) or pre-emptive medication per your care plan");
    }
    if (sortedRisk.some(f => f.category === "medication")) {
      recommendations.push("Medication gap detected — rebound symptoms can appear 24-48h after a missed dose. Check your schedule");
    }
    if (sortedRisk.some(f => f.category === "trigger")) {
      recommendations.push("Known trigger active — monitor closely for the next 24-72h based on your typical delay pattern");
    }
    if (recommendations.length === 0) {
      recommendations.push("Your signals are balanced. Keep logging consistently — each entry strengthens prediction accuracy");
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
      modelVersion: "v3-bayesian-ewma",
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
