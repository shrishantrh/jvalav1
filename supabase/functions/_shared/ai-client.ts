/**
 * Shared AI Client — Lovable AI Gateway (Gemini)
 *
 * The gateway is OpenAI-compatible, so we forward the request body through
 * almost untouched. We only normalize the model name and ensure the auth
 * header is set. Streaming SSE is passed through verbatim — it already arrives
 * in the OpenAI `data: {...}` shape that the rest of the app parses.
 *
 * Why Gemini Flash via the gateway?
 *   • ~3-5× lower time-to-first-token than Claude Sonnet for our prompts
 *   • No Cloudflare anti-bot challenges (we were hitting 403s on Anthropic)
 *   • Native tool calling, long context, streaming all supported
 *   • Matches the Jvala spec which calls for Gemini 2.5 Flash
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Map any legacy model names callers pass in to a Gemini equivalent.
function resolveModel(model?: string): string {
  if (!model) return "google/gemini-2.5-flash";
  const m = model.toLowerCase();

  // Already a gateway model id — pass through.
  if (m.startsWith("google/") || m.startsWith("openai/")) return model;

  // Legacy Claude / GPT names → Gemini equivalents.
  if (m.includes("opus") || m.includes("gpt-5") && !m.includes("mini") && !m.includes("nano")) {
    return "google/gemini-2.5-pro";
  }
  if (m.includes("haiku") || m.includes("nano") || m.includes("flash-lite")) {
    return "google/gemini-2.5-flash-lite";
  }
  // sonnet, gpt-5-mini, anything else → flash (the fast default)
  return "google/gemini-2.5-flash";
}

export async function callAI(requestBody: Record<string, unknown>): Promise<Response> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = { ...requestBody, model: resolveModel(requestBody.model as string | undefined) };
  const isStream = body.stream === true;

  const upstream = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error("❌ Lovable AI Gateway error:", upstream.status, errText);
    return new Response(JSON.stringify({ error: "AI gateway error", details: errText }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (isStream && upstream.body) {
    // Gateway already streams OpenAI-shaped SSE — forward verbatim.
    return new Response(upstream.body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function getAIApiKey(): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return key;
}

export function getAIEndpointUrl(): string {
  return GATEWAY_URL;
}
