import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.2.0/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple web push implementation using fetch to push service endpoints
async function sendWebPush(
  subscription: { endpoint: string; p256dh_key: string; auth_key: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; status?: number }> {
  try {
    const audience = new URL(subscription.endpoint).origin;
    const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
    
    const header = { alg: 'ES256', typ: 'JWT' };
    const jwtPayload = {
      aud: audience,
      exp: expiration,
      sub: 'mailto:support@jvala.tech'
    };
    
    const base64url = (data: string) => btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const textEncoder = new TextEncoder();
    
    const privateKeyBuffer = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    
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
    
    const signatureBase64 = base64url(String.fromCharCode(...new Uint8Array(signature)));
    const jwt = unsignedToken + '.' + signatureBase64;
    
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
    console.error('Web push send error:', error);
    return { success: false };
  }
}

/**
 * Send APNs push notification using HTTP/2 via Apple's Push Notification service
 */
async function sendAPNsPush(
  deviceToken: string,
  payload: { title: string; body: string; badge?: number; sound?: string; data?: Record<string, unknown> },
  apnsPushKey: string,
  teamId: string,
  keyId: string,
  bundleId: string,
): Promise<{ success: boolean; status?: number; reason?: string }> {
  try {
    // Create APNs JWT token
    // Ensure PEM headers
    let pemKey = apnsPushKey.trim();
    if (!pemKey.includes('-----BEGIN PRIVATE KEY-----')) {
      pemKey = `-----BEGIN PRIVATE KEY-----\n${pemKey}\n-----END PRIVATE KEY-----`;
    }
    pemKey = pemKey.replace(/\\n/g, '\n');

    const key = await importPKCS8(pemKey, 'ES256');
    const now = Math.floor(Date.now() / 1000);

    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .sign(key);

    // Build APNs payload
    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        badge: payload.badge ?? 1,
        sound: payload.sound ?? 'default',
        'mutable-content': 1,
      },
      ...payload.data,
    };

    // Send to APNs production endpoint
    const url = `https://api.push.apple.com/3/device/${deviceToken}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        'content-type': 'application/json',
      },
      body: JSON.stringify(apnsPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`APNs error (${response.status}):`, errorBody);
      return { success: false, status: response.status, reason: errorBody };
    }

    return { success: true, status: response.status };
  } catch (error) {
    console.error('APNs send error:', error);
    return { success: false, reason: error.message };
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
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
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

    // Get ALL subscriptions (web + native)
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

    const webSubs = subscriptions.filter(s => (!s.platform || s.platform === 'web') && s.endpoint);
    const nativeSubs = subscriptions.filter(s => s.platform === 'ios' && s.device_token);

    let successCount = 0;
    const failedEndpoints: string[] = [];
    const failedTokens: string[] = [];

    // Send web push notifications
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    
    if (vapidPublicKey && vapidPrivateKey && webSubs.length > 0) {
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

      for (const sub of webSubs) {
        const result = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey);
        if (result.success) {
          successCount++;
          console.log(`Web push sent to ${sub.endpoint?.substring(0, 50)}...`);
        } else if (result.status === 410 || result.status === 404) {
          if (sub.endpoint) failedEndpoints.push(sub.endpoint);
        } else {
          console.error(`Web push failed with status ${result.status}`);
        }
      }
    }

    // Send native APNs push notifications
    const apnsPushKey = Deno.env.get('APPLE_PUSH_PRIVATE_KEY');
    if (apnsPushKey && nativeSubs.length > 0) {
      const TEAM_ID = '3VV3HM37UR';
      const KEY_ID = '8NSG2FW837';
      const BUNDLE_ID = 'app.jvala.health';

      for (const sub of nativeSubs) {
        const result = await sendAPNsPush(
          sub.device_token!,
          { 
            title: title || 'Jvala', 
            body: messageBody || 'Time to check in!',
            data: { url: url || '/', ...data },
          },
          apnsPushKey,
          TEAM_ID,
          KEY_ID,
          BUNDLE_ID,
        );
        
        if (result.success) {
          successCount++;
          console.log(`APNs push sent to token ${sub.device_token?.substring(0, 20)}...`);
        } else if (result.status === 410 || result.status === 400) {
          // Token invalid/expired
          if (sub.device_token) failedTokens.push(sub.device_token);
          console.log(`APNs token expired: ${sub.device_token?.substring(0, 20)}...`);
        } else {
          console.error(`APNs push failed: ${result.reason}`);
        }
      }
    } else if (nativeSubs.length > 0) {
      console.log('⚠️ APPLE_PUSH_PRIVATE_KEY not configured, skipping native push');
    }

    // Clean up expired subscriptions
    if (failedEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete()
        .eq('user_id', userId).in('endpoint', failedEndpoints);
    }
    if (failedTokens.length > 0) {
      await supabase.from('push_subscriptions').delete()
        .eq('user_id', userId).in('device_token', failedTokens);
    }

    console.log(`📊 Push results: ${successCount}/${subscriptions.length} sent (${webSubs.length} web, ${nativeSubs.length} native)`);

    return new Response(JSON.stringify({ 
      sent: successCount, 
      total: subscriptions.length,
      web: webSubs.length,
      native: nativeSubs.length,
    }), {
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
