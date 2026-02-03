import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Moon, Sun, LogOut, Shield, FileText, Bell, AlertTriangle, Activity, User as UserIcon, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReminderSettings } from "@/components/profile/ReminderSettings";
import { SmartMedicationReminders } from "@/components/profile/SmartMedicationReminders";
import { cn } from "@/lib/utils";

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

  const SettingsRow = ({ 
    icon: Icon, 
    label, 
    sublabel, 
    onClick, 
    rightElement,
    variant = 'default'
  }: {
    icon: any;
    label: string;
    sublabel?: string;
    onClick?: () => void;
    rightElement?: React.ReactNode;
    variant?: 'default' | 'primary' | 'danger';
  }) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center justify-between w-full p-3 rounded-xl transition-all",
        onClick && "hover:bg-muted press-effect",
        !onClick && "cursor-default"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center",
          variant === 'primary' && "bg-primary/10",
          variant === 'danger' && "bg-destructive/10",
          variant === 'default' && "bg-muted"
        )}>
          <Icon className={cn(
            "w-4.5 h-4.5",
            variant === 'primary' && "text-primary",
            variant === 'danger' && "text-destructive",
            variant === 'default' && "text-muted-foreground"
          )} />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold">{label}</p>
          {sublabel && (
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          )}
        </div>
      </div>
      {rightElement || (onClick && <ChevronRight className="w-4 h-4 text-muted-foreground" />)}
    </button>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-background max-w-md mx-auto">
      {/* Header */}
      <header className="flex-shrink-0 bg-background safe-area-top border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-10 w-10 rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-5 pb-10 scrollbar-hide">
        <div className="space-y-4 stagger-fade-in">
          {/* Consent Warning */}
          {needsAcceptance && (
            <Card className="bg-coral-light border-0">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-coral/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-coral" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-coral-dark">Action Required</p>
                    <p className="text-xs text-coral-dark/70 mt-0.5">
                      Please review and accept our Terms and Privacy Policy.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appearance */}
          <Card>
            <CardContent className="p-2">
              <SettingsRow
                icon={isDarkMode ? Moon : Sun}
                label="Dark Mode"
                sublabel="Switch app theme"
                variant="primary"
                rightElement={
                  <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
                }
              />
            </CardContent>
          </Card>

          {/* Clinician Portal */}
          <Card>
            <CardContent className="p-2">
              <SettingsRow
                icon={Activity}
                label="Clinician Portal"
                sublabel="View clinician dashboard"
                variant="primary"
                onClick={() => navigate('/clinician')}
                rightElement={
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">Demo</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                }
              />
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <SmartMedicationReminders medications={userMedications} />
              <ReminderSettings userEmail={userEmail} />
            </CardContent>
          </Card>

          {/* Legal */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Legal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <SettingsRow
                icon={FileText}
                label="Terms of Service"
                sublabel={termsAccepted ? "✓ Accepted" : undefined}
                onClick={() => setShowTerms(true)}
              />
              <Separator className="my-1" />
              <SettingsRow
                icon={Shield}
                label="Privacy Policy"
                sublabel={privacyAccepted ? "✓ Accepted" : undefined}
                onClick={() => setShowPrivacy(true)}
              />
            </CardContent>
          </Card>

          {/* Account */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {userEmail && (
                <p className="text-xs text-muted-foreground mb-3 truncate">{userEmail}</p>
              )}
              
              <Button
                variant="destructive"
                className="w-full h-11 rounded-xl"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>

          {/* App version */}
          <p className="text-xs text-center text-muted-foreground pt-4">
            Jvala v1.0.0 • Made with 💜
          </p>
        </div>
      </main>

      {/* Terms Dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-md max-h-[85vh] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Terms of Service</DialogTitle>
            <DialogDescription>Last updated: December 2024</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="text-sm space-y-5">
              <section>
                <h3 className="font-bold mb-2">1. Medical Disclaimer</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Jvala does not provide medical advice. Always consult qualified healthcare professionals.
                </p>
              </section>
              <section>
                <h3 className="font-bold mb-2">2. AI-Generated Content</h3>
                <p className="text-muted-foreground leading-relaxed">
                  AI insights may contain errors. Verify before acting on any AI-generated information.
                </p>
              </section>
            </div>
          </ScrollArea>
          {!termsAccepted && (
            <Button onClick={handleAcceptTerms} className="w-full h-12 rounded-xl">
              Accept Terms of Service
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Privacy Dialog */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-md max-h-[85vh] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Privacy Policy</DialogTitle>
            <DialogDescription>Last updated: December 2024</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="text-sm space-y-5">
              <section>
                <h3 className="font-bold mb-2">1. Data Collection</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We collect health data you enter and city-level location for environmental correlation.
                </p>
              </section>
              <section>
                <h3 className="font-bold mb-2">2. Data Security</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your data is encrypted at rest and in transit using industry-standard measures.
                </p>
              </section>
            </div>
          </ScrollArea>
          {!privacyAccepted && (
            <Button onClick={handleAcceptPrivacy} className="w-full h-12 rounded-xl">
              Accept Privacy Policy
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
