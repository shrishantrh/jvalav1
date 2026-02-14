import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CONDITIONS, Condition, ALL_SYMPTOMS, ALL_TRIGGERS } from "@/data/conditions";
import { 
  ChevronRight, 
  Search,
  Heart,
  Check,
  Sparkles,
  Brain,
  MapPin,
  Activity,
  Shield,
  Loader2,
  ChevronLeft,
  Calendar,
  User2,
  Plus,
  X,
  AlertCircle,
  Zap
} from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface OnboardingData {
  conditions: string[];
  customConditions: string[];
  dateOfBirth: string;
  biologicalSex: string;
  firstName: string;
  knownSymptoms: string[];
  knownTriggers: string[];
  trackingItems: string[];
  dataSources: string[];
  menstrualApp: string | null;
  age: number | null;
  enableReminders: boolean;
  reminderTime: string;
}

interface RevolutionaryOnboardingProps {
  onComplete: (data: OnboardingData) => void;
}

const TOTAL_STEPS = 6;

// Animated dot background for hero
const FloatingOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20 animate-float"
      style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)' }} />
    <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full opacity-15 animate-float"
      style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)', animationDelay: '2s' }} />
    <div className="absolute top-1/3 right-0 w-40 h-40 rounded-full opacity-10 animate-float"
      style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 70%)', animationDelay: '1s' }} />
  </div>
);

