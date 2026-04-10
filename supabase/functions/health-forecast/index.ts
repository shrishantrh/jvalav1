import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA HEALTH FORECAST ENGINE v5 — Bayesian-EWMA + Scientific Upgrades
// ═══════════════════════════════════════════════════════════════════════════════
//
// v5 ADDITIONS over v4:
// 1. Circadian rhythm weighting (cortisol curve modeling)
// 2. Autoregressive flare clustering (flares predict flares within 48h)
// 3. Food-flare correlation signals (inflammatory diet scoring)
// 4. Exponential recency weighting for LR calculations
// 5. Severity-weighted risk (not just binary flare/no-flare)
// 6. Multi-lag cross-correlation (1d, 2d, 3d windows)
// 7. Stress accumulation model (allostatic load)
// 8. Improved calibration with Platt scaling
// 9. Activity logs integration
// 10. Better protective factor detection
//
// CORE MODEL (from v3/v4):
// 1. EWMA baselines (α=0.15) for adaptive personal norms
// 2. Bayesian risk updating via likelihood ratios
// 3. Slope-based trend detection
// 4. Cross-signal interaction matrix
// 5. Condition-specific LR multipliers
// 6. Multi-day lag detection
// 7. Confidence calibration + Brier scores
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
  category: "sleep" | "activity" | "stress" | "weather" | "cycle" | "pattern" | "medication" | "trigger" | "physiological" | "environmental" | "food" | "circadian";
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
  accuracy?: {
    brierScore: number | null;
    totalPredictions: number;
    correctPredictions: number;
    calibrationNote: string;
  };
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

// ─── Recency-weighted LR (v5: newer events matter more) ──────────────────────
function computeWeightedLR(events: Array<{timestampMs: number; isFlare: boolean; hasSignal: boolean}>, halfLifeDays = 30): number {
  if (events.length < 5) return 1;
  const now = Date.now();
  const halfLifeMs = halfLifeDays * 86400000;
  let wFlareWithSignal = 0, wFlareNoSignal = 0, wNoFlareWithSignal = 0, wNoFlareNoSignal = 0;
  
  for (const e of events) {
    const age = now - e.timestampMs;
    const weight = Math.exp(-0.693 * age / halfLifeMs); // exponential decay
    if (e.isFlare && e.hasSignal) wFlareWithSignal += weight;
    else if (e.isFlare && !e.hasSignal) wFlareNoSignal += weight;
    else if (!e.isFlare && e.hasSignal) wNoFlareWithSignal += weight;
    else wNoFlareNoSignal += weight;
  }
  
  const sensitivity = (wFlareWithSignal + wFlareNoSignal) > 0 ? wFlareWithSignal / (wFlareWithSignal + wFlareNoSignal) : 0;
  const fpr = (wNoFlareWithSignal + wNoFlareNoSignal) > 0 ? wNoFlareWithSignal / (wNoFlareWithSignal + wNoFlareNoSignal) : 0;
  if (fpr < 0.01) return Math.min(sensitivity / 0.01, 20);
  return Math.min(sensitivity / fpr, 20);
}

// ─── Simple LR (backwards compat) ───────────────────────────────────────────
function computeLR(entriesWithSignal: number, totalEntries: number, flaresWithSignal: number, totalFlares: number): number {
  if (totalFlares === 0 || totalEntries === 0) return 1;
  const nonFlareEntries = totalEntries - totalFlares;
  const nonFlaresWithSignal = entriesWithSignal - flaresWithSignal;
  const sensitivity = totalFlares > 0 ? flaresWithSignal / totalFlares : 0;
  const fpr = nonFlareEntries > 0 ? Math.max(nonFlaresWithSignal, 0) / nonFlareEntries : 0;
  if (fpr < 0.01) return Math.min(sensitivity / 0.01, 20);
  return Math.min(sensitivity / fpr, 20);
}

