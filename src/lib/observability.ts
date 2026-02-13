/**
 * Observability: structured logging for AI calls, API latency, and errors.
 * Now pipes all events to Sentry as breadcrumbs for full crash context.
 */
import { addObservabilityBreadcrumb, Sentry } from "./sentry";

interface AICallLog {
  model: string;
  function: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  status: "success" | "error" | "rate_limited" | "credits_exhausted";
  errorMessage?: string;
  userId?: string;
}

export function logAICallClient(log: AICallLog): void {
  // Structured console log (picked up by any log aggregator)
  console.info("[ai-observability]", JSON.stringify(log));

  // Sentry breadcrumb — appears in timeline of subsequent errors
  addObservabilityBreadcrumb(
    "ai-call",
    log as unknown as Record<string, unknown>,
    log.status === "error" ? "error" : "info"
  );

  // If the AI call itself failed, capture as a non-fatal Sentry event
  if (log.status === "error" || log.status === "rate_limited" || log.status === "credits_exhausted") {
    Sentry.captureMessage(`AI call failed: ${log.function} — ${log.status}`, {
      level: log.status === "error" ? "error" : "warning",
      tags: { ai_function: log.function, ai_model: log.model, ai_status: log.status },
      extra: log as unknown as Record<string, unknown>,
    });
  }
}

interface APICallLog {
  service: string;
  endpoint?: string;
  latencyMs: number;
  status: "success" | "error" | "circuit_open" | "cached";
  errorMessage?: string;
  cached?: boolean;
}

export function logAPICall(log: APICallLog): void {
  console.info("[api-observability]", JSON.stringify(log));

  addObservabilityBreadcrumb(
    "api-call",
    log as unknown as Record<string, unknown>,
    log.status === "error" ? "error" : "info"
  );

  if (log.status === "error") {
    Sentry.captureMessage(`API call failed: ${log.service}`, {
      level: "warning",
      tags: { api_service: log.service },
      extra: log as unknown as Record<string, unknown>,
    });
  }
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
      status: res.ok ? "success" : "error",
      errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
    });
    return res;
  } catch (err) {
    logAPICall({
      service,
      endpoint,
      latencyMs: Math.round(performance.now() - start),
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
