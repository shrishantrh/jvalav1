import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, X, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  patient_id: string;
  patient_name?: string;
  title: string;
  description: string;
  severity: string;
  alert_type: string;
  created_at: string;
  acknowledged_at: string | null;
}

export function ClinicalInbox({ patientIds, onNavigatePatient }: {
  patientIds: string[];
  onNavigatePatient: (id: string) => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientIds.length) { setAlerts([]); setLoading(false); return; }
    (async () => {
      const sb = supabase as any;
      const { data } = await sb
        .from('clinical_alerts')
        .select('*')
        .in('patient_id', patientIds)
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);
      setAlerts(data || []);
      setLoading(false);
    })();
  }, [patientIds]);

  const handleAck = async (id: string) => {
    const sb = supabase as any;
    await sb.from('clinical_alerts').update({ acknowledged_at: new Date().toISOString(), acknowledged_by: (await supabase.auth.getUser()).data.user?.id }).eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleDismiss = async (id: string) => {
    const sb = supabase as any;
    await sb.from('clinical_alerts').update({ dismissed: true, dismissed_at: new Date().toISOString(), dismissed_reason: 'clinician_dismissed' }).eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const unacked = alerts.filter(a => !a.acknowledged_at);

  return (
    <div className="clinical-inbox">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#6B7280]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Alert Inbox</span>
        </div>
        {unacked.length > 0 && (
          <Badge className="bg-[#DC2626] text-white text-[10px] border-0">{unacked.length}</Badge>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-[#6B7280] text-center py-8">Loading…</div>
      ) : unacked.length === 0 ? (
        <div className="text-center py-8">
          <Check className="w-5 h-5 text-[#059669] mx-auto mb-2" />
          <p className="text-xs text-[#6B7280]">No pending alerts</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {unacked.map(a => (
            <div
              key={a.id}
              className={cn(
                "p-2.5 rounded border cursor-pointer hover:bg-[#F9FAFB] transition-colors",
                a.severity === 'critical' ? 'border-l-2 border-l-[#DC2626] border-t-[#E5E7EB] border-r-[#E5E7EB] border-b-[#E5E7EB]' : 'border-[#E5E7EB]'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0" onClick={() => onNavigatePatient(a.patient_id)}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge
                      className={cn(
                        "text-[9px] uppercase border-0 px-1.5 py-0",
                        a.severity === 'critical' ? 'bg-[#DC2626] text-white' :
                        a.severity === 'warning' ? 'bg-[#D97706] text-white' : 'bg-[#E5E7EB] text-[#6B7280]'
                      )}
                    >
                      {a.severity}
                    </Badge>
                    <span className="text-[10px] text-[#6B7280]">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="text-xs font-medium text-[#111827] truncate">{a.title}</div>
                  <div className="text-[10px] text-[#6B7280] truncate">{a.description}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleAck(a.id)} className="p-1 rounded hover:bg-[#E5E7EB]" title="Acknowledge">
                    <Check className="w-3 h-3 text-[#059669]" />
                  </button>
                  <button onClick={() => handleDismiss(a.id)} className="p-1 rounded hover:bg-[#E5E7EB]" title="Dismiss">
                    <X className="w-3 h-3 text-[#6B7280]" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
