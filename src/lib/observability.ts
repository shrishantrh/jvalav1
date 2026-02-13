/**
 * Observability: structured logging for AI calls, API latency, and errors.
 * Logs to console in a structured JSON format that can be picked up by
 * any log aggregator (Sentry, Datadog, CloudWatch, etc.)
 *
 * Edge function counterpart: logAICall() in each edge function.
 */

interface AICallLog {
  model: string;
  function: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  status: 'success' | 'error' | 'rate_limited' | 'credits_exhausted';
  errorMessage?: string;
  userId?: string;
}

export function logAICallClient(log: AICallLog): void {
  console.info('[ai-observability]', JSON.stringify(log));
}

interface APICallLog {
  service: string; // 'weather', 'fitbit', 'oura', etc.
  endpoint?: string;
  latencyMs: number;
  status: 'success' | 'error' | 'circuit_open' | 'cached';
  errorMessage?: string;
  cached?: boolean;
}

export function logAPICall(log: APICallLog): void {
  console.info('[api-observability]', JSON.stringify(log));
}

/**
 * Wraps a fetch call and logs structured timing/status data.
 */
export async function observedFetch(
  service: string,
  fetchFn: () => Promise<Response>,
  endpoint?: string
): Promise<Response> {
  const start = performance.now();
  try {
    const res = await fetchFn();
    logAPICall({
      service,
      endpoint,
      latencyMs: Math.round(performance.now() - start),
      status: res.ok ? 'success' : 'error',
      errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
    });
    return res;
  } catch (err) {
    logAPICall({
      service,
      endpoint,
      latencyMs: Math.round(performance.now() - start),
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
