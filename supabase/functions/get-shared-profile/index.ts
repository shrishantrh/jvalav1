import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareToken = url.searchParams.get('token');

    console.log('🔍 Request received:', { hasToken: !!shareToken });

    if (!shareToken) {
      console.error('❌ Missing token');
      throw new Error('Missing share token');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get profile with matching token (no password required)
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('share_token', shareToken)
      .eq('share_enabled', true)
      .single();

    console.log('📊 Profile lookup:', { 
      found: !!profile, 
      error: profileError?.message 
    });

    if (profileError || !profile) {
      console.error('❌ Profile not found or sharing disabled');
      throw new Error('Profile not found or link expired');
    }

    // Get user's flare entries
    const { data: flareData, error: flareError } = await supabaseClient
      .from('flare_entries')
      .select('*')
      .eq('user_id', profile.id)
      .order('timestamp', { ascending: false });

    if (flareError) {
      console.error('❌ Error fetching flare data:', flareError);
      throw flareError;
    }

    console.log('✅ Profile data retrieved successfully');

    return new Response(
      JSON.stringify({ 
        profile: {
          full_name: profile.full_name,
          email: profile.email
        },
        entries: flareData || []
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error retrieving shared profile:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message.includes('not found') ? 404 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
