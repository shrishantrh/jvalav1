import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, User, Share2, Copy, Check, Lock } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const ProfileSettings = () => {
  const [fullName, setFullName] = useState('');
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [sharePassword, setSharePassword] = useState('');
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
        setShareEnabled(profile.share_enabled || false);
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
        .update({ full_name: fullName })
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
      let passwordHash = null;
      let password = '';

      if (enabled) {
        // Generate new share token and password
        shareToken = crypto.randomUUID();
        password = Math.random().toString(36).slice(-8).toUpperCase();
        
        // Hash password
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        setSharePassword(password);
        setShareUrl(`${window.location.origin}/shared-profile?token=${shareToken}`);
      } else {
        setShareUrl('');
        setSharePassword('');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          share_enabled: enabled,
          share_token: shareToken,
          share_password_hash: passwordHash
        })
        .eq('id', user.id);

      if (error) throw error;

      setShareEnabled(enabled);
      toast({ 
        title: enabled ? "Profile sharing enabled" : "Profile sharing disabled",
        description: enabled ? "Share the link and password with your healthcare provider" : undefined
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
            <Share2 className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Share Profile with Healthcare Providers</CardTitle>
              <CardDescription>
                Generate a secure, password-protected link to share your health data with doctors
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
              <Lock className="h-4 w-4" />
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
                  </div>
                  {sharePassword && (
                    <div>
                      <Label className="text-sm font-medium">Access Password</Label>
                      <div className="flex gap-2 mt-1">
                        <Input value={sharePassword} readOnly className="font-mono text-lg font-bold" />
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(sharePassword)}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Share this password with your healthcare provider. Keep it secure!
                      </p>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
