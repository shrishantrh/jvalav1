/**
 * Shared AI Client for Vertex AI (HIPAA-compliant)
 * 
 * Uses Google Cloud Vertex AI's OpenAI-compatible endpoint.
 * Authenticates via service account JWT → access token.
 * All health data stays within Google's BAA-covered infrastructure.
 * 
 * Required secrets:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  – full JSON key file content
 *   GOOGLE_CLOUD_PROJECT_ID      – GCP project ID
 *   GOOGLE_CLOUD_REGION          – e.g. "us-central1"
 */

import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.2.0/index.ts";

// ── Token cache (edge functions are short-lived but may make multiple calls) ──
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

// ── Model mapping: strip "google/" prefix used by Lovable gateway ──
function resolveModel(model: string): string {
  // Vertex AI uses just "gemini-2.5-flash" not "google/gemini-2.5-flash"
  if (model.startsWith("google/")) {
    return model.slice(7);
  }
  return model;
}

/**
 * Get a Google OAuth2 access token using a service account JWT.
 */
async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 60s buffer)
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
 * Configuration loaded from environment.
 */
function getConfig() {
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const projectId = Deno.env.get("GOOGLE_CLOUD_PROJECT_ID");
  const region = Deno.env.get("GOOGLE_CLOUD_REGION") || "us-central1";

  if (!serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  }
  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID not configured");
  }

  let serviceAccount: { client_email: string; private_key: string };
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing client_email or private_key");
  }

  return { serviceAccount, projectId, region };
}

/**
 * Build the Vertex AI OpenAI-compatible endpoint URL.
 */
function getEndpointUrl(projectId: string, region: string): string {
  return `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;
}

/**
 * Call AI via Vertex AI (HIPAA-compliant, BAA-covered).
 * 
 * Drop-in replacement for the old Lovable AI gateway calls.
 * Same OpenAI-compatible request/response format.
 * 
 * @param requestBody - OpenAI-compatible request body (model, messages, tools, etc.)
 * @returns The fetch Response object
 */
export async function callAI(
  requestBody: Record<string, unknown>
): Promise<Response> {
  const { serviceAccount, projectId, region } = getConfig();
  const accessToken = await getAccessToken(serviceAccount);
  const endpointUrl = getEndpointUrl(projectId, region);

  // Resolve model name (strip "google/" prefix if present)
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
 * Get the API key for AI calls.
 * Returns the access token for Vertex AI (for functions that build their own fetch).
 * Prefer using callAI() instead.
 */
export async function getAIApiKey(): Promise<string> {
  const { serviceAccount } = getConfig();
  return await getAccessToken(serviceAccount);
}

/**
 * Get the full Vertex AI endpoint URL.
 * For functions that need to build custom fetch calls.
 */
export function getAIEndpointUrl(): string {
  const { projectId, region } = getConfig();
  return getEndpointUrl(projectId, region);
}
