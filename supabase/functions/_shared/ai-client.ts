/**
 * Shared AI Client
 * 
 * Routes to either:
 *   1. Lovable AI Gateway (default, using LOVABLE_API_KEY)
 *   2. Google Vertex AI (when GOOGLE_SERVICE_ACCOUNT_JSON is configured)
 * 
 * This allows the app to work immediately with Lovable AI,
 * and seamlessly switch to HIPAA-compliant Vertex AI later.
 */

import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.2.0/index.ts";

// ── Token cache for Vertex AI ──
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

function resolveModel(model: string): string {
  if (model.startsWith("google/")) {
    return model.slice(7);
  }
  return model;
}

async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt > now + 60) {
    return cachedAccessToken;
  }

  const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("❌ Google OAuth2 token error:", tokenResponse.status, errorText);
    throw new Error(`Failed to get access token: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);
  return cachedAccessToken!;
}

/**
 * Detect which backend to use based on available env vars.
 */
function getBackend(): "lovable" | "vertex" {
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const projectId = Deno.env.get("GOOGLE_CLOUD_PROJECT_ID");
  if (serviceAccountJson && projectId) {
    return "vertex";
  }
  return "lovable";
}

/**
 * Call AI — automatically routes to the right backend.
 */
export async function callAI(
  requestBody: Record<string, unknown>
): Promise<Response> {
  const backend = getBackend();

  if (backend === "vertex") {
    return callVertexAI(requestBody);
  }
  return callLovableAI(requestBody);
}

// ── Lovable AI Gateway ──────────────────────────────────────────────────────

async function callLovableAI(requestBody: Record<string, unknown>): Promise<Response> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const model = (requestBody.model as string) || "google/gemini-2.5-flash";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...requestBody, model }),
  });

  return response;
}

// ── Google Vertex AI (HIPAA-compliant) ──────────────────────────────────────

async function callVertexAI(requestBody: Record<string, unknown>): Promise<Response> {
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!;
  const projectId = Deno.env.get("GOOGLE_CLOUD_PROJECT_ID")!;
  const region = Deno.env.get("GOOGLE_CLOUD_REGION") || "us-central1";

  let serviceAccount: { client_email: string; private_key: string };
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  const accessToken = await getAccessToken(serviceAccount);
  const endpointUrl = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;

  const body = {
    ...requestBody,
    model: resolveModel((requestBody.model as string) || "gemini-2.5-flash"),
  };

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return response;
}

/**
 * Get API key for manual fetch calls.
 */
export async function getAIApiKey(): Promise<string> {
  const backend = getBackend();
  if (backend === "vertex") {
    const sa = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!);
    return await getAccessToken(sa);
  }
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return key;
}

/**
 * Get AI endpoint URL for manual fetch calls.
 */
export function getAIEndpointUrl(): string {
  const backend = getBackend();
  if (backend === "vertex") {
    const projectId = Deno.env.get("GOOGLE_CLOUD_PROJECT_ID")!;
    const region = Deno.env.get("GOOGLE_CLOUD_REGION") || "us-central1";
    return `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;
  }
  return "https://ai.gateway.lovable.dev/v1/chat/completions";
}