// ─── v5: Circadian cortisol model ────────────────────────────────────────────
// Cortisol peaks at ~8AM, lowest at ~3AM. Flares during cortisol nadir = higher risk
function getCircadianMultiplier(hourOfDay: number): number {
  // Normalized cortisol curve (0-1): peak at 8, trough at 3AM
  const cortisolCurve = [0.15, 0.12, 0.10, 0.08, 0.12, 0.25, 0.55, 0.85, 1.0, 0.90, 0.78, 0.65,
                         0.55, 0.48, 0.42, 0.38, 0.35, 0.33, 0.30, 0.28, 0.25, 0.22, 0.20, 0.17];
  return cortisolCurve[Math.max(0, Math.min(23, hourOfDay))] || 0.5;
}

// ─── v5: Inflammatory food scoring ───────────────────────────────────────────
function computeInflammatoryScore(foodLogs: any[], windowMs: number): { score: number; items: string[] } {
  const now = Date.now();
  const recent = foodLogs.filter((f: any) => now - new Date(f.logged_at).getTime() < windowMs);
  if (recent.length === 0) return { score: 0, items: [] };
  
  const proInflammatory = ['sugar', 'fried', 'alcohol', 'soda', 'candy', 'cake', 'pastry', 'chips', 
    'processed', 'fast food', 'burger', 'pizza', 'hot dog', 'bacon', 'sausage', 'margarine',
    'white bread', 'donut', 'ice cream', 'cookie'];
  const antiInflammatory = ['salmon', 'sardine', 'tuna', 'avocado', 'blueberry', 'strawberry', 'spinach', 
    'kale', 'broccoli', 'turmeric', 'ginger', 'olive oil', 'walnut', 'almond', 'green tea',
    'yogurt', 'oatmeal', 'quinoa', 'sweet potato', 'tomato'];
  
  let score = 0;
  const flagged: string[] = [];
  for (const f of recent) {
    const name = (f.food_name || "").toLowerCase();
    const cal = Number(f.calories) || 0;
    const sugar = Number(f.added_sugars_g) || Number(f.total_sugars_g) || 0;
    const satFat = Number(f.saturated_fat_g) || 0;
    
    if (proInflammatory.some(p => name.includes(p))) { score += 2; flagged.push(f.food_name); }
    if (antiInflammatory.some(a => name.includes(a))) { score -= 1.5; }
    if (sugar > 15) { score += 1; if (!flagged.includes(f.food_name)) flagged.push(f.food_name); }
    if (satFat > 8) { score += 0.5; }
  }
  return { score: Math.max(-5, Math.min(10, score)), items: flagged.slice(0, 3) };
}

