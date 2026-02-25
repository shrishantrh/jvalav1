/**
 * Native OAuth for Capacitor
 *
 * Uses a token-relay edge function to securely pass OAuth tokens
 * from the in-app browser (SFSafariViewController) back to the app.
 *
 * Flow:
 * 1. Generate a one-time nonce
 * 2. Build the OAuth broker URL with nonce in the callback URL
 * 3. Open in SFSafariViewController
 * 4. After OAuth, callback page POSTs tokens to edge function keyed by nonce
 * 5. When browser closes, app fetches tokens from edge function and sets session
 */

import { supabase } from '@/integrations/supabase/client';
import { isNative } from '@/lib/capacitor';

const PUBLISHED_URL = 'https://jvalav1.lovable.app';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Generate a cryptographic random nonce */
const generateNonce = (): string => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/** Store the current nonce so we can retrieve tokens later */
let activeNonce: string | null = null;

/**
 * Start native OAuth flow for a provider.
 */
export const startNativeOAuth = async (
  provider: 'google' | 'apple'
): Promise<{ url: string } | { error: string }> => {
  try {
    const nonce = generateNonce();
    activeNonce = nonce;

    // Include nonce as a query parameter in the callback URL
    const callbackUrl = `${PUBLISHED_URL}/native-auth-callback.html?nonce=${nonce}`;

    const params = new URLSearchParams({
      provider,
      redirect_uri: callbackUrl,
    });

    const brokerUrl = `${PUBLISHED_URL}/~oauth/initiate?${params.toString()}`;

    return { url: brokerUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' };
  }
};

/**
 * Open the OAuth URL in the native system browser.
 */
export const openInNativeBrowser = async (url: string): Promise<void> => {
  try {
    const browser =
      (window as any)?.Capacitor?.Plugins?.Browser ??
      (await import('@capacitor/browser').catch(() => null))?.Browser;

    if (browser) {
      await browser.open({ url, presentationStyle: 'popover' });
    } else {
      window.open(url, '_blank');
    }
  } catch (e) {
    console.error('[nativeAuth] Failed to open browser:', e);
    window.location.href = url;
  }
};

/**
 * Fetch tokens from the relay edge function using the active nonce.
 * Returns the tokens or null if not found.
 */
const fetchRelayedTokens = async (): Promise<{
  access_token: string;
  refresh_token: string;
} | null> => {
  if (!activeNonce) return null;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/native-token-relay?nonce=${activeNonce}`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.log('[nativeAuth] No relayed tokens found (status ' + res.status + ')');
      return null;
    }

    const data = await res.json();
    if (data.access_token && data.refresh_token) {
      return { access_token: data.access_token, refresh_token: data.refresh_token };
    }
    return null;
  } catch (e) {
    console.error('[nativeAuth] Error fetching relayed tokens:', e);
    return null;
  }
};

/**
 * Set up the browser-close listener to retrieve tokens from the relay.
 * Also listens for deep links as a fallback.
 * Returns a cleanup function.
 */
export const setupNativeAuthListener = (): (() => void) => {
  if (!isNative) return () => {};

  let cleanup = () => {};

  const init = async () => {
    try {
      const appPlugin =
        (window as any)?.Capacitor?.Plugins?.App ??
        (await import('@capacitor/app').catch(() => null))?.App;

      const browserPlugin =
        (window as any)?.Capacitor?.Plugins?.Browser ??
        (await import('@capacitor/browser').catch(() => null))?.Browser;

      const listeners: (() => void)[] = [];

      // Deep link fallback (for devices where custom scheme works)
      if (appPlugin) {
        const listener = await appPlugin.addListener(
          'appUrlOpen',
          async (event: { url: string }) => {
            console.log('[nativeAuth] Deep link received:', event.url);

            if (!event.url.startsWith('jvala://auth-callback')) return;

            const hashIndex = event.url.indexOf('#');
            if (hashIndex === -1) return;

            const hash = event.url.substring(hashIndex + 1);
            const params = new URLSearchParams(hash);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');

            if (!access_token || !refresh_token) {
              console.error('[nativeAuth] Could not parse tokens from deep link');
              return;
            }

            console.log('[nativeAuth] Setting session from deep link tokens');
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) {
              console.error('[nativeAuth] Failed to set session:', error.message);
            } else {
              console.log('[nativeAuth] Session set successfully via deep link');
              activeNonce = null;
            }

            try {
              if (browserPlugin) await browserPlugin.close();
            } catch {
              /* ignore */
            }
          }
        );
        listeners.push(() => listener?.remove?.());
      }

      // Primary mechanism: when browser closes, fetch tokens from relay
      if (browserPlugin) {
        const browserListener = await browserPlugin.addListener(
          'browserFinished',
          async () => {
            console.log('[nativeAuth] Browser closed, fetching relayed tokens...');

            // Small delay to ensure the callback page had time to POST
            await new Promise((r) => setTimeout(r, 800));

            const tokens = await fetchRelayedTokens();

            if (tokens) {
              console.log('[nativeAuth] Got tokens from relay, setting session');
              const { error } = await supabase.auth.setSession(tokens);
              if (error) {
                console.error('[nativeAuth] Failed to set session from relay:', error.message);
                window.dispatchEvent(new Event('native-auth-error'));
              } else {
                console.log('[nativeAuth] Session set successfully via relay');
                window.dispatchEvent(new Event('native-auth-complete'));
              }
              activeNonce = null;
            } else {
              // No tokens = user likely cancelled or relay failed
              console.log('[nativeAuth] No relayed tokens found');

              // Last resort: check if session exists (might have been set via deep link)
              const { data } = await supabase.auth.getSession();
              if (data.session) {
                console.log('[nativeAuth] Session found after browser close');
                window.dispatchEvent(new Event('native-auth-complete'));
              } else {
                console.log('[nativeAuth] No session — user likely cancelled');
                window.dispatchEvent(new Event('native-browser-closed'));
              }
              activeNonce = null;
            }
          }
        );
        listeners.push(() => browserListener?.remove?.());
      }

      cleanup = () => listeners.forEach((remove) => remove());
    } catch (e) {
      console.error('[nativeAuth] Failed to set up listeners:', e);
    }
  };

  init();

  return () => cleanup();
};
