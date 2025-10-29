import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, User, Share2, Copy, Check, Pill, Upload, Sparkles } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export const ProfileSettings = () => {
  const [fullName, setFullName] = useState('');
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [currentMedications, setCurrentMedications] = useState<string[]>([]);
  const [newMedication, setNewMedication] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analyzingLab, setAnalyzingLab] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
        setShareEnabled(profile.share_enabled || false);
        // Load current medications from profile metadata or separate field
        const profileData = profile as any; // Type assertion for metadata
        const meds = profileData.metadata?.medications || [];
        setCurrentMedications(meds);
        
        if (profile.share_token) {
          setShareUrl(`${window.location.origin}/shared-profile?token=${profile.share_token}`);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName,
          metadata: { medications: currentMedications } as any
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: "Profile updated successfully" });
    } catch (error: any) {
      toast({ title: "Failed to update profile", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShare = async (enabled: boolean) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let shareToken = null;

      if (enabled) {
        shareToken = crypto.randomUUID();
        setShareUrl(`${window.location.origin}/shared-profile?token=${shareToken}`);
      } else {
        setShareUrl('');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          share_enabled: enabled,
          share_token: shareToken,
          share_password_hash: null // No password needed
        })
        .eq('id', user.id);

      if (error) throw error;

      setShareEnabled(enabled);
      toast({ 
        title: enabled ? "Profile sharing enabled" : "Profile sharing disabled",
        description: enabled ? "Share the link with your healthcare provider" : undefined
      });
    } catch (error: any) {
      toast({ title: "Failed to update sharing settings", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const addMedication = () => {
    if (newMedication.trim()) {
      setCurrentMedications(prev => [...prev, newMedication.trim()]);
      setNewMedication('');
    }
  };

  const removeMedication = (index: number) => {
    setCurrentMedications(prev => prev.filter((_, i) => i !== index));
  };

  const handleLabUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAnalyzingLab(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to storage
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('health-reports')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // TODO: Call AI function to analyze lab report
      toast({ 
        title: "Lab report uploaded", 
        description: "AI analysis coming soon!" 
      });
    } catch (error: any) {
      toast({ 
        title: "Failed to upload lab report", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setAnalyzingLab(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Manage your personal information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Pill className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Current Medications</CardTitle>
              <CardDescription>
                Track medications you're currently taking
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newMedication}
              onChange={(e) => setNewMedication(e.target.value)}
              placeholder="Add medication name"
              onKeyDown={(e) => e.key === 'Enter' && addMedication()}
            />
            <Button onClick={addMedication} disabled={!newMedication.trim()}>
              Add
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {currentMedications.map((med, index) => (
              <Badge key={index} variant="secondary" className="px-3 py-1">
                {med}
                <button
                  onClick={() => removeMedication(index)}
                  className="ml-2 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
            {currentMedications.length === 0 && (
              <p className="text-sm text-muted-foreground">No medications added yet</p>
            )}
          </div>
          
          {currentMedications.length > 0 && (
            <Button onClick={handleSaveProfile} variant="outline" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Medications
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Lab Reports</CardTitle>
              <CardDescription>
                Upload lab reports for AI analysis
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              id="lab-upload"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleLabUpload}
              disabled={analyzingLab}
            />
            <label htmlFor="lab-upload" className="cursor-pointer">
              {analyzingLab ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Analyzing...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Sparkles className="w-8 h-8 text-primary" />
                  <p className="font-medium">Upload Lab Report</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, or PNG</p>
                </div>
              )}
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Share2 className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Share Profile with Healthcare Providers</CardTitle>
              <CardDescription>
                Generate a secure link to share your health data with doctors
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Profile Sharing</Label>
              <p className="text-sm text-muted-foreground">
                Doctors can view all your health history and insights
              </p>
            </div>
            <Switch
              checked={shareEnabled}
              onCheckedChange={handleToggleShare}
              disabled={saving}
            />
          </div>

          {shareEnabled && shareUrl && (
            <Alert>
              <Share2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3 mt-2">
                  <div>
                    <Label className="text-sm font-medium">Share URL</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={shareUrl} readOnly className="text-sm" />
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(shareUrl)}>
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Anyone with this link can view your profile
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};