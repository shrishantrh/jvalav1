import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CONDITIONS, ALL_SYMPTOMS, ALL_TRIGGERS, CONDITION_CATEGORIES, Condition } from "@/data/conditions";
import { 
  ChevronRight, 
  ChevronLeft, 
  Search,
  Heart,
  Activity,
  Zap,
  User,
  Stethoscope,
  Check,
  Bell,
  Sparkles
} from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface OnboardingData {
  dateOfBirth: string;
  gender: string;
  biologicalSex: string;
  heightCm: string;
  weightKg: string;
  bloodType: string;
  timezone: string;
  conditions: string[];
  symptoms: string[];
  triggers: string[];
  physicianName: string;
  physicianEmail: string;
  physicianPhone: string;
  physicianPractice: string;
  enableReminders: boolean;
  reminderTime: string;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];
const BIOLOGICAL_SEXES = ['Male', 'Female', 'Intersex', 'Prefer not to say'];

const BENEFITS = [
  { icon: Activity, title: "Track Patterns", desc: "AI finds your triggers" },
  { icon: Sparkles, title: "Get Insights", desc: "Personalized predictions" },
  { icon: Bell, title: "Stay Consistent", desc: "Gentle daily reminders" },
];

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<OnboardingData>({
    dateOfBirth: "",
    gender: "",
    biologicalSex: "",
    heightCm: "",
    weightKg: "",
    bloodType: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    conditions: [],
    symptoms: [],
    triggers: [],
    physicianName: "",
    physicianEmail: "",
    physicianPhone: "",
    physicianPractice: "",
    enableReminders: true,
    reminderTime: "09:00",
  });

  const steps = [
    { title: "Welcome", icon: Heart },
    { title: "About You", icon: User },
    { title: "Conditions", icon: Activity },
    { title: "Symptoms", icon: Zap },
    { title: "Triggers", icon: Zap },
    { title: "Reminders", icon: Bell },
    { title: "Ready", icon: Check },
  ];

  const progress = ((step + 1) / steps.length) * 100;

  const handleNext = () => {
    haptics.selection();
    setStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    haptics.selection();
    setStep(prev => Math.max(prev - 1, 0));
  };

  const handleComplete = () => {
    haptics.success();
    onComplete(data);
  };

  const getRelevantSymptoms = () => {
    if (data.conditions.length === 0) return ALL_SYMPTOMS;
    const conditionData = CONDITIONS.filter(c => data.conditions.includes(c.id));
    const relevantSymptoms = new Set(conditionData.flatMap(c => c.commonSymptoms));
    const otherSymptoms = ALL_SYMPTOMS.filter(s => !relevantSymptoms.has(s));
    return [...relevantSymptoms, ...otherSymptoms];
  };

  const getRelevantTriggers = () => {
    if (data.conditions.length === 0) return ALL_TRIGGERS;
    const conditionData = CONDITIONS.filter(c => data.conditions.includes(c.id));
    const relevantTriggers = new Set(conditionData.flatMap(c => c.commonTriggers));
    const otherTriggers = ALL_TRIGGERS.filter(t => !relevantTriggers.has(t));
    return [...relevantTriggers, ...otherTriggers];
  };

  const toggleCondition = (conditionId: string) => {
    haptics.selection();
    setData(prev => ({
      ...prev,
      conditions: prev.conditions.includes(conditionId)
        ? prev.conditions.filter(c => c !== conditionId)
        : [...prev.conditions, conditionId]
    }));
  };

  const toggleSymptom = (symptom: string) => {
    haptics.selection();
    setData(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom]
    }));
  };

  const toggleTrigger = (trigger: string) => {
    haptics.selection();
    setData(prev => ({
      ...prev,
      triggers: prev.triggers.includes(trigger)
        ? prev.triggers.filter(t => t !== trigger)
        : [...prev.triggers, trigger]
    }));
  };

  const filteredConditions = searchQuery
    ? CONDITIONS.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.icd10?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : CONDITIONS;

  const groupedConditions = CONDITION_CATEGORIES.reduce((acc, category) => {
    acc[category] = filteredConditions.filter(c => c.category === category);
    return acc;
  }, {} as Record<string, Condition[]>);

  const renderStep = () => {
    switch (step) {
      case 0: // Welcome - Enhanced
        return (
          <div className="text-center space-y-6 py-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="relative w-28 h-28 mx-auto">
              <div className="absolute inset-0 bg-gradient-primary rounded-3xl rotate-6 opacity-20" />
              <div className="absolute inset-0 bg-gradient-primary rounded-3xl -rotate-3 opacity-40" />
              <div className="relative bg-white rounded-3xl p-4 shadow-lg">
                <img src={jvalaLogo} alt="Jvala" className="w-full h-full" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gradient-primary">Welcome to Jvala</h1>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Your AI-powered health companion for tracking and understanding your flares
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {BENEFITS.map((benefit, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "p-3 rounded-xl bg-muted/50 space-y-2 animate-in fade-in-0",
                    "hover:bg-muted/70 transition-colors"
                  )}
                  style={{ animationDelay: `${200 + idx * 100}ms` }}
                >
                  <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-primary flex items-center justify-center">
                    <benefit.icon className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <p className="text-[10px] font-medium">{benefit.title}</p>
                  <p className="text-[9px] text-muted-foreground">{benefit.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Takes about 2 minutes to set up
            </p>
          </div>
        );

      case 1: // Demographics - Simplified
        return (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Quick Profile</h2>
              <p className="text-xs text-muted-foreground">All fields are optional</p>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date of Birth</Label>
                  <Input
                    type="date"
                    value={data.dateOfBirth}
                    onChange={(e) => setData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Gender</Label>
                  <Select value={data.gender} onValueChange={(v) => setData(prev => ({ ...prev, gender: v }))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Height (cm)</Label>
                  <Input
                    type="number"
                    placeholder="170"
                    value={data.heightCm}
                    onChange={(e) => setData(prev => ({ ...prev, heightCm: e.target.value }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Weight (kg)</Label>
                  <Input
                    type="number"
                    placeholder="70"
                    value={data.weightKg}
                    onChange={(e) => setData(prev => ({ ...prev, weightKg: e.target.value }))}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Blood Type</Label>
                <Select value={data.bloodType} onValueChange={(v) => setData(prev => ({ ...prev, bloodType: v }))}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select blood type" /></SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 2: // Conditions
        return (
          <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Your Conditions</h2>
              <p className="text-xs text-muted-foreground">Select all that apply</p>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conditions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1">
              {Object.entries(groupedConditions).map(([category, conditions]) => (
                conditions.length > 0 && (
                  <div key={category} className="space-y-1.5">
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">{category}</h3>
                    <div className="grid grid-cols-1 gap-1.5">
                      {conditions.map((condition) => (
                        <button
                          key={condition.id}
                          onClick={() => toggleCondition(condition.id)}
                          className={cn(
                            "w-full h-auto py-2.5 px-3 rounded-xl border text-left transition-all press-effect",
                            "flex items-center justify-between",
                            data.conditions.includes(condition.id)
                              ? 'bg-primary/10 border-primary'
                              : 'bg-card hover:bg-muted/50'
                          )}
                        >
                          <span className="text-xs">{condition.name}</span>
                          {data.conditions.includes(condition.id) && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>

            {data.conditions.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t">
                {data.conditions.map(id => {
                  const condition = CONDITIONS.find(c => c.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="text-[10px]">
                      {condition?.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 3: // Symptoms - Chips
        const symptoms = getRelevantSymptoms();
        const selectedConditions = CONDITIONS.filter(c => data.conditions.includes(c.id));
        const recommendedSymptoms = new Set(selectedConditions.flatMap(c => c.commonSymptoms));
        
        return (
          <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Common Symptoms</h2>
              <p className="text-xs text-muted-foreground">What do you usually experience?</p>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1">
              {recommendedSymptoms.size > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-medium text-primary uppercase tracking-wide">Recommended</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {[...recommendedSymptoms].map((symptom) => (
                      <button
                        key={symptom}
                        onClick={() => toggleSymptom(symptom)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs transition-all press-effect border",
                          data.symptoms.includes(symptom)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-primary/30 hover:border-primary'
                        )}
                      >
                        {symptom}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">All</h3>
                <div className="flex flex-wrap gap-1.5">
                  {symptoms.filter(s => !recommendedSymptoms.has(s)).map((symptom) => (
                    <button
                      key={symptom}
                      onClick={() => toggleSymptom(symptom)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs transition-all press-effect border",
                        data.symptoms.includes(symptom)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:border-primary/50'
                      )}
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {data.symptoms.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {data.symptoms.length} selected
              </p>
            )}
          </div>
        );

      case 4: // Triggers
        const triggers = getRelevantTriggers();
        const recommendedTriggers = new Set(
          CONDITIONS.filter(c => data.conditions.includes(c.id)).flatMap(c => c.commonTriggers)
        );
        
        return (
          <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Known Triggers</h2>
              <p className="text-xs text-muted-foreground">What sets off your symptoms?</p>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1">
              {recommendedTriggers.size > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-medium text-primary uppercase tracking-wide">Common for you</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {[...recommendedTriggers].map((trigger) => (
                      <button
                        key={trigger}
                        onClick={() => toggleTrigger(trigger)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs transition-all press-effect border",
                          data.triggers.includes(trigger)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-primary/30 hover:border-primary'
                        )}
                      >
                        {trigger}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">All</h3>
                <div className="flex flex-wrap gap-1.5">
                  {triggers.filter(t => !recommendedTriggers.has(t)).map((trigger) => (
                    <button
                      key={trigger}
                      onClick={() => toggleTrigger(trigger)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs transition-all press-effect border",
                        data.triggers.includes(trigger)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:border-primary/50'
                      )}
                    >
                      {trigger}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {data.triggers.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {data.triggers.length} selected
              </p>
            )}
          </div>
        );

      case 5: // Reminders - NEW
        return (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Daily Reminders</h2>
              <p className="text-xs text-muted-foreground">Build a healthy tracking habit</p>
            </div>

            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Enable Reminders</p>
                    <p className="text-[10px] text-muted-foreground">Get gentle nudges to log</p>
                  </div>
                </div>
                <Switch
                  checked={data.enableReminders}
                  onCheckedChange={(checked) => {
                    haptics.selection();
                    setData(prev => ({ ...prev, enableReminders: checked }));
                  }}
                />
              </div>

              {data.enableReminders && (
                <div className="space-y-3 pt-2 border-t animate-in fade-in-0 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Morning Check-in</Label>
                    <Input
                      type="time"
                      value={data.reminderTime}
                      onChange={(e) => setData(prev => ({ ...prev, reminderTime: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    We'll also send an evening reminder if you haven't logged
                  </p>
                </div>
              )}
            </Card>

            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">
                💡 Users who log daily see <span className="font-medium text-foreground">3x better</span> pattern detection
              </p>
            </div>
          </div>
        );

      case 6: // Ready
        return (
          <div className="text-center space-y-6 py-6 animate-in fade-in-0 zoom-in-95 duration-500">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 bg-severity-none/20 rounded-full animate-ping" />
              <div className="relative w-full h-full rounded-full bg-severity-none/10 flex items-center justify-center">
                <Check className="w-10 h-10 text-severity-none" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">You're All Set!</h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Jvala is personalized for you. Start logging to unlock AI insights.
              </p>
            </div>

            <div className="space-y-2 text-left max-w-xs mx-auto">
              {data.conditions.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-4 h-4 text-severity-none" />
                  <span>{data.conditions.length} condition{data.conditions.length > 1 ? 's' : ''} tracked</span>
                </div>
              )}
              {data.symptoms.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-4 h-4 text-severity-none" />
                  <span>{data.symptoms.length} symptom{data.symptoms.length > 1 ? 's' : ''} monitored</span>
                </div>
              )}
              {data.enableReminders && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-4 h-4 text-severity-none" />
                  <span>Daily reminders at {data.reminderTime}</span>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    if (step === 2 && data.conditions.length === 0) return true; // Optional
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="container max-w-md mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleBack}
                className="h-8 w-8 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="flex-1">
              <Progress value={progress} className="h-1.5" />
            </div>
            <span className="text-[10px] text-muted-foreground w-12 text-right">
              {step + 1}/{steps.length}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 container max-w-md mx-auto px-4 py-4">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t">
        <div className="container max-w-md mx-auto px-4 py-4">
          {step === steps.length - 1 ? (
            <Button 
              onClick={handleComplete}
              className="w-full h-12 text-base shadow-primary"
            >
              Start Tracking
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 text-base shadow-primary"
            >
              {step === 0 ? "Get Started" : "Continue"}
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          )}
          
          {step > 0 && step < steps.length - 1 && (
            <Button 
              variant="ghost" 
              onClick={handleNext}
              className="w-full mt-2 text-xs text-muted-foreground"
            >
              Skip for now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
