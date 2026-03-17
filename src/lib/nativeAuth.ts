/**
 * Native OAuth for Capacitor
 *
 * Production mobile flow:
 * - Generate provider URL via supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })
 * - Force callback through hosted /native-auth-callback.html with a nonce
 * - Callback page relays code/tokens
 * - App listener exchanges code or sets session
 */

import { supabase } from '@/integrations/supabase/client';
import { isNative } from '@/lib/capacitor';

const NATIVE_REDIRECT_URI = 'jvala://auth-callback';
const FALLBACK_CALLBACK_ORIGIN = 'https://app.jvala.tech';

const generateNonce = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getOAuthCallbackOrigin = () => {
  try {
    const origin = window.location.origin;
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return origin;
    }
  } catch {
    // ignore
  }
  return FALLBACK_CALLBACK_ORIGIN;
};

const buildNativeCallbackUrl = (nonce: string) => {
  const callbackOrigin = getOAuthCallbackOrigin();
  return `${callbackOrigin}/native-auth-callback.html?nonce=${encodeURIComponent(nonce)}`;
};

/**
 * Start native OAuth flow for a provider using Supabase-managed URL generation.
 */
export const startNativeOAuth = async (
  provider: 'google' | 'apple'
): Promise<{ url: string; nonce: string } | { error: string }> => {
  try {
    const nonce = generateNonce();

    const options: {
      redirectTo: string;
      skipBrowserRedirect: boolean;
      scopes?: string;
      queryParams?: Record<string, string>;
    } = {
      redirectTo: buildNativeCallbackUrl(nonce),
      skipBrowserRedirect: true,
    };

    if (provider === 'google') {
      options.scopes = 'email profile';
      options.queryParams = { prompt: 'select_account' };
    }

    if (provider === 'apple') {
      options.scopes = 'name email';
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options,
    });

    if (error) {
      return { error: error.message };
    }

    if (!data?.url) {
      return { error: 'Failed to generate OAuth URL' };
    }

    return { url: data.url, nonce };
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
      await browser.open({ url });
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
      let authSettled = false;

      const emitComplete = () => {
        if (authSettled) return;
        authSettled = true;
        window.dispatchEvent(new Event('native-auth-complete'));
      };

      const emitError = () => {
        if (authSettled) return;
        authSettled = true;
        window.dispatchEvent(new Event('native-auth-error'));
      };

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
                emitError();
                await closeBrowser();
                return;
              }

              const code = url.searchParams.get('code');
              if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                  console.error('[nativeAuth] exchangeCodeForSession failed:', error.message);
                  emitError();
                } else {
                  emitComplete();
                }
                await closeBrowser();
                return;
              }

              const hash = url.hash.startsWith('#') ? url.hash.slice(1) : '';
              const hashParams = new URLSearchParams(hash);
              const access_token = hashParams.get('access_token');
              const refresh_token = hashParams.get('refresh_token');

              if (access_token && refresh_token) {
                const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                if (error) {
                  console.error('[nativeAuth] setSession from deep link failed:', error.message);
                  emitError();
                } else {
                  emitComplete();
                }
                await closeBrowser();
                return;
              }

              const { data } = await supabase.auth.getSession();
              if (data.session) {
                emitComplete();
              } else {
                emitError();
              }

              await closeBrowser();
            } catch (e) {
              console.error('[nativeAuth] Deep link handling failed:', e);
              emitError();
              await closeBrowser();
            }
          }
        );

        listeners.push(() => listener?.remove?.());
      }

      if (browserPlugin) {
        const browserListener = await browserPlugin.addListener(
          'browserFinished',
          async () => {
            if (authSettled) return;

            await new Promise((r) => setTimeout(r, 1200));
            const { data } = await supabase.auth.getSession();

            if (data.session) {
              emitComplete();
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
