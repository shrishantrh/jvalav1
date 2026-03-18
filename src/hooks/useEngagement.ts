import { supabase } from "@/integrations/supabase/client";
import {
  format,
  parseISO,
  differenceInDays,
  subDays,
  isSameDay,
  getDay,
} from "date-fns";
import { ALL_BADGES } from "@/data/allBadges";

interface EntryRow {
  timestamp: string;
  entry_type: string;
  severity: string | null;
  symptoms: string[] | null;
  triggers: string[] | null;
  medications: string[] | null;
  note: string | null;
  photos: string[] | null;
  voice_transcript: string | null;
  energy_level: string | null;
  city: string | null;
  environmental_data: any;
  physiological_data: any;
}

interface BadgeStats {
  userId: string;
  entries: EntryRow[];
  engagement: any;
  profile: any;
  correlationCount: number;
  exportCount: number;
  shareCount: number;
  medicationLogCount: number;
  aiChatCount: number;
  predictionCount: number;
  wearableConnected: boolean;
  userRank: number;
  firstProfileCreatedAt: Date | null;
}

export interface BadgeProgressInfo {
  current: number;
  target: number;
  progress: number;
  label: string;
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

const safeDate = (value: string | Date) => {
  const d = value instanceof Date ? value : parseISO(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const normalizeDay = (value: string | Date) => format(safeDate(value), "yyyy-MM-dd");

const unique = <T,>(arr: T[]) => Array.from(new Set(arr));

const countEmojis = (text: string) => {
  const matches = text.match(/[\p{Extended_Pictographic}]/gu);
  return matches?.length ?? 0;
};

const isPalindromeDate = (date: Date) => {
  const ymd = format(date, "yyyyMMdd");
  return ymd === ymd.split("").reverse().join("");
};

const isThanksgiving = (date: Date) => {
  const month = date.getMonth();
  if (month !== 10) return false; // November
  if (date.getDay() !== 4) return false; // Thursday
  const day = date.getDate();
  return day >= 22 && day <= 28;
};

const getMoonIllumination = (entry: EntryRow) => {
  return Number(entry.environmental_data?.astronomy?.moonIllumination ?? 0);
};

const hasFibonacciWindow = (entries: EntryRow[]) => {
  if (entries.length === 0) return false;
  const countByDay = new Map<string, number>();
  entries.forEach((e) => {
    const d = normalizeDay(e.timestamp);
    countByDay.set(d, (countByDay.get(d) ?? 0) + 1);
  });

  const days = Array.from(countByDay.keys()).sort();
  const fib = [1, 1, 2, 3, 5];
  for (let i = 0; i <= days.length - 5; i++) {
    const slice = days.slice(i, i + 5);
    const counts = slice.map((d) => countByDay.get(d) ?? 0);
    if (counts.every((c, idx) => c === fib[idx])) return true;
  }
  return false;
};

const getProfileCompleteness = (profile: any) => {
  const checks = [
    !!profile?.full_name,
    !!profile?.date_of_birth,
    !!profile?.biological_sex,
    (profile?.conditions?.length ?? 0) > 0,
    (profile?.known_symptoms?.length ?? 0) > 0,
    (profile?.known_triggers?.length ?? 0) > 0,
    !!profile?.timezone,
  ];
  const completed = checks.filter(Boolean).length;
  return { completed, total: checks.length };
};

const addProgress = (
  map: Record<string, BadgeProgressInfo>,
  id: string,
  current: number,
  target: number,
  label: string
) => {
  const safeTarget = Math.max(1, target);
  map[id] = {
    current: Math.max(0, current),
    target: safeTarget,
    progress: clamp((Math.max(0, current) / safeTarget) * 100),
    label,
  };
};

const buildBadgeProgressMap = (stats: BadgeStats): Record<string, BadgeProgressInfo> => {
  const progressMap: Record<string, BadgeProgressInfo> = {};
  ALL_BADGES.forEach((b) => addProgress(progressMap, b.id, 0, 1, "Not started"));

  const entries = stats.entries;
  const engagement = stats.engagement || {};
  const profile = stats.profile || {};
  const metadata = (profile.metadata as Record<string, any>) || {};

  const totalLogs = entries.length;
  const currentStreak = Number(engagement.current_streak ?? 0);
  const longestStreak = Number(engagement.longest_streak ?? 0);

  const symptomSet = new Set<string>();
  const triggerSet = new Set<string>();
  const citySet = new Set<string>();
  const countrySet = new Set<string>();
  const timezoneSet = new Set<string>();
  const severitySet = new Set<string>();

  let detailedCount = 0;
  let photoCount = 0;
  let voiceCount = 0;
  let medEntryCount = 0;
  let energyCount = 0;
  let weatherCount = 0;
  let novelWriter = false;
  let emojiMaster = false;
  let midnightCount = 0;
  let palindromeCount = 0;
  let lucky7Count = 0;
  let fullMoonCount = 0;
  let beachCount = 0;
  let mountainCount = 0;

  const sortedEntries = [...entries].sort((a, b) => safeDate(a.timestamp).getTime() - safeDate(b.timestamp).getTime());

  sortedEntries.forEach((entry) => {
    (entry.symptoms || []).forEach((s) => symptomSet.add(s));
    (entry.triggers || []).forEach((t) => triggerSet.add(t));
    if (entry.city) citySet.add(entry.city);

    const country = entry.environmental_data?.location?.country;
    if (country) countrySet.add(country);

    const tz = entry.environmental_data?.location?.timezone;
    if (tz) timezoneSet.add(tz);

    if (entry.severity) severitySet.add(entry.severity);
    if ((entry.photos?.length ?? 0) > 0) photoCount += 1;
    if (entry.voice_transcript) voiceCount += 1;
    if ((entry.medications?.length ?? 0) > 0) medEntryCount += 1;
    if (entry.energy_level) energyCount += 1;
    if (entry.environmental_data) weatherCount += 1;

    const isDetailed =
      (entry.symptoms?.length ?? 0) > 0 ||
      (entry.triggers?.length ?? 0) > 0 ||
      !!entry.note ||
      (entry.medications?.length ?? 0) > 0 ||
      (entry.photos?.length ?? 0) > 0 ||
      !!entry.voice_transcript ||
      !!entry.energy_level;
    if (isDetailed) detailedCount += 1;

    if ((entry.note ?? "").length > 500) novelWriter = true;
    if (countEmojis(entry.note ?? "") >= 10) emojiMaster = true;

    const ts = safeDate(entry.timestamp);
    if (ts.getHours() === 0 && ts.getMinutes() < 5) midnightCount += 1;
    if (isPalindromeDate(ts)) palindromeCount += 1;
    if (ts.getDate() === 7) lucky7Count += 1;

    if (getMoonIllumination(entry) >= 95) fullMoonCount += 1;

    const locationText = `${entry.city || ""} ${entry.environmental_data?.location?.region || ""}`.toLowerCase();
    if (/(beach|coast|ocean|bay|shore)/.test(locationText)) beachCount += 1;
    if (/(mountain|alps|rocky|hill|peak)/.test(locationText)) mountainCount += 1;
  });

  // 3 entries in 3 hours
  let tripleThreat = false;
  for (let i = 0; i < sortedEntries.length - 2; i++) {
    const t1 = safeDate(sortedEntries[i].timestamp).getTime();
    const t3 = safeDate(sortedEntries[i + 2].timestamp).getTime();
    if (t3 - t1 <= 3 * 60 * 60 * 1000) {
      tripleThreat = true;
      break;
    }
  }

  // day buckets
  const dayMap = new Map<string, EntryRow[]>();
  sortedEntries.forEach((entry) => {
    const day = normalizeDay(entry.timestamp);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(entry);
  });

  // time-of-day badges
  let earlyCount = 0;
  let nightCount = 0;
  let lunchCount = 0;
  const hourBuckets = new Map<number, number>();
  sortedEntries.forEach((e) => {
    const h = safeDate(e.timestamp).getHours();
    if (h < 7) earlyCount += 1;
    if (h >= 22) nightCount += 1;
    if (h >= 11 && h <= 13) lunchCount += 1;
    hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
  });
  const routineCount = Math.max(0, ...Array.from(hourBuckets.values()));

  // Perfect week, Monday, weekend
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => normalizeDay(subDays(today, i)));
  const perfectWeekDays = last7Days.filter((d) => dayMap.has(d)).length;

  let mondayCount = 0;
  let weekendDayCount = 0;
  for (let i = 0; i < 28; i++) {
    const d = subDays(today, i);
    const key = normalizeDay(d);
    const dow = getDay(d);
    if (dow === 1 && dayMap.has(key)) mondayCount += 1;
    if ((dow === 0 || dow === 6) && dayMap.has(key)) weekendDayCount += 1;
  }

  // Flare-free streak in logged days
  const loggedDays = Array.from(dayMap.keys()).sort();
  let flareFreeDays = 0;
  for (let i = loggedDays.length - 1; i >= 0; i--) {
    const entriesForDay = dayMap.get(loggedDays[i]) || [];
    const hasFlare = entriesForDay.some((e) => e.entry_type === "flare" && !!e.severity);
    if (hasFlare) break;
    flareFreeDays += 1;
  }

  // improving trend + recovery
  const severityScore: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };
  const scored = sortedEntries
    .filter((e) => !!e.severity)
    .map((e) => ({ ...e, score: severityScore[e.severity as string] ?? 0 }))
    .filter((e) => e.score > 0);

  const recent7 = scored.slice(-7);
  const previous7 = scored.slice(-14, -7);
  const avg = (arr: typeof recent7) => (arr.length ? arr.reduce((s, x) => s + x.score, 0) / arr.length : 0);
  const trendImprovement = previous7.length >= 3 && recent7.length >= 3 ? avg(previous7) - avg(recent7) : 0;
  const improvingTrend = trendImprovement > 0.2;

  let recoveryChampion = false;
  for (let i = 0; i < scored.length; i++) {
    if (scored[i].severity !== "severe") continue;
    const severeAt = safeDate(scored[i].timestamp).getTime();
    const recovered = scored.some(
      (e) => e.severity === "mild" && safeDate(e.timestamp).getTime() > severeAt && safeDate(e.timestamp).getTime() <= severeAt + 48 * 60 * 60 * 1000
    );
    if (recovered) {
      recoveryChampion = true;
      break;
    }
  }

  // sleep / hydration
  const sleepGoodDays = unique(
    sortedEntries
      .filter((e) => Number(e.physiological_data?.sleep_hours ?? 0) >= 7)
      .map((e) => normalizeDay(e.timestamp))
  ).length;

  const hydrationDays = unique(
    sortedEntries
      .filter((e) => /water|hydration|hydrated|drank/i.test(e.note ?? ""))
      .map((e) => normalizeDay(e.timestamp))
  ).length;

  // seasonal + dates
  const monthSet = new Set(sortedEntries.map((e) => safeDate(e.timestamp).getMonth()));
  const hasDate = (m: number, d: number) => sortedEntries.some((e) => {
    const dt = safeDate(e.timestamp);
    return dt.getMonth() + 1 === m && dt.getDate() === d;
  });

  const hasThanksgiving = sortedEntries.some((e) => isThanksgiving(safeDate(e.timestamp)));

  // birthday
  let birthdayLogs = 0;
  if (profile?.date_of_birth) {
    const dob = safeDate(profile.date_of_birth);
    const m = dob.getMonth();
    const d = dob.getDate();
    birthdayLogs = sortedEntries.filter((e) => {
      const dt = safeDate(e.timestamp);
      return dt.getMonth() === m && dt.getDate() === d;
    }).length;
  }

  // feature counts
  const insightViews = Number(metadata.insight_view_count ?? 0);
  const insightTabsViewed = new Set<string>(metadata.insight_tabs_viewed ?? []);
  const themeChangeCount = Number(metadata.theme_change_count ?? 0);
  const settingsVisitCount = Number(metadata.settings_visit_count ?? 0);
  const feedbackCount = Number(metadata.feedback_sent_count ?? 0);
  const customTrackablesCount = Number((metadata.customTrackables || []).length);

  const profileComplete = getProfileCompleteness(profile);
  const accountAgeDays = stats.profile?.created_at ? differenceInDays(new Date(), safeDate(stats.profile.created_at)) : 0;

  const featureUsageCount = [
    totalLogs > 0,
    detailedCount > 0,
    photoCount > 0,
    voiceCount > 0,
    medEntryCount > 0,
    weatherCount > 0,
    symptomSet.size > 0,
    triggerSet.size > 0,
    stats.correlationCount > 0,
    insightViews > 0,
    stats.exportCount > 0,
    stats.shareCount > 0,
    stats.wearableConnected,
    customTrackablesCount > 0,
    settingsVisitCount > 0,
    themeChangeCount > 0,
    Boolean(engagement.reminder_enabled),
  ].filter(Boolean).length;

  // === Milestones ===
  addProgress(progressMap, "first_log", totalLogs, 1, "logs recorded");
  addProgress(progressMap, "logs_10", totalLogs, 10, "total logs");
  addProgress(progressMap, "logs_25", totalLogs, 25, "total logs");
  addProgress(progressMap, "logs_50", totalLogs, 50, "total logs");
  addProgress(progressMap, "logs_100", totalLogs, 100, "total logs");
  addProgress(progressMap, "logs_250", totalLogs, 250, "total logs");
  addProgress(progressMap, "logs_500", totalLogs, 500, "total logs");
  addProgress(progressMap, "logs_1000", totalLogs, 1000, "total logs");
  addProgress(progressMap, "logs_2500", totalLogs, 2500, "total logs");

  // === Streak ===
  addProgress(progressMap, "streak_3", currentStreak, 3, "day streak");
  addProgress(progressMap, "streak_7", currentStreak, 7, "day streak");
  addProgress(progressMap, "streak_14", currentStreak, 14, "day streak");
  addProgress(progressMap, "streak_21", currentStreak, 21, "day streak");
  addProgress(progressMap, "streak_30", currentStreak, 30, "day streak");
  addProgress(progressMap, "streak_60", currentStreak, 60, "day streak");
  addProgress(progressMap, "streak_90", currentStreak, 90, "day streak");
  addProgress(progressMap, "streak_180", currentStreak, 180, "day streak");
  addProgress(progressMap, "streak_365", currentStreak, 365, "day streak");
  addProgress(progressMap, "streak_comeback", longestStreak > currentStreak && currentStreak >= 7 ? 1 : 0, 1, "rebuilt streak after reset");

  // === Consistency ===
  addProgress(progressMap, "perfect_week", perfectWeekDays, 7, "days logged in last 7");
  addProgress(progressMap, "consistency_king", Math.round((perfectWeekDays / 7) * 100), 80, "% consistency (month target 80%)");
  addProgress(progressMap, "never_miss_monday", mondayCount, 4, "Mondays logged (last 4 weeks)");
  addProgress(progressMap, "weekend_warrior", weekendDayCount, 8, "weekend days logged (last 4 weeks)");
  addProgress(progressMap, "early_bird", earlyCount, 10, "logs before 7 AM");
  addProgress(progressMap, "night_owl", nightCount, 10, "logs after 10 PM");
  addProgress(progressMap, "lunch_logger", lunchCount, 10, "logs between 11 AM–1 PM");
  addProgress(progressMap, "routine_master", routineCount, 14, "logs at your most common hour");

  // === Feature ===
  addProgress(progressMap, "detailed_first", detailedCount, 1, "detailed logs");
  addProgress(progressMap, "photo_first", photoCount, 1, "logs with photos");
  addProgress(progressMap, "photo_10", photoCount, 10, "logs with photos");
  addProgress(progressMap, "voice_first", voiceCount, 1, "logs with voice notes");
  addProgress(progressMap, "voice_10", voiceCount, 10, "logs with voice notes");
  addProgress(progressMap, "export_pro", stats.exportCount, 1, "exports generated");
  addProgress(progressMap, "share_master", stats.shareCount, 1, "reports shared with provider");
  addProgress(progressMap, "ai_chatter", stats.aiChatCount, 50, "AI chat messages sent");
  addProgress(progressMap, "wearable_connected", stats.wearableConnected ? 1 : 0, 1, "wearable connected");
  addProgress(progressMap, "custom_shortcut", customTrackablesCount, 1, "custom shortcuts configured");

  // === Tracking ===
  addProgress(progressMap, "symptom_tracker", symptomSet.size, 10, "unique symptoms logged");
  addProgress(progressMap, "symptom_master", symptomSet.size, 25, "unique symptoms logged");
  addProgress(progressMap, "trigger_detective", triggerSet.size, 10, "unique triggers logged");
  addProgress(progressMap, "trigger_master", triggerSet.size, 25, "unique triggers logged");
  addProgress(progressMap, "med_tracker", medEntryCount + stats.medicationLogCount, 20, "medication logs");
  addProgress(progressMap, "med_adherent", unique(sortedEntries.filter((e) => (e.medications?.length ?? 0) > 0).map((e) => normalizeDay(e.timestamp))).length, 7, "days with medication logged");
  addProgress(progressMap, "energy_tracker", energyCount, 20, "energy logs");
  addProgress(progressMap, "mood_master", severitySet.size, 3, "severity types logged");
  addProgress(progressMap, "weather_watcher", weatherCount, 50, "logs with weather data");
  addProgress(progressMap, "location_tracker", citySet.size, 10, "unique cities logged");

  // === Insight ===
  addProgress(progressMap, "pattern_detective", stats.correlationCount, 1, "correlations discovered");
  addProgress(progressMap, "health_analyst", stats.correlationCount, 5, "correlations discovered");
  addProgress(progressMap, "data_scientist", stats.correlationCount, 10, "correlations discovered");
  addProgress(progressMap, "insight_seeker", insightViews, 10, "insights tab visits");
  addProgress(progressMap, "chart_reader", insightTabsViewed.size, 4, "insight tabs viewed (AI/Safety/Charts/Map)");
  addProgress(progressMap, "prediction_pro", stats.predictionCount, 5, "predictions received");

  // === Engagement ===
  addProgress(progressMap, "profile_complete", profileComplete.completed, profileComplete.total, "profile fields completed");
  addProgress(progressMap, "settings_explorer", settingsVisitCount, 1, "settings visits");
  addProgress(progressMap, "theme_changer", themeChangeCount, 1, "theme changes");
  addProgress(progressMap, "reminder_set", engagement.reminder_enabled ? 1 : 0, 1, "reminders enabled");
  addProgress(progressMap, "feedback_giver", feedbackCount, 1, "feedback actions");
  addProgress(progressMap, "app_veteran", accountAgeDays, 30, "days since signup");
  addProgress(progressMap, "power_user", featureUsageCount, 10, "features used");

  // === Wellness ===
  addProgress(progressMap, "flare_free_3", flareFreeDays, 3, "consecutive logged flare-free days");
  addProgress(progressMap, "flare_free_7", flareFreeDays, 7, "consecutive logged flare-free days");
  addProgress(progressMap, "flare_free_14", flareFreeDays, 14, "consecutive logged flare-free days");
  addProgress(progressMap, "flare_free_30", flareFreeDays, 30, "consecutive logged flare-free days");
  addProgress(progressMap, "improving_trend", improvingTrend ? 1 : 0, 1, "severity trend improved over 2 weeks");
  addProgress(progressMap, "recovery_champion", recoveryChampion ? 1 : 0, 1, "mild log within 48h of severe flare");
  addProgress(progressMap, "sleep_champion", sleepGoodDays, 7, "days with 7h+ sleep data");
  addProgress(progressMap, "hydration_hero", hydrationDays, 7, "hydration-tracked days");

  // === Adventure ===
  addProgress(progressMap, "globe_trotter", countrySet.size, 3, "countries logged");
  addProgress(progressMap, "world_traveler", countrySet.size, 5, "countries logged");
  addProgress(progressMap, "road_tripper", citySet.size, 5, "cities logged");
  addProgress(progressMap, "city_hopper", citySet.size, 10, "cities logged");
  addProgress(progressMap, "nomad", citySet.size, 1, "new locations logged");
  addProgress(progressMap, "beach_logger", beachCount, 1, "coastal logs detected");
  addProgress(progressMap, "mountain_tracker", mountainCount, 1, "mountain logs detected");
  addProgress(progressMap, "timezone_jumper", timezoneSet.size, 3, "timezones logged");

  // === Seasonal ===
  addProgress(progressMap, "new_year_logger", hasDate(1, 1) ? 1 : 0, 1, "logged on January 1");
  addProgress(progressMap, "valentines_care", hasDate(2, 14) ? 1 : 0, 1, "logged on February 14");
  addProgress(progressMap, "spring_tracker", [2, 3, 4].some((m) => monthSet.has(m)) ? 1 : 0, 1, "spring logs");
  addProgress(progressMap, "summer_logger", [5, 6, 7].some((m) => monthSet.has(m)) ? 1 : 0, 1, "summer logs");
  addProgress(progressMap, "fall_tracker", [8, 9, 10].some((m) => monthSet.has(m)) ? 1 : 0, 1, "fall logs");
  addProgress(progressMap, "winter_warrior", [11, 0, 1].some((m) => monthSet.has(m)) ? 1 : 0, 1, "winter logs");
  addProgress(progressMap, "halloween_logger", hasDate(10, 31) ? 1 : 0, 1, "logged on October 31");
  addProgress(progressMap, "thanksgiving_gratitude", hasThanksgiving ? 1 : 0, 1, "logged on Thanksgiving");
  addProgress(progressMap, "holiday_health", hasDate(12, 25) ? 1 : 0, 1, "logged on December 25");
  addProgress(progressMap, "birthday_log", birthdayLogs, 1, "logged on your birthday");

  // === Secret ===
  addProgress(progressMap, "midnight_logger", midnightCount, 1, "midnight logs");
  addProgress(progressMap, "palindrome_day", palindromeCount, 1, "palindrome date logs");
  addProgress(progressMap, "lucky_7", lucky7Count, 7, "logs made on day 7");
  addProgress(progressMap, "triple_threat", tripleThreat ? 1 : 0, 1, "3 logs within 3 hours");
  addProgress(progressMap, "quick_draw", Number(metadata.quick_draw_count ?? 0), 1, "fast quick logs (<5s)");
  addProgress(progressMap, "novel_writer", novelWriter ? 1 : 0, 1, "500+ char note");
  addProgress(progressMap, "emoji_master", emojiMaster ? 1 : 0, 1, "10+ emoji in one note");
  addProgress(progressMap, "full_moon", fullMoonCount, 1, "logged near full moon");
  addProgress(progressMap, "fibonacci", hasFibonacciWindow(sortedEntries) ? 1 : 0, 1, "1,1,2,3,5 daily pattern");
  addProgress(progressMap, "pi_day", hasDate(3, 14) ? 1 : 0, 1, "logged on March 14");
  addProgress(progressMap, "leap_year", hasDate(2, 29) ? 1 : 0, 1, "logged on February 29");
  addProgress(progressMap, "solar_eclipse", Number(metadata.solar_eclipse_logged ?? 0), 1, "eclipse log flag");

  // === Special ===
  addProgress(progressMap, "early_adopter", stats.userRank > 0 && stats.userRank <= 1000 ? 1 : 0, 1, "first 1000 users");
  addProgress(progressMap, "beta_tester", Number(metadata.beta_tester ?? 0), 1, "beta tester flag");
  addProgress(progressMap, "bug_hunter", Number(metadata.bug_report_count ?? 0), 1, "bug reports sent");

  const createdAt = profile?.created_at ? safeDate(profile.created_at) : null;
  const isFoundingMember =
    createdAt && stats.firstProfileCreatedAt
      ? differenceInDays(createdAt, stats.firstProfileCreatedAt) <= 30
      : false;
  addProgress(progressMap, "founding_member", isFoundingMember ? 1 : 0, 1, "joined in first month");

  return progressMap;
};

const ensureEngagementRow = async (userId: string, totalLogs: number) => {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: engagement } = await supabase
    .from("engagement")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!engagement) {
    await supabase.from("engagement").insert({
      user_id: userId,
      current_streak: Math.min(1, totalLogs),
      longest_streak: Math.min(1, totalLogs),
      total_logs: totalLogs,
      last_log_date: totalLogs > 0 ? today : null,
      badges: totalLogs > 0 ? ["first_log"] : [],
    });
  }
};