// Helper to calculate age from DOB string
const calculateAge = (dob: string): number | null => {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// Get today's date string for max attribute
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export const RevolutionaryOnboarding = ({ onComplete }: RevolutionaryOnboardingProps) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    conditions: [],
    customConditions: [],
    dateOfBirth: "",
    biologicalSex: "",
    firstName: "",
    knownSymptoms: [],
    knownTriggers: [],
    trackingItems: ['symptoms_flares'],
    dataSources: [],
    menstrualApp: null,
    age: null,
    enableReminders: true,
    reminderTime: "09:00",
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [conditionSearch, setConditionSearch] = useState("");
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const age = useMemo(() => calculateAge(data.dateOfBirth), [data.dateOfBirth]);
  const isUnder13 = age !== null && age < 13;
  const isFutureDOB = data.dateOfBirth && new Date(data.dateOfBirth) > new Date();

  const handleNext = () => {
    haptics.selection();
    if (step === TOTAL_STEPS - 1) {
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

    const steps = [0, 1, 2, 3, 4];
    for (const s of steps) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setAnalyzeStep(s);
    }
    await new Promise(resolve => setTimeout(resolve, 800));

    onComplete({ ...data, age });
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

  const addCustomCondition = () => {
    const trimmed = conditionSearch.trim();
    if (!trimmed) return;
    const existsInList = CONDITIONS.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existsInList) return;
    if (data.customConditions.some(c => c.toLowerCase() === trimmed.toLowerCase())) return;

    haptics.selection();
    setData(prev => ({
      ...prev,
      customConditions: [...prev.customConditions, trimmed]
    }));
    setConditionSearch("");
  };

  const removeCustomCondition = (condition: string) => {
    haptics.selection();
    setData(prev => ({
      ...prev,
      customConditions: prev.customConditions.filter(c => c !== condition)
    }));
  };

  const toggleSymptom = (symptom: string) => {
    haptics.selection();
    setData(prev => ({
      ...prev,
      knownSymptoms: prev.knownSymptoms.includes(symptom)
        ? prev.knownSymptoms.filter(s => s !== symptom)
        : [...prev.knownSymptoms, symptom]
    }));
  };

  const toggleTrigger = (trigger: string) => {
    haptics.selection();
    setData(prev => ({
      ...prev,
      knownTriggers: prev.knownTriggers.includes(trigger)
        ? prev.knownTriggers.filter(t => t !== trigger)
        : [...prev.knownTriggers, trigger]
    }));
  };

  const filteredConditions = conditionSearch
    ? CONDITIONS.filter(c =>
        c.name.toLowerCase().includes(conditionSearch.toLowerCase()) ||
        c.category.toLowerCase().includes(conditionSearch.toLowerCase())
      )
    : CONDITIONS;

  const totalSelected = data.conditions.length + data.customConditions.length;

  // Get AI-suggested symptoms/triggers based on selected conditions
  const suggestedSymptoms = useMemo(() => {
    const conditionData = CONDITIONS.filter(c => data.conditions.includes(c.id));
    return [...new Set(conditionData.flatMap(c => c.commonSymptoms))];
  }, [data.conditions]);

  const suggestedTriggers = useMemo(() => {
    const conditionData = CONDITIONS.filter(c => data.conditions.includes(c.id));
    return [...new Set(conditionData.flatMap(c => c.commonTriggers))];
  }, [data.conditions]);

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return data.firstName.trim().length > 0;
      case 2: return totalSelected > 0;
      case 3: // Quick Profile - block if DOB entered and under 13 or future
        if (data.dateOfBirth && (isUnder13 || isFutureDOB)) return false;
        return true;
      case 4: return true; // Symptoms/triggers optional
      case 5: return true; // Permissions optional
      default: return true;
    }
  };

  // Personalizing screen
  if (isAnalyzing) {
    const conditionNames = [
      ...data.conditions.map(id => CONDITIONS.find(c => c.id === id)?.name).filter(Boolean),
      ...data.customConditions
    ];

    const analyzeSteps = [
      { text: `Understanding ${conditionNames[0] || 'your conditions'}...`, icon: Brain },
      { text: "Researching evidence-based patterns...", icon: Search },
      { text: "Configuring symptom & trigger detection...", icon: Activity },
      { text: "Setting up environmental monitoring...", icon: MapPin },
      { text: `Personalizing for ${data.firstName || 'you'}...`, icon: Sparkles },
    ];

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-8"
        style={{ background: 'var(--gradient-background)', paddingTop: 'env(safe-area-inset-top)' }}>
        <FloatingOrbs />
        <div className="text-center space-y-10 relative z-10 animate-in fade-in-0 zoom-in-95 duration-500">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 bg-gradient-primary rounded-3xl opacity-30 animate-pulse" />
            <div className="absolute inset-0 bg-gradient-primary rounded-3xl opacity-15 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="relative glass-card rounded-3xl p-4 flex items-center justify-center h-full">
              <Brain className="w-10 h-10 text-primary" />
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold">Building Your Health AI</h2>
            <div className="space-y-3 max-w-[280px] mx-auto text-left">
              {analyzeSteps.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === analyzeStep;
                const isDone = i < analyzeStep;
                return (
                  <div key={i} className={cn(
                    "flex items-center gap-3 py-2 px-3 rounded-xl transition-all duration-500",
                    isDone ? "opacity-60" : isActive ? "glass-card" : "opacity-20"
                  )}>
                    {isDone ? (
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 text-primary flex-shrink-0 animate-spin" />
                    ) : (
                      <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={cn("text-sm", isActive ? "font-medium" : "")}>
                      {s.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      // ─── Step 0: Welcome ─────────────────────────────────
      case 0:
        return (
          <div className="flex flex-col items-center justify-center flex-1 px-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
            <FloatingOrbs />
            <div className="relative z-10 text-center space-y-8 w-full">
              <div className="relative w-28 h-28 mx-auto">
                <div className="absolute inset-0 bg-gradient-primary rounded-[2rem] rotate-6 opacity-20" />
                <div className="absolute inset-0 bg-gradient-primary rounded-[2rem] -rotate-3 opacity-30" />
                <div className="relative glass-card rounded-[2rem] p-5 shadow-soft-lg h-full flex items-center justify-center">
                  <img src={jvalaLogo} alt="Jvala" className="w-full h-full object-contain" />
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-gradient-primary leading-tight">
                  Your Health,<br />Understood.
                </h1>
                <p className="text-base text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                  An AI health companion that learns your unique patterns and predicts what's coming — so you can live better.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  { icon: Brain, title: "Learns Your Patterns", desc: "AI connects the dots you can't see" },
                  { icon: Sparkles, title: "Predicts Flares", desc: "Know what's coming before it hits" },
                  { icon: Shield, title: "Evidence-Based", desc: "Backed by clinical research, not guesswork" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="glass-card flex items-center gap-4 animate-in fade-in-0"
                    style={{ animationDelay: `${300 + idx * 150}ms` }}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      // ─── Step 1: Name ─────────────────────────────────
      case 1:
        return (
          <div className="flex flex-col items-center justify-center flex-1 px-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm text-center space-y-8">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center">
                <User2 className="w-8 h-8 text-primary-foreground" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold">What should we call you?</h2>
                <p className="text-sm text-muted-foreground">
                  So your health assistant feels personal.
                </p>
              </div>

              <div className="glass-card space-y-4">
                <Input
                  placeholder="First name"
                  value={data.firstName}
                  onChange={(e) => setData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="h-14 text-lg text-center font-medium bg-transparent border-0 border-b-2 border-border/30 rounded-none focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/40"
                  autoFocus
                  autoComplete="given-name"
                />
              </div>

              <p className="text-xs text-muted-foreground/60">
                We'll use this to personalize your experience
              </p>
            </div>
          </div>
        );

      // ─── Step 2: Conditions ─────────────────────────────────
      case 2:
        return (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-500 flex-1">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">
                {data.firstName ? `${data.firstName}, what` : "What"} are you managing?
              </h2>
              <p className="text-sm text-muted-foreground">
                Type anything — chronic conditions, deficiencies, or health concerns. Our AI will learn what matters for <span className="font-medium text-foreground">your</span> body.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search or type your condition..."
                value={conditionSearch}
                onChange={(e) => setConditionSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomCondition();
                }}
                className="pl-10 pr-12 h-12 glass-card border-0"
              />
              {conditionSearch.trim() && !CONDITIONS.some(c => c.name.toLowerCase() === conditionSearch.toLowerCase()) && (
                <button
                  onClick={addCustomCondition}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary flex items-center justify-center press-effect"
                >
                  <Plus className="w-4 h-4 text-primary-foreground" />
                </button>
              )}
            </div>

            {totalSelected > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.conditions.map(id => {
                  const condition = CONDITIONS.find(c => c.id === id);
                  return (
                    <Badge
                      key={id}
                      className="text-xs py-1.5 px-3 bg-primary/15 text-primary border-primary/20 gap-1 cursor-pointer press-effect"
                      onClick={() => toggleCondition(id)}
                    >
                      {condition?.name}
                      <X className="w-3 h-3" />
                    </Badge>
                  );
                })}
                {data.customConditions.map(name => (
                  <Badge
                    key={name}
                    className="text-xs py-1.5 px-3 bg-accent text-accent-foreground border-accent gap-1 cursor-pointer press-effect"
                    onClick={() => removeCustomCondition(name)}
                  >
                    {name}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex-1 max-h-[340px] overflow-y-auto space-y-1 pr-1 scrollbar-hide">
              {filteredConditions.map((condition) => {
                const isSelected = data.conditions.includes(condition.id);
                return (
                  <button
                    key={condition.id}
                    onClick={() => toggleCondition(condition.id)}
                    className={cn(
                      "w-full py-3 px-4 rounded-2xl text-left transition-all press-effect",
                      "flex items-center justify-between",
                      isSelected
                        ? 'glass-card bg-primary/8 border-primary/20'
                        : 'hover:bg-card/80'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block">{condition.name}</span>
                      <span className="text-[11px] text-muted-foreground">{condition.category}</span>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}

              {conditionSearch.trim() && !CONDITIONS.some(c => c.name.toLowerCase() === conditionSearch.toLowerCase()) && (
                <button
                  onClick={addCustomCondition}
                  className="w-full py-3 px-4 rounded-2xl text-left transition-all press-effect flex items-center gap-3 border-2 border-dashed border-primary/30 hover:border-primary/50"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium">Add "{conditionSearch.trim()}"</span>
                    <span className="text-[11px] text-muted-foreground block">AI will research this for you</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        );

      // ─── Step 3: Quick Profile (DOB + Biological Sex) ─────────────────
      case 3:
        return (
          <div className="flex flex-col items-center justify-center flex-1 px-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Quick Profile</h2>
                <p className="text-sm text-muted-foreground">
                  Helps your AI give medically relevant insights. All optional.
                </p>
              </div>

              {/* Date of Birth */}
              <div className="glass-card space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Date of Birth</p>
                    <p className="text-[11px] text-muted-foreground">Age affects symptom patterns & medication dosing</p>
                  </div>
                </div>
                <Input
                  type="date"
                  value={data.dateOfBirth}
                  max={getTodayString()}
                  onChange={(e) => setData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="h-12 bg-transparent"
                />
                {isFutureDOB && (
                  <div className="flex items-center gap-2 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Date of birth cannot be in the future.</span>
                  </div>
                )}
                {isUnder13 && !isFutureDOB && (
                  <div className="flex items-center gap-2 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>You must be at least 13 years old to use Jvala (COPPA).</span>
                  </div>
                )}
              </div>

              {/* Biological Sex */}
              <div className="glass-card space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Biological Sex</p>
                    <p className="text-[11px] text-muted-foreground">Affects hormonal patterns, autoimmune risk factors</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        haptics.selection();
                        setData(prev => ({ ...prev, biologicalSex: option.value }));
                      }}
                      className={cn(
                        "py-3.5 rounded-xl text-center transition-all press-effect border text-sm font-medium",
                        data.biologicalSex === option.value
                          ? 'bg-primary/15 border-primary/30 text-foreground'
                          : 'bg-card/50 border-border/20 hover:border-primary/20 text-muted-foreground'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground/50">
                Skip anything you're not comfortable sharing
              </p>
            </div>
          </div>
        );

      // ─── Step 4: Known Symptoms & Triggers (AI-suggested) ─────────────
      case 4:
        return (
          <div className="space-y-5 animate-in fade-in-0 slide-in-from-right-4 duration-500 flex-1">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-bold">Symptoms & Triggers</h2>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Recommended</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on your conditions, we've suggested common ones. Selecting these helps your AI give better insights from day one.
              </p>
            </div>

            {/* Symptoms section */}
            {suggestedSymptoms.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Common Symptoms</h3>
                  <span className="text-[10px] text-muted-foreground">({data.knownSymptoms.length} selected)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedSymptoms.map((symptom) => (
                    <button
                      key={symptom}
                      onClick={() => toggleSymptom(symptom)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs transition-all press-effect border",
                        data.knownSymptoms.includes(symptom)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-primary/20 hover:border-primary/40'
                      )}
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Triggers section */}
            {suggestedTriggers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Common Triggers</h3>
                  <span className="text-[10px] text-muted-foreground">({data.knownTriggers.length} selected)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedTriggers.map((trigger) => (
                    <button
                      key={trigger}
                      onClick={() => toggleTrigger(trigger)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs transition-all press-effect border",
                        data.knownTriggers.includes(trigger)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-primary/20 hover:border-primary/40'
                      )}
                    >
                      {trigger}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {suggestedSymptoms.length === 0 && suggestedTriggers.length === 0 && (
              <div className="glass-card text-center py-6 space-y-2">
                <Sparkles className="w-8 h-8 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Your AI will learn your symptoms and triggers as you log — no setup needed for custom conditions.
                </p>
              </div>
            )}

            <div className="glass-card flex items-start gap-3 bg-primary/5">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-snug">
                These are AI-suggested based on your conditions. You can always add more later in Settings. Selecting them helps personalize your experience immediately.
              </p>
            </div>
          </div>
        );

      // ─── Step 5: Permissions ─────────────────────────────────
      case 5:
        return (
          <div className="flex flex-col items-center justify-center flex-1 px-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Make Your AI Smarter</h2>
                <p className="text-sm text-muted-foreground">
                  These help your AI detect environmental and physiological triggers automatically.
                </p>
              </div>

              {/* Location - informational card, not a button */}
              <div className="w-full glass-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Location</p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Track weather, air quality, pollen & barometric pressure — key flare triggers for many conditions.
                  </p>
                </div>
              </div>

              {/* Health Data - informational card, not a button */}
              <div className="w-full glass-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-accent flex items-center justify-center flex-shrink-0">
                  <Activity className="w-6 h-6 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Health Data</p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Heart rate, HRV, sleep & steps from Apple Health or wearables. Your AI correlates these with flares.
                  </p>
                </div>
              </div>

              {/* Privacy note */}
              <div className="glass-card flex items-start gap-3 bg-primary/5">
                <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">Your data stays yours</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Everything is encrypted and stored securely. We never sell your data. Location is city-level only.
                  </p>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground/50">
                You can enable these anytime in Settings
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ 
      background: 'var(--gradient-background)',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {/* Progress header */}
      {step > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 glass-header">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors press-effect"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full flex-1 transition-all duration-500",
                  i <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground w-10 text-right">
            {step + 1}/{TOTAL_STEPS}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {renderStep()}
      </div>

      {/* Bottom CTA */}
      <div className="px-5 py-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className={cn(
            "w-full h-14 rounded-2xl text-base font-semibold transition-all press-effect",
            "flex items-center justify-center gap-2",
            canProceed()
              ? "bg-gradient-primary text-primary-foreground shadow-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {step === 0 ? "Let's Get Started" : step === TOTAL_STEPS - 1 ? "Launch Jvala ✨" : step === 4 ? "Continue" : "Continue"}
          <ChevronRight className="w-5 h-5" />
        </button>

        {(step === 3 || step === 4) && (
          <button
            onClick={handleNext}
            className="w-full mt-2 py-2 text-sm text-muted-foreground"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
};
