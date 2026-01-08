import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { CONDITIONS, CONDITION_CATEGORIES, Condition } from "@/data/conditions";
import { 
  ChevronRight, 
  Search,
  Heart,
  Activity,
  Bell,
  Check,
  Sparkles,
  Zap,
  Watch,
  Brain
} from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface SmartOnboardingData {
  conditions: string[];
  enableReminders: boolean;
  reminderTime: string;
  connectWearables: boolean;
}

interface SmartOnboardingProps {
  onComplete: (data: SmartOnboardingData) => void;
}

const AI_BENEFITS = [
  { icon: Brain, title: "Auto-Learn", desc: "AI discovers YOUR patterns" },
  { icon: Zap, title: "Predict", desc: "Know flares before they hit" },
  { icon: Watch, title: "No Logging", desc: "We pull data for you" },
];

export const SmartOnboarding = ({ onComplete }: SmartOnboardingProps) => {
  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<SmartOnboardingData>({
    conditions: [],
    enableReminders: true,
    reminderTime: "09:00",
    connectWearables: true,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const steps = [
    { title: "Welcome", icon: Heart },
    { title: "Condition", icon: Activity },
    { title: "Setup", icon: Bell },
  ];

  const progress = ((step + 1) / steps.length) * 100;

  const handleNext = () => {
    haptics.selection();
    if (step === steps.length - 1) {
      handleComplete();
    } else {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    haptics.selection();
    setStep(prev => Math.max(prev - 1, 0));
  };

  const handleComplete = async () => {
    setIsAnalyzing(true);
    haptics.success();
    
    // Brief animation for "AI setup"
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    onComplete(data);
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

  const filteredConditions = searchQuery
    ? CONDITIONS.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : CONDITIONS;

  const groupedConditions = CONDITION_CATEGORIES.reduce((acc, category) => {
    acc[category] = filteredConditions.filter(c => c.category === category);
    return acc;
  }, {} as Record<string, Condition[]>);

  // Analyzing screen
  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-6 animate-in fade-in-0 zoom-in-95 duration-500">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 bg-gradient-primary rounded-3xl animate-pulse" />
            <div className="absolute inset-2 bg-background rounded-2xl flex items-center justify-center">
              <Brain className="w-10 h-10 text-primary animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Setting up your AI...</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Learning patterns for {data.conditions.map(id => 
                CONDITIONS.find(c => c.id === id)?.name
              ).join(", ")}
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 0: // Welcome - Super streamlined
        return (
          <div className="text-center space-y-8 py-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 bg-gradient-primary rounded-3xl rotate-6 opacity-20" />
              <div className="absolute inset-0 bg-gradient-primary rounded-3xl -rotate-3 opacity-40" />
              <div className="relative bg-white rounded-3xl p-5 shadow-lg">
                <img src={jvalaLogo} alt="Jvala" className="w-full h-full" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-gradient-primary">Know Tomorrow Today</h1>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                Jvala predicts your flares before they happen using AI that learns YOUR unique patterns.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {AI_BENEFITS.map((benefit, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "p-4 rounded-xl bg-muted/50 space-y-3 animate-in fade-in-0",
                    "hover:bg-muted/70 transition-colors"
                  )}
                  style={{ animationDelay: `${200 + idx * 100}ms` }}
                >
                  <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-primary flex items-center justify-center">
                    <benefit.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <p className="text-xs font-medium">{benefit.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{benefit.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground pt-4">
              Setup takes 30 seconds. AI learns the rest.
            </p>
          </div>
        );

      case 1: // Conditions - The ONLY required step
        return (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">What are you managing?</h2>
              <p className="text-xs text-muted-foreground">
                Select one or more. Our AI will learn YOUR specific patterns.
              </p>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conditions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-12"
              />
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-4 pr-1">
              {Object.entries(groupedConditions).map(([category, conditions]) => (
                conditions.length > 0 && (
                  <div key={category} className="space-y-2">
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">{category}</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {conditions.map((condition) => (
                        <button
                          key={condition.id}
                          onClick={() => toggleCondition(condition.id)}
                          className={cn(
                            "w-full py-3 px-4 rounded-xl border text-left transition-all press-effect",
                            "flex items-center justify-between",
                            data.conditions.includes(condition.id)
                              ? 'bg-primary/10 border-primary shadow-primary'
                              : 'bg-card hover:bg-muted/50'
                          )}
                        >
                          <span className="text-sm font-medium">{condition.name}</span>
                          {data.conditions.includes(condition.id) && (
                            <Check className="w-5 h-5 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>

            {data.conditions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {data.conditions.map(id => {
                  const condition = CONDITIONS.find(c => c.id === id);
                  return (
                    <Badge key={id} variant="default" className="text-xs">
                      {condition?.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 2: // Quick Setup - Wearables + Reminders combined
        return (
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Quick Setup</h2>
              <p className="text-xs text-muted-foreground">
                Let our AI do the heavy lifting
              </p>
            </div>

            {/* Wearables Card */}
            <Card className="p-4 space-y-3 bg-gradient-card border-0 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-primary">
                    <Watch className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Auto-Capture Data</p>
                    <p className="text-[10px] text-muted-foreground">Sleep, heart rate, activity - no logging needed</p>
                  </div>
                </div>
                <Switch
                  checked={data.connectWearables}
                  onCheckedChange={(checked) => {
                    haptics.selection();
                    setData(prev => ({ ...prev, connectWearables: checked }));
                  }}
                />
              </div>
              
              {data.connectWearables && (
                <div className="flex flex-wrap gap-2 pt-2 border-t animate-in fade-in-0 duration-200">
                  <Badge variant="secondary" className="text-[10px]">Apple Health</Badge>
                  <Badge variant="secondary" className="text-[10px]">Fitbit</Badge>
                  <Badge variant="secondary" className="text-[10px]">Google Fit</Badge>
                  <Badge variant="secondary" className="text-[10px]">Oura</Badge>
                </div>
              )}
            </Card>

            {/* Reminders Card */}
            <Card className="p-4 space-y-3 bg-gradient-card border-0 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-muted">
                    <Bell className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Daily Check-ins</p>
                    <p className="text-[10px] text-muted-foreground">Quick daily log builds better predictions</p>
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
                <div className="pt-2 border-t animate-in fade-in-0 duration-200">
                  <Input
                    type="time"
                    value={data.reminderTime}
                    onChange={(e) => setData(prev => ({ ...prev, reminderTime: e.target.value }))}
                    className="h-10"
                  />
                </div>
              )}
            </Card>

            {/* AI Info */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">AI Will Auto-Learn</p>
                  <ul className="text-[11px] text-muted-foreground space-y-0.5">
                    <li>• Your symptoms & triggers (from logs)</li>
                    <li>• Sleep + flare correlations</li>
                    <li>• Weather sensitivity patterns</li>
                    <li>• Time-of-day vulnerabilities</li>
                    <li>• Stress → symptom delays</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    if (step === 1 && data.conditions.length === 0) return false;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Progress bar */}
      {step > 0 && (
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
          <div className="container max-w-md mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleBack}
                className="h-8 w-8 rounded-full"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </Button>
              <div className="flex-1">
                <Progress value={progress} className="h-1.5" />
              </div>
              <span className="text-[10px] text-muted-foreground w-12 text-right">
                {step + 1}/{steps.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 container max-w-md mx-auto px-4 py-4">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t">
        <div className="container max-w-md mx-auto px-4 py-4">
          <Button 
            onClick={handleNext}
            disabled={!canProceed()}
            className="w-full h-12 text-base shadow-primary"
          >
            {step === 0 ? "Get Started" : step === steps.length - 1 ? "Launch Jvala" : "Continue"}
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};
