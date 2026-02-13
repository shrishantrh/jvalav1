import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user with anon client
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Use service role client for deletion
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete all user data from every table (order matters for foreign keys)
    const tables = [
      { table: "activity_logs", column: "user_id" },
      { table: "correlations", column: "user_id" },
      { table: "medication_logs", column: "user_id" },
      { table: "flare_entries", column: "user_id" },
      { table: "weekly_reports", column: "user_id" },
      { table: "report_exports", column: "user_id" },
      { table: "physician_access", column: "user_id" },
      { table: "push_subscriptions", column: "user_id" },
      { table: "fitbit_tokens", column: "user_id" },
      { table: "oura_tokens", column: "user_id" },
      { table: "ehr_tokens", column: "user_id" },
      { table: "ehr_connections", column: "user_id" },
      { table: "engagement", column: "user_id" },
      { table: "profiles", column: "id" },
    ];

    for (const { table, column } of tables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, userId);
      
      if (error) {
        console.error(`Failed to delete from ${table}:`, error.message);
        // Continue deleting other tables even if one fails
      }
    }

    // Delete the auth user last
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error("Failed to delete auth user:", deleteUserError.message);
      return new Response(
        JSON.stringify({ error: "Failed to delete account. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Account and all data deleted permanently." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Delete account error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