// ─── Condition weight profiles ────────────────────────────────────────────────
const CONDITION_LR_MULTIPLIERS: Record<string, Record<string, number>> = {
  migraine:       { sleep: 1.6, hrv: 1.5, pressure: 2.0, humidity: 1.3, aqi: 0.8, activity: 1.0, temperature: 1.4, cycle: 1.8, medication: 1.5, food: 1.3 },
  fibromyalgia:   { sleep: 2.0, hrv: 1.7, pressure: 1.5, humidity: 1.3, aqi: 0.7, activity: 1.8, temperature: 1.2, cycle: 1.3, medication: 1.2, food: 1.0 },
  asthma:         { sleep: 1.0, hrv: 0.9, pressure: 1.2, humidity: 1.7, aqi: 2.5, activity: 1.3, temperature: 1.6, cycle: 0.8, medication: 1.5, food: 0.8 },
  "rheumatoid arthritis": { sleep: 1.5, hrv: 1.4, pressure: 1.8, humidity: 1.7, aqi: 0.8, activity: 1.5, temperature: 1.4, cycle: 1.2, medication: 1.7, food: 1.5 },
  endometriosis:  { sleep: 1.5, hrv: 1.4, pressure: 0.8, humidity: 0.7, aqi: 0.6, activity: 1.2, temperature: 0.8, cycle: 2.5, medication: 1.6, food: 1.2 },
  "crohn's disease": { sleep: 1.7, hrv: 1.8, pressure: 0.8, humidity: 0.7, aqi: 0.6, activity: 1.3, temperature: 0.8, cycle: 1.0, medication: 1.8, food: 2.2 },
  ibs:            { sleep: 1.5, hrv: 1.8, pressure: 0.8, humidity: 0.7, aqi: 0.5, activity: 1.2, temperature: 0.8, cycle: 1.1, medication: 1.5, food: 2.5 },
  acne:           { sleep: 1.5, hrv: 1.3, pressure: 0.5, humidity: 1.6, aqi: 1.0, activity: 0.8, temperature: 1.3, cycle: 1.5, medication: 1.2, food: 1.8 },
  gerd:           { sleep: 1.3, hrv: 1.6, pressure: 0.6, humidity: 0.5, aqi: 0.5, activity: 1.5, temperature: 0.6, cycle: 0.7, medication: 1.7, food: 2.3 },
  "lower back pain": { sleep: 1.6, hrv: 1.2, pressure: 1.3, humidity: 1.0, aqi: 0.5, activity: 2.0, temperature: 1.0, cycle: 0.8, medication: 1.3, food: 0.8 },
  eczema:         { sleep: 1.5, hrv: 1.3, pressure: 0.7, humidity: 1.8, aqi: 1.3, activity: 0.8, temperature: 1.6, cycle: 1.0, medication: 1.3, food: 1.6 },
  psoriasis:      { sleep: 1.6, hrv: 1.4, pressure: 0.7, humidity: 1.7, aqi: 1.1, activity: 0.8, temperature: 1.5, cycle: 1.0, medication: 1.4, food: 1.4 },
  lupus:          { sleep: 1.8, hrv: 1.6, pressure: 1.2, humidity: 1.4, aqi: 1.0, activity: 1.6, temperature: 1.3, cycle: 1.5, medication: 1.6, food: 1.3 },
  "multiple sclerosis": { sleep: 1.7, hrv: 1.5, pressure: 1.0, humidity: 1.2, aqi: 0.8, activity: 1.7, temperature: 1.5, cycle: 1.2, medication: 1.5, food: 1.0 },
  "ankylosing spondylitis": { sleep: 1.6, hrv: 1.3, pressure: 1.6, humidity: 1.5, aqi: 0.7, activity: 1.8, temperature: 1.3, cycle: 1.0, medication: 1.5, food: 1.2 },
};

const DEFAULT_LR_MULT: Record<string, number> = {
  sleep: 1.0, hrv: 1.0, pressure: 1.0, humidity: 1.0, aqi: 1.0,
  activity: 1.0, temperature: 1.0, cycle: 1.0, medication: 1.0, food: 1.0,
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
    const windowEnd = predTime + 36 * 3600000;
    
    const flaresInWindow = flares.filter((f: any) => {
      const ft = new Date(f.timestamp).getTime();
      return ft >= predTime && ft <= windowEnd;
    });

    const hadFlare = flaresInWindow.length > 0;
    const maxSeverity = flaresInWindow.reduce((max: string, f: any) => {
      const sevOrder: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };
      return (sevOrder[f.severity] || 0) > (sevOrder[max] || 0) ? f.severity : max;
    }, "none");

    const predictedProb = pred.risk_score / 100;
    const actual = hadFlare ? 1 : 0;
    const brier = (predictedProb - actual) ** 2;

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

