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
  const [slideProgress, setSlideProgress] = useState(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const slidingRef = useRef(false);
  const hapticIntervalRef = useRef<number | null>(null);
  const [conditionSearch, setConditionSearch] = useState("");
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const nameAutoFilled = useRef(false);

  const age = useMemo(() => calculateAge(data.dateOfBirth), [data.dateOfBirth]);
  const isUnder13 = age !== null && age < 13;
  const isFutureDOB = data.dateOfBirth && new Date(data.dateOfBirth) > new Date();

  // Auto-fill first name from OAuth metadata (Google/Apple)
  useEffect(() => {
    if (nameAutoFilled.current || data.firstName) return;
    nameAutoFilled.current = true;

    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const meta = user.user_metadata;
        const firstName =
          meta?.given_name ||
          meta?.first_name ||
          (meta?.full_name || meta?.name || '').split(' ')[0] ||
          '';

        if (firstName && !data.firstName) {
          setData(prev => ({ ...prev, firstName }));
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Autosave progress whenever step or data changes
  useEffect(() => {
    saveProgress(step, data);
  }, [step, data]);

  const handleNext = () => {
    haptics.medium();
    if (step === TOTAL_STEPS - 1) {
      handleComplete();
    } else {
      setStep(prev => prev + 1);
      // Subtle double-tap on step transition
      setTimeout(() => haptics.light(), 120);
    }
  };

  const handleBack = () => {
    haptics.selection();
    setStep(prev => Math.max(prev - 1, 0));
  };

  const handleComplete = async () => {
    setIsAnalyzing(true);
    haptics.heavy();
    clearProgress();

    const steps = [0, 1, 2, 3, 4];
    for (const s of steps) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setAnalyzeStep(s);
      // Alternating haptic patterns for each step
      if (s % 2 === 0) {
        haptics.impact();
      } else {
        haptics.medium();
      }
      // Extra rapid pulses during analysis
      await new Promise(resolve => setTimeout(resolve, 150));
      haptics.light();
    }
    await new Promise(resolve => setTimeout(resolve, 800));
    haptics.heavy();
    await new Promise(resolve => setTimeout(resolve, 200));
    haptics.success();
    await new Promise(resolve => setTimeout(resolve, 150));
    haptics.success();

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
  const healthRequestInFlightRef = useRef(false);
  const locationRequestInFlightRef = useRef(false);

  const withPermissionTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };

  const isLocationGranted = (permStatus: { location?: string; coarseLocation?: string } | null | undefined) => {
    return permStatus?.location === 'granted' || permStatus?.coarseLocation === 'granted';
  };

  const isLocationDeniedStatus = (permStatus: { location?: string; coarseLocation?: string } | null | undefined) => {
    return permStatus?.location === 'denied' || permStatus?.coarseLocation === 'denied';
  };

  const isLocationPromptStatus = (permStatus: { location?: string; coarseLocation?: string } | null | undefined) => {
    return (
      permStatus?.location === 'prompt' ||
      permStatus?.location === 'prompt-with-rationale' ||
      permStatus?.coarseLocation === 'prompt' ||
      permStatus?.coarseLocation === 'prompt-with-rationale'
    );
  };

  const classifyLocationError = (error: unknown): 'denied' | 'services_off' | 'unknown' => {
    const message = (error instanceof Error ? error.message : String(error)).toUpperCase();
    if (message.includes('OS-PLUG-GLOC-0003')) return 'denied';
    if (message.includes('OS-PLUG-GLOC-0007') || message.includes('OS-PLUG-GLOC-0008')) return 'services_off';
    return 'unknown';
  };

  const getNativeGeolocation = async () => {
    const injected = (window as any)?.Capacitor?.Plugins?.Geolocation;
    if (injected) return injected;

    const { Geolocation } = await import('@capacitor/geolocation');
    return Geolocation;
  };

  // Step sync for Health: never auto-request here.
  // Keep this step explicitly user-triggered so we can re-request broader scopes safely.
  useEffect(() => {
    if (step !== 7) return;

    if (!isNative) {
      setHealthPermissionStatus('unavailable');
      return;
    }

    setHealthPermissionStatus((current) => (current === 'requesting' ? current : 'idle'));
  }, [step]);

  // Step sync for Location: only reflect already-granted state. Do not auto-mark denied on step entry.
  useEffect(() => {
    if (step !== 8 || !isNative || locationRequestInFlightRef.current || locationPermissionStatus === 'requesting') return;

    let cancelled = false;

    (async () => {
      try {
        const Geolocation = await getNativeGeolocation();
        const permStatus = await withPermissionTimeout(
          Geolocation.checkPermissions(),
          8000,
          'location_check'
        );

        if (cancelled) return;

        if (isLocationGranted(permStatus)) {
          setLocationPermissionStatus('granted');
        } else {
          setLocationPermissionStatus('idle');
        }
      } catch {
        if (!cancelled) {
          setLocationPermissionStatus('idle');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step]);

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
    if (healthRequestInFlightRef.current) return;

    healthRequestInFlightRef.current = true;
    setHealthPermissionStatus('requesting');
    haptics.selection();

    const watchdogId = window.setTimeout(() => {
      if (!healthRequestInFlightRef.current) return;
      console.warn('[Onboarding] Health request watchdog fired');
      healthRequestInFlightRef.current = false;
      setHealthPermissionStatus('denied');
    }, 35000);

    try {
      if (!isNative) {
        setHealthPermissionStatus('unavailable');
        return;
      }

      const {
        isHealthPluginPresent,
        HEALTH_MINIMAL_READ,
        HEALTH_FULL_READ,
        checkHealthPermissions,
        requestHealthPermissions,
      } = await import('@/services/appleHealthService');

      const injectedHealth = (window as any)?.Capacitor?.Plugins?.Health ?? null;

      if (!isHealthPluginPresent() && !injectedHealth) {
        console.warn('[Onboarding] Health plugin not present in this build');
        setHealthPermissionStatus('unavailable');
        return;
      }

      const chunkScopes = <T,>(scopes: T[], size: number): T[][] => {
        if (size <= 0) return [scopes];
        const chunks: T[][] = [];
        for (let i = 0; i < scopes.length; i += size) {
          chunks.push(scopes.slice(i, i + size));
        }
        return chunks;
      };

      const requestReadScopes = async (read: string[], label: string): Promise<number> => {
        if (injectedHealth && typeof injectedHealth.requestAuthorization === 'function') {
          const status = await withPermissionTimeout(
            injectedHealth.requestAuthorization({ read, write: [] }),
            25000,
            label
          ) as { readAuthorized?: string[] };

          return Array.isArray(status?.readAuthorized) ? status.readAuthorized.length : 0;
        }

        const result = await withPermissionTimeout(
          requestHealthPermissions({ read: read as any }),
          25000,
          `${label}_service`
        );

        return Array.isArray(result?.status?.readAuthorized)
          ? result.status.readAuthorized.length
          : 0;
      };

      // Phase 1: request full access in one shot.
      // If iOS/plugin refuses the broad request, we fall back to minimal and expand in safe chunks.
      let fullAuthorizedCount = 0;
      try {
        fullAuthorizedCount = await requestReadScopes(HEALTH_FULL_READ, 'health_request_full');
      } catch (fullError) {
        console.warn('[Onboarding] Full Health scope request failed, falling back:', fullError);
      }

      let minimalAuthorizedCount = 0;
      if (fullAuthorizedCount === 0) {
        try {
          minimalAuthorizedCount = await requestReadScopes(HEALTH_MINIMAL_READ, 'health_request_minimal');
        } catch (minimalError) {
          console.warn('[Onboarding] Minimal Health request failed:', minimalError);
        }
      }

      // Verification fallback: if iOS grants access but request result is flaky, re-check authorization.
      let verifiedMinimal = false;
      try {
        verifiedMinimal = await withPermissionTimeout(
          checkHealthPermissions({ read: HEALTH_MINIMAL_READ }),
          9000,
          'health_check_after'
        );
      } catch (verifyError) {
        console.warn('[Onboarding] Health verification failed:', verifyError);
      }

      if (fullAuthorizedCount === 0 && minimalAuthorizedCount === 0 && !verifiedMinimal) {
        try { localStorage.removeItem('jvala_health_connected'); } catch {}
        setHealthPermissionStatus('denied');
        return;
      }

      // Phase 2: if full request did not complete, upgrade permissions in smaller batches.
      if (fullAuthorizedCount === 0) {
        const remainingScopes = HEALTH_FULL_READ.filter((scope) => !HEALTH_MINIMAL_READ.includes(scope));
        const batches = chunkScopes(remainingScopes, 6);

        for (let index = 0; index < batches.length; index += 1) {
          const batch = batches[index];
          try {
            await requestReadScopes(batch, `health_request_batch_${index + 1}`);
          } catch (batchError) {
            console.warn(`[Onboarding] Health batch ${index + 1} failed:`, batchError);
          }
        }
      }

      try { localStorage.setItem('jvala_health_connected', '1'); } catch {}
      setHealthPermissionStatus('granted');
      haptics.success();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[Onboarding] Health auth failed:', msg);
      try { localStorage.removeItem('jvala_health_connected'); } catch {}
      setHealthPermissionStatus('denied');
    } finally {
      window.clearTimeout(watchdogId);
      healthRequestInFlightRef.current = false;
    }
  };

  const requestLocationPermission = async () => {
    if (locationRequestInFlightRef.current) return;

    locationRequestInFlightRef.current = true;
    setLocationPermissionStatus('requesting');
    haptics.selection();

    try {
      if (isNative) {
        const Geolocation = await getNativeGeolocation();

        // First try getCurrentPosition directly from this tap gesture path.
        // On iOS this is the most reliable way to trigger the native permission sheet.
        try {
          await withPermissionTimeout(
            Geolocation.getCurrentPosition({
              timeout: 12000,
              enableHighAccuracy: false,
              maximumAge: 0,
            }),
            14000,
            'location_get_current_direct'
          );

          setLocationPermissionStatus('granted');
          haptics.success();
          return;
        } catch (directError) {
          const kind = classifyLocationError(directError);
          if (kind === 'services_off') {
            setLocationPermissionStatus('denied');
            return;
          }
        }

        // Explicit permission request fallback
        let requested: { location?: string; coarseLocation?: string } | null = null;

        try {
          requested = await withPermissionTimeout(
            Geolocation.requestPermissions({ permissions: ['location'] as any }),
            25000,
            'location_request_explicit'
          );
        } catch {
          requested = await withPermissionTimeout(
            Geolocation.requestPermissions(),
            25000,
            'location_request_default'
          );
        }

        if (isLocationGranted(requested)) {
          setLocationPermissionStatus('granted');
          haptics.success();
          return;
        }

        if (isLocationDeniedStatus(requested)) {
          setLocationPermissionStatus('denied');
          return;
        }

        // If still prompt/prompt-with-rationale, retry one direct read then final check.
        if (isLocationPromptStatus(requested) || !requested) {
          try {
            await withPermissionTimeout(
              Geolocation.getCurrentPosition({
                timeout: 12000,
                enableHighAccuracy: false,
                maximumAge: 0,
              }),
              14000,
              'location_get_current_retry'
            );
          } catch {
            // Final status check below
          }
        }

        const finalStatus = await withPermissionTimeout(
          Geolocation.checkPermissions(),
          8000,
          'location_check_after'
        );

        if (isLocationGranted(finalStatus)) {
          setLocationPermissionStatus('granted');
          haptics.success();
          return;
        }

        if (isLocationDeniedStatus(finalStatus)) {
          setLocationPermissionStatus('denied');
          return;
        }

        // Unknown / prompt state should not be shown as hard denied.
        setLocationPermissionStatus('idle');
        return;
      }

      // Web fallback
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 0,
        });
      });
      setLocationPermissionStatus('granted');
      haptics.success();
    } catch (e) {
      const kind = classifyLocationError(e);
      console.warn('[Onboarding] Location permission failed:', kind, e);
      setLocationPermissionStatus(kind === 'denied' || kind === 'services_off' ? 'denied' : 'idle');
    } finally {
      locationRequestInFlightRef.current = false;
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
      case 7: return healthPermissionStatus === 'granted' || healthPermissionStatus === 'unavailable'; // Health - required (or unavailable on web)
      case 8: return locationPermissionStatus === 'granted'; // Location - required
      case 9: return true; // Notifications - optional (last step)
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
                <h1 className="text-4xl font-bold text-gradient-primary leading-tight">
                  Your Health,<br />Understood.
                </h1>
                <p className="text-lg text-muted-foreground max-w-[300px] mx-auto leading-relaxed">
                  An AI health companion that learns your unique patterns and predicts what's coming.
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
                      <p className="text-base font-semibold">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
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
                <h2 className="text-3xl font-bold">What should we call you?</h2>
                <p className="text-base text-muted-foreground">
                  Your health assistant will use this name.
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
                {data.firstName ? `Hi ${data.firstName} 👋` : "We'll use this to personalize your experience"}
              </p>
            </div>
          </div>
        );

      // ─── Step 2: Conditions ─────────────────────────────────
      case 2: {
        // Group conditions by category for better browsing
        const categories = [...new Set(filteredConditions.map(c => c.category))];
        const showingSearch = conditionSearch.trim().length > 0;

        return (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-500 flex-1">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">
                {data.firstName ? `${data.firstName}, what` : "What"} do you want to track?
              </h2>
              <p className="text-base text-muted-foreground">
                Chronic conditions, pain, deficiencies, mental health — anything you experience regularly.
              </p>
            </div>

            {/* Example chips to inspire */}
            {totalSelected === 0 && !showingSearch && (
              <div className="flex flex-wrap justify-center gap-1.5 animate-in fade-in-0 duration-500">
                {['Back Pain', 'Migraine', 'Anxiety', 'IBS', 'Insomnia', 'Lupus'].map((example, i) => (
                  <span key={i} className="text-[10px] px-2.5 py-1 rounded-full border border-dashed border-primary/25 text-muted-foreground/70">
                    {example}
                  </span>
                ))}
                <span className="text-[10px] px-2.5 py-1 text-muted-foreground/50">+ anything else</span>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search or type anything..."
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

            {/* Scrollable condition list with category headers */}
            <div className="flex-1 max-h-[320px] overflow-y-auto space-y-3 pr-1 scrollbar-hide relative">
              {/* Fade-out scroll hint at bottom */}
              <div className="sticky top-0 left-0 right-0 h-0 z-10">
                {!showingSearch && totalSelected === 0 && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce opacity-40">
                    <ChevronRight className="w-4 h-4 rotate-90 text-muted-foreground" />
                  </div>
                )}
              </div>

              {showingSearch ? (
                // Flat list when searching
                <>
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
                </>
              ) : (
                // Grouped by category
                categories.map(category => {
                  const categoryConditions = filteredConditions.filter(c => c.category === category);
                  return (
                    <div key={category}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 pb-1">{category}</p>
                      <div className="space-y-0.5">
                        {categoryConditions.map((condition) => {
                          const isSelected = data.conditions.includes(condition.id);
                          return (
                            <button
                              key={condition.id}
                              onClick={() => toggleCondition(condition.id)}
                              className={cn(
                                "w-full py-2.5 px-4 rounded-xl text-left transition-all press-effect",
                                "flex items-center justify-between",
                                isSelected
                                  ? 'glass-card bg-primary/8 border-primary/20'
                                  : 'hover:bg-card/80'
                              )}
                            >
                              <span className="text-sm font-medium">{condition.name}</span>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                  <Check className="w-3 h-3 text-primary-foreground" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}

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
                    <span className="text-[11px] text-muted-foreground block">Your AI will learn to track this</span>
                  </div>
                </button>
              )}
            </div>

            {/* Subtle hint */}
            <p className="text-[10px] text-center text-muted-foreground/50">
              Can't find yours? Type it above — Jvala can track anything.
            </p>
          </div>
        );
      }

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
                <div className="relative">
                  <Input
                    type="date"
                    value={data.dateOfBirth}
                    max={getTodayString()}
                    onChange={(e) => {
                      haptics.selection();
                      setData(prev => ({ ...prev, dateOfBirth: e.target.value }));
                    }}
                    className={cn(
                      "h-12 rounded-xl border border-border/40 bg-background/70 px-3",
                      data.dateOfBirth ? "text-foreground" : "text-transparent"
                    )}
                  />
                  {!data.dateOfBirth && (
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                      Tap to choose your birthdate
                    </span>
                  )}
                </div>
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

      // ─── Step 6: Value Prop — "Tracking Compounds" ──────
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

              {/* Elegant chart visualization */}
              <div className="relative w-full aspect-[4/3] mx-auto glass-card rounded-3xl p-4 overflow-hidden">
                {/* Subtle grid */}
                <div className="absolute inset-4 flex flex-col justify-between opacity-[0.06]">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="border-t border-foreground" />
                  ))}
                </div>

                <svg className="absolute inset-4 w-[calc(100%-32px)] h-[calc(100%-32px)]" viewBox="0 0 400 300" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="withTrackingGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="withTrackingFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Without tracking - dashed declining */}
                  <path d="M 0 160 Q 100 165 200 185 Q 300 210 400 250" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2.5" strokeDasharray="8 6" opacity="0.4" className="animate-in fade-in-0 duration-1000" style={{ animationDelay: '500ms' }} />

                  {/* With tracking - glowing ascending curve */}
                  <path d="M 0 240 Q 60 220 120 190 Q 200 140 280 80 Q 340 40 400 15" fill="none" stroke="url(#withTrackingGrad)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glow)" className="animate-in fade-in-0 duration-1000" style={{ animationDelay: '300ms' }} />
                  
                  {/* Fill under curve */}
                  <path d="M 0 240 Q 60 220 120 190 Q 200 140 280 80 Q 340 40 400 15 L 400 300 L 0 300 Z" fill="url(#withTrackingFill)" className="animate-in fade-in-0 duration-1000" style={{ animationDelay: '300ms' }} />
                  
                  {/* Animated dot at the tip */}
                  <circle cx="400" cy="15" r="5" fill="hsl(var(--primary))" className="animate-pulse" style={{ animationDelay: '1s' }} />
                </svg>

                {/* Labels */}
                <div className="absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg animate-in fade-in-0 zoom-in-90 duration-500" style={{ top: '20%', left: '25%', animationDelay: '600ms' }}>
                  <TrendingUp className="w-3.5 h-3.5" />
                  With Jvala
                </div>
                <div className="absolute px-3 py-1.5 rounded-full bg-muted/80 text-muted-foreground text-xs font-medium animate-in fade-in-0 zoom-in-90 duration-500" style={{ bottom: '12%', left: '30%', animationDelay: '900ms' }}>
                  Without tracking
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: '73%', label: 'Users identify\na new trigger' },
                  { value: '2.4x', label: 'More data for\nyour doctor' },
                  { value: '89%', label: 'Feel more in\ncontrol' },
                ].map((stat, i) => (
                  <div key={i} className="glass-card text-center py-3 animate-in fade-in-0 duration-500" style={{ animationDelay: `${800 + i * 150}ms` }}>
                    <p className="text-lg font-bold text-primary">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground whitespace-pre-line leading-tight mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground/60">
                Let's connect your health data for the best experience.
              </p>
            </div>
          </div>
        );

      // ─── Step 7: Health Data Permission (FIRST — most important) ────────
      case 7:
        return (
          <div className="flex flex-col flex-1 px-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm mx-auto space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold">Connect Apple Health</h2>
                <p className="text-sm text-muted-foreground">
                  Heart rate, sleep & activity data help predict flares <strong>hours before they hit</strong>.
                </p>
              </div>

              {/* Permission button — TOP, always visible */}
              {isNative ? (
                <button
                  onClick={requestHealthPermission}
                  disabled={healthPermissionStatus === 'requesting' || healthPermissionStatus === 'granted'}
                  className={cn(
                    "w-full py-4 rounded-2xl text-base font-semibold transition-all press-effect flex items-center justify-center gap-2",
                    healthPermissionStatus === 'granted'
                      ? "bg-green-500/15 text-green-600 border border-green-500/20"
                      : healthPermissionStatus === 'denied' || healthPermissionStatus === 'unavailable'
                        ? "bg-muted text-muted-foreground border border-border"
                        : "bg-gradient-primary text-primary-foreground shadow-primary"
                  )}
                >
                  {healthPermissionStatus === 'requesting' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {healthPermissionStatus === 'granted' && <CheckCircle2 className="w-4 h-4" />}
                  {healthPermissionStatus === 'idle' && <Heart className="w-4 h-4" />}
                  {healthPermissionStatus === 'idle' && "Connect Apple Health"}
                  {healthPermissionStatus === 'requesting' && "Requesting..."}
                  {healthPermissionStatus === 'granted' && "✓ Health Connected"}
                  {healthPermissionStatus === 'denied' && "Denied — Enable in Settings"}
                  {healthPermissionStatus === 'unavailable' && "Not Available on This Device"}
                </button>
              ) : (
                <div className="glass-card text-center py-3 space-y-1">
                  <Activity className="w-5 h-5 text-primary mx-auto" />
                  <p className="text-xs text-muted-foreground">Available on the Jvala mobile app.</p>
                </div>
              )}

              {/* ECG visual */}
              <div className="relative w-full h-14 rounded-2xl overflow-hidden glass-card flex items-center justify-center gap-4 px-6">
                <svg viewBox="0 0 200 40" className="w-28 h-auto">
                  <path d="M 0 20 L 30 20 L 40 8 L 50 32 L 60 18 L 70 22 L 80 20 L 110 20 L 120 5 L 130 35 L 140 15 L 150 25 L 160 20 L 200 20" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" className="animate-pulse" />
                </svg>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">72</p>
                  <p className="text-[9px] text-muted-foreground">BPM</p>
                </div>
              </div>

              {/* Data points */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: '❤️', label: "Heart Rate", desc: "Detect stress spikes" },
                  { icon: '😴', label: "Sleep Quality", desc: "Sleep-flare links" },
                  { icon: '🏃', label: "Steps & Activity", desc: "Movement tracking" },
                  { icon: '🫁', label: "Blood Oxygen", desc: "Baselines" },
                ].map((item, i) => (
                  <div key={i} className="glass-card py-2.5 px-3 text-center animate-in fade-in-0 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                    <span className="text-lg">{item.icon}</span>
                    <p className="text-xs font-medium mt-0.5">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="glass-card flex items-start gap-3 bg-primary/5">
                <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  <strong>Read-only.</strong> We never write to or modify your health data.
                </p>
              </div>
            </div>
          </div>
        );

      // ─── Step 8: Location Permission ─────────────────────────────────
      case 8:
        return (
          <div className="flex flex-col flex-1 px-2 pb-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm mx-auto space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold">Enable Location</h2>
                <p className="text-sm text-muted-foreground">
                  Weather, air quality & pressure are <strong>clinically proven triggers</strong>.
                </p>
              </div>

              {/* Permission button — TOP */}
              <div className="space-y-1.5">
                <button
                  onClick={requestLocationPermission}
                  disabled={locationPermissionStatus === 'requesting' || locationPermissionStatus === 'granted'}
                  className={cn(
                    "w-full py-4 rounded-2xl text-base font-semibold transition-all press-effect flex items-center justify-center gap-2",
                    locationPermissionStatus === 'granted'
                      ? "bg-green-500/15 text-green-600 border border-green-500/20"
                      : locationPermissionStatus === 'denied'
                        ? "bg-muted text-muted-foreground border border-border"
                        : "bg-gradient-primary text-primary-foreground shadow-primary"
                  )}
                >
                  {locationPermissionStatus === 'requesting' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {locationPermissionStatus === 'granted' && <CheckCircle2 className="w-4 h-4" />}
                  {locationPermissionStatus === 'idle' && <MapPin className="w-4 h-4" />}
                  {locationPermissionStatus === 'idle' && "Allow Location Access"}
                  {locationPermissionStatus === 'requesting' && "Detecting location..."}
                  {locationPermissionStatus === 'granted' && "✓ Location Enabled"}
                  {locationPermissionStatus === 'denied' && "Denied — Enable in Settings"}
                </button>
                {locationPermissionStatus === 'idle' && (
                  <p className="text-[11px] text-center text-muted-foreground">
                    Tap <strong>"Allow While Using App"</strong> when prompted
                  </p>
                )}
                {locationPermissionStatus === 'denied' && (
                  <p className="text-[11px] text-center text-muted-foreground">
                    Enable Location in iOS Settings → Jvala, then tap again.
                  </p>
                )}
              </div>

              {/* Weather stats hero */}
              <div className="relative w-full h-14 rounded-2xl overflow-hidden glass-card flex items-center justify-center gap-5 px-6">
                <div className="text-center"><span className="text-lg">🌤️</span><p className="text-[9px] text-muted-foreground">72°F</p></div>
                <div className="h-8 w-px bg-border/30" />
                <div className="text-center"><p className="text-sm font-bold text-primary">AQI 42</p><p className="text-[9px] text-muted-foreground">Good</p></div>
                <div className="h-8 w-px bg-border/30" />
                <div className="text-center"><p className="text-sm font-bold">1013</p><p className="text-[9px] text-muted-foreground">hPa</p></div>
              </div>

              {/* What we track */}
              <div className="space-y-1.5">
                {[
                  { icon: '🌡️', label: "Weather & Temperature", desc: "Temperature swings trigger 40% of migraines" },
                  { icon: '💨', label: "Air Quality (AQI)", desc: "Pollution correlates with inflammation" },
                  { icon: '🌿', label: "Pollen Levels", desc: "Seasonal allergy & flare triggers" },
                  { icon: '📊', label: "Barometric Pressure", desc: "Pressure drops = joint pain trigger" },
                ].map((item, i) => (
                  <div key={i} className="glass-card flex items-center gap-3 py-2.5 animate-in fade-in-0 duration-300" style={{ animationDelay: `${i * 80}ms` }}>
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="glass-card flex items-start gap-3 bg-primary/5">
                <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  <strong>City-level only.</strong> We never track your precise location.
                </p>
              </div>
            </div>
          </div>
        );

      // ─── Step 9: Notifications Permission (LAST — with reasoning) ──────
      case 9:
        return (
          <div className="flex flex-col flex-1 px-2 pb-2 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="w-full max-w-sm mx-auto space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold">One Last Thing</h2>
                <p className="text-sm text-muted-foreground">
                  Stay ahead of flares with <strong>context-aware</strong> notifications.
                </p>
              </div>

              {/* Permission button — TOP */}
              <button
                onClick={requestNotificationPermission}
                disabled={notificationPermissionStatus === 'requesting' || notificationPermissionStatus === 'granted'}
                className={cn(
                  "w-full py-4 rounded-2xl text-base font-semibold transition-all press-effect flex items-center justify-center gap-2",
                  notificationPermissionStatus === 'granted'
                    ? "bg-green-500/15 text-green-600 border border-green-500/20"
                    : notificationPermissionStatus === 'denied'
                      ? "bg-muted text-muted-foreground border border-border"
                      : "bg-gradient-primary text-primary-foreground shadow-primary"
                )}
              >
                {notificationPermissionStatus === 'requesting' && <Loader2 className="w-4 h-4 animate-spin" />}
                {notificationPermissionStatus === 'granted' && <CheckCircle2 className="w-4 h-4" />}
                {notificationPermissionStatus === 'idle' && <Bell className="w-4 h-4" />}
                {notificationPermissionStatus === 'idle' && "Allow Notifications"}
                {notificationPermissionStatus === 'requesting' && "Requesting..."}
                {notificationPermissionStatus === 'granted' && "✓ Notifications Enabled"}
                {notificationPermissionStatus === 'denied' && "Denied — Enable in Settings"}
              </button>

              {/* Notification preview */}
              <div className="relative w-full rounded-2xl overflow-hidden glass-card p-2.5 space-y-1.5">
                {[
                  { time: '9:00 AM', title: '☀️ Morning Check-in', body: 'Quick log to start the day.' },
                  { time: '2:15 PM', title: '⚠️ Pressure Drop', body: 'Barometric pressure dropped — your #1 trigger.' },
                ].map((notif, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-xl bg-background/60 border border-border/30 animate-in fade-in-0 duration-500" style={{ animationDelay: `${i * 200}ms` }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold">{notif.title}</p>
                        <span className="text-[9px] text-muted-foreground">{notif.time}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{notif.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* What notifications do */}
              <div className="space-y-1.5">
                {[
                  { icon: '🌅', label: "Morning & evening check-ins", desc: "Gentle reminders on your schedule" },
                  { icon: '🔄', label: "Post-flare follow-ups", desc: "Track recovery 2h and 6h after" },
                  { icon: '🌡️', label: "Environmental alerts", desc: "Weather shifts that may trigger symptoms" },
                  { icon: '🔥', label: "Streak celebrations", desc: "Stay motivated with milestones" },
                ].map((item, i) => (
                  <div key={i} className="glass-card flex items-center gap-3 py-2.5">
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="glass-card flex items-start gap-3 bg-primary/5">
                <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed break-words">
                  Customize timing in Settings. Notifications stay context-aware.
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
        {step === TOTAL_STEPS - 1 ? (
          /* Slide-to-launch button */
          <div 
            ref={slideRef}
            className="relative w-full h-16 rounded-2xl overflow-hidden bg-gradient-primary shadow-primary"
            onTouchStart={(e) => {
              slidingRef.current = true;
              setSlideProgress(0);
              haptics.medium();
              // Start continuous haptic interval
              hapticIntervalRef.current = window.setInterval(() => {
                if (slidingRef.current) haptics.light();
              }, 80);
            }}
            onTouchMove={(e) => {
              if (!slidingRef.current || !slideRef.current) return;
              const touch = e.touches[0];
              const rect = slideRef.current.getBoundingClientRect();
              const x = touch.clientX - rect.left;
              const maxSlide = rect.width - 64;
              const progress = Math.max(0, Math.min(1, (x - 32) / maxSlide));
              setSlideProgress(progress);
              
              // Intensifying haptics as you slide further
              if (progress > 0.5 && progress < 0.52) haptics.medium();
              if (progress > 0.75 && progress < 0.77) haptics.heavy();
            }}
            onTouchEnd={() => {
              slidingRef.current = false;
              if (hapticIntervalRef.current) {
                clearInterval(hapticIntervalRef.current);
                hapticIntervalRef.current = null;
              }
              if (slideProgress > 0.85) {
                haptics.success();
                setTimeout(() => haptics.heavy(), 100);
                setTimeout(() => haptics.success(), 250);
                handleNext();
              } else {
                setSlideProgress(0);
                haptics.light();
              }
            }}
          >
            {/* Track background text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-primary-foreground/60 text-sm font-semibold" style={{ opacity: 1 - slideProgress }}>
                Slide to Launch Jvala →
              </span>
            </div>
            
            {/* Sliding thumb */}
            <div 
              className="absolute top-2 left-2 w-12 h-12 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center transition-none shadow-lg"
              style={{ 
                transform: `translateX(${slideProgress * ((slideRef.current?.offsetWidth ?? 300) - 64)}px)`,
                background: slideProgress > 0.85 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
              }}
            >
              <Sparkles className={cn("w-5 h-5 text-primary-foreground", slideProgress > 0.5 && "animate-pulse")} />
            </div>

            {/* Success glow */}
            {slideProgress > 0.85 && (
              <div className="absolute inset-0 bg-white/10 animate-pulse" />
            )}
          </div>
        ) : (
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
            {step === 0 ? "Let's Get Started" : "Continue"}
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {(step === 3 ||
          step === 4 ||
          step === 5 ||
          step === 9 ||
          (step === 7 && healthPermissionStatus !== 'granted') ||
          (step === 8 && locationPermissionStatus !== 'granted')) && (
          <button
            onClick={() => { haptics.light(); handleNext(); }}
            className="w-full mt-2 py-2 text-sm text-muted-foreground"
          >
            {step === 9 ? "Skip — I'll enable later" : "Skip for now"}
          </button>
        )}
      </div>
    </div>
  );
};
