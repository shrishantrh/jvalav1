import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Clock } from 'lucide-react';

export function RPMTimeTracker({ clinicianId, patientId }: { clinicianId: string; patientId: string }) {
  const startRef = useRef(Date.now());
  const entryIdRef = useRef<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startRef.current = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);

    // Create entry on mount
    (async () => {
      const sb = supabase as any;
      const { data } = await sb.from('rpm_time_entries').insert({
        clinician_id: clinicianId,
        patient_id: patientId,
        activity_type: 'chart_review',
        started_at: new Date().toISOString(),
      }).select('id').single();
      if (data) entryIdRef.current = data.id;
    })();

    return () => {
      clearInterval(interval);
      // Update duration on unmount
      if (entryIdRef.current) {
        const duration = Math.floor((Date.now() - startRef.current) / 1000);
        const sb = supabase as any;
        sb.from('rpm_time_entries').update({
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        }).eq('id', entryIdRef.current).then(() => {});
      }
    };
  }, [clinicianId, patientId]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280]">
      <Clock className="w-3 h-3" />
      <span className="font-mono">{mins}:{secs.toString().padStart(2, '0')}</span>
      <span>RPM</span>
    </div>
  );
}
