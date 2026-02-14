import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react";
import { SplashScreen } from "@/components/auth/SplashScreen";
import { PasswordStrengthBar, isPasswordStrong } from "@/components/auth/PasswordStrengthBar";
import { SlowConnectionIndicator } from "@/components/auth/SlowConnectionIndicator";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { cn } from "@/lib/utils";
import { lovable } from "@/integrations/lovable/index";
import { isNative } from "@/lib/capacitor";
import { startNativeOAuth, openInNativeBrowser, setupNativeAuthListener } from "@/lib/nativeAuth";

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

  // Check if already authenticated + set up native deep link listener
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

    const cleanupDeepLink = setupNativeAuthListener();

    return () => {
      subscription.unsubscribe();
      cleanupDeepLink();
    };
  }, [navigate]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (loading) {
      timeout = setTimeout(() => setSlowConnection(true), 5000);
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

  const isCustomDomain = () => {
    const host = window.location.hostname;
    return (
      !host.includes("lovable.app") &&
      !host.includes("lovableproject.com") &&
      !host.includes("localhost")
    );
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      if (isNative) {
        const result = await startNativeOAuth('google');
        if ('error' in result) throw new Error(result.error);
        await openInNativeBrowser(result.url);
        return;
      }

      if (isCustomDomain()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        }
      } else {
        const { error } = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (error) throw error;
      }
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
      if (isNative) {
        const result = await startNativeOAuth('apple');
        if ('error' in result) throw new Error(result.error);
        await openInNativeBrowser(result.url);
        return;
      }

      if (isCustomDomain()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "apple",
          options: {
            redirectTo: window.location.origin,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        }
      } else {
        const { error } = await lovable.auth.signInWithOAuth("apple", {
          redirect_uri: window.location.origin,
        });
        if (error) throw error;
      }
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

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  const canSubmit = isSignUp 
    ? termsAccepted && privacyAccepted && isPasswordStrong(password) && password === confirmPassword && email
    : email && password;

  return (
    <div className="fixed inset-0 flex flex-col max-w-md mx-auto overflow-hidden" style={{ background: 'linear-gradient(170deg, hsl(280 45% 8%) 0%, hsl(300 50% 12%) 35%, hsl(270 55% 15%) 65%, hsl(260 50% 10%) 100%)' }}>
      
      {/* Celestial orbs */}
      <div className="absolute top-[-8%] right-[-15%] w-[280px] h-[280px] rounded-full opacity-60 animate-pulse" style={{ background: 'radial-gradient(circle, hsl(280 60% 50% / 0.3) 0%, hsl(300 50% 40% / 0.1) 60%, transparent 80%)' }} />
      <div className="absolute top-[5%] left-[-10%] w-[180px] h-[180px] rounded-full opacity-40" style={{ background: 'radial-gradient(circle, hsl(320 70% 55% / 0.25) 0%, transparent 70%)' }} />
      <div className="absolute top-[20%] right-[10%] w-[120px] h-[120px] rounded-full opacity-50" style={{ background: 'radial-gradient(circle, hsl(260 80% 70% / 0.2) 0%, transparent 60%)' }} />
      <div className="absolute bottom-[15%] left-[-5%] w-[200px] h-[200px] rounded-full opacity-30" style={{ background: 'radial-gradient(circle, hsl(290 60% 45% / 0.2) 0%, transparent 70%)' }} />
      
      {/* Tiny stars */}
      <div className="absolute top-[12%] left-[20%] w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
      <div className="absolute top-[8%] right-[30%] w-1 h-1 rounded-full bg-white/20" />
      <div className="absolute top-[25%] left-[70%] w-1 h-1 rounded-full bg-white/25 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-[18%] left-[45%] w-0.5 h-0.5 rounded-full bg-white/40" />
      <div className="absolute top-[30%] right-[20%] w-1 h-1 rounded-full bg-white/15 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="flex-1 flex flex-col px-7 relative z-10 overflow-y-auto">
        
        {/* Top spacer + branding */}
        <div className="pt-[22vh] pb-6 animate-in fade-in-0 duration-700">
          <h1 className="text-[3.5rem] font-extrabold leading-none tracking-tight" style={{ color: 'white' }}>
            Jvala
          </h1>
          <p className="text-sm mt-2.5 font-medium" style={{ color: 'hsl(300 30% 75%)' }}>
            {isSignUp ? 'Create your account' : 'Sign in with email address'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-3.5 animate-in slide-in-from-bottom-4 duration-500">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'hsl(300 20% 55%)' }} />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              onBlur={() => email && validateEmail(email)}
              placeholder="Yourname@gmail.com"
              required
              disabled={loading}
              className={cn(
                "w-full h-14 pl-12 pr-4 rounded-2xl text-base font-medium placeholder:font-normal transition-all duration-300 outline-none",
                "border focus:ring-2",
                emailError ? "border-red-500/50" : "border-white/10 focus:border-white/20 focus:ring-purple-400/20"
              )}
              style={{ 
                background: 'hsl(280 40% 15% / 0.6)',
                backdropFilter: 'blur(20px)',
                color: 'white',
              }}
            />
            {emailError && (
              <p className="text-xs mt-1.5 pl-1 flex items-center gap-1" style={{ color: 'hsl(0 80% 65%)' }}>
                <AlertCircle className="w-3 h-3" />
                {emailError}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'hsl(300 20% 55%)' }} />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
              className="w-full h-14 pl-12 pr-12 rounded-2xl text-base font-medium transition-all duration-300 outline-none border border-white/10 focus:border-white/20 focus:ring-2 focus:ring-purple-400/20"
              style={{ 
                background: 'hsl(280 40% 15% / 0.6)',
                backdropFilter: 'blur(20px)',
                color: 'white',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'hsl(300 20% 50%)' }}
            >
              {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
            </button>
          </div>

          {isSignUp && <PasswordStrengthBar password={password} />}

          {/* Confirm Password */}
          {isSignUp && (
            <div className="relative animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'hsl(300 20% 55%)' }} />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                disabled={loading}
                className={cn(
                  "w-full h-14 pl-12 pr-12 rounded-2xl text-base font-medium transition-all duration-300 outline-none border focus:ring-2 focus:ring-purple-400/20",
                  confirmPassword && password !== confirmPassword ? "border-red-500/50" : "border-white/10 focus:border-white/20"
                )}
                style={{ 
                  background: 'hsl(280 40% 15% / 0.6)',
                  backdropFilter: 'blur(20px)',
                  color: 'white',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'hsl(300 20% 50%)' }}
              >
                {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs mt-1.5 pl-1 flex items-center gap-1" style={{ color: 'hsl(0 80% 65%)' }}>
                  <AlertCircle className="w-3 h-3" />
                  Passwords don't match
                </p>
              )}
            </div>
          )}

          {/* Forgot password */}
          {!isSignUp && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs font-medium transition-colors hover:brightness-125"
                style={{ color: 'hsl(300 50% 70%)' }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Terms for signup */}
          {isSignUp && (
            <div className="space-y-2.5 p-4 rounded-2xl animate-in fade-in-0 duration-200" style={{ background: 'hsl(280 40% 15% / 0.4)', border: '1px solid hsl(300 30% 30% / 0.3)' }}>
              <p className="text-[10px] font-semibold" style={{ color: 'hsl(300 20% 65%)' }}>By creating an account, you agree to:</p>
              
              <div className="flex items-center gap-2.5">
                <Checkbox 
                  id="terms" 
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="border-white/20 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                />
                <label htmlFor="terms" className="text-xs cursor-pointer flex-1">
                  <button 
                    type="button"
                    onClick={() => setShowTerms(true)} 
                    className="font-medium transition-colors hover:brightness-125"
                    style={{ color: 'hsl(300 50% 70%)' }}
                  >
                    Terms of Service
                  </button>
                  <span style={{ color: 'hsl(0 80% 65%)' }}> *</span>
                </label>
              </div>

              <div className="flex items-center gap-2.5">
                <Checkbox 
                  id="privacy" 
                  checked={privacyAccepted}
                  onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                  className="border-white/20 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                />
                <label htmlFor="privacy" className="text-xs cursor-pointer flex-1">
                  <button 
                    type="button"
                    onClick={() => setShowPrivacy(true)} 
                    className="font-medium transition-colors hover:brightness-125"
                    style={{ color: 'hsl(300 50% 70%)' }}
                  >
                    Privacy Policy
                  </button>
                  <span style={{ color: 'hsl(0 80% 65%)' }}> *</span>
                </label>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full h-14 rounded-2xl text-base font-bold text-white transition-all duration-300 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none relative overflow-hidden"
            style={{ 
              background: 'linear-gradient(135deg, hsl(320 70% 50%) 0%, hsl(270 70% 55%) 50%, hsl(250 65% 55%) 100%)',
              boxShadow: '0 8px 32px hsl(300 60% 45% / 0.35), inset 0 1px 0 hsl(300 80% 80% / 0.2)',
            }}
          >
            {/* Glossy highlight */}
            <div className="absolute inset-x-0 top-0 h-[45%] rounded-t-2xl" style={{ background: 'linear-gradient(to bottom, hsl(0 0% 100% / 0.15), transparent)' }} />
            <span className="relative z-10">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Please wait...
                </span>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </span>
          </button>

          {/* Divider */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid hsl(300 30% 30% / 0.3)' }} />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
              <span className="px-4" style={{ color: 'hsl(300 20% 50%)', background: 'transparent' }}>Or continue with</span>
            </div>
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="h-13 flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white/90 active:scale-[0.96] transition-all duration-200 disabled:opacity-50"
              style={{ 
                background: 'hsl(280 40% 18% / 0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid hsl(300 30% 30% / 0.3)',
              }}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleAppleLogin}
              className="h-13 flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white/90 active:scale-[0.96] transition-all duration-200 disabled:opacity-50"
              style={{ 
                background: 'hsl(280 40% 18% / 0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid hsl(300 30% 30% / 0.3)',
              }}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="white">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Apple
            </button>
          </div>

          {/* Toggle sign up / sign in */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setTermsAccepted(false);
                setPrivacyAccepted(false);
                setPassword("");
                setConfirmPassword("");
                setEmailError("");
              }}
              className="text-xs font-medium transition-colors hover:brightness-125"
              style={{ color: 'hsl(300 30% 60%)' }}
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-auto pb-8 pt-6 text-center">
          <p className="text-[10px] leading-relaxed" style={{ color: 'hsl(300 15% 40%)' }}>
            By registering you agree to our{' '}
            <button type="button" onClick={() => setShowTerms(true)} className="underline hover:brightness-125" style={{ color: 'hsl(300 40% 60%)' }}>
              Terms
            </button>
            {' & '}
            <button type="button" onClick={() => setShowPrivacy(true)} className="underline hover:brightness-125" style={{ color: 'hsl(300 40% 60%)' }}>
              Privacy Policy
            </button>
          </p>
        </div>
      </div>

      <SlowConnectionIndicator show={slowConnection} />
      <ForgotPasswordDialog open={showForgotPassword} onOpenChange={setShowForgotPassword} />

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
                <p className="text-muted-foreground">By accessing or using Jvala ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. Medical Disclaimer</h3>
                <p className="text-muted-foreground"><strong>IMPORTANT:</strong> Jvala does not provide medical advice, diagnosis, or treatment. The App is designed for informational and personal health tracking purposes only. Always consult with qualified healthcare professionals for medical decisions.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. AI-Generated Content</h3>
                <p className="text-muted-foreground">The App uses artificial intelligence to generate insights, predictions, and correlations. AI-generated content may contain inaccuracies and should never be considered medical advice.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. User Responsibilities</h3>
                <p className="text-muted-foreground">You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. HealthKit & Health Data</h3>
                <p className="text-muted-foreground">The App may integrate with Apple HealthKit to read physiological data. This data is used solely for health tracking and is never used for advertising, data mining, or sold to third parties.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. Account Deletion</h3>
                <p className="text-muted-foreground">You may delete your account at any time from Settings. Deletion permanently removes all your data and is irreversible.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">7. Limitation of Liability</h3>
                <p className="text-muted-foreground">Jvala shall not be liable for any damages resulting from your use of the App, including health outcomes based on App data.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">8. Contact</h3>
                <p className="text-muted-foreground">For questions, contact us at support@jvala.tech.</p>
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
                <p className="text-muted-foreground">We collect: account information (email), health data you enter (symptoms, triggers, medications, notes, photos, voice recordings), city-level location for environmental correlation, and optional wearable device data.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. How We Use Your Data</h3>
                <p className="text-muted-foreground">Your data is used exclusively for personalized health tracking, AI-powered insights, and clinical report generation. We never sell, rent, or trade your personal health data.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. Apple HealthKit Data</h3>
                <p className="text-muted-foreground">HealthKit data is used solely for improving your health management. It is never used for advertising, never disclosed to third parties, and never stored in iCloud.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. Data Security</h3>
                <p className="text-muted-foreground">Your data is encrypted at rest and in transit. Row-Level Security ensures only you can access your own data.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Your Rights</h3>
                <p className="text-muted-foreground">You can export your data at any time, edit any entry, permanently delete your account and all data from Settings, and disconnect wearable integrations.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. Push Notifications</h3>
                <p className="text-muted-foreground">Notifications are optional, used only for logging reminders, and never contain protected health information or advertising.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">7. Contact</h3>
                <p className="text-muted-foreground">For questions, contact us at support@jvala.tech.</p>
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
