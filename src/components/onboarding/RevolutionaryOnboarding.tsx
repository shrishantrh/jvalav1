import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { CONDITIONS, Condition } from "@/data/conditions";
import { 
  ChevronRight, 
  Search,
  Heart,
  Activity,
  Check,
  Sparkles,
  Zap,
  Watch,
  Brain,
  Calendar,
  Moon,
  Droplet,
  ThermometerSun,
  Utensils,
  Pill,
  Users,
  Shield,
  ChevronLeft,
  Loader2,
  ExternalLink
} from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

// What users can track - condition-agnostic
// Simplified to 2 main tracking options per document requirements
const TRACKING_OPTIONS = [
  { 
    id: 'symptoms_flares', 
    name: 'Symptoms & Flares', 
    icon: Activity, 
    desc: 'Track flares, symptoms, triggers, medications. Best for chronic conditions.',
    default: true 
  },
  { 
    id: 'health_tracking', 
    name: 'General Health Tracking', 
    icon: Heart, 
    desc: 'Track sleep, energy, activity, mood. For overall wellness monitoring.',
    default: false 
  },
];

// Data sources we can auto-capture from
const DATA_SOURCES = [
  { id: 'apple_health', name: 'Apple Health', icon: '🍎', available: true, autoCaptures: ['sleep', 'activity', 'menstrual', 'heart_rate'] },
  { id: 'google_fit', name: 'Google Fit', icon: '🏃', available: true, autoCaptures: ['sleep', 'activity', 'heart_rate'] },
  { id: 'fitbit', name: 'Fitbit', icon: '⌚', available: true, autoCaptures: ['sleep', 'activity', 'heart_rate', 'stress'] },
  { id: 'oura', name: 'Oura Ring', icon: '💍', available: true, autoCaptures: ['sleep', 'activity', 'temperature', 'menstrual'] },
  { id: 'whoop', name: 'WHOOP', icon: '🔄', available: false, autoCaptures: ['sleep', 'strain', 'recovery'] },
  { id: 'garmin', name: 'Garmin', icon: '⏱️', available: false, autoCaptures: ['sleep', 'activity', 'stress'] },
];

// Menstrual tracking apps we can import from
const MENSTRUAL_APPS = [
  { id: 'clue', name: 'Clue', icon: '🔴', desc: 'Import via Apple Health' },
  { id: 'flo', name: 'Flo', icon: '🌸', desc: 'Import via Apple Health' },
  { id: 'natural_cycles', name: 'Natural Cycles', icon: '🌡️', desc: 'Direct import coming soon' },
  { id: 'manual', name: 'Log Manually', icon: '📝', desc: 'Track right here in Jvala' },
];

interface OnboardingData {
  trackingItems: string[];
  dataSources: string[];
  menstrualApp: string | null;
  conditions: string[];
  age: number | null;
  biologicalSex: 'male' | 'female' | 'other' | null;
  enableReminders: boolean;
  reminderTime: string;
}

interface RevolutionaryOnboardingProps {
  onComplete: (data: OnboardingData) => void;
}

