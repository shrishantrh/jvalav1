/**
 * Native App Store rating prompt (iOS: SKStoreReviewController, Android: In-App Review API).
 *
 * Apple limits the system prompt to ~3 displays per 365 days per device, so we never call it
 * more than once per app launch and gate by positive engagement milestones:
 *   - User has logged ≥ 5 entries
 *   - At least 7 days since first launch (or 14 days since last prompt)
 *   - Not already rated this session
 *   - Last prompt was ≥ 90 days ago
 *
 * We also expose a manual "Rate Jvala" button that always opens the App Store page.
 */
import { isNative, platform } from '@/lib/capacitor';

const APP_STORE_ID = '6759641361';
const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
const APP_STORE_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;

const STORAGE_KEYS = {
  firstLaunchAt: 'jvala_first_launch_at',
  lastPromptAt: 'jvala_last_review_prompt_at',
  promptedThisSession: 'jvala_review_prompted_session',
  positiveEvents: 'jvala_positive_event_count',
} as const;

function now() {
  return Date.now();
}

function getNumber(key: string, fallback = 0): number {
  try {
    const v = localStorage.getItem(key);
    return v ? Number(v) || fallback : fallback;
  } catch {
    return fallback;
  }
}

function setNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota / privacy mode */
  }
}

/** Mark the first launch timestamp once. Call from app bootstrap. */
export function markFirstLaunchIfNeeded() {
  if (!getNumber(STORAGE_KEYS.firstLaunchAt)) {
    setNumber(STORAGE_KEYS.firstLaunchAt, now());
  }
}

/** Increment positive event counter (e.g. successful log, milestone reached). */
export function recordPositiveEvent() {
  setNumber(STORAGE_KEYS.positiveEvents, getNumber(STORAGE_KEYS.positiveEvents) + 1);
}

/** Whether the eligibility window is open right now. */
export function isReviewEligible(): boolean {
  const firstLaunch = getNumber(STORAGE_KEYS.firstLaunchAt);
  const lastPrompt = getNumber(STORAGE_KEYS.lastPromptAt);
  const positiveEvents = getNumber(STORAGE_KEYS.positiveEvents);
  const sessionPrompted = sessionStorage.getItem(STORAGE_KEYS.promptedThisSession) === '1';

  if (sessionPrompted) return false;
  if (positiveEvents < 5) return false;

  const SEVEN_DAYS = 7 * 86400_000;
  const NINETY_DAYS = 90 * 86400_000;

  if (firstLaunch && now() - firstLaunch < SEVEN_DAYS) return false;
  if (lastPrompt && now() - lastPrompt < NINETY_DAYS) return false;

  return true;
}

/**
 * Request the native review prompt. Safe to call unconditionally — guards inside.
 * Returns true if a prompt was actually requested.
 */
export async function requestReviewIfEligible(): Promise<boolean> {
  if (!isReviewEligible()) return false;
  return forceRequestReview();
}

/** Forcefully request the native review prompt (used by Settings → "Rate Jvala"). */
export async function forceRequestReview(): Promise<boolean> {
  try {
    sessionStorage.setItem(STORAGE_KEYS.promptedThisSession, '1');
    setNumber(STORAGE_KEYS.lastPromptAt, now());

    if (isNative) {
      // Lazy-load so web bundle doesn't pull in native code.
      const mod = await import('@capacitor-community/in-app-review');
      await mod.InAppReview.requestReview();
      return true;
    }
    // Web fallback — open the App Store review page.
    window.open(APP_STORE_REVIEW_URL, '_blank', 'noopener,noreferrer');
    return true;
  } catch (err) {
    console.warn('[appReview] requestReview failed, falling back to App Store URL', err);
    try {
      window.open(APP_STORE_URL, '_blank', 'noopener,noreferrer');
    } catch {
      /* ignore */
    }
    return false;
  }
}

/** Always opens the public App Store listing (for "Share Jvala" / store link buttons). */
export function openAppStoreListing() {
  try {
    window.open(APP_STORE_URL, '_blank', 'noopener,noreferrer');
  } catch {
    /* ignore */
  }
}

export const APP_REVIEW_CONFIG = {
  appStoreId: APP_STORE_ID,
  appStoreUrl: APP_STORE_URL,
  appStoreReviewUrl: APP_STORE_REVIEW_URL,
  platform,
};
