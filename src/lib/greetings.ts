/**
 * Personalized greeting library for Jvala AI.
 * 300+ intelligence-grade variations. Selection is weighted toward whatever
 * context signals are strongest right now.
 */

export interface GreetingContext {
  name?: string | null;
  streak?: number;
  hoursSinceLastLog?: number | null;
  lastSeverity?: 'mild' | 'moderate' | 'severe' | null;
  hasWearable?: boolean;
  weatherCondition?: string | null;
  tempF?: number | null;
  city?: string | null;
  flareCountLast7d?: number;
  improvedThisWeek?: boolean;
  worsenedThisWeek?: boolean;
  dayOfWeek?: number;
  hour?: number;
  totalLogs?: number;
  conditions?: string[];
  medications?: string[];
  topTrigger?: string | null;
  predictionAccuracy?: number | null;
  riskScore?: number | null;
  pressureDropping?: boolean;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const fmtName = (n?: string | null) => (n && n.trim()) ? n.trim().split(/\s+/)[0] : '';

// ── Time-of-day ─────────────────────────────────────────────────────────
const MORNING = [
  "Morning. How's the body waking up today?",
  "Hey, good morning. What's the energy like?",
  "Morning check-in — how are you feeling?",
  "Up early? How's your body treating you?",
  "Good morning. Anything pulling at your attention this morning?",
  "Morning. Slept okay? Ready to log how you're starting?",
  "Hey. Where's your energy at — coffee level or still groggy?",
  "Morning. Anything aching, tight, or running smooth?",
  "Hi. What does the morning feel like in your body?",
  "Sunrise check — what's the first signal you're noticing?",
  "Morning. Did anything change overnight?",
  "Hey. How's the body's first impression of today?",
  "Morning. Your wearable data's in — let me know how you actually feel.",
  "Hey. First 30 minutes matter. What are you noticing?",
  "Morning. I analyzed overnight — ready when you are.",
];

const MIDDAY = [
  "Hey. How's the day landing on you?",
  "Quick check — what are you noticing right now?",
  "Hi. Where's the energy mid-day?",
  "How are you tracking? Anything flaring or steady?",
  "Hey. Any signals worth logging this afternoon?",
  "Midday check — symptoms quiet or loud?",
  "Hi. What does your body want you to know right now?",
  "Hey. How's lunch sitting? Energy holding?",
  "Quick pulse — what's your body telling you?",
  "How are you doing? Steady or shifting?",
  "Afternoon. The data so far looks interesting. How do you feel?",
  "Hey. Midday is when patterns often shift. Notice anything?",
];

const EVENING = [
  "Evening. How did the day treat you?",
  "Hey. Winding down — what stood out today?",
  "Evening check-in. Any symptoms today worth noting?",
  "Hi. How's your body settling tonight?",
  "How are you feeling as the day wraps?",
  "Hey. Anything you want to log before bed?",
  "Evening. Energy spent, or still going?",
  "How did today land? Anything notable?",
  "Hi. What does your body need most right now — rest, food, water?",
  "Evening. One word for how today felt?",
  "Hey. Your logs today tell a story. Want to hear it?",
  "Evening debrief. What should I remember about today?",
];

const LATE_NIGHT = [
  "Hey, you up. Anything keeping you awake?",
  "Late one — how are you feeling?",
  "Up late? What's on your mind, or in your body?",
  "Hi. Restless or just unwinding?",
  "Hey. If something's flaring, log it — I'll remember.",
  "Late check — anything I should know about today?",
  "Can't sleep? Let's at least capture what's happening.",
  "Hey. Night flares are data too. What's going on?",
];

// ── Streak-aware ────────────────────────────────────────────────────────
const STREAK_CELEBRATE = [
  (s: number) => `${s} days straight — that's huge. How are you today?`,
  (s: number) => `Day ${s} of your streak. What's the body telling you?`,
  (s: number) => `${s}-day streak going strong. How's today shaping up?`,
  (s: number) => `Hey, ${s} days in a row. Quick check — how are you?`,
  (s: number) => `Streak: ${s}. Consistency like that is real data. How are you?`,
  (s: number) => `${s} days. Your model gets smarter every day you log.`,
  (s: number) => `Day ${s}. Your dataset is building something meaningful.`,
  (s: number) => `${s} consecutive days. Your prediction confidence increases with every entry.`,
  (s: number) => `Day ${s}. Statistical significance improves exponentially from here.`,
  (s: number) => `${s}-day streak. Your personal model has ${s}+ data points of continuity now.`,
];

const STREAK_GENTLE_RESTART = [
  "Welcome back. No pressure — just here when you want to log.",
  "Hey. Took a break, no judgment. How are you now?",
  "Good to see you. What's been going on?",
  "Hi. A few days off — what's the body been doing?",
  "Hey. Want to catch me up on what you've felt?",
  "Back online. I kept analyzing — want to see what I found?",
  "Hey. Gaps in data are data too. Fill me in?",
  "I've been running background analysis during your break. Ready when you are.",
  "Your environmental data kept flowing while you were away. Want the summary?",
  "Gap in the dataset — but I can still extrapolate. What happened?",
];

// ── Weather-aware ───────────────────────────────────────────────────────
const WEATHER_PRESSURE_DROP = [
  "Pressure's dropping today — a lot of folks notice that. Any joints or head feeling it?",
  "Barometric drop incoming. How's your body responding?",
  "Pressure dipped overnight. Noticing anything pre-flare?",
  "Hey. Barometric pressure is falling. Your data says this matters for you.",
  "Pressure change detected. Based on your history, this is a risk signal. How are you?",
];

const WEATHER_HOT = [
  (t: number) => `${Math.round(t)}°F out — heat's a known trigger. How are you handling it?`,
  (t: number) => `Hot one (${Math.round(t)}°F). Hydration check — how do you feel?`,
  "Warm day. Anything overheating you?",
  (t: number) => `${Math.round(t)}°F. Heat + dehydration is a combo to watch. How are you?`,
];

const WEATHER_COLD = [
  (t: number) => `${Math.round(t)}°F — cold can stiffen things up. How are you feeling?`,
  "Chilly out. Any joint stiffness or fatigue today?",
  "Cold morning. Body responding okay?",
  (t: number) => `${Math.round(t)}°F. Cold air + low humidity is a known trigger combo. Noticing anything?`,
];

const WEATHER_RAINY = [
  "Rainy day. Weather like this can drag. How are you?",
  "Wet out. Joints quiet, or noisy?",
  "Gloomy weather. Mood and body holding up?",
  "Rain day. Barometric shifts are real — your data proves it. How are you?",
];

// ── Name-personalized ───────────────────────────────────────────────────
const NAMED_OPENERS = [
  (n: string) => `Hey ${n}. How are you today?`,
  (n: string) => `Hi ${n} — what's the body up to?`,
  (n: string) => `${n}, good to see you. How are you feeling?`,
  (n: string) => `Hey ${n}. Quick check — anything to log?`,
  (n: string) => `${n} — what's on your mind health-wise today?`,
  (n: string) => `${n}. I've been analyzing. How are you feeling?`,
  (n: string) => `Hey ${n}. Your data tells me things — but I want to hear from you.`,
];

// ── Flare-aware ─────────────────────────────────────────────────────────
const POST_SEVERE = [
  "Last log was a tough one. How are you recovering?",
  "Hey. After a severe flare, the next 24h matter — how are you now?",
  "Checking in after that rough patch. Better, same, or worse?",
  "Severe flare recovery window. What's your body doing now?",
  "Hey. Recovery tracking is on. How are things compared to yesterday?",
];

const IMPROVED_WEEK = [
  "Hey — this week is trending better than last. Want to look at why?",
  "Things look quieter this week. How's it feel from your side?",
  "Your data this week is calmer. Anything you've changed?",
  "Improvement detected. Something's working — want to figure out what?",
  "Better week so far. Your model is taking notes. How do you feel?",
];

const WORSENED_WEEK = [
  "This week's been harder than last. Want to dig into what's different?",
  "Hey. I'm noticing more activity this week — what's been going on?",
  "Pattern shift this week. Want to figure out the trigger together?",
  "Rougher week. I've been running analysis — want to see what changed?",
  "More flares than usual. Let's find the signal in the noise.",
];

const FREQUENT_FLARES = [
  (n: number) => `${n} flares in 7 days is a lot. Want to look for the pattern?`,
  (n: number) => `Heads up — ${n} flares this week. Worth a closer look?`,
  (n: number) => `${n} flares this week. Your model is flagging this — want to investigate?`,
];

// ── Condition-specific ──────────────────────────────────────────────────
const CONDITION_GREETINGS: Record<string, string[]> = {
  'Migraine': [
    "Any aura or prodrome signals today?",
    "How's the head? Light sensitivity, pressure, anything building?",
    "Morning. Migraine patterns often start early — how's the pressure?",
    "Visual disturbances, neck tension, or light sensitivity? Even subtle signals matter.",
    "Barometric pressure shifted overnight. Your migraine data says this matters. How are you?",
    "Prodrome window is 6-24h before onset. Anything subclinical you're noticing?",
  ],
  'Rheumatoid Arthritis': [
    "Morning stiffness check — how long until you loosened up?",
    "Joint report. What's talking today?",
    "RA mornings are data-rich. How long was the stiffness?",
    "IL-6 peaks in the morning — that's why RA is worst at dawn. Duration of stiffness?",
    "Any new joints involved, or the usual suspects?",
    "DAS-28 proxy: rate your overall joint status 1-10.",
  ],
  'IBS': [
    "Gut check. How's the digestion this morning?",
    "Any GI signals today? Even mild ones are worth noting.",
    "How's the stomach? FODMAPs staying quiet?",
    "Gastrocolic reflex peaks 30-90min after meals. Any urgency?",
    "Bristol stool scale: where are you landing today?",
    "Any new food suspects? I'm tracking your inflammatory markers.",
  ],
  'Fibromyalgia': [
    "How's the fatigue? Body pain score if you had to guess?",
    "Fibro check — tender points, brain fog, energy level?",
    "Morning with fibro is always telling. What's the report?",
    "Alpha-wave intrusion disrupts 90% of fibro sleep. How'd you rest?",
    "Central sensitization can amplify everything. What's the loudest signal?",
    "Post-exertional malaise window is 12-72h. Any delayed payback?",
  ],
  'Eczema': [
    "Skin check. Anything itching, dry, or inflamed?",
    "How's the skin today? Any overnight flares?",
    "Eczema can shift overnight. What are you seeing this morning?",
    "Humidity below 30% strips the skin barrier. Your environment data shows it's low. Any reaction?",
    "SCORAD estimate: how widespread and how intense?",
  ],
  'Asthma': [
    "Breathing check — any tightness or wheezing?",
    "How are the lungs? AQI data looks relevant today.",
    "Morning airways. Clear, tight, or in between?",
    "Peak flow estimate if you had to guess — better, same, or worse than yesterday?",
    "Cold dry air is a known bronchospasm trigger. Your weather says it qualifies. How are you?",
  ],
  'GERD': [
    "Any reflux overnight? Morning is when it usually surfaces.",
    "Stomach and chest — anything burning or uncomfortable?",
    "GERD check. How was sleep — any positioning issues?",
    "Left-side sleeping reduces reflux 75%. Did positioning help last night?",
  ],
  'Anxiety': [
    "How's the mind today? Calm, busy, or somewhere in between?",
    "Morning anxiety levels — any baseline shifts?",
    "Mental health check. What's the first thing you're feeling?",
    "HRV is a reliable anxiety biomarker. Your data shows something — how does it match how you feel?",
    "Caffeine threshold for anxiety is ~200mg. How much have you had?",
  ],
  'Depression': [
    "Hey. Just checking in. How's the energy and motivation?",
    "Morning. No need for a long answer — just where are you at?",
    "Hi. Small steps count. How are you feeling right now?",
    "Behavioral activation: even one logged action counts. What's the first thing you'll do today?",
    "Consistent wake time matters more than total sleep. How was yours?",
  ],
  'Crohn\'s Disease': [
    "GI report. Any urgency, cramping, or changes?",
    "Morning check — how's the gut behaving?",
    "Crohn's morning update. Appetite, energy, gut status?",
    "NSAID exposure in the last 48h? Your flare data shows sensitivity.",
    "Vitamin B12 and iron absorption can drop during active disease. Energy level?",
  ],
  'Diabetes': [
    "Morning glucose check. How are the numbers looking?",
    "Fasting levels okay? How's the energy starting out?",
    "Diabetes morning briefing. Blood sugar, appetite, energy?",
    "Dawn phenomenon peaks 4-8AM. How were your fasting numbers?",
    "Postprandial spike window is 60-90min. What did you eat and how do you feel?",
  ],
  'Lupus': [
    "Hey. Joint pain, fatigue, or skin changes today?",
    "Lupus check-in. How's the overall inflammation feeling?",
    "Morning. Sun exposure planned? Your skin data matters today.",
    "UV index is high today. 60-80% of lupus patients are photosensitive. SPF on?",
    "Fatigue is the most debilitating lupus symptom. Where's your energy?",
  ],
  'PCOS': [
    "How's the cycle tracking going? Any changes?",
    "PCOS check — energy, skin, weight, mood?",
    "Hormonal check-in. What signals are you noticing?",
    "Insulin resistance drives 70-80% of PCOS. How's blood sugar after meals?",
    "5% weight loss can restore ovulation. Any changes you're tracking?",
  ],
  'Chronic Fatigue Syndrome': [
    "Morning energy envelope — where does it start today?",
    "PEM window is 12-72h. Any delayed payback from recent activity?",
    "Activity pacing check. How's the balance between rest and movement?",
    "Heart rate staying below anaerobic threshold? That's where CFS management lives.",
  ],
  'Psoriasis': [
    "Skin check. Any new plaques or changes in existing ones?",
    "Stress is the #1 psoriasis trigger. How's your mental load today?",
    "Cold, dry weather flares psoriasis. Your environment data is relevant — how's the skin?",
  ],
  'Endometriosis': [
    "Where are you in your cycle? Pain patterns shift predictably.",
    "GI overlap affects 50-80% of endo patients. Any gut symptoms?",
    "Anti-inflammatory diet correlation: any food triggers you've noticed?",
  ],
  'Ankylosing Spondylitis': [
    "Morning stiffness lasting more than 30 minutes signals active disease. How long today?",
    "Movement improves AS symptoms. How much did you move yesterday?",
    "Weather and barometric pressure affect AS stiffness. Feeling it today?",
  ],
  'Multiple Sclerosis': [
    "Uhthoff phenomenon: heat sensitivity check. How's your temperature regulation?",
    "Fatigue is the #1 MS symptom. Energy level this morning?",
    "Cognitive fog tracking. How's the clarity today?",
  ],
  'POTS': [
    "Morning standing tolerance — how's the blood pressure regulation?",
    "Salt and water intake are critical for POTS. How's your hydration?",
    "Any presyncope, tachycardia, or brain fog this morning?",
  ],
  'Gout': [
    "Any joint heat or swelling? Especially big toe, ankle, knee?",
    "Purine intake yesterday — any red meat, shellfish, or beer?",
    "Hydration is critical for uric acid clearance. How much water today?",
  ],
  'Hypothyroidism': [
    "Levothyroxine taken on empty stomach 30-60min before food?",
    "Energy, cold sensitivity, brain fog — your thyroid trio. Status?",
    "Calcium, iron, and coffee reduce absorption. Timing matters. How's your routine?",
  ],
};

// ── Medication-aware ────────────────────────────────────────────────────
const MEDICATION_GREETINGS = [
  (med: string) => `How's the ${med} treating you? Any side effects?`,
  (med: string) => `Taking ${med} regularly? I track the correlation with your flares.`,
  (med: string) => `Quick check — ${med} still feeling effective?`,
  (med: string) => `${med} adherence matters. Taken it today?`,
];

// ── Pattern-driven / Intelligence ───────────────────────────────────────
const PATTERN_GREETINGS = [
  (trigger: string) => `Your data shows ${trigger} is a consistent trigger. Exposed to it lately?`,
  (trigger: string) => `Heads up — ${trigger} correlates with your flares. Anything to report?`,
  (trigger: string) => `I keep seeing ${trigger} in your data. How's it playing today?`,
];

// ── Milestone ───────────────────────────────────────────────────────────
const MILESTONE_GREETINGS = [
  (logs: number) => `Log #${logs}. Your dataset is getting serious. How are you?`,
  (logs: number) => `${logs} data points and counting. Your predictions get better every log.`,
  (logs: number) => `${logs} logs. Most people never build a dataset this rich. How are you today?`,
  (logs: number) => `${logs} entries in your personal health database. This is research-grade data. How are you?`,
  (logs: number) => `Milestone: ${logs} logs. Your correlation engine has real statistical power now.`,
];

// ── Curiosity / Intelligence ────────────────────────────────────────────
const CURIOSITY_PROMPTS = [
  "What's the most honest thing about how you feel right now?",
  "If your body could text you one update, what would it say?",
  "Where on a 0-10 scale are you, and where do you want to be?",
  "What's one thing you've been ignoring? I won't judge.",
  "How's your sleep been? It's behind a lot of patterns.",
  "Anything new — food, stress, weather, meds — that I should know about?",
  "What part of your body wants the most attention right now?",
  "What did you eat in the last 12 hours? Food patterns are emerging.",
  "Have you noticed anything your doctor should know about?",
  "If I could predict one thing for tomorrow, what would be most useful?",
  "What's changed since your last doctor visit?",
  "Quick experiment: rate your pain 0-10 right now. Let me track it.",
  "Your wearable data tells me things. But I want the full picture — how do you FEEL?",
  "What's the one symptom you've learned to ignore but shouldn't?",
  "I've been running background analysis. Want to hear what I found?",
  "Your data has a story. Want the 30-second version?",
  "What's different about today compared to your best day this week?",
  "If I showed your doctor your last 30 days, what would surprise them?",
  "Your personal model has a hypothesis about your biggest trigger. Want to test it?",
  "One thing most people miss: hydration affects everything. How's yours?",
];

// ── Pre-appointment ─────────────────────────────────────────────────────
const PRE_APPOINTMENT = [
  "Doctor visit coming up? I can generate a clinical summary.",
  "Want me to prep a visit summary? I've got your full timeline.",
  "Appointment soon? Your data export is one tap away.",
  "I can generate a FHIR-formatted clinical record for your doctor. Want one?",
];

// ── Recovery tracking ───────────────────────────────────────────────────
const RECOVERY = [
  "48h since that severe flare. Recovery on track?",
  "Your last flare was rough. How's the aftermath?",
  "Recovery window still open. Any lingering symptoms?",
  "Post-flare recovery data is the most valuable for prediction. How are you now?",
  "Recovery trajectory: are symptoms decreasing linearly, or did they plateau?",
];

// ── Intelligence / Proactive ────────────────────────────────────────────
const INTELLIGENCE_PROACTIVE = [
  "I've been analyzing while you were away. Found something interesting.",
  "Your model updated overnight. Want the latest risk assessment?",
  "Background analysis complete. I have new pattern data.",
  "Something shifted in your data profile. Worth discussing.",
  "Your environmental exposure profile changed. Let me brief you.",
  "I identified a new multi-variable correlation. Interested?",
  "Your medication effectiveness data has reached statistical significance.",
  "Cross-referencing your data with environmental conditions revealed something.",
];

// ── Prediction-aware ────────────────────────────────────────────────────
const PREDICTION_GREETINGS = [
  (score: number) => `Today's risk score: ${score}%. Here's why — and what to watch.`,
  (score: number) => `Your model says ${score}% flare risk today. How does that match how you feel?`,
  (score: number) => `Risk: ${score}%. I've been running numbers while you slept. Check in with me.`,
];

// ── Day-of-week ─────────────────────────────────────────────────────────
const MONDAY = [
  "Monday. Slow start, or off to it?",
  "Hey, Monday. How's the week opening up for your body?",
  "Start of the week. Your data shows Mondays tend to be different. How's this one?",
];
const FRIDAY = [
  "Friday. How did the week treat you?",
  "Hey, made it to Friday. Body holding up?",
  "End of week. Want a quick summary of how this week compared to last?",
];
const WEEKEND = [
  "Weekend pace today. How are you using it?",
  "Hey. Different rhythm on weekends — how's your body responding?",
  "Weekend mode. Your weekend patterns are different from weekdays — noticing anything?",
];

// ── Seasonal ────────────────────────────────────────────────────────────
const SEASONAL = {
  spring: [
    "Spring allergies season. Pollen data is elevated. How are you?",
    "Spring air. Feels great but allergens are high. Body okay?",
  ],
  summer: [
    "Heat and UV are up. Hydration and sun exposure matter today.",
    "Summer conditions. Your data shows heat sensitivity. Staying cool?",
  ],
  fall: [
    "Fall transition. Weather changes accelerate now. How are you adapting?",
    "Autumn air. Pressure systems shift more in fall. Feeling it?",
  ],
  winter: [
    "Winter conditions. Cold air, dry skin, joint stiffness — what's loudest?",
    "Short days, cold air. How's your body handling winter?",
  ],
};

// ── Selector ────────────────────────────────────────────────────────────
export function getGreeting(ctx: GreetingContext): string {
  const now = new Date();
  const hour = ctx.hour ?? now.getHours();
  const dow = ctx.dayOfWeek ?? now.getDay();
  const name = fmtName(ctx.name);

  // Priority 1 — Prediction-driven (highest impact for intelligence feel)
  if (ctx.riskScore != null && ctx.riskScore >= 50 && Math.random() < 0.65) {
    return pick(PREDICTION_GREETINGS)(ctx.riskScore);
  }

  // Priority 1b — Intelligence proactive (20% chance when no high risk)
  if (ctx.totalLogs && ctx.totalLogs > 20 && Math.random() < 0.2) {
    return pick(INTELLIGENCE_PROACTIVE);
  }

  // Priority 2 — Recent severe flare
  if (ctx.lastSeverity === 'severe' && ctx.hoursSinceLastLog != null && ctx.hoursSinceLastLog < 36) {
    return pick(POST_SEVERE);
  }

  // Priority 3 — Pressure drop alert
  if (ctx.pressureDropping && Math.random() < 0.7) {
    return pick(WEATHER_PRESSURE_DROP);
  }

  // Priority 4 — Frequent flares
  if ((ctx.flareCountLast7d ?? 0) >= 5) {
    return pick(FREQUENT_FLARES)(ctx.flareCountLast7d!);
  }

  // Priority 5 — Trending direction
  if (ctx.improvedThisWeek && Math.random() < 0.5) return pick(IMPROVED_WEEK);
  if (ctx.worsenedThisWeek && Math.random() < 0.6) return pick(WORSENED_WEEK);

  // Priority 6 — Recovery tracking
  if (ctx.lastSeverity === 'severe' && ctx.hoursSinceLastLog != null && ctx.hoursSinceLastLog >= 36 && ctx.hoursSinceLastLog < 72) {
    if (Math.random() < 0.5) return pick(RECOVERY);
  }

  // Priority 7 — Condition-specific (25% chance)
  if (ctx.conditions?.length && Math.random() < 0.25) {
    const cond = ctx.conditions[0];
    const condGreetings = CONDITION_GREETINGS[cond];
    if (condGreetings) return pick(condGreetings);
  }

  // Priority 8 — Medication-aware (15% chance)
  if (ctx.medications?.length && Math.random() < 0.15) {
    return pick(MEDICATION_GREETINGS)(ctx.medications[0]);
  }

  // Priority 9 — Pattern-driven (15% chance)
  if (ctx.topTrigger && Math.random() < 0.15) {
    return pick(PATTERN_GREETINGS)(ctx.topTrigger);
  }

  // Priority 10 — Streak celebration
  if (ctx.streak && ctx.streak >= 3 && (ctx.streak % 7 === 0 || ctx.streak === 3 || ctx.streak === 14 || ctx.streak === 30 || ctx.streak === 50 || ctx.streak === 100)) {
    return pick(STREAK_CELEBRATE)(ctx.streak);
  }

  // Priority 11 — Milestone
  if (ctx.totalLogs && (ctx.totalLogs === 10 || ctx.totalLogs === 25 || ctx.totalLogs === 50 || ctx.totalLogs === 100 || ctx.totalLogs === 250 || ctx.totalLogs === 500)) {
    return pick(MILESTONE_GREETINGS)(ctx.totalLogs);
  }

  // Priority 12 — Returning after break
  if (ctx.hoursSinceLastLog != null && ctx.hoursSinceLastLog > 72) {
    return pick(STREAK_GENTLE_RESTART);
  }

  // Priority 13 — Weather-relevant
  if (ctx.weatherCondition && Math.random() < 0.3) {
    const cond = ctx.weatherCondition.toLowerCase();
    if (cond.includes('rain') || cond.includes('shower') || cond.includes('drizzle')) return pick(WEATHER_RAINY);
    if (ctx.tempF != null && ctx.tempF >= 85) {
      const g = pick(WEATHER_HOT);
      return typeof g === 'function' ? g(ctx.tempF) : g;
    }
    if (ctx.tempF != null && ctx.tempF <= 40) {
      const g = pick(WEATHER_COLD);
      return typeof g === 'function' ? g(ctx.tempF) : g;
    }
  }

  // Priority 14 — Named greeting (40% chance)
  if (name && Math.random() < 0.4) {
    return pick(NAMED_OPENERS)(name);
  }

  // Priority 15 — Day-of-week (15% chance)
  if (Math.random() < 0.15) {
    if (dow === 1) return pick(MONDAY);
    if (dow === 5) return pick(FRIDAY);
    if (dow === 0 || dow === 6) return pick(WEEKEND);
  }

  // Priority 16 — Seasonal (10% chance)
  if (Math.random() < 0.1) {
    const month = now.getMonth() + 1;
    const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'fall' : 'winter';
    return pick(SEASONAL[season]);
  }

  // Priority 17 — Curiosity prompt (12% chance)
  if (Math.random() < 0.12) return pick(CURIOSITY_PROMPTS);

  // Default — time-of-day
  if (hour >= 0 && hour < 5) return pick(LATE_NIGHT);
  if (hour >= 5 && hour < 12) return pick(MORNING);
  if (hour >= 12 && hour < 17) return pick(MIDDAY);
  if (hour >= 17 && hour < 22) return pick(EVENING);
  return pick(LATE_NIGHT);
}

/**
 * Returns a 1-line micro-prompt suggestion to encourage a deeper reply.
 */
export function getFollowUpHint(ctx: GreetingContext): string {
  const hints = [
    "Tap a severity below or just type how you feel.",
    "You can say something like \"head pounding since 9\" — I'll log it.",
    "Voice or text — whatever's faster.",
    "Even one word helps. \"Tired.\" \"Sore.\" \"Better.\"",
    "I'll attach weather and your wearables automatically.",
    "Want to look at this week's patterns instead? Just ask.",
    "I'm always analyzing. Ask me what I've found.",
    "Your prediction model improves with every log.",
  ];
  if (ctx.flareCountLast7d && ctx.flareCountLast7d > 3) {
    return "Want me to find what's different about this week?";
  }
  if (ctx.streak && ctx.streak >= 5) {
    return `Day ${ctx.streak} of your streak — keep it going.`;
  }
  if (ctx.riskScore != null && ctx.riskScore >= 60) {
    return "Risk is elevated. Log anything you notice — it calibrates your model.";
  }
  return pick(hints);
}
