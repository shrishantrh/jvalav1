import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, User, Activity, FileText, Download, Share2,
  AlertTriangle, Heart, Moon, Pill, ChevronRight, 
  Search, Bell, Settings, TrendingUp, TrendingDown, 
  Thermometer, Droplets, Wind, Zap, Clock, Calendar,
  ShieldAlert, Stethoscope, TestTube, Syringe, Brain,
  Dna, Eye, Ear, Bone, Flame, Gauge, Scale, Ruler,
  Microscope, Beaker, FlaskConical, Radiation, Waves,
  Timer, Target, BarChart3, PieChart, CircleDot, Fingerprint
} from "lucide-react";
import { 
  generateMockWearableData, 
  generateMockEHRData,
  DEMO_PATIENT
} from "@/services/mockWearableData";
import { 
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  PieChart as RechartsPie, Pie, Cell
} from "recharts";
import { format, subDays, subHours } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Frosted glass card component
const GlassCard = ({ 
  children, 
  className = "", 
  onClick,
  gradient,
  size = 'default'
}: { 
  children: React.ReactNode; 
  className?: string;
  onClick?: () => void;
  gradient?: string;
  size?: 'default' | 'compact';
}) => (
  <div 
    onClick={onClick}
    className={cn(
      "relative rounded-3xl overflow-hidden transition-all duration-300",
      size === 'compact' ? 'p-4' : 'p-5',
      "bg-white/70 dark:bg-slate-900/70",
      "backdrop-blur-xl",
      "border border-white/50 dark:border-slate-700/50",
      "before:absolute before:inset-0 before:rounded-3xl",
      "before:bg-gradient-to-br before:from-white/30 before:to-transparent before:pointer-events-none",
      "shadow-[0_8px_32px_rgba(0,0,0,0.06)]",
      onClick && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
      gradient,
      className
    )}
  >
    <div className="relative z-10">{children}</div>
  </div>
);

// Stat card for vitals
const StatCard = ({ 
  label, 
  value, 
  unit, 
  icon: Icon, 
  status,
  trend,
  compact = false
}: { 
  label: string; 
  value: string | number; 
  unit?: string;
  icon: any;
  status?: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  compact?: boolean;
}) => (
  <div className={cn(
    "relative rounded-2xl overflow-hidden",
    compact ? "p-3" : "p-4",
    "bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm",
    "border border-white/40 dark:border-slate-700/40",
    status === 'critical' && "border-red-500/30 bg-red-50/50 dark:bg-red-950/20",
    status === 'warning' && "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
  )}>
    <div className="flex items-center justify-between mb-1">
      <Icon className={cn(
        compact ? "w-4 h-4" : "w-5 h-5",
        status === 'critical' ? "text-red-500" :
        status === 'warning' ? "text-amber-500" :
        "text-muted-foreground"
      )} />
      {trend && (
        trend === 'up' ? <TrendingUp className="w-3 h-3 text-red-500" /> :
        trend === 'down' ? <TrendingDown className="w-3 h-3 text-emerald-500" /> :
        null
      )}
    </div>
    <p className={cn(compact ? "text-xl" : "text-2xl", "font-bold")}>
      {value}<span className="text-xs text-muted-foreground ml-1">{unit}</span>
    </p>
    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
  </div>
);

