import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { setSentryUser, clearSentryUser } from '@/lib/sentry';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Sentry user context
        if (session?.user) {
          setSentryUser(session.user.id, session.user.email);
        } else {
          clearSentryUser();
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth deep links on native (email verification, password reset)
    const setupAuthDeepLink = async () => {
      try {
        const { isNative } = await import('@/lib/capacitor');
        if (!isNative) return;

        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appUrlOpen', async (event) => {
          const url = event.url;
          // Handle auth-related deep links with tokens
          if (url.includes('access_token') && url.includes('refresh_token')) {
            console.log('[Auth] Deep link with tokens received');
            try {
              // Extract tokens from hash or query
              const hashOrQuery = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
              if (!hashOrQuery) return;
              const params = new URLSearchParams(hashOrQuery);
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');
              if (accessToken && refreshToken) {
                const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                if (error) {
                  console.error('[Auth] setSession from deep link failed:', error);
                } else {
                  console.log('[Auth] Session set from deep link successfully');
                }
              }
            } catch (e) {
              console.error('[Auth] Failed to process auth deep link:', e);
            }
          }
        });
        return () => listener.remove();
      } catch (e) {
        console.log('[Auth] Deep link listener setup skipped:', e);
      }
    };

    let cleanupDeepLink: (() => void) | undefined;
    setupAuthDeepLink().then(cleanup => { cleanupDeepLink = cleanup; });

    return () => {
      subscription.unsubscribe();
      cleanupDeepLink?.();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
};