/**
 * API Resilience Layer
 * - Exponential backoff with jitter for retries
 * - In-memory TTL cache to prevent API spam on app open
 * - Circuit breaker to stop hammering failing services
 */

// ─── TTL Cache ────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

const circuits = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 3; // failures before opening
const CIRCUIT_RESET_MS = 60_000; // 1 minute cooldown

function getCircuit(name: string): CircuitState {
  if (!circuits.has(name)) {
    circuits.set(name, { failures: 0, lastFailure: 0, open: false });
  }
  return circuits.get(name)!;
}

export function isCircuitOpen(name: string): boolean {
  const circuit = getCircuit(name);
  if (!circuit.open) return false;
  // Auto-reset after cooldown (half-open)
  if (Date.now() - circuit.lastFailure > CIRCUIT_RESET_MS) {
    circuit.open = false;
    circuit.failures = 0;
    return false;
  }
  return true;
}

export function recordSuccess(name: string): void {
  const circuit = getCircuit(name);
  circuit.failures = 0;
  circuit.open = false;
}

export function recordFailure(name: string): void {
  const circuit = getCircuit(name);
  circuit.failures++;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= CIRCUIT_THRESHOLD) {
    circuit.open = true;
    console.warn(`[circuit-breaker] ${name} opened after ${circuit.failures} failures`);
  }
}

// ─── Retry with Exponential Backoff ───────────────────────────────────────────

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  circuitName?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 500, maxDelayMs = 8000, circuitName } = options;

  if (circuitName && isCircuitOpen(circuitName)) {
    throw new Error(`Circuit breaker open for ${circuitName}`);
  }

  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (circuitName) recordSuccess(circuitName);
      return result;
    } catch (err) {
      lastError = err;
      if (circuitName) recordFailure(circuitName);

      if (attempt === maxRetries) break;

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * baseDelayMs,
        maxDelayMs
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

// ─── Cached Fetch Helper ──────────────────────────────────────────────────────

/**
 * Wraps an async fetcher with TTL caching and circuit breaker.
 * If the cache has fresh data, returns it immediately (no API call).
 */
export async function cachedFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000, // 5 min default
  circuitName?: string
): Promise<T | null> {
  // Return cached if fresh
  const cached = getCached<T>(cacheKey);
  if (cached !== null) return cached;

  // Check circuit breaker
  if (circuitName && isCircuitOpen(circuitName)) {
    console.warn(`[cachedFetch] ${circuitName} circuit open, returning null`);
    return null;
  }

  try {
    const data = await withRetry(fetcher, {
      maxRetries: 2,
      baseDelayMs: 300,
      circuitName,
    });
    setCache(cacheKey, data, ttlMs);
    return data;
  } catch (err) {
    console.error(`[cachedFetch] ${cacheKey} failed:`, err);
    return null;
  }
}