const getBadgeStats = async (userId: string): Promise<BadgeStats | null> => {
  try {
    const [engagementRes, entriesRes, correlationRes, profileRes, exportRes, shareRes, fitbitRes, ouraRes, medicationRes, aiChatRes, predictionRes] =
      await Promise.all([
        supabase.from("engagement").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("flare_entries")
          .select(
            "timestamp, entry_type, severity, symptoms, triggers, medications, note, photos, voice_transcript, energy_level, city, environmental_data, physiological_data"
          )
          .eq("user_id", userId),
        supabase.from("correlations").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("profiles")
          .select("id, created_at, metadata, full_name, date_of_birth, biological_sex, conditions, known_symptoms, known_triggers, timezone")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("report_exports").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("physician_access").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("fitbit_tokens").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("oura_tokens").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("medication_logs").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("sms_conversations").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user"),
        supabase.from("discoveries").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

    const profile = profileRes.data;
    let userRank = 0;
    let firstProfileCreatedAt: Date | null = null;

    if (profile?.created_at) {
      const [rankRes, firstRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).lte("created_at", profile.created_at),
        supabase.from("profiles").select("created_at").order("created_at", { ascending: true }).limit(1),
      ]);
      userRank = rankRes.count || 0;
      firstProfileCreatedAt = firstRes.data?.[0]?.created_at ? safeDate(firstRes.data[0].created_at) : null;
    }

    const entries = (entriesRes.data || []) as EntryRow[];
    const wearableConnected =
      (fitbitRes.count || 0) > 0 ||
      (ouraRes.count || 0) > 0 ||
      entries.some((e) => ["apple_health", "google_fit", "fitbit", "oura"].includes(String(e.physiological_data?.source ?? "")));

    return {
      userId,
      entries,
      engagement: engagementRes.data || {},
      profile: profile || {},
      correlationCount: correlationRes.count || 0,
      exportCount: exportRes.count || 0,
      shareCount: shareRes.count || 0,
      medicationLogCount: medicationRes.count || 0,
      aiChatCount: aiChatRes.count || 0,
      predictionCount: predictionRes.count || 0,
      wearableConnected,
      userRank,
      firstProfileCreatedAt,
    };
  } catch (error) {
    console.error("Failed to build badge stats:", error);
    return null;
  }
};