// Mini sparkline component
const Sparkline = ({ data, color = "hsl(var(--primary))", height = 40 }: { data: number[]; color?: string; height?: number }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data.map((v, i) => ({ value: v, idx: i }))}>
      <defs>
        <linearGradient id={`spark-${color.replace(/[^a-z]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
          <stop offset="95%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <Area 
        type="monotone" 
        dataKey="value" 
        stroke={color}
        strokeWidth={1.5}
        fill={`url(#spark-${color.replace(/[^a-z]/gi, '')})`}
      />
    </AreaChart>
  </ResponsiveContainer>
);

const ClinicianDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const wearableData = generateMockWearableData('flare-warning');
  const ehrData = generateMockEHRData();
  const patient = DEMO_PATIENT;

  // Generate comprehensive trend data
  const hrvTrend = Array.from({ length: 14 }, (_, i) => ({
    date: format(subDays(new Date(), 13 - i), 'MMM d'),
    value: 35 + Math.sin(i * 0.4) * 12 + Math.random() * 8,
  }));

  const sleepTrend = Array.from({ length: 7 }, (_, i) => ({
    date: format(subDays(new Date(), 6 - i), 'EEE'),
    deep: 1.5 + Math.random() * 1.5,
    light: 2 + Math.random() * 2,
    rem: 0.8 + Math.random() * 1.2,
  }));

  const flareHistory = Array.from({ length: 30 }, (_, i) => ({
    date: format(subDays(new Date(), 29 - i), 'MMM d'),
    count: Math.floor(Math.random() * 3),
    severity: Math.random() * 3,
  }));

  const hourlyHR = Array.from({ length: 24 }, (_, i) => ({
    hour: format(subHours(new Date(), 23 - i), 'ha'),
    hr: 60 + Math.sin(i * 0.3) * 15 + Math.random() * 10,
    hrv: 40 + Math.sin(i * 0.2) * 10 + Math.random() * 8,
  }));

  const bodySystemsData = [
    { name: 'Cardiovascular', score: 78, color: '#ef4444' },
    { name: 'Respiratory', score: 92, color: '#3b82f6' },
    { name: 'Nervous', score: 65, color: '#8b5cf6' },
    { name: 'Immune', score: 54, color: '#f59e0b' },
    { name: 'Musculoskeletal', score: 71, color: '#10b981' },
  ];

  const inflammationMarkers = [
    { name: 'CRP', value: 8.2, normal: '<3.0', unit: 'mg/L', status: 'high' },
    { name: 'ESR', value: 28, normal: '0-20', unit: 'mm/hr', status: 'high' },
    { name: 'IL-6', value: 4.1, normal: '<1.8', unit: 'pg/mL', status: 'high' },
    { name: 'TNF-α', value: 12, normal: '<8.1', unit: 'pg/mL', status: 'high' },
    { name: 'Ferritin', value: 185, normal: '12-150', unit: 'ng/mL', status: 'warning' },
  ];

  const vitaminLevels = [
    { name: 'Vitamin D', value: 22, optimal: '30-100', unit: 'ng/mL', percent: 44, status: 'low' },
    { name: 'B12', value: 450, optimal: '200-900', unit: 'pg/mL', percent: 64, status: 'normal' },
    { name: 'Iron', value: 55, optimal: '60-170', unit: 'μg/dL', percent: 32, status: 'low' },
    { name: 'Folate', value: 12, optimal: '3-17', unit: 'ng/mL', percent: 70, status: 'normal' },
  ];

  const medicationAdherence = [
    { name: 'Adalimumab', adherence: 95, lastTaken: '2h ago', nextDue: '12 days' },
    { name: 'Methotrexate', adherence: 88, lastTaken: '3 days ago', nextDue: '4 days' },
    { name: 'Folic Acid', adherence: 100, lastTaken: 'Today', nextDue: 'Tomorrow' },
    { name: 'Prednisone', adherence: 75, lastTaken: 'Yesterday', nextDue: 'Overdue' },
  ];

  const recentSymptoms = [
    { symptom: 'Joint Pain', frequency: 8, severity: 2.4, trend: 'up' },
    { symptom: 'Fatigue', frequency: 12, severity: 2.1, trend: 'stable' },
    { symptom: 'Morning Stiffness', frequency: 6, severity: 1.8, trend: 'down' },
    { symptom: 'Swelling', frequency: 4, severity: 2.6, trend: 'up' },
  ];

  const handleShare = () => {
    navigator.clipboard.writeText(`https://jvala.health/shared/${Date.now().toString(36)}`);
    toast({ title: "Link Copied", description: "Secure access link copied to clipboard" });
  };

  const handleExport = () => {
    toast({ title: "Export Started", description: "Generating clinical PDF report..." });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Clinical Dashboard</h1>
              <p className="text-xs text-muted-foreground">Provider Portal • Real-time Monitoring</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="rounded-xl gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            <Button size="sm" onClick={handleExport} className="rounded-xl gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Patient Header with Health Score */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <GlassCard className="lg:col-span-3 !p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <User className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{patient.name}</h2>
                  <p className="text-sm text-muted-foreground">{patient.age} years old • {patient.gender} • DOB: 03/15/1989</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {patient.conditions.map(c => (
                      <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                    <Badge variant="outline" className="text-xs">BMI: 24.2</Badge>
                    <Badge variant="outline" className="text-xs">Blood: A+</Badge>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Fingerprint className="w-3 h-3" /> MRN: 847293</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Dx: 2019</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last visit: 2w ago</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right space-y-2">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Flare Risk Elevated
                </Badge>
                <p className="text-xs text-muted-foreground">Sync: 2 hours ago</p>
              </div>
            </div>
          </GlassCard>

          {/* Overall Health Score */}
          <GlassCard gradient="before:bg-gradient-to-br before:from-primary/10 before:to-transparent">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Health Score</p>
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/20" />
                  <circle 
                    cx="48" cy="48" r="40" 
                    stroke="url(#healthGradient)" 
                    strokeWidth="8" 
                    fill="none" 
                    strokeDasharray={`${68 * 2.51} 251`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">68</span>
                </div>
              </div>
              <p className="text-sm font-medium text-amber-600 mt-2">Needs Attention</p>
              <p className="text-xs text-muted-foreground">↓ 12 from last month</p>
            </div>
          </GlassCard>
        </div>

        {/* Critical Alerts Banner */}
        <GlassCard gradient="before:bg-gradient-to-br before:from-red-500/10 before:to-amber-500/5" className="!p-4">
          <div className="flex items-center gap-4 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold text-red-600">3 Active Alerts</span>
            </div>
            <div className="h-6 w-px bg-border shrink-0" />
            <div className="flex gap-3 overflow-x-auto">
              <Badge variant="outline" className="shrink-0 bg-red-50 text-red-600 border-red-200">
                CRP ↑ 174% above normal
              </Badge>
              <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-600 border-amber-200">
                HRV ↓ 23% decline
              </Badge>
              <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-600 border-amber-200">
                Prednisone dose overdue
              </Badge>
            </div>
          </div>
        </GlassCard>

        {/* Main Grid - 4 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Real-time Vitals */}
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Real-Time Vitals</h3>
              </div>
              <Badge variant="outline" className="text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Live
              </Badge>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Heart Rate" value={wearableData.heartRate} unit="bpm" icon={Heart} status="warning" trend="up" compact />
              <StatCard label="HRV" value={wearableData.heartRateVariability} unit="ms" icon={Activity} status="warning" trend="down" compact />
              <StatCard label="SpO2" value={wearableData.spo2} unit="%" icon={Droplets} compact />
              <StatCard label="Skin Temp" value={`+${wearableData.skinTemperature}`} unit="°C" icon={Thermometer} status="warning" compact />
              <StatCard label="Resp Rate" value={18} unit="/min" icon={Wind} compact />
              <StatCard label="BP" value="128/82" unit="mmHg" icon={Gauge} status="warning" compact />
            </div>
          </GlassCard>

          {/* Body Systems Radar */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <Dna className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm">Body Systems</h3>
            </div>
            <div className="space-y-2">
              {bodySystemsData.map((sys) => (
                <div key={sys.name} className="flex items-center gap-2">
                  <span className="text-xs w-24 truncate">{sys.name}</span>
                  <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ width: `${sys.score}%`, backgroundColor: sys.color }}
                    />
                  </div>
                  <span className="text-xs font-bold w-8 text-right">{sys.score}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Sleep Analysis */}
          <GlassCard>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Moon className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">Sleep Quality</h3>
              </div>
              <Badge variant={wearableData.sleepHours < 6 ? "destructive" : "secondary"} className="text-xs">
                {wearableData.sleepHours}h
              </Badge>
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sleepTrend} barCategoryGap="20%">
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                  <Bar dataKey="deep" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="light" stackId="a" fill="#a5b4fc" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="rem" stackId="a" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded bg-indigo-500" />Deep</span>
              <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded bg-indigo-300" />Light</span>
              <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded bg-violet-300" />REM</span>
            </div>
          </GlassCard>
        </div>

        {/* Second Row - Charts & Medical Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 24hr Heart Rate & HRV */}
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold">24-Hour Cardiac Profile</h3>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" />HR</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-violet-500" />HRV</span>
              </div>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyHR}>
                  <defs>
                    <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="hrvGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={3} />
                  <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                  <Area type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} fill="url(#hrGrad)" />
                  <Area type="monotone" dataKey="hrv" stroke="#8b5cf6" strokeWidth={2} fill="url(#hrvGrad2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Inflammation Markers */}
          <GlassCard gradient="before:bg-gradient-to-br before:from-orange-500/10 before:to-transparent">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-sm">Inflammation Panel</h3>
            </div>
            <div className="space-y-2">
              {inflammationMarkers.map((marker) => (
                <div 
                  key={marker.name}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-xl text-xs",
                    marker.status === 'high' ? "bg-red-50/70 dark:bg-red-950/30 border border-red-200/50" :
                    marker.status === 'warning' ? "bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/50" :
                    "bg-white/50 dark:bg-slate-800/50"
                  )}
                >
                  <div>
                    <span className="font-semibold">{marker.name}</span>
                    <span className="text-muted-foreground ml-1">({marker.normal})</span>
                  </div>
                  <span className={cn(
                    "font-bold",
                    marker.status === 'high' && "text-red-600",
                    marker.status === 'warning' && "text-amber-600"
                  )}>
                    {marker.value} {marker.unit}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Third Row - Medical Records & Symptoms */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Diagnoses */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm">Diagnoses</h3>
            </div>
            <div className="space-y-2">
              {ehrData.diagnoses.filter(d => d.status === 'active').map((diagnosis, i) => (
                <div key={i} className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50">
                  <p className="font-medium text-sm">{diagnosis.name}</p>
                  <p className="text-xs text-muted-foreground">ICD-10: {diagnosis.code}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Medications with Adherence */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <Pill className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm">Medications</h3>
            </div>
            <div className="space-y-2">
              {medicationAdherence.map((med, i) => (
                <div key={i} className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{med.name}</span>
                    <span className={cn(
                      "text-xs font-bold",
                      med.adherence >= 90 ? "text-emerald-600" :
                      med.adherence >= 75 ? "text-amber-600" : "text-red-600"
                    )}>{med.adherence}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Last: {med.lastTaken}</span>
                    <span className={med.nextDue === 'Overdue' ? 'text-red-500 font-medium' : ''}>
                      Next: {med.nextDue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Symptom Frequency */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm">Recent Symptoms</h3>
            </div>
            <div className="space-y-2">
              {recentSymptoms.map((sym, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{sym.symptom}</span>
                      <span className="text-xs text-muted-foreground">{sym.frequency}×</span>
                    </div>
                    <div className="h-1.5 bg-muted/30 rounded-full mt-1 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full",
                          sym.severity >= 2.5 ? "bg-red-500" :
                          sym.severity >= 1.5 ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${(sym.severity / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                  {sym.trend === 'up' ? <TrendingUp className="w-3 h-3 text-red-500" /> :
                   sym.trend === 'down' ? <TrendingDown className="w-3 h-3 text-emerald-500" /> :
                   <div className="w-3 h-3" />}
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Vitamin & Nutrient Levels */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm">Nutrient Levels</h3>
            </div>
            <div className="space-y-2">
              {vitaminLevels.map((vit) => (
                <div key={vit.name} className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{vit.name}</span>
                    <span className={cn(
                      "font-bold",
                      vit.status === 'low' && "text-amber-600"
                    )}>{vit.value} {vit.unit}</span>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        vit.status === 'low' ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${vit.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Fourth Row - Lab Results & Allergies */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Comprehensive Lab Results */}
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <TestTube className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Lab Results</h3>
              <Badge variant="outline" className="text-xs ml-auto">Last: 3 days ago</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ehrData.labResults.map((lab, i) => (
                <div 
                  key={i}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl",
                    lab.status === 'high' ? "bg-red-50/50 dark:bg-red-950/20 border border-red-500/20" :
                    lab.status === 'low' ? "bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20" :
                    "bg-white/50 dark:bg-slate-800/50"
                  )}
                >
                  <div>
                    <p className="font-medium text-sm">{lab.name}</p>
                    <p className="text-xs text-muted-foreground">{lab.date}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "font-bold",
                      lab.status === 'high' && "text-red-600",
                      lab.status === 'low' && "text-amber-600"
                    )}>
                      {lab.value} <span className="text-xs font-normal text-muted-foreground">{lab.unit}</span>
                    </p>
                    {lab.status !== 'normal' && (
                      <Badge variant="outline" className={cn("text-[10px]", lab.status === 'high' && "text-red-600", lab.status === 'low' && "text-amber-600")}>
                        {lab.status === 'high' ? '↑ High' : '↓ Low'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Allergies & Sensitivities */}
          <GlassCard gradient="before:bg-gradient-to-br before:from-red-500/10 before:to-transparent">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold">Allergies</h3>
            </div>
            <div className="space-y-2">
              {ehrData.allergies.map((allergy, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-500/20">
                  <div>
                    <p className="font-medium text-sm">{allergy.allergen}</p>
                    <p className="text-xs text-muted-foreground">{allergy.reaction}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs", allergy.severity === 'severe' && "bg-red-500/10 text-red-600 border-red-500/30", allergy.severity === 'moderate' && "bg-amber-500/10 text-amber-600 border-amber-500/30")}>
                    {allergy.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Provider & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Primary Provider</h3>
            </div>
            <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50">
              <p className="font-medium">{patient.primaryPhysician.name}</p>
              <p className="text-xs text-muted-foreground">{patient.primaryPhysician.practice}</p>
              <p className="text-xs text-muted-foreground mt-1">{patient.primaryPhysician.phone}</p>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Upcoming</h3>
            </div>
            <div className="space-y-2">
              <div className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50">
                <p className="text-sm font-medium">Rheumatology Follow-up</p>
                <p className="text-xs text-muted-foreground">Feb 15, 2025 • 2:30 PM</p>
              </div>
              <div className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50">
                <p className="text-sm font-medium">Labs: CBC + CMP</p>
                <p className="text-xs text-muted-foreground">Feb 10, 2025 • Fasting</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard gradient="before:bg-gradient-to-br before:from-primary/10 before:to-transparent">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 rounded-xl">
                <FileText className="w-4 h-4" /> Send to EHR
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 rounded-xl">
                <Syringe className="w-4 h-4" /> Order Labs
              </Button>
              <Button size="sm" className="w-full justify-start gap-2 rounded-xl">
                <AlertTriangle className="w-4 h-4" /> Adjust Treatment
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default ClinicianDashboard;