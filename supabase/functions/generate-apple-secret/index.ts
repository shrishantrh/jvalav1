import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.2.0/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow any authenticated request (this is a one-time admin utility)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - provide Bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let privateKeyPem = Deno.env.get('APPLE_SIGN_IN_PRIVATE_KEY');
    if (!privateKeyPem) {
      throw new Error('APPLE_SIGN_IN_PRIVATE_KEY not configured');
    }

    // Ensure PEM headers are present
    privateKeyPem = privateKeyPem.trim();
    if (!privateKeyPem.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyPem}\n-----END PRIVATE KEY-----`;
    }
    // Normalize line endings
    privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');

    const teamId = '3VV3HM37UR';
    const keyId = 'MSHZVMN5LC';
    const clientId = 'tech.jvala.web';

    const key = await importPKCS8(privateKeyPem, 'ES256');

    const now = Math.floor(Date.now() / 1000);
    const sixMonths = 15777000; // ~6 months

    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setSubject(clientId)
      .setAudience('https://appleid.apple.com')
      .setIssuedAt(now)
      .setExpirationTime(now + sixMonths)
      .sign(key);

    return new Response(JSON.stringify({
      client_secret: jwt,
      client_id: clientId,
      expires_at: new Date((now + sixMonths) * 1000).toISOString(),
      instructions: 'Go to Backend → Authentication Settings → Apple → Use your own credentials. Paste client_id and client_secret there.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generate Apple secret error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
