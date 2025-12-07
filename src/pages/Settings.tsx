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
import { ArrowLeft, Moon, Sun, LogOut, Shield, FileText, Bell, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReminderSettings } from "@/components/profile/ReminderSettings";
import { SmartMedicationReminders } from "@/components/profile/SmartMedicationReminders";

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

  // Initialize dark mode state by reading actual DOM state - never change theme on mount
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Read from DOM to get current state - this is read-only on init
    return document.documentElement.classList.contains('dark');
  });

  // Load user settings
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
    <div className="min-h-screen bg-gradient-subtle">
      <header className="sticky top-0 z-50 glass border-b shadow-soft">
        <div className="container max-w-md mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-9 w-9">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-base font-medical">Settings</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Consent Warning */}
        {needsAcceptance && (
          <Card className="border-severity-moderate bg-severity-moderate-bg/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-severity-moderate flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Action Required</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please review and accept our Terms of Service and Privacy Policy to continue using Jvala.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appearance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Dark Mode</Label>
                <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
              </div>
              <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
            </div>
          </CardContent>
        </Card>

        {/* Reminders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Reminders
            </CardTitle>
            <CardDescription className="text-xs">
              Configure logging reminders and medication alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SmartMedicationReminders medications={userMedications} />
            <ReminderSettings userEmail={userEmail} />
          </CardContent>
        </Card>

        {/* Legal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Legal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Terms of Service */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label>Terms of Service</Label>
                  {termsAccepted && (
                    <p className="text-xs text-severity-none">✓ Accepted</p>
                  )}
                </div>
              </div>
              <Dialog open={showTerms} onOpenChange={setShowTerms}>
                <DialogTrigger asChild>
                  <Button variant={termsAccepted ? "ghost" : "outline"} size="sm">
                    {termsAccepted ? "View" : "Review & Accept"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Terms of Service</DialogTitle>
                    <DialogDescription>Last updated: December 2024</DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[50vh] pr-4">
                    <div className="text-sm space-y-4">
                      <section>
                        <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
                        <p className="text-muted-foreground">
                          By accessing or using Jvala ("the App"), you agree to be bound by these Terms of Service. 
                          If you do not agree, do not use the App.
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">2. Description of Service</h3>
                        <p className="text-muted-foreground">
                          Jvala is a personal health tracking application designed to help users monitor symptoms, 
                          triggers, and health patterns. The App is NOT a medical device and should NOT be used 
                          for medical diagnosis or treatment decisions.
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">3. Medical Disclaimer</h3>
                        <p className="text-muted-foreground">
                          <strong>IMPORTANT:</strong> Jvala does not provide medical advice. The information and 
                          insights generated by the App are for informational purposes only. Always consult with 
                          qualified healthcare professionals for medical decisions. Never disregard professional 
                          medical advice or delay seeking it because of information from the App.
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">4. AI-Generated Content</h3>
                        <p className="text-muted-foreground">
                          The App uses artificial intelligence to generate insights and suggestions. AI-generated 
                          content may contain errors or inaccuracies. Users should verify any AI-generated information 
                          before acting on it, especially regarding health decisions.
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">5. User Responsibilities</h3>
                        <p className="text-muted-foreground">
                          You are responsible for maintaining the confidentiality of your account and for all 
                          activities that occur under your account. You agree to provide accurate information 
                          and to use the App in compliance with all applicable laws.
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">6. Data Accuracy</h3>
                        <p className="text-muted-foreground">
                          The accuracy of insights depends on the data you provide. Jvala is not responsible 
                          for conclusions drawn from incomplete or inaccurate data entry.
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">7. Limitation of Liability</h3>
                        <p className="text-muted-foreground">
                          To the maximum extent permitted by law, Jvala shall not be liable for any indirect, 
                          incidental, special, consequential, or punitive damages, including but not limited to 
                          loss of health, well-being, or any other damages arising from use of the App.
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">8. Changes to Terms</h3>
                        <p className="text-muted-foreground">
                          We reserve the right to modify these terms at any time. Continued use of the App 
                          after changes constitutes acceptance of the modified terms.
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">9. Contact</h3>
                        <p className="text-muted-foreground">
                          For questions about these Terms, contact us at support@jvala.tech
                        </p>
                      </section>
                    </div>
                  </ScrollArea>
                  {!termsAccepted && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center space-x-2 mb-4">
                        <Checkbox id="accept-terms" />
                        <label htmlFor="accept-terms" className="text-sm">
                          I have read and agree to the Terms of Service
                        </label>
                      </div>
                      <Button onClick={handleAcceptTerms} className="w-full">
                        Accept Terms of Service
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            <Separator />

            {/* Privacy Policy */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label>Privacy Policy</Label>
                  {privacyAccepted && (
                    <p className="text-xs text-severity-none">✓ Accepted</p>
                  )}
                </div>
              </div>
              <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
                <DialogTrigger asChild>
                  <Button variant={privacyAccepted ? "ghost" : "outline"} size="sm">
                    {privacyAccepted ? "View" : "Review & Accept"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Privacy Policy</DialogTitle>
                    <DialogDescription>Last updated: December 2024</DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[50vh] pr-4">
                    <div className="text-sm space-y-4">
                      <section>
                        <h3 className="font-semibold mb-2">1. Information We Collect</h3>
                        <p className="text-muted-foreground">
                          <strong>Account Information:</strong> Email address, name (optional), and profile preferences.
                        </p>
                        <p className="text-muted-foreground mt-2">
                          <strong>Health Data:</strong> Symptom logs, severity ratings, triggers, medications, 
                          and any notes you enter. This data is encrypted and stored securely.
                        </p>
                        <p className="text-muted-foreground mt-2">
                          <strong>Location Data:</strong> City-level location (optional) for environmental 
                          correlation analysis. We do NOT collect precise GPS coordinates.
                        </p>
                        <p className="text-muted-foreground mt-2">
                          <strong>Environmental Data:</strong> Weather and air quality information based on 
                          your approximate location.
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">2. How We Use Your Data</h3>
                        <p className="text-muted-foreground">
                          • To provide personalized health tracking and insights<br/>
                          • To generate AI-powered pattern analysis<br/>
                          • To enable data export for healthcare providers<br/>
                          • To improve our services and algorithms (anonymized data only)<br/>
                          • To send reminders if you've opted in
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">3. Data Security</h3>
                        <p className="text-muted-foreground">
                          Your health data is encrypted at rest and in transit. We use industry-standard 
                          security measures including:
                        </p>
                        <p className="text-muted-foreground mt-2">
                          • AES-256 encryption for stored data<br/>
                          • TLS 1.3 for data in transit<br/>
                          • Row-level security policies<br/>
                          • Regular security audits
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">4. Data Sharing</h3>
                        <p className="text-muted-foreground">
                          We never sell your personal health data. We may share data only when:
                        </p>
                        <p className="text-muted-foreground mt-2">
                          • You explicitly request it (e.g., exporting to your doctor)<br/>
                          • Required by law<br/>
                          • Necessary for service providers under confidentiality agreements
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">5. Your Rights</h3>
                        <p className="text-muted-foreground">
                          You have the right to:<br/>
                          • Access all your data<br/>
                          • Export your data in standard formats<br/>
                          • Correct any inaccuracies<br/>
                          • Delete your account and all associated data<br/>
                          • Opt out of non-essential data processing
                        </p>
                      </section>
                      <section>
                        <h3 className="font-semibold mb-2">6. Contact</h3>
                        <p className="text-muted-foreground">
                          For privacy concerns, contact us at privacy@jvala.tech
                        </p>
                      </section>
                    </div>
                  </ScrollArea>
                  {!privacyAccepted && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center space-x-2 mb-4">
                        <Checkbox id="accept-privacy" />
                        <label htmlFor="accept-privacy" className="text-sm">
                          I have read and agree to the Privacy Policy
                        </label>
                      </div>
                      <Button onClick={handleAcceptPrivacy} className="w-full">
                        Accept Privacy Policy
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account</CardTitle>
            {userEmail && (
              <CardDescription className="text-xs">{userEmail}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleSignOut} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}