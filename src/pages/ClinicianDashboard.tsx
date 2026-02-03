import { useState } from "react";
import { useNavigate } from "react-router-dom";
import jvalaLogo from "@/assets/jvala-logo.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, User, Activity, FileText, Download, Share2,
  TrendingUp, TrendingDown, AlertTriangle, Heart, Moon,
  Pill, BarChart3, LineChart as LineChartIcon, Brain,
  Send, Bell, MessageSquare, Stethoscope, Zap, Droplets,
  ThermometerSun, ChevronRight, ExternalLink
} from "lucide-react";
import { 
  generateMockWearableData, 
  generateMockFlareHistory,
  DEMO_PATIENT
} from "@/services/mockWearableData";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from "recharts";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const ClinicianDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  
  const wearableData = generateMockWearableData('flare-warning');
  const patient = DEMO_PATIENT;

  // Trend data
  const trendData = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const variant = i < 5 ? 'healthy' : i < 10 ? 'flare-warning' : 'flare-active';
    const data = generateMockWearableData(variant as any);
    return {
      date: format(date, 'MMM d'),
      hrv: data.heartRateVariability + Math.random() * 5 - 2.5,
      restingHR: data.restingHeartRate + Math.random() * 3 - 1.5,
      sleep: data.sleepHours + Math.random() * 0.5 - 0.25,
    };
  });

  const severityData = [
    { name: 'Mild', value: 3, color: '#3b82f6' },
    { name: 'Moderate', value: 4, color: '#f59e0b' },
    { name: 'Severe', value: 2, color: '#ef4444' },
  ];

  const handleSendMessage = () => {
    toast({ title: "Message Sent", description: `Secure message sent to ${patient.name}` });
    setShowMessageDialog(false);
    setMessageContent('');
  };

  const handleSendAlert = () => {
    toast({ title: "Alert Sent", description: `Proactive flare warning sent to ${patient.name}` });
    setShowAlertDialog(false);
  };

  const handleShareReport = () => {
    navigator.clipboard.writeText(`https://jvala.health/shared-report/${Date.now().toString(36)}`);
    toast({ title: "Share Link Copied", description: "Secure 7-day access link copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Clinician Portal</h1>
                  <p className="text-sm text-muted-foreground">Patient Health Intelligence</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleShareReport}>
                <Share2 className="w-4 h-4" />
                Share
              </Button>
              <Button size="sm" className="gap-2 rounded-xl">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Patient Card */}
      <div className="container max-w-7xl mx-auto px-6 py-6">
        <Card className="p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-3xl mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <User className="w-10 h-10 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{patient.name}</h2>
                <p className="text-base text-muted-foreground">
                  {patient.age} y/o • {patient.gender} • DOB: {patient.dateOfBirth}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {patient.conditions.map((condition, i) => (
                    <Badge key={i} variant="secondary" className="rounded-lg px-3 py-1">{condition}</Badge>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Key Metrics */}
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-600">65</div>
                <p className="text-sm text-muted-foreground">Health Score</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600">8</div>
                <p className="text-sm text-muted-foreground">Flares (30d)</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">28</div>
                <p className="text-sm text-muted-foreground">HRV (ms)</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Risk Alert */}
        <Card className="p-5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20 rounded-2xl mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Elevated Flare Risk Detected</h3>
              <p className="text-base text-amber-800 dark:text-amber-300 mt-1">
                HRV dropped 28% below baseline over 3 days. Historical patterns suggest 72% flare probability within 48 hours.
              </p>
              <div className="flex gap-3 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                  onClick={() => setShowMessageDialog(true)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Message Patient
                </Button>
                <Button 
                  size="sm" 
                  className="rounded-xl bg-amber-600 hover:bg-amber-700"
                  onClick={() => setShowAlertDialog(true)}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Send Alert
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Bento Grid Layout */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 p-1.5 rounded-2xl mb-6">
            <TabsTrigger value="overview" className="gap-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="vitals" className="gap-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <Activity className="w-4 h-4" />
              Vitals
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <LineChartIcon className="w-4 h-4" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <Brain className="w-4 h-4" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Bento Grid */}
          <TabsContent value="overview" className="mt-0">
            <div className="grid grid-cols-12 gap-4">
              {/* HRV Chart - Large */}
              <Card className="col-span-8 p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-3xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">HRV Trend (14 days)</h3>
                      <p className="text-sm text-muted-foreground">Heart Rate Variability</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-red-600 border-red-200">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    -28%
                  </Badge>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="hrvGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[20, 60]} />
                      <Tooltip 
                        contentStyle={{ 
                          fontSize: 14, 
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="hrv" 
                        stroke="#3b82f6" 
                        fill="url(#hrvGradient)"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Severity Distribution - Small */}
              <Card className="col-span-4 p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="text-base font-semibold">Severity Split</h3>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {severityData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Vital Signs Grid */}
              <Card className="col-span-3 p-5 bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-5 h-5 text-red-500" />
                  <span className="text-sm text-muted-foreground">Heart Rate</span>
                </div>
                <p className="text-3xl font-bold">{wearableData.restingHeartRate}</p>
                <p className="text-sm text-muted-foreground">bpm</p>
              </Card>

              <Card className="col-span-3 p-5 bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Moon className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Sleep</span>
                </div>
                <p className="text-3xl font-bold">{wearableData.sleepHours}</p>
                <p className="text-sm text-muted-foreground">hours</p>
              </Card>

              <Card className="col-span-3 p-5 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">Steps</span>
                </div>
                <p className="text-3xl font-bold">{wearableData.steps.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">today</p>
              </Card>

              <Card className="col-span-3 p-5 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Droplets className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-muted-foreground">SpO2</span>
                </div>
                <p className="text-3xl font-bold">{wearableData.spo2}%</p>
                <p className="text-sm text-muted-foreground">oxygen</p>
              </Card>

              {/* Medications */}
              <Card className="col-span-6 p-5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                      <Pill className="w-5 h-5 text-pink-600" />
                    </div>
                    <h3 className="text-base font-semibold">Current Medications</h3>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-lg">
                    View All <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'Methotrexate', dosage: '15mg', frequency: 'Weekly' },
                    { name: 'Hydroxychloroquine', dosage: '200mg', frequency: 'Daily' },
                    { name: 'Folic Acid', dosage: '1mg', frequency: 'Daily' },
                  ].map((med, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-lg">
                          💊
                        </div>
                        <div>
                          <p className="font-medium">{med.name}</p>
                          <p className="text-sm text-muted-foreground">{med.dosage}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{med.frequency}</Badge>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Top Triggers */}
              <Card className="col-span-6 p-5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="text-base font-semibold">Top Triggers (30 days)</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { trigger: 'Poor Sleep', count: 6, pct: 100 },
                    { trigger: 'Weather Changes', count: 4, pct: 67 },
                    { trigger: 'Stress', count: 4, pct: 67 },
                    { trigger: 'Missed Medication', count: 2, pct: 33 },
                  ].map((item, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{item.trigger}</span>
                        <span className="text-muted-foreground">{item.count}x</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Vitals Tab */}
          <TabsContent value="vitals" className="mt-0">
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Heart Rate</h3>
                    <p className="text-sm text-muted-foreground">Current reading</p>
                  </div>
                </div>
                <p className="text-5xl font-bold mb-2">{wearableData.restingHeartRate}</p>
                <p className="text-lg text-muted-foreground">bpm</p>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Resting avg</span>
                    <span className="font-medium">62 bpm</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">HRV</h3>
                    <p className="text-sm text-muted-foreground">Heart Rate Variability</p>
                  </div>
                </div>
                <p className="text-5xl font-bold mb-2">{wearableData.heartRateVariability}</p>
                <p className="text-lg text-muted-foreground">ms</p>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Baseline</span>
                    <span className="font-medium text-red-500">↓ 28%</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Moon className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Sleep</h3>
                    <p className="text-sm text-muted-foreground">Last night</p>
                  </div>
                </div>
                <p className="text-5xl font-bold mb-2">{wearableData.sleepHours}</p>
                <p className="text-lg text-muted-foreground">hours</p>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Quality</span>
                    <span className="font-medium">Poor (68%)</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="mt-0">
            <Card className="p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl">
              <h3 className="text-lg font-semibold mb-6">14-Day Trend Analysis</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        fontSize: 14, 
                        borderRadius: 12,
                        border: '1px solid #e2e8f0'
                      }} 
                    />
                    <Line type="monotone" dataKey="hrv" stroke="#3b82f6" strokeWidth={2} dot={false} name="HRV" />
                    <Line type="monotone" dataKey="restingHR" stroke="#ef4444" strokeWidth={2} dot={false} name="Heart Rate" />
                    <Line type="monotone" dataKey="sleep" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Sleep Hours" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="ai" className="mt-0">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">AI Pattern Analysis</h3>
                    <p className="text-sm text-muted-foreground">Based on 30-day data</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-background/50">
                    <p className="text-sm font-medium mb-1">Primary Finding</p>
                    <p className="text-base">Strong correlation between sleep quality drops and flare onset within 48 hours</p>
                  </div>
                  <div className="p-4 rounded-xl bg-background/50">
                    <p className="text-sm font-medium mb-1">Risk Assessment</p>
                    <p className="text-base">Current HRV trajectory suggests 72% probability of flare within next 48 hours</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <ThermometerSun className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Recommendations</h3>
                    <p className="text-sm text-muted-foreground">Personalized suggestions</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    "Prioritize 8+ hours of sleep tonight",
                    "Consider stress-reduction activities",
                    "Increase hydration by 20%",
                    "Avoid known food triggers for 48h"
                  ].map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-emerald-600">{i + 1}</span>
                      </div>
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Message {patient.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Type your message..."
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            className="min-h-32"
          />
          <Button onClick={handleSendMessage} className="w-full gap-2">
            <Send className="w-4 h-4" />
            Send Message
          </Button>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Send Flare Alert</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            This will send a proactive alert to {patient.name} about their elevated flare risk, along with personalized prevention recommendations.
          </p>
          <Button onClick={handleSendAlert} className="w-full gap-2 bg-amber-600 hover:bg-amber-700">
            <Bell className="w-4 h-4" />
            Send Alert
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClinicianDashboard;