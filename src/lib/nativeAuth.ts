/**
 * Native OAuth for Capacitor
 *
 * On native iOS/Android, OAuth flows need special handling because the
 * WebView runs on capacitor://localhost. We:
 *
 * 1. Get the OAuth URL from Supabase with skipBrowserRedirect
 * 2. Set redirectTo to the published URL's bridge page
 * 3. Open the URL in the system browser (SFSafariViewController)
 * 4. The bridge page extracts tokens and redirects to jvala://auth-callback#tokens
 * 5. iOS/Android intercepts the custom scheme and reopens the app
 * 6. We capture the deep link, extract tokens, and set the Supabase session
 *
 * FALLBACK: If the custom scheme redirect is blocked (e.g. on newer iOS),
 * the bridge page shows a "Return to Jvala" button. Additionally, we listen
 * for the browser close event and check for tokens via a shared cookie approach.
 */

import { supabase } from '@/integrations/supabase/client';
import { isNative } from '@/lib/capacitor';

// The published web URL where the bridge page is served
const PUBLISHED_URL = 'https://jvalav1.lovable.app';

/**
 * Start native OAuth flow for a provider.
 * Returns the OAuth URL to open in the system browser.
 */
export const startNativeOAuth = async (
  provider: 'google' | 'apple'
): Promise<{ url: string } | { error: string }> => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        skipBrowserRedirect: true,
        // Redirect to the bridge page on the published URL.
        // The bridge page will extract tokens and redirect to the native app.
        redirectTo: `${PUBLISHED_URL}/native-auth-callback.html`,
      },
    });

    if (error) return { error: error.message };
    if (!data?.url) return { error: 'No OAuth URL returned' };

    return { url: data.url };
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
      // (in case the custom scheme redirect didn't fire)
      if (browserPlugin) {
        const browserListener = await browserPlugin.addListener(
          'browserFinished',
          async () => {
            console.log('[nativeAuth] Browser closed, checking for session...');
            // Give a brief moment for any pending auth state changes
            await new Promise(r => setTimeout(r, 500));
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              console.log('[nativeAuth] Session found after browser close');
              // Force auth state change notification
              window.dispatchEvent(new Event('native-auth-complete'));
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
