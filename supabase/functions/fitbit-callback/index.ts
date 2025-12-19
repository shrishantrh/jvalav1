import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error from Fitbit:', error);
      return new Response(getErrorHTML('Authorization denied'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!code || !state) {
      console.error('Missing code or state');
      return new Response(getErrorHTML('Invalid callback parameters'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch (e) {
      console.error('Invalid state:', e);
      return new Response(getErrorHTML('Invalid state parameter'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const { user_id, redirect_uri } = stateData;

    if (!user_id) {
      return new Response(getErrorHTML('Missing user ID'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const CLIENT_ID = Deno.env.get('FITBIT_CLIENT_ID');
    const CLIENT_SECRET = Deno.env.get('FITBIT_CLIENT_SECRET');
    const REDIRECT_URI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fitbit-callback`;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('Missing Fitbit credentials');
      return new Response(getErrorHTML('Server configuration error'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(getErrorHTML('Failed to connect to Fitbit'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const tokens = await tokenResponse.json();
    console.log('Received tokens for user:', user_id);

    // Store tokens in database using service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const { error: dbError } = await supabase
      .from('fitbit_tokens')
      .upsert({
        user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(getErrorHTML('Failed to save connection'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    console.log('Tokens saved successfully for user:', user_id);

    // Return success page that closes window
    return new Response(getSuccessHTML(redirect_uri), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Callback error:', error);
    return new Response(getErrorHTML('An unexpected error occurred'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});

function getSuccessHTML(redirectUri: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Fitbit Connected</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #D6006C 0%, #892EFF 100%);
    }
    .container {
      text-align: center;
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .success-icon {
      width: 64px;
      height: 64px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
    }
    .success-icon::after {
      content: '✓';
      color: white;
      font-size: 32px;
    }
    h1 { color: #1f2937; margin-bottom: 0.5rem; }
    p { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon"></div>
    <h1>Fitbit Connected!</h1>
    <p>You can close this window and return to Jvala.</p>
  </div>
  <script>
    setTimeout(() => {
      if (window.opener) {
        window.opener.postMessage({ type: 'fitbit-connected' }, '*');
        window.close();
      } else {
        window.location.href = '${redirectUri || '/'}';
      }
    }, 2000);
  </script>
</body>
</html>`;
}

function getErrorHTML(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Connection Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f3f4f6;
    }
    .container {
      text-align: center;
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .error-icon {
      width: 64px;
      height: 64px;
      background: #ef4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
    }
    .error-icon::after {
      content: '✕';
      color: white;
      font-size: 32px;
    }
    h1 { color: #1f2937; margin-bottom: 0.5rem; }
    p { color: #6b7280; }
    button {
      margin-top: 1rem;
      padding: 0.75rem 2rem;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon"></div>
    <h1>Connection Failed</h1>
    <p>${message}</p>
    <button onclick="window.close()">Close Window</button>
  </div>
</body>
</html>`;
}
