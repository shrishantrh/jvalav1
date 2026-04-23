import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { useClinicianAuth } from "@/hooks/useClinicianAuth";
import { useLinkedPatients, type LinkedPatient } from "@/hooks/useLinkedPatients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, Search, Stethoscope, AlertTriangle, Activity, ChevronRight, Users, Bell, FileText } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const tierColor = (t: LinkedPatient['risk_tier']) => ({
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high:     'bg-amber-500/10 text-amber-600 border-amber-500/30',
  moderate: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  stable:   'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
}[t]);

export default function ClinicianDashboard() {
  const navigate = useNavigate();
  const { user, profile, isClinician, loading: authLoading, signOut } = useClinicianAuth();
  const { patients, loading: patientsLoading, refetch } = useLinkedPatients(user?.id);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !isClinician)) navigate('/clinician/auth', { replace: true });
  }, [authLoading, user, isClinician, navigate]);

  const filtered = useMemo(() => {
    if (!search) return patients;
    const s = search.toLowerCase();
    return patients.filter(p =>
      (p.full_name || '').toLowerCase().includes(s) ||
      (p.email || '').toLowerCase().includes(s) ||
      p.conditions.some(c => c.toLowerCase().includes(s))
    );
  }, [patients, search]);

  const stats = useMemo(() => ({
    total: patients.length,
    critical: patients.filter(p => p.risk_tier === 'critical').length,
    unreadAlerts: patients.reduce((s, p) => s + p.unread_alerts, 0),
    activeToday: patients.filter(p => p.last_activity && (Date.now() - new Date(p.last_activity).getTime()) < 86400000).length,
  }), [patients]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!user || !isClinician) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">{profile?.full_name || 'Provider Dashboard'}</div>
              <div className="text-[11px] text-muted-foreground">
                {profile?.specialty || 'Clinician'} {profile?.npi && `· NPI ${profile.npi}`}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate('/clinician/auth'); }}>
            <LogOut className="w-4 h-4 mr-1.5" /> Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users}          label="Patients"        value={stats.total} />
          <StatCard icon={AlertTriangle}  label="Critical"        value={stats.critical} accent="critical" />
          <StatCard icon={Bell}           label="Open Alerts"     value={stats.unreadAlerts} accent={stats.unreadAlerts > 0 ? 'warning' : undefined} />
          <StatCard icon={Activity}       label="Active Today"    value={stats.activeToday} accent="ok" />
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients, conditions, email…" className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>Refresh</Button>
        </div>

        {/* Patient list */}
        {patientsLoading ? (
          <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No linked patients yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Patients can invite you from <span className="font-medium">Settings → Care Team</span> in their Jvala app. Once they enter your email, you'll appear here automatically.
            </p>
            <p className="text-xs text-muted-foreground">Your provider email: <span className="font-mono">{user.email}</span></p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <PatientRow key={p.patient_id} p={p} onOpen={() => navigate(`/clinician/patient/${p.patient_id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: 'critical' | 'warning' | 'ok' }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <Icon className={cn(
          "w-4 h-4",
          accent === 'critical' ? 'text-destructive' :
          accent === 'warning' ? 'text-amber-500' :
          accent === 'ok' ? 'text-emerald-500' : 'text-muted-foreground'
        )} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </Card>
  );
}

function PatientRow({ p, onOpen }: { p: LinkedPatient; onOpen: () => void }) {
  const age = p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 86400000)) : null;
  return (
    <Card className="p-4 hover:bg-muted/30 transition cursor-pointer" onClick={onOpen}>
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold", tierColor(p.risk_tier))}>
          {p.health_score}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-sm truncate">{p.full_name || p.email || 'Unnamed Patient'}</div>
            <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", tierColor(p.risk_tier))}>
              {p.risk_tier}
            </Badge>
            {p.critical_alerts > 0 && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                {p.critical_alerts} critical
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {age != null && `${age}y`}{age != null && p.biological_sex && ' · '}{p.biological_sex || ''}
            {(age || p.biological_sex) && p.conditions.length > 0 && ' · '}
            {p.conditions.slice(0, 3).join(', ')}
            {p.conditions.length > 3 && ` +${p.conditions.length - 3}`}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            <span><span className="font-medium text-foreground">{p.flares_7d}</span> flares 7d</span>
            <span><span className="font-medium text-foreground">{p.flares_30d}</span>/30d</span>
            {p.unread_alerts > 0 && <span className="text-amber-600"><Bell className="w-2.5 h-2.5 inline mr-0.5" />{p.unread_alerts}</span>}
            {p.last_activity && <span>Last: {formatDistanceToNow(new Date(p.last_activity), { addSuffix: true })}</span>}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </Card>
  );
}
