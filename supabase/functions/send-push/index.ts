import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ApplicationServer, importVapidKeys } from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let appServer: ApplicationServer | null = null;

async function getAppServer(): Promise<ApplicationServer | null> {
  if (appServer) return appServer;
  
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured');
    return null;
  }
  
  try {
    const vapidKeys = await importVapidKeys({
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    });
    
    appServer = new ApplicationServer(vapidKeys, 'mailto:support@jvala.tech');
    return appServer;
  } catch (error) {
    console.error('Failed to initialize VAPID:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const server = await getAppServer();
    if (!server) {
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
      try {
        const subscriber = server.subscribe({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
        });

        const response = await subscriber.pushTextMessage(payload, { ttl: 86400 });

        if (response.ok) {
          successCount++;
        } else if (response.status === 410 || response.status === 404) {
          failedEndpoints.push(sub.endpoint);
        }
      } catch {
        failedEndpoints.push(sub.endpoint);
      }
    }

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
