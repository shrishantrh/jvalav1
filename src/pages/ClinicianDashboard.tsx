import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { useClinicianAuth } from "@/hooks/useClinicianAuth";
import { useLinkedPatients, type LinkedPatient } from "@/hooks/useLinkedPatients";
import { ClinicalInbox } from "@/components/clinician/ClinicalInbox";
import { Sparkline } from "@/components/clinician/Sparkline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, LogOut, Search, Stethoscope, AlertTriangle, Activity,
  ChevronRight, Users, Bell, Heart, Moon, Thermometer, ArrowUpDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const tierLabel: Record<string, string> = { critical: 'CRIT', high: 'HIGH', moderate: 'MOD', stable: 'OK' };
const tierBg: Record<string, string> = {
  critical: 'bg-[#FEE2E2] text-[#DC2626]',
  high: 'bg-[#FEF3C7] text-[#D97706]',
  moderate: 'bg-[#F3F4F6] text-[#6B7280]',
  stable: 'bg-[#D1FAE5] text-[#059669]',
};
const hsColor = (hs: number) => hs < 25 ? '#DC2626' : hs < 50 ? '#D97706' : hs < 75 ? '#6B7280' : '#059669';

type SortKey = 'risk' | 'name' | 'flares' | 'alerts' | 'activity';

