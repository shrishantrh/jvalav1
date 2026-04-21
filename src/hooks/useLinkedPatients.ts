import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subDays, parseISO, isWithinInterval } from 'date-fns';

export interface LinkedPatient {
  patient_id: string;
  link_id: string;
  status: string;
  access_level: string;
  accepted_at: string | null;
  invited_at: string;
  // Profile data
  full_name: string | null;
  email: string | null;
  date_of_birth: string | null;
  biological_sex: string | null;
  conditions: string[];
  // Computed metrics
  flares_7d: number;
  flares_30d: number;
  avg_severity_7d: number;
  last_activity: string | null;
  unread_alerts: number;
  critical_alerts: number;
  health_score: number;
  risk_tier: 'critical' | 'high' | 'moderate' | 'stable';
}

const sevNum = (s: string | null) => s === 'severe' ? 3 : s === 'moderate' ? 2 : s === 'mild' ? 1 : 0;

export function useLinkedPatients(clinicianId: string | undefined) {
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicianId) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Get all active links
      const { data: links, error: linkErr } = await supabase
        .from('patient_clinician_links')
        .select('*')
        .eq('clinician_id', clinicianId)
        .eq('status', 'active');

      if (linkErr) throw linkErr;
      if (!links || links.length === 0) {
        setPatients([]);
        setLoading(false);
        return;
      }

      const patientIds = links.map(l => l.patient_id);

      // 2. Parallel fetch profiles, recent flares, alerts
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30).toISOString();

      const [profilesRes, flaresRes, alertsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, date_of_birth, biological_sex, conditions').in('id', patientIds),
        supabase.from('flare_entries').select('user_id, severity, timestamp, entry_type').in('user_id', patientIds).gte('timestamp', thirtyDaysAgo).eq('entry_type', 'flare'),
        supabase.from('clinical_alerts').select('patient_id, severity, dismissed, acknowledged_at').in('patient_id', patientIds).eq('dismissed', false),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const flaresByPatient = new Map<string, any[]>();
      (flaresRes.data || []).forEach(f => {
        if (!flaresByPatient.has(f.user_id)) flaresByPatient.set(f.user_id, []);
        flaresByPatient.get(f.user_id)!.push(f);
      });
      const alertsByPatient = new Map<string, any[]>();
      (alertsRes.data || []).forEach(a => {
        if (!alertsByPatient.has(a.patient_id)) alertsByPatient.set(a.patient_id, []);
        alertsByPatient.get(a.patient_id)!.push(a);
      });

      const enriched: LinkedPatient[] = links.map(link => {
        const p = profileMap.get(link.patient_id) as any;
        const allFlares = flaresByPatient.get(link.patient_id) || [];
        const last7 = allFlares.filter(f => isWithinInterval(parseISO(f.timestamp), { start: subDays(now, 7), end: now }));
        const avgSev7 = last7.length > 0 ? last7.reduce((s, f) => s + sevNum(f.severity), 0) / last7.length : 0;
        const lastActivity = allFlares[0]?.timestamp || null;
        const alerts = alertsByPatient.get(link.patient_id) || [];
        const unread = alerts.filter(a => !a.acknowledged_at).length;
        const critical = alerts.filter(a => a.severity === 'critical' && !a.acknowledged_at).length;

        // Health score (mirrors useClinicianData logic)
        let hs = 100;
        hs -= Math.min(last7.length * 8, 40);
        hs -= Math.min(avgSev7 * 10, 30);
        hs -= last7.filter(f => f.severity === 'severe').length * 5;
        hs = Math.max(0, Math.min(100, Math.round(hs)));

        const risk_tier: LinkedPatient['risk_tier'] =
          critical > 0 || hs < 25 ? 'critical' :
          hs < 50 || unread > 2 ? 'high' :
          hs < 75 ? 'moderate' : 'stable';

        return {
          patient_id: link.patient_id,
          link_id: link.id,
          status: link.status,
          access_level: link.access_level,
          accepted_at: link.accepted_at,
          invited_at: link.invited_at,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          date_of_birth: p?.date_of_birth ?? null,
          biological_sex: p?.biological_sex ?? null,
          conditions: p?.conditions ?? [],
          flares_7d: last7.length,
          flares_30d: allFlares.length,
          avg_severity_7d: avgSev7,
          last_activity: lastActivity,
          unread_alerts: unread,
          critical_alerts: critical,
          health_score: hs,
          risk_tier,
        };
      });

      // Sort: critical → high → moderate → stable, then by unread alerts desc
      const tierRank = { critical: 0, high: 1, moderate: 2, stable: 3 };
      enriched.sort((a, b) => {
        const t = tierRank[a.risk_tier] - tierRank[b.risk_tier];
        if (t !== 0) return t;
        return b.unread_alerts - a.unread_alerts;
      });

      setPatients(enriched);
    } catch (e: any) {
      setError(e.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  useEffect(() => { load(); }, [load]);

  return { patients, loading, error, refetch: load };
}
