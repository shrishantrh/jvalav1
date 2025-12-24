import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Google login failed",
        description: error.message || "Could not sign in with Google",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp && (!termsAccepted || !privacyAccepted)) {
      toast({
        title: "Please accept the terms",
        description: "You must accept the Terms of Service and Privacy Policy to create an account.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      if (isSignUp) {
        const redirectUrl = `${window.location.origin}/`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });

        if (error) throw error;

        // Save terms acceptance to profile metadata
        if (data.user) {
          await supabase.from('profiles').update({
            metadata: {
              terms_accepted: true,
              terms_accepted_at: new Date().toISOString(),
              privacy_accepted: true,
              privacy_accepted_at: new Date().toISOString(),
            }
          }).eq('id', data.user.id);
        }

        toast({
          title: "Success!",
          description: "Account created successfully. You can now sign in.",
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred during authentication",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-soft-xl hover-lift animate-scale-in bg-gradient-card border-0">
        <div className="flex flex-col items-center justify-center mb-8">
          <img src={jvalaLogo} alt="jvala" className="w-16 h-16 mb-4" />
          <h1 className="text-3xl font-medical text-foreground">
            Flare Journal <span className="text-lg text-primary">DEMO</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Track your health journey</p>
        </div>

        <h2 className="text-xl font-clinical mb-6 text-center">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h2>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-clinical text-foreground">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
              className="h-11 transition-all focus:shadow-soft-md"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-clinical text-foreground">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
              className="h-11 transition-all focus:shadow-soft-md"
            />
            {isSignUp && (
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            )}
          </div>

          {/* Terms and Privacy for Sign Up */}
          {isSignUp && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-xl">
              <p className="text-xs font-medium text-foreground">By creating an account, you agree to:</p>
              
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="terms" 
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                />
                <div className="flex-1">
                  <label htmlFor="terms" className="text-sm cursor-pointer">
                    <button 
                      type="button"
                      onClick={() => setShowTerms(true)} 
                      className="text-primary hover:underline font-medium"
                    >
                      Terms of Service
                    </button>
                    <span className="text-muted-foreground"> *</span>
                  </label>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox 
                  id="privacy" 
                  checked={privacyAccepted}
                  onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                />
                <div className="flex-1">
                  <label htmlFor="privacy" className="text-sm cursor-pointer">
                    <button 
                      type="button"
                      onClick={() => setShowPrivacy(true)} 
                      className="text-primary hover:underline font-medium"
                    >
                      Privacy Policy
                    </button>
                    <span className="text-muted-foreground"> *</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full mt-6"
            size="lg"
            disabled={loading || (isSignUp && (!termsAccepted || !privacyAccepted))}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Please wait...
              </>
            ) : (
              isSignUp ? "Create Account" : "Sign In"
            )}
          </Button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            disabled={loading}
            onClick={handleGoogleLogin}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setTermsAccepted(false);
              setPrivacyAccepted(false);
            }}
            className="text-sm text-primary hover:underline font-clinical transition-all"
            disabled={loading}
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </Card>

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
          <Button onClick={() => { setTermsAccepted(true); setShowTerms(false); }} className="w-full">
            I Accept
          </Button>
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
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. How We Use Your Data</h3>
                <p className="text-muted-foreground">
                  • To provide personalized health tracking and insights<br/>
                  • To generate AI-powered pattern analysis<br/>
                  • To enable data export for healthcare providers<br/>
                  • To improve our services (anonymized data only)<br/>
                  • To send reminders if you've opted in
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. Data Security</h3>
                <p className="text-muted-foreground">
                  Your health data is encrypted at rest and in transit. We use industry-standard 
                  security measures including AES-256 encryption, TLS 1.3, and row-level security policies.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. Data Sharing</h3>
                <p className="text-muted-foreground">
                  We never sell your data. We only share data with third parties when: you explicitly 
                  request it (e.g., exporting to your doctor), required by law, or necessary for 
                  essential service providers under strict confidentiality agreements.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Your Rights</h3>
                <p className="text-muted-foreground">
                  You have the right to: access your data, export your data, correct inaccuracies, 
                  delete your account and all data, and opt out of non-essential data processing.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. Contact</h3>
                <p className="text-muted-foreground">
                  For privacy concerns, contact privacy@jvala.tech
                </p>
              </section>
            </div>
          </ScrollArea>
          <Button onClick={() => { setPrivacyAccepted(true); setShowPrivacy(false); }} className="w-full">
            I Accept
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;