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
    const password = url.searchParams.get('password');

    console.log('🔍 Request received:', { 
      hasToken: !!shareToken, 
      hasPassword: !!password,
      tokenLength: shareToken?.length,
      passwordLength: password?.length 
    });

    if (!shareToken || !password) {
      console.error('❌ Missing parameters:', { shareToken: !!shareToken, password: !!password });
      throw new Error('Missing token or password');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get export record
    const { data: exportRecord, error: exportError } = await supabaseClient
      .from('report_exports')
      .select('*')
      .eq('share_token', shareToken)
      .single();

    console.log('📊 Export record lookup:', { 
      found: !!exportRecord, 
      error: exportError?.message,
      hasPasswordHash: !!exportRecord?.password_hash 
    });

    if (exportError || !exportRecord) {
      console.error('❌ Export record not found or error:', exportError);
      throw new Error('Invalid or expired share link');
    }

    // Check expiration
    if (new Date(exportRecord.expires_at) < new Date()) {
      console.error('❌ Link expired:', exportRecord.expires_at);
      throw new Error('This share link has expired');
    }

    // Verify password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('🔐 Password verification:', { 
      providedHash: passwordHash.substring(0, 10) + '...',
      storedHash: exportRecord.password_hash.substring(0, 10) + '...',
      match: passwordHash === exportRecord.password_hash
    });

    if (passwordHash !== exportRecord.password_hash) {
      console.error('❌ Password mismatch');
      throw new Error('Incorrect password');
    }

    // Get the file from storage
    const { data: fileData, error: fileError } = await supabaseClient
      .storage
      .from('health-reports')
      .download(exportRecord.file_path);

    if (fileError || !fileData) {
      throw new Error('Report file not found');
    }

    // DELETE the share token to make it one-time use (do this in background)
    supabaseClient
      .from('report_exports')
      .delete()
      .eq('share_token', shareToken)
      .then(({ error }) => {
        if (error) {
          console.error('Failed to delete share token:', error);
        } else {
          console.log('Share token deleted successfully (one-time use enforced)');
        }
      });

    // Also delete the file from storage
    supabaseClient
      .storage
      .from('health-reports')
      .remove([exportRecord.file_path])
      .then(({ error }) => {
        if (error) {
          console.error('Failed to delete file from storage:', error);
        } else {
          console.log('File deleted from storage successfully');
        }
      });

    // Return the PDF file
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="health-report-${exportRecord.id}.pdf"`,
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error retrieving shared report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message.includes('Incorrect password') ? 403 : 
                error.message.includes('expired') ? 410 : 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
