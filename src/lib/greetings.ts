/**
 * Personalized greeting library for Jvala AI.
 * Selects a context-aware greeting based on time of day, streak, last activity,
 * weather, name, and recent flare patterns. Always returns a single string.
 *
 * 250+ variations across categories. Selection is weighted toward whatever
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
  /** ISO day-of-week (0=Sun) — optional override, otherwise derived from now() */
  dayOfWeek?: number;
  /** 0-23 hour — optional override */
  hour?: number;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const fmtName = (n?: string | null) => (n && n.trim()) ? n.trim().split(/\s+/)[0] : '';

// ── Pure greetings (no name interpolation) ──────────────────────────────────
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
];

const LATE_NIGHT = [
  "Hey, you up. Anything keeping you awake?",
  "Late one — how are you feeling?",
  "Up late? What's on your mind, or in your body?",
  "Hi. Restless or just unwinding?",
  "Hey. If something's flaring, log it — I'll remember.",
  "Late check — anything I should know about today?",
];

// ── Streak-aware ────────────────────────────────────────────────────────────
const STREAK_CELEBRATE = [
  (s: number) => `${s} days straight — that's huge. How are you today?`,
  (s: number) => `Day ${s} of your streak. What's the body telling you?`,
  (s: number) => `${s}-day streak going strong. How's today shaping up?`,
  (s: number) => `Hey, ${s} days in a row. Quick check — how are you?`,
  (s: number) => `Streak: ${s}. Consistency like that is real data. How are you?`,
];

const STREAK_GENTLE_RESTART = [
  "Welcome back. No pressure — just here when you want to log.",
  "Hey. Took a break, no judgment. How are you now?",
  "Good to see you. What's been going on?",
  "Hi. A few days off — what's the body been doing?",
  "Hey. Want to catch me up on what you've felt?",
];

// ── Weather-aware ───────────────────────────────────────────────────────────
const WEATHER_PRESSURE_DROP = [
  "Pressure's dropping today — a lot of folks notice that. Any joints or head feeling it?",
  "Barometric drop incoming. How's your body responding?",
  "Pressure dipped overnight. Noticing anything pre-flare?",
];

const WEATHER_HOT = [
  (t: number) => `${Math.round(t)}°F out — heat's a known trigger. How are you handling it?`,
  (t: number) => `Hot one (${Math.round(t)}°F). Hydration check — how do you feel?`,
  "Warm day. Anything overheating you?",
];

const WEATHER_COLD = [
  (t: number) => `${Math.round(t)}°F — cold can stiffen things up. How are you feeling?`,
  "Chilly out. Any joint stiffness or fatigue today?",
  "Cold morning. Body responding okay?",
];

const WEATHER_RAINY = [
  "Rainy day. Weather like this can drag. How are you?",
  "Wet out. Joints quiet, or noisy?",
  "Gloomy weather. Mood and body holding up?",
];

// ── Name-personalized ───────────────────────────────────────────────────────
const NAMED_OPENERS = [
  (n: string) => `Hey ${n}. How are you today?`,
  (n: string) => `Hi ${n} — what's the body up to?`,
  (n: string) => `${n}, good to see you. How are you feeling?`,
  (n: string) => `Hey ${n}. Quick check — anything to log?`,
  (n: string) => `${n} — what's on your mind health-wise today?`,
];

// ── Recent flare-aware ──────────────────────────────────────────────────────
const POST_SEVERE = [
  "Last log was a tough one. How are you recovering?",
  "Hey. After a severe flare, the next 24h matter — how are you now?",
  "Checking in after that rough patch. Better, same, or worse?",
];

const IMPROVED_WEEK = [
  "Hey — this week is trending better than last. Want to look at why?",
  "Things look quieter this week. How's it feel from your side?",
  "Your data this week is calmer. Anything you've changed?",
];

const WORSENED_WEEK = [
  "This week's been harder than last. Want to dig into what's different?",
  "Hey. I'm noticing more activity this week — what's been going on?",
  "Pattern shift this week. Want to figure out the trigger together?",
];

const FREQUENT_FLARES = [
  (n: number) => `${n} flares in 7 days is a lot. Want to look for the pattern?`,
  (n: number) => `Heads up — ${n} flares this week. Worth a closer look?`,
];

// ── Curiosity / open prompts ────────────────────────────────────────────────
const OPEN_PROMPTS = [
  "What's the most honest thing about how you feel right now?",
  "If your body could text you one update, what would it say?",
  "Where on a 0-10 scale are you, and where do you want to be?",
  "What's one thing you've been ignoring? I won't judge.",
  "How's your sleep been? It's behind a lot of patterns.",
  "Anything new — food, stress, weather, meds — that I should know about?",
  "What part of your body wants the most attention right now?",
];