export const RevolutionaryOnboarding = ({ onComplete }: RevolutionaryOnboardingProps) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    trackingItems: ['symptoms_flares'], // Default to symptoms & flares
    dataSources: [],
    menstrualApp: null,
    conditions: [],
    age: null,
    biologicalSex: null,
    enableReminders: true,
    reminderTime: "09:00",
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [conditionSearch, setConditionSearch] = useState("");

  // No longer needed with simplified 2-option tracking

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
    await new Promise(resolve => setTimeout(resolve, 2000));
    onComplete(data);
  };

  // Removed toggleTracking - now using single selection with two options

  const toggleDataSource = (sourceId: string) => {
    haptics.selection();
    setData(prev => ({
      ...prev,
      dataSources: prev.dataSources.includes(sourceId)
        ? prev.dataSources.filter(s => s !== sourceId)
        : [...prev.dataSources, sourceId]
    }));
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

  const filteredConditions = conditionSearch
    ? CONDITIONS.filter(c => 
        c.name.toLowerCase().includes(conditionSearch.toLowerCase()) ||
        c.category.toLowerCase().includes(conditionSearch.toLowerCase())
      )
    : CONDITIONS.slice(0, 12);

  // Analyzing screen
  if (isAnalyzing) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-background max-w-md mx-auto">
        <div className="text-center space-y-8 animate-in fade-in-0 zoom-in-95 duration-500">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 bg-gradient-primary rounded-3xl animate-pulse" />
            <div className="absolute inset-3 bg-card rounded-2xl flex items-center justify-center glass-card">
              <Brain className="w-10 h-10 text-primary animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Building Your Health AI...</h2>
            <div className="text-sm text-muted-foreground space-y-2 max-w-xs mx-auto">
              <p className="animate-in fade-in-0 duration-500" style={{ animationDelay: "300ms" }}>
                ✓ Setting up {data.trackingItems.length} tracking categories
              </p>
              {data.dataSources.length > 0 && (
                <p className="animate-in fade-in-0 duration-500" style={{ animationDelay: "600ms" }}>
                  ✓ Connecting {data.dataSources.length} data sources
                </p>
              )}
              <p className="animate-in fade-in-0 duration-500" style={{ animationDelay: "900ms" }}>
                ✓ Initializing pattern detection
              </p>
              <p className="animate-in fade-in-0 duration-500" style={{ animationDelay: "1200ms" }}>
                ✓ Preparing personalized forecasts
              </p>
            </div>
          </div>
          
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 0: // Welcome + What to track
        return (
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            {/* Hero */}
            <div className="text-center space-y-4 pt-4">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 bg-gradient-primary rounded-2xl rotate-6 opacity-20" />
                <div className="relative bg-white rounded-2xl p-3 shadow-lg">
                  <img src={jvalaLogo} alt="Jvala" className="w-full h-full" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient-primary">What do you want to track?</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Select what matters to you. AI learns the rest.
                </p>
              </div>
            </div>

            {/* Simplified to 2 options */}
            <div className="space-y-3">
              {TRACKING_OPTIONS.map((option, idx) => {
                const isSelected = data.trackingItems.includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      haptics.selection();
                      setData(prev => ({ ...prev, trackingItems: [option.id] }));
                    }}
                    className={cn(
                      "w-full p-4 rounded-2xl border text-left transition-all press-effect",
                      "flex items-center gap-4 animate-in fade-in-0",
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-lg'
                        : 'bg-card hover:bg-muted/50 border-border'
                    )}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
                      isSelected ? 'bg-gradient-primary' : 'bg-muted'
                    )}>
                      <option.icon className={cn("w-7 h-7", isSelected ? 'text-primary-foreground' : 'text-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold">{option.name}</span>
                        {option.default && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Recommended</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{option.desc}</p>
                    </div>
                    {isSelected && <Check className="w-6 h-6 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              You can always change this later in settings
            </p>
          </div>
        );

      case 1: // Demographics + Data Sources
        return (
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Personalize Your AI</h2>
              <p className="text-xs text-muted-foreground">
                Better data = better predictions
              </p>
            </div>

            {/* Quick Demographics */}
            <Card className="p-4 bg-gradient-card border-0 shadow-soft space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                About You (Optional)
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Biological Sex</p>
                  <div className="flex gap-1">
                    {(['female', 'male', 'other'] as const).map(sex => (
                      <Button
                        key={sex}
                        variant={data.biologicalSex === sex ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 text-xs h-8"
                        onClick={() => {
                          haptics.selection();
                          setData(prev => ({ ...prev, biologicalSex: sex }));
                        }}
                      >
                        {sex === 'female' ? '♀' : sex === 'male' ? '♂' : '⚧'}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Age Range</p>
                  <div className="flex gap-1">
                    {[
                      { label: '<30', value: 25 },
                      { label: '30-50', value: 40 },
                      { label: '50+', value: 55 }
                    ].map(age => (
                      <Button
                        key={age.value}
                        variant={data.age === age.value ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 text-xs h-8"
                        onClick={() => {
                          haptics.selection();
                          setData(prev => ({ ...prev, age: age.value }));
                        }}
                      >
                        {age.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Data Sources */}
            <Card className="p-4 bg-gradient-card border-0 shadow-soft space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Watch className="w-4 h-4 text-primary" />
                Connect Data Sources
              </h3>
              <p className="text-[10px] text-muted-foreground -mt-2">
                Auto-capture sleep, activity & more - no manual logging
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                {DATA_SOURCES.map((source) => {
                  const isSelected = data.dataSources.includes(source.id);
                  return (
                    <button
                      key={source.id}
                      onClick={() => source.available && toggleDataSource(source.id)}
                      disabled={!source.available}
                      className={cn(
                        "p-3 rounded-xl border text-center transition-all",
                        source.available ? 'press-effect' : 'opacity-50 cursor-not-allowed',
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'bg-background hover:bg-muted/50'
                      )}
                    >
                      <span className="text-2xl">{source.icon}</span>
                      <p className="text-xs font-medium mt-1">{source.name}</p>
                      {!source.available && (
                        <Badge variant="outline" className="text-[8px] mt-1">Soon</Badge>
                      )}
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary mx-auto mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Menstrual tracking - show if relevant */}
            {data.trackingItems.includes('menstrual') && (
              <Card className="p-4 bg-gradient-card border-0 shadow-soft space-y-3 animate-in fade-in-0 duration-300">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-pink-500" />
                  Menstrual Tracking
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Already using an app? We can sync your data.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MENSTRUAL_APPS.map(app => (
                    <button
                      key={app.id}
                      onClick={() => {
                        haptics.selection();
                        setData(prev => ({ ...prev, menstrualApp: app.id }));
                      }}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-all press-effect",
                        data.menstrualApp === app.id
                          ? 'bg-pink-500/10 border-pink-500'
                          : 'bg-background hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{app.icon}</span>
                        <div>
                          <p className="text-xs font-medium">{app.name}</p>
                          <p className="text-[9px] text-muted-foreground">{app.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        );

      case 2: // Conditions + Launch
        return (
          <div className="space-y-5 animate-in fade-in-0 slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Almost Ready!</h2>
              <p className="text-xs text-muted-foreground">
                Optionally add conditions for smarter predictions
              </p>
            </div>

            {/* Conditions - Optional */}
            <Card className="p-4 bg-gradient-card border-0 shadow-soft space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Health Conditions</h3>
                <Badge variant="outline" className="text-[9px]">Optional</Badge>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conditions..."
                  value={conditionSearch}
                  onChange={(e) => setConditionSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>

              <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                {filteredConditions.map((condition) => (
                  <button
                    key={condition.id}
                    onClick={() => toggleCondition(condition.id)}
                    className={cn(
                      "w-full py-2.5 px-3 rounded-lg border text-left transition-all press-effect",
                      "flex items-center justify-between text-sm",
                      data.conditions.includes(condition.id)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background hover:bg-muted/50'
                    )}
                  >
                    <span>{condition.name}</span>
                    {data.conditions.includes(condition.id) && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>

              {data.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t">
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
            </Card>

            {/* Reminders */}
            <Card className="p-4 bg-gradient-card border-0 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Daily Check-in</p>
                    <p className="text-[10px] text-muted-foreground">Quick log for better predictions</p>
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
            </Card>

            {/* Privacy note */}
            <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium">Your Data is Yours</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    All health data is encrypted and never sold. You can export or delete anytime.
                  </p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Your Jvala Will:</p>
                  <ul className="text-[11px] text-muted-foreground space-y-1">
                    <li>• Track: {data.trackingItems.map(id => 
                      TRACKING_OPTIONS.find(i => i.id === id)?.name
                    ).join(', ')}</li>
                    {data.dataSources.length > 0 && (
                      <li>• Auto-sync from: {data.dataSources.map(id => 
                        DATA_SOURCES.find(s => s.id === id)?.name
                      ).join(', ')}</li>
                    )}
                    <li>• Learn YOUR patterns over time</li>
                    <li>• Predict flares before they happen</li>
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

  return (
    <div className="fixed inset-0 flex flex-col bg-background max-w-md mx-auto">
      {/* Progress bar */}
      {step > 0 && (
        <div className="flex-shrink-0 z-10 glass border-b border-white/10 safe-area-top">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              className="h-8 w-8 rounded-xl"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <Progress value={progress} className="h-1.5" />
            </div>
            <span className="text-[10px] text-muted-foreground w-10 text-right">
              {step + 1}/{totalSteps}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-4">
          {renderStep()}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-shrink-0 glass border-t border-white/10 safe-area-bottom">
        <div className="px-4 py-4">
          <Button 
            onClick={handleNext}
            disabled={step === 0 && data.trackingItems.length === 0}
            className="w-full h-12 text-base"
          >
            {step === totalSteps - 1 ? (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Launch My Health AI
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-5 h-5 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
