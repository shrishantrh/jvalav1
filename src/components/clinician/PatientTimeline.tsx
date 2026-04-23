import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';

interface TimelineEntry {
  id: string;
  type: 'flare' | 'medication' | 'food' | 'activity';
  timestamp: string;
  title: string;
  subtitle?: string;
  severity?: string;
  meta?: Record<string, any>;
}

const typeColors: Record<string, string> = {
  flare: '#DC2626',
  medication: '#2563EB',
  food: '#D97706',
  activity: '#059669',
};

export function PatientTimeline({ entries, medLogs, foodLogs, activityLogs }: {
  entries: any[];
  medLogs: any[];
  foodLogs: any[];
  activityLogs: any[];
}) {
  const [filter, setFilter] = useState<string>('all');

  const timeline: TimelineEntry[] = useMemo(() => {
    const items: TimelineEntry[] = [];

    entries.forEach(e => {
      items.push({
        id: e.id,
        type: 'flare',
        timestamp: e.timestamp,
        title: `${e.entry_type === 'flare' ? 'Flare' : e.entry_type} — ${e.severity || 'unrated'}`,
        subtitle: [
          ...(e.symptoms || []).slice(0, 3),
          e.note ? `"${e.note.slice(0, 60)}"` : null,
        ].filter(Boolean).join(' · '),
        severity: e.severity,
        meta: { env: e.environmental_data, phys: e.physiological_data, city: e.city },
      });
    });

    medLogs.forEach(m => {
      items.push({
        id: m.id,
        type: 'medication',
        timestamp: m.taken_at,
        title: m.medication_name,
        subtitle: m.dosage || undefined,
      });
    });

    foodLogs.forEach(f => {
      items.push({
        id: f.id,
        type: 'food',
        timestamp: f.logged_at,
        title: f.food_name,
        subtitle: f.calories ? `${f.calories} kcal` : undefined,
      });
    });

    activityLogs.forEach(a => {
      items.push({
        id: a.id,
        type: 'activity',
        timestamp: a.timestamp,
        title: a.activity_type,
        subtitle: a.duration_minutes ? `${a.duration_minutes} min` : undefined,
      });
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [entries, medLogs, foodLogs, activityLogs]);

  const filtered = filter === 'all' ? timeline : timeline.filter(t => t.type === filter);

  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        {['all', 'flare', 'medication', 'food', 'activity'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-[10px] px-2.5 py-1 rounded border uppercase tracking-wider font-medium transition-colors",
              filter === f ? 'bg-[#111827] text-white border-[#111827]' : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F9FAFB]'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
        {filtered.slice(0, 100).map(item => (
          <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 py-2 px-2 border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: typeColors[item.type] }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#111827]">{item.title}</span>
                {item.severity && (
                  <Badge className={cn(
                    "text-[9px] uppercase border-0 px-1.5 py-0",
                    item.severity === 'severe' ? 'bg-[#FEE2E2] text-[#DC2626]' :
                    item.severity === 'moderate' ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#F3F4F6] text-[#6B7280]'
                  )}>
                    {item.severity}
                  </Badge>
                )}
              </div>
              {item.subtitle && <div className="text-[10px] text-[#6B7280] mt-0.5 truncate">{item.subtitle}</div>}
              {item.meta?.city && <span className="text-[9px] text-[#9CA3AF]">📍 {item.meta.city}</span>}
            </div>
            <div className="text-[10px] text-[#9CA3AF] shrink-0 whitespace-nowrap">
              {format(new Date(item.timestamp), 'MMM d, HH:mm')}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-xs text-[#6B7280] text-center py-8">No entries found.</p>}
      </div>
    </div>
  );
}
