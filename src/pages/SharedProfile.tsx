import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, User, AlertTriangle, Activity, TrendingUp, Clock, Pill, Calendar, BarChart3, RefreshCw } from 'lucide-react';
import { format, subDays, isWithinInterval } from 'date-fns';
import jvalaLogo from "@/assets/jvala-logo.png";

interface FlareEntry {
  id: string;
  timestamp: string;
  entry_type: string;
  severity: string | null;
  symptoms: string[] | null;
  triggers: string[] | null;
  medications: string[] | null;
  note: string | null;
  environmental_data: any;
}

interface ProfileData {
  full_name: string | null;
  email: string | null;
  conditions: string[] | null;
  known_symptoms: string[] | null;
  known_triggers: string[] | null;
}

const SharedProfile = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [entries, setEntries] = useState<FlareEntry[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchData = async () => {
    if (!token) {
      setError('Missing share token');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use direct fetch to bypass any auth requirements
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-shared-profile?token=${encodeURIComponent(token)}`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to access profile' }));
        throw new Error(errorData.error || 'Failed to access profile');
      }

      const result = await response.json();
      setProfileData(result.profile);
      setEntries(result.entries || []);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Access error:', err);
      setError(err.message || 'Failed to load profile. The link may be expired or invalid.');
    } finally {
      setLoading(false);
    }
  };

  // Analytics calculations
  const analytics = useMemo(() => {
    if (!entries.length) return null;

    const now = new Date();
    const last7Days = entries.filter(e => {
      const ts = new Date(e.timestamp);
      return isWithinInterval(ts, { start: subDays(now, 7), end: now });
    });
    const last30Days = entries.filter(e => {
      const ts = new Date(e.timestamp);
      return isWithinInterval(ts, { start: subDays(now, 30), end: now });
    });

    const flares7d = last7Days.filter(e => e.entry_type === 'flare');
    const flares30d = last30Days.filter(e => e.entry_type === 'flare');

    const getSeverityScore = (s: string | null) => s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
    
    const avgSeverity = flares30d.length > 0 
      ? flares30d.reduce((sum, e) => sum + getSeverityScore(e.severity), 0) / flares30d.length
      : 0;

    // Symptom frequency
    const symptomCounts: Record<string, number> = {};
    flares30d.forEach(f => {
      f.symptoms?.forEach(s => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    });
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Trigger frequency
    const triggerCounts: Record<string, number> = {};
    flares30d.forEach(f => {
      f.triggers?.forEach(t => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });
    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Medications
    const medicationCounts: Record<string, number> = {};
    last30Days.forEach(e => {
      e.medications?.forEach(m => {
        medicationCounts[m] = (medicationCounts[m] || 0) + 1;
      });
    });
    const topMedications = Object.entries(medicationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Severity breakdown
    const severityBreakdown = {
      mild: flares30d.filter(f => f.severity === 'mild').length,
      moderate: flares30d.filter(f => f.severity === 'moderate').length,
      severe: flares30d.filter(f => f.severity === 'severe').length,
    };

    return {
      totalEntries: entries.length,
      flares7d: flares7d.length,
      flares30d: flares30d.length,
      avgSeverity,
      topSymptoms,
      topTriggers,
      topMedications,
      severityBreakdown,
    };
  }, [entries]);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Invalid Share Link</h1>
          <p className="text-muted-foreground">
            This link appears to be invalid or incomplete. Please check the URL and try again.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading patient profile...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Unable to Load Profile</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchData}>Try Again</Button>
        </Card>
      </div>
    );
  }

  if (profileData && analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-6 px-4">
          <div className="container max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={jvalaLogo} alt="Jvala" className="w-10 h-10" />
                <div>
                  <h1 className="text-xl font-bold">{profileData.full_name || 'Patient Profile'}</h1>
                  <p className="text-sm opacity-80">Healthcare Provider Dashboard</p>
                </div>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={fetchData}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="container max-w-4xl mx-auto p-4 space-y-4">
          {/* Security Notice */}
          <Alert className="bg-muted/50 border-primary/20">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Secure read-only view. Last updated: {format(lastRefreshed, 'PPp')}
            </AlertDescription>
          </Alert>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">This Week</span>
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{analytics.flares7d}</p>
              <p className="text-xs text-muted-foreground">flares</p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">30 Days</span>
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{analytics.flares30d}</p>
              <p className="text-xs text-muted-foreground">flares</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Avg Severity</span>
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{analytics.avgSeverity.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">of 3.0</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Total Logs</span>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{analytics.totalEntries}</p>
              <p className="text-xs text-muted-foreground">entries</p>
            </Card>
          </div>

          {/* Severity Breakdown */}
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Severity Distribution (30 days)
            </h3>
            <div className="flex gap-2 h-8 rounded overflow-hidden">
              {analytics.severityBreakdown.mild > 0 && (
                <div 
                  className="bg-severity-mild flex items-center justify-center text-xs font-medium"
                  style={{ flex: analytics.severityBreakdown.mild }}
                >
                  {analytics.severityBreakdown.mild} Mild
                </div>
              )}
              {analytics.severityBreakdown.moderate > 0 && (
                <div 
                  className="bg-severity-moderate flex items-center justify-center text-xs font-medium text-white"
                  style={{ flex: analytics.severityBreakdown.moderate }}
                >
                  {analytics.severityBreakdown.moderate} Moderate
                </div>
              )}
              {analytics.severityBreakdown.severe > 0 && (
                <div 
                  className="bg-severity-severe flex items-center justify-center text-xs font-medium text-white"
                  style={{ flex: analytics.severityBreakdown.severe }}
                >
                  {analytics.severityBreakdown.severe} Severe
                </div>
              )}
            </div>
          </Card>

          {/* Symptoms & Triggers */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">Top Symptoms (30 days)</h3>
              {analytics.topSymptoms.length > 0 ? (
                <div className="space-y-2">
                  {analytics.topSymptoms.map(([symptom, count]) => (
                    <div key={symptom} className="flex items-center justify-between">
                      <span className="text-sm">{symptom}</span>
                      <Badge variant="secondary">{count}x</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No symptoms logged</p>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">Top Triggers (30 days)</h3>
              {analytics.topTriggers.length > 0 ? (
                <div className="space-y-2">
                  {analytics.topTriggers.map(([trigger, count]) => (
                    <div key={trigger} className="flex items-center justify-between">
                      <span className="text-sm">{trigger}</span>
                      <Badge variant="outline">{count}x</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No triggers identified</p>
              )}
            </Card>
          </div>

          {/* Medications */}
          {analytics.topMedications.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Pill className="w-4 h-4 text-primary" />
                Medications Logged (30 days)
              </h3>
              <div className="flex flex-wrap gap-2">
                {analytics.topMedications.map(([med, count]) => (
                  <Badge key={med} variant="secondary">
                    {med} ({count}x)
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Recent Timeline */}
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Recent Entries
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {entries.slice(0, 20).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                  <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                    entry.severity === 'severe' ? 'bg-severity-severe' :
                    entry.severity === 'moderate' ? 'bg-severity-moderate' :
                    entry.severity === 'mild' ? 'bg-severity-mild' : 'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{entry.entry_type}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    {entry.symptoms && entry.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entry.symptoms.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    )}
                    {entry.note && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{entry.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Footer */}
          <div className="text-center py-4 text-xs text-muted-foreground">
            <p>Powered by Jvala • Patient Health Tracking</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SharedProfile;