export default function ClinicianDashboard() {
  const navigate = useNavigate();
  const { user, profile, isClinician, loading: authLoading, signOut } = useClinicianAuth();
  const { patients, loading: patientsLoading, refetch } = useLinkedPatients(user?.id);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('risk');

  useEffect(() => {
    if (!authLoading && (!user || !isClinician)) navigate('/clinician/auth', { replace: true });
  }, [authLoading, user, isClinician, navigate]);

  const filtered = useMemo(() => {
    let list = patients;
    if (tierFilter !== 'all') list = list.filter(p => p.risk_tier === tierFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p =>
        (p.full_name || '').toLowerCase().includes(s) ||
        (p.email || '').toLowerCase().includes(s) ||
        p.conditions.some(c => c.toLowerCase().includes(s))
      );
    }
    const sorted = [...list];
    const tierRank: Record<string, number> = { critical: 0, high: 1, moderate: 2, stable: 3 };
    switch (sortKey) {
      case 'risk': sorted.sort((a, b) => tierRank[a.risk_tier] - tierRank[b.risk_tier]); break;
      case 'name': sorted.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')); break;
      case 'flares': sorted.sort((a, b) => b.flares_7d - a.flares_7d); break;
      case 'alerts': sorted.sort((a, b) => b.unread_alerts - a.unread_alerts); break;
      case 'activity': sorted.sort((a, b) => {
        const ta = a.last_activity ? new Date(a.last_activity).getTime() : 0;
        const tb = b.last_activity ? new Date(b.last_activity).getTime() : 0;
        return tb - ta;
      }); break;
    }
    return sorted;
  }, [patients, search, tierFilter, sortKey]);

  const stats = useMemo(() => ({
    total: patients.length,
    critical: patients.filter(p => p.risk_tier === 'critical').length,
    high: patients.filter(p => p.risk_tier === 'high').length,
    unreadAlerts: patients.reduce((s, p) => s + p.unread_alerts, 0),
    activeToday: patients.filter(p => p.last_activity && (Date.now() - new Date(p.last_activity).getTime()) < 86400000).length,
    avgHealth: patients.length ? Math.round(patients.reduce((s, p) => s + p.health_score, 0) / patients.length) : 0,
  }), [patients]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]"><Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" /></div>;
  }
  if (!user || !isClinician) return null;

  const patientIds = patients.map(p => p.patient_id);

  return (
    <div className="clinical-shell min-h-screen" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white">
        <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Stethoscope className="w-4 h-4 text-[#111827]" />
            <span className="text-sm font-semibold text-[#111827]">{profile?.full_name || 'Provider'}</span>
            {profile?.specialty && <span className="text-[10px] text-[#6B7280]">· {profile.specialty}</span>}
          </div>
          <Button variant="ghost" size="sm" className="text-[#6B7280] hover:text-[#111827] h-8 text-xs" onClick={async () => { await signOut(); navigate('/clinician'); }}>
            <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto flex">
        {/* Main content */}
        <main className="flex-1 p-4 space-y-4 overflow-y-auto" style={{ height: 'calc(100vh - 48px)' }}>
          {/* Stat strip */}
          <div className="flex gap-2">
            <StatChip label="Patients" value={stats.total} />
            <StatChip label="Critical" value={stats.critical} color={stats.critical > 0 ? '#DC2626' : undefined} />
            <StatChip label="High Risk" value={stats.high} color={stats.high > 0 ? '#D97706' : undefined} />
            <StatChip label="Alerts" value={stats.unreadAlerts} color={stats.unreadAlerts > 0 ? '#DC2626' : undefined} />
            <StatChip label="Active Today" value={stats.activeToday} color="#059669" />
            <StatChip label="Avg Score" value={stats.avgHealth} color={hsColor(stats.avgHealth)} />
          </div>

          {/* Search + filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <Input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search patients, conditions…"
                className="pl-8 h-8 text-xs bg-white border-[#E5E7EB] rounded"
              />
            </div>
            <div className="flex gap-0.5">
              {['all', 'critical', 'high', 'moderate', 'stable'].map(t => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded border uppercase tracking-wider font-medium",
                    tierFilter === t ? 'bg-[#111827] text-white border-[#111827]' : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F9FAFB]'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={refetch} className="h-8 text-xs border-[#E5E7EB]">Refresh</Button>
          </div>

          {/* Patient table */}
          {patientsLoading ? (
            <div className="text-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#6B7280] mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded border border-[#E5E7EB] bg-white p-10 text-center">
              <Users className="w-8 h-8 text-[#D1D5DB] mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-[#111827]">No patients found</h3>
              <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                {patients.length === 0
                  ? 'Patients can invite you from Settings → Care Team in their Jvala app using your email.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </div>
          ) : (
            <div className="rounded border border-[#E5E7EB] bg-white overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_1fr_100px_100px_80px_80px_100px_28px] gap-2 px-3 py-2 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <ColHeader label="Patient" sortKey="name" current={sortKey} onSort={setSortKey} />
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#6B7280]">Conditions</span>
                <ColHeader label="Score" sortKey="risk" current={sortKey} onSort={setSortKey} />
                <ColHeader label="Flares 7d" sortKey="flares" current={sortKey} onSort={setSortKey} />
                <ColHeader label="Alerts" sortKey="alerts" current={sortKey} onSort={setSortKey} />
                <ColHeader label="Activity" sortKey="activity" current={sortKey} onSort={setSortKey} />
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#6B7280]">Biometrics</span>
                <span />
              </div>

              {/* Rows */}
              {filtered.map((p, i) => {
                const age = p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 86400000)) : null;
                return (
                  <div
                    key={p.patient_id}
                    onClick={() => navigate(`/clinician/patient/${p.patient_id}`)}
                    className={cn(
                      "grid grid-cols-[2fr_1fr_100px_100px_80px_80px_100px_28px] gap-2 px-3 py-2.5 items-center cursor-pointer hover:bg-[#F9FAFB] border-b border-[#F3F4F6] last:border-0 transition-colors",
                      i % 2 === 1 && 'bg-[#FAFAFA]'
                    )}
                  >
                    {/* Name */}
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#111827] truncate">{p.full_name || p.email || 'Unnamed'}</div>
                      <div className="text-[10px] text-[#9CA3AF]">
                        {age != null && `${age}y`}{age != null && p.biological_sex && ' · '}{p.biological_sex || ''}
                      </div>
                    </div>

                    {/* Conditions */}
                    <div className="text-[10px] text-[#6B7280] truncate">
                      {p.conditions.slice(0, 2).join(', ')}
                      {p.conditions.length > 2 && ` +${p.conditions.length - 2}`}
                    </div>

                    {/* Health Score */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: hsColor(p.health_score) }}>{p.health_score}</span>
                      <Badge className={cn("text-[9px] px-1.5 py-0 border-0 font-medium", tierBg[p.risk_tier])}>
                        {tierLabel[p.risk_tier]}
                      </Badge>
                    </div>

                    {/* Flares */}
                    <div className="text-xs text-[#111827]">
                      <span className="font-semibold">{p.flares_7d}</span>
                      <span className="text-[#9CA3AF]"> / {p.flares_30d}</span>
                    </div>

                    {/* Alerts */}
                    <div>
                      {p.unread_alerts > 0 ? (
                        <Badge className={cn("text-[9px] px-1.5 py-0 border-0", p.critical_alerts > 0 ? 'bg-[#DC2626] text-white' : 'bg-[#FEF3C7] text-[#D97706]')}>
                          {p.unread_alerts}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-[#D1D5DB]">—</span>
                      )}
                    </div>

                    {/* Last activity */}
                    <div className="text-[10px] text-[#9CA3AF]">
                      {p.last_activity ? formatDistanceToNow(new Date(p.last_activity), { addSuffix: true }).replace('about ', '') : '—'}
                    </div>

                    {/* Biometric flags (placeholder) */}
                    <div className="flex gap-1">
                      {/* These would be populated with real anomaly data */}
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="w-3.5 h-3.5 text-[#D1D5DB]" />
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Alert inbox sidebar */}
        <aside className="w-72 border-l border-[#E5E7EB] bg-white p-3 overflow-y-auto hidden lg:block" style={{ height: 'calc(100vh - 48px)' }}>
          <ClinicalInbox
            patientIds={patientIds}
            onNavigatePatient={(id) => navigate(`/clinician/patient/${id}`)}
          />
        </aside>
      </div>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E5E7EB] bg-white">
      <span className="text-sm font-bold" style={{ color: color || '#111827' }}>{value}</span>
      <span className="text-[10px] text-[#6B7280] uppercase tracking-wider">{label}</span>
    </div>
  );
}

function ColHeader({ label, sortKey, current, onSort }: { label: string; sortKey: SortKey; current: SortKey; onSort: (k: SortKey) => void }) {
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        "text-[10px] font-medium uppercase tracking-wider text-left flex items-center gap-0.5",
        current === sortKey ? 'text-[#111827]' : 'text-[#6B7280]'
      )}
    >
      {label}
      <ArrowUpDown className="w-2.5 h-2.5" />
    </button>
  );
}
