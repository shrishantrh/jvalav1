import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Moon, Sun, LogOut, Shield, FileText, Bell, AlertTriangle, Activity, User as UserIcon, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReminderSettings } from "@/components/profile/ReminderSettings";
import { SmartMedicationReminders } from "@/components/profile/SmartMedicationReminders";
import { ThemeColorPicker } from "@/components/settings/ThemeColorPicker";
import { haptics } from "@/lib/haptics";

interface MedicationDetails {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

export default function Settings() {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userMedications, setUserMedications] = useState<MedicationDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (user) {
      loadUserSettings();
    }
  }, [user]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('email, metadata')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserEmail(data.email);
        const metadata = data.metadata as any;
        setTermsAccepted(metadata?.terms_accepted || false);
        setPrivacyAccepted(metadata?.privacy_accepted || false);
        setUserMedications(metadata?.medications || []);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDarkMode = (newMode: boolean) => {
    setIsDarkMode(newMode);
    
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('jvala-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('jvala-theme', 'light');
    }
  };

  const handleAcceptTerms = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', user.id)
        .single();

      const currentMetadata = (profile?.metadata as any) || {};
      
      await supabase
        .from('profiles')
        .update({
          metadata: {
            ...currentMetadata,
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString(),
          }
        })
        .eq('id', user.id);

      setTermsAccepted(true);
      setShowTerms(false);
      toast({ title: "Terms accepted" });
    } catch (error) {
      console.error('Failed to accept terms:', error);
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleAcceptPrivacy = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', user.id)
        .single();

      const currentMetadata = (profile?.metadata as any) || {};
      
      await supabase
        .from('profiles')
        .update({
          metadata: {
            ...currentMetadata,
            privacy_accepted: true,
            privacy_accepted_at: new Date().toISOString(),
          }
        })
        .eq('id', user.id);

      setPrivacyAccepted(true);
      setShowPrivacy(false);
      toast({ title: "Privacy policy accepted" });
    } catch (error) {
      console.error('Failed to accept privacy:', error);
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const needsAcceptance = !termsAccepted || !privacyAccepted;

  return (
    <div className="fixed inset-0 flex flex-col bg-background max-w-md mx-auto">
      {/* Safe area spacer for Dynamic Island */}
      <div 
        className="flex-shrink-0 bg-background/80 backdrop-blur-xl"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
      />
      
      {/* Header */}
      <header className="flex-shrink-0 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              haptics.selection();
              navigate('/');
            }} 
            className="h-9 w-9 rounded-xl active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-semibold">Settings</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-8 scrollbar-hide">
        <div className="space-y-3">
          {/* Consent Warning */}
          {needsAcceptance && (
            <Card className="border-severity-moderate glass-card">
              <CardContent className="p-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-severity-moderate flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium">Action Required</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Please review and accept our Terms and Privacy Policy.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Theme Color Picker */}
          <ThemeColorPicker />

          {/* Appearance - Dark Mode */}
          <Card className="glass-card">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {isDarkMode ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                  <div>
                    <p className="text-sm font-medium">Dark Mode</p>
                    <p className="text-[10px] text-muted-foreground">Switch theme</p>
                  </div>
                </div>
                <Switch 
                  checked={isDarkMode} 
                  onCheckedChange={(checked) => {
                    haptics.selection();
                    toggleDarkMode(checked);
                  }} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Clinician Portal */}
          <Card className="glass-card border-primary/20">
            <CardContent className="p-3">
              <button
                onClick={() => navigate('/clinician')}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-primary" />
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">Clinician Portal</p>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Demo</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">View clinician dashboard</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card className="glass-card">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <SmartMedicationReminders medications={userMedications} />
              <ReminderSettings userEmail={userEmail} />
            </CardContent>
          </Card>

          {/* Legal */}
          <Card className="glass-card">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Legal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {/* Terms */}
              <button
                onClick={() => setShowTerms(true)}
                className="flex items-center justify-between w-full p-2 rounded-xl hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Terms of Service</p>
                    {termsAccepted && (
                      <p className="text-[10px] text-severity-none">✓ Accepted</p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              <Separator className="bg-white/10" />

              {/* Privacy */}
              <button
                onClick={() => setShowPrivacy(true)}
                className="flex items-center justify-between w-full p-2 rounded-xl hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Privacy Policy</p>
                    {privacyAccepted && (
                      <p className="text-[10px] text-severity-none">✓ Accepted</p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>

          {/* Account */}
          <Card className="glass-card">
            <CardContent className="p-3">
              <div className="space-y-2">
                {userEmail && (
                  <div className="flex items-center gap-2.5 p-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  </div>
                )}
                
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full h-10"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* App version */}
          <p className="text-[10px] text-center text-muted-foreground pt-2">
            Jvala v1.0.0 • Made with 💜
          </p>
        </div>
      </main>

      {/* Terms Dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Terms of Service</DialogTitle>
            <DialogDescription>Last updated: December 2024</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="text-sm space-y-4">
              <section>
                <h3 className="font-semibold mb-2">1. Medical Disclaimer</h3>
                <p className="text-muted-foreground">
                  Jvala does not provide medical advice. Always consult qualified healthcare professionals.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. AI-Generated Content</h3>
                <p className="text-muted-foreground">
                  AI insights may contain errors. Verify before acting on any AI-generated information.
                </p>
              </section>
            </div>
          </ScrollArea>
          {!termsAccepted && (
            <Button onClick={handleAcceptTerms} className="w-full">
              Accept Terms of Service
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Privacy Dialog */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
            <DialogDescription>Last updated: December 2024</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="text-sm space-y-4">
              <section>
                <h3 className="font-semibold mb-2">1. Data Collection</h3>
                <p className="text-muted-foreground">
                  We collect health data you enter and city-level location for environmental correlation.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. Data Security</h3>
                <p className="text-muted-foreground">
                  Your data is encrypted at rest and in transit using industry-standard measures.
                </p>
              </section>
            </div>
          </ScrollArea>
          {!privacyAccepted && (
            <Button onClick={handleAcceptPrivacy} className="w-full">
              Accept Privacy Policy
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
