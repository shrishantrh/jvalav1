import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Moon, Sun, LogOut, Shield, FileText, Bell, AlertTriangle, Activity, User as UserIcon, ChevronRight, Trash2, Mail, Loader2, HelpCircle } from "lucide-react";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;

      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });

      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      toast({
        title: "Deletion failed",
        description: error.message || "Could not delete your account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
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

          {/* Clinician Portal - No demo label */}
          <Card className="glass-card border-primary/20">
            <CardContent className="p-3">
              <button
                onClick={() => navigate('/clinician')}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Clinician Portal</p>
                    <p className="text-[10px] text-muted-foreground">Share data with your doctor</p>
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

          {/* Support */}
          <Card className="glass-card">
            <CardContent className="p-3">
              <a
                href="mailto:support@jvala.tech"
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Help & Support</p>
                    <p className="text-[10px] text-muted-foreground">support@jvala.tech</p>
                  </div>
                </div>
                <Mail className="w-4 h-4 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>

          {/* Account */}
          <Card className="glass-card">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-2">
                {userEmail && (
                  <div className="flex items-center gap-2.5 p-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  </div>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-10"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>

                <Separator className="bg-white/10 my-2" />

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
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

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-left space-y-2 pt-2">
              <p>This action is <strong>permanent and irreversible</strong>. All of the following will be deleted:</p>
              <ul className="text-xs space-y-1 list-disc pl-4">
                <li>Your profile and personal information</li>
                <li>All flare entries and health logs</li>
                <li>Medication logs and correlations</li>
                <li>AI insights and weekly reports</li>
                <li>Physician sharing links</li>
                <li>Wearable device connections</li>
              </ul>
              <p className="pt-2">Type <strong>DELETE</strong> to confirm:</p>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="text-center font-mono tracking-widest"
            disabled={deleting}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText("");
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Everything"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terms Dialog - Comprehensive */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Terms of Service</DialogTitle>
            <DialogDescription>Last updated: February 2026</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="text-sm space-y-4">
              <section>
                <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
                <p className="text-muted-foreground">
                  By accessing or using Jvala ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. Medical Disclaimer</h3>
                <p className="text-muted-foreground">
                  <strong>IMPORTANT:</strong> Jvala does not provide medical advice, diagnosis, or treatment. The App is designed for informational and personal health tracking purposes only. Always consult with qualified healthcare professionals for medical decisions. Never disregard professional medical advice or delay seeking it because of information provided by the App.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. AI-Generated Content</h3>
                <p className="text-muted-foreground">
                  The App uses artificial intelligence to generate insights, predictions, and correlations. AI-generated content may contain inaccuracies and should never be considered medical advice. All AI insights include a "Discuss with your doctor" recommendation. You should always verify AI-generated information with a qualified healthcare professional before making health decisions.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. User Responsibilities</h3>
                <p className="text-muted-foreground">
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You agree to provide accurate information and to keep your account information current.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Data Accuracy</h3>
                <p className="text-muted-foreground">
                  While we strive for accuracy, we cannot guarantee the precision of all data including environmental readings, wearable metrics, predictions, and correlations. These are estimates and should be used as general guidance only.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. HealthKit & Health Data Integration</h3>
                <p className="text-muted-foreground">
                  The App may integrate with Apple HealthKit and other health platforms to read physiological data (heart rate, HRV, sleep, steps, SpO2). This data is used solely for health tracking correlation and is never used for advertising, data mining, or sold to third parties. The App does not write data to HealthKit. Health data is not stored in iCloud.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">7. Account Deletion</h3>
                <p className="text-muted-foreground">
                  You may delete your account at any time from Settings. Account deletion permanently removes all your data including health logs, insights, exports, and personal information. This action is irreversible.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">8. Intellectual Property</h3>
                <p className="text-muted-foreground">
                  All content, features, and functionality of the App are owned by Jvala and are protected by intellectual property laws. Your health data remains yours.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">9. Limitation of Liability</h3>
                <p className="text-muted-foreground">
                  To the maximum extent permitted by law, Jvala shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the App, including but not limited to health outcomes based on App data.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">10. Contact</h3>
                <p className="text-muted-foreground">
                  For questions about these Terms, contact us at support@jvala.tech.
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

      {/* Privacy Dialog - Comprehensive with HealthKit disclosures */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
            <DialogDescription>Last updated: February 2026</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="text-sm space-y-4">
              <section>
                <h3 className="font-semibold mb-2">1. Information We Collect</h3>
                <p className="text-muted-foreground">
                  We collect the following categories of information:
                </p>
                <ul className="text-muted-foreground list-disc pl-4 mt-1 space-y-1 text-xs">
                  <li><strong>Account information:</strong> Email address and authentication credentials</li>
                  <li><strong>Health data you enter:</strong> Symptoms, triggers, severity, medications, notes, photos, and voice recordings</li>
                  <li><strong>Location data:</strong> City-level location (coarse) for environmental correlation — never precise GPS</li>
                  <li><strong>Environmental data:</strong> Weather, air quality, UV index, and pollen data fetched from public APIs based on your city</li>
                  <li><strong>Wearable data:</strong> Heart rate, HRV, SpO2, sleep, and step data from Apple HealthKit, Health Connect, or Fitbit (with your explicit permission)</li>
                </ul>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. How We Use Your Data</h3>
                <p className="text-muted-foreground">
                  Your data is used exclusively to:
                </p>
                <ul className="text-muted-foreground list-disc pl-4 mt-1 space-y-1 text-xs">
                  <li>Provide personalized health tracking and pattern recognition</li>
                  <li>Generate AI-powered health insights and correlations</li>
                  <li>Create clinical-grade health reports for physician sharing</li>
                  <li>Improve the App's accuracy and features</li>
                </ul>
                <p className="text-muted-foreground mt-2 font-medium">
                  We never sell, rent, or trade your personal health data. Health data is never used for advertising or data mining.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. Apple HealthKit Data</h3>
                <p className="text-muted-foreground">
                  In compliance with Apple's guidelines (Section 5.1.3), HealthKit data is:
                </p>
                <ul className="text-muted-foreground list-disc pl-4 mt-1 space-y-1 text-xs">
                  <li>Used solely for improving your health management within the App</li>
                  <li>Never used for advertising or other use-based data mining purposes</li>
                  <li>Never disclosed to third parties without your explicit consent</li>
                  <li>Never stored in iCloud</li>
                  <li>Read-only — the App does not write data to HealthKit</li>
                </ul>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. Data Security</h3>
                <p className="text-muted-foreground">
                  Your health data is encrypted at rest and in transit using industry-standard TLS encryption. We use secure cloud infrastructure with Row-Level Security (RLS) policies ensuring only you can access your own data. Authentication tokens are stored securely and never exposed.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Data Sharing</h3>
                <p className="text-muted-foreground">
                  You may choose to share health reports with your physician via time-limited, password-protected sharing links. These links expire automatically. No data is shared without your explicit action.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. Third-Party Services</h3>
                <p className="text-muted-foreground">
                  We integrate with third-party services only at your request (Apple HealthKit, Fitbit). These integrations are governed by their respective privacy policies. We use Google Gemini AI for insight generation — your data is processed but not stored by the AI provider.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">7. Your Rights</h3>
                <p className="text-muted-foreground">
                  You have the right to:
                </p>
                <ul className="text-muted-foreground list-disc pl-4 mt-1 space-y-1 text-xs">
                  <li><strong>Access:</strong> Export your data at any time via clinical PDF or structured formats (FHIR, MedDRA)</li>
                  <li><strong>Correct:</strong> Edit any of your health entries from the history view</li>
                  <li><strong>Delete:</strong> Permanently delete your account and all associated data from Settings</li>
                  <li><strong>Revoke:</strong> Disconnect wearable integrations at any time</li>
                </ul>
              </section>
              <section>
                <h3 className="font-semibold mb-2">8. Push Notifications</h3>
                <p className="text-muted-foreground">
                  Push notifications are optional and used only for health logging reminders. Notifications never contain protected health information (PHI), personal medical data, or advertising content.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">9. Children's Privacy</h3>
                <p className="text-muted-foreground">
                  Jvala is not intended for use by children under the age of 13. We do not knowingly collect personal information from children.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">10. Changes to This Policy</h3>
                <p className="text-muted-foreground">
                  We may update this Privacy Policy from time to time. We will notify you of material changes via in-app notification or email.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">11. Contact Us</h3>
                <p className="text-muted-foreground">
                  For questions or concerns about this Privacy Policy or your data, contact us at support@jvala.tech.
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
