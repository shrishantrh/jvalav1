import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClinicalAlert {
  id: string;
  patient_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  recommendation: string | null;
  evidence: any;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  dismissed: boolean;
  created_at: string;
  expires_at: string | null;
}

export function useClinicalAlerts(patientId: string | undefined) {
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await (supabase as any)
        .from('clinical_alerts')
        .select('*')
        .eq('patient_id', patientId)
        .eq('dismissed', false)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setAlerts((data || []) as ClinicalAlert[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const acknowledge = useCallback(async (alertId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from('clinical_alerts').update({
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    }).eq('id', alertId);
    load();
  }, [load]);

  const dismiss = useCallback(async (alertId: string, reason?: string) => {
    await (supabase as any).from('clinical_alerts').update({
      dismissed: true,
      dismissed_at: new Date().toISOString(),
      dismissed_reason: reason,
    }).eq('id', alertId);
    load();
  }, [load]);

  const generateAlerts = useCallback(async () => {
    if (!patientId) return;
    const { error: err } = await supabase.functions.invoke('clinical-decision-support', {
      body: { patient_id: patientId },
    });
    if (!err) load();
  }, [patientId, load]);

  return { alerts, loading, error, refetch: load, acknowledge, dismiss, generateAlerts };
}
