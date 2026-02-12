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
import { Loader2, Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";
import { SplashScreen } from "@/components/auth/SplashScreen";
import { PasswordStrengthBar, isPasswordStrong } from "@/components/auth/PasswordStrengthBar";
import { SlowConnectionIndicator } from "@/components/auth/SlowConnectionIndicator";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { cn } from "@/lib/utils";
import { lovable } from "@/integrations/lovable/index";

const Auth = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slowConnection, setSlowConnection] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if already authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setShowSplash(false);
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

  // Slow connection detection
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (loading) {
      timeout = setTimeout(() => {
        setSlowConnection(true);
      }, 5000);
    } else {
      setSlowConnection(false);
    }
    return () => clearTimeout(timeout);
  }, [loading]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
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

  const handleAppleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Apple login failed",
        description: error.message || "Could not sign in with Apple",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) return;
    
    if (isSignUp) {
      if (!termsAccepted || !privacyAccepted) {
        toast({
          title: "Please accept the terms",
          description: "You must accept the Terms of Service and Privacy Policy to create an account.",
          variant: "destructive",
        });
        return;
      }

      if (!isPasswordStrong(password)) {
        toast({
          title: "Weak password",
          description: "Please create a stronger password that meets all requirements.",
          variant: "destructive",
        });
        return;
      }

      if (password !== confirmPassword) {
        toast({
          title: "Passwords don't match",
          description: "Please make sure your passwords match.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setLoading(true);

    try {
      if (isSignUp) {
        const redirectUrl = 'https://jvala.tech/confirm-email';
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });

        if (error) throw error;

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
          title: "Check your email! 📧",
          description: "We've sent you a verification link. Please check your inbox (and spam folder).",
        });
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back! 💜",
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

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  const canSubmit = isSignUp 
    ? termsAccepted && privacyAccepted && isPasswordStrong(password) && password === confirmPassword && email
    : email && password;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-background max-w-md mx-auto">
      {/* Logo and branding */}
      <div className="flex flex-col items-center mb-6 animate-in fade-in-0 zoom-in-95 duration-500">
        <div className="relative w-20 h-20 mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-purple-600 rounded-2xl rotate-6 opacity-20" />
          <div className="relative bg-card rounded-2xl p-3 shadow-lg border">
            <img src={jvalaLogo} alt="Jvala" className="w-full h-full" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Jvala</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your health journey</p>
      </div>

      {/* Auth form */}
      <Card className="w-full p-6 bg-card/80 backdrop-blur-xl border shadow-xl animate-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-lg font-semibold mb-5 text-center">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-foreground">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) validateEmail(e.target.value);
                }}
                onBlur={() => email && validateEmail(email)}
                placeholder="your@email.com"
                required
                disabled={loading}
                className={cn("h-11 pl-10", emailError && "border-destructive")}
              />
            </div>
            {emailError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {emailError}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
                className="h-11 pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Password strength bar for signup */}
            {isSignUp && <PasswordStrengthBar password={password} />}
          </div>

          {/* Confirm Password for Sign Up */}
          {isSignUp && (
            <div className="space-y-1.5 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className={cn(
                    "h-11 pl-10 pr-10",
                    confirmPassword && password !== confirmPassword && "border-destructive"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Passwords don't match
                </p>
              )}
            </div>
          )}

          {/* Forgot Password for Login */}
          {!isSignUp && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-primary hover:underline font-medium"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Terms and Privacy for Sign Up */}
          {isSignUp && (
            <div className="space-y-2.5 p-3 bg-muted/30 rounded-xl animate-in fade-in-0 duration-200">
              <p className="text-[10px] font-medium text-foreground">By creating an account, you agree to:</p>
              
              <div className="flex items-center gap-2.5">
                <Checkbox 
                  id="terms" 
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                />
                <label htmlFor="terms" className="text-xs cursor-pointer flex-1">
                  <button 
                    type="button"
                    onClick={() => setShowTerms(true)} 
                    className="text-primary hover:underline font-medium"
                  >
                    Terms of Service
                  </button>
                  <span className="text-destructive"> *</span>
                </label>
              </div>

              <div className="flex items-center gap-2.5">
                <Checkbox 
                  id="privacy" 
                  checked={privacyAccepted}
                  onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                />
                <label htmlFor="privacy" className="text-xs cursor-pointer flex-1">
                  <button 
                    type="button"
                    onClick={() => setShowPrivacy(true)} 
                    className="text-primary hover:underline font-medium"
                  >
                    Privacy Policy
                  </button>
                  <span className="text-destructive"> *</span>
                </label>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11"
            disabled={loading || !canSubmit}
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
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="px-2 bg-card text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-2">
            {/* Google Sign In */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11"
              disabled={loading}
              onClick={handleGoogleLogin}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            {/* Apple Sign In - Placeholder */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11"
              disabled={loading}
              onClick={handleAppleLogin}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </Button>
          </div>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setTermsAccepted(false);
              setPrivacyAccepted(false);
              setPassword("");
              setConfirmPassword("");
              setEmailError("");
            }}
            className="text-xs text-primary hover:underline font-medium"
            disabled={loading}
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </Card>

      {/* Slow Connection Indicator */}
      <SlowConnectionIndicator show={slowConnection} />

      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog 
        open={showForgotPassword} 
        onOpenChange={setShowForgotPassword}
      />

      {/* Terms Dialog */}
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
                  By accessing or using Jvala ("the App"), you agree to be bound by these Terms of Service.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. Medical Disclaimer</h3>
                <p className="text-muted-foreground">
                  <strong>IMPORTANT:</strong> Jvala does not provide medical advice. The App is designed for informational and tracking purposes only. Always consult with qualified healthcare professionals for medical decisions, diagnoses, or treatment.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. AI-Generated Content</h3>
                <p className="text-muted-foreground">
                  The App uses artificial intelligence to generate insights and predictions. AI-generated content may contain errors and should not be considered medical advice. Always verify any AI-generated information with a healthcare professional before acting on it.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. User Responsibilities</h3>
                <p className="text-muted-foreground">
                  You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account. You agree to provide accurate and complete information when creating your account.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Data Accuracy</h3>
                <p className="text-muted-foreground">
                  While we strive to provide accurate tracking and insights, we cannot guarantee the accuracy of all data. Environmental data, predictions, and correlations are estimates and should be used as general guidance only.
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
            <DialogDescription>Last updated: February 2026</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="text-sm space-y-4">
              <section>
                <h3 className="font-semibold mb-2">1. Information We Collect</h3>
                <p className="text-muted-foreground">
                  We collect account information (email, name), health data you enter (symptoms, triggers, medications, notes), city-level location for environmental correlation, and optional wearable device data.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. How We Use Your Data</h3>
                <p className="text-muted-foreground">
                  Your data is used to provide personalized health insights, identify patterns and correlations, generate predictions, and improve our AI models. We never sell your personal health data.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. Data Security</h3>
                <p className="text-muted-foreground">
                  Your health data is encrypted at rest and in transit using industry-standard security measures. We use secure cloud infrastructure and follow best practices for data protection.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. Your Rights</h3>
                <p className="text-muted-foreground">
                  You can export or delete your data at any time from your profile settings. You have the right to access, correct, or request deletion of your personal information.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Third-Party Services</h3>
                <p className="text-muted-foreground">
                  We may integrate with third-party services (wearables, health platforms) at your request. These integrations are governed by the respective third-party privacy policies.
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
