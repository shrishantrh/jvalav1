/**
 * Edge Function: AI Observability Helper
 *
 * Logs AI calls as structured JSON AND reports errors/slow calls
 * to Sentry via the HTTP Envelope API (no SDK needed for Deno).
 */

interface AIObservabilityLog {
  function: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  status: "success" | "error" | "rate_limited" | "credits_exhausted";
  errorMessage?: string;
}

// ─── Sentry HTTP reporter (lightweight, no SDK) ─────────────────────────────

function parseSentryDSN(dsn: string | undefined): {
  publicKey: string;
  host: string;
  projectId: string;
} | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace("/", "");
    const host = url.hostname;
    return { publicKey, host, projectId };
  } catch {
    return null;
  }
}

async function sendToSentry(
  level: "error" | "warning" | "info",
  message: string,
  extra: Record<string, unknown>
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  const parsed = parseSentryDSN(dsn);
  if (!parsed) return; // Sentry not configured, silently skip

  const { publicKey, host, projectId } = parsed;
  const timestamp = Math.floor(Date.now() / 1000);

  const envelope = [
    JSON.stringify({
      dsn,
      sent_at: new Date().toISOString(),
    }),
    JSON.stringify({ type: "event" }),
    JSON.stringify({
      timestamp,
      level,
      platform: "node",
      server_name: "edge-function",
      message: { formatted: message },
      extra,
      tags: {
        runtime: "deno",
        service: "edge-function",
        ai_function: extra.function || "unknown",
      },
    }),
  ].join("\n");

  try {
    await fetch(
      `https://${host}/api/${projectId}/envelope/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-sentry-envelope",
          "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=jvala-edge/1.0, sentry_key=${publicKey}`,
        },
        body: envelope,
      }
    );
  } catch {
    // Fire-and-forget — don't let Sentry failures break the function
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function observedAICall(
  functionName: string,
  apiKey: string,
  requestBody: Record<string, unknown>
): Promise<{ response: Response; log: AIObservabilityLog }> {
  const model = (requestBody.model as string) || "unknown";
  const start = performance.now();

  let status: AIObservabilityLog["status"] = "success";
  let errorMessage: string | undefined;
  let tokensIn = 0;
  let tokensOut = 0;

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  const latencyMs = Math.round(performance.now() - start);

  if (!response.ok) {
    if (response.status === 429) status = "rate_limited";
    else if (response.status === 402) status = "credits_exhausted";
    else status = "error";
    errorMessage = `HTTP ${response.status}`;
  }

  // Clone so the caller can still read the body
  const cloned = response.clone();

  try {
    if (response.ok) {
      const json = await cloned.json();
      const usage = json.usage;
      if (usage) {
        tokensIn = usage.prompt_tokens || 0;
        tokensOut = usage.completion_tokens || 0;
      }
    }
  } catch {
    // Parsing failure doesn't affect the original response
  }

  const log: AIObservabilityLog = {
    function: functionName,
    model,
    tokensIn,
    tokensOut,
    latencyMs,
    status,
    errorMessage,
  };

  // Structured log for aggregation
  console.info(`[ai-observability] ${JSON.stringify(log)}`);

  // Report failures and slow calls (>10s) to Sentry
  if (status !== "success") {
    await sendToSentry("error", `AI call failed: ${functionName} — ${status}`, log);
  } else if (latencyMs > 10_000) {
    await sendToSentry("warning", `AI call slow: ${functionName} — ${latencyMs}ms`, log);
  }

  return { response, log };
}
