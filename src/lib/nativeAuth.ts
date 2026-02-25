/**
 * Native OAuth for Capacitor
 *
 * On native iOS/Android, OAuth flows need special handling because the
 * WebView runs on capacitor://localhost. We:
 *
 * 1. Build the Lovable Cloud OAuth broker URL with the native callback as redirect_uri
 * 2. Open the URL in the system browser (SFSafariViewController)
 * 3. The broker handles Google/Apple OAuth and redirects to native-auth-callback.html#tokens
 * 4. The callback page redirects to jvala://auth-callback#tokens
 * 5. iOS/Android intercepts the custom scheme and reopens the app
 * 6. We capture the deep link, extract tokens, and set the Supabase session
 *
 * FALLBACK: If the custom scheme redirect is blocked, the callback page shows
 * a "Return to Jvala" button. Additionally, we listen for the browser close
 * event and check for tokens.
 */

import { supabase } from '@/integrations/supabase/client';
import { isNative } from '@/lib/capacitor';

// The Lovable-published URL where the ~oauth broker is available.
// app.jvala.tech is GitHub Pages and does NOT have the broker.
const PUBLISHED_URL = 'https://jvalav1.lovable.app';

/**
 * Generate a cryptographic random state parameter for CSRF protection.
 */
const generateState = (): string => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Start native OAuth flow for a provider.
 * Uses the Lovable Cloud OAuth broker instead of direct Supabase auth,
 * so that managed Google/Apple credentials are used.
 */
export const startNativeOAuth = async (
  provider: 'google' | 'apple'
): Promise<{ url: string } | { error: string }> => {
  try {
    const state = generateState();
    // Store state for validation when tokens come back
    sessionStorage.setItem('native_oauth_state', state);

    const params = new URLSearchParams({
      provider,
      redirect_uri: `${PUBLISHED_URL}/native-auth-callback.html`,
      state,
    });

    // Use the Lovable Cloud OAuth broker on the published URL
    const brokerUrl = `${PUBLISHED_URL}/~oauth/initiate?${params.toString()}`;

    return { url: brokerUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' };
  }
};

/**
 * Open the OAuth URL in the native system browser.
 * Uses the Capacitor Browser plugin (SFSafariViewController on iOS).
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
 * Parse tokens from a deep link URL like:
 * jvala://auth-callback#access_token=...&refresh_token=...
 */
const parseTokensFromUrl = (
  url: string
): { access_token: string; refresh_token: string } | null => {
  try {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return null;

    const hash = url.substring(hashIndex + 1);
    const params = new URLSearchParams(hash);

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      return { access_token, refresh_token };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Set up the deep link listener for OAuth callbacks.
 * Also sets up a browser-close listener as fallback to check session.
 * Returns a cleanup function to remove the listeners.
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

      // Listen for deep links (jvala://auth-callback#tokens)
      if (appPlugin) {
        const listener = await appPlugin.addListener(
          'appUrlOpen',
          async (event: { url: string }) => {
            console.log('[nativeAuth] Deep link received:', event.url);

            if (!event.url.startsWith('jvala://auth-callback')) return;

            const tokens = parseTokensFromUrl(event.url);
            if (!tokens) {
              console.error('[nativeAuth] Could not parse tokens from deep link');
              return;
            }

            console.log('[nativeAuth] Setting session from deep link tokens');
            const { error } = await supabase.auth.setSession(tokens);
            if (error) {
              console.error('[nativeAuth] Failed to set session:', error.message);
            } else {
              console.log('[nativeAuth] Session set successfully');
            }

            // Close the in-app browser
            try {
              if (browserPlugin) await browserPlugin.close();
            } catch { /* ignore */ }
          }
        );
        listeners.push(() => listener?.remove?.());
      }

      // Fallback: when browser closes, check if there's a session
      if (browserPlugin) {
        const browserListener = await browserPlugin.addListener(
          'browserFinished',
          async () => {
            console.log('[nativeAuth] Browser closed, checking for session...');
            await new Promise(r => setTimeout(r, 500));
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              console.log('[nativeAuth] Session found after browser close');
              window.dispatchEvent(new Event('native-auth-complete'));
            } else {
              console.log('[nativeAuth] No session after browser close — user likely cancelled');
              window.dispatchEvent(new Event('native-browser-closed'));
            }
          }
        );
        listeners.push(() => browserListener?.remove?.());
      }

      cleanup = () => listeners.forEach(remove => remove());
    } catch (e) {
      console.error('[nativeAuth] Failed to set up listeners:', e);
    }
  };

  init();

  return () => cleanup();
};
