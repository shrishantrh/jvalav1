import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useAIConsent = () => {
  const { user } = useAuth();
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasConsented(null);
      setLoading(false);
      return;
    }

    const checkConsent = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', user.id)
          .single();

        const metadata = data?.metadata as Record<string, any> | null;
        setHasConsented(metadata?.ai_data_consent === true);
      } catch {
        setHasConsented(false);
      } finally {
        setLoading(false);
      }
    };

    checkConsent();
  }, [user]);

  const grantConsent = useCallback(async () => {
    if (!user) return;

    // Get existing metadata first
    const { data: profile } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', user.id)
      .single();

    const existingMetadata = (profile?.metadata as Record<string, any>) || {};

    await supabase
      .from('profiles')
      .update({
        metadata: {
          ...existingMetadata,
          ai_data_consent: true,
          ai_data_consent_at: new Date().toISOString(),
        },
      })
      .eq('id', user.id);

    setHasConsented(true);
  }, [user]);

  const revokeConsent = useCallback(async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', user.id)
      .single();

    const existingMetadata = (profile?.metadata as Record<string, any>) || {};

    await supabase
      .from('profiles')
      .update({
        metadata: {
          ...existingMetadata,
          ai_data_consent: false,
          ai_data_consent_at: null,
        },
      })
      .eq('id', user.id);

    setHasConsented(false);
  }, [user]);

  return { hasConsented, loading, grantConsent, revokeConsent };
};