const mergeUnique = (arr: string[]) => Array.from(new Set(arr));

export const useEngagement = () => {
  const evaluateAndPersistBadges = async (userId: string): Promise<{ newBadges: string[]; progressMap: Record<string, BadgeProgressInfo> }> => {
    const stats = await getBadgeStats(userId);
    if (!stats) return { newBadges: [], progressMap: {} };

    await ensureEngagementRow(userId, stats.entries.length);

    const progressMap = buildBadgeProgressMap(stats);
    const unlockable = Object.entries(progressMap)
      .filter(([, v]) => v.progress >= 100)
      .map(([badgeId]) => badgeId);

    const { data: engagement } = await supabase
      .from("engagement")
      .select("badges")
      .eq("user_id", userId)
      .maybeSingle();

    const existingBadges = (engagement?.badges || []) as string[];
    const newBadges = unlockable.filter((id) => !existingBadges.includes(id));

    if (newBadges.length > 0) {
      await supabase
        .from("engagement")
        .update({ badges: mergeUnique([...existingBadges, ...newBadges]) })
        .eq("user_id", userId);
    }

    return { newBadges, progressMap };
  };

  const updateEngagementOnLog = async (
    userId: string,
    _isDetailed?: boolean
  ): Promise<{ newBadges: string[]; streakIncreased: boolean; currentStreak: number }> => {
    try {
      const [{ data: engagement }, { count: totalEntries }] = await Promise.all([
        supabase.from("engagement").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("flare_entries").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      const actualTotalLogs = totalEntries || 0;
      const today = format(new Date(), "yyyy-MM-dd");

      let newStreak = engagement?.current_streak || 0;
      let streakIncreased = false;

      if (!engagement) {
        newStreak = 1;
        streakIncreased = true;
        await supabase.from("engagement").insert({
          user_id: userId,
          current_streak: 1,
          longest_streak: 1,
          total_logs: actualTotalLogs,
          last_log_date: today,
          badges: [],
        });
      } else if (engagement.last_log_date !== today) {
        const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
        if (engagement.last_log_date === yesterday) {
          newStreak = (engagement.current_streak || 0) + 1;
          streakIncreased = true;
        } else {
          newStreak = 1;
          streakIncreased = true;
        }

        await supabase
          .from("engagement")
          .update({
            current_streak: newStreak,
            longest_streak: Math.max(engagement.longest_streak || 0, newStreak),
            total_logs: actualTotalLogs,
            last_log_date: today,
          })
          .eq("user_id", userId);
      } else {
        await supabase.from("engagement").update({ total_logs: actualTotalLogs }).eq("user_id", userId);
      }

      const { newBadges } = await evaluateAndPersistBadges(userId);
      return { newBadges, streakIncreased, currentStreak: newStreak || 1 };
    } catch (error) {
      console.error("Failed to update engagement:", error);
      return { newBadges: [], streakIncreased: false, currentStreak: 0 };
    }
  };

  const getEngagement = async (userId: string) => {
    const { data } = await supabase.from("engagement").select("*").eq("user_id", userId).maybeSingle();
    return data;
  };

  const awardBadge = async (userId: string, badgeId: string): Promise<boolean> => {
    try {
      const { data: engagement } = await supabase
        .from("engagement")
        .select("badges")
        .eq("user_id", userId)
        .maybeSingle();

      const existingBadges = (engagement?.badges || []) as string[];
      if (existingBadges.includes(badgeId)) return false;

      await supabase
        .from("engagement")
        .update({ badges: mergeUnique([...existingBadges, badgeId]) })
        .eq("user_id", userId);

      return true;
    } catch (error) {
      console.error("Failed to award badge:", error);
      return false;
    }
  };

  const checkCorrelationBadges = async (userId: string): Promise<string[]> => {
    const { newBadges } = await evaluateAndPersistBadges(userId);
    const correlationBadges = new Set(["pattern_detective", "health_analyst", "data_scientist"]);
    return newBadges.filter((b) => correlationBadges.has(b));
  };

  const checkTrackingBadges = async (userId: string): Promise<string[]> => {
    const { newBadges } = await evaluateAndPersistBadges(userId);
    const trackingBadges = new Set([
      "symptom_tracker",
      "symptom_master",
      "trigger_detective",
      "trigger_master",
      "med_tracker",
      "med_adherent",
      "energy_tracker",
      "mood_master",
      "weather_watcher",
      "location_tracker",
      "photo_10",
      "voice_10",
      "road_tripper",
      "city_hopper",
      "nomad",
    ]);
    return newBadges.filter((b) => trackingBadges.has(b));
  };

  const checkConsistencyBadges = async (_userId: string, _entries: { timestamp: Date }[]): Promise<string[]> => {
    const { newBadges } = await evaluateAndPersistBadges(_userId);
    const consistencyBadges = new Set([
      "perfect_week",
      "consistency_king",
      "never_miss_monday",
      "weekend_warrior",
      "early_bird",
      "night_owl",
      "lunch_logger",
      "routine_master",
    ]);
    return newBadges.filter((b) => consistencyBadges.has(b));
  };

  const syncEngagementTotals = async (userId: string) => {
    try {
      const { count } = await supabase.from("flare_entries").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (count !== null) {
        await supabase.from("engagement").upsert({ user_id: userId, total_logs: count }, { onConflict: "user_id" });
      }
    } catch (error) {
      console.error("Failed to sync engagement:", error);
    }
  };

  const recordFeatureEvent = async (
    userId: string,
    event:
      | "settings_visit"
      | "theme_change"
      | "insights_view"
      | "insights_tab_ai"
      | "insights_tab_safety"
      | "insights_tab_charts"
      | "insights_tab_local"
      | "export_used"
      | "report_shared"
      | "wearable_connected"
      | "custom_shortcut_added"
      | "reminder_enabled"
      | "feedback_sent"
      | "bug_report"
      | "quick_draw",
    increment = 1
  ) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("metadata").eq("id", userId).maybeSingle();
      const metadata = ((profile?.metadata as Record<string, any>) || {}) as Record<string, any>;

      const add = (key: string, amount = 1) => {
        metadata[key] = Number(metadata[key] || 0) + amount;
      };

      switch (event) {
        case "settings_visit":
          add("settings_visit_count", increment);
          break;
        case "theme_change":
          add("theme_change_count", increment);
          break;
        case "insights_view":
          add("insight_view_count", increment);
          break;
        case "insights_tab_ai":
        case "insights_tab_safety":
        case "insights_tab_charts":
        case "insights_tab_local": {
          const tab = event.replace("insights_tab_", "");
          const current = new Set<string>(metadata.insight_tabs_viewed || []);
          current.add(tab);
          metadata.insight_tabs_viewed = Array.from(current);
          break;
        }
        case "export_used":
          add("export_count", increment);
          break;
        case "report_shared":
          add("provider_share_count", increment);
          break;
        case "wearable_connected":
          metadata.wearable_connected = true;
          add("wearable_connect_count", increment);
          break;
        case "custom_shortcut_added":
          add("custom_shortcut_count", increment);
          break;
        case "reminder_enabled":
          add("reminder_enable_count", increment);
          await supabase.from("engagement").upsert({ user_id: userId, reminder_enabled: true }, { onConflict: "user_id" });
          break;
        case "feedback_sent":
          add("feedback_sent_count", increment);
          break;
        case "bug_report":
          add("bug_report_count", increment);
          break;
        case "quick_draw":
          add("quick_draw_count", increment);
          break;
      }

      await supabase.from("profiles").update({ metadata: metadata as any }).eq("id", userId);
      await evaluateAndPersistBadges(userId);
    } catch (error) {
      console.error("Failed to record feature event:", error);
    }
  };

  const getBadgeProgress = async (userId: string): Promise<Record<string, BadgeProgressInfo>> => {
    const stats = await getBadgeStats(userId);
    if (!stats) return {};
    return buildBadgeProgressMap(stats);
  };

  const runFullBadgeAudit = async (userId: string) => {
    const { newBadges } = await evaluateAndPersistBadges(userId);
    return newBadges;
  };

  return {
    updateEngagementOnLog,
    getEngagement,
    syncEngagementTotals,
    awardBadge,
    checkCorrelationBadges,
    checkTrackingBadges,
    checkConsistencyBadges,
    recordFeatureEvent,
    getBadgeProgress,
    runFullBadgeAudit,
  };
};