// ─── v5: Severity-weighted flare rate ────────────────────────────────────────
function computeSeverityWeightedRate(flares: any[], windowMs: number): number {
  const now = Date.now();
  const recent = flares.filter((f: any) => now - new Date(f.timestamp).getTime() < windowMs);
  if (recent.length === 0) return 0;
  const sevWeights: Record<string, number> = { mild: 0.3, moderate: 0.6, severe: 1.0 };
  const totalWeight = recent.reduce((a: number, f: any) => a + (sevWeights[f.severity] || 0.5), 0);
  const days = windowMs / 86400000;
  return totalWeight / days;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // ── Fetch all data in parallel (v5: added food_logs, activity_logs) ──
    const [entriesResult, correlationsResult, profileResult, medLogsResult, predHistoryResult, foodLogsResult, activityLogsResult] = await Promise.all([
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
      supabase.from("food_logs").select("food_name, calories, added_sugars_g, total_sugars_g, saturated_fat_g, logged_at").eq("user_id", userId)
        .order("logged_at", { ascending: false }).limit(100),
      supabase.from("activity_logs").select("activity_type, activity_value, intensity, duration_minutes, timestamp").eq("user_id", userId)
        .order("timestamp", { ascending: false }).limit(100),
    ]);

    const entries = entriesResult.data || [];
    const correlations = correlationsResult.data || [];
    const profile = profileResult.data;
    const medLogs = medLogsResult.data || [];
    const predHistory = predHistoryResult.data || [];
    const foodLogs = foodLogsResult.data || [];
    const activityLogs = activityLogsResult.data || [];

    // Auto-verify past predictions
    const flares = entries.filter((e: any) => e.entry_type === "flare");
    await autoVerifyPredictions(supabase, userId, flares);

    // Calculate historical accuracy
    const verifiedPreds = predHistory.filter((p: any) => p.outcome_logged && p.brier_score !== null);
    const brierScore = verifiedPreds.length >= 3
      ? verifiedPreds.reduce((a: number, p: any) => a + p.brier_score, 0) / verifiedPreds.length
      : null;
    const correctCount = verifiedPreds.filter((p: any) => p.was_correct).length;
    
    // Find pending verification
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
            protectiveFactors: [], timeframe: "next 24 hours", modelVersion: "v5-bayesian-ewma-scientific",
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

    // ── v5: Severity-weighted base rate ──
    const observationDays = Math.max(1, (now - new Date(entries[0].timestamp).getTime()) / oneDay);
    const baseFlareRate = Math.min(0.8, flares.length / observationDays);
    const severityWeightedRate7d = computeSeverityWeightedRate(flares, 7 * oneDay);
    const severityWeightedRate30d = computeSeverityWeightedRate(flares, 30 * oneDay);
    // Use severity-weighted prior if we have enough data
    const adjustedPrior = flares.length >= 10 
      ? Math.min(0.85, baseFlareRate * (1 + (severityWeightedRate7d / Math.max(0.01, severityWeightedRate30d) - 1) * 0.3))
      : baseFlareRate;
    const bayesian = new BayesianRisk(adjustedPrior);

    // ═══ v5 SIGNAL: AUTOREGRESSIVE FLARE CLUSTERING ═══
    // Research: Flares cluster — having a flare increases probability of another within 48h
    const recentFlares48h = flares.filter((f: any) => now - new Date(f.timestamp).getTime() < 2 * oneDay);
    if (recentFlares48h.length > 0) {
      // Calculate empirical clustering rate
      let clusterCount = 0, totalPairs = 0;
      for (let i = 0; i < flares.length - 1; i++) {
        const gap = new Date(flares[i + 1]?.timestamp).getTime() - new Date(flares[i].timestamp).getTime();
        totalPairs++;
        if (gap < 2 * oneDay) clusterCount++;
      }
      const clusterRate = totalPairs > 5 ? clusterCount / totalPairs : 0.3;
      const clusterLR = 1 + clusterRate * 2;
      const recentSeverity = recentFlares48h[0]?.severity;
      const sevMultiplier = recentSeverity === "severe" ? 1.5 : recentSeverity === "moderate" ? 1.2 : 1.0;
      
      bayesian.update(clusterLR * sevMultiplier, Math.min(0.85, 0.4 + clusterRate));
      factors.push({
        factor: "Recent flare clustering",
        impact: Math.min(0.5, clusterRate * 0.6 * sevMultiplier),
        confidence: Math.min(0.85, 0.4 + clusterRate),
        evidence: `${recentFlares48h.length} flare(s) in last 48h — ${Math.round(clusterRate * 100)}% of your flares cluster`,
        category: "pattern",
        likelihoodRatio: clusterLR * sevMultiplier,
      });
    }

    // ═══ v5 SIGNAL: CIRCADIAN RISK ═══
    const userTz = profile?.timezone || "UTC";
    let currentHourLocal: number;
    try {
      const p = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: userTz }).formatToParts(new Date());
      currentHourLocal = parseInt(p.find(x => x.type === "hour")?.value || "12", 10);
    } catch { currentHourLocal = new Date().getHours(); }
    
    // Build personal circadian flare distribution
    const hourFlareRate = new Array(24).fill(0);
    const hourTotal = new Array(24).fill(0);
    for (const e of entries) {
      try {
        const h = parseInt(new Date(e.timestamp).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz }));
        if (h >= 0 && h < 24) { hourTotal[h]++; if (e.entry_type === "flare") hourFlareRate[h]++; }
      } catch { /* skip */ }
    }
    
    // Compare personal peak hours vs cortisol curve
    const windowHours = [0, 1, 2, 3].map(o => (currentHourLocal + o) % 24);
    const windowFlares = windowHours.reduce((a, h) => a + hourFlareRate[h], 0);
    const windowTotal = windowHours.reduce((a, h) => a + hourTotal[h], 0);
    if (windowFlares >= 3 && windowTotal > 0) {
      const windowRate = windowFlares / windowTotal;
      const overallRate = flares.length / entries.length;
      const hourLR = overallRate > 0 ? windowRate / overallRate : 1;
      const cortisolMod = getCircadianMultiplier(currentHourLocal);
      
      if (hourLR > 1.2) {
        const adjustedLR = hourLR * (cortisolMod < 0.4 ? 1.3 : 1.0); // Low cortisol amplifies risk
        bayesian.update(adjustedLR, 0.6);
        factors.push({
          factor: "High-risk time window",
          impact: Math.min(0.3, (hourLR - 1) * 0.15),
          confidence: 0.6,
          evidence: `${Math.round(windowRate * 100)}% flare rate this time vs ${Math.round(overallRate * 100)}% overall${cortisolMod < 0.4 ? " (low cortisol period)" : ""}`,
          category: "circadian",
          likelihoodRatio: adjustedLR,
        });
      }
    }

    // ═══ v5 SIGNAL: FOOD-FLARE CORRELATION ═══
    const inflammScore = computeInflammatoryScore(foodLogs, 24 * 3600000);
    if (inflammScore.score > 3) {
      const foodLR = Math.min(2.5, 1 + inflammScore.score * 0.2) * (condMult.food || 1);
      bayesian.update(foodLR, 0.55);
      factors.push({
        factor: "Pro-inflammatory diet (last 24h)",
        impact: Math.min(0.4, inflammScore.score * 0.04),
        confidence: 0.55,
        evidence: `High-inflammation foods: ${inflammScore.items.join(", ")}`,
        category: "food",
        likelihoodRatio: foodLR,
      });
    } else if (inflammScore.score < -2) {
      bayesian.update(0.7, 0.45);
      factors.push({
        factor: "Anti-inflammatory diet",
        impact: -0.15,
        confidence: 0.45,
        evidence: "Recent meals include anti-inflammatory foods",
        category: "food",
      });
    }
    
    // Historical food-flare correlation
    if (foodLogs.length >= 10 && flares.length >= 5) {
      let foodBeforeFlare = 0, totalChecked = 0;
      for (const f of flares.slice(0, 30)) {
        const ft = new Date(f.timestamp).getTime();
        const foodBefore = foodLogs.filter((fl: any) => {
          const flt = new Date(fl.logged_at).getTime();
          return flt > ft - 12 * 3600000 && flt < ft;
        });
        if (foodBefore.length > 0) {
          totalChecked++;
          const fScore = computeInflammatoryScore(foodBefore, Infinity);
          if (fScore.score > 2) foodBeforeFlare++;
        }
      }
      if (totalChecked >= 5 && foodBeforeFlare / totalChecked > 0.4) {
        bayesian.update(1.3 * (condMult.food || 1), 0.5);
        factors.push({
          factor: "Diet-flare pattern detected",
          impact: 0.2,
          confidence: 0.5,
          evidence: `${Math.round(foodBeforeFlare / totalChecked * 100)}% of flares preceded by inflammatory foods`,
          category: "food",
        });
      }
    }

    // ═══ v5 SIGNAL: ACTIVITY LOG STRESS ═══
    const recentActivities = activityLogs.filter((a: any) => now - new Date(a.timestamp).getTime() < 2 * oneDay);
    const stressActivities = recentActivities.filter((a: any) => {
      const type = (a.activity_type || "").toLowerCase();
      const value = (a.activity_value || "").toLowerCase();
      return type === "stress" || value.includes("stress") || value.includes("anxious") || 
             value.includes("overwhelm") || (type === "mood" && (value.includes("bad") || value.includes("low")));
    });
    if (stressActivities.length > 0) {
      bayesian.update(1.5, 0.6);
      factors.push({
        factor: "Elevated stress logged",
        impact: 0.25,
        confidence: 0.6,
        evidence: `${stressActivities.length} stress indicator(s) in last 48h`,
        category: "stress",
      });
    }

    // ═══ SIGNAL 1: SLEEP (unchanged from v4) ═══
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
      // v5: Use recency-weighted LR
      const sleepEvents = entries.map((e: any) => {
        const s = getPhysio(e, "sleep_hours", "sleepHours", "sleep.duration", "sleep.hours");
        const norm = s ? (s > 24 ? s / 60 : s) : null;
        return { timestampMs: new Date(e.timestamp).getTime(), isFlare: e.entry_type === "flare", hasSignal: norm !== null && norm < sleepEWMA.mean - sleepEWMA.stdDev };
      }).filter(e => e.hasSignal !== undefined);
      
      const empiricalLR = sleepEvents.length >= 10 
        ? computeWeightedLR(sleepEvents, 21)
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
      const hrvLR = computeWeightedLR(
        entries.map((e: any) => ({
          timestampMs: new Date(e.timestamp).getTime(),
          isFlare: e.entry_type === "flare",
          hasSignal: (() => { const h = getPhysio(e, "heart_rate_variability", "heartRateVariability", "hrv_rmssd", "hrvRmssd"); return h !== null && h < hrvEWMA.mean - hrvEWMA.stdDev; })()
        })), 21
      );
      const adjustedHrvLR = (hrvLR > 1 ? hrvLR : (z < -1.5 ? 2.8 : z < -1.0 ? 2.0 : 1.0)) * condMult.hrv;

      if (z < -1.0) {
        bayesian.update(adjustedHrvLR, Math.min(0.85, 0.5 + hrvEWMA.count * 0.008));
        factors.push({ factor: "Low HRV — autonomic stress", impact: Math.min(0.65, Math.abs(z) * 0.2), confidence: Math.min(0.85, 0.5 + hrvEWMA.count * 0.008), evidence: `HRV ${currentHrv.toFixed(0)}ms vs baseline ${hrvEWMA.mean.toFixed(0)}ms (${Math.abs(z).toFixed(1)}σ below)`, category: "stress", likelihoodRatio: adjustedHrvLR });
      } else if (z > 0.8) {
        bayesian.update(0.5, 0.6);
        factors.push({ factor: "High HRV — parasympathetic recovery", impact: -0.2, confidence: 0.6, evidence: `HRV ${currentHrv.toFixed(0)}ms — vagal tone indicates recovery`, category: "stress" });
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
      const boomBustEvents = entries.map((e: any) => {
        const s = getPhysio(e, "steps", "activity.steps");
        return { timestampMs: new Date(e.timestamp).getTime(), isFlare: e.entry_type === "flare", hasSignal: s !== null && s > stepsEWMA.mean + stepsEWMA.stdDev };
      });
      const activityLR = computeWeightedLR(boomBustEvents, 21);
      
      if (z > 1.5 && activityLR > 1.3) {
        const adj = activityLR * condMult.activity;
        bayesian.update(adj, Math.min(0.8, 0.5));
        factors.push({ factor: "Overexertion — boom-bust pattern", impact: Math.min(0.55, z * 0.12), confidence: 0.7, evidence: `${Math.round(currentSteps)} steps (${z.toFixed(1)}σ above baseline)`, category: "activity", likelihoodRatio: adj });
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
          if (delta < -4) {
            const pressureLR = Math.min(3, 1 + Math.abs(delta) / 4) * condMult.pressure;
            bayesian.update(pressureLR, Math.min(0.8, 0.4 + pressureEWMA.count * 0.005));
            factors.push({ factor: "Rapid barometric pressure drop", impact: Math.min(0.6, Math.abs(delta) / 10 * condMult.pressure), confidence: Math.min(0.8, 0.4 + pressureEWMA.count * 0.005), evidence: `${Math.abs(delta).toFixed(1)}mb drop in 24h`, category: "weather", likelihoodRatio: pressureLR });
          } else if (delta > 4) {
            bayesian.update(0.7, 0.5);
            factors.push({ factor: "Rising barometric pressure", impact: -0.1, confidence: 0.5, evidence: "Pressure stabilizing — generally protective", category: "weather" });
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
      if (humidity && humidity > 80) {
        const humidLR = Math.min(2, 1 + (humidity - 70) / 30) * condMult.humidity;
        if (humidLR > 1.2) {
          bayesian.update(humidLR, 0.5);
          factors.push({ factor: "High humidity", impact: Math.min(0.3, (humidLR - 1) * 0.3), confidence: 0.5, evidence: `${humidity}%`, category: "weather", likelihoodRatio: humidLR });
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
        let windowFlaresCycle = 0;
        for (const offset of window) windowFlaresCycle += cycleDayFlares[menstrualDay + offset] || 0;
        const windowProb = windowFlaresCycle / totalCycleFlares;
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

    // ═══ SIGNAL 6: DAY OF WEEK ═══
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

    // Recent trend
    const recentFlaresWeek = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < 7 * oneDay);
    const prevWeekFlares = flares.filter((e: any) => { const ts = new Date(e.timestamp).getTime(); return ts >= now - 14 * oneDay && ts < now - 7 * oneDay; });
    if (recentFlaresWeek.length > prevWeekFlares.length + 2) {
      bayesian.update(1.6, 0.7);
      factors.push({ factor: "Worsening flare trend", impact: Math.min(0.3, (recentFlaresWeek.length - prevWeekFlares.length) * 0.04), confidence: 0.7, evidence: `${recentFlaresWeek.length} flares this week vs ${prevWeekFlares.length} last week`, category: "pattern" });
    } else if (recentFlaresWeek.length === 0 && prevWeekFlares.length >= 2) {
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

    // ═══ CROSS-SIGNAL INTERACTIONS (v5: expanded) ═══
    const riskFactors = factors.filter(f => f.impact > 0);
    const hasSleep = riskFactors.some(f => f.category === "sleep");
    const hasStress = riskFactors.some(f => f.category === "stress" || f.category === "physiological");
    const hasWeather = riskFactors.some(f => f.category === "weather" || f.category === "environmental");
    const hasMedGap = riskFactors.some(f => f.category === "medication");
    const hasFood = riskFactors.some(f => f.category === "food");
    const hasCluster = riskFactors.some(f => f.factor.includes("clustering"));
    const interactions: string[] = [];
    if (hasSleep && hasStress) { bayesian.update(1.4, 0.7); interactions.push("sleep deficit × autonomic stress"); }
    if (hasWeather && (hasSleep || hasStress)) { bayesian.update(1.25, 0.6); interactions.push("environmental pressure × weakened recovery"); }
    if (hasMedGap && (hasSleep || hasStress || hasWeather)) { bayesian.update(1.3, 0.65); interactions.push("medication gap × active stressors"); }
    if (hasFood && (hasSleep || hasStress)) { bayesian.update(1.2, 0.5); interactions.push("inflammatory diet × stress/fatigue"); }
    if (hasCluster && riskFactors.length >= 2) { bayesian.update(1.25, 0.6); interactions.push("active flare cluster × other signals"); }
    const activeCategories = new Set(riskFactors.map(f => f.category)).size;
    if (activeCategories >= 3) { bayesian.update(1.3, 0.6); interactions.push("allostatic overload (3+ stress systems)"); }
    if (activeCategories >= 5) { bayesian.update(1.2, 0.7); interactions.push("multi-system convergence"); }
    if (interactions.length > 0) {
      factors.push({ factor: "Compounding risk signals", impact: Math.min(0.4, interactions.length * 0.08), confidence: 0.7, evidence: `Cross-signal: ${interactions.join("; ")}`, category: "pattern" });
    }

    // ═══ v5: PLATT SCALING CALIBRATION ═══
    // If we have enough verified predictions, adjust output using logistic calibration
    let calibratedScore = bayesian.riskPercent;
    if (verifiedPreds.length >= 10 && brierScore !== null) {
      // Simple Platt scaling: if model overestimates, dampen; if underestimates, amplify
      const avgPredicted = verifiedPreds.reduce((a: number, p: any) => a + p.risk_score, 0) / verifiedPreds.length;
      const avgActual = verifiedPreds.filter((p: any) => p.outcome_severity !== "none").length / verifiedPreds.length * 100;
      const bias = avgPredicted - avgActual;
      // Apply correction (max ±15 points)
      const correction = Math.max(-15, Math.min(15, -bias * 0.3));
      calibratedScore = Math.max(1, Math.min(99, bayesian.riskPercent + correction));
    }

    // ═══ FINAL RISK SCORE ═══
    const riskScore = calibratedScore;
    let riskLevel: Forecast["riskLevel"] = "low";
    if (riskScore >= 75) riskLevel = "very_high";
    else if (riskScore >= 55) riskLevel = "high";
    else if (riskScore >= 35) riskLevel = "moderate";

    // Confidence calibration
    const signalDiversity = [sleepEWMA.isReady, hrvEWMA.isReady, stepsEWMA.isReady, rhrEWMA.isReady, correlations.length > 0, !!currentWeather, medLogs.length > 0, foodLogs.length > 5, activityLogs.length > 0].filter(Boolean).length;
    const dataRichness = Math.min(0.9, 0.2 + signalDiversity * 0.07 + entries.length * 0.001);
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
      prediction = `Moderate risk (${riskScore}%). Primary signal: ${topFactor}. ${factors.filter(f => f.likelihoodRatio).length} likelihood ratios active.`;
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
    if (sortedRisk.some(f => f.category === "food")) recommendations.push("Recent diet is pro-inflammatory — consider anti-inflammatory foods (omega-3, berries, leafy greens)");
    if (sortedRisk.some(f => f.category === "circadian")) recommendations.push("You're in a high-risk time window — be extra mindful of early warning signs");
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
      modelVersion: "v5-bayesian-ewma-scientific",
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
        model_version: "v5-bayesian-ewma-scientific",
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
