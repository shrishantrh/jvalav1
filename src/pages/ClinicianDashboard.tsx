import { useState } from "react";
import { useNavigate } from "react-router-dom";
import jvalaLogo from "@/assets/jvala-logo.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, User, Activity, FileText, Download, Share2,
  TrendingUp, TrendingDown, AlertTriangle, Calendar, Clock,
  Heart, Moon, Thermometer, Pill, BarChart3, LineChart as LineChartIcon,
  Printer, Mail, ChevronRight, Stethoscope, Brain, Shield
} from "lucide-react";
import { 
  generateMockWearableData, 
  generateMockEnvironmentalData, 
  generateMockFlareHistory,
  generateMockEHRData,
  DEMO_PATIENT
} from "@/services/mockWearableData";
import { ClinicalPatientSummary } from "@/components/demo/ClinicalPatientSummary";
import { DemoWearableData } from "@/components/demo/DemoWearableData";
import { DemoEHRIntegration } from "@/components/demo/DemoEHRIntegration";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell
} from "recharts";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

const ClinicianDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Generate demo data
  const wearableData = generateMockWearableData('flare-warning');
  const environmentalData = generateMockEnvironmentalData();
  const flareHistory = generateMockFlareHistory(30);
  const ehrData = generateMockEHRData();
  const patient = DEMO_PATIENT;

  // Generate trend data for charts
  const trendData = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const variant = i < 5 ? 'healthy' : i < 10 ? 'flare-warning' : 'flare-active';
    const data = generateMockWearableData(variant as any);
    return {
      date: format(date, 'MMM d'),
      hrv: data.heartRateVariability + Math.random() * 5 - 2.5,
      restingHR: data.restingHeartRate + Math.random() * 3 - 1.5,
      sleep: data.sleepHours + Math.random() * 0.5 - 0.25,
      steps: data.steps + Math.random() * 500 - 250,
      flare: i === 11 || i === 12 ? 1 : 0,
    };
  });

  const severityData = [
    { name: 'Mild', value: 3, color: '#3b82f6' },
    { name: 'Moderate', value: 4, color: '#f59e0b' },
    { name: 'Severe', value: 2, color: '#ef4444' },
  ];

  const triggerData = [
    { trigger: 'Poor Sleep', count: 6 },
    { trigger: 'Weather', count: 4 },
    { trigger: 'Stress', count: 4 },
    { trigger: 'Missed Meds', count: 2 },
    { trigger: 'Dehydration', count: 1 },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Clinical Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/demo')}
                className="rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-3">
                <img src={jvalaLogo} alt="Jvala" className="w-8 h-8" />
                <div>
                  <h1 className="text-lg font-bold text-foreground">Clinician Portal</h1>
                  <p className="text-xs text-muted-foreground">Patient Health Intelligence</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <Stethoscope className="w-3 h-3 mr-1" />
                Provider View
              </Badge>
              <Button variant="outline" size="sm" className="gap-1">
                <Download className="w-3 h-3" />
                Export Report
              </Button>
              <Button variant="outline" size="sm" className="gap-1">
                <Share2 className="w-3 h-3" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Patient Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/50">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{patient.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {patient.age} y/o {patient.gender} • DOB: {patient.dateOfBirth} • ID: {patient.insuranceId}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {patient.conditions.map((condition, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{condition}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">65</div>
                <p className="text-xs text-muted-foreground">Health Score</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">8</div>
                <p className="text-xs text-muted-foreground">Flares (30d)</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">28</div>
                <p className="text-xs text-muted-foreground">HRV (ms)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="overview" className="gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-1.5">
              <LineChartIcon className="w-3.5 h-3.5" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="ehr" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Medical Records
            </TabsTrigger>
            <TabsTrigger value="wearables" className="gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Wearable Data
            </TabsTrigger>
            <TabsTrigger value="ai-insights" className="gap-1.5">
              <Brain className="w-3.5 h-3.5" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Summary */}
              <div className="lg:col-span-2 space-y-6">
                {/* Risk Alert */}
                <Card className="bg-amber-50/50 border-amber-200 shadow-soft">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-amber-900">Elevated Flare Risk Detected</h3>
                        <p className="text-sm text-amber-800 mt-1">
                          Patient's HRV has dropped 28% below baseline over the past 3 days, combined with reduced sleep quality.
                          Historical patterns suggest 72% probability of flare within 48 hours.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="text-amber-700 border-amber-300">
                            View Analysis
                          </Button>
                          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                            Send Alert to Patient
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* HRV Trend Chart */}
                <Card className="bg-card border border-border/80 shadow-soft">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      HRV & Flare Correlation (14 days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="hrvGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#D6006C" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#D6006C" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} domain={[20, 60]} />
                          <Tooltip 
                            contentStyle={{ 
                              fontSize: 12, 
                              borderRadius: 8,
                              border: '1px solid #e5e7eb'
                            }} 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="hrv" 
                            stroke="#D6006C" 
                            fill="url(#hrvGradient)"
                            strokeWidth={2}
                          />
                          {/* Flare markers */}
                          {trendData.filter(d => d.flare).map((d, i) => (
                            <rect 
                              key={i}
                              x={0} y={0} 
                              width={10} height={10}
                              fill="#ef4444"
                            />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-primary/60" /> HRV (ms)
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-red-500" /> Flare Event
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Trigger Analysis */}
                <Card className="bg-card border border-border/80 shadow-soft">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Identified Triggers (30 days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={triggerData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="trigger" type="category" tick={{ fontSize: 11 }} width={100} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#D6006C" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Quick Stats */}
              <div className="space-y-6">
                {/* Severity Distribution */}
                <Card className="bg-card border border-border/80 shadow-soft">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Flare Severity Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={severityData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
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
                  </CardContent>
                </Card>

                {/* Current Vitals */}
                <Card className="bg-card border border-border/80 shadow-soft">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      Current Vitals
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <span className="text-sm">Resting HR</span>
                      <span className="font-semibold">{wearableData.restingHeartRate} bpm</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50">
                      <span className="text-sm">HRV</span>
                      <span className="font-semibold text-amber-600">{wearableData.heartRateVariability} ms ↓</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <span className="text-sm">SpO2</span>
                      <span className="font-semibold">{wearableData.spo2}%</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <span className="text-sm">Sleep</span>
                      <span className="font-semibold">{wearableData.sleepHours}h ({wearableData.sleepQuality})</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-card border border-border/80 shadow-soft">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full justify-start gap-2 text-sm">
                      <FileText className="w-4 h-4" />
                      Generate Clinical Summary
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2 text-sm">
                      <Mail className="w-4 h-4" />
                      Message Patient
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2 text-sm">
                      <Calendar className="w-4 h-4" />
                      Schedule Follow-up
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2 text-sm">
                      <Printer className="w-4 h-4" />
                      Print Report
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border border-border/80 shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Heart Rate Variability Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="hrv" stroke="#D6006C" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border border-border/80 shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Sleep Duration Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[4, 9]} />
                        <Tooltip />
                        <Area type="monotone" dataKey="sleep" stroke="#8b5cf6" fill="url(#sleepGradient)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border border-border/80 shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Resting Heart Rate Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[55, 90]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="restingHR" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border border-border/80 shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Daily Steps Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="steps" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* EHR Tab */}
          <TabsContent value="ehr" className="mt-6">
            <DemoEHRIntegration />
          </TabsContent>

          {/* Wearables Tab */}
          <TabsContent value="wearables" className="mt-6">
            <DemoWearableData data={wearableData} showTrends={true} />
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="ai-insights" className="mt-6">
            <div className="space-y-6">
              <Card className="bg-gradient-to-r from-primary/5 via-transparent to-transparent border border-border/80 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    AI-Generated Clinical Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <h4 className="font-semibold text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Predictive Alert
                    </h4>
                    <p className="text-sm text-amber-800 mt-2">
                      Based on the patient's physiological patterns over the past 72 hours, our model predicts a 
                      <strong> 72% probability</strong> of a flare event within the next 48 hours. Key indicators:
                    </p>
                    <ul className="text-sm text-amber-800 mt-2 space-y-1">
                      <li>• HRV dropped from 52ms to 28ms (46% decrease)</li>
                      <li>• Sleep quality declined from "good" to "poor"</li>
                      <li>• Skin temperature elevated +0.8°C above baseline</li>
                      <li>• Activity levels reduced by 67%</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Pattern Recognition
                    </h4>
                    <p className="text-sm text-blue-800 mt-2">
                      Analysis of 30-day history reveals strong correlations:
                    </p>
                    <ul className="text-sm text-blue-800 mt-2 space-y-1">
                      <li>• <strong>87% correlation</strong> between sleep &lt;6h and next-day flares</li>
                      <li>• <strong>73% correlation</strong> between HRV drops and flare onset within 48h</li>
                      <li>• <strong>65% correlation</strong> between barometric pressure changes and symptoms</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <h4 className="font-semibold text-emerald-900 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Recommended Interventions
                    </h4>
                    <ul className="text-sm text-emerald-800 mt-2 space-y-1">
                      <li>• Consider adjusting evening Pregabalin timing to improve sleep quality</li>
                      <li>• Recommend stress-reduction activities given current physiological state</li>
                      <li>• Patient may benefit from proactive rescue medication given flare probability</li>
                      <li>• Weather system approaching - advise patient of pressure changes</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ClinicianDashboard;
