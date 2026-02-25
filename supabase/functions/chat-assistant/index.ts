import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA SMART HEALTH COMPANION - PROFESSIONAL GRADE AI ASSISTANT
// ═══════════════════════════════════════════════════════════════════════════════
// Version 2.0 - Complete rewrite with 100+ improvements
// Built following industry best practices for health AI assistants
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

type Severity = "mild" | "moderate" | "severe";

interface EntryData {
  type: "flare" | "medication" | "trigger" | "recovery" | "energy" | "note";
  severity?: Severity;
  symptoms?: string[];
  medications?: string[];
  triggers?: string[];
  energyLevel?: string;
  notes?: string;
}

interface Visualization {
  type: string;
  title: string;
  data: any[];
  insight?: string;
}

interface AssistantReply {
  response: string;
  shouldLog: boolean;
  entryData: EntryData | null;
  visualization: Visualization | null;
  interactiveForm?: any;
  confidence?: number;
  evidenceSources?: string[];
  suggestedFollowUp?: string;
  actionableInsights?: string[];
  emotionalTone?: "supportive" | "celebratory" | "concerned" | "neutral" | "encouraging";
}

interface ChatRequest {
  message: string;
  userSymptoms?: string[];
  userConditions?: string[];
  history?: { role: "user" | "assistant"; content: string }[];
  userId?: string;
}

interface UserContext {
  profile: any;
  entries: any[];
  medications: any[];
  correlations: any[];
  engagement: any;
  recentNotes: string[];
}

interface AnalyzedData {
  flareSummary: FlareSummary;
  bodyMetrics: BodyMetrics;
  trends: TrendAnalysis;
  riskFactors: RiskFactor[];
  positivePatterns: string[];
  concerns: string[];
  conversationContext: ConversationContext;
}

interface FlareSummary {
  total: number;
  thisWeek: { count: number; avgSeverity: number | null; trend: "up" | "down" | "stable" };
  lastWeek: { count: number; avgSeverity: number | null };
  thisMonth: { count: number; avgSeverity: number | null };
  lastMonth: { count: number; avgSeverity: number | null };
  severityCounts: { mild: number; moderate: number; severe: number; unknown: number };
  avgSeverity: number | null;
  daysSinceLast: number | null;
  lastFlareDate: string | null;
  topSymptoms: { name: string; count: number; recentTrend: "increasing" | "stable" | "decreasing" }[];
  topTriggers: { name: string; count: number; avgDelayHours?: number }[];
  peakTimeOfDay: { period: string; count: number; percentage: number };
  peakDayOfWeek: { day: string; count: number; percentage: number };
  hourBuckets: Record<string, number>;
  dayCounts: Record<string, number>;
  weatherCorrelations: { condition: string; count: number; avgSeverity: number }[];
  recentEntries: any[];
  streakData: { currentFlareFree: number; longestFlareFree: number };
}

interface BodyMetrics {
  hasData: boolean;
  entriesWithData: number;
  heartRate: { avg: number | null; duringFlares: number | null; baseline: number | null };
  hrv: { avg: number | null; duringFlares: number | null; baseline: number | null };
  sleep: { avgHours: number | null; duringFlares: number | null; qualityScore: number | null };
  steps: { avg: number | null; duringFlares: number | null };
  stress: { avg: number | null; duringFlares: number | null };
  correlations: { metric: string; correlation: "positive" | "negative" | "none"; strength: number }[];
}

interface TrendAnalysis {
  frequencyTrend: "improving" | "worsening" | "stable";
  severityTrend: "improving" | "worsening" | "stable";
  weekOverWeekChange: number;
  monthOverMonthChange: number;
  bestPeriod: { start: string; end: string; flareCount: number } | null;
  worstPeriod: { start: string; end: string; flareCount: number } | null;
  seasonalPattern: string | null;
}

interface RiskFactor {
  factor: string;
  riskLevel: "high" | "medium" | "low";
  evidence: string;
  suggestion: string;
}

interface ConversationContext {
  isFirstMessage: boolean;
  recentTopics: string[];
  userMood: "positive" | "negative" | "neutral" | "distressed" | "curious";
  conversationDepth: number;
  previousQuestions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const replyJson = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clamp = (str: unknown, max = 2000): string => {
  const s = typeof str === "string" ? str : String(str ?? "");
  return s.length > max ? s.slice(0, max) : s;
};

const toNum = (v: any): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const avg = (arr: number[]): number | null =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

const median = (arr: number[]): number | null => {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const percentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const severityToScore = (sev: string | null): number | null => {
  if (!sev) return null;
  const map: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };
  return map[sev] ?? null;
};

const scoreToSeverity = (score: number): string => {
  if (score < 1.5) return "mild";
  if (score < 2.5) return "moderate";
  return "severe";
};

const formatDate = (d: Date): string => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const formatTime = (d: Date): string => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// Timezone-aware hour extraction — crucial for accurate time-of-day analysis
const getLocalHour = (d: Date, tz?: string): number => {
  if (!tz) return d.getUTCHours();
  try {
    const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).formatToParts(d);
    const hourPart = parts.find(p => p.type === "hour");
    return hourPart ? parseInt(hourPart.value, 10) : d.getUTCHours();
  } catch { return d.getUTCHours(); }
};

const getLocalDayShort = (d: Date, tz?: string): string => {
  if (!tz) return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(d);
  } catch { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]; }
};

const getTimeOfDay = (hour: number): string => {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
};

const getDayName = (d: Date): string => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
const getDayShort = (d: Date): string => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED EXTRACTION DICTIONARIES
// ─────────────────────────────────────────────────────────────────────────────

const SYMPTOM_CATEGORIES = {
  neurological: ["headache", "migraine", "dizziness", "vertigo", "brain fog", "confusion", "numbness", "tingling", "tremor", "seizure", "aura", "light sensitivity", "sound sensitivity", "tinnitus", "blurred vision"],
  pain: ["pain", "ache", "aching", "throbbing", "stabbing", "burning", "cramping", "cramps", "stiffness", "tension", "soreness", "tenderness"],
  fatigue: ["fatigue", "tired", "exhausted", "weakness", "lethargy", "malaise", "drowsy", "low energy", "drained", "sick", "feeling sick", "unwell"],
  digestive: ["nausea", "nauseous", "vomiting", "bloating", "stomach pain", "indigestion", "diarrhea", "constipation", "appetite loss", "acid reflux"],
  respiratory: ["shortness of breath", "chest tightness", "wheezing", "coughing", "cough", "congestion", "sore throat", "runny nose", "sneezing", "sinus"],
  cardiovascular: ["palpitations", "racing heart", "chest pain", "irregular heartbeat"],
  musculoskeletal: ["joint pain", "muscle pain", "back pain", "neck pain", "shoulder pain", "knee pain", "hip pain", "stiff joints", "swelling", "inflammation"],
  skin: ["rash", "itching", "hives", "flushing", "sweating", "dry skin", "pallor"],
  mental: ["anxiety", "anxious", "depression", "mood swings", "irritability", "crying", "panic", "restless", "overwhelmed", "stressed"],
  sleep: ["insomnia", "trouble sleeping", "restless sleep", "nightmares", "sleep apnea", "waking up tired"],
  sensory: ["sensitivity", "hypersensitivity", "dry eyes", "watery eyes", "ear pain"],
  temperature: ["hot flash", "chills", "fever", "sweating", "cold hands", "cold feet"],
};

const TRIGGER_CATEGORIES = {
  stress: ["stress", "stressed", "anxiety", "worry", "overwhelmed", "pressure", "tension", "emotional", "upset", "argument", "conflict"],
  sleep: ["lack of sleep", "poor sleep", "bad sleep", "insomnia", "oversleeping", "irregular sleep", "late night", "early morning"],
  food: ["alcohol", "caffeine", "coffee", "sugar", "chocolate", "processed food", "gluten", "dairy", "msg", "artificial sweeteners", "aged cheese", "red wine", "citrus", "nuts", "soy", "eggs", "shellfish", "spicy food", "fried food"],
  environment: ["weather", "weather change", "barometric pressure", "humidity", "heat", "cold", "bright light", "fluorescent light", "loud noise", "strong smell", "perfume", "smoke", "pollution", "allergens", "pollen", "dust", "mold"],
  physical: ["exercise", "overexertion", "sitting too long", "standing too long", "poor posture", "travel", "flying", "dehydration", "skipped meal", "fasting", "hunger"],
  hormonal: ["hormones", "period", "menstruation", "ovulation", "pms", "menopause", "pregnancy"],
  lifestyle: ["overwork", "screen time", "late night", "irregular schedule", "jet lag", "lack of routine"],
  medication: ["missed medication", "new medication", "medication change", "withdrawal"],
};

const MEDICATION_PATTERNS = {
  pain: ["ibuprofen", "advil", "motrin", "tylenol", "acetaminophen", "aspirin", "naproxen", "aleve", "excedrin", "tramadol", "oxycodone", "hydrocodone"],
  migraine: ["sumatriptan", "imitrex", "rizatriptan", "maxalt", "zolmitriptan", "zomig", "eletriptan", "relpax", "frovatriptan", "frova", "naratriptan", "amerge", "ubrelvy", "nurtec", "aimovig", "ajovy", "emgality"],
  preventive: ["topiramate", "topamax", "amitriptyline", "nortriptyline", "propranolol", "metoprolol", "verapamil", "valproate", "depakote", "gabapentin", "pregabalin", "lyrica", "botox"],
  antiInflammatory: ["prednisone", "steroids", "methylprednisolone", "dexamethasone", "nsaids", "celecoxib", "celebrex"],
  antihistamine: ["antihistamine", "benadryl", "diphenhydramine", "zyrtec", "cetirizine", "claritin", "loratadine", "allegra", "fexofenadine"],
  sleep: ["melatonin", "ambien", "zolpidem", "trazodone", "doxepin"],
  supplements: ["magnesium", "b2", "riboflavin", "coq10", "butterbur", "feverfew", "vitamin d", "omega 3", "fish oil", "turmeric"],
  cannabis: ["cbd", "thc", "cannabis", "marijuana", "medical marijuana"],
  antiNausea: ["zofran", "ondansetron", "phenergan", "promethazine", "reglan", "metoclopramide"],
  muscle: ["flexeril", "cyclobenzaprine", "baclofen", "tizanidine", "methocarbamol"],
};

// Flatten for quick lookup
const ALL_SYMPTOMS = Object.values(SYMPTOM_CATEGORIES).flat();
const ALL_TRIGGERS = Object.values(TRIGGER_CATEGORIES).flat();
const ALL_MEDICATIONS = Object.values(MEDICATION_PATTERNS).flat();

// ─────────────────────────────────────────────────────────────────────────────
// INTELLIGENT EXTRACTION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function extractSymptoms(text: string): { symptoms: string[]; categories: string[] } {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const categories = new Set<string>();

  for (const [category, symptoms] of Object.entries(SYMPTOM_CATEGORIES)) {
    for (const symptom of symptoms) {
      if (lower.includes(symptom)) {
        found.push(symptom.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" "));
        categories.add(category);
      }
    }
  }

  return { symptoms: [...new Set(found)], categories: [...categories] };
}

function extractTriggers(text: string): { triggers: string[]; categories: string[] } {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const categories = new Set<string>();

  for (const [category, triggers] of Object.entries(TRIGGER_CATEGORIES)) {
    for (const trigger of triggers) {
      if (lower.includes(trigger)) {
        found.push(trigger.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" "));
        categories.add(category);
      }
    }
  }

  return { triggers: [...new Set(found)], categories: [...categories] };
}

function extractMedications(text: string): { medications: string[]; categories: string[] } {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const categories = new Set<string>();

  for (const [category, meds] of Object.entries(MEDICATION_PATTERNS)) {
    for (const med of meds) {
      if (lower.includes(med)) {
        found.push(med.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" "));
        categories.add(category);
      }
    }
  }

  return { medications: [...new Set(found)], categories: [...categories] };
}

function detectSeverity(text: string): Severity | null {
  const lower = text.toLowerCase();
  
  const severePatterns = [
    /\b(severe|terrible|awful|worst|unbearable|excruciating|intense|debilitating|crippling|incapacitating)\b/,
    /\b(10|9|8)\/10\b/,
    /\b(really|so|very) bad\b/,
    /can'?t (function|work|think|move|see)/,
    /\bhospital\b/,
    /\bemergency\b/,
  ];
  
  const moderatePatterns = [
    /\b(moderate|bad|significant|noticeable|uncomfortable|rough|difficult)\b/,
    /\b(7|6|5)\/10\b/,
    /\bnot (great|good)\b/,
    /\bstruggling\b/,
    /\bhard to (function|work|concentrate)\b/,
  ];
  
  const mildPatterns = [
    /\b(mild|slight|little|minor|small|light|manageable|tolerable|okay|bearable)\b/,
    /\b(1|2|3|4)\/10\b/,
    /\bnot too bad\b/,
    /\bcould be worse\b/,
  ];

  for (const pattern of severePatterns) if (pattern.test(lower)) return "severe";
  for (const pattern of moderatePatterns) if (pattern.test(lower)) return "moderate";
  for (const pattern of mildPatterns) if (pattern.test(lower)) return "mild";
  
  return null;
}

function detectEnergyLevel(text: string): string | null {
  const lower = text.toLowerCase();
  
  const levels: Record<string, RegExp[]> = {
    "very_low": [/\b(exhausted|drained|wiped|no energy|zero energy|completely tired)\b/, /can'?t (get up|move|function)/],
    "low": [/\b(tired|fatigued|sluggish|low energy|drowsy|lethargic)\b/],
    "moderate": [/\b(okay|alright|moderate energy|some energy|decent)\b/],
    "high": [/\b(good energy|energetic|active|productive)\b/],
    "very_high": [/\b(great|amazing|full of energy|very energetic|excellent)\b/],
  };

  for (const [level, patterns] of Object.entries(levels)) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) return level;
    }
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION - MULTI-DIMENSIONAL
// ─────────────────────────────────────────────────────────────────────────────

interface UserIntent {
  primary: string;
  secondary: string[];
  confidence: number;
  emotionalState: "distressed" | "curious" | "frustrated" | "hopeful" | "neutral" | "celebratory";
  requiresEmpathy: boolean;
  isSymptomReport: boolean;
  seekingValidation: boolean;
  wantsActionableAdvice: boolean;
}

