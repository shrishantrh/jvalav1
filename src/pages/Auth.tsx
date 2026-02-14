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
import jvalaLogo from "@/assets/jvala-logo.png";
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

    // Set up deep link listener for native OAuth callbacks
    const cleanupDeepLink = setupNativeAuthListener();

    return () => {
      subscription.unsubscribe();
      cleanupDeepLink();
    };
  }, [navigate]);

  // Slow connection detection
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

  /**
   * Detect if we're running on a custom domain (not *.lovable.app).
   * On custom domains the Lovable auth-bridge redirect URI may not be
   * registered with Google, so we fall back to direct Supabase OAuth
   * with skipBrowserRedirect to avoid the redirect_uri_mismatch error.
   */
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
      // Native mobile: use in-app browser + deep link flow
      if (isNative) {
        const result = await startNativeOAuth('google');
        if ('error' in result) throw new Error(result.error);
        await openInNativeBrowser(result.url);
        // Session will be set via deep link listener — don't setLoading(false) here
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
      // Native mobile: use in-app browser + deep link flow
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

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  const canSubmit = isSignUp 
    ? termsAccepted && privacyAccepted && isPasswordStrong(password) && password === confirmPassword && email
    : email && password;

  const resetForm = (signUp: boolean) => {
    setIsSignUp(signUp);
    setTermsAccepted(false);
    setPrivacyAccepted(false);
    setPassword("");
    setConfirmPassword("");
    setEmailError("");
  };

  return (
    <div className="fixed inset-0 flex flex-col max-w-md mx-auto overflow-y-auto scrollbar-hide" style={{ background: 'linear-gradient(155deg, hsl(330 65% 82%) 0%, hsl(310 55% 78%) 35%, hsl(285 50% 75%) 65%, hsl(270 45% 70%) 100%)' }}>
      {/* Orchid ambient gradient orbs — more saturated on darker bg */}
      <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[450px] h-[450px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'hsl(320 70% 70% / 0.35)' }} />
      <div className="absolute bottom-[-40px] right-[-40px] w-[280px] h-[280px] rounded-full blur-[90px] pointer-events-none" style={{ background: 'hsl(280 60% 60% / 0.25)' }} />
      <div className="absolute top-[40%] left-[-60px] w-[220px] h-[220px] rounded-full blur-[100px] pointer-events-none" style={{ background: 'hsl(340 65% 75% / 0.2)' }} />

      <div className="flex-1 flex flex-col px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-6 relative z-10" style={{ fontFamily: "'Playwrite NZ', cursive" }}>
        {/* Logo — compact */}
        <div className="flex flex-col items-center mb-6 animate-in fade-in-0 zoom-in-95 duration-700">
          <div className="relative w-16 h-16 mb-3">
            <div className="absolute -inset-2 rounded-2xl blur-lg" style={{ background: 'linear-gradient(135deg, hsl(330 70% 85% / 0.5), hsl(280 60% 70% / 0.3))' }} />
            <div className="relative w-full h-full flex items-center justify-center !p-3 !rounded-2xl" style={{ background: 'hsl(0 0% 100% / 0.85)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px hsl(330 60% 50% / 0.2), inset 0 1px 0 hsl(0 0% 100% / 0.6)' }}>
              <img src={jvalaLogo} alt="Jvala" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'hsl(0 0% 100% / 0.95)', fontFamily: "'Playwrite NZ', cursive", fontWeight: 400 }}>
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-xs mt-1" style={{ color: 'hsl(0 0% 100% / 0.7)', fontFamily: "'Inter', sans-serif" }}>
            {isSignUp ? "Start your health journey" : "Sign in to continue"}
          </p>
        </div>

        {/* Auth form card — frosted glass on vivid bg */}
        <div className="w-full !rounded-3xl !p-0 animate-in slide-in-from-bottom-4 duration-500" style={{ background: 'hsl(0 0% 100% / 0.2)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid hsl(0 0% 100% / 0.3)', boxShadow: '0 8px 40px hsl(320 50% 30% / 0.15), inset 0 1px 0 hsl(0 0% 100% / 0.4)' }}>
          {/* Tab switcher */}
          <div className="flex p-1.5 mx-4 mt-4 rounded-2xl" style={{ background: 'hsl(0 0% 100% / 0.15)' }}>
            <button
              type="button"
              onClick={() => resetForm(false)}
              className={cn(
                "flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-300",
                !isSignUp
                  ? "text-foreground"
                  : "hover:text-foreground/70"
              )}
              style={!isSignUp ? { background: 'hsl(0 0% 100% / 0.6)', boxShadow: '0 2px 8px hsl(320 50% 30% / 0.1)', color: 'hsl(280 50% 30%)' } : { color: 'hsl(0 0% 100% / 0.7)' }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => resetForm(true)}
              className={cn(
                "flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-300",
                isSignUp
                  ? "text-foreground"
                  : "hover:text-foreground/70"
              )}
              style={isSignUp ? { background: 'hsl(0 0% 100% / 0.6)', boxShadow: '0 2px 8px hsl(320 50% 30% / 0.1)', color: 'hsl(280 50% 30%)' } : { color: 'hsl(0 0% 100% / 0.7)' }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleAuth} className="p-4 pt-3 space-y-3">
            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="email" className="text-[11px] font-semibold pl-0.5" style={{ color: 'hsl(280 40% 30%)', fontFamily: "'Inter', sans-serif" }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(280 50% 45%)' }} />
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
                  className={cn(
                    "h-11 pl-10 rounded-xl transition-all text-foreground",
                    emailError && "border-destructive/50"
                  )}
                  style={{ background: 'hsl(0 0% 100% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.4)', fontFamily: "'Inter', sans-serif" }}
                />
              </div>
              {emailError && (
                <p className="text-[10px] text-destructive flex items-center gap-1 pl-0.5">
                  <AlertCircle className="w-3 h-3" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="password" className="text-[11px] font-semibold pl-0.5" style={{ color: 'hsl(280 40% 30%)', fontFamily: "'Inter', sans-serif" }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(280 50% 45%)' }} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  minLength={6}
                  className="h-11 pl-10 pr-10 rounded-xl transition-all text-foreground"
                  style={{ background: 'hsl(0 0% 100% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.4)', fontFamily: "'Inter', sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isSignUp && <PasswordStrengthBar password={password} />}
            </div>

            {/* Confirm Password */}
            {isSignUp && (
              <div className="space-y-1 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                <label htmlFor="confirmPassword" className="text-[11px] font-semibold pl-0.5" style={{ color: 'hsl(280 40% 30%)', fontFamily: "'Inter', sans-serif" }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(280 50% 45%)' }} />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className={cn(
                      "h-11 pl-10 pr-10 rounded-xl transition-all text-foreground",
                      confirmPassword && password !== confirmPassword && "border-destructive/50"
                    )}
                    style={{ background: 'hsl(0 0% 100% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.4)', fontFamily: "'Inter', sans-serif" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[10px] text-destructive flex items-center gap-1 pl-0.5">
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
                  className="text-[11px] font-medium transition-colors" style={{ color: 'hsl(280 55% 55%)' }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Terms checkboxes */}
            {isSignUp && (
              <div className="space-y-2 p-3 !rounded-xl animate-in fade-in-0 duration-200" style={{ background: 'hsl(0 0% 100% / 0.15)', border: '1px solid hsl(0 0% 100% / 0.2)' }}>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  />
                  <label htmlFor="terms" className="text-[11px] cursor-pointer flex-1" style={{ color: 'hsl(280 40% 30%)', fontFamily: "'Inter', sans-serif" }}>
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="font-medium transition-colors" style={{ color: 'hsl(280 55% 55%)' }}
                    >
                      Terms of Service
                    </button>
                    <span className="text-destructive"> *</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="privacy"
                    checked={privacyAccepted}
                    onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                  />
                  <label htmlFor="privacy" className="text-[11px] cursor-pointer flex-1" style={{ color: 'hsl(280 40% 30%)', fontFamily: "'Inter', sans-serif" }}>
                    <button
                      type="button"
                      onClick={() => setShowPrivacy(true)}
                      className="font-medium transition-colors" style={{ color: 'hsl(280 55% 55%)' }}
                    >
                      Privacy Policy
                    </button>
                    <span className="text-destructive"> *</span>
                  </label>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.97] transition-all duration-200"
              disabled={loading || !canSubmit}
              style={{
                background: 'linear-gradient(135deg, hsl(280 55% 58%) 0%, hsl(300 50% 52%) 100%)',
                boxShadow: '0 4px 16px hsl(280 55% 58% / 0.3), inset 0 1px 0 hsl(280 60% 75% / 0.3)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Please wait...
                </>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid hsl(0 0% 100% / 0.3)' }} />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                <span className="px-3" style={{ color: 'hsl(280 30% 40%)', background: 'transparent', fontFamily: "'Inter', sans-serif" }}>or</span>
              </div>
            </div>

            {/* Social buttons */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="w-full h-11 flex items-center justify-center gap-2.5 !rounded-xl text-xs font-semibold active:scale-[0.97] transition-all duration-200 disabled:opacity-50"
                style={{ background: 'hsl(0 0% 100% / 0.45)', border: '1px solid hsl(0 0% 100% / 0.4)', color: 'hsl(280 40% 25%)', boxShadow: '0 2px 8px hsl(320 50% 30% / 0.08)', fontFamily: "'Inter', sans-serif" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleAppleLogin}
                className="w-full h-11 flex items-center justify-center gap-2.5 !rounded-xl text-xs font-semibold active:scale-[0.97] transition-all duration-200 disabled:opacity-50"
                style={{ background: 'hsl(0 0% 100% / 0.45)', border: '1px solid hsl(0 0% 100% / 0.4)', color: 'hsl(280 40% 25%)', boxShadow: '0 2px 8px hsl(320 50% 30% / 0.08)', fontFamily: "'Inter', sans-serif" }}
              >
                <svg className="w-4 h-4 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Continue with Apple
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-[10px] mt-4 text-center leading-relaxed" style={{ color: 'hsl(0 0% 100% / 0.5)', fontFamily: "'Inter', sans-serif" }}>
          Your health data is encrypted and never shared.
        </p>
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
          <Button onClick={() => { setTermsAccepted(true); setShowTerms(false); }} className="w-full">I Accept</Button>
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
          <Button onClick={() => { setPrivacyAccepted(true); setShowPrivacy(false); }} className="w-full">I Accept</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
