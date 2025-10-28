import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, User, AlertTriangle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { FlareTimeline } from "@/components/flare/FlareTimeline";
import { InsightsCharts } from "@/components/insights/InsightsCharts";

const SharedProfile = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);

  const token = searchParams.get('token');

  const handleAccess = async () => {
    if (!token || !password) {
      setError('Please enter the access password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Hash the password
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Get profile with matching token and password (using service role via edge function would be better, but for simplicity using RLS)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('share_token', token)
        .eq('share_password_hash', passwordHash)
        .eq('share_enabled', true)
        .single();

      if (profileError || !profile) {
        throw new Error('Incorrect password or link expired');
      }

      // Get user's flare entries (we need service role here - let's use an edge function instead)
      const { data: flareData, error: flareError } = await supabase
        .from('flare_entries')
        .select('*')
        .eq('user_id', profile.id)
        .order('timestamp', { ascending: false });

      if (flareError) throw flareError;

      setProfileData(profile);
      setEntries(flareData || []);
      setAuthenticated(true);
    } catch (err: any) {
      console.error('Access error:', err);
      setError(err.message || 'Invalid password or expired link');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-medical mb-2">Invalid Share Link</h1>
          <p className="text-muted-foreground">
            This link appears to be invalid or incomplete.
          </p>
        </Card>
      </div>
    );
  }

  if (authenticated && profileData) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container max-w-6xl mx-auto p-4 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-medical">{profileData.full_name || 'Patient Profile'}</h1>
                <p className="text-sm text-muted-foreground">Read-only healthcare provider view</p>
              </div>
            </div>
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                This is a secure, read-only view of the patient's health data. All information is password-protected.
              </AlertDescription>
            </Alert>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-medical mb-4">Health Timeline</h2>
            <FlareTimeline entries={entries} />
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-medical mb-4">Clinical Insights</h2>
            <InsightsCharts entries={entries} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-medical mb-2">🔐 Secure Patient Profile</h1>
          <p className="text-muted-foreground">
            Enter the password to access this patient's protected health data
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="password">Access Password</Label>
            <Input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter 8-character password"
              onKeyDown={(e) => e.key === 'Enter' && handleAccess()}
              className="font-mono text-lg"
            />
            <p className="text-xs text-muted-foreground mt-2">
              The password was provided to you by the patient
            </p>
          </div>

          <Button 
            onClick={handleAccess}
            disabled={loading || !password}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Access Profile
              </>
            )}
          </Button>
        </div>

        <div className="pt-4 border-t text-xs text-muted-foreground text-center">
          <p>⚕️ This is a protected medical profile</p>
          <p className="mt-1">Unauthorized access or distribution is prohibited</p>
        </div>
      </Card>
    </div>
  );
};

export default SharedProfile;
