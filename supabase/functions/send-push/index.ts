import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple web push implementation using fetch to push service endpoints
async function sendWebPush(
  subscription: { endpoint: string; p256dh_key: string; auth_key: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; status?: number }> {
  try {
    // Create JWT for VAPID authentication
    const audience = new URL(subscription.endpoint).origin;
    const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours
    
    const header = { alg: 'ES256', typ: 'JWT' };
    const jwtPayload = {
      aud: audience,
      exp: expiration,
      sub: 'mailto:support@jvala.tech'
    };
    
    // Base64url encode
    const base64url = (data: string) => btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const textEncoder = new TextEncoder();
    
    // Import the private key for signing
    const privateKeyBuffer = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    
    // For ES256, we need the raw 32-byte private key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      privateKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    
    const unsignedToken = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(jwtPayload));
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      textEncoder.encode(unsignedToken)
    );
    
    // Convert signature to base64url
    const signatureBase64 = base64url(String.fromCharCode(...new Uint8Array(signature)));
    const jwt = unsignedToken + '.' + signatureBase64;
    
    // Make the push request
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Urgency': 'high'
      },
      body: payload
    });
    
    return { success: response.ok, status: response.status };
  } catch (error) {
    console.error('Push send error:', error);
    return { success: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard: require service role key or valid JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (token !== serviceRoleKey) {
      // Not service role — verify as user JWT
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(JSON.stringify({ error: 'VAPID not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json();
    const { userId, title, body: messageBody, tag, data, url, requireInteraction = true } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: title || 'Jvala',
      body: messageBody || 'Time to check in!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'jvala-notification',
      data: { url: url || '/', ...data },
      requireInteraction,
      vibrate: [200, 100, 200],
    });

    let successCount = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const result = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey);
      
      if (result.success) {
        successCount++;
        console.log(`Push sent successfully to ${sub.endpoint.substring(0, 50)}...`);
      } else if (result.status === 410 || result.status === 404) {
        failedEndpoints.push(sub.endpoint);
        console.log(`Subscription expired: ${sub.endpoint.substring(0, 50)}...`);
      } else {
        console.error(`Push failed with status ${result.status}`);
      }
    }

    // Clean up expired subscriptions
    if (failedEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete()
        .eq('user_id', userId).in('endpoint', failedEndpoints);
    }

    return new Response(JSON.stringify({ sent: successCount, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Send push error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
