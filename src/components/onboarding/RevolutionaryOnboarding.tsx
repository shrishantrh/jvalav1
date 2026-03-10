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
  Zap,
  TrendingUp,
  CheckCircle2,
  Bell
} from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { isNative, platform } from "@/lib/capacitor";

interface OnboardingData {
  conditions: string[];
  customConditions: string[];
  dateOfBirth: string;
  biologicalSex: string;
  firstName: string;
  knownSymptoms: string[];
  knownTriggers: string[];
  medications: string[];
  trackingItems: string[];
  dataSources: string[];
  menstrualApp: string | null;
  age: number | null;
  enableReminders: boolean;
  reminderTime: string;
  aiLogCategories?: any[];
}

interface RevolutionaryOnboardingProps {
  onComplete: (data: OnboardingData) => void;
}

const TOTAL_STEPS = 10;

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

const ONBOARDING_STORAGE_KEY = 'jvala_onboarding_progress';

const loadSavedProgress = (): { step: number; data: OnboardingData } | null => {
  try {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
};

const saveProgress = (step: number, data: OnboardingData) => {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ step, data }));
  } catch {}
};

const clearProgress = () => {
  try { localStorage.removeItem(ONBOARDING_STORAGE_KEY); } catch {}
};

export const RevolutionaryOnboarding = ({ onComplete }: RevolutionaryOnboardingProps) => {
  const saved = loadSavedProgress();
  const [step, setStep] = useState(saved?.step || 0);
  const [data, setData] = useState<OnboardingData>(saved?.data || {
    conditions: [],
    customConditions: [],
    dateOfBirth: "",
    biologicalSex: "",
    firstName: "",
    knownSymptoms: [],
    knownTriggers: [],
    medications: [],
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

  // Autosave progress whenever step or data changes
  useEffect(() => {
    saveProgress(step, data);
  }, [step, data]);

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
    clearProgress();

    const steps = [0, 1, 2, 3, 4];
    for (const s of steps) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setAnalyzeStep(s);
    }
    await new Promise(resolve => setTimeout(resolve, 800));

    onComplete({ ...data, age, aiLogCategories });
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

  // Get fallback symptoms/triggers from predefined conditions (used when AI fails)
  const fallbackSymptoms = useMemo(() => {
    const conditionData = CONDITIONS.filter(c => data.conditions.includes(c.id));
    return [...new Set(conditionData.flatMap(c => c.commonSymptoms))];
  }, [data.conditions]);

  const fallbackTriggers = useMemo(() => {
    const conditionData = CONDITIONS.filter(c => data.conditions.includes(c.id));
    return [...new Set(conditionData.flatMap(c => c.commonTriggers))];
  }, [data.conditions]);

  // AI-generated suggestions state
  const [aiSymptoms, setAiSymptoms] = useState<string[]>([]);
  const [aiTriggers, setAiTriggers] = useState<string[]>([]);
  const [aiLogCategories, setAiLogCategories] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  // Fetch AI suggestions when moving TO the symptoms step (step 4)
  useEffect(() => {
    if (step === 4 && !suggestionsLoaded && totalSelected > 0) {
      const fetchSuggestions = async () => {
        setIsLoadingSuggestions(true);
        try {
          const allConditionNames = [
            ...data.conditions.map(id => CONDITIONS.find(c => c.id === id)?.name).filter(Boolean),
            ...data.customConditions,
          ];
          
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: result, error } = await supabase.functions.invoke('generate-suggestions', {
            body: { 
              conditions: allConditionNames,
              biologicalSex: data.biologicalSex,
              age: age,
            }
          });

          if (!error && result) {
            const mergedSymptoms = [...new Set([...fallbackSymptoms, ...(result.symptoms || [])])];
            const mergedTriggers = [...new Set([...fallbackTriggers, ...(result.triggers || [])])];
            setAiSymptoms(mergedSymptoms);
            setAiTriggers(mergedTriggers);
            setAiLogCategories(result.logCategories || []);
            setSuggestionsLoaded(true);
          }
        } catch (e) {
          console.error('Failed to fetch AI suggestions:', e);
          setAiSymptoms(fallbackSymptoms);
          setAiTriggers(fallbackTriggers);
          setSuggestionsLoaded(true);
        } finally {
          setIsLoadingSuggestions(false);
        }
      };
      fetchSuggestions();
    }
  }, [step, suggestionsLoaded, totalSelected]);

  const displaySymptoms = aiSymptoms.length > 0 ? aiSymptoms : fallbackSymptoms;
  const displayTriggers = aiTriggers.length > 0 ? aiTriggers : fallbackTriggers;

  // Permission request state
  const [healthPermissionStatus, setHealthPermissionStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  const requestNotificationPermission = async () => {
    setNotificationPermissionStatus('requesting');
    haptics.selection();
    try {
      if (isNative) {
        // Use Capacitor Push Notifications
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') {
          await PushNotifications.register();
          setNotificationPermissionStatus('granted');
          haptics.success();
        } else {
          setNotificationPermissionStatus('denied');
        }
      } else if ('Notification' in window) {
        const result = await Notification.requestPermission();
        setNotificationPermissionStatus(result === 'granted' ? 'granted' : 'denied');
        if (result === 'granted') {
          haptics.success();
          // Also subscribe to web push
          try {
            const { usePushNotifications } = await import('@/hooks/usePushNotifications');
          } catch {}
        }
      } else {
        setNotificationPermissionStatus('denied');
      }
    } catch (e) {
      console.error('Notification permission error:', e);
      setNotificationPermissionStatus('denied');
    }
  };

  const requestHealthPermission = async () => {
    setHealthPermissionStatus('requesting');
    haptics.selection();
    try {
      const { requestHealthPermissions, isHealthAvailable } = await import('@/services/appleHealthService');
      const available = await isHealthAvailable();
      if (!available) {
        setHealthPermissionStatus('unavailable');
        return;
      }
      const result = await requestHealthPermissions({ mode: 'full' });
      setHealthPermissionStatus(result.ok ? 'granted' : 'denied');
      if (result.ok) haptics.success();
    } catch (e) {
      console.error('Health permission error:', e);
      setHealthPermissionStatus('unavailable');
    }
  };

  const requestLocationPermission = async () => {
    setLocationPermissionStatus('requesting');
    haptics.selection();
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      setLocationPermissionStatus('granted');
      haptics.success();
    } catch {
      setLocationPermissionStatus('denied');
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return data.firstName.trim().length > 0;
      case 2: return totalSelected > 0;
      case 3: // Quick Profile - block if DOB entered and under 13 or future
        if (data.dateOfBirth && (isUnder13 || isFutureDOB)) return false;
        return true;
      case 4: return true; // Symptoms/triggers optional
      case 5: return true; // Medications optional
      case 6: return true; // Value prop
      case 7: return true; // Notifications permission
      case 8: return true; // Health permission
      case 9: return true; // Location permission
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
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Highly Recommended</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Tap any that apply to you — this helps your AI get smarter faster. You can always change these later.
              </p>
            </div>

            {isLoadingSuggestions && (
              <div className="glass-card text-center py-8 space-y-3">
                <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Researching your conditions for relevant symptoms and triggers...
                </p>
              </div>
            )}

            {/* Symptoms section */}
            {!isLoadingSuggestions && displaySymptoms.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Common Symptoms</h3>
                  <span className="text-[10px] text-muted-foreground">({data.knownSymptoms.length} selected)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displaySymptoms.map((symptom) => (
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
            {!isLoadingSuggestions && displayTriggers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Common Triggers</h3>
                  <span className="text-[10px] text-muted-foreground">({data.knownTriggers.length} selected)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayTriggers.map((trigger) => (
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

            {!isLoadingSuggestions && displaySymptoms.length === 0 && displayTriggers.length === 0 && (
              <div className="glass-card text-center py-6 space-y-2">
                <Sparkles className="w-8 h-8 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Your AI will learn your symptoms and triggers as you log.
                </p>
              </div>
            )}

            <div className="glass-card flex items-start gap-3 bg-primary/5">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-snug">
                These are AI-researched based on your specific conditions. Selecting them helps personalize your quick log buttons and AI analysis immediately.
              </p>
            </div>
          </div>
        );

      // ─── Step 5: Medications ─────────────────────────────────
      case 5:
        return (
          <div className="space-y-5 animate-in fade-in-0 slide-in-from-right-4 duration-500 flex-1">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Current Medications</h2>
              <p className="text-sm text-muted-foreground">
                Add any medications you're currently taking. This helps your AI track effectiveness and interactions.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Type medication name and press Enter..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val && !data.medications.includes(val)) {
                      haptics.selection();
                      setData(prev => ({ ...prev, medications: [...prev.medications, val] }));
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
                className="pl-10 h-12 glass-card border-0"
              />
            </div>

            {data.medications.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.medications.map(med => (
                  <Badge
                    key={med}
                    className="text-xs py-1.5 px-3 bg-primary/15 text-primary border-primary/20 gap-1 cursor-pointer press-effect"
                    onClick={() => {
                      haptics.selection();
                      setData(prev => ({ ...prev, medications: prev.medications.filter(m => m !== med) }));
                    }}
                  >
                    {med}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
            )}

            <div className="glass-card flex items-start gap-3 bg-primary/5">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Your AI will track how medications correlate with your symptoms over time. You can always update this in Settings.
              </p>
            </div>
          </div>
        );

      // ─── Step 6: Value Prop — "Tracking Compounds" (Bevel-inspired) ──────
      case 6:
        return (
          <div className="flex flex-col items-center justify-center flex-1 px-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Track to transform your health</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Jvala learns your patterns over time. The more you track, the smarter your predictions become.
                </p>
              </div>

              {/* Chart visualization */}
              <div className="relative w-full aspect-[4/3] mx-auto">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between opacity-10">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="border-t border-foreground" />
                  ))}
                </div>

                {/* "Without tracking" line - orange, flat/declining */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="withTrackingGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="withTrackingFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Without tracking - orange declining curve */}
                  <path
                    d="M 0 180 Q 100 170 200 190 Q 300 210 400 250"
                    fill="none"
                    stroke="hsl(25, 95%, 55%)"
                    strokeWidth="3"
                    strokeDasharray="8 4"
                    className="animate-in fade-in-0 duration-1000"
                    style={{ animationDelay: '500ms' }}
                  />
                  {/* Arrow at end of orange line */}
                  <polygon points="395,245 400,255 390,252" fill="hsl(25, 95%, 55%)" className="animate-in fade-in-0 duration-500" style={{ animationDelay: '1200ms' }} />

                  {/* With tracking - primary color ascending curve */}
                  <path
                    d="M 0 220 Q 80 200 160 170 Q 240 130 320 70 Q 360 45 400 20"
                    fill="none"
                    stroke="url(#withTrackingGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="animate-in fade-in-0 duration-1000"
                    style={{ animationDelay: '300ms' }}
                  />
                  {/* Fill under curve */}
                  <path
                    d="M 0 220 Q 80 200 160 170 Q 240 130 320 70 Q 360 45 400 20 L 400 300 L 0 300 Z"
                    fill="url(#withTrackingFill)"
                    className="animate-in fade-in-0 duration-1000"
                    style={{ animationDelay: '300ms' }}
                  />
                  {/* Arrow at end of primary line */}
                  <polygon points="395,15 400,25 390,22" fill="hsl(var(--primary))" className="animate-in fade-in-0 duration-500" style={{ animationDelay: '1000ms' }} />
                </svg>

                {/* Labels */}
                <div
                  className="absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-primary animate-in fade-in-0 zoom-in-90 duration-500"
                  style={{ top: '25%', left: '30%', animationDelay: '600ms' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  With tracking
                </div>
                <div
                  className="absolute px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium border animate-in fade-in-0 zoom-in-90 duration-500"
                  style={{ bottom: '15%', left: '35%', animationDelay: '900ms' }}
                >
                  Without tracking
                </div>

                {/* Axis labels */}
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>
                  Health
                </span>
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50">
                  Timeline
                </span>
              </div>

              <p className="text-xs text-muted-foreground/60">
                Let's connect your health data for the best experience.
              </p>
            </div>
          </div>
        );

      // ─── Step 7: Notifications Permission ─────────────────────────────
      case 7:
        return (
          <div className="flex flex-col items-center justify-center flex-1 px-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center">
                  <Bell className="w-8 h-8 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold">Stay on Track</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Jvala sends smart, context-aware notifications to help you build a tracking habit and catch flares early.
                </p>
              </div>

              {/* What notifications do */}
              <div className="space-y-2">
                {[
                  { label: "Morning & evening check-ins", desc: "Gentle reminders based on your schedule" },
                  { label: "Post-flare follow-ups", desc: "Track how you recover over hours" },
                  { label: "Environmental alerts", desc: "Weather shifts that may trigger symptoms" },
                  { label: "Streak celebrations", desc: "Stay motivated with milestones" },
                ].map((item, i) => (
                  <div key={i} className="glass-card flex items-center gap-3 py-3">
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Permission button */}
              <button
                onClick={requestNotificationPermission}
                disabled={notificationPermissionStatus === 'requesting' || notificationPermissionStatus === 'granted'}
                className={cn(
                  "w-full py-4 rounded-2xl text-sm font-semibold transition-all press-effect flex items-center justify-center gap-2",
                  notificationPermissionStatus === 'granted'
                    ? "bg-green-500/15 text-green-600 border border-green-500/20"
                    : notificationPermissionStatus === 'denied'
                      ? "bg-muted text-muted-foreground border border-border"
                      : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                )}
              >
                {notificationPermissionStatus === 'requesting' && <Loader2 className="w-4 h-4 animate-spin" />}
                {notificationPermissionStatus === 'granted' && <CheckCircle2 className="w-4 h-4" />}
                {notificationPermissionStatus === 'idle' && <Bell className="w-4 h-4" />}
                {notificationPermissionStatus === 'idle' && "Allow Notifications"}
                {notificationPermissionStatus === 'requesting' && "Requesting..."}
                {notificationPermissionStatus === 'granted' && "Notifications Enabled"}
                {notificationPermissionStatus === 'denied' && "Permission Denied — Enable in Settings"}
              </button>

              <div className="glass-card flex items-start gap-3 bg-primary/5">
                <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  You can customize notification types and timing in Settings anytime.
                </p>
              </div>
            </div>
          </div>
        );

      // ─── Step 8: Health Data Permission ─────────────────────────────────
      case 8:
        return (
          <div className="flex flex-col items-center justify-center flex-1 px-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-pink-500/20 to-red-400/20 flex items-center justify-center">
                  <Heart className="w-8 h-8 text-pink-500" />
                </div>
                <h2 className="text-2xl font-bold">Connect Health Data</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Jvala needs your health data to detect patterns, predict flares, and provide personalized insights.
                </p>
              </div>

              {/* What we'll track */}
              <div className="space-y-2">
                {[
                  { label: "Heart rate & HRV", desc: "Stress and flare detection" },
                  { label: "Sleep quality", desc: "Sleep-flare correlations" },
                  { label: "Activity & steps", desc: "Movement impact on symptoms" },
                  { label: "Blood oxygen & respiratory", desc: "Physiological baselines" },
                ].map((item, i) => (
                  <div key={i} className="glass-card flex items-center gap-3 py-3">
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Permission button */}
              {isNative ? (
                <button
                  onClick={requestHealthPermission}
                  disabled={healthPermissionStatus === 'requesting' || healthPermissionStatus === 'granted'}
                  className={cn(
                    "w-full py-4 rounded-2xl text-sm font-semibold transition-all press-effect flex items-center justify-center gap-2",
                    healthPermissionStatus === 'granted'
                      ? "bg-green-500/15 text-green-600 border border-green-500/20"
                      : healthPermissionStatus === 'denied' || healthPermissionStatus === 'unavailable'
                        ? "bg-muted text-muted-foreground border border-border"
                        : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                  )}
                >
                  {healthPermissionStatus === 'requesting' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {healthPermissionStatus === 'granted' && <CheckCircle2 className="w-4 h-4" />}
                  {healthPermissionStatus === 'idle' && <Heart className="w-4 h-4" />}
                  {healthPermissionStatus === 'idle' && "Allow Health Access"}
                  {healthPermissionStatus === 'requesting' && "Requesting..."}
                  {healthPermissionStatus === 'granted' && "Health Connected"}
                  {healthPermissionStatus === 'denied' && "Permission Denied — Enable in Settings"}
                  {healthPermissionStatus === 'unavailable' && "Health Data Not Available"}
                </button>
              ) : (
                <div className="glass-card text-center py-4 space-y-2">
                  <Activity className="w-6 h-6 text-primary mx-auto" />
                  <p className="text-sm font-medium">Available on Mobile</p>
                  <p className="text-xs text-muted-foreground">
                    Health data integration is available when using the Jvala app on your phone.
                  </p>
                </div>
              )}

              <div className="glass-card flex items-start gap-3 bg-primary/5">
                <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Read-only access. We never write to or modify your health data. All data stays encrypted on your device.
                </p>
              </div>
            </div>
          </div>
        );

      // ─── Step 8: Location Permission ─────────────────────────────────
      case 8:
        return (
          <div className="flex flex-col items-center justify-center flex-1 px-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold">Enable Location</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Jvala uses your location to capture environmental data that may trigger your flares.
                </p>
              </div>

              {/* What we track */}
              <div className="space-y-2">
                {[
                  { label: "Weather conditions", desc: "Temperature, humidity, pressure changes" },
                  { label: "Air quality (AQI)", desc: "Pollution and particulate matter" },
                  { label: "Pollen levels", desc: "Seasonal allergy triggers" },
                  { label: "Barometric pressure", desc: "Known migraine & joint pain trigger" },
                ].map((item, i) => (
                  <div key={i} className="glass-card flex items-center gap-3 py-3">
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Permission button */}
              <button
                onClick={requestLocationPermission}
                disabled={locationPermissionStatus === 'requesting' || locationPermissionStatus === 'granted'}
                className={cn(
                  "w-full py-4 rounded-2xl text-sm font-semibold transition-all press-effect flex items-center justify-center gap-2",
                  locationPermissionStatus === 'granted'
                    ? "bg-green-500/15 text-green-600 border border-green-500/20"
                    : locationPermissionStatus === 'denied'
                      ? "bg-muted text-muted-foreground border border-border"
                      : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                )}
              >
                {locationPermissionStatus === 'requesting' && <Loader2 className="w-4 h-4 animate-spin" />}
                {locationPermissionStatus === 'granted' && <CheckCircle2 className="w-4 h-4" />}
                {locationPermissionStatus === 'idle' && <MapPin className="w-4 h-4" />}
                {locationPermissionStatus === 'idle' && "Allow Location Access"}
                {locationPermissionStatus === 'requesting' && "Requesting..."}
                {locationPermissionStatus === 'granted' && "Location Enabled"}
                {locationPermissionStatus === 'denied' && "Permission Denied — Enable in Settings"}
              </button>

              <div className="glass-card flex items-start gap-3 bg-primary/5">
                <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  City-level only. We never track your exact location or share it with anyone.
                </p>
              </div>
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
          {step === 0 ? "Let's Get Started" : step === TOTAL_STEPS - 1 ? "Launch Jvala ✨" : "Continue"}
          <ChevronRight className="w-5 h-5" />
        </button>

        {(step === 3 || step === 4 || step === 5 || step === 7 || step === 8) && (
          <button
            onClick={handleNext}
            className="w-full mt-2 py-2 text-sm text-muted-foreground"
          >
            {step === 7 || step === 8 ? "Skip" : "Skip for now"}
          </button>
        )}
      </div>
    </div>
  );
};
