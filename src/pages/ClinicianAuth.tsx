import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Stethoscope, Loader2, ArrowLeft } from "lucide-react";

const bootstrapClinician = async (payload: {
  user_id: string;
  full_name: string;
  email: string;
  npi?: string | null;
  specialty?: string | null;
  practice_name?: string | null;
}) => {
  const { error } = await supabase.functions.invoke('bootstrap-clinician', { body: payload });
  if (error) throw error;
};

/**
 * /clinician/auth — provider sign-in & sign-up.
 * On signup, creates the auth user + clinician_profiles row + grants 'clinician' role.
 * Role grant happens via RPC so that our user_roles RLS doesn't block direct inserts.
 */
export default function ClinicianAuth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [npi, setNpi] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [practiceName, setPracticeName] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) throw error;
      if (data.user) {
        await bootstrapClinician({
          user_id: data.user.id,
          full_name: String(data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Clinician'),
          email: normalizedEmail,
          npi: null,
          specialty: null,
          practice_name: null,
        });
      }
      toast({ title: 'Welcome back' });
      navigate('/clinician/dashboard');
    } catch (err: any) {
      toast({ title: 'Sign in failed', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const redirectTo = `${window.location.origin}/clinician/dashboard`;
      const { data: signupData, error: signupErr } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: redirectTo, data: { full_name: fullName, is_clinician: true } },
      });
      if (signupErr) throw signupErr;

      const userId = signupData.user?.id;
      if (userId) {
        await bootstrapClinician({ user_id: userId, full_name: fullName, email: normalizedEmail, npi: npi || null, specialty: specialty || null, practice_name: practiceName || null });
      }

      toast({
        title: 'Account created',
        description: signupData.session ? 'You are signed in.' : 'Check your email to confirm, then sign in.',
      });
      if (signupData.session) navigate('/clinician/dashboard');
      else setMode('signin');
    } catch (err: any) {
      toast({ title: 'Sign up failed', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="clinical-shell clinical-scroll min-h-screen px-6 py-10">
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center">
      <Card className="w-full max-w-md border border-border bg-card p-7 shadow-md space-y-5">
        <button onClick={() => navigate('/clinician')} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center mx-auto border border-border">
            <Stethoscope className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">{mode === 'signin' ? 'Provider Sign In' : 'Create Provider Account'}</h1>
          <p className="text-xs text-muted-foreground">
            For licensed clinicians using Jvala to monitor patients.
          </p>
        </div>

        <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-3">
          {mode === 'signup' && (
            <>
              <div>
                <Label htmlFor="fullName" className="text-xs">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Dr. Jane Smith" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="npi" className="text-xs">NPI <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="npi" value={npi} onChange={e => setNpi(e.target.value)} placeholder="1234567890" />
                </div>
                <div>
                  <Label htmlFor="specialty" className="text-xs">Specialty</Label>
                  <Input id="specialty" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Rheumatology" />
                </div>
              </div>
              <div>
                <Label htmlFor="practiceName" className="text-xs">Practice / Clinic</Label>
                <Input id="practiceName" value={practiceName} onChange={e => setPracticeName(e.target.value)} placeholder="Optional" />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="text-center text-xs">
          {mode === 'signin' ? (
            <button onClick={() => setMode('signup')} className="text-primary hover:underline">
              New here? Create a provider account
            </button>
          ) : (
            <button onClick={() => setMode('signin')} className="text-primary hover:underline">
              Already have an account? Sign in
            </button>
          )}
        </div>

        <p className="text-[10px] text-center text-muted-foreground leading-tight">
          By creating an account you agree to act as the patient's authorized provider and abide by HIPAA-equivalent data handling.
        </p>
      </Card>
      </div>
    </div>
  );
}
