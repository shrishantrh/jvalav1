import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, User, Activity, FileText, Download, Share2,
  AlertTriangle, Heart, Moon, Pill, TrendingUp, TrendingDown, 
  Thermometer, Droplets, Wind, Clock, Calendar,
  ShieldAlert, Stethoscope, Brain, Flame, Gauge,
  BarChart3, Zap, Sun, MapPin, Utensils,
  Shield, ClipboardList, Timer, Target, CheckCircle2, XCircle,
  Printer, ChevronRight, Info, Sparkles, Scale, Ruler
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
  AreaChart, Area, BarChart, Bar, Cell, CartesianGrid,
  RadialBarChart, RadialBar, PieChart as RechartsPie, Pie, Legend
} from "recharts";
import { format, formatDistanceToNow, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useClinicianData } from "@/hooks/useClinicianData";
import { Skeleton } from "@/components/ui/skeleton";

// Glass card component
const GlassCard = ({ children, className = "", gradient, onClick }: { 
  children: React.ReactNode; className?: string; gradient?: string; onClick?: () => void;
}) => (
  <div onClick={onClick} className={cn(
    "relative rounded-2xl overflow-hidden p-5",
    "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl",
    "border border-slate-200/60 dark:border-slate-700/50",
    "shadow-[0_4px_24px_rgba(0,0,0,0.04)]",
    onClick && "cursor-pointer hover:shadow-lg transition-shadow",
    gradient, className
  )}>
    <div className="relative z-10">{children}</div>
  </div>
);

