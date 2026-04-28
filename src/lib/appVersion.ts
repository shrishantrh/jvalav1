/**
 * Two-tier in-app update prompts.
 *
 * Strategy:
 *   - Build embeds __APP_VERSION__ at compile time (vite.config.ts).
 *   - On boot we hit a public Supabase Storage JSON file (or table) that lists:
 *       { latest: "1.4.0", minimum: "1.2.0", releaseNotes: "...", forceUpdate: false }
 *   - If installed < latest  → soft toast (dismissible, "Update available").
 *   - If installed < minimum → hard-block modal (cannot be dismissed) until they
 *     tap "Update Now" which deep-links to the App Store.
 *
 * Both tiers reuse the App Store ID from src/lib/appReview.ts.
 */
import { APP_REVIEW_CONFIG } from '@/lib/appReview';

declare const __APP_VERSION__: string;

export interface VersionManifest {
  latest: string;
  minimum: string;
  releaseNotes?: string;
  /** When true, force the hard-block modal even if installed >= minimum. */
  forceUpdate?: boolean;
}

export type UpdateTier = 'none' | 'soft' | 'hard';

const MANIFEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/app-config/version.json`;

let cachedManifest: VersionManifest | null = null;
let lastFetchAt = 0;
const TTL_MS = 60 * 60 * 1000; // 1 hour

/** SemVer-aware comparator that tolerates plain "1.2.3" or "1.2.3-beta". */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/i, '').split(/[.-]/).map((s) => {
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    });

  const aa = parse(a);
  const bb = parse(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const da = aa[i] ?? 0;
    const db = bb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

export function getInstalledVersion(): string {
  try {
    return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export async function fetchVersionManifest(force = false): Promise<VersionManifest | null> {
  if (!force && cachedManifest && Date.now() - lastFetchAt < TTL_MS) {
    return cachedManifest;
  }
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as VersionManifest;
    if (!json?.latest || !json?.minimum) return null;
    cachedManifest = json;
    lastFetchAt = Date.now();
    return json;
  } catch (err) {
    console.warn('[appVersion] manifest fetch failed', err);
    return null;
  }
}

export function classifyUpdate(installed: string, manifest: VersionManifest): UpdateTier {
  if (manifest.forceUpdate) return 'hard';
  if (compareVersions(installed, manifest.minimum) < 0) return 'hard';
  if (compareVersions(installed, manifest.latest) < 0) return 'soft';
  return 'none';
}

export function openAppStoreForUpdate() {
  try {
    window.open(APP_REVIEW_CONFIG.appStoreUrl, '_blank', 'noopener,noreferrer');
  } catch {
    /* ignore */
  }
}
