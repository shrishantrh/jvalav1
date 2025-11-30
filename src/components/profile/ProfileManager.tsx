import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Share2, Copy, Check, Pill, AlertTriangle, Stethoscope, Heart } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProfileMedicationInput, type MedicationDetails } from "@/components/ProfileMedicationInput";
import { CONDITIONS } from "@/data/conditions";

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
  const [currentMedications, setCurrentMedications] = useState<MedicationDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile({
          full_name: data.full_name,
          email: data.email,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          biological_sex: data.biological_sex,
          height_cm: data.height_cm,
          weight_kg: data.weight_kg,
          blood_type: data.blood_type,
          timezone: data.timezone,
          conditions: data.conditions || [],
          known_symptoms: data.known_symptoms || [],
          known_triggers: data.known_triggers || [],
          physician_name: data.physician_name,
          physician_email: data.physician_email,
          physician_phone: data.physician_phone,
          physician_practice: data.physician_practice,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone,
          share_enabled: data.share_enabled || false,
          share_token: data.share_token,
          onboarding_completed: data.onboarding_completed || false,
        });

        const profileData = data as any;
        setCurrentMedications(profileData.metadata?.medications || []);

        // Check if onboarding incomplete
        if (!data.onboarding_completed && onRequireOnboarding) {
          onRequireOnboarding();
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          date_of_birth: profile.date_of_birth,
          gender: profile.gender,
          biological_sex: profile.biological_sex,
          height_cm: profile.height_cm,
          weight_kg: profile.weight_kg,
          blood_type: profile.blood_type,
          timezone: profile.timezone,
          conditions: profile.conditions,
          known_symptoms: profile.known_symptoms,
          known_triggers: profile.known_triggers,
          physician_name: profile.physician_name,
          physician_email: profile.physician_email,
          physician_phone: profile.physician_phone,
          physician_practice: profile.physician_practice,
          emergency_contact_name: profile.emergency_contact_name,
          emergency_contact_phone: profile.emergency_contact_phone,
          metadata: { medications: currentMedications } as any,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast({ title: "Profile saved successfully" });
    } catch (error: any) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShare = async (enabled: boolean) => {
    if (!profile) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const shareToken = enabled ? crypto.randomUUID() : null;

      const { error } = await supabase
        .from('profiles')
        .update({
          share_enabled: enabled,
          share_token: shareToken,
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, share_enabled: enabled, share_token: shareToken } : null);
      toast({ title: enabled ? "Sharing enabled" : "Sharing disabled" });
    } catch (error: any) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!" });
  };

  const updateField = (field: keyof ProfileData, value: any) => {
    setProfile(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  // Show warning if onboarding incomplete
  if (!profile.onboarding_completed) {
    return (
      <Card className="border-severity-moderate">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-severity-moderate flex-shrink-0" />
            <div>
              <h3 className="font-medium">Complete Your Profile</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please complete the onboarding to use all features of Jvala.
              </p>
              <Button 
                className="mt-4" 
                onClick={onRequireOnboarding}
              >
                Complete Setup
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const shareUrl = profile.share_token 
    ? `${window.location.origin}/shared-profile?token=${profile.share_token}`
    : '';

  const conditionNames = profile.conditions
    .map(id => CONDITIONS.find(c => c.id === id)?.name || id)
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="personal" className="text-xs">
            <User className="w-3 h-3 mr-1" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="health" className="text-xs">
            <Heart className="w-3 h-3 mr-1" />
            Health
          </TabsTrigger>
          <TabsTrigger value="share" className="text-xs">
            <Share2 className="w-3 h-3 mr-1" />
            Sharing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4 space-y-4">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Full Name</Label>
                  <Input
                    value={profile.full_name || ''}
                    onChange={(e) => updateField('full_name', e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Date of Birth</Label>
                  <Input
                    type="date"
                    value={profile.date_of_birth || ''}
                    onChange={(e) => updateField('date_of_birth', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Gender</Label>
                  <Select value={profile.gender || ''} onValueChange={(v) => updateField('gender', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="non-binary">Non-binary</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer-not">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Height (cm)</Label>
                  <Input
                    type="number"
                    value={profile.height_cm || ''}
                    onChange={(e) => updateField('height_cm', parseInt(e.target.value) || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Weight (kg)</Label>
                  <Input
                    type="number"
                    value={profile.weight_kg || ''}
                    onChange={(e) => updateField('weight_kg', parseFloat(e.target.value) || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Blood Type</Label>
                  <Select value={profile.blood_type || ''} onValueChange={(v) => updateField('blood_type', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                        <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Contact Name</Label>
                <Input
                  value={profile.emergency_contact_name || ''}
                  onChange={(e) => updateField('emergency_contact_name', e.target.value)}
                  placeholder="Emergency contact name"
                />
              </div>
              <div>
                <Label className="text-xs">Phone Number</Label>
                <Input
                  value={profile.emergency_contact_phone || ''}
                  onChange={(e) => updateField('emergency_contact_phone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </TabsContent>

        <TabsContent value="health" className="mt-4 space-y-4">
          {/* Conditions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Conditions</CardTitle>
              <CardDescription className="text-xs">
                These were set during onboarding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {conditionNames.map(name => (
                  <Badge key={name} variant="secondary">{name}</Badge>
                ))}
                {conditionNames.length === 0 && (
                  <p className="text-sm text-muted-foreground">No conditions set</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Medications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Current Medications</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ProfileMedicationInput
                medications={currentMedications}
                onMedicationsChange={setCurrentMedications}
              />
            </CardContent>
          </Card>

          {/* Physician */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Healthcare Provider</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Physician Name</Label>
                  <Input
                    value={profile.physician_name || ''}
                    onChange={(e) => updateField('physician_name', e.target.value)}
                    placeholder="Dr. Smith"
                  />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={profile.physician_phone || ''}
                    onChange={(e) => updateField('physician_phone', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    value={profile.physician_email || ''}
                    onChange={(e) => updateField('physician_email', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Practice</Label>
                  <Input
                    value={profile.physician_practice || ''}
                    onChange={(e) => updateField('physician_practice', e.target.value)}
                    placeholder="Medical center name"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </TabsContent>

        <TabsContent value="share" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Share with Healthcare Providers</CardTitle>
              <CardDescription className="text-xs">
                Generate a secure link to share your health data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Sharing</Label>
                  <p className="text-xs text-muted-foreground">
                    Doctors can view your history and insights
                  </p>
                </div>
                <Switch
                  checked={profile.share_enabled}
                  onCheckedChange={handleToggleShare}
                  disabled={saving}
                />
              </div>

              {profile.share_enabled && shareUrl && (
                <Alert>
                  <Share2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2 mt-2">
                      <Label className="text-xs">Share URL</Label>
                      <div className="flex gap-2">
                        <Input value={shareUrl} readOnly className="text-xs" />
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(shareUrl)}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Anyone with this link can view your profile
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
