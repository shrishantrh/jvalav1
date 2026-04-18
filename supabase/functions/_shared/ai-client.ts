/**
 * Shared AI Client — Anthropic Claude
 *
 * Translates the OpenAI-style chat-completions request shape that the rest of the
 * codebase already uses into Anthropic's Messages API, then translates the
 * response back. This way no other edge function has to change.
 *
 * Supports:
 *   - regular chat completions
 *   - tool calling (OpenAI `tools` / `tool_choice` → Anthropic `tools` / `tool_choice`)
 *   - streaming (SSE) — emits OpenAI-compatible `data: {choices:[{delta:{content}}]}` chunks
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Map the model names used across the codebase to actual Claude models.
function resolveModel(model?: string): string {
  if (!model) return "claude-sonnet-4-5-20250929";
  const m = model.toLowerCase();
  if (m.includes("pro") || m.includes("gpt-5") && !m.includes("mini") && !m.includes("nano")) {
    return "claude-opus-4-20250514";
  }
  if (m.includes("flash-lite") || m.includes("nano")) {
    return "claude-haiku-4-5-20250115";
  }
  // gemini flash, gpt-5-mini, default → sonnet (best general-purpose)
  return "claude-sonnet-4-5-20250929";
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

interface OpenAIRequest {
  model?: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: Array<{ type: "function"; function: { name: string; description?: string; parameters: unknown } }>;
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

// ── Convert OpenAI request → Anthropic request ──────────────────────────────
function toAnthropicRequest(req: OpenAIRequest) {
  // Pull out system messages (Anthropic uses a top-level `system` field)
  const systemParts: string[] = [];
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [];

  for (const msg of req.messages) {
    if (msg.role === "system") {
      if (typeof msg.content === "string") systemParts.push(msg.content);
      continue;
    }

    if (msg.role === "tool") {
      // Tool result → user message with tool_result content block
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id,
            content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
          },
        ],
      });
      continue;
    }

    if (msg.role === "assistant") {
      const blocks: unknown[] = [];
      if (typeof msg.content === "string" && msg.content) {
        blocks.push({ type: "text", text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const c of msg.content) {
          if (c.type === "text" && c.text) blocks.push({ type: "text", text: c.text });
        }
      }
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          let input: unknown = {};
          try { input = JSON.parse(tc.function.arguments || "{}"); } catch { /* keep {} */ }
          blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
        }
      }
      messages.push({ role: "assistant", content: blocks.length === 1 && (blocks[0] as any).type === "text" ? (blocks[0] as any).text : blocks });
      continue;
    }

    // user
    if (typeof msg.content === "string") {
      messages.push({ role: "user", content: msg.content });
    } else if (Array.isArray(msg.content)) {
      const blocks = msg.content.map((c) => {
        if (c.type === "text") return { type: "text", text: c.text };
        if (c.type === "image_url" && c.image_url?.url) {
          const url = c.image_url.url;
          if (url.startsWith("data:")) {
            const [meta, data] = url.split(",");
            const mediaType = meta.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
            return { type: "image", source: { type: "base64", media_type: mediaType, data } };
          }
          return { type: "image", source: { type: "url", url } };
        }
        return c;
      });
      messages.push({ role: "user", content: blocks });
    }
  }

  const body: Record<string, unknown> = {
    model: resolveModel(req.model),
    max_tokens: req.max_tokens ?? 4096,
    messages,
  };
  if (systemParts.length) body.system = systemParts.join("\n\n");
  if (typeof req.temperature === "number") body.temperature = req.temperature;
  if (req.stream) body.stream = true;

  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description || "",
      input_schema: t.function.parameters,
    }));
    if (req.tool_choice === "auto") body.tool_choice = { type: "auto" };
    else if (req.tool_choice === "none") { /* omit */ }
    else if (typeof req.tool_choice === "object") body.tool_choice = { type: "tool", name: req.tool_choice.function.name };
  }

  return body;
}

// ── Convert Anthropic non-streaming response → OpenAI shape ─────────────────
function toOpenAIResponse(anthropic: any) {
  const textParts: string[] = [];
  const toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];

  for (const block of anthropic.content || []) {
    if (block.type === "text") textParts.push(block.text);
    else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      });
    }
  }

  return {
    id: anthropic.id,
    object: "chat.completion",
    model: anthropic.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textParts.join("") || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: anthropic.stop_reason === "end_turn" ? "stop" : (anthropic.stop_reason || "stop"),
      },
    ],
    usage: {
      prompt_tokens: anthropic.usage?.input_tokens ?? 0,
      completion_tokens: anthropic.usage?.output_tokens ?? 0,
      total_tokens: (anthropic.usage?.input_tokens ?? 0) + (anthropic.usage?.output_tokens ?? 0),
    },
  };
}

// ── Convert Anthropic SSE stream → OpenAI-compatible SSE stream ─────────────
function streamToOpenAI(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let model = "";
  const id = "chatcmpl-" + crypto.randomUUID();

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;

            try {
              const evt = JSON.parse(payload);
              if (evt.type === "message_start") {
                model = evt.message?.model || "";
                send({ id, object: "chat.completion.chunk", model, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] });
              } else if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                send({ id, object: "chat.completion.chunk", model, choices: [{ index: 0, delta: { content: evt.delta.text }, finish_reason: null }] });
              } else if (evt.type === "message_delta" && evt.delta?.stop_reason) {
                send({ id, object: "chat.completion.chunk", model, choices: [{ index: 0, delta: {}, finish_reason: evt.delta.stop_reason === "end_turn" ? "stop" : evt.delta.stop_reason }] });
              } else if (evt.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch { /* ignore parse errors on partial frames */ }
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function callAI(requestBody: Record<string, unknown>): Promise<Response> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const req = requestBody as OpenAIRequest;
  const isStream = req.stream === true;
  const anthropicBody = toAnthropicRequest(req);

  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(anthropicBody),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error("❌ Anthropic error:", upstream.status, errText);
    // Map Anthropic errors to the same status codes the rest of the app expects.
    let status = upstream.status;
    if (status === 529) status = 429; // overloaded → rate-limit
    return new Response(JSON.stringify({ error: "Anthropic API error", details: errText }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (isStream && upstream.body) {
    const stream = streamToOpenAI(upstream.body);
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const data = await upstream.json();
  const openaiShape = toOpenAIResponse(data);
  return new Response(JSON.stringify(openaiShape), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Returned to callers that want to do raw fetches. We expose the Anthropic key
 * but most code should use callAI() above.
 */
export async function getAIApiKey(): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return key;
}

export function getAIEndpointUrl(): string {
  return ANTHROPIC_URL;
}
