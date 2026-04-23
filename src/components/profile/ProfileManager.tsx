import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Share2, Pill, AlertTriangle, Heart, Settings2, Search, Plus, X } from 'lucide-react';
import { haptics } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProfileMedicationInput, type MedicationDetails } from "@/components/ProfileMedicationInput";
import { CONDITIONS } from "@/data/conditions";
import { WearableIntegration } from "@/components/wearables/WearableIntegration";
import { EHRIntegration } from "@/components/ehr/EHRIntegration";

interface ProfileData {
  full_name: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  biological_sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  blood_type: string | null;
  timezone: string | null;
  conditions: string[];
  known_symptoms: string[];
  known_triggers: string[];
  physician_name: string | null;
  physician_email: string | null;
  physician_phone: string | null;
  physician_practice: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  share_enabled: boolean;
  share_token: string | null;
  onboarding_completed: boolean;
}

interface ProfileManagerProps {
  onRequireOnboarding?: () => void;
  onProfileUpdated?: (profile: {
    conditions: string[];
    known_symptoms: string[];
    known_triggers: string[];
    medications: MedicationDetails[];
    aiLogCategories: any[];
  }) => void;
}

export const ProfileManager = ({ onRequireOnboarding, onProfileUpdated }: ProfileManagerProps) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentMedications, setCurrentMedications] = useState<MedicationDetails[]>([]);
  const [profileMetadata, setProfileMetadata] = useState<Record<string, any>>({});
  const [conditionQuery, setConditionQuery] = useState('');
  const [symptomQuery, setSymptomQuery] = useState('');
  const [triggerQuery, setTriggerQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        const metadata = ((data as any).metadata as Record<string, any> | null) || {};
        setProfile({
          full_name: data.full_name, email: data.email, date_of_birth: data.date_of_birth,
          gender: data.gender, biological_sex: data.biological_sex, height_cm: data.height_cm,
          weight_kg: data.weight_kg, blood_type: data.blood_type, timezone: data.timezone,
          conditions: data.conditions || [], known_symptoms: data.known_symptoms || [],
          known_triggers: data.known_triggers || [], physician_name: data.physician_name,
          physician_email: data.physician_email, physician_phone: data.physician_phone,
          physician_practice: data.physician_practice, emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone, share_enabled: data.share_enabled || false,
          share_token: data.share_token, onboarding_completed: data.onboarding_completed || false,
        });
        setProfileMetadata(metadata);
        setCurrentMedications(metadata.medications || []);
        if (!data.onboarding_completed && onRequireOnboarding) onRequireOnboarding();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally { setLoading(false); }
  };

  const [previousConditions, setPreviousConditions] = useState<string[]>([]);

  // Track initial conditions for comparison
  useEffect(() => {
    if (profile && previousConditions.length === 0) {
      setPreviousConditions(profile.conditions);
    }
  }, [profile]);

  const filteredConditions = useMemo(() => {
    const selected = new Set(profile?.conditions || []);
    const query = conditionQuery.trim().toLowerCase();
    return CONDITIONS.filter((condition) => {
      if (selected.has(condition.id)) return false;
      if (!query) return true;
      return condition.name.toLowerCase().includes(query) || condition.category.toLowerCase().includes(query);
    }).slice(0, 8);
  }, [conditionQuery, profile?.conditions]);

  const notifyProfileUpdated = (
    nextProfile: ProfileData,
    nextMedications: MedicationDetails[] = currentMedications,
    nextMetadata: Record<string, any> = profileMetadata,
  ) => {
    onProfileUpdated?.({
      conditions: nextProfile.conditions,
      known_symptoms: nextProfile.known_symptoms,
      known_triggers: nextProfile.known_triggers,
      medications: nextMedications,
      aiLogCategories: nextMetadata.aiLogCategories || [],
    });
  };

  const persistHealthState = async (
    nextProfile: ProfileData,
    nextMedications: MedicationDetails[] = currentMedications,
    nextMetadata: Record<string, any> = profileMetadata,
  ) => {
    if (!userId) return;
    await supabase.from('profiles').update({
      conditions: nextProfile.conditions,
      known_symptoms: nextProfile.known_symptoms,
      known_triggers: nextProfile.known_triggers,
      metadata: {
        ...nextMetadata,
        medications: nextMedications,
      } as any,
    }).eq('id', userId);
  };

  const refreshConditionSuggestions = async (nextConditions: string[]) => {
    if (!profile) return;

    let nextSymptoms = profile.known_symptoms;
    let nextTriggers = profile.known_triggers;
    let nextMetadata: Record<string, any> = {
      ...profileMetadata,
      medications: currentMedications,
    };

    if (nextConditions.length > 0) {
      try {
        const conditionNames = nextConditions.map((value) => CONDITIONS.find((c) => c.id === value)?.name || value);
        const { data, error } = await supabase.functions.invoke('generate-suggestions', {
          body: {
            conditions: conditionNames,
            biologicalSex: profile.biological_sex,
            age: null,
          },
        });

        if (error) throw error;

        nextSymptoms = [...new Set([...(profile.known_symptoms || []), ...((data?.symptoms || []) as string[])])];
        nextTriggers = [...new Set([...(profile.known_triggers || []), ...((data?.triggers || []) as string[])])];
        nextMetadata = {
          ...nextMetadata,
          aiLogCategories: data?.logCategories || [],
        };
      } catch (error) {
        console.error('Failed to regenerate suggestions:', error);
      }
    } else {
      nextMetadata = {
        ...nextMetadata,
        aiLogCategories: [],
      };
    }

    const nextProfile: ProfileData = {
      ...profile,
      conditions: nextConditions,
      known_symptoms: nextSymptoms,
      known_triggers: nextTriggers,
    };

    setProfile(nextProfile);
    setProfileMetadata(nextMetadata);
    setPreviousConditions(nextConditions);
    notifyProfileUpdated(nextProfile, currentMedications, nextMetadata);
    void persistHealthState(nextProfile, currentMedications, nextMetadata);
  };

  const addCondition = async (value: string) => {
    if (!profile) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    const matched = CONDITIONS.find((condition) => condition.name.toLowerCase() === trimmed.toLowerCase());
    const normalized = matched?.id || trimmed;
    const exists = profile.conditions.some((condition) => condition.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      setConditionQuery('');
      return;
    }

    haptics.selection();
    setConditionQuery('');
    await refreshConditionSuggestions([...profile.conditions, normalized]);
  };

  const removeCondition = async (value: string) => {
    if (!profile) return;
    haptics.selection();
    await refreshConditionSuggestions(profile.conditions.filter((condition) => condition !== value));
  };

  const updateListField = (field: 'known_symptoms' | 'known_triggers', values: string[]) => {
    if (!profile) return;
    const nextProfile = { ...profile, [field]: values };
    setProfile(nextProfile);
    notifyProfileUpdated(nextProfile);
    void persistHealthState(nextProfile);
  };

  const addListValue = (field: 'known_symptoms' | 'known_triggers', value: string, reset: () => void) => {
    if (!profile) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const currentValues = profile[field];
    if (currentValues.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      reset();
      return;
    }
    haptics.selection();
    reset();
    updateListField(field, [...currentValues, trimmed]);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('profiles').update({
        full_name: profile.full_name, date_of_birth: profile.date_of_birth,
        gender: profile.gender, biological_sex: profile.biological_sex,
        height_cm: profile.height_cm, weight_kg: profile.weight_kg,
        blood_type: profile.blood_type, timezone: profile.timezone,
        conditions: profile.conditions, known_symptoms: profile.known_symptoms,
        known_triggers: profile.known_triggers, physician_name: profile.physician_name,
        physician_email: profile.physician_email, physician_phone: profile.physician_phone,
        physician_practice: profile.physician_practice, emergency_contact_name: profile.emergency_contact_name,
        emergency_contact_phone: profile.emergency_contact_phone,
        metadata: {
          ...profileMetadata,
          medications: currentMedications,
        } as any,
      }).eq('id', user.id);
      if (error) throw error;

      setPreviousConditions(profile.conditions);
      notifyProfileUpdated(profile, currentMedications, {
        ...profileMetadata,
        medications: currentMedications,
      });
      toast({ title: "Profile saved" });
    } catch (error: any) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };


  const updateField = (field: keyof ProfileData, value: any) => {
    setProfile(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  if (!profile.onboarding_completed) {
    return (
      <Card className="glass-card border-0 rounded-3xl">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Complete Your Profile</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please complete the onboarding to use all features.
              </p>
              <Button className="mt-4 rounded-xl" onClick={onRequireOnboarding}>
                Complete Setup
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-4">
      <Tabs defaultValue="personal" onValueChange={() => haptics.selection()} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-10 bg-card/80 backdrop-blur-sm">
          <TabsTrigger value="personal" className="text-xs gap-1.5">
            <User className="w-3.5 h-3.5" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="health" className="text-xs gap-1.5">
            <Heart className="w-3.5 h-3.5" />
            Health
          </TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            Connect
          </TabsTrigger>
        </TabsList>

        {/* ── Personal Tab ── */}
        <TabsContent value="personal" className="mt-4 space-y-4">
          <Card className="glass-card border-0 rounded-3xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
                <Input
                  value={profile.full_name || ''}
                  onChange={(e) => updateField('full_name', e.target.value)}
                  placeholder="Your name"
                  className="h-12 rounded-xl glass-card border-0 mt-1.5 text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Date of Birth</Label>
                  <Input
                    type="date"
                    value={profile.date_of_birth || ''}
                    onChange={(e) => updateField('date_of_birth', e.target.value)}
                    className="h-12 rounded-xl glass-card border-0 mt-1.5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Biological Sex</Label>
                  <Select 
                    value={profile.biological_sex ? profile.biological_sex.charAt(0).toUpperCase() + profile.biological_sex.slice(1).toLowerCase() : ''} 
                    onValueChange={(v) => updateField('biological_sex', v)}
                  >
                    <SelectTrigger className="h-12 rounded-xl glass-card border-0 mt-1.5">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Share Profile */}
          <Card className="glass-card border-0 rounded-3xl">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Share2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Share Profile</p>
                    <p className="text-[10px] text-muted-foreground">Secure doctor sharing link</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">
                  Coming Soon
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Profile sharing is being finalized and will be available shortly.
              </p>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl font-semibold">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </TabsContent>

        {/* ── Health Tab ── */}
        <TabsContent value="health" className="mt-4 space-y-4">
          {/* Conditions */}
          <Card className="glass-card border-0 rounded-3xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold">Your Conditions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {profile.conditions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.conditions.map((value) => {
                    const label = CONDITIONS.find((condition) => condition.id === value)?.name || value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => void removeCondition(value)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        {label}
                        <X className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No conditions added yet.</p>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={conditionQuery}
                  onChange={(e) => setConditionQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addCondition(conditionQuery);
                    }
                  }}
                  placeholder="Search to add a condition..."
                  className="h-12 rounded-2xl border-border bg-card pl-11 pr-14 text-sm"
                />
                {conditionQuery.trim() && (
                  <Button
                    type="button"
                    size="icon"
                    className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-xl"
                    onClick={() => void addCondition(conditionQuery)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {conditionQuery.trim() && filteredConditions.length > 0 && (
                <div className="grid gap-1.5 max-h-44 overflow-y-auto">
                  {filteredConditions.map((condition) => (
                    <button
                      key={condition.id}
                      type="button"
                      onClick={() => void addCondition(condition.id)}
                      className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-2.5 text-left transition-colors hover:border-primary/40"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{condition.name}</div>
                        <div className="text-[10px] text-muted-foreground">{condition.category}</div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Known Symptoms */}
          <Card className="glass-card border-0 rounded-3xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold">Known Symptoms</CardTitle>
              <CardDescription className="text-xs">Symptoms you commonly experience</CardDescription>
            </CardHeader>
             <CardContent className="px-5 pb-5 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {profile.known_symptoms.map(symptom => (
                  <Badge 
                    key={symptom}
                    className="cursor-pointer text-xs py-1 px-2.5 bg-primary/10 text-primary border-0 press-effect rounded-full"
                     onClick={() => updateListField('known_symptoms', profile.known_symptoms.filter(s => s !== symptom))}
                  >
                    {symptom} ×
                  </Badge>
                ))}
              </div>
              <Input
                 value={symptomQuery}
                 placeholder="Type and press Enter to add"
                className="text-sm h-11 rounded-xl glass-card border-0"
                 onChange={(e) => setSymptomQuery(e.target.value)}
                onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     e.preventDefault();
                     addListValue('known_symptoms', symptomQuery, () => setSymptomQuery(''));
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Known Triggers */}
          <Card className="glass-card border-0 rounded-3xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold">Known Triggers</CardTitle>
              <CardDescription className="text-xs">Things that trigger your symptoms</CardDescription>
            </CardHeader>
             <CardContent className="px-5 pb-5 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {profile.known_triggers.map(trigger => (
                  <Badge 
                    key={trigger}
                    variant="outline"
                    className="cursor-pointer text-xs py-1 px-2.5 border-primary/20 press-effect rounded-full"
                     onClick={() => updateListField('known_triggers', profile.known_triggers.filter(t => t !== trigger))}
                  >
                    {trigger} ×
                  </Badge>
                ))}
              </div>
              <Input
                 value={triggerQuery}
                 placeholder="Type and press Enter to add"
                className="text-sm h-11 rounded-xl glass-card border-0"
                 onChange={(e) => setTriggerQuery(e.target.value)}
                onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     e.preventDefault();
                     addListValue('known_triggers', triggerQuery, () => setTriggerQuery(''));
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Medications */}
          <Card className="glass-card border-0 rounded-3xl">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Pill className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Current Medications</CardTitle>
                  <CardDescription className="text-xs">With dosage and schedule</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ProfileMedicationInput 
                medications={currentMedications}
                onMedicationsChange={setCurrentMedications}
              />
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl font-semibold">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </TabsContent>

        {/* ── Connect Tab ── */}
        <TabsContent value="integrations" className="mt-4 space-y-4">
          {userId && <EHRIntegration userId={userId} />}
          <WearableIntegration />
        </TabsContent>
      </Tabs>
    </div>
  );
};
