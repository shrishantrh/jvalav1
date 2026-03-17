/**
 * Native Token Relay
 *
 * Temporarily stores native OAuth payloads so the app can retrieve them
 * after the in-app browser callback completes.
 *
 * POST: Store payload with a nonce
 * GET:  Retrieve (and delete) payload by nonce
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const isValidNonce = (nonce: string) => /^[a-zA-Z0-9._:-]{8,200}$/.test(nonce);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (req.method === "POST") {
      const body = await req.json();
      const nonce = body?.nonce;
      const code = body?.code;
      const access_token = body?.access_token;
      const refresh_token = body?.refresh_token;
      const auth_error = body?.error;

      if (!nonce || typeof nonce !== "string" || !isValidNonce(nonce)) {
        return new Response(JSON.stringify({ error: "Invalid nonce" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hasCode = typeof code === "string" && code.length > 0;
      const hasTokenPair =
        typeof access_token === "string" && access_token.length > 0 &&
        typeof refresh_token === "string" && refresh_token.length > 0;
      const hasAuthError = typeof auth_error === "string" && auth_error.length > 0;

      if (!hasCode && !hasTokenPair && !hasAuthError) {
        return new Response(
          JSON.stringify({ error: "Missing OAuth payload (code, token pair, or error)" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const payload: Record<string, string> = {};
      if (hasCode) payload.code = code;
      if (hasTokenPair) {
        payload.access_token = access_token;
        payload.refresh_token = refresh_token;
      }
      if (hasAuthError) payload.error = auth_error;

      const { error } = await supabase
        .from("temp_auth_relay")
        .upsert(
          {
            nonce,
            tokens: payload,
            created_at: new Date().toISOString(),
          },
          { onConflict: "nonce" }
        );

      if (error) {
        console.error("[native-token-relay] Store error:", error);
        return new Response(JSON.stringify({ error: "Failed to store auth payload" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const nonce = url.searchParams.get("nonce");

      if (!nonce || !isValidNonce(nonce)) {
        return new Response(JSON.stringify({ error: "Missing or invalid nonce parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("temp_auth_relay")
        .select("tokens")
        .eq("nonce", nonce)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "No auth payload found for this nonce" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("temp_auth_relay").delete().eq("nonce", nonce);

      return new Response(JSON.stringify(data.tokens), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[native-token-relay] Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
