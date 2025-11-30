import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Check
} from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";

interface OnboardingData {
  // Demographics
  dateOfBirth: string;
  gender: string;
  biologicalSex: string;
  heightCm: string;
  weightKg: string;
  bloodType: string;
  timezone: string;
  // Health
  conditions: string[];
  symptoms: string[];
  triggers: string[];
  // Physician
  physicianName: string;
  physicianEmail: string;
  physicianPhone: string;
  physicianPractice: string;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];
const BIOLOGICAL_SEXES = ['Male', 'Female', 'Intersex', 'Prefer not to say'];

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
  });

  const steps = [
    { title: "Welcome", icon: Heart },
    { title: "About You", icon: User },
    { title: "Conditions", icon: Activity },
    { title: "Symptoms", icon: Zap },
    { title: "Triggers", icon: Zap },
    { title: "Physician", icon: Stethoscope },
    { title: "Ready", icon: Check },
  ];

  const progress = ((step + 1) / steps.length) * 100;

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
    setData(prev => ({
      ...prev,
      conditions: prev.conditions.includes(conditionId)
        ? prev.conditions.filter(c => c !== conditionId)
        : [...prev.conditions, conditionId]
    }));
  };

  const toggleSymptom = (symptom: string) => {
    setData(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom]
    }));
  };

  const toggleTrigger = (trigger: string) => {
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
      case 0: // Welcome
        return (
          <div className="text-center space-y-6 py-8">
            <div className="w-24 h-24 mx-auto">
              <img src={jvalaLogo} alt="Jvala" className="w-full h-full" />
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-foreground">Welcome to Jvala</h1>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Let's personalize your experience so we can provide immediate insights 
                and help you track what matters most.
              </p>
            </div>
            <div className="space-y-2 text-left max-w-sm mx-auto bg-muted/50 rounded-xl p-4">
              <p className="text-sm font-medium text-foreground">In the next few steps, we'll ask about:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Your basic info
                </li>
                <li className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Your health conditions
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Symptoms & triggers
                </li>
                <li className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary" /> Your physician (optional)
                </li>
              </ul>
            </div>
          </div>
        );

      case 1: // Demographics
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Tell us about yourself</h2>
              <p className="text-sm text-muted-foreground">This helps us provide better analytics and insights</p>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={data.dateOfBirth}
                    onChange={(e) => setData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={data.gender} onValueChange={(v) => setData(prev => ({ ...prev, gender: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Biological Sex (for medical accuracy)</Label>
                <Select value={data.biologicalSex} onValueChange={(v) => setData(prev => ({ ...prev, biologicalSex: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {BIOLOGICAL_SEXES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="170"
                    value={data.heightCm}
                    onChange={(e) => setData(prev => ({ ...prev, heightCm: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="70"
                    value={data.weightKg}
                    onChange={(e) => setData(prev => ({ ...prev, weightKg: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Blood Type</Label>
                <Select value={data.bloodType} onValueChange={(v) => setData(prev => ({ ...prev, bloodType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select blood type" /></SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              All fields are optional but help improve your health insights
            </p>
          </div>
        );

      case 2: // Conditions
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">What conditions do you have?</h2>
              <p className="text-sm text-muted-foreground">Select all that apply - ICD-10 codes shown for medical records</p>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conditions or ICD-10 codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[350px] overflow-y-auto space-y-4 pr-2">
              {Object.entries(groupedConditions).map(([category, conditions]) => (
                conditions.length > 0 && (
                  <div key={category} className="space-y-2">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{category}</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {conditions.map((condition) => (
                        <Button
                          key={condition.id}
                          variant="outline"
                          onClick={() => toggleCondition(condition.id)}
                          className={`h-auto py-2 px-3 justify-between text-left ${
                            data.conditions.includes(condition.id)
                              ? 'bg-primary/10 border-primary text-primary'
                              : ''
                          }`}
                        >
                          <span className="text-xs truncate">{condition.name}</span>
                          {condition.icd10 && (
                            <Badge variant="outline" className="text-[10px] font-mono ml-2">
                              {condition.icd10}
                            </Badge>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>

            {data.conditions.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2 border-t">
                {data.conditions.map(id => {
                  const condition = CONDITIONS.find(c => c.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {condition?.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 3: // Symptoms
        const symptoms = getRelevantSymptoms();
        const selectedConditions = CONDITIONS.filter(c => data.conditions.includes(c.id));
        const recommendedSymptoms = new Set(selectedConditions.flatMap(c => c.commonSymptoms));
        
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">What symptoms do you experience?</h2>
              <p className="text-sm text-muted-foreground">
                {selectedConditions.length > 0 
                  ? "We've highlighted common symptoms for your conditions" 
                  : "Select the symptoms you commonly experience"}
              </p>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
              {recommendedSymptoms.size > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-primary uppercase tracking-wide">Recommended for you</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...recommendedSymptoms].map((symptom) => (
                      <Button
                        key={symptom}
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSymptom(symptom)}
                        className={`h-8 text-xs ${
                          data.symptoms.includes(symptom)
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'border-primary/30'
                        }`}
                      >
                        {symptom}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">All symptoms</h3>
                <div className="flex flex-wrap gap-2">
                  {symptoms.filter(s => !recommendedSymptoms.has(s)).map((symptom) => (
                    <Button
                      key={symptom}
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSymptom(symptom)}
                      className={`h-8 text-xs ${
                        data.symptoms.includes(symptom)
                          ? 'bg-primary/10 border-primary text-primary'
                          : ''
                      }`}
                    >
                      {symptom}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {data.symptoms.length > 0 && (
              <div className="text-sm text-muted-foreground text-center">
                {data.symptoms.length} symptoms selected
              </div>
            )}
          </div>
        );

      case 4: // Triggers
        const triggers = getRelevantTriggers();
        const recommendedTriggers = new Set(
          CONDITIONS.filter(c => data.conditions.includes(c.id)).flatMap(c => c.commonTriggers)
        );
        
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">What triggers your symptoms?</h2>
              <p className="text-sm text-muted-foreground">Select triggers you already know about or suspect</p>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
              {recommendedTriggers.size > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-primary uppercase tracking-wide">Common for your conditions</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...recommendedTriggers].map((trigger) => (
                      <Button
                        key={trigger}
                        variant="outline"
                        size="sm"
                        onClick={() => toggleTrigger(trigger)}
                        className={`h-8 text-xs ${
                          data.triggers.includes(trigger)
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'border-primary/30'
                        }`}
                      >
                        {trigger}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">All triggers</h3>
                <div className="flex flex-wrap gap-2">
                  {triggers.filter(t => !recommendedTriggers.has(t)).map((trigger) => (
                    <Button
                      key={trigger}
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTrigger(trigger)}
                      className={`h-8 text-xs ${
                        data.triggers.includes(trigger)
                          ? 'bg-primary/10 border-primary text-primary'
                          : ''
                      }`}
                    >
                      {trigger}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {data.triggers.length > 0 && (
              <div className="text-sm text-muted-foreground text-center">
                {data.triggers.length} triggers selected
              </div>
            )}
          </div>
        );

      case 5: // Physician
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Add your physician</h2>
              <p className="text-sm text-muted-foreground">
                Optional - We can generate EHR-ready reports with ICD-10 codes to share with your doctor
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="physician-name">Physician Name</Label>
                <Input
                  id="physician-name"
                  placeholder="Dr. Jane Smith"
                  value={data.physicianName}
                  onChange={(e) => setData(prev => ({ ...prev, physicianName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="physician-practice">Practice / Hospital</Label>
                <Input
                  id="physician-practice"
                  placeholder="City Medical Center"
                  value={data.physicianPractice}
                  onChange={(e) => setData(prev => ({ ...prev, physicianPractice: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="physician-email">Email</Label>
                <Input
                  id="physician-email"
                  type="email"
                  placeholder="doctor@hospital.com"
                  value={data.physicianEmail}
                  onChange={(e) => setData(prev => ({ ...prev, physicianEmail: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="physician-phone">Phone</Label>
                <Input
                  id="physician-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={data.physicianPhone}
                  onChange={(e) => setData(prev => ({ ...prev, physicianPhone: e.target.value }))}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              You can skip this step and add physician info later in settings
            </p>
          </div>
        );

      case 6: // Ready
        const selectedConds = CONDITIONS.filter(c => data.conditions.includes(c.id));
        return (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-severity-none/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-severity-none" />
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-foreground">You're all set!</h1>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Based on your profile, we'll provide personalized tracking and 
                start generating insights from your very first log.
              </p>
            </div>

            <div className="space-y-3 text-left max-w-sm mx-auto">
              {selectedConds.length > 0 && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Conditions</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedConds.map(condition => (
                      <Badge key={condition.id} variant="secondary" className="text-xs">
                        {condition.name}
                        {condition.icd10 && <span className="ml-1 opacity-60">({condition.icd10})</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {data.symptoms.length > 0 && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Tracking {data.symptoms.length} symptoms
                  </p>
                </div>
              )}

              {data.triggers.length > 0 && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Watching for {data.triggers.length} triggers
                  </p>
                </div>
              )}

              {data.physicianName && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Physician</p>
                  <p className="text-sm">{data.physicianName}</p>
                  {data.physicianPractice && (
                    <p className="text-xs text-muted-foreground">{data.physicianPractice}</p>
                  )}
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
    if (step === 2 && data.conditions.length === 0) return false;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-soft-lg bg-gradient-card border-0">
        {/* Progress */}
        <div className="p-4 border-b">
          <Progress value={progress} className="h-1.5" />
          <div className="flex justify-between mt-2">
            {steps.map((s, i) => (
              <div
                key={i}
                className={`text-[10px] ${i <= step ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {i === step && s.title}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between p-4 border-t">
          <Button
            variant="ghost"
            onClick={() => setStep(prev => prev - 1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="gap-1"
            >
              {step === 0 ? "Get Started" : "Continue"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => onComplete(data)}
              className="gap-1 bg-gradient-primary"
            >
              Start Tracking
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};