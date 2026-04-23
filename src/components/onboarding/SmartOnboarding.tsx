import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Brain,
  ChevronLeft
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

  const totalSteps = 3;
  const progress = ((step + 1) / totalSteps) * 100;

  const handleNext = () => {
    haptics.selection();
    if (step === totalSteps - 1) {
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
    await new Promise(resolve => setTimeout(resolve, 1800));
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

  const canProceed = () => {
    if (step === 1 && data.conditions.length === 0) return false;
    return true;
  };

  // ─── Analyzing overlay ─────────────────────────────────────
  if (isAnalyzing) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" 
        style={{ background: 'hsl(var(--background))' }}>
        <div className="text-center space-y-8 animate-in fade-in-0 zoom-in-95 duration-700">
          {/* Pulsing logo */}
          <div className="relative w-28 h-28 mx-auto">
            <div className="absolute inset-0 rounded-[2rem] bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute -inset-3 rounded-[2.5rem] bg-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="relative w-28 h-28 rounded-[2rem] bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg flex items-center justify-center">
              <Brain className="w-12 h-12 text-primary" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight">Personalizing your AI</h2>
            <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
              Learning patterns for {data.conditions.map(id => 
                CONDITIONS.find(c => c.id === id)?.name
              ).filter(Boolean).join(", ")}
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" 
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'hsl(var(--background))' }}>
      {/* Safe area top */}
      <div style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} />

      {/* Progress bar */}
      {step > 0 && (
        <div className="px-6 pt-4 pb-2 flex items-center gap-3">
          <button onClick={handleBack} className="h-9 w-9 rounded-2xl flex items-center justify-center bg-card/60 backdrop-blur-xl border border-border/30 active:scale-90 transition-transform">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{step + 1}/{totalSteps}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {step === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full py-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
            {/* Logo */}
            <div className="relative mb-10">
              <div className="absolute -inset-4 bg-primary/8 rounded-[2.5rem] blur-xl" />
              <div className="relative w-24 h-24 rounded-[1.75rem] overflow-hidden shadow-lg">
                <img src={jvalaLogo} alt="Jvala" className="w-full h-full object-cover" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
              Know Tomorrow Today
            </h1>
            <p className="text-base text-muted-foreground max-w-[300px] text-center leading-relaxed mb-10">
              AI that learns your unique patterns and predicts flares before they happen.
            </p>

            {/* Feature cards — frosted glass */}
            <div className="w-full max-w-sm space-y-3">
              {[
                { icon: Brain, title: "Auto-Learn", desc: "Discovers YOUR patterns from every data point" },
                { icon: Zap, title: "Predict", desc: "24-72h risk forecasting with compound signals" },
                { icon: Watch, title: "Passive Capture", desc: "Wearables + environment — no manual entry" },
              ].map((item, idx) => (
                <div key={idx} className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl transition-all",
                  "bg-card/60 backdrop-blur-xl",
                  "border border-border/30",
                  "animate-in fade-in-0 slide-in-from-bottom-2",
                )} style={{ animationDelay: `${300 + idx * 100}ms` }}>
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-8">
              30 seconds to set up. AI handles the rest.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2 mb-2">
              <h2 className="text-2xl font-bold tracking-tight">What are you tracking?</h2>
              <p className="text-sm text-muted-foreground">Select your conditions. AI will specialize for you.</p>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conditions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-2xl bg-card/60 backdrop-blur-xl border-border/30"
              />
            </div>

            {/* Selected badges */}
            {data.conditions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.conditions.map(id => {
                  const condition = CONDITIONS.find(c => c.id === id);
                  return (
                    <Badge key={id} variant="default" className="text-xs px-3 py-1 rounded-xl">
                      {condition?.name}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Condition list */}
            <div className="space-y-5 pb-4">
              {Object.entries(groupedConditions).map(([category, conditions]) => (
                conditions.length > 0 && (
                  <div key={category} className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">{category}</h3>
                    <div className="space-y-1.5">
                      {conditions.map((condition) => (
                        <button
                          key={condition.id}
                          onClick={() => toggleCondition(condition.id)}
                          className={cn(
                            "w-full py-3.5 px-4 rounded-2xl text-left transition-all active:scale-[0.98]",
                            "flex items-center justify-between",
                            data.conditions.includes(condition.id)
                              ? 'bg-primary/10 border border-primary/30'
                              : 'bg-card/50 backdrop-blur-xl border border-border/20 hover:border-border/40'
                          )}
                        >
                          <span className="text-sm font-medium">{condition.name}</span>
                          {data.conditions.includes(condition.id) && (
                            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2 mb-2">
              <h2 className="text-2xl font-bold tracking-tight">Quick Setup</h2>
              <p className="text-sm text-muted-foreground">Configure your experience</p>
            </div>

            {/* Wearables */}
            <div className={cn(
              "p-5 rounded-2xl space-y-3",
              "bg-card/60 backdrop-blur-xl border border-border/30"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Watch className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Auto-Capture Data</p>
                    <p className="text-xs text-muted-foreground">Sleep, HR, steps — no logging</p>
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
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/20 animate-in fade-in-0 duration-200">
                  {['Apple Health', 'Fitbit', 'Oura'].map(d => (
                    <span key={d} className="text-[10px] px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground font-medium">{d}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Reminders */}
            <div className={cn(
              "p-5 rounded-2xl space-y-3",
              "bg-card/60 backdrop-blur-xl border border-border/30"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Daily Check-ins</p>
                    <p className="text-xs text-muted-foreground">Quick logs build better predictions</p>
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
                <div className="pt-2 border-t border-border/20 animate-in fade-in-0 duration-200">
                  <Input
                    type="time"
                    value={data.reminderTime}
                    onChange={(e) => setData(prev => ({ ...prev, reminderTime: e.target.value }))}
                    className="h-10 rounded-xl bg-muted/30 border-border/20"
                  />
                </div>
              )}
            </div>

            {/* AI info */}
            <div className={cn(
              "p-4 rounded-2xl",
              "bg-primary/5 border border-primary/15"
            )}>
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold">AI Will Auto-Learn</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {[
                      "Your symptom & trigger patterns",
                      "Sleep → flare correlations", 
                      "Weather sensitivity windows",
                      "Time-of-day vulnerabilities",
                      "Compound risk factors"
                    ].map((item, i) => (
                      <p key={i} className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
        <Button 
          onClick={handleNext}
          disabled={!canProceed()}
          className="w-full h-13 text-base font-semibold rounded-2xl shadow-lg"
          style={{ height: '52px' }}
        >
          {step === 0 ? "Get Started" : step === totalSteps - 1 ? "Launch Jvala" : "Continue"}
          <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
      </div>
    </div>
  );
};
