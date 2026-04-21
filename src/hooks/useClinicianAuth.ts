import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface ClinicianProfile {
  id: string;
  full_name: string;
  email: string;
  npi: string | null;
  specialty: string | null;
  license_number: string | null;
  license_state: string | null;
  practice_name: string | null;
  practice_address: string | null;
  practice_phone: string | null;
  verified: boolean;
}

/**
 * Hook for clinician authentication state.
 * - Tracks current user
 * - Loads clinician_profiles row
 * - Confirms 'clinician' role exists in user_roles
 */
export function useClinicianAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [isClinician, setIsClinician] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadClinician = useCallback(async (uid: string) => {
    const sb = supabase as any;
    const [profileRes, roleRes] = await Promise.all([
      sb.from('clinician_profiles').select('*').eq('id', uid).maybeSingle(),
      sb.from('user_roles').select('role').eq('user_id', uid).eq('role', 'clinician').maybeSingle(),
    ]);
    if (profileRes.data) setProfile(profileRes.data as ClinicianProfile);
    setIsClinician(!!roleRes.data);
  }, []);

  useEffect(() => {
    // Auth listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer DB call to avoid deadlock
        setTimeout(() => loadClinician(session.user!.id), 0);
      } else {
        setProfile(null);
        setIsClinician(false);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadClinician(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadClinician]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, profile, isClinician, loading, signOut, refetch: () => user && loadClinician(user.id) };
}
