import { useEffect, useMemo, useRef, useState } from "react";
import jvalaLogo from "@/assets/jvala-logo.png";
import {
  Bell,
  Check,
  ChevronLeft,
  Heart,
  Loader2,
  MapPin,
  Plus,
  Search,
  Shield,
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
  notificationsEnabled: boolean;
  locationEnabled: boolean;
  healthConnected: boolean;
}

interface SmartOnboardingProps {
  onComplete: (data: SmartOnboardingData) => void | Promise<void>;
}

const TOTAL_STEPS = 8;

const SEX_OPTIONS = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "intersex", label: "Intersex" },
  { id: "prefer-not-to-say", label: "Prefer not to say" },
];

const valueProps = [
  "Track symptoms fast.",
  "Spot flare patterns.",
  "Build cleaner reports.",
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
  const [valuePropIndex, setValuePropIndex] = useState(0);
  const healthRequestInFlightRef = useRef(false);
  const locationRequestInFlightRef = useRef(false);
  const autofillRef = useRef(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setValuePropIndex((prev) => (prev + 1) % valueProps.length);
    }, 2400);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autofillRef.current || firstName) return;
    autofillRef.current = true;

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const meta = user.user_metadata ?? {};
        const derivedName =
          meta.given_name ||
          meta.first_name ||
          (meta.full_name || meta.name || "").split(" ")[0] ||
          "";
        if (derivedName) setFirstName(derivedName);
      } catch {
        return;
      }
    })();
  }, [firstName]);

  const totalSelectedConditions = conditions.length + customConditions.length;
  const normalizedSelectedConditions = useMemo(
    () => [
      ...conditions,
      ...customConditions,
    ],
    [conditions, customConditions],
  );

  const filteredConditions = useMemo(() => {
    const query = conditionQuery.trim().toLowerCase();
    if (!query) return CONDITIONS.slice(0, 18);
    return CONDITIONS.filter((condition) => {
      const alreadySelected = conditions.includes(condition.id);
      if (alreadySelected) return false;
      return (
        condition.name.toLowerCase().includes(query) ||
        condition.category.toLowerCase().includes(query)
      );
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

    const matchingCondition = CONDITIONS.find((condition) => condition.name.toLowerCase() === trimmed.toLowerCase());
    if (matchingCondition) {
      addCondition(matchingCondition.id);
      return;
    }

    if (customConditions.some((condition) => condition.toLowerCase() === trimmed.toLowerCase())) return;

    haptics.selection();
    setCustomConditions((prev) => [...prev, trimmed]);
    setConditionQuery("");
  };

  const removeCondition = (value: string) => {
    haptics.selection();
    setConditions((prev) => prev.filter((item) => item !== value));
    setCustomConditions((prev) => prev.filter((item) => item !== value));
  };

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

  const isLocationGranted = (permStatus: { location?: string; coarseLocation?: string } | null | undefined) =>
    permStatus?.location === "granted" || permStatus?.coarseLocation === "granted";

  const isLocationDenied = (permStatus: { location?: string; coarseLocation?: string } | null | undefined) =>
    permStatus?.location === "denied" || permStatus?.coarseLocation === "denied";

  const classifyLocationError = (error: unknown): "denied" | "services_off" | "unknown" => {
    const message = (error instanceof Error ? error.message : String(error)).toUpperCase();
    if (message.includes("OS-PLUG-GLOC-0003")) return "denied";
    if (message.includes("OS-PLUG-GLOC-0007") || message.includes("OS-PLUG-GLOC-0008")) return "services_off";
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

    const watchdogId = window.setTimeout(() => {
      if (!healthRequestInFlightRef.current) return;
      healthRequestInFlightRef.current = false;
      setHealthPermissionStatus("denied");
    }, 35000);

    try {
      if (!isNative) {
        setHealthPermissionStatus("unavailable");
        return;
      }

      const {
        isHealthPluginPresent,
        HEALTH_MINIMAL_READ,
        HEALTH_FULL_READ,
        checkHealthPermissions,
        requestHealthPermissions,
      } = await import("@/services/appleHealthService");

      const injectedHealth = (window as any)?.Capacitor?.Plugins?.Health ?? null;
      if (!isHealthPluginPresent() && !injectedHealth) {
        setHealthPermissionStatus("unavailable");
        return;
      }

      const requestReadScopes = async (read: string[], label: string) => {
        if (injectedHealth && typeof injectedHealth.requestAuthorization === "function") {
          const status = await withPermissionTimeout(
            injectedHealth.requestAuthorization({ read, write: [] }),
            25000,
            label,
          ) as { readAuthorized?: string[] };
          return Array.isArray(status?.readAuthorized) ? status.readAuthorized.length : 0;
        }

        const result = await withPermissionTimeout(
          requestHealthPermissions({ read: read as any }),
          25000,
          `${label}_service`,
        );

        return Array.isArray(result?.status?.readAuthorized) ? result.status.readAuthorized.length : 0;
      };

      let fullAuthorizedCount = 0;
      try {
        fullAuthorizedCount = await requestReadScopes(HEALTH_FULL_READ, "health_request_full");
      } catch {
        fullAuthorizedCount = 0;
      }

      let minimalAuthorizedCount = 0;
      if (fullAuthorizedCount === 0) {
        try {
          minimalAuthorizedCount = await requestReadScopes(HEALTH_MINIMAL_READ, "health_request_minimal");
        } catch {
          minimalAuthorizedCount = 0;
        }
      }

      let verifiedMinimal = false;
      try {
        verifiedMinimal = await withPermissionTimeout(
          checkHealthPermissions({ read: HEALTH_MINIMAL_READ }),
          9000,
          "health_check_after",
        );
      } catch {
        verifiedMinimal = false;
      }

      if (fullAuthorizedCount === 0 && minimalAuthorizedCount === 0 && !verifiedMinimal) {
        setHealthPermissionStatus("denied");
        return;
      }

      setHealthPermissionStatus("granted");
      haptics.success();
    } catch {
      setHealthPermissionStatus("denied");
    } finally {
      healthRequestInFlightRef.current = false;
      window.clearTimeout(watchdogId);
    }
  };

  const requestLocationPermission = async () => {
    if (locationRequestInFlightRef.current) return;
    locationRequestInFlightRef.current = true;
    setLocationPermissionStatus("requesting");
    haptics.selection();

    try {
      if (isNative) {
        const Geolocation = await getNativeGeolocation();
        try {
          await withPermissionTimeout(
            Geolocation.getCurrentPosition({ timeout: 12000, enableHighAccuracy: false, maximumAge: 0 }),
            14000,
            "location_get_current_direct",
          );
          setLocationPermissionStatus("granted");
          haptics.success();
          return;
        } catch (error) {
          const kind = classifyLocationError(error);
          if (kind === "services_off") {
            setLocationPermissionStatus("denied");
            return;
          }
        }

        let requested: { location?: string; coarseLocation?: string } | null = null;
        try {
          requested = await withPermissionTimeout(
            Geolocation.requestPermissions({ permissions: ["location"] as any }),
            25000,
            "location_request_explicit",
          );
        } catch {
          requested = await withPermissionTimeout(
            Geolocation.requestPermissions(),
            25000,
            "location_request_default",
          );
        }

        if (isLocationGranted(requested)) {
          setLocationPermissionStatus("granted");
          haptics.success();
          return;
        }

        setLocationPermissionStatus(isLocationDenied(requested) ? "denied" : "idle");
        return;
      }

      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 0,
        });
      });
      setLocationPermissionStatus("granted");
      haptics.success();
    } catch (error) {
      const kind = classifyLocationError(error);
      setLocationPermissionStatus(kind === "denied" || kind === "services_off" ? "denied" : "idle");
    } finally {
      locationRequestInFlightRef.current = false;
    }
  };

  const requestNotificationPermission = async () => {
    setNotificationPermissionStatus("requesting");
    haptics.selection();

    try {
      if (isNative) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const result = await PushNotifications.requestPermissions();
        if (result.receive === "granted") {
          await PushNotifications.register();
          setNotificationPermissionStatus("granted");
          haptics.success();
        } else {
          setNotificationPermissionStatus("denied");
        }
        return;
      }

      if (!("Notification" in window)) {
        setNotificationPermissionStatus("unavailable");
        return;
      }

      const result = await Notification.requestPermission();
      setNotificationPermissionStatus(result === "granted" ? "granted" : "denied");
      if (result === "granted") haptics.success();
    } catch {
      setNotificationPermissionStatus("denied");
    }
  };

  const stepCanContinue = () => {
    switch (step) {
      case 1:
        return firstName.trim().length > 0;
      case 2:
        return totalSelectedConditions > 0;
      case 3:
        return Boolean(biologicalSex) && Boolean(dateOfBirth) && !birthDateInvalid;
      case 4:
        return healthPermissionStatus === "granted" || healthPermissionStatus === "unavailable";
      case 5:
        return locationPermissionStatus === "granted";
      case 6:
        return notificationPermissionStatus === "granted" || notificationPermissionStatus === "denied" || notificationPermissionStatus === "unavailable";
      default:
        return true;
    }
  };

  const goNext = async () => {
    if (step === TOTAL_STEPS - 1) {
      setSubmitting(true);
      try {
        let aiLogCategories: any[] = [];
        let knownSymptoms: string[] = [];
        let knownTriggers: string[] = [];

        if (normalizedSelectedConditions.length > 0) {
          const { data, error } = await supabase.functions.invoke("generate-suggestions", {
            body: {
              conditions: normalizedSelectedConditions.map((value) => CONDITIONS.find((condition) => condition.id === value)?.name || value),
              biologicalSex,
              age,
            },
          });

          if (!error && data) {
            aiLogCategories = data.logCategories || [];
            knownSymptoms = data.symptoms || [];
            knownTriggers = data.triggers || [];
          }
        }

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
            knownSymptoms,
            knownTriggers,
            notificationsEnabled: notificationPermissionStatus === "granted",
            locationEnabled: locationPermissionStatus === "granted",
            healthConnected: healthPermissionStatus === "granted",
          }),
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    haptics.selection();
    setStep((prev) => prev + 1);
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const StepShell = ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) => (
    <div className="flex min-h-full flex-col px-6 pb-6 pt-8">
      <div className="mb-8 flex items-center justify-center">
        <img src={jvalaLogo} alt="Jvala" className="h-14 w-14 object-contain" />
      </div>
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );

  const PermissionCard = ({
    icon: Icon,
    title,
    body,
    status,
    onRequest,
    buttonLabel,
  }: {
    icon: typeof Heart;
    title: string;
    body: string;
    status: PermissionState;
    onRequest: () => void | Promise<void>;
    buttonLabel: string;
  }) => (
    <div className="rounded-3xl border border-border bg-card px-5 py-5 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            status === "granted" && "bg-primary/10 text-primary",
            status === "denied" && "bg-destructive/10 text-destructive",
            status === "requesting" && "bg-muted text-muted-foreground",
            status === "idle" && "bg-secondary text-secondary-foreground",
            status === "unavailable" && "bg-accent text-accent-foreground",
          )}
        >
          {status === "granted"
            ? "Connected"
            : status === "denied"
              ? "Not granted"
              : status === "requesting"
                ? "Requesting"
                : status === "unavailable"
                  ? "Unavailable here"
                  : "Not set"}
        </span>
        <button
          type="button"
          onClick={() => void onRequest()}
          disabled={status === "requesting"}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {status === "requesting" ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      <div className="px-6 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="mb-4 flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {step === 0 && (
          <StepShell
            title="Built for daily tracking"
            subtitle="Jvala keeps symptom logging fast, then layers in location, wearable, and reminder context when you want it."
          >
            <div className="rounded-3xl border border-border bg-card px-5 py-6 shadow-sm">
              <p className="text-center text-base font-medium text-foreground">{valueProps[valuePropIndex]}</p>
            </div>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell title="What should we call you?" subtitle="We use this in the app and in your companion context.">
            <div className="space-y-3">
              <input
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                autoFocus
                className="h-14 w-full rounded-2xl border border-border bg-card px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
              <p className="text-sm text-muted-foreground">If you signed in with Apple or Google, we’ll prefill this when available.</p>
            </div>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title="What are you tracking?"
            subtitle="Type anything and add it. You can also tap a suggestion below."
          >
            <div className="space-y-4">
              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={conditionQuery}
                    onChange={(event) => setConditionQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTypedCondition();
                      }
                    }}
                    placeholder="Add a condition, symptom cluster, or anything you want to track"
                    className="h-14 w-full rounded-2xl border border-border bg-background pl-11 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={addTypedCondition}
                    className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {normalizedSelectedConditions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {normalizedSelectedConditions.map((value) => {
                    const label = CONDITIONS.find((condition) => condition.id === value)?.name || value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => removeCondition(value)}
                        className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
                      >
                        <span>{label}</span>
                        <span className="text-xs">×</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2 rounded-3xl border border-border bg-card p-4 shadow-sm">
                <p className="text-sm font-medium text-foreground">Suggestions</p>
                <div className="grid gap-2">
                  {filteredConditions.length > 0 ? (
                    filteredConditions.map((condition) => (
                      <button
                        key={condition.id}
                        type="button"
                        onClick={() => addCondition(condition.id)}
                        className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">{condition.name}</div>
                          <div className="text-xs text-muted-foreground">{condition.category}</div>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={addTypedCondition}
                      className="rounded-2xl border border-dashed border-border px-4 py-4 text-left text-sm text-muted-foreground"
                    >
                      Add “{conditionQuery.trim() || "your entry"}”
                    </button>
                  )}
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="A little context" subtitle="We use this to tailor trend analysis and AI suggestions.">
            <div className="space-y-4">
              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <label className="mb-2 block text-sm font-medium text-foreground">Date of birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-primary"
                />
                {birthDateInvalid ? (
                  <p className="mt-2 text-sm text-destructive">Enter a valid birth date for someone age 13 or older.</p>
                ) : null}
              </div>

              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <p className="mb-3 text-sm font-medium text-foreground">Biological sex</p>
                <div className="grid grid-cols-2 gap-2">
                  {SEX_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        haptics.selection();
                        setBiologicalSex(option.id);
                      }}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-sm font-medium transition-colors",
                        biologicalSex === option.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="Connect Apple Health"
            subtitle="This lets Jvala attach real wearable context to your logs when your device supports it."
          >
            <PermissionCard
              icon={Heart}
              title="Health data"
              body="We only request read access for the metrics Jvala uses in tracking and trend analysis."
              status={healthPermissionStatus}
              onRequest={requestHealthPermission}
              buttonLabel="Connect"
            />
          </StepShell>
        )}

        {step === 5 && (
          <StepShell
            title="Enable location"
            subtitle="We use city-level location to attach weather and environment signals to each log."
          >
            <PermissionCard
              icon={MapPin}
              title="Location"
              body="This improves environmental correlations and quick-log context."
              status={locationPermissionStatus}
              onRequest={requestLocationPermission}
              buttonLabel="Allow"
            />
          </StepShell>
        )}

        {step === 6 && (
          <StepShell
            title="Notifications"
            subtitle="Turn these on if you want streak reminders and follow-up nudges."
          >
            <PermissionCard
              icon={Bell}
              title="Daily reminders"
              body="You can change this later in Settings at any time."
              status={notificationPermissionStatus}
              onRequest={requestNotificationPermission}
              buttonLabel="Enable"
            />
          </StepShell>
        )}

        {step === 7 && (
          <StepShell title="Reminder setup" subtitle="Choose when Jvala should check in if you want daily reminders.">
            <div className="space-y-4">
              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setEnableReminders((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-4 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">Daily reminders</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {enableReminders ? "Morning and evening reminders are on." : "No automatic reminders."}
                    </p>
                  </div>
                  <div className={cn("flex h-6 w-11 items-center rounded-full p-1 transition-colors", enableReminders ? "bg-primary" : "bg-muted") }>
                    <div className={cn("h-4 w-4 rounded-full bg-background transition-transform", enableReminders ? "translate-x-5" : "translate-x-0")} />
                  </div>
                </button>
              </div>

              {enableReminders ? (
                <div className="grid gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Morning</span>
                    <input
                      type="time"
                      value={morningReminder}
                      onChange={(event) => setMorningReminder(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Evening</span>
                    <input
                      type="time"
                      value={eveningReminder}
                      onChange={(event) => setEveningReminder(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </label>
                </div>
              ) : null}

              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Ready to go</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Jvala will use your profile, condition list, and enabled permissions to personalize tracking and analysis from day one.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </StepShell>
        )}
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
        <button
          type="button"
          onClick={() => void goNext()}
          disabled={!stepCanContinue() || submitting}
          className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : step === TOTAL_STEPS - 1 ? (
            "Continue to Jvala"
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </div>
  );
};