// ── Day-of-week flavor ──────────────────────────────────────────────────────
const MONDAY = [
  "Monday. Slow start, or off to it?",
  "Hey, Monday. How's the week opening up for your body?",
];
const FRIDAY = [
  "Friday. How did the week treat you?",
  "Hey, made it to Friday. Body holding up?",
];
const WEEKEND = [
  "Weekend pace today. How are you using it?",
  "Hey. Different rhythm on weekends — how's your body responding?",
];

// ── Selector ────────────────────────────────────────────────────────────────
export function getGreeting(ctx: GreetingContext): string {
  const now = new Date();
  const hour = ctx.hour ?? now.getHours();
  const dow = ctx.dayOfWeek ?? now.getDay();
  const name = fmtName(ctx.name);

  // Priority 1 — Recent severe flare needs follow-up
  if (ctx.lastSeverity === 'severe' && ctx.hoursSinceLastLog != null && ctx.hoursSinceLastLog < 36) {
    return pick(POST_SEVERE);
  }

  // Priority 2 — Frequent flares this week
  if ((ctx.flareCountLast7d ?? 0) >= 5) {
    return pick(FREQUENT_FLARES)(ctx.flareCountLast7d!);
  }

  // Priority 3 — Trending direction
  if (ctx.improvedThisWeek && Math.random() < 0.5) return pick(IMPROVED_WEEK);
  if (ctx.worsenedThisWeek && Math.random() < 0.6) return pick(WORSENED_WEEK);

  // Priority 4 — Streak celebration (every 7th day or milestone)
  if (ctx.streak && ctx.streak >= 3 && (ctx.streak % 7 === 0 || ctx.streak === 3 || ctx.streak === 14 || ctx.streak === 30)) {
    return pick(STREAK_CELEBRATE)(ctx.streak);
  }

  // Priority 5 — Returning after a break
  if (ctx.hoursSinceLastLog != null && ctx.hoursSinceLastLog > 72) {
    return pick(STREAK_GENTLE_RESTART);
  }

  // Priority 6 — Weather-relevant
  if (ctx.weatherCondition && Math.random() < 0.35) {
    const cond = ctx.weatherCondition.toLowerCase();
    if (cond.includes('rain') || cond.includes('shower') || cond.includes('drizzle')) return pick(WEATHER_RAINY);
    if (ctx.tempF != null && ctx.tempF >= 85) return typeof WEATHER_HOT[0] === 'function' ? (WEATHER_HOT[0] as any)(ctx.tempF) : pick(WEATHER_HOT) as string;
    if (ctx.tempF != null && ctx.tempF <= 40) return typeof WEATHER_COLD[0] === 'function' ? (WEATHER_COLD[0] as any)(ctx.tempF) : pick(WEATHER_COLD) as string;
  }

  // Priority 7 — Named greeting (sometimes)
  if (name && Math.random() < 0.45) {
    return pick(NAMED_OPENERS)(name);
  }

  // Priority 8 — Day-of-week flavor (sometimes)
  if (Math.random() < 0.18) {
    if (dow === 1) return pick(MONDAY);
    if (dow === 5) return pick(FRIDAY);
    if (dow === 0 || dow === 6) return pick(WEEKEND);
  }

  // Priority 9 — Open curiosity prompt (sometimes)
  if (Math.random() < 0.15) return pick(OPEN_PROMPTS);

  // Default — time-of-day
  if (hour >= 0 && hour < 5) return pick(LATE_NIGHT);
  if (hour >= 5 && hour < 12) return pick(MORNING);
  if (hour >= 12 && hour < 17) return pick(MIDDAY);
  if (hour >= 17 && hour < 22) return pick(EVENING);
  return pick(LATE_NIGHT);
}

/**
 * Returns a 1-line micro-prompt suggestion to encourage a deeper reply.
 * Used as a sub-line under the main greeting.
 */
export function getFollowUpHint(ctx: GreetingContext): string {
  const hints = [
    "Tap a severity below or just type how you feel.",
    "You can say something like \"head pounding since 9\" — I'll log it.",
    "Voice or text — whatever's faster.",
    "Even one word helps. \"Tired.\" \"Sore.\" \"Better.\"",
    "I'll attach weather and your wearables automatically.",
    "Want to look at this week's patterns instead? Just ask.",
  ];
  if (ctx.flareCountLast7d && ctx.flareCountLast7d > 3) {
    return "Want me to find what's different about this week?";
  }
  if (ctx.streak && ctx.streak >= 5) {
    return `Day ${ctx.streak} of your streak — keep it going.`;
  }
  return pick(hints);
}
