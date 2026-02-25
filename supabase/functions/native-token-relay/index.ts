/**
 * Native Token Relay
 * 
 * Temporarily stores OAuth tokens so the native Capacitor app
 * can retrieve them after the in-app browser closes.
 * 
 * POST: Store tokens with a nonce
 * GET:  Retrieve (and delete) tokens by nonce
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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
      const { nonce, access_token, refresh_token } = await req.json();

      if (!nonce || !access_token || !refresh_token) {
        return new Response(
          JSON.stringify({ error: "Missing nonce, access_token, or refresh_token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert to handle retries
      const { error } = await supabase
        .from("temp_auth_relay")
        .upsert(
          { nonce, tokens: { access_token, refresh_token }, created_at: new Date().toISOString() },
          { onConflict: "nonce" }
        );

      if (error) {
        console.error("[native-token-relay] Store error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to store tokens" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const nonce = url.searchParams.get("nonce");

      if (!nonce) {
        return new Response(
          JSON.stringify({ error: "Missing nonce parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch tokens
      const { data, error } = await supabase
        .from("temp_auth_relay")
        .select("tokens")
        .eq("nonce", nonce)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "No tokens found for this nonce" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete after retrieval (one-time use)
      await supabase.from("temp_auth_relay").delete().eq("nonce", nonce);

      return new Response(
        JSON.stringify(data.tokens),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[native-token-relay] Error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
