import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Share2, Pill, AlertTriangle, Heart, Settings2 } from 'lucide-react';
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
}

export const ProfileManager = ({ onRequireOnboarding }: ProfileManagerProps) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentMedications, setCurrentMedications] = useState<MedicationDetails[]>([]);
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
        const profileData = data as any;
        setCurrentMedications(profileData.metadata?.medications || []);
        if (!data.onboarding_completed && onRequireOnboarding) onRequireOnboarding();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally { setLoading(false); }
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
        metadata: { medications: currentMedications } as any,
      }).eq('id', user.id);
      if (error) throw error;
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
        <TabsList className="grid w-full grid-cols-3 h-12 glass-card border-0 rounded-2xl p-1">
          <TabsTrigger value="personal" className="h-full text-xs font-semibold rounded-xl gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:ring-1 data-[state=active]:ring-primary/35">
            <User className="w-3.5 h-3.5" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="health" className="h-full text-xs font-semibold rounded-xl gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:ring-1 data-[state=active]:ring-primary/35">
            <Heart className="w-3.5 h-3.5" />
            Health
          </TabsTrigger>
          <TabsTrigger value="integrations" className="h-full text-xs font-semibold rounded-xl gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:ring-1 data-[state=active]:ring-primary/35">
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
              <CardDescription className="text-xs text-muted-foreground">
                Tap to toggle conditions you're tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex flex-wrap gap-2">
                {profile.conditions
                  .filter(id => !CONDITIONS.find(c => c.id === id))
                  .map(customCondition => (
                    <Badge
                      key={customCondition}
                      className="cursor-pointer text-xs py-1.5 px-3 bg-primary/15 text-primary border-0 press-effect rounded-full"
                      onClick={() => updateField('conditions', profile.conditions.filter(c => c !== customCondition))}
                    >
                      {customCondition} ×
                    </Badge>
                  ))}
                {CONDITIONS.map(condition => (
                  <Badge 
                    key={condition.id}
                    variant={profile.conditions.includes(condition.id) ? "default" : "outline"}
                    className="cursor-pointer text-xs py-1.5 px-3 press-effect rounded-full"
                    onClick={() => {
                      const newConditions = profile.conditions.includes(condition.id)
                        ? profile.conditions.filter(c => c !== condition.id)
                        : [...profile.conditions, condition.id];
                      updateField('conditions', newConditions);
                    }}
                  >
                    {condition.name}
                  </Badge>
                ))}
              </div>
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
                    onClick={() => updateField('known_symptoms', profile.known_symptoms.filter(s => s !== symptom))}
                  >
                    {symptom} ×
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add symptom and press Enter"
                className="text-sm h-11 rounded-xl glass-card border-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    const newSymptom = e.currentTarget.value.trim();
                    if (!profile.known_symptoms.includes(newSymptom)) {
                      updateField('known_symptoms', [...profile.known_symptoms, newSymptom]);
                    }
                    e.currentTarget.value = '';
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
                    onClick={() => updateField('known_triggers', profile.known_triggers.filter(t => t !== trigger))}
                  >
                    {trigger} ×
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add trigger and press Enter"
                className="text-sm h-11 rounded-xl glass-card border-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    const newTrigger = e.currentTarget.value.trim();
                    if (!profile.known_triggers.includes(newTrigger)) {
                      updateField('known_triggers', [...profile.known_triggers, newTrigger]);
                    }
                    e.currentTarget.value = '';
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
          <NotificationSettings />
          <WearableIntegration />
        </TabsContent>
      </Tabs>
    </div>
  );
};
