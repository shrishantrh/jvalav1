import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, User, Activity, FileText, Download, Share2,
  AlertTriangle, Heart, Moon, Pill, ChevronRight, 
  Search, Bell, Settings, ExternalLink, Plus, 
  Stethoscope, TrendingUp, TrendingDown, Zap
} from "lucide-react";
import { 
  generateMockWearableData, 
  DEMO_PATIENT
} from "@/services/mockWearableData";
import { 
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Frosted glass card component matching reference
const GlassCard = ({ 
  children, 
  className = "", 
  onClick,
  hasArrow = false
}: { 
  children: React.ReactNode; 
  className?: string;
  onClick?: () => void;
  hasArrow?: boolean;
}) => (
  <div 
    onClick={onClick}
    className={cn(
      "relative rounded-3xl p-5 overflow-hidden transition-all duration-300",
      // Frosted glass effect
      "bg-white/70 dark:bg-slate-900/70",
      "backdrop-blur-xl",
      "border border-white/50 dark:border-slate-700/50",
      // Inner highlight
      "before:absolute before:inset-0 before:rounded-3xl",
      "before:bg-gradient-to-br before:from-white/40 before:to-transparent before:pointer-events-none",
      // Subtle shadow
      "shadow-[0_8px_32px_rgba(0,0,0,0.06)]",
      onClick && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
      className
    )}
  >
    <div className="relative z-10">{children}</div>
    {hasArrow && (
      <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
        <ExternalLink className="w-4 h-4" />
      </button>
    )}
  </div>
);

// Icon button matching reference
const IconButton = ({ icon: Icon, className = "" }: { icon: any; className?: string }) => (
  <div className={cn(
    "w-10 h-10 rounded-2xl flex items-center justify-center",
    "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm",
    "border border-white/60 dark:border-slate-700/60",
    "shadow-[0_4px_12px_rgba(0,0,0,0.05)]",
    className
  )}>
    <Icon className="w-5 h-5 text-foreground/70" />
  </div>
);

const ClinicianDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('Overview');
  
  const wearableData = generateMockWearableData('flare-warning');
  const patient = DEMO_PATIENT;

  // Trend data for charts
  const trendData = Array.from({ length: 14 }, (_, i) => ({
    date: format(subDays(new Date(), 13 - i), 'MMM d'),
    value: 30 + Math.sin(i * 0.5) * 15 + Math.random() * 5,
  }));

  const oxygenData = Array.from({ length: 20 }, (_, i) => ({
    x: i,
    value: 95 + Math.sin(i * 0.3) * 3,
  }));

  const tabs = ['Overview', 'Notes', 'Documents', 'Labs', 'Imaging'];

  const handleShare = () => {
    navigator.clipboard.writeText(`https://jvala.health/shared/${Date.now().toString(36)}`);
    toast({ title: "Link Copied", description: "Secure access link copied" });
  };

  // Body systems data matching the reference
  const bodySystems = [
    {
      name: 'Blood Circulatory',
      instances: 2,
      color: 'bg-blue-500',
      conditions: ['Coronary Artery Disease', 'Nodal Tachycardia'],
      markers: 19,
    },
    {
      name: 'Nervous',
      instances: 3,
      color: 'bg-slate-700',
      conditions: ['Vascular Aneurysm', 'Atherosclerosis', 'Transient Amnesia'],
    },
    {
      name: 'Respiratory',
      instances: 2,
      color: 'bg-slate-500',
      conditions: ['Bronchial Asthma'],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="rounded-2xl hover:bg-white/50"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="text-2xl font-bold tracking-tight">Ehr.</span>
          </div>
          
          {/* Search & Tabs */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search" 
                className="pl-10 w-48 rounded-2xl bg-white/60 border-white/50 backdrop-blur-sm"
              />
            </div>
            
            <div className="flex bg-white/60 backdrop-blur-sm rounded-2xl p-1 border border-white/50">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    activeTab === tab 
                      ? "bg-slate-900 text-white" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-2xl">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-2xl">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-12 gap-5">
          
          {/* Left Column - Patient Info */}
          <div className="col-span-3 space-y-5">
            {/* Patient Card */}
            <GlassCard hasArrow>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center overflow-hidden">
                  <User className="w-8 h-8 text-amber-800" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{patient.name}</h3>
                  <p className="text-sm text-muted-foreground">{patient.age} years old</p>
                </div>
              </div>
            </GlassCard>

            {/* Allergies Card */}
            <GlassCard>
              <div className="flex items-start gap-3">
                <IconButton icon={Settings} />
                <div>
                  <h4 className="font-semibold text-base">Allergies</h4>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-muted-foreground">Penicillin, IV contrast</p>
                    <p className="text-sm text-muted-foreground">Dye</p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Care Plan Card */}
            <GlassCard>
              <div className="flex items-start gap-3">
                <IconButton icon={FileText} />
                <div>
                  <h4 className="font-semibold text-base">Care Plan</h4>
                  <p className="text-sm text-muted-foreground mt-1">ED care plan</p>
                </div>
              </div>
            </GlassCard>

            {/* Vital Signs Card - Large */}
            <GlassCard hasArrow className="!p-0 overflow-hidden">
              <div className="p-5 pb-2">
                <div className="flex items-center gap-3">
                  <IconButton icon={Activity} />
                  <div>
                    <h4 className="font-semibold text-base">Vital Signs</h4>
                    <p className="text-sm text-muted-foreground">CA Disease</p>
                  </div>
                </div>
              </div>
              
              {/* Erythrocytes Chart */}
              <div className="px-5 pt-4">
                <div className="flex items-end gap-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Erythrocytes</span>
                    <p className="text-2xl font-bold">8.20</p>
                    <span className="text-xs text-muted-foreground">Bil/l</span>
                  </div>
                </div>
                <div className="h-20 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Oxygen Chart - with hatch pattern effect */}
              <div className="px-5 py-4 border-t border-slate-200/50">
                <span className="text-sm text-muted-foreground">Oxygen</span>
                <div className="flex items-end gap-3">
                  <p className="text-2xl font-bold">90</p>
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="h-16 mt-2 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={oxygenData}>
                      <defs>
                        <pattern id="hatch" patternUnits="userSpaceOnUse" width="4" height="4">
                          <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#94a3b8" strokeWidth="1"/>
                        </pattern>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        fill="url(#hatch)"
                        stroke="#94a3b8"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </GlassCard>

            {/* Records Card */}
            <GlassCard hasArrow>
              <div className="flex items-center gap-3 mb-4">
                <IconButton icon={FileText} />
                <div>
                  <h4 className="font-semibold text-base">Records</h4>
                  <p className="text-sm text-muted-foreground">CA Disease</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-white/50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-lg font-bold">2.01</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Acute CAD</p>
                  <p className="text-xs text-muted-foreground">Hospitalization</p>
                </div>
                <div className="p-3 rounded-2xl bg-white/50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-lg font-bold">14.01</span>
                  </div>
                  <p className="text-xs text-muted-foreground">MRI</p>
                  <p className="text-xs text-muted-foreground">Cardiologist</p>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Center Column - Overview Patient Health */}
          <div className="col-span-5 space-y-5">
            <div className="pt-4">
              <h1 className="text-4xl font-bold tracking-tight">Overview</h1>
              <h2 className="text-4xl font-bold tracking-tight text-muted-foreground">Patient Health</h2>
            </div>

            {/* Main Health Card - Blue gradient like reference */}
            <div className="relative">
              {/* Blue gradient card */}
              <div className="rounded-3xl p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute right-20 bottom-5 w-20 h-20 rounded-full bg-white/10" />
                
                <Badge className="bg-green-400 text-green-900 mb-3 text-xs">
                  2 instances
                </Badge>
                
                <h3 className="text-3xl font-bold mb-1">Blood</h3>
                <h3 className="text-3xl font-bold">Circulatory</h3>
                
                {/* 3D Heart illustration placeholder */}
                <div className="absolute right-4 top-8 w-28 h-28 rounded-2xl bg-gradient-to-br from-pink-300 to-red-400 flex items-center justify-center shadow-2xl rotate-12">
                  <Heart className="w-16 h-16 text-white" />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mt-6">
                  <button className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                  <button className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                    <FileText className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Overlapping dark card */}
              <div className="absolute -right-4 top-6 w-48 rounded-2xl p-4 bg-slate-900 text-white shadow-2xl">
                <Badge className="bg-amber-500/20 text-amber-300 mb-2 text-[10px]">
                  Recession period
                </Badge>
                <h4 className="text-lg font-bold">Coronary Artery</h4>
                <h4 className="text-lg font-bold">Disease</h4>
                <p className="text-sm text-slate-400 mt-1">19 markers</p>
                <button className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body Systems List */}
            <div className="space-y-4 mt-16">
              {/* Nervous System */}
              <GlassCard className="!bg-white/50">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mb-2 text-xs">3 instances</Badge>
                    <h4 className="text-xl font-bold">Nervous</h4>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">Vascular Aneurysm</p>
                    <p className="text-sm text-muted-foreground">Atherosclerosis</p>
                    <p className="text-sm text-muted-foreground">Transient Amnesia</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md hover:scale-105 transition-transform">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>

              {/* Respiratory System */}
              <GlassCard className="!bg-white/50">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mb-2 text-xs">2 instances</Badge>
                    <h4 className="text-xl font-bold">Respiratory</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Bronchial Asthma</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Right Column - Network Graph / Connections */}
          <div className="col-span-4 relative">
            {/* Decorative connection lines and nodes */}
            <div className="absolute inset-0 overflow-hidden">
              {/* SVG connection lines */}
              <svg className="w-full h-full" viewBox="0 0 400 600" fill="none">
                {/* Main branching lines */}
                <path 
                  d="M 0 150 Q 100 150 150 120 T 250 80" 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                  fill="none"
                  opacity="0.4"
                />
                <path 
                  d="M 0 200 Q 80 200 120 180 T 200 150" 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                  fill="none"
                  opacity="0.3"
                />
                <path 
                  d="M 0 280 Q 100 280 180 240 T 300 200" 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                  fill="none"
                  opacity="0.4"
                />
                <path 
                  d="M 0 350 Q 120 350 200 320 T 350 280" 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                  fill="none"
                  opacity="0.3"
                />
              </svg>

              {/* Blue node circles */}
              <div className="absolute right-8 top-16 flex gap-2">
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="absolute right-4 top-40 flex gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-500/80 flex items-center justify-center shadow-lg">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/80 flex items-center justify-center shadow-lg">
                  <FileText className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="absolute right-12 top-64 flex gap-2">
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center shadow-lg">
                  <Activity className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="absolute right-6 top-96 flex gap-2">
                <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="w-11 h-11 rounded-full bg-blue-500/70 flex items-center justify-center shadow-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>

              {/* Decorative dots pattern */}
              <div className="absolute right-40 top-80 grid grid-cols-4 gap-3 opacity-20">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-slate-400" />
                ))}
              </div>
            </div>

            {/* "Nodal Tachycardia" floating label */}
            <div className="absolute right-20 top-48 px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full shadow-lg">
              <span className="text-sm font-medium">Nodal Tachycardia</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicianDashboard;
