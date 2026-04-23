import { format } from 'date-fns';
import { Pill } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function MedicationTimeline({ medLogs, foodLogs }: { medLogs: any[]; foodLogs: any[] }) {
  const uniqueMeds = Array.from(new Set(medLogs.map(m => m.medication_name)));

  return (
    <div className="space-y-6">
      {/* Active medications */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Active Medications ({uniqueMeds.length})</h3>
        {uniqueMeds.length === 0 ? (
          <p className="text-xs text-[#6B7280]">No medications logged in the last 30 days.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {uniqueMeds.map(m => (
              <Badge key={m} className="bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] text-[11px]">
                <Pill className="w-3 h-3 mr-1" />{m}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Medication log timeline */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Medication Log</h3>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {medLogs.slice(0, 30).map(m => (
            <div key={m.id} className="flex items-center gap-3 py-1.5 border-b border-[#F3F4F6] last:border-0">
              <div className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
              <div className="flex-1 text-xs text-[#374151]">{m.medication_name}</div>
              <div className="text-[10px] text-[#6B7280]">{m.dosage || '—'}</div>
              <div className="text-[10px] text-[#6B7280]">{format(new Date(m.taken_at), 'MMM d, HH:mm')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Food log summary */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Food Log ({foodLogs.length} entries)</h3>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {foodLogs.slice(0, 20).map(f => (
            <div key={f.id} className="flex items-center gap-3 py-1.5 border-b border-[#F3F4F6] last:border-0">
              <div className="w-2 h-2 rounded-full bg-[#D97706] shrink-0" />
              <div className="flex-1 text-xs text-[#374151]">{f.food_name}</div>
              <div className="text-[10px] text-[#6B7280]">{f.calories ? `${f.calories} kcal` : '—'}</div>
              <div className="text-[10px] text-[#6B7280]">{format(new Date(f.logged_at), 'MMM d, HH:mm')}</div>
            </div>
          ))}
          {foodLogs.length === 0 && <p className="text-xs text-[#6B7280]">No food logs in the last 30 days.</p>}
        </div>
      </div>
    </div>
  );
}
