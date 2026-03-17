/**
 * Native OAuth for Capacitor
 *
 * Production-style mobile flow:
 * - Start OAuth with a custom-scheme redirect URI
 * - Browser returns directly to app via deep link
 * - App listener exchanges code (or sets session from hash tokens)
 */

import { supabase } from '@/integrations/supabase/client';
import { isNative } from '@/lib/capacitor';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const NATIVE_REDIRECT_URI = 'jvala://auth-callback';

/**
 * Start native OAuth flow for a provider.
 */
export const startNativeOAuth = async (
  provider: 'google' | 'apple'
): Promise<{ url: string } | { error: string }> => {
  try {
    const authParams = new URLSearchParams({
      provider,
      redirect_to: NATIVE_REDIRECT_URI,
    });

    if (provider === 'google') {
      authParams.set('scopes', 'email profile');
      authParams.set('prompt', 'select_account');
    }

    if (provider === 'apple') {
      authParams.set('scopes', 'name email');
    }

    return { url: `${SUPABASE_URL}/auth/v1/authorize?${authParams.toString()}` };
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
 * Set up deep-link and browser-close listeners for native OAuth.
 * Returns cleanup function.
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

      const closeBrowser = async () => {
        try {
          if (browserPlugin) await browserPlugin.close();
        } catch {
          // Ignore close errors
        }
      };

      if (appPlugin) {
        const listener = await appPlugin.addListener(
          'appUrlOpen',
          async (event: { url: string }) => {
            if (!event.url.startsWith(NATIVE_REDIRECT_URI)) return;

            console.log('[nativeAuth] Deep link received:', event.url);

            try {
              const url = new URL(event.url);

              const authError =
                url.searchParams.get('error_description') ||
                url.searchParams.get('error') ||
                '';

              if (authError) {
                console.error('[nativeAuth] OAuth error:', authError);
                window.dispatchEvent(new Event('native-auth-error'));
                await closeBrowser();
                return;
              }

              // PKCE-style callback: exchange ?code=... for a full session
              const code = url.searchParams.get('code');
              if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                  console.error('[nativeAuth] Failed exchangeCodeForSession:', error.message);
                  window.dispatchEvent(new Event('native-auth-error'));
                } else {
                  window.dispatchEvent(new Event('native-auth-complete'));
                }
                await closeBrowser();
                return;
              }

              // Token-style callback fallback: jvala://auth-callback#access_token=...&refresh_token=...
              const hash = url.hash.startsWith('#') ? url.hash.slice(1) : '';
              const hashParams = new URLSearchParams(hash);
              const access_token = hashParams.get('access_token');
              const refresh_token = hashParams.get('refresh_token');

              if (access_token && refresh_token) {
                const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                if (error) {
                  console.error('[nativeAuth] Failed setSession from deep link:', error.message);
                  window.dispatchEvent(new Event('native-auth-error'));
                } else {
                  window.dispatchEvent(new Event('native-auth-complete'));
                }
                await closeBrowser();
                return;
              }

              // Last fallback: check whether session was already established
              const { data } = await supabase.auth.getSession();
              if (data.session) {
                window.dispatchEvent(new Event('native-auth-complete'));
              } else {
                window.dispatchEvent(new Event('native-auth-error'));
              }

              await closeBrowser();
            } catch (e) {
              console.error('[nativeAuth] Deep link handling failed:', e);
              window.dispatchEvent(new Event('native-auth-error'));
              await closeBrowser();
            }
          }
        );

        listeners.push(() => listener?.remove?.());
      }

      // Handle manual close/cancel from in-app browser
      if (browserPlugin) {
        const browserListener = await browserPlugin.addListener(
          'browserFinished',
          async () => {
            await new Promise((r) => setTimeout(r, 400));
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              window.dispatchEvent(new Event('native-auth-complete'));
            } else {
              window.dispatchEvent(new Event('native-browser-closed'));
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