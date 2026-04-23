import { useState, useEffect, useCallback } from "react";
import { CONDITIONS, Condition } from "@/data/conditions";
import { 
  Search, Check, ChevronLeft, ChevronRight,
  Brain, Zap, MessageCircle, FileText, 
  Bell, MapPin, Heart, X
} from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Input } from "@/components/ui/input";

interface SmartOnboardingData {
  firstName: string;
  conditions: string[];
  biologicalSex: string | null;
  enableReminders: boolean;
  reminderTime: string;
  connectWearables: boolean;
}

interface SmartOnboardingProps {
  onComplete: (data: SmartOnboardingData) => void;
}

// ─── Rotating value props ──────────────────────────────────
const VALUE_PROPS = [
  "for predicting flares.",
  "for understanding patterns.",
  "for talking to someone.",
  "for tracking symptoms.",
  "for health reports.",
];

// ─── Goals data ────────────────────────────────────────────
const GOALS = [
  { id: "understand-flares", label: "Understand why I flare", icon: "🔥", wide: true },
  { id: "manage-pain", label: "Manage pain", icon: "💊" },
  { id: "sleep-better", label: "Sleep better", icon: "🌙" },
  { id: "manage-energy", label: "Manage energy", icon: "⚡" },
  { id: "mental-health", label: "Mental health", icon: "🧠" },
  { id: "track-symptoms", label: "Track symptoms", icon: "📋", wide: true },
  { id: "health-reports", label: "Reports for my doctor", icon: "📄", wide: true },
  { id: "talk-support", label: "24/7 support", icon: "💬" },
  { id: "other", label: "Other", icon: "✨" },
];

// ─── Gender options ────────────────────────────────────────
const GENDERS = [
  { id: "female", label: "Female", icon: "♀", color: "hsl(340 70% 55%)" },
  { id: "male", label: "Male", icon: "♂", color: "hsl(220 70% 55%)" },
  { id: "non-binary", label: "Non-binary", icon: "⚧", color: "hsl(270 60% 55%)" },
  { id: "other", label: "Prefer not to say", icon: "—", color: "hsl(0 0% 50%)" },
];

// ─── Age ranges ────────────────────────────────────────────
const AGE_RANGES = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

// ─── Commitment options ────────────────────────────────────
const COMMITMENTS = [
  { days: 3, label: "3 days", emoji: "🙌" },
  { days: 7, label: "7 days", emoji: "😊" },
  { days: 14, label: "14 days", emoji: "🤩" },
  { days: 30, label: "30 days", emoji: "🔥" },
];

// ─── Preparing checklist ───────────────────────────────────
const PREPARING_STEPS = [
  { icon: Brain, label: "Taking your conditions...", color: "text-blue-500" },
  { icon: Zap, label: "Analysing patterns...", color: "text-purple-500" },
  { icon: Heart, label: "Processing your answers...", color: "text-amber-500" },
  { icon: MessageCircle, label: "Calibrating your companion...", color: "text-pink-500" },
  { icon: Check, label: "Ready!", color: "text-emerald-500" },
];

export const SmartOnboarding = ({ onComplete }: SmartOnboardingProps) => {
  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [selectedCommitment, setSelectedCommitment] = useState<number | null>(null);
  const [valuePropIndex, setValuePropIndex] = useState(0);
  const [preparingStep, setPreparingStep] = useState(0);
  const [data, setData] = useState<SmartOnboardingData>({
    firstName: "",
    conditions: [],
    biologicalSex: null,
    enableReminders: true,
    reminderTime: "09:00",
    connectWearables: true,
  });

  // Steps: 0=Welcome, 1=Predict pitch, 2=Talk pitch, 3=Reports pitch, 
  // 4=Name, 5=Goals, 6=Conditions, 7=Gender, 8=Age, 9=Commitment, 10=Preparing
  const totalSteps = 11;

  // Rotate value props on welcome
  useEffect(() => {
    if (step !== 0) return;
    const interval = setInterval(() => {
      setValuePropIndex(prev => (prev + 1) % VALUE_PROPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [step]);

  // Preparing animation
  useEffect(() => {
    if (step !== 10) return;
    if (preparingStep >= PREPARING_STEPS.length) {
      const timeout = setTimeout(() => {
        onComplete(data);
      }, 800);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(() => {
      setPreparingStep(prev => prev + 1);
    }, 600);
    return () => clearTimeout(timeout);
  }, [step, preparingStep, data, onComplete]);

  const handleNext = useCallback(() => {
    haptics.selection();
    if (step === 10) return; // preparing handles itself
    setStep(prev => prev + 1);
  }, [step]);

  const handleBack = useCallback(() => {
    haptics.selection();
    setStep(prev => Math.max(prev - 1, 0));
  }, []);

  const toggleCondition = (conditionId: string) => {
    haptics.selection();
    setData(prev => ({
      ...prev,
      conditions: prev.conditions.includes(conditionId)
        ? prev.conditions.filter(c => c !== conditionId)
        : [...prev.conditions, conditionId]
    }));
  };

  const toggleGoal = (goalId: string) => {
    haptics.selection();
    setSelectedGoals(prev => 
      prev.includes(goalId) ? prev.filter(g => g !== goalId) : [...prev, goalId]
    );
  };

  const filteredConditions = searchQuery
    ? CONDITIONS.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : CONDITIONS;

  const canProceed = () => {
    switch (step) {
      case 4: return name.trim().length >= 1;
      case 5: return selectedGoals.length > 0;
      case 6: return data.conditions.length > 0;
      case 7: return selectedGender !== null;
      case 8: return selectedAge !== null;
      case 9: return selectedCommitment !== null;
      default: return true;
    }
  };

  // ─── Gradient background ─────────────────────────────────
  const bgGradient = "bg-gradient-to-b from-[hsl(270,60%,30%)] via-[hsl(300,50%,40%)] to-[hsl(330,60%,50%)]";

  // ─── Shared frosted card ─────────────────────────────────
  const FrostedCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={cn(
      "bg-white/15 backdrop-blur-2xl border border-white/20 rounded-3xl",
      className
    )}>
      {children}
    </div>
  );

  // ─── Frosted pill question header ────────────────────────
  const QuestionPill = ({ text }: { text: string }) => (
    <div className="bg-white/20 backdrop-blur-xl border border-white/25 rounded-full px-8 py-4 mx-auto max-w-sm">
      <h2 className="text-xl font-bold text-white text-center">{text}</h2>
    </div>
  );

  // ─── Option pill (selection items) ───────────────────────
  const OptionPill = ({ 
    selected, onClick, children, className = "" 
  }: { 
    selected: boolean; onClick: () => void; children: React.ReactNode; className?: string 
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "w-full py-4 px-5 rounded-2xl text-left transition-all duration-200 active:scale-[0.97]",
        selected
          ? "bg-white/95 border-2 border-white shadow-lg"
          : "bg-white/15 backdrop-blur-xl border border-white/20 hover:bg-white/25",
        className
      )}
    >
      <span className={cn(
        "text-[15px] font-semibold",
        selected ? "text-gray-900" : "text-white"
      )}>
        {children}
      </span>
    </button>
  );

  // ─── Bottom CTA button ───────────────────────────────────
  const CTAButton = ({ label, disabled = false, onClick }: { label: string; disabled?: boolean; onClick: () => void }) => (
    <div className="px-6 pb-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-full h-14 rounded-2xl text-base font-bold transition-all duration-300 active:scale-[0.96]",
          disabled
            ? "bg-white/10 text-white/30 cursor-not-allowed"
            : "bg-gray-900 text-white shadow-xl hover:bg-gray-800"
        )}
      >
        {label}
      </button>
    </div>
  );

  // ─── Back button ─────────────────────────────────────────
  const BackButton = () => (
    step > 0 && step < 10 ? (
      <button
        onClick={handleBack}
        className="absolute top-[max(env(safe-area-inset-top),12px)] left-4 z-50 w-10 h-10 rounded-full bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
    ) : null
  );

  // ─── Preparing screen ────────────────────────────────────
  if (step === 10) {
    return (
      <div className={cn("fixed inset-0 flex flex-col items-center justify-center px-6", bgGradient)}>
        <BackButton />
        
        {/* Logo with ring + confetti-like effect */}
        <div className="relative mb-8">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 p-1 animate-spin" style={{ animationDuration: '8s' }}>
            <div className="w-full h-full rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center">
              <img src={jvalaLogo} alt="Jvala" className="w-20 h-20 object-contain" />
            </div>
          </div>
          {/* Confetti dots */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm animate-bounce"
              style={{
                background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#F97316'][i % 5],
                top: `${15 + Math.sin(i * 30 * Math.PI / 180) * 55}%`,
                left: `${50 + Math.cos(i * 30 * Math.PI / 180) * 55}%`,
                animationDelay: `${i * 100}ms`,
                animationDuration: '1.5s',
                transform: `rotate(${i * 30}deg)`,
              }}
            />
          ))}
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Preparing your companion...</h2>
        <p className="text-white/60 text-sm mb-8">Based on what you've told me.</p>

        <FrostedCard className="w-full max-w-sm p-6">
          <div className="space-y-4">
            {PREPARING_STEPS.map((s, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 transition-all duration-500",
                  i <= preparingStep ? "opacity-100" : "opacity-20"
                )}
              >
                <s.icon className={cn("w-5 h-5", i < preparingStep ? "text-emerald-400" : i === preparingStep ? s.color : "text-white/30")} />
                <span className={cn(
                  "text-sm font-medium",
                  i < preparingStep ? "text-emerald-400" : i === preparingStep ? "text-white" : "text-white/30"
                )}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </FrostedCard>
      </div>
    );
  }

  return (
    <div className={cn("fixed inset-0 flex flex-col", bgGradient)}>
      <div style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} />
      <BackButton />

      {/* Content area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        
        {/* ─── Step 0: Welcome / Value Props ─── */}
        {step === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 animate-in fade-in-0 duration-700">
            {/* Logo */}
            <div className="relative mb-12">
              <div className="absolute -inset-4 rounded-3xl bg-white/10 blur-xl" />
              <div className="relative w-24 h-24 rounded-[1.75rem] overflow-hidden shadow-2xl border border-white/20">
                <img src={jvalaLogo} alt="Jvala" className="w-full h-full object-cover" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-white mb-3 text-center">
              Your health companion
            </h1>

            {/* Rotating value prop pill */}
            <div className="bg-white/15 backdrop-blur-xl border border-white/20 rounded-full px-8 py-3 mb-16">
              <p className="text-lg font-semibold text-white/90 transition-all duration-500" key={valuePropIndex}>
                {VALUE_PROPS[valuePropIndex]}
              </p>
            </div>

            {/* Spacer */}
            <div className="flex-1" />
          </div>
        )}

        {/* ─── Step 1: Predict Pitch ─── */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                <Brain className="w-10 h-10 text-white" />
              </div>
            </div>

            <FrostedCard className="w-full max-w-sm p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Know tomorrow, today</h2>
              <div className="w-12 h-0.5 bg-white/20 mx-auto mb-4" />
              <p className="text-white/70 text-[15px] leading-relaxed">
                Jvala learns your unique patterns and predicts flares 24-72 hours before they happen.
              </p>
            </FrostedCard>
          </div>
        )}

        {/* ─── Step 2: Talk Pitch ─── */}
        {step === 2 && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                <MessageCircle className="w-10 h-10 text-white" />
              </div>
            </div>

            <FrostedCard className="w-full max-w-sm p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Talk to Jvala anytime</h2>
              <div className="w-12 h-0.5 bg-white/20 mx-auto mb-4" />
              <div className="flex items-center justify-center gap-8 mb-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                    <MessageCircle className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-white/80 text-sm font-medium">Text</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-white/80 text-sm font-medium">Voice</span>
                </div>
              </div>
              <p className="text-white/60 text-sm">About symptoms, medications, or just to vent.</p>
            </FrostedCard>
          </div>
        )}

        {/* ─── Step 3: Reports Pitch ─── */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                <FileText className="w-10 h-10 text-white" />
              </div>
            </div>

            <FrostedCard className="w-full max-w-sm p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Clinical-grade reports</h2>
              <div className="w-12 h-0.5 bg-white/20 mx-auto mb-4" />
              <p className="text-white/70 text-[15px] leading-relaxed">
                Generate detailed health reports to share with your doctor. FHIR-compatible.
              </p>
            </FrostedCard>
          </div>
        )}

        {/* ─── Step 4: Name ─── */}
        {step === 4 && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="mb-8">
              <img src={jvalaLogo} alt="Jvala" className="w-16 h-16 object-contain" />
            </div>

            <QuestionPill text="What's your name?" />
            
            <div className="w-full max-w-sm mt-8">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your first name"
                autoFocus
                className="w-full h-14 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25 px-5 text-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
              />
            </div>
          </div>
        )}

        {/* ─── Step 5: Goals ─── */}
        {step === 5 && (
          <div className="flex flex-col px-6 pt-16 pb-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="flex justify-center mb-6">
              <img src={jvalaLogo} alt="Jvala" className="w-14 h-14 object-contain" />
            </div>

            <QuestionPill text="What are your goals?" />

            <div className="mt-6 space-y-3">
              {GOALS.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  className={cn(
                    "w-full py-4 px-5 rounded-2xl text-left transition-all duration-200 active:scale-[0.97] flex items-center gap-3",
                    selectedGoals.includes(goal.id)
                      ? "bg-white/90 border-2 border-white shadow-lg"
                      : "bg-white/12 backdrop-blur-xl border border-white/15 hover:bg-white/20"
                  )}
                >
                  <span className="text-xl">{goal.icon}</span>
                  <span className={cn(
                    "text-[15px] font-semibold",
                    selectedGoals.includes(goal.id) ? "text-gray-900" : "text-white"
                  )}>
                    {goal.label}
                  </span>
                  {selectedGoals.includes(goal.id) && (
                    <div className="ml-auto w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step 6: Conditions ─── */}
        {step === 6 && (
          <div className="flex flex-col px-6 pt-16 pb-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="flex justify-center mb-6">
              <img src={jvalaLogo} alt="Jvala" className="w-14 h-14 object-contain" />
            </div>

            <QuestionPill text="What condition(s) do you have?" />

            <p className="text-white/50 text-sm text-center mt-3 mb-4">Tap to select</p>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conditions..."
                className="w-full h-13 rounded-2xl bg-white/12 backdrop-blur-xl border border-white/15 pl-11 pr-10 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/25 transition-all"
                style={{ height: '52px' }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              )}
            </div>

            {/* "I am Seeking a Diagnosis" option */}
            <button
              onClick={() => {
                haptics.selection();
                setData(prev => ({
                  ...prev,
                  conditions: prev.conditions.includes('seeking-diagnosis')
                    ? prev.conditions.filter(c => c !== 'seeking-diagnosis')
                    : [...prev.conditions, 'seeking-diagnosis']
                }));
              }}
              className={cn(
                "w-full py-4 px-5 rounded-2xl mb-4 text-center transition-all duration-200 active:scale-[0.97] flex items-center justify-center gap-2",
                data.conditions.includes('seeking-diagnosis')
                  ? "bg-white/90 border-2 border-white"
                  : "bg-white/12 backdrop-blur-xl border border-white/15"
              )}
            >
              <Search className={cn("w-4 h-4", data.conditions.includes('seeking-diagnosis') ? "text-gray-900" : "text-white/70")} />
              <span className={cn(
                "text-[15px] font-semibold",
                data.conditions.includes('seeking-diagnosis') ? "text-gray-900" : "text-white"
              )}>
                I am Seeking a Diagnosis
              </span>
            </button>

            {/* Selected badges */}
            {data.conditions.filter(c => c !== 'seeking-diagnosis').length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {data.conditions.filter(c => c !== 'seeking-diagnosis').map(id => {
                  const condition = CONDITIONS.find(c => c.id === id);
                  return (
                    <span key={id} className="text-xs px-3 py-1.5 rounded-full bg-white/90 text-gray-900 font-semibold flex items-center gap-1.5">
                      {condition?.name}
                      <button onClick={() => toggleCondition(id)}>
                        <X className="w-3 h-3 text-gray-500" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Condition results */}
            <div className="space-y-1.5 pb-4 max-h-[40vh] overflow-y-auto scrollbar-hide">
              {filteredConditions.map((condition) => (
                <button
                  key={condition.id}
                  onClick={() => toggleCondition(condition.id)}
                  className={cn(
                    "w-full py-3.5 px-4 rounded-2xl text-left transition-all active:scale-[0.98] flex items-center justify-between",
                    data.conditions.includes(condition.id)
                      ? "bg-white/90 border-2 border-white"
                      : "bg-white/8 border border-white/10 hover:bg-white/15"
                  )}
                >
                  <span className={cn(
                    "text-sm font-medium",
                    data.conditions.includes(condition.id) ? "text-gray-900" : "text-white/90"
                  )}>{condition.name}</span>
                  {data.conditions.includes(condition.id) && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
              
              {/* Custom add when no results */}
              {searchQuery && filteredConditions.length === 0 && (
                <button
                  onClick={() => {
                    haptics.selection();
                    const customId = searchQuery.toLowerCase().replace(/\s+/g, '-');
                    setData(prev => ({
                      ...prev,
                      conditions: [...prev.conditions, customId]
                    }));
                    setSearchQuery("");
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl text-left bg-white/8 border border-white/10"
                >
                  <span className="text-sm font-semibold text-amber-400">+ Add "{searchQuery}"</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 7: Gender ─── */}
        {step === 7 && (
          <div className="flex flex-col items-center px-6 pt-16 pb-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="mb-6">
              <img src={jvalaLogo} alt="Jvala" className="w-14 h-14 object-contain" />
            </div>

            <QuestionPill text="How do you identify?" />

            <div className="w-full max-w-sm mt-8 space-y-3">
              {GENDERS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { haptics.selection(); setSelectedGender(g.id); }}
                  className={cn(
                    "w-full py-5 px-5 rounded-2xl transition-all duration-200 active:scale-[0.97] flex items-center gap-4",
                    selectedGender === g.id
                      ? "bg-white/90 border-2 border-white shadow-lg"
                      : "bg-white/12 backdrop-blur-xl border border-white/15 hover:bg-white/20"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold",
                    selectedGender === g.id ? "bg-gray-100" : "bg-white/15"
                  )} style={{ color: g.color }}>
                    {g.icon}
                  </div>
                  <span className={cn(
                    "text-[16px] font-semibold",
                    selectedGender === g.id ? "text-gray-900" : "text-white"
                  )}>{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step 8: Age ─── */}
        {step === 8 && (
          <div className="flex flex-col items-center px-6 pt-16 pb-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="mb-6">
              <img src={jvalaLogo} alt="Jvala" className="w-14 h-14 object-contain" />
            </div>

            <QuestionPill text="How old are you?" />

            <div className="w-full max-w-sm mt-8 space-y-3">
              {AGE_RANGES.map((age) => (
                <OptionPill
                  key={age}
                  selected={selectedAge === age}
                  onClick={() => { haptics.selection(); setSelectedAge(age); }}
                  className="text-center"
                >
                  {age}
                </OptionPill>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step 9: Commitment ─── */}
        {step === 9 && (
          <div className="flex flex-col items-center px-6 pt-16 pb-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="mb-6">
              <img src={jvalaLogo} alt="Jvala" className="w-14 h-14 object-contain" />
            </div>

            <div className="bg-white/20 backdrop-blur-xl border border-white/25 rounded-3xl px-8 py-5 mx-auto max-w-sm text-center mb-8">
              <h2 className="text-xl font-bold text-white">Commit to daily check-ins</h2>
              <p className="text-white/60 text-sm mt-2 leading-relaxed">
                So Jvala can learn your patterns, how long will you try daily check-ins?
              </p>
            </div>

            <div className="w-full max-w-sm space-y-3">
              {COMMITMENTS.map((c) => (
                <button
                  key={c.days}
                  onClick={() => { haptics.selection(); setSelectedCommitment(c.days); }}
                  className={cn(
                    "w-full py-5 px-5 rounded-2xl transition-all duration-200 active:scale-[0.97] flex items-center gap-4",
                    selectedCommitment === c.days
                      ? "bg-white/90 border-2 border-white shadow-lg"
                      : "bg-white/12 backdrop-blur-xl border border-white/15 hover:bg-white/20"
                  )}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className={cn(
                    "text-[16px] font-semibold",
                    selectedCommitment === c.days ? "text-gray-900" : "text-white"
                  )}>{c.label}</span>
                </button>
              ))}
            </div>

            {/* Skip option */}
            <button 
              onClick={handleNext}
              className="mt-6 text-white/40 text-sm font-medium hover:text-white/60 transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      {step < 10 && (
        <CTAButton 
          label={
            step === 0 ? "Get Started" :
            step <= 3 ? "Continue" :
            step === 9 ? "I commit" :
            "Continue"
          }
          disabled={!canProceed()}
          onClick={handleNext}
        />
      )}
    </div>
  );
};
