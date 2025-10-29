import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      handleAccess();
    }
  }, [token]);

  const handleAccess = async () => {
    if (!token) {
      setError('Missing share token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Calling get-shared-profile with token:', token);
      
      const baseUrl = window.location.origin.includes('lovableproject.com') 
        ? 'https://rvhpwjhemwvvdtnzmobs.supabase.co'
        : import.meta.env.VITE_SUPABASE_URL;
      
      const url = `${baseUrl}/functions/v1/get-shared-profile?token=${encodeURIComponent(token)}`;
      console.log('Fetching from URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to access profile');
      }

      const data = await response.json();
      console.log('Profile data received');
      
      setProfileData(data.profile);
      setEntries(data.entries);
    } catch (err: any) {
      console.error('Access error:', err);
      setError(err.message || 'Failed to load profile or link expired');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-medical mb-2">Failed to Load Profile</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleAccess}>Try Again</Button>
        </Card>
      </div>
    );
  }

  if (profileData) {
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

  return null;
};

export default SharedProfile;