function analyzeIntent(message: string, history: { role: string; content: string }[]): UserIntent {
  const lower = message.toLowerCase().trim();
  const words = lower.split(/\s+/);
  
  // Emotional state detection
  const distressPatterns = [
    /\b(help|struggling|scared|worried|anxious|terrified|desperate|hopeless|can'?t cope)\b/,
    /\b(what('?s| is) (wrong|happening))\b/,
    /\bi don'?t know what to do\b/,
    /\bthis is (terrible|awful|unbearable)\b/,
  ];
  
  const frustrationPatterns = [
    /\b(frustrated|annoyed|tired of|sick of|nothing works|useless)\b/,
    /\bwhy (won'?t|doesn'?t|can'?t)\b/,
    /\bstill (having|getting|experiencing)\b/,
  ];
  
  const curiousPatterns = [
    /\b(why|how|what|when|which|where|tell me|explain|understand|curious|wondering)\b/,
    /\b(is it|could it be|might it be|do you think)\b/,
  ];
  
  const hopefulPatterns = [
    /\b(better|improving|fewer|less|progress|working|helped)\b/,
    /\b(good day|great day|feeling good)\b/,
  ];

  const celebratoryPatterns = [
    /\b(great|amazing|wonderful|fantastic|no flares|flare.?free|best|record)\b/,
    /\b(finally|worked|success)\b/,
  ];

  let emotionalState: UserIntent["emotionalState"] = "neutral";
  let requiresEmpathy = false;
  
  if (distressPatterns.some(p => p.test(lower))) {
    emotionalState = "distressed";
    requiresEmpathy = true;
  } else if (frustrationPatterns.some(p => p.test(lower))) {
    emotionalState = "frustrated";
    requiresEmpathy = true;
  } else if (celebratoryPatterns.some(p => p.test(lower))) {
    emotionalState = "celebratory";
  } else if (hopefulPatterns.some(p => p.test(lower))) {
    emotionalState = "hopeful";
  } else if (curiousPatterns.some(p => p.test(lower))) {
    emotionalState = "curious";
  }

  // Intent detection patterns
  const intents: Record<string, RegExp[]> = {
    symptom_report: [
      /\bi (have|'m having|am having|'ve got|got|feel|'m feeling|am feeling)\b/,
      /\b(experiencing|suffering|dealing with)\b/,
      /\bmy (head|neck|back|stomach|joints?|muscles?)\b/,
      /\b(hurts|aching|throbbing|burning)\b/,
      /\bwoke up with\b/,
      /\bstarted (having|getting|feeling)\b/,
    ],
    medication_report: [
      /\b(took|taking|just (took|had)|popped|used|applied|started)\b/,
    ],
    pattern_inquiry: [
      /\b(pattern|trend|insight|notice|seeing|correlation|connect|relate|analyze|analysis)\b/,
      /\bwhat (do you|are you) (see|notice|think)\b/,
      /\bwhat('?s| is) (causing|triggering|behind)\b/,
    ],
    advice_request: [
      /\b(recommend|suggestion|advice|should i|what (can|should) i|help me|tips?|how (can|do) i)\b/,
      /\bwhat (would you|do you) (suggest|recommend|think)\b/,
      /\bany (ideas?|thoughts?|suggestions?)\b/,
    ],
    comparison: [
      /\b(compar|vs|versus|this week|last week|this month|last month|better|worse|than before|progress|improvement)\b/,
    ],
    history_inquiry: [
      /\b(history|recent|last|previous|past|when did|how many|count|total|all my|show me)\b/,
    ],
    body_metrics: [
      /\b(body|wearable|heart ?rate|hrv|sleep|steps|spo2|blood oxygen|temperature|stress|physio|biometrics|vitals|fitbit|oura|apple watch|garmin)\b/,
    ],
    weather_inquiry: [
      /\b(weather|rain|sunny|cloudy|humidity|pressure|barometric|temperature|climate|season)\b/,
    ],
    time_analysis: [
      /\b(time|when|morning|afternoon|evening|night|day of week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend)\b/,
    ],
    greeting: [
      /^(hi|hello|hey|yo|sup|good (morning|afternoon|evening)|morning|afternoon|evening)\b/,
    ],
    gratitude: [
      /\b(thank|thanks|appreciate|helpful|great job|good job|well done)\b/,
    ],
    clarification: [
      /\b(what do you mean|can you explain|i don'?t understand|clarify|elaborate|more detail)\b/,
    ],
    emotional_support: [
      /\b(scared|worried|anxious|stressed|overwhelmed|frustrated|tired of|sick of|depressed|sad|lonely|hopeless)\b/,
    ],
    mindful_observation: [
      /\b(mindful|be mindful|watch out|aware|pay attention|look out|careful|notice)\b/,
      /\bwhat should i (watch|look|be|pay)\b/,
    ],
    general_question: [
      /\b(what|how|why|when|where|who|which|is it|can you|could you|would you|do you)\b/,
    ],
  };

  // Score each intent
  const scores: Record<string, number> = {};
  for (const [intent, patterns] of Object.entries(intents)) {
    scores[intent] = patterns.filter(p => p.test(lower)).length;
  }

  // Boost scores based on extracted content
  const { symptoms } = extractSymptoms(message);
  const { medications } = extractMedications(message);
  
  if (symptoms.length > 0) scores.symptom_report = (scores.symptom_report || 0) + 2;
  if (medications.length > 0 && /\b(took|taking|just|started)\b/.test(lower)) scores.medication_report = (scores.medication_report || 0) + 2;

  // Find primary and secondary intents
  const sorted = Object.entries(scores).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0]?.[0] || "general_question";
  const secondary = sorted.slice(1, 4).map(([k]) => k);
  
  // Confidence based on how clear the intent is
  const topScore = sorted[0]?.[1] || 0;
  const confidence = Math.min(0.95, 0.5 + (topScore * 0.15));

  // Check if seeking validation
  const seekingValidation = /\b(normal|okay|common|others?|anyone else|is this|should i be worried)\b/.test(lower);
  
  // Check if wanting actionable advice
  const wantsActionableAdvice = /\b(what (can|should)|how (can|do)|any (tips|suggestions|advice)|help me|recommend)\b/.test(lower);

  return {
    primary,
    secondary,
    confidence,
    emotionalState,
    requiresEmpathy,
    isSymptomReport: scores.symptom_report > 0 || symptoms.length > 0,
    seekingValidation,
    wantsActionableAdvice,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA ANALYSIS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function analyzeFlares(entries: any[], userTimezone?: string): FlareSummary {
  const flares = entries.filter(e => e?.entry_type === "flare");
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  
  // Initialize counters
  const sevCounts = { mild: 0, moderate: 0, severe: 0, unknown: 0 };
  const symptomCounts: Record<string, { count: number; recentCount: number; dates: number[] }> = {};
  const triggerCounts: Record<string, { count: number; delayMinutes: number[] }> = {};
  const hourBuckets: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const dayCounts: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  const weatherData: Record<string, { count: number; severities: number[] }> = {};
  const sevScores: number[] = [];
  
  // Time period buckets
  const thisWeekFlares: any[] = [];
  const lastWeekFlares: any[] = [];
  const twoWeeksAgoFlares: any[] = [];
  const thisMonthFlares: any[] = [];
  const lastMonthFlares: any[] = [];
  
  // Streak tracking
  let currentFlareFree = 0;
  let longestFlareFree = 0;
  let lastFlareTime: number | null = null;
  
  // Sort by timestamp descending
  const sortedFlares = [...flares].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Calculate flare-free streak
  if (sortedFlares.length > 0) {
    lastFlareTime = new Date(sortedFlares[0].timestamp).getTime();
    currentFlareFree = Math.floor((now - lastFlareTime) / oneDay);
    
    // Calculate longest flare-free period
    for (let i = 0; i < sortedFlares.length - 1; i++) {
      const gap = new Date(sortedFlares[i].timestamp).getTime() - new Date(sortedFlares[i + 1].timestamp).getTime();
      const gapDays = Math.floor(gap / oneDay);
      if (gapDays > longestFlareFree) longestFlareFree = gapDays;
    }
  }

  for (const e of flares) {
    const sev = e?.severity as string | null;
    if (sev === "mild" || sev === "moderate" || sev === "severe") sevCounts[sev]++;
    else sevCounts.unknown++;

    const score = severityToScore(sev);
    if (score != null) sevScores.push(score);

    // Symptoms with trend tracking
    const symptoms = e?.symptoms ?? [];
    const ts = new Date(e.timestamp).getTime();
    for (const s of symptoms) {
      if (!symptomCounts[s]) symptomCounts[s] = { count: 0, recentCount: 0, dates: [] };
      symptomCounts[s].count++;
      symptomCounts[s].dates.push(ts);
      if (now - ts < 14 * oneDay) symptomCounts[s].recentCount++;
    }

    // Triggers with timing
    for (const t of e?.triggers ?? []) {
      if (!triggerCounts[t]) triggerCounts[t] = { count: 0, delayMinutes: [] };
      triggerCounts[t].count++;
    }

    const d = new Date(e.timestamp);
    const hour = getLocalHour(d, userTimezone);
    hourBuckets[getTimeOfDay(hour)]++;
    const dayKey = getLocalDayShort(d, userTimezone);
    if (dayCounts[dayKey] !== undefined) dayCounts[dayKey]++;

    // Weather correlation
    const weather = e?.environmental_data?.weather?.condition || e?.environmental_data?.condition;
    if (typeof weather === "string" && weather.trim()) {
      if (!weatherData[weather]) weatherData[weather] = { count: 0, severities: [] };
      weatherData[weather].count++;
      if (score) weatherData[weather].severities.push(score);
    }

    // Time period buckets
    const timeDiff = now - ts;
    if (timeDiff < oneWeek) thisWeekFlares.push(e);
    else if (timeDiff < 2 * oneWeek) lastWeekFlares.push(e);
    else if (timeDiff < 3 * oneWeek) twoWeeksAgoFlares.push(e);

    const thisMonth = new Date().getMonth();
    const entryMonth = d.getMonth();
    if (entryMonth === thisMonth) thisMonthFlares.push(e);
    else if (entryMonth === (thisMonth - 1 + 12) % 12) lastMonthFlares.push(e);
  }

  // Calculate averages and trends
  const avgSevForList = (list: any[]) => {
    const scores = list.map(e => severityToScore(e?.severity)).filter((s): s is number => s != null);
    return avg(scores);
  };

  const topArray = (obj: Record<string, { count: number }>, n = 10) =>
    Object.entries(obj).sort((a, b) => b[1].count - a[1].count).slice(0, n);

  // Determine symptom trends
  const topSymptoms = topArray(symptomCounts, 10).map(([name, data]) => {
    const { count, recentCount, dates } = data as any;
    const oldCount = count - recentCount;
    const oldPeriodDays = dates.length > 0 ? Math.max(14, (now - Math.min(...dates)) / oneDay - 14) : 30;
    const recentRate = recentCount / 14;
    const oldRate = oldCount / Math.max(1, oldPeriodDays);
    
    let recentTrend: "increasing" | "stable" | "decreasing" = "stable";
    if (recentRate > oldRate * 1.3) recentTrend = "increasing";
    else if (recentRate < oldRate * 0.7) recentTrend = "decreasing";
    
    return { name, count, recentTrend };
  });

  const topTriggers = topArray(triggerCounts, 10).map(([name, data]) => {
    const triggerData = data as { count: number; delayMinutes: number[] };
    return {
      name,
      count: triggerData.count,
      avgDelayHours: triggerData.delayMinutes?.length ? avg(triggerData.delayMinutes)! / 60 : undefined,
    };
  });

  // Peak time and day
  const totalFlares = Object.values(hourBuckets).reduce((a, b) => a + b, 0);
  const peakTime = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
  const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

  // Weather correlations
  const weatherCorrelations = Object.entries(weatherData)
    .map(([condition, data]) => ({
      condition,
      count: data.count,
      avgSeverity: avg(data.severities) ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Determine week-over-week trend
  let weekTrend: "up" | "down" | "stable" = "stable";
  if (thisWeekFlares.length > lastWeekFlares.length + 1) weekTrend = "up";
  else if (thisWeekFlares.length < lastWeekFlares.length - 1) weekTrend = "down";

  return {
    total: flares.length,
    thisWeek: { 
      count: thisWeekFlares.length, 
      avgSeverity: avgSevForList(thisWeekFlares),
      trend: weekTrend,
    },
    lastWeek: { count: lastWeekFlares.length, avgSeverity: avgSevForList(lastWeekFlares) },
    thisMonth: { count: thisMonthFlares.length, avgSeverity: avgSevForList(thisMonthFlares) },
    lastMonth: { count: lastMonthFlares.length, avgSeverity: avgSevForList(lastMonthFlares) },
    severityCounts: sevCounts,
    avgSeverity: avg(sevScores),
    daysSinceLast: sortedFlares[0] ? Math.floor((now - new Date(sortedFlares[0].timestamp).getTime()) / oneDay) : null,
    lastFlareDate: sortedFlares[0] ? formatDate(new Date(sortedFlares[0].timestamp)) : null,
    topSymptoms,
    topTriggers,
    peakTimeOfDay: { 
      period: peakTime?.[0] || "unknown", 
      count: peakTime?.[1] || 0,
      percentage: totalFlares > 0 ? Math.round((peakTime?.[1] || 0) / totalFlares * 100) : 0,
    },
    peakDayOfWeek: {
      day: peakDay?.[0] || "unknown",
      count: peakDay?.[1] || 0,
      percentage: totalFlares > 0 ? Math.round((peakDay?.[1] || 0) / totalFlares * 100) : 0,
    },
    hourBuckets,
    dayCounts,
    weatherCorrelations,
    recentEntries: sortedFlares.slice(0, 15),
    streakData: { currentFlareFree, longestFlareFree },
  };
}

function analyzeBodyMetrics(entries: any[]): BodyMetrics {
  const withPhysio = entries.filter(e => e?.physiological_data);
  const flares = entries.filter(e => e?.entry_type === "flare");
  const flaresWithPhysio = flares.filter(e => e?.physiological_data);
  const nonFlares = entries.filter(e => e?.entry_type !== "flare" && e?.physiological_data);

  if (withPhysio.length === 0) {
    return {
      hasData: false,
      entriesWithData: 0,
      heartRate: { avg: null, duringFlares: null, baseline: null },
      hrv: { avg: null, duringFlares: null, baseline: null },
      sleep: { avgHours: null, duringFlares: null, qualityScore: null },
      steps: { avg: null, duringFlares: null },
      stress: { avg: null, duringFlares: null },
      correlations: [],
    };
  }

  const extractMetric = (p: any, key: string): number | null => {
    switch (key) {
      case "hr":
        return toNum(p?.heartRate?.current) ?? toNum(p?.heartRate?.resting) ?? toNum(p?.vitals?.heartRate);
      case "hrv":
        return toNum(p?.hrv?.current) ?? toNum(p?.hrv?.daily) ?? toNum(p?.vitals?.hrv);
      case "sleep": {
        const d = toNum(p?.sleep?.duration);
        if (d == null) return null;
        if (d > 24 * 60) return d / 3600; // seconds to hours
        if (d > 24) return d / 60; // minutes to hours
        return d;
      }
      case "steps":
        return toNum(p?.activity?.steps) ?? toNum(p?.steps);
      case "stress":
        return toNum(p?.stress?.level) ?? toNum(p?.stress);
      default:
        return null;
    }
  };

  const collectMetrics = (list: any[]) => {
    const hr: number[] = [], hrv: number[] = [], sleep: number[] = [], steps: number[] = [], stress: number[] = [];
    for (const e of list) {
      const p = e.physiological_data;
      const vHr = extractMetric(p, "hr"); if (vHr != null) hr.push(vHr);
      const vHrv = extractMetric(p, "hrv"); if (vHrv != null) hrv.push(vHrv);
      const vSleep = extractMetric(p, "sleep"); if (vSleep != null) sleep.push(vSleep);
      const vSteps = extractMetric(p, "steps"); if (vSteps != null) steps.push(vSteps);
      const vStress = extractMetric(p, "stress"); if (vStress != null) stress.push(vStress);
    }
    return { hr: avg(hr), hrv: avg(hrv), sleep: avg(sleep), steps: avg(steps), stress: avg(stress) };
  };

  const flareMetrics = collectMetrics(flaresWithPhysio);
  const baselineMetrics = collectMetrics(nonFlares);
  const overallMetrics = collectMetrics(withPhysio);

  // Determine correlations
  const correlations: BodyMetrics["correlations"] = [];
  
  if (flareMetrics.sleep != null && baselineMetrics.sleep != null) {
    const diff = flareMetrics.sleep - baselineMetrics.sleep;
    if (Math.abs(diff) > 0.5) {
      correlations.push({
        metric: "sleep",
        correlation: diff < 0 ? "negative" : "positive",
        strength: Math.min(1, Math.abs(diff) / 2),
      });
    }
  }

  if (flareMetrics.stress != null && baselineMetrics.stress != null) {
    const diff = flareMetrics.stress - baselineMetrics.stress;
    if (Math.abs(diff) > 10) {
      correlations.push({
        metric: "stress",
        correlation: diff > 0 ? "positive" : "negative",
        strength: Math.min(1, Math.abs(diff) / 30),
      });
    }
  }

  return {
    hasData: true,
    entriesWithData: withPhysio.length,
    heartRate: { avg: overallMetrics.hr, duringFlares: flareMetrics.hr, baseline: baselineMetrics.hr },
    hrv: { avg: overallMetrics.hrv, duringFlares: flareMetrics.hrv, baseline: baselineMetrics.hrv },
    sleep: { avgHours: overallMetrics.sleep, duringFlares: flareMetrics.sleep, qualityScore: null },
    steps: { avg: overallMetrics.steps, duringFlares: flareMetrics.steps },
    stress: { avg: overallMetrics.stress, duringFlares: flareMetrics.stress },
    correlations,
  };
}

function analyzeTrends(flareSummary: FlareSummary): TrendAnalysis {
  const { thisWeek, lastWeek, thisMonth, lastMonth } = flareSummary;
  
  // Frequency trend
  let frequencyTrend: TrendAnalysis["frequencyTrend"] = "stable";
  const weekChange = thisWeek.count - lastWeek.count;
  const monthChange = thisMonth.count - lastMonth.count;
  
  if (weekChange > 1 || monthChange > 3) frequencyTrend = "worsening";
  else if (weekChange < -1 || monthChange < -3) frequencyTrend = "improving";

  // Severity trend
  let severityTrend: TrendAnalysis["severityTrend"] = "stable";
  if (thisWeek.avgSeverity && lastWeek.avgSeverity) {
    const sevDiff = thisWeek.avgSeverity - lastWeek.avgSeverity;
    if (sevDiff > 0.3) severityTrend = "worsening";
    else if (sevDiff < -0.3) severityTrend = "improving";
  }

  return {
    frequencyTrend,
    severityTrend,
    weekOverWeekChange: percentChange(thisWeek.count, lastWeek.count),
    monthOverMonthChange: percentChange(thisMonth.count, lastMonth.count),
    bestPeriod: null, // Would require more historical data
    worstPeriod: null,
    seasonalPattern: null,
  };
}

function identifyRiskFactors(
  flareSummary: FlareSummary,
  bodyMetrics: BodyMetrics,
  correlations: any[]
): RiskFactor[] {
  const risks: RiskFactor[] = [];

  // Check for increasing frequency
  if (flareSummary.thisWeek.trend === "up") {
    risks.push({
      factor: "Increasing flare frequency",
      riskLevel: "high",
      evidence: `${flareSummary.thisWeek.count} flares this week vs ${flareSummary.lastWeek.count} last week`,
      suggestion: "Review recent changes in routine, stress levels, or new triggers",
    });
  }

  // Check for poor sleep correlation
  if (bodyMetrics.sleep.duringFlares && bodyMetrics.sleep.avgHours) {
    if (bodyMetrics.sleep.duringFlares < bodyMetrics.sleep.avgHours - 1) {
      risks.push({
        factor: "Sleep deficit pattern",
        riskLevel: "medium",
        evidence: `Average ${bodyMetrics.sleep.duringFlares.toFixed(1)}h sleep before flares vs ${bodyMetrics.sleep.avgHours.toFixed(1)}h baseline`,
        suggestion: "Prioritize consistent sleep schedule",
      });
    }
  }

  // Check for high-frequency triggers
  const topTrigger = flareSummary.topTriggers[0];
  if (topTrigger && topTrigger.count >= 3) {
    risks.push({
      factor: `Recurring trigger: ${topTrigger.name}`,
      riskLevel: topTrigger.count >= 5 ? "high" : "medium",
      evidence: `Associated with ${topTrigger.count} of your flares`,
      suggestion: `Consider tracking and avoiding ${topTrigger.name.toLowerCase()} when possible`,
    });
  }

  // Check for time-based patterns
  if (flareSummary.peakTimeOfDay.percentage >= 40) {
    risks.push({
      factor: `${flareSummary.peakTimeOfDay.period.charAt(0).toUpperCase() + flareSummary.peakTimeOfDay.period.slice(1)} vulnerability`,
      riskLevel: "low",
      evidence: `${flareSummary.peakTimeOfDay.percentage}% of flares occur in the ${flareSummary.peakTimeOfDay.period}`,
      suggestion: `Consider preventive measures before ${flareSummary.peakTimeOfDay.period} or adjusting ${flareSummary.peakTimeOfDay.period} routines`,
    });
  }

  return risks;
}

function identifyPositivePatterns(flareSummary: FlareSummary, bodyMetrics: BodyMetrics): string[] {
  const positives: string[] = [];

  if (flareSummary.streakData.currentFlareFree >= 3) {
    positives.push(`${flareSummary.streakData.currentFlareFree} days flare-free! 🎉`);
  }

  if (flareSummary.thisWeek.count < flareSummary.lastWeek.count) {
    const diff = flareSummary.lastWeek.count - flareSummary.thisWeek.count;
    positives.push(`${diff} fewer flares this week compared to last`);
  }

  if (flareSummary.avgSeverity && flareSummary.avgSeverity < 1.8) {
    positives.push("Most of your flares have been on the milder side");
  }

  if (bodyMetrics.sleep.avgHours && bodyMetrics.sleep.avgHours >= 7) {
    positives.push(`Averaging ${bodyMetrics.sleep.avgHours.toFixed(1)} hours of sleep - great!`);
  }

  return positives;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE GENERATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function generateEmpathyPrefix(intent: UserIntent, flareSummary: FlareSummary): string {
  if (!intent.requiresEmpathy) return "";
  
  const empathyPhrases = {
    distressed: [
      "I hear you, and I'm sorry you're going through this.",
      "That sounds really tough. I'm here to help.",
      "I understand this is difficult.",
    ],
    frustrated: [
      "I get it - dealing with ongoing symptoms is exhausting.",
      "Your frustration is completely valid.",
      "It makes sense that you're frustrated.",
    ],
  };

  const phrases = empathyPhrases[intent.emotionalState as "distressed" | "frustrated"];
  if (!phrases) return "";
  
  return phrases[Math.floor(Math.random() * phrases.length)] + " ";
}

function generateContextualGreeting(flareSummary: FlareSummary, engagement: any): string {
  const daysSince = flareSummary.daysSinceLast;
  const streak = engagement?.current_streak || 0;
  
  if (daysSince === 0) {
    return "Hey! I see you've logged something today. How are you feeling now?";
  } else if (daysSince && daysSince >= 3) {
    if (daysSince >= 7) {
      return `Welcome back! It's been ${daysSince} days since your last log. I hope that means things have been good?`;
    }
    return `Hey! It's been ${daysSince} days - how have you been?`;
  } else if (streak >= 7) {
    return `Hey! Nice ${streak}-day logging streak! How are you today?`;
  }
  
  return "Hey! How are you feeling?";
}

function formatNumber(n: number | null, decimals = 1): string {
  if (n == null) return "N/A";
  return decimals === 0 ? String(Math.round(n)) : n.toFixed(decimals);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SYSTEM PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  profile: any,
  flareSummary: FlareSummary,
  bodyMetrics: BodyMetrics,
  trends: TrendAnalysis,
  riskFactors: RiskFactor[],
  positivePatterns: string[],
  correlations: any[],
  medications: any[],
  engagement: any,
  conversationHistory: { role: string; content: string }[]
): string {
  const userName = profile?.full_name?.split(" ")[0] || "there";
  const conditions = (profile?.conditions ?? []).join(", ") || "Not specified";
  
  // Build conversation context
  const recentTopics = conversationHistory.slice(-6).map(m => m.content.slice(0, 100));
  const isFirstMessage = conversationHistory.length === 0;

  return `You are Jvala — ${userName}'s personal health companion. You are the ASSISTANT. ${userName} is the USER.

CRITICAL IDENTITY RULE: You ALWAYS speak AS the assistant TO ${userName}. You NEVER speak as ${userName}. You NEVER say "I'm doing okay" or "I just logged a flare" — those are things the USER would say, not you. You respond TO what they say, you don't echo or roleplay as them. If ${userName} says "pissed" you respond with empathy TO them, like "That sucks, I'm sorry. Want to log how you're feeling?"

CONDITIONS: ${conditions}
${profile?.biological_sex ? `BIOLOGICAL SEX: ${profile.biological_sex}` : ""}
${profile?.date_of_birth ? `DATE OF BIRTH: ${profile.date_of_birth}` : ""}
${profile?.email ? `EMAIL: ${profile.email}` : ""}
${(profile?.known_symptoms ?? []).length > 0 ? `KNOWN SYMPTOMS: ${profile.known_symptoms.join(", ")}` : ""}
${(profile?.known_triggers ?? []).length > 0 ? `KNOWN TRIGGERS: ${profile.known_triggers.join(", ")}` : ""}

YOU KNOW EVERYTHING ABOUT ${userName.toUpperCase()}. When they ask "what's my name" → "${userName}". When they ask about conditions, symptoms, meds, age → answer from the data. NEVER say "I don't have access to your personal information."

PERSONALITY:
- Warm, personal, genuinely caring — smart friend who knows health data
- Do NOT start every message with "${userName}". Use their name sparingly — maybe 1 in 4-5 messages. Most messages should just dive right in.
- Conversational and human — no corporate speak, no AI disclaimers
- Specific with data, celebrate wins, comfort during hard times
- NEVER create visualizations/charts/tables unless user EXPLICITLY asks ("show me a chart", "graph", "visualize")
- For ALL questions — even data questions — answer in plain conversational text. No tables, no charts, no structured formats.
- Concise. 1-3 sentences for simple things.

FORMATTING (CRITICAL):
- Use **bold** for: key medical terms, trigger names, statistics, important findings, medication names, and condition names.
- Example: "Your **cough** flares are **2.7x** more likely during **cold, humid** weather."
- Use bullet points for lists of 3+ items.
- This makes responses scannable and impactful.

WHAT YOU MUST DO:
✓ Share observations, patterns, and insights from their data
✓ Point out concerning trends AND positive progress
✓ Make connections they might not see (triggers → flares, sleep → symptoms)
✓ Offer practical suggestions based on their patterns
✓ Validate their experiences and provide emotional support
✓ Ask clarifying questions when you need more info
✓ Celebrate their wins, even small ones

WHAT YOU MUST NEVER DO:
✗ Say "I can't give advice" or "I'm not able to have opinions" - you CAN share data-based observations
✗ Diagnose medical conditions
✗ Recommend specific medications or dosages
✗ Replace a doctor's guidance
✗ Be dismissive of their concerns
✗ Give generic responses that don't use their actual data

═══════════════════════════════════════════════════════════════════════════════
${userName.toUpperCase()}'S HEALTH DATA SNAPSHOT
═══════════════════════════════════════════════════════════════════════════════

📊 FLARE OVERVIEW
• Total logged: ${flareSummary.total} flares
• This week: ${flareSummary.thisWeek.count} (${flareSummary.thisWeek.trend === "up" ? "⬆️ increasing" : flareSummary.thisWeek.trend === "down" ? "⬇️ decreasing" : "→ stable"})
• Last week: ${flareSummary.lastWeek.count}
• This month: ${flareSummary.thisMonth.count} | Last month: ${flareSummary.lastMonth.count}
• Average severity: ${formatNumber(flareSummary.avgSeverity)}/3.0 (${flareSummary.avgSeverity ? scoreToSeverity(flareSummary.avgSeverity) : "N/A"})
• Days since last flare: ${flareSummary.daysSinceLast ?? "N/A"}
• Severity breakdown: ${flareSummary.severityCounts.severe} severe, ${flareSummary.severityCounts.moderate} moderate, ${flareSummary.severityCounts.mild} mild

🔥 TOP SYMPTOMS (with trends)
${flareSummary.topSymptoms.slice(0, 5).map(s => `• ${s.name}: ${s.count}x ${s.recentTrend === "increasing" ? "(⬆️ increasing lately)" : s.recentTrend === "decreasing" ? "(⬇️ less frequent)" : ""}`).join("\n") || "• None logged yet"}

⚡ TOP TRIGGERS
${flareSummary.topTriggers.slice(0, 5).map(t => `• ${t.name}: ${t.count}x`).join("\n") || "• None logged yet"}

⏰ TIMING PATTERNS (all times in user's local timezone: ${profile?.timezone || "UTC"})
• Peak time: ${flareSummary.peakTimeOfDay.period} (${flareSummary.peakTimeOfDay.percentage}% of flares)
• Peak day: ${flareSummary.peakDayOfWeek.day} (${flareSummary.peakDayOfWeek.percentage}% of flares)
• Distribution: Morning ${flareSummary.hourBuckets.morning}, Afternoon ${flareSummary.hourBuckets.afternoon}, Evening ${flareSummary.hourBuckets.evening}, Night ${flareSummary.hourBuckets.night}
• Recent entries (local time): ${flareSummary.recentEntries.slice(0, 5).map(e => {
    const d = new Date(e.timestamp);
    try {
      return d.toLocaleString("en-US", { timeZone: profile?.timezone || "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + ` (${e.severity || e.entry_type})`;
    } catch { return formatDate(d) + ` (${e.severity || e.entry_type})`; }
  }).join(", ") || "None"}

📈 TRENDS
• Frequency: ${trends.frequencyTrend === "improving" ? "✅ Improving" : trends.frequencyTrend === "worsening" ? "⚠️ Worsening" : "→ Stable"}
• Severity: ${trends.severityTrend === "improving" ? "✅ Improving" : trends.severityTrend === "worsening" ? "⚠️ Worsening" : "→ Stable"}
• Week-over-week: ${trends.weekOverWeekChange > 0 ? "+" : ""}${trends.weekOverWeekChange}%
• Flare-free streak: ${flareSummary.streakData.currentFlareFree} days (longest: ${flareSummary.streakData.longestFlareFree} days)

${bodyMetrics.hasData ? `⌚ WEARABLE DATA
• Entries with data: ${bodyMetrics.entriesWithData}
• Avg sleep: ${formatNumber(bodyMetrics.sleep.avgHours)}h${bodyMetrics.sleep.duringFlares ? ` (${formatNumber(bodyMetrics.sleep.duringFlares)}h before flares)` : ""}
• Avg heart rate: ${formatNumber(bodyMetrics.heartRate.avg, 0)} bpm${bodyMetrics.heartRate.duringFlares ? ` (${formatNumber(bodyMetrics.heartRate.duringFlares, 0)} during flares)` : ""}
• Stress levels: ${formatNumber(bodyMetrics.stress.avg, 0)}${bodyMetrics.stress.duringFlares ? ` (${formatNumber(bodyMetrics.stress.duringFlares, 0)} during flares)` : ""}
${bodyMetrics.correlations.length > 0 ? `• Correlations: ${bodyMetrics.correlations.map(c => `${c.metric} (${c.correlation})`).join(", ")}` : ""}` : "⌚ No wearable data connected yet"}

🌦️ WEATHER CORRELATIONS
${flareSummary.weatherCorrelations.slice(0, 4).map(w => `• ${w.condition}: ${w.count}x (avg severity: ${formatNumber(w.avgSeverity)})`).join("\n") || "• Not enough data yet"}

⚠️ RISK FACTORS TO WATCH
${riskFactors.map(r => `• [${r.riskLevel.toUpperCase()}] ${r.factor}: ${r.evidence}`).join("\n") || "• None identified yet - keep logging!"}

✨ POSITIVE PATTERNS
${positivePatterns.map(p => `• ${p}`).join("\n") || "• Keep logging to identify positive patterns"}

💊 MEDICATION TRACKING
• Total medication logs: ${medications.length}
${medications.slice(0, 3).map(m => `• ${m.medication_name} - last taken ${formatDate(new Date(m.taken_at))}`).join("\n") || "• No medications logged yet"}

🔗 LEARNED CORRELATIONS
${correlations.slice(0, 5).map(c => `• ${c.trigger_value} → ${c.outcome_value} (${c.occurrence_count}x, ${Math.round((c.confidence || 0) * 100)}% confidence)`).join("\n") || "• Still learning - keep logging triggers and symptoms together"}

═══════════════════════════════════════════════════════════════════════════════
RESPONSE GUIDELINES
═══════════════════════════════════════════════════════════════════════════════

CRITICAL LOGGING RULE: If the user mentions ANY symptom, feeling, or health complaint (e.g. "feeling sick", "sore throat", "headache", "nauseous", "tired"), you MUST set shouldLog=true and populate entryData with type="flare", the detected symptoms, and a severity. NEVER just acknowledge symptoms without logging them.

INTERACTIVE FORMS — YOUR SUPERPOWER:
You MUST use interactiveForm whenever you would otherwise ask a question with a limited set of answers. Examples of when to ALWAYS use a form:

1. BEDTIME: User says "going to sleep", "goodnight", "bouta sleep", "heading to bed" → Show a quick mood check-in form with a warm sign-off like "Sleep well! 💜":
   interactiveForm: { type: "rating", title: "How was your day overall?", options: [{ label: "Great", value: "great", emoji: "😊" }, { label: "Okay", value: "okay", emoji: "😐" }, { label: "Rough", value: "rough", emoji: "😔" }, { label: "Terrible", value: "terrible", emoji: "😣" }] }

2. MORNING: User says "good morning", "just woke up" → Sleep quality form:
   interactiveForm: { type: "rating", title: "How did you sleep?", options: [{ label: "Great", value: "great", emoji: "😴" }, { label: "Okay", value: "okay", emoji: "🙂" }, { label: "Poor", value: "poor", emoji: "😩" }, { label: "Awful", value: "awful", emoji: "💀" }] }

3. POST-MEAL CHECK: interactiveForm: { type: "options", title: "Feeling anything after eating?", options: [{ label: "All good", value: "fine", emoji: "👍" }, { label: "Bloated", value: "bloated" }, { label: "Nauseous", value: "nauseous" }, { label: "Pain", value: "pain" }] }

4. FOLLOW-UP: interactiveForm: { type: "severity", title: "How are you now?", options: [{ label: "Better", value: "better", emoji: "💚" }, { label: "Same", value: "same", emoji: "🟡" }, { label: "Worse", value: "worse", emoji: "🔴" }] }

5. YES/NO: Any yes/no question → form with buttons instead of text.

RULE: If you're about to type a question that could be answered by tapping a button, USE A FORM. Plain-text questions for simple choices = lazy and bad UX.

When responding:
1. ALWAYS use the data above to ground your observations
2. Be specific - cite actual numbers, dates, and patterns
3. If they're struggling, acknowledge it first, then offer insights
4. If they're doing well, celebrate it genuinely
5. Connect dots they might not see
6. Use FORMS for any question with limited answer choices
7. Celebrate their wins, even small ones

${isFirstMessage ? "This is the start of the conversation. Greet them warmly." : `CONVERSATION CONTEXT:\n${recentTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")}`}

Remember: You are their health companion. Be helpful, be specific, be empathetic. Never refuse to share observations.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC RESPONSE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

function handleDeterministicResponse(
  message: string,
  intent: UserIntent,
  flareSummary: FlareSummary,
  bodyMetrics: BodyMetrics,
  trends: TrendAnalysis,
  riskFactors: RiskFactor[],
  positivePatterns: string[],
  correlations: any[],
  medications: any[],
  engagement: any
): AssistantReply | null {
  const lower = message.toLowerCase();

  // Handle greetings with contextual response
  if (intent.primary === "greeting") {
    return {
      response: generateContextualGreeting(flareSummary, engagement),
      shouldLog: false,
      entryData: null,
      visualization: null,
      emotionalTone: "supportive",
    };
  }

  // Handle gratitude
  if (intent.primary === "gratitude") {
    const responses = [
      "You're welcome! I'm always here when you need me. 💙",
      "Happy to help! Is there anything else you'd like to know about your patterns?",
      "Glad I could help! Remember, I'm here whenever you need to log or chat.",
    ];
    return {
      response: responses[Math.floor(Math.random() * responses.length)],
      shouldLog: false,
      entryData: null,
      visualization: null,
      emotionalTone: "supportive",
    };
  }

  // Handle medication reports
  if (intent.primary === "medication_report" || (intent.isSymptomReport && /\b(took|taking|just)\b/.test(lower))) {
    const { medications: meds } = extractMedications(message);
    if (meds.length > 0) {
      const recentSameMed = medications.find(m => 
        meds.some(newMed => m.medication_name.toLowerCase().includes(newMed.toLowerCase()))
      );
      
      let response = `Got it, logging ${meds.join(", ")}. 💊`;
      if (recentSameMed) {
        const lastTime = new Date(recentSameMed.taken_at);
        const hoursSince = Math.round((Date.now() - lastTime.getTime()) / (1000 * 60 * 60));
        if (hoursSince < 24) {
          response += ` I see you also took ${recentSameMed.medication_name} ${hoursSince}h ago.`;
        }
      }
      
      return {
        response,
        shouldLog: true,
        entryData: { type: "medication", medications: meds },
        visualization: null,
        confidence: 0.95,
        emotionalTone: "supportive",
      };
    }
  }

  // Handle symptom reports
  if (intent.primary === "symptom_report" && intent.isSymptomReport) {
    const { symptoms } = extractSymptoms(message);
    const { triggers } = extractTriggers(message);
    const severity = detectSeverity(message);
    const energy = detectEnergyLevel(message);

    if (symptoms.length > 0 || severity) {
      let response = "";
      const empathy = generateEmpathyPrefix(intent, flareSummary);
      
      if (severity === "severe") {
        response = `${empathy}I'm logging this severe flare with ${symptoms.join(", ") || "your symptoms"}. `;
        if (triggers.length > 0) {
          response += `I see you mentioned ${triggers.join(", ")} - I'll track that connection. `;
        }
        response += "I hope you can rest. Is there anything specific that helps during severe episodes?";
      } else if (severity === "moderate") {
        response = `${empathy}Logging your ${severity || "moderate"} flare${symptoms.length ? ` with ${symptoms.join(", ")}` : ""}. `;
        response += "How long has this been going on?";
      } else {
        response = `${empathy}Got it, logging ${symptoms.join(", ") || "your symptoms"}${severity ? ` as ${severity}` : ""}. `;
        response += "Hang in there! 💙";
      }

      return {
        response,
        shouldLog: true,
        entryData: {
          type: "flare",
          severity: severity || "moderate",
          symptoms,
          triggers,
          energyLevel: energy || undefined,
        },
        visualization: null,
        confidence: 0.9,
        emotionalTone: severity === "severe" ? "concerned" : "supportive",
        suggestedFollowUp: "Would you like to add any details about what might have triggered this?",
      };
    }
  }

  // Let the AI model handle everything else with full context
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODEL CALL WITH ENHANCED TOOLING
// ─────────────────────────────────────────────────────────────────────────────

async function callModel({
  apiKey,
  systemPrompt,
  history,
  userMessage,
}: {
  apiKey: string;
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
}): Promise<AssistantReply> {
  const tools = [
    {
      type: "function",
      function: {
        name: "respond",
        description: "Generate a response to the user. Use this to reply with insights, observations, or support based on their health data.",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["response", "shouldLog", "entryData", "visualization", "interactiveForm", "emotionalTone"],
          properties: {
            response: { 
              type: "string",
              description: "Your response to the user. Use markdown for formatting. Use **bold** for emphasis (raw double asterisks, NOT escaped). Do NOT escape asterisks with backslashes.",
            },
            shouldLog: { 
              type: "boolean",
              description: "Whether this message should create a log entry",
            },
            entryData: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["type"],
                  properties: {
                    type: { type: "string", enum: ["flare", "medication", "trigger", "recovery", "energy", "note"] },
                    severity: { type: "string", enum: ["mild", "moderate", "severe"] },
                    symptoms: { type: "array", items: { type: "string" } },
                    medications: { type: "array", items: { type: "string" } },
                    triggers: { type: "array", items: { type: "string" } },
                    energyLevel: { type: "string" },
                    notes: { type: "string" },
                  },
                },
              ],
            },
            visualization: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "title", "data"],
                  properties: {
                    type: { type: "string", enum: ["timeline", "severity_breakdown", "symptom_frequency", "trigger_frequency", "time_of_day", "day_of_week", "weather_correlation", "comparison", "body_metrics", "pattern_summary"] },
                    title: { type: "string" },
                    data: { type: "array", items: {} },
                    insight: { type: "string" },
                  },
                },
              ],
            },
            interactiveForm: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "title", "options"],
                  properties: {
                    type: { type: "string", enum: ["rating", "options", "severity"], description: "rating = emoji scale, options = quick choices, severity = mild/mod/severe" },
                    title: { type: "string", description: "Short label above the form buttons" },
                    options: { 
                      type: "array", 
                      items: { 
                        type: "object", 
                        additionalProperties: false,
                        required: ["label", "value"],
                        properties: {
                          label: { type: "string" },
                          value: { type: "string" },
                          emoji: { type: "string" },
                        }
                      },
                      description: "2-5 tap-able options" 
                    },
                    followUpMessage: { type: "string", description: "Optional message to show after selection" },
                  },
                },
              ],
              description: "Interactive quick-tap form. Use for bedtime check-ins, meal follow-ups, yes/no questions, sleep quality ratings, mood checks, etc. ALWAYS prefer forms over asking questions in plain text when the answer is a simple choice.",
            },
            emotionalTone: {
              type: "string",
              enum: ["supportive", "celebratory", "concerned", "neutral", "encouraging"],
              description: "The emotional tone of the response",
            },
            actionableInsights: {
              type: "array",
              items: { type: "string" },
              description: "Specific actionable takeaways for the user",
            },
            suggestedFollowUp: {
              type: "string",
              description: "A follow-up question or suggestion",
            },
          },
        },
      },
    },
  ];

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-20).map(m => ({ role: m.role, content: clamp(m.content, 2000) })),
    { role: "user", content: clamp(userMessage, 6000) },
  ];

  console.log("🤖 Calling AI model with", messages.length, "messages");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({ 
      model: "google/gemini-2.5-flash", 
      messages, 
      tools, 
      tool_choice: { type: "function", function: { name: "respond" } },
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("❌ AI gateway error:", resp.status, text);
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI gateway error: ${resp.status}`);
  }

  const data = await resp.json();
  const toolArgs = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  
  if (toolArgs) {
    try {
      const parsed = JSON.parse(toolArgs);
      return {
        response: parsed.response || "I'm here to help. What would you like to know?",
        shouldLog: Boolean(parsed.shouldLog),
        entryData: parsed.entryData ?? null,
        visualization: parsed.visualization ?? null,
        interactiveForm: parsed.interactiveForm ?? null,
        emotionalTone: parsed.emotionalTone ?? "neutral",
        actionableInsights: parsed.actionableInsights ?? [],
        suggestedFollowUp: parsed.suggestedFollowUp,
      };
    } catch (e) {
      console.error("❌ Failed to parse tool args:", e);
    }
  }

  // Fallback to direct content
  const content = data.choices?.[0]?.message?.content;
  return {
    response: typeof content === "string" && content.trim() 
      ? content 
      : "I'm having trouble processing that. Could you rephrase?",
    shouldLog: false,
    entryData: null,
    visualization: null,
    emotionalTone: "neutral",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── JWT Auth Guard ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return replyJson({ error: "Unauthorized" }, 401);
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return replyJson({ error: "Unauthorized" }, 401);
    }
    const authenticatedUserId = claimsData.claims.sub as string;
    // ─────────────────────────────────────────────────────────────────────

    const { message, history = [], userId: requestedUserId, clientTimezone }: ChatRequest & { clientTimezone?: string } = await req.json();
    // Enforce: callers can only access their own data
    const userId = authenticatedUserId;
    
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      console.error("❌ LOVABLE_API_KEY not configured");
      throw new Error("LOVABLE_API_KEY not configured");
    }
    
    if (!message || typeof message !== "string") {
      return replyJson({ error: "Invalid message" }, 400);
    }

    console.log("💬 [chat-assistant] User message:", message.slice(0, 100));

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all user data in parallel
    const [
      { data: profile },
      { data: entries },
      { data: medLogs },
      { data: correlations },
      { data: engagement },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("flare_entries").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(300),
      supabase.from("medication_logs").select("*").eq("user_id", userId).order("taken_at", { ascending: false }).limit(200),
      supabase.from("correlations").select("*").eq("user_id", userId).order("confidence", { ascending: false }).limit(50),
      supabase.from("engagement").select("*").eq("user_id", userId).single(),
    ]);

    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeMeds = Array.isArray(medLogs) ? medLogs : [];
    const safeCorr = Array.isArray(correlations) ? correlations : [];

    // Analyze data — prefer client-sent timezone, then profile, then UTC (never server's local TZ)
    const userTimezone = clientTimezone || (profile?.timezone && profile.timezone !== 'UTC' ? profile.timezone : null) || 'UTC';
    const flareSummary = analyzeFlares(safeEntries, userTimezone);
    const bodyMetrics = analyzeBodyMetrics(safeEntries);
    const trends = analyzeTrends(flareSummary);
    const riskFactors = identifyRiskFactors(flareSummary, bodyMetrics, safeCorr);
    const positivePatterns = identifyPositivePatterns(flareSummary, bodyMetrics);

    // Analyze user intent
    const intent = analyzeIntent(message, history);
    console.log("🎯 [chat-assistant] Intent:", intent.primary, "| Emotion:", intent.emotionalState);

    // Try deterministic response first for simple cases
    const deterministicResponse = handleDeterministicResponse(
      message,
      intent,
      flareSummary,
      bodyMetrics,
      trends,
      riskFactors,
      positivePatterns,
      safeCorr,
      safeMeds,
      engagement
    );

    if (deterministicResponse) {
      console.log("⚡ [chat-assistant] Using deterministic response");
      return replyJson(deterministicResponse);
    }

    // Build comprehensive system prompt and call model
    const systemPrompt = buildSystemPrompt(
      profile,
      flareSummary,
      bodyMetrics,
      trends,
      riskFactors,
      positivePatterns,
      safeCorr,
      safeMeds,
      engagement,
      history
    );

    console.log("🤖 [chat-assistant] Calling AI model...");
    
    let modelResponse: AssistantReply;
    try {
      modelResponse = await callModel({
        apiKey,
        systemPrompt,
        history,
        userMessage: message,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Unknown";
      console.error("❌ [chat-assistant] Model error:", err);
      
      if (err === "RATE_LIMIT") {
        return replyJson({ 
          error: "I'm getting too many requests right now. Please try again in a moment.",
          response: "I'm getting too many requests right now. Please try again in a moment." 
        }, 429);
      }
      if (err === "CREDITS_EXHAUSTED") {
        return replyJson({ 
          error: "AI credits are exhausted. Please contact support.",
          response: "AI credits are exhausted. Please contact support." 
        }, 402);
      }
      throw e;
    }

    // Ensure we have a valid response
    if (!modelResponse.response?.trim()) {
      modelResponse.response = "I'm here to help! You can ask me about your patterns, triggers, symptoms, or just chat about how you're feeling.";
    }

    console.log("✅ [chat-assistant] Response generated, length:", modelResponse.response.length);
    return replyJson(modelResponse);

  } catch (error) {
    console.error("❌ [chat-assistant] Error:", error);
    return replyJson({ 
      error: error instanceof Error ? error.message : "Something went wrong",
      response: "I'm having trouble right now. Please try again in a moment.",
    }, 500);
  }
});