// Metric card
const MetricCard = ({ label, value, unit, icon: Icon, status, trend, subtitle }: {
  label: string; value: string | number; unit?: string; icon: any;
  status?: 'normal' | 'warning' | 'critical'; trend?: 'up' | 'down' | 'stable'; subtitle?: string;
}) => (
  <div className={cn(
    "rounded-xl p-3.5 border",
    status === 'critical' ? "bg-red-50/80 dark:bg-red-950/30 border-red-200/60" :
    status === 'warning' ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/60" :
    "bg-white/60 dark:bg-slate-800/60 border-slate-200/40"
  )}>
    <div className="flex items-center justify-between mb-1">
      <Icon className={cn("w-4 h-4",
        status === 'critical' ? "text-red-500" : status === 'warning' ? "text-amber-500" : "text-muted-foreground"
      )} />
      {trend === 'up' ? <TrendingUp className="w-3 h-3 text-red-500" /> :
       trend === 'down' ? <TrendingDown className="w-3 h-3 text-emerald-500" /> : null}
    </div>
    <p className="text-xl font-bold">{value}<span className="text-xs text-muted-foreground ml-1">{unit}</span></p>
    <p className="text-[11px] text-muted-foreground">{label}</p>
    {subtitle && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
  </div>
);

// Section header
const SectionHeader = ({ icon: Icon, title, badge, action }: {
  icon: any; title: string; badge?: React.ReactNode; action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-primary" />
      <h3 className="font-semibold">{title}</h3>
      {badge}
    </div>
    {action}
  </div>
);

// Severity bar
const SeverityBar = ({ value, max = 3 }: { value: number; max?: number }) => (
  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden w-full">
    <div className={cn("h-full rounded-full transition-all",
      value >= 2.5 ? "bg-red-500" : value >= 1.5 ? "bg-amber-500" : "bg-emerald-500"
    )} style={{ width: `${(value / max) * 100}%` }} />
  </div>
);

// Loading skeleton
const DashboardSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
    <Skeleton className="h-40 rounded-2xl" />
    <div className="grid grid-cols-4 gap-4">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  </div>
);

const ClinicianDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, entries, medications, foodLogs, analytics, loading, error, accessInfo } = useClinicianData();
  const [activeTab, setActiveTab] = useState('overview');

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <DashboardSkeleton />
    </div>
  );

  if (error || !profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <GlassCard className="max-w-md text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-sm text-muted-foreground mb-4">{error || 'Unable to load patient data. The access link may be invalid or expired.'}</p>
        <Button onClick={() => navigate('/')} className="rounded-xl">Return Home</Button>
      </GlassCard>
    </div>
  );

  const a = analytics;
  const patientAge = profile.date_of_birth 
    ? Math.floor(differenceInDays(new Date(), parseISO(profile.date_of_birth)) / 365.25)
    : null;

  const sevLabel = (s: number) => s >= 2.5 ? 'Severe' : s >= 1.5 ? 'Moderate' : s > 0 ? 'Mild' : 'None';
  const sevColor = (s: number) => s >= 2.5 ? 'text-red-600' : s >= 1.5 ? 'text-amber-600' : 'text-emerald-600';

  // Flare entries for the timeline
  const recentFlares = entries.filter(e => e.entry_type === 'flare').slice(0, 20);

  // Physiological data from most recent entry with wearable data
  const latestPhysio = entries.find(e => e.physiological_data)?.physiological_data;
  const latestEnv = entries.find(e => e.environmental_data)?.environmental_data;

  const handlePrint = () => window.print();
  
  const handleExport = () => {
    toast({ title: "Generating Clinical Report", description: "PDF export will download shortly" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 print:bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/60 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Clinical Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                {accessInfo?.physician_name ? `Dr. ${accessInfo.physician_name}` : 'Provider Portal'} • 
                Expires {accessInfo?.expires_at ? format(parseISO(accessInfo.expires_at), 'MMM d, yyyy') : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-2">
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button size="sm" onClick={handleExport} className="rounded-xl gap-2">
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Patient Header */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <GlassCard className="lg:col-span-3 !p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{profile.full_name || 'Patient'}</h2>
                  <p className="text-sm text-muted-foreground">
                    {patientAge ? `${patientAge} yrs` : ''} 
                    {profile.biological_sex ? ` • ${profile.biological_sex}` : ''}
                    {profile.date_of_birth ? ` • DOB: ${format(parseISO(profile.date_of_birth), 'MM/dd/yyyy')}` : ''}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {profile.conditions?.map(c => (
                      <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                    {profile.blood_type && <Badge variant="outline" className="text-xs">Blood: {profile.blood_type}</Badge>}
                    {profile.weight_kg && <Badge variant="outline" className="text-xs">{profile.weight_kg}kg</Badge>}
                    {profile.height_cm && <Badge variant="outline" className="text-xs">{profile.height_cm}cm</Badge>}
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    {profile.physician_name && (
                      <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {profile.physician_name}</span>
                    )}
                    {profile.emergency_contact_name && (
                      <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> EC: {profile.emergency_contact_name}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <Badge variant="outline" className={cn(
                  a.riskLevel === 'critical' ? "bg-red-500/10 text-red-600 border-red-500/30" :
                  a.riskLevel === 'high' ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
                  a.riskLevel === 'moderate' ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
                  "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                )}>
                  {a.riskLevel === 'critical' || a.riskLevel === 'high' ? <AlertTriangle className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {a.riskLevel.charAt(0).toUpperCase() + a.riskLevel.slice(1)} Risk
                </Badge>
                <p className="text-xs text-muted-foreground">{a.totalEntries} total entries</p>
              </div>
            </div>
          </GlassCard>

          {/* Health Score */}
          <GlassCard>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Health Score</p>
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/20" />
                  <circle cx="48" cy="48" r="40" stroke={
                    a.healthScore >= 75 ? "#10b981" : a.healthScore >= 50 ? "#f59e0b" : "#ef4444"
                  } strokeWidth="8" fill="none" strokeDasharray={`${a.healthScore * 2.51} 251`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">{a.healthScore}</span>
                </div>
              </div>
              <p className={cn("text-sm font-medium mt-2", sevColor(3 - a.healthScore / 33))}>
                {a.healthScore >= 75 ? 'Good' : a.healthScore >= 50 ? 'Needs Attention' : a.healthScore >= 25 ? 'Poor' : 'Critical'}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.severityTrend === 'improving' ? '↑ Improving' : a.severityTrend === 'worsening' ? '↓ Declining' : '→ Stable'}
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Alert Banner */}
        {(a.riskLevel === 'high' || a.riskLevel === 'critical') && (
          <GlassCard className="!p-4 border-red-200/60">
            <div className="flex items-center gap-4 overflow-x-auto">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-semibold text-red-600">Clinical Alerts</span>
              </div>
              <div className="h-6 w-px bg-border shrink-0" />
              <div className="flex gap-2 overflow-x-auto">
                {a.flaresLast7d > 3 && (
                  <Badge variant="outline" className="shrink-0 bg-red-50 text-red-600 border-red-200">
                    {a.flaresLast7d} flares this week (↑)
                  </Badge>
                )}
                {a.avgSeverity7d >= 2.5 && (
                  <Badge variant="outline" className="shrink-0 bg-red-50 text-red-600 border-red-200">
                    Average severity: Severe
                  </Badge>
                )}
                {a.severityTrend === 'worsening' && (
                  <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-600 border-amber-200">
                    Severity trend worsening
                  </Badge>
                )}
                {a.symptomFrequency.filter(s => s.trend === 'up').length > 0 && (
                  <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-600 border-amber-200">
                    {a.symptomFrequency.filter(s => s.trend === 'up').length} symptoms escalating
                  </Badge>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full lg:w-auto lg:inline-grid print:hidden">
            <TabsTrigger value="overview" className="text-xs gap-1"><BarChart3 className="w-3 h-3" />Overview</TabsTrigger>
            <TabsTrigger value="symptoms" className="text-xs gap-1"><Activity className="w-3 h-3" />Symptoms</TabsTrigger>
            <TabsTrigger value="medications" className="text-xs gap-1"><Pill className="w-3 h-3" />Medications</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs gap-1"><Clock className="w-3 h-3" />Timeline</TabsTrigger>
            <TabsTrigger value="vitals" className="text-xs gap-1"><Heart className="w-3 h-3" />Vitals</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <MetricCard label="Flares (7d)" value={a.flaresLast7d} icon={Flame} 
                status={a.flaresLast7d > 5 ? 'critical' : a.flaresLast7d > 3 ? 'warning' : 'normal'}
                trend={a.severityTrend === 'worsening' ? 'up' : a.severityTrend === 'improving' ? 'down' : 'stable'} />
              <MetricCard label="Flares (30d)" value={a.flaresLast30d} icon={BarChart3} />
              <MetricCard label="Avg Severity" value={sevLabel(a.avgSeverity7d)} icon={Gauge}
                status={a.avgSeverity7d >= 2.5 ? 'critical' : a.avgSeverity7d >= 1.5 ? 'warning' : 'normal'}
                subtitle={`${a.avgSeverity7d.toFixed(1)}/3.0`} />
              <MetricCard label="Flare-Free Streak" value={a.currentFlareFreeStreak} unit="days" icon={CheckCircle2} />
              <MetricCard label="Avg Duration" value={a.avgFlareDuration > 0 ? Math.round(a.avgFlareDuration) : 'N/A'} unit={a.avgFlareDuration > 0 ? 'min' : ''} icon={Timer} />
              <MetricCard label="Wellness Days" value={a.totalWellnessDays} icon={Sun} />
            </div>

            {/* Severity Timeline + Top Symptoms/Triggers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <GlassCard className="lg:col-span-2">
                <SectionHeader icon={TrendingUp} title="30-Day Severity Timeline" 
                  badge={<Badge variant="outline" className="text-[10px]">Last 30 days</Badge>} />
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={a.dailySeverity}>
                      <defs>
                        <linearGradient id="sevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={4} />
                      <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" domain={[0, 3]} 
                        tickFormatter={(v) => v === 3 ? 'Sev' : v === 2 ? 'Mod' : v === 1 ? 'Mild' : ''} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="avgSeverity" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#sevGrad)" name="Avg Severity" />
                      <Bar dataKey="count" fill="hsl(var(--primary))" opacity={0.3} name="Flare Count" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard>
                <SectionHeader icon={Target} title="Peak Patterns" />
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Peak Time</p>
                    <p className="text-sm font-semibold capitalize">{a.peakFlareTime}s</p>
                    <p className="text-[10px] text-muted-foreground">
                      {a.timeOfDayDistribution[a.peakFlareTime as keyof typeof a.timeOfDayDistribution]} of {a.flaresLast30d} flares
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Flare-Free Record</p>
                    <p className="text-sm font-semibold">{a.longestFlareFreeStreak} days</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Severity Trend</p>
                    <p className={cn("text-sm font-semibold", 
                      a.severityTrend === 'improving' ? 'text-emerald-600' : 
                      a.severityTrend === 'worsening' ? 'text-red-600' : 'text-muted-foreground'
                    )}>
                      {a.severityTrend === 'improving' ? '↓ Improving' : a.severityTrend === 'worsening' ? '↑ Worsening' : '→ Stable'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">vs previous 30 days</p>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Top Symptoms + Triggers side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassCard>
                <SectionHeader icon={Activity} title="Top Symptoms (30d)" />
                {a.symptomFrequency.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No symptom data</p>
                ) : (
                  <div className="space-y-2.5">
                    {a.symptomFrequency.slice(0, 8).map((s, i) => (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-sm font-medium">{s.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{s.count}×</span>
                              {s.trend === 'up' ? <TrendingUp className="w-3 h-3 text-red-500" /> :
                               s.trend === 'down' ? <TrendingDown className="w-3 h-3 text-emerald-500" /> : null}
                            </div>
                          </div>
                          <SeverityBar value={s.avgSeverity} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard>
                <SectionHeader icon={Zap} title="Top Triggers (30d)" />
                {a.triggerFrequency.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No trigger data</p>
                ) : (
                  <div className="space-y-2.5">
                    {a.triggerFrequency.slice(0, 8).map((t, i) => (
                      <div key={t.name} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-sm font-medium">{t.name}</span>
                            <span className="text-xs text-muted-foreground">{t.count}×</span>
                          </div>
                          <SeverityBar value={t.avgSeverity} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          </TabsContent>

          {/* SYMPTOMS TAB */}
          <TabsContent value="symptoms" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Symptom Frequency Chart */}
              <GlassCard>
                <SectionHeader icon={BarChart3} title="Symptom Frequency" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={a.symptomFrequency.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Occurrences" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Time of Day Distribution */}
              <GlassCard>
                <SectionHeader icon={Clock} title="Time of Day Distribution" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={[
                          { name: 'Morning', value: a.timeOfDayDistribution.morning, fill: '#f59e0b' },
                          { name: 'Afternoon', value: a.timeOfDayDistribution.afternoon, fill: '#ef4444' },
                          { name: 'Evening', value: a.timeOfDayDistribution.evening, fill: '#8b5cf6' },
                          { name: 'Night', value: a.timeOfDayDistribution.night, fill: '#3b82f6' },
                        ]}
                        cx="50%" cy="50%" outerRadius={80} innerRadius={50}
                        dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                      >
                        {[
                          { fill: '#f59e0b' }, { fill: '#ef4444' }, { fill: '#8b5cf6' }, { fill: '#3b82f6' }
                        ].map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Symptom-Severity Detail Table */}
              <GlassCard className="lg:col-span-2">
                <SectionHeader icon={ClipboardList} title="Symptom Detail Report" 
                  badge={<Badge variant="outline" className="text-[10px]">{a.symptomFrequency.length} symptoms tracked</Badge>} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Symptom</th>
                        <th className="pb-2 font-medium text-center">Frequency</th>
                        <th className="pb-2 font-medium text-center">Avg Severity</th>
                        <th className="pb-2 font-medium text-center">7d Trend</th>
                        <th className="pb-2 font-medium">Severity Bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.symptomFrequency.map(s => (
                        <tr key={s.name} className="border-b border-muted/20">
                          <td className="py-2 font-medium">{s.name}</td>
                          <td className="py-2 text-center">{s.count}</td>
                          <td className={cn("py-2 text-center font-semibold", sevColor(s.avgSeverity))}>
                            {s.avgSeverity.toFixed(1)}
                          </td>
                          <td className="py-2 text-center">
                            {s.trend === 'up' ? <TrendingUp className="w-4 h-4 text-red-500 mx-auto" /> :
                             s.trend === 'down' ? <TrendingDown className="w-4 h-4 text-emerald-500 mx-auto" /> :
                             <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 w-32"><SeverityBar value={s.avgSeverity} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          {/* MEDICATIONS TAB */}
          <TabsContent value="medications" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard>
                <SectionHeader icon={Pill} title="Current Medications" 
                  badge={<Badge variant="outline" className="text-[10px]">{a.medicationAdherence.length} active</Badge>} />
                {a.medicationAdherence.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No medication data logged</p>
                ) : (
                  <div className="space-y-3">
                    {a.medicationAdherence.map(med => (
                      <div key={med.name} className="p-3 rounded-xl bg-muted/20 border border-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{med.name}</span>
                          <Badge variant="outline" className="text-[10px]">{med.frequency}</Badge>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                          <span>{med.dosesTaken} doses logged</span>
                          <span>Last: {formatDistanceToNow(parseISO(med.lastTaken), { addSuffix: true })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard>
                <SectionHeader icon={Sparkles} title="Medication-Flare Correlation" />
                {a.medicationEffectiveness.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Insufficient data for analysis</p>
                ) : (
                  <div className="space-y-3">
                    {a.medicationEffectiveness.map(med => {
                      const flareRate = med.totalDoses > 0 ? (med.flaresWithin24h / med.totalDoses * 100) : 0;
                      return (
                        <div key={med.name} className="p-3 rounded-xl bg-muted/20 border border-muted/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{med.name}</span>
                            <span className={cn("text-xs font-bold",
                              flareRate > 50 ? "text-red-600" : flareRate > 25 ? "text-amber-600" : "text-emerald-600"
                            )}>
                              {flareRate.toFixed(0)}% flare rate
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {med.flaresWithin24h} flares within 24h of {med.totalDoses} doses
                          </p>
                          <div className="h-1.5 bg-muted/30 rounded-full mt-2 overflow-hidden">
                            <div className={cn("h-full rounded-full",
                              flareRate > 50 ? "bg-red-500" : flareRate > 25 ? "bg-amber-500" : "bg-emerald-500"
                            )} style={{ width: `${Math.max(5, flareRate)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/40">
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 flex items-start gap-1.5">
                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        Flare rate shows % of doses followed by a flare within 24 hours. Lower is better. 
                        This is correlational, not causal.
                      </p>
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          </TabsContent>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline" className="mt-6 space-y-4">
            <GlassCard>
              <SectionHeader icon={Clock} title="Clinical Event Timeline" 
                badge={<Badge variant="outline" className="text-[10px]">Most recent 20 events</Badge>} />
              {recentFlares.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No flare events recorded</p>
              ) : (
                <div className="space-y-1">
                  {recentFlares.map((entry, i) => (
                    <div key={entry.id} className="flex gap-4 relative">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center w-6 shrink-0">
                        <div className={cn("w-3 h-3 rounded-full border-2 z-10",
                          entry.severity === 'severe' ? "bg-red-500 border-red-300" :
                          entry.severity === 'moderate' ? "bg-amber-500 border-amber-300" :
                          "bg-emerald-500 border-emerald-300"
                        )} />
                        {i < recentFlares.length - 1 && <div className="w-px flex-1 bg-muted/40 mt-1" />}
                      </div>
                      
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-[10px]",
                              entry.severity === 'severe' ? "bg-red-50 text-red-600 border-red-200" :
                              entry.severity === 'moderate' ? "bg-amber-50 text-amber-600 border-amber-200" :
                              "bg-emerald-50 text-emerald-600 border-emerald-200"
                            )}>
                              {entry.severity || 'mild'}
                            </Badge>
                            {entry.city && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{entry.city}</span>}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {format(parseISO(entry.timestamp), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        
                        {entry.symptoms && entry.symptoms.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {entry.symptoms.map(s => (
                              <Badge key={s} variant="secondary" className="text-[10px] py-0">{s}</Badge>
                            ))}
                          </div>
                        )}
                        {entry.triggers && entry.triggers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.triggers.map(t => (
                              <Badge key={t} variant="outline" className="text-[10px] py-0 border-amber-300/50">{t}</Badge>
                            ))}
                          </div>
                        )}
                        {entry.note && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{entry.note}"</p>
                        )}
                        {entry.duration_minutes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Duration: {entry.duration_minutes} min</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* VITALS TAB */}
          <TabsContent value="vitals" className="mt-6 space-y-6">
            {latestPhysio ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {latestPhysio.heartRate && <MetricCard label="Heart Rate" value={latestPhysio.heartRate} unit="bpm" icon={Heart} />}
                {latestPhysio.heartRateVariability && <MetricCard label="HRV" value={latestPhysio.heartRateVariability} unit="ms" icon={Activity} />}
                {latestPhysio.spo2 && <MetricCard label="SpO2" value={latestPhysio.spo2} unit="%" icon={Droplets} />}
                {latestPhysio.skinTemperature && <MetricCard label="Skin Temp" value={`+${latestPhysio.skinTemperature}`} unit="°C" icon={Thermometer} />}
                {latestPhysio.sleepHours && <MetricCard label="Sleep" value={latestPhysio.sleepHours} unit="hrs" icon={Moon} />}
                {latestPhysio.steps && <MetricCard label="Steps" value={latestPhysio.steps.toLocaleString()} icon={Zap} />}
              </div>
            ) : (
              <GlassCard>
                <div className="text-center py-8">
                  <Heart className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No wearable data available</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Patient has not connected a wearable device</p>
                </div>
              </GlassCard>
            )}

            {latestEnv && (
              <GlassCard>
                <SectionHeader icon={Thermometer} title="Last Environmental Context" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {latestEnv.temperature && <MetricCard label="Temperature" value={Math.round(latestEnv.temperature)} unit="°F" icon={Thermometer} />}
                  {latestEnv.humidity && <MetricCard label="Humidity" value={latestEnv.humidity} unit="%" icon={Droplets} />}
                  {latestEnv.pressure && <MetricCard label="Pressure" value={latestEnv.pressure} unit="hPa" icon={Gauge} />}
                  {latestEnv.aqi && <MetricCard label="AQI" value={latestEnv.aqi} icon={Wind} 
                    status={latestEnv.aqi > 100 ? 'warning' : 'normal'} />}
                </div>
              </GlassCard>
            )}

            {/* Nutrition Summary */}
            {foodLogs.length > 0 && (
              <GlassCard>
                <SectionHeader icon={Utensils} title="Recent Nutrition" 
                  badge={<Badge variant="outline" className="text-[10px]">{foodLogs.length} entries</Badge>} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Food</th>
                        <th className="pb-2 font-medium">Meal</th>
                        <th className="pb-2 font-medium text-center">Cal</th>
                        <th className="pb-2 font-medium text-center">P/C/F</th>
                        <th className="pb-2 font-medium">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foodLogs.slice(0, 10).map(f => (
                        <tr key={f.id} className="border-b border-muted/20">
                          <td className="py-2 font-medium">{f.food_name}</td>
                          <td className="py-2 capitalize text-muted-foreground">{f.meal_type || '—'}</td>
                          <td className="py-2 text-center">{f.calories ? Math.round(f.calories) : '—'}</td>
                          <td className="py-2 text-center text-xs text-muted-foreground">
                            {f.protein_g ? `${Math.round(f.protein_g)}` : '—'}/
                            {f.total_carbs_g ? `${Math.round(f.total_carbs_g)}` : '—'}/
                            {f.total_fat_g ? `${Math.round(f.total_fat_g)}` : '—'}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {formatDistanceToNow(parseISO(f.logged_at), { addSuffix: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer Disclaimer */}
        <div className="text-center py-6 text-xs text-muted-foreground/60 print:hidden">
          <p>Clinical data provided by Jvala Health • Patient-reported outcomes • Not a substitute for clinical examination</p>
          <p className="mt-1">Access expires {accessInfo?.expires_at ? format(parseISO(accessInfo.expires_at), 'MMMM d, yyyy') : 'N/A'} • HIPAA-compliant viewer</p>
        </div>
      </div>
    </div>
  );
};

export default ClinicianDashboard;
