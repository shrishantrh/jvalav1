/**
 * Edge Function: AI Observability Helper
 *
 * Usage in any edge function that calls Lovable AI gateway:
 *
 *   import { observedAICall } from "./observability.ts";
 *   const { response, log } = await observedAICall("ai-insights", apiKey, body);
 *
 * Logs: model, tokens_in, tokens_out, latency_ms, status
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

  return { response, log };
}
