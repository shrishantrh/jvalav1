import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, User, Activity, FileText, Download, Share2,
  AlertTriangle, Heart, Moon, Pill, ChevronRight, 
  Search, Bell, Settings, TrendingUp, TrendingDown, 
  Thermometer, Droplets, Wind, Zap, Clock, Calendar,
  ShieldAlert, Stethoscope, TestTube, Syringe, Brain
} from "lucide-react";
import { 
  generateMockWearableData, 
  generateMockEHRData,
  DEMO_PATIENT
} from "@/services/mockWearableData";
import { 
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Frosted glass card component
const GlassCard = ({ 
  children, 
  className = "", 
  onClick,
  gradient
}: { 
  children: React.ReactNode; 
  className?: string;
  onClick?: () => void;
  gradient?: string;
}) => (
  <div 
    onClick={onClick}
    className={cn(
      "relative rounded-3xl p-5 overflow-hidden transition-all duration-300",
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
  trend 
}: { 
  label: string; 
  value: string | number; 
  unit?: string;
  icon: any;
  status?: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}) => (
  <div className={cn(
    "relative p-4 rounded-2xl overflow-hidden",
    "bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm",
    "border border-white/40 dark:border-slate-700/40",
    status === 'critical' && "border-red-500/30 bg-red-50/50 dark:bg-red-950/20",
    status === 'warning' && "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
  )}>
    <div className="flex items-center justify-between mb-2">
      <Icon className={cn(
        "w-5 h-5",
        status === 'critical' ? "text-red-500" :
        status === 'warning' ? "text-amber-500" :
        "text-muted-foreground"
      )} />
      {trend && (
        trend === 'up' ? <TrendingUp className="w-4 h-4 text-red-500" /> :
        trend === 'down' ? <TrendingDown className="w-4 h-4 text-emerald-500" /> :
        null
      )}
    </div>
    <p className="text-2xl font-bold">{value}<span className="text-sm text-muted-foreground ml-1">{unit}</span></p>
    <p className="text-xs text-muted-foreground mt-1">{label}</p>
  </div>
);

const ClinicianDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const wearableData = generateMockWearableData('flare-warning');
  const ehrData = generateMockEHRData();
  const patient = DEMO_PATIENT;

  // Trend data for HRV chart
  const hrvTrend = Array.from({ length: 14 }, (_, i) => ({
    date: format(subDays(new Date(), 13 - i), 'MMM d'),
    value: 35 + Math.sin(i * 0.4) * 12 + Math.random() * 8,
  }));

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
              <p className="text-xs text-muted-foreground">Provider Portal</p>
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
        {/* Patient Header */}
        <GlassCard className="!p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{patient.name}</h2>
                <p className="text-sm text-muted-foreground">{patient.age} years old • {patient.gender}</p>
                <div className="flex gap-2 mt-2">
                  {patient.conditions.map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Flare Risk Elevated
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">Last sync: 2 hours ago</p>
            </div>
          </div>
        </GlassCard>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Vitals & Wearable Data */}
          <div className="space-y-4">
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Real-Time Vitals</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <StatCard 
                  label="Heart Rate" 
                  value={wearableData.heartRate} 
                  unit="bpm"
                  icon={Heart}
                  status="warning"
                  trend="up"
                />
                <StatCard 
                  label="Resting HR" 
                  value={wearableData.restingHeartRate} 
                  unit="bpm"
                  icon={Heart}
                />
                <StatCard 
                  label="HRV" 
                  value={wearableData.heartRateVariability} 
                  unit="ms"
                  icon={Activity}
                  status="warning"
                  trend="down"
                />
                <StatCard 
                  label="SpO2" 
                  value={wearableData.spo2} 
                  unit="%"
                  icon={Droplets}
                />
                <StatCard 
                  label="Skin Temp" 
                  value={`+${wearableData.skinTemperature}`} 
                  unit="°C"
                  icon={Thermometer}
                  status="warning"
                />
                <StatCard 
                  label="Sleep" 
                  value={wearableData.sleepHours} 
                  unit="hrs"
                  icon={Moon}
                  status={wearableData.sleepHours < 6 ? 'critical' : 'normal'}
                />
              </div>
            </GlassCard>

            {/* HRV Trend Chart */}
            <GlassCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-sm">HRV Trend (14 days)</h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
                  -18%
                </Badge>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hrvTrend}>
                    <defs>
                      <linearGradient id="hrvGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#hrvGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          {/* Center Column - Medical Records */}
          <div className="space-y-4">
            {/* Diagnoses */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Active Diagnoses</h3>
              </div>
              <div className="space-y-2">
                {ehrData.diagnoses.filter(d => d.status === 'active').map((diagnosis, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{diagnosis.name}</p>
                      <p className="text-xs text-muted-foreground">ICD-10: {diagnosis.code}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{diagnosis.date}</Badge>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Medications */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Pill className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Current Medications</h3>
              </div>
              <div className="space-y-2">
                {ehrData.medications.map((med, i) => (
                  <div 
                    key={i}
                    className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{med.name}</p>
                      <Badge variant="outline" className="text-xs">{med.dosage}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{med.frequency} • {med.prescriber}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Allergies */}
            <GlassCard gradient="before:bg-gradient-to-br before:from-red-500/10 before:to-transparent">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold">Allergies</h3>
              </div>
              <div className="space-y-2">
                {ehrData.allergies.map((allergy, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-500/20"
                  >
                    <div>
                      <p className="font-medium text-sm">{allergy.allergen}</p>
                      <p className="text-xs text-muted-foreground">{allergy.reaction}</p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        allergy.severity === 'severe' && "bg-red-500/10 text-red-600 border-red-500/30",
                        allergy.severity === 'moderate' && "bg-amber-500/10 text-amber-600 border-amber-500/30"
                      )}
                    >
                      {allergy.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Right Column - Labs & Activity */}
          <div className="space-y-4">
            {/* Lab Results */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <TestTube className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Recent Lab Results</h3>
              </div>
              <div className="space-y-2">
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
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px]",
                            lab.status === 'high' && "text-red-600",
                            lab.status === 'low' && "text-amber-600"
                          )}
                        >
                          {lab.status === 'high' ? '↑ High' : '↓ Low'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Activity Summary */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Activity Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 text-center">
                  <p className="text-2xl font-bold text-primary">{wearableData.steps.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Steps Today</p>
                </div>
                <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 text-center">
                  <p className="text-2xl font-bold text-primary">{wearableData.activeMinutes}</p>
                  <p className="text-xs text-muted-foreground">Active Min</p>
                </div>
                <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 text-center">
                  <p className="text-2xl font-bold">{wearableData.caloriesBurned.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Calories</p>
                </div>
                <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 text-center">
                  <p className="text-2xl font-bold">{wearableData.floors}</p>
                  <p className="text-xs text-muted-foreground">Floors</p>
                </div>
              </div>
            </GlassCard>

            {/* Risk Alerts */}
            <GlassCard gradient="before:bg-gradient-to-br before:from-amber-500/10 before:to-transparent">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold">Risk Indicators</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-medium">HRV Declining</p>
                    <p className="text-xs text-muted-foreground">18% below baseline - may indicate upcoming flare</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-medium">Sleep Quality Poor</p>
                    <p className="text-xs text-muted-foreground">Only {wearableData.sleepHours}h sleep - below recommended</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-500/20">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-medium">Elevated Skin Temp</p>
                    <p className="text-xs text-muted-foreground">+{wearableData.skinTemperature}°C deviation detected</p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Provider Info */}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicianDashboard;