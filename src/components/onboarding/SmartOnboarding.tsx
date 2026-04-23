import { useEffect, useMemo, useRef, useState } from "react";
import jvalaLogo from "@/assets/jvala-logo.png";
import {
  Bell,
  Check,
  ChevronLeft,
  Heart,
  Loader2,
  MapPin,
  Pill,
  Plus,
  Search,
  Shield,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { CONDITIONS } from "@/data/conditions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { isNative } from "@/lib/capacitor";

type PermissionState = "idle" | "requesting" | "granted" | "denied" | "unavailable";

interface SmartOnboardingData {
  firstName: string;
  conditions: string[];
  customConditions: string[];
  dateOfBirth: string;
  biologicalSex: string | null;
  enableReminders: boolean;
  reminderTimes: string[];
  aiLogCategories: any[];
  knownSymptoms: string[];
  knownTriggers: string[];
  medications: { name: string; dosage?: string }[];
  notificationsEnabled: boolean;
  locationEnabled: boolean;
  healthConnected: boolean;
}

interface SmartOnboardingProps {
  onComplete: (data: SmartOnboardingData) => void | Promise<void>;
}

const TOTAL_STEPS = 10;

const SEX_OPTIONS = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "intersex", label: "Intersex" },
  { id: "prefer-not-to-say", label: "Prefer not to say" },
];

const calculateAge = (dob: string) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
};

export const SmartOnboarding = ({ onComplete }: SmartOnboardingProps) => {
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [conditionQuery, setConditionQuery] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [customConditions, setCustomConditions] = useState<string[]>([]);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [biologicalSex, setBiologicalSex] = useState<string | null>(null);
  const [enableReminders, setEnableReminders] = useState(true);
  const [morningReminder, setMorningReminder] = useState("09:00");
  const [eveningReminder, setEveningReminder] = useState("20:00");
  const [healthPermissionStatus, setHealthPermissionStatus] = useState<PermissionState>("idle");
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<PermissionState>("idle");
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<PermissionState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const healthRequestInFlightRef = useRef(false);
  const locationRequestInFlightRef = useRef(false);
  const autofillRef = useRef(false);

  // Step 3: AI symptom research
  const [isResearching, setIsResearching] = useState(false);
  const [suggestedSymptoms, setSuggestedSymptoms] = useState<string[]>([]);
  const [suggestedTriggers, setSuggestedTriggers] = useState<string[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [aiLogCategories, setAiLogCategories] = useState<any[]>([]);
  const researchDoneRef = useRef(false);

  // Step 4: Medications
  const [medications, setMedications] = useState<{ name: string; dosage?: string }[]>([]);
  const [medQuery, setMedQuery] = useState("");

  // Step 9: Rating
  const [rating, setRating] = useState<number | null>(null);

  // Autofill name from OAuth
  useEffect(() => {
    if (autofillRef.current || firstName) return;
    autofillRef.current = true;
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const meta = user.user_metadata ?? {};
        const derivedName = meta.given_name || meta.first_name || (meta.full_name || meta.name || "").split(" ")[0] || "";
        if (derivedName) setFirstName(derivedName);
      } catch { /* ignore */ }
    })();
  }, [firstName]);

  const totalSelectedConditions = conditions.length + customConditions.length;
  const normalizedSelectedConditions = useMemo(
    () => [...conditions, ...customConditions],
    [conditions, customConditions],
  );

  const filteredConditions = useMemo(() => {
    const query = conditionQuery.trim().toLowerCase();
    if (!query) return CONDITIONS.slice(0, 18);
    return CONDITIONS.filter((c) => {
      if (conditions.includes(c.id)) return false;
      return c.name.toLowerCase().includes(query) || c.category.toLowerCase().includes(query);
    }).slice(0, 18);
  }, [conditionQuery, conditions]);

  const age = calculateAge(dateOfBirth);
  const birthDateInvalid = Boolean(dateOfBirth) && (age === null || age < 13 || new Date(dateOfBirth) > new Date());

  const addCondition = (conditionId: string) => {
    haptics.selection();
    setConditions((prev) => (prev.includes(conditionId) ? prev : [...prev, conditionId]));
    setConditionQuery("");
  };

  const addTypedCondition = () => {
    const trimmed = conditionQuery.trim();
    if (!trimmed) return;
    const matching = CONDITIONS.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (matching) { addCondition(matching.id); return; }
    if (customConditions.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
    haptics.selection();
    setCustomConditions((prev) => [...prev, trimmed]);
    setConditionQuery("");
  };

  const removeCondition = (value: string) => {
    haptics.selection();
    setConditions((prev) => prev.filter((i) => i !== value));
    setCustomConditions((prev) => prev.filter((i) => i !== value));
  };

  // ── Permission helpers ──

  const withPermissionTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    });
    try { return await Promise.race([promise, timeoutPromise]); } finally { if (timeoutId) window.clearTimeout(timeoutId); }
  };

  const isLocationGranted = (s: any) => s?.location === "granted" || s?.coarseLocation === "granted";
  const isLocationDenied = (s: any) => s?.location === "denied" || s?.coarseLocation === "denied";
  const classifyLocationError = (error: unknown): "denied" | "services_off" | "unknown" => {
    const msg = (error instanceof Error ? error.message : String(error)).toUpperCase();
    if (msg.includes("OS-PLUG-GLOC-0003")) return "denied";
    if (msg.includes("OS-PLUG-GLOC-0007") || msg.includes("OS-PLUG-GLOC-0008")) return "services_off";
    return "unknown";
  };
  const getNativeGeolocation = async () => {
    const injected = (window as any)?.Capacitor?.Plugins?.Geolocation;
    if (injected) return injected;
    const { Geolocation } = await import("@capacitor/geolocation");
    return Geolocation;
  };

  const requestHealthPermission = async () => {
    if (healthRequestInFlightRef.current) return;
    healthRequestInFlightRef.current = true;
    setHealthPermissionStatus("requesting");
    haptics.selection();
    const watchdogId = window.setTimeout(() => { if (healthRequestInFlightRef.current) { healthRequestInFlightRef.current = false; setHealthPermissionStatus("denied"); } }, 35000);
    try {
      if (!isNative) { setHealthPermissionStatus("unavailable"); return; }
      const { isHealthPluginPresent, HEALTH_MINIMAL_READ, HEALTH_FULL_READ, checkHealthPermissions, requestHealthPermissions } = await import("@/services/appleHealthService");
      const injectedHealth = (window as any)?.Capacitor?.Plugins?.Health ?? null;
      if (!isHealthPluginPresent() && !injectedHealth) { setHealthPermissionStatus("unavailable"); return; }
      const requestReadScopes = async (read: string[], label: string) => {
        if (injectedHealth && typeof injectedHealth.requestAuthorization === "function") {
          const status = await withPermissionTimeout(injectedHealth.requestAuthorization({ read, write: [] }), 25000, label) as any;
          return Array.isArray(status?.readAuthorized) ? status.readAuthorized.length : 0;
        }
        const result = await withPermissionTimeout(requestHealthPermissions({ read: read as any }), 25000, `${label}_service`);
        return Array.isArray(result?.status?.readAuthorized) ? result.status.readAuthorized.length : 0;
      };
      let fullCount = 0;
      try { fullCount = await requestReadScopes(HEALTH_FULL_READ, "health_full"); } catch { fullCount = 0; }
      let minCount = 0;
      if (fullCount === 0) { try { minCount = await requestReadScopes(HEALTH_MINIMAL_READ, "health_min"); } catch { minCount = 0; } }
      let verified = false;
      try { verified = await withPermissionTimeout(checkHealthPermissions({ read: HEALTH_MINIMAL_READ }), 9000, "health_check"); } catch { verified = false; }
      if (fullCount === 0 && minCount === 0 && !verified) { setHealthPermissionStatus("denied"); return; }
      setHealthPermissionStatus("granted"); haptics.success();
    } catch { setHealthPermissionStatus("denied"); } finally { healthRequestInFlightRef.current = false; window.clearTimeout(watchdogId); }
  };

  const requestLocationPermission = async () => {
    if (locationRequestInFlightRef.current) return;
    locationRequestInFlightRef.current = true;
    setLocationPermissionStatus("requesting");
    haptics.selection();
    try {
      if (isNative) {
        const Geo = await getNativeGeolocation();
        try { await withPermissionTimeout(Geo.getCurrentPosition({ timeout: 12000, enableHighAccuracy: false, maximumAge: 0 }), 14000, "loc_get"); setLocationPermissionStatus("granted"); haptics.success(); return; } catch (e) { if (classifyLocationError(e) === "services_off") { setLocationPermissionStatus("denied"); return; } }
        let requested: any = null;
        try { requested = await withPermissionTimeout(Geo.requestPermissions({ permissions: ["location"] as any }), 25000, "loc_req"); } catch { requested = await withPermissionTimeout(Geo.requestPermissions(), 25000, "loc_req2"); }
        if (isLocationGranted(requested)) { setLocationPermissionStatus("granted"); haptics.success(); return; }
        setLocationPermissionStatus(isLocationDenied(requested) ? "denied" : "idle"); return;
      }
      await new Promise<GeolocationPosition>((resolve, reject) => { navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }); });
      setLocationPermissionStatus("granted"); haptics.success();
    } catch (e) { const k = classifyLocationError(e); setLocationPermissionStatus(k === "denied" || k === "services_off" ? "denied" : "idle"); } finally { locationRequestInFlightRef.current = false; }
  };

  const requestNotificationPermission = async () => {
    setNotificationPermissionStatus("requesting"); haptics.selection();
    try {
      if (isNative) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const result = await PushNotifications.requestPermissions();
        if (result.receive === "granted") { await PushNotifications.register(); setNotificationPermissionStatus("granted"); haptics.success(); } else { setNotificationPermissionStatus("denied"); }
        return;
      }
      if (!("Notification" in window)) { setNotificationPermissionStatus("unavailable"); return; }
      const result = await Notification.requestPermission();
      setNotificationPermissionStatus(result === "granted" ? "granted" : "denied");
      if (result === "granted") haptics.success();
    } catch { setNotificationPermissionStatus("denied"); }
  };

  // ── AI Research (triggered when entering step 3) ──
  const runResearch = async () => {
    if (researchDoneRef.current || normalizedSelectedConditions.length === 0) return;
    researchDoneRef.current = true;
    setIsResearching(true);
    try {
      const conditionNames = normalizedSelectedConditions.map((v) => CONDITIONS.find((c) => c.id === v)?.name || v);
      const { data, error } = await supabase.functions.invoke("generate-suggestions", {
        body: { conditions: conditionNames, biologicalSex, age },
      });
      if (!error && data) {
        const symptoms = data.symptoms || [];
        const triggers = data.triggers || [];
        setSuggestedSymptoms(symptoms);
        setSuggestedTriggers(triggers);
        setSelectedSymptoms(symptoms); // pre-select all
        setSelectedTriggers(triggers);
        setAiLogCategories(data.logCategories || []);
      }
    } catch (e) {
      console.error("Research failed:", e);
    } finally {
      setIsResearching(false);
    }
  };

  useEffect(() => {
    if (step === 3 && !researchDoneRef.current) {
      void runResearch();
    }
  }, [step]);

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };
  const toggleTrigger = (t: string) => {
    setSelectedTriggers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };
  const addCustomSymptom = () => {
    const trimmed = customSymptom.trim();
    if (!trimmed) return;
    if (!selectedSymptoms.includes(trimmed)) setSelectedSymptoms((prev) => [...prev, trimmed]);
    if (!suggestedSymptoms.includes(trimmed)) setSuggestedSymptoms((prev) => [...prev, trimmed]);
    setCustomSymptom("");
  };

  const addMedication = () => {
    const trimmed = medQuery.trim();
    if (!trimmed) return;
    if (medications.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) return;
    haptics.selection();
    setMedications((prev) => [...prev, { name: trimmed }]);
    setMedQuery("");
  };

  const removeMedication = (name: string) => {
    haptics.selection();
    setMedications((prev) => prev.filter((m) => m.name !== name));
  };

  // ── Step validation ──
  const stepCanContinue = () => {
    switch (step) {
      case 1: return firstName.trim().length > 0;
      case 2: return totalSelectedConditions > 0;
      case 3: return !isResearching; // can continue once research done
      case 4: return true; // meds are optional
      case 5: return Boolean(biologicalSex) && Boolean(dateOfBirth) && !birthDateInvalid;
      case 6: return healthPermissionStatus === "granted" || healthPermissionStatus === "unavailable";
      case 7: return locationPermissionStatus === "granted";
      case 8: return notificationPermissionStatus === "granted" || notificationPermissionStatus === "denied" || notificationPermissionStatus === "unavailable";
      default: return true;
    }
  };

  const goNext = async () => {
    if (step === TOTAL_STEPS - 1) {
      setSubmitting(true);
      try {
        await Promise.resolve(
          onComplete({
            firstName: firstName.trim(),
            conditions,
            customConditions,
            dateOfBirth,
            biologicalSex,
            enableReminders,
            reminderTimes: enableReminders ? [morningReminder, eveningReminder] : [],
            aiLogCategories,
            knownSymptoms: selectedSymptoms,
            knownTriggers: selectedTriggers,
            medications,
            notificationsEnabled: notificationPermissionStatus === "granted",
            locationEnabled: locationPermissionStatus === "granted",
            healthConnected: healthPermissionStatus === "granted",
          }),
        );
      } finally { setSubmitting(false); }
      return;
    }
    haptics.selection();
    setStep((prev) => prev + 1);
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  // ── Shared UI shells ──
  const StepShell = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
    <div className="flex min-h-full flex-col px-6 pb-6 pt-8">
      <div className="mb-6 flex items-center justify-center">
        <img src={jvalaLogo} alt="Jvala" className="h-12 w-12 object-contain" />
      </div>
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );

  const PermissionCard = ({ icon: Icon, title, body, status, onRequest, buttonLabel }: {
    icon: typeof Heart; title: string; body: string; status: PermissionState; onRequest: () => void | Promise<void>; buttonLabel: string;
  }) => (
    <div className="rounded-3xl border border-border bg-card px-5 py-5 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className={cn(
          "rounded-full px-3 py-1 text-xs font-medium",
          status === "granted" && "bg-primary/10 text-primary",
          status === "denied" && "bg-destructive/10 text-destructive",
          status === "requesting" && "bg-muted text-muted-foreground",
          status === "idle" && "bg-secondary text-secondary-foreground",
          status === "unavailable" && "bg-accent text-accent-foreground",
        )}>
          {status === "granted" ? "Connected" : status === "denied" ? "Not granted" : status === "requesting" ? "Requesting…" : status === "unavailable" ? "Unavailable" : "Not set"}
        </span>
        <button type="button" onClick={() => void onRequest()} disabled={status === "requesting"}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50">
          {status === "requesting" ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      {/* Progress bar */}
      <div className="px-6 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="mb-4 flex items-center gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => { if (step === 3) researchDoneRef.current = false; setStep((prev) => Math.max(prev - 1, 0)); }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : <div className="h-10 w-10" />}
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <StepShell title="Welcome to Jvala" subtitle="Track symptoms fast. Spot patterns. Build reports your doctor can actually use.">
            <div className="space-y-3">
              {["⚡ Log in seconds, not minutes", "📊 AI-powered pattern detection", "🩺 Medical-grade exports"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
                  <span className="text-base">{item.slice(0, 2)}</span>
                  <span className="text-sm font-medium text-foreground">{item.slice(3)}</span>
                </div>
              ))}
            </div>
          </StepShell>
        )}

        {/* Step 1: Name */}
        {step === 1 && (
          <StepShell title="What should we call you?" subtitle="Used in the app and by your AI health companion.">
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoFocus
              className="h-14 w-full rounded-2xl border border-border bg-card px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
          </StepShell>
        )}

        {/* Step 2: Conditions */}
        {step === 2 && (
          <StepShell title="What are you tracking?" subtitle="Type anything — a condition, symptom cluster, or just something you want to monitor.">
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={conditionQuery} onChange={(e) => setConditionQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTypedCondition(); } }}
                  placeholder="Type and press Enter to add"
                  className="h-14 w-full rounded-2xl border border-border bg-card pl-11 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
                <button type="button" onClick={addTypedCondition}
                  className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {normalizedSelectedConditions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {normalizedSelectedConditions.map((v) => {
                    const label = CONDITIONS.find((c) => c.id === v)?.name || v;
                    return (
                      <button key={v} type="button" onClick={() => removeCondition(v)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                        {label} <X className="h-3 w-3" />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Suggestions</p>
                <div className="grid gap-1.5 max-h-[40vh] overflow-y-auto">
                  {filteredConditions.map((c) => (
                    <button key={c.id} type="button" onClick={() => addCondition(c.id)}
                      className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40">
                      <div>
                        <div className="text-sm font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.category}</div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {/* Step 3: AI Symptom Research */}
        {step === 3 && (
          <StepShell title="Your tracking profile" subtitle="We researched your conditions. Confirm the symptoms and triggers you experience.">
            {isResearching ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
                  <Sparkles className="h-7 w-7 text-primary animate-pulse" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Researching your conditions…</p>
                <p className="text-xs text-muted-foreground">Building personalized symptom and trigger lists</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Symptoms */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Symptoms <span className="font-normal text-muted-foreground">— tap to toggle</span></p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedSymptoms.map((s) => (
                      <button key={s} type="button" onClick={() => toggleSymptom(s)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          selectedSymptoms.includes(s) ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                        )}>
                        {selectedSymptoms.includes(s) && <Check className="mr-1 inline h-3 w-3" />}
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={customSymptom} onChange={(e) => setCustomSymptom(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSymptom(); } }}
                      placeholder="Add your own"
                      className="h-10 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
                    <button type="button" onClick={addCustomSymptom} className="h-10 rounded-xl bg-primary/10 px-3 text-primary">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Triggers */}
                {suggestedTriggers.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">Common triggers</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedTriggers.map((t) => (
                        <button key={t} type="button" onClick={() => toggleTrigger(t)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                            selectedTriggers.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                          )}>
                          {selectedTriggers.includes(t) && <Check className="mr-1 inline h-3 w-3" />}
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </StepShell>
        )}

        {/* Step 4: Medications */}
        {step === 4 && (
          <StepShell title="Current medications" subtitle="Add any medications you're currently taking. You can skip this and add later.">
            <div className="space-y-4">
              <div className="relative">
                <Pill className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={medQuery} onChange={(e) => setMedQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMedication(); } }}
                  placeholder="Type medication name"
                  className="h-14 w-full rounded-2xl border border-border bg-card pl-11 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
                <button type="button" onClick={addMedication}
                  className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {medications.length > 0 && (
                <div className="space-y-2">
                  {medications.map((med) => (
                    <div key={med.name} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                          <Pill className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{med.name}</span>
                      </div>
                      <button type="button" onClick={() => removeMedication(med.name)} className="text-muted-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {medications.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No medications added yet. You can skip this step.</p>
              )}
            </div>
          </StepShell>
        )}

        {/* Step 5: Profile context (DOB + Sex) */}
        {step === 5 && (
          <StepShell title="A little about you" subtitle="Helps personalize trend analysis and AI insights.">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <label className="mb-2 block text-sm font-medium text-foreground">Date of birth</label>
                <input type="date" value={dateOfBirth} max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-primary" />
                {birthDateInvalid && <p className="mt-2 text-sm text-destructive">Must be 13 or older.</p>}
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-3 text-sm font-medium text-foreground">Biological sex</p>
                <div className="grid grid-cols-2 gap-2">
                  {SEX_OPTIONS.map((opt) => (
                    <button key={opt.id} type="button" onClick={() => { haptics.selection(); setBiologicalSex(opt.id); }}
                      className={cn("rounded-2xl border px-4 py-3 text-sm font-medium transition-colors",
                        biologicalSex === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {/* Step 6: Apple Health */}
        {step === 6 && (
          <StepShell title="Connect Apple Health" subtitle="Attach wearable context to every log automatically.">
            <PermissionCard icon={Heart} title="Health data" body="Read-only access for metrics used in tracking and trend analysis."
              status={healthPermissionStatus} onRequest={requestHealthPermission} buttonLabel="Connect" />
          </StepShell>
        )}

        {/* Step 7: Location */}
        {step === 7 && (
          <StepShell title="Enable location" subtitle="City-level location adds weather and environmental signals to each log.">
            <PermissionCard icon={MapPin} title="Location" body="Improves environmental correlations and quick-log context."
              status={locationPermissionStatus} onRequest={requestLocationPermission} buttonLabel="Allow" />
          </StepShell>
        )}

        {/* Step 8: Notifications */}
        {step === 8 && (
          <StepShell title="Notifications" subtitle="Get streak reminders and follow-up nudges.">
            <PermissionCard icon={Bell} title="Daily reminders" body="You can change this anytime in Settings."
              status={notificationPermissionStatus} onRequest={requestNotificationPermission} buttonLabel="Enable" />
          </StepShell>
        )}

        {/* Step 9: Reminders + Rating */}
        {step === 9 && (
          <StepShell title="Final setup" subtitle="Set your reminder times and let us know how setup went.">
            <div className="space-y-5">
              {/* Reminders */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <button type="button" onClick={() => setEnableReminders((p) => !p)}
                  className="flex w-full items-center justify-between text-left">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Daily reminders</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{enableReminders ? "Morning + evening" : "Off"}</p>
                  </div>
                  <div className={cn("flex h-6 w-11 items-center rounded-full p-1 transition-colors", enableReminders ? "bg-primary" : "bg-muted")}>
                    <div className={cn("h-4 w-4 rounded-full bg-background transition-transform", enableReminders ? "translate-x-5" : "translate-x-0")} />
                  </div>
                </button>
              </div>

              {enableReminders && (
                <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-foreground">Morning</span>
                    <input type="time" value={morningReminder} onChange={(e) => setMorningReminder(e.target.value)}
                      className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-primary" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-foreground">Evening</span>
                    <input type="time" value={eveningReminder} onChange={(e) => setEveningReminder(e.target.value)}
                      className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-primary" />
                  </label>
                </div>
              )}

              {/* Rating */}
              <div className="rounded-2xl border border-border bg-card p-4 text-center">
                <p className="text-sm font-semibold text-foreground mb-1">How was the setup?</p>
                <p className="text-xs text-muted-foreground mb-3">Your feedback helps us improve</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => { haptics.selection(); setRating(n); }}
                      className="p-1 transition-transform hover:scale-110">
                      <Star className={cn("h-7 w-7 transition-colors", rating !== null && n <= rating ? "fill-primary text-primary" : "text-muted-foreground/30")} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Ready card */}
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">You're all set</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Jvala will use your profile, conditions, and permissions to personalize everything from day one.
                  </p>
                </div>
              </div>
            </div>
          </StepShell>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
        <button type="button" onClick={() => void goNext()} disabled={!stepCanContinue() || submitting}
          className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-40">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : step === TOTAL_STEPS - 1 ? "Start tracking" : "Continue"}
        </button>
        {step === 4 && medications.length === 0 && (
          <button type="button" onClick={() => { haptics.selection(); setStep(5); }}
            className="mt-2 w-full text-center text-sm font-medium text-muted-foreground">
            Skip for now
          </button>
        )}
        {(step === 6 || step === 7 || step === 8) && (
          <button type="button" onClick={() => { haptics.selection(); setStep((p) => p + 1); }}
            className="mt-2 w-full text-center text-sm font-medium text-muted-foreground">
            Skip
          </button>
        )}
      </div>
    </div>
  );
};
