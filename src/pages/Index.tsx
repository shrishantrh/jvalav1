import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import jvalaLogo from "@/assets/jvala-logo.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { SmartTrack, SmartTrackRef } from "@/components/tracking/SmartTrack";
import { DetailedEntry } from "@/components/DetailedEntry";
import { CleanInsights } from "@/components/insights/CleanInsights";
import { ProactiveRiskAlerts } from "@/components/insights/ProactiveRiskAlerts";
import { CalendarHistory } from "@/components/history/CalendarHistory";
import { FlareTimeline } from "@/components/flare/FlareTimeline";
import { ProfileManager } from "@/components/profile/ProfileManager";
import { ProgressDashboard } from "@/components/engagement/ProgressDashboard";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { StreakBadge } from "@/components/engagement/StreakBadge";
import { CONDITIONS } from "@/data/conditions";
import { useEngagement } from "@/hooks/useEngagement";
import { useCorrelations } from "@/hooks/useCorrelations";
import { CorrelationInsights } from "@/components/insights/CorrelationInsights";
import { WeeklyReportCard } from "@/components/insights/WeeklyReportCard";
import { Activity, Calendar, BarChart3, User as UserIcon, ChevronDown, Flame, Settings, MapPin, Pill } from "lucide-react";
import { MedicationTracker } from "@/components/medication/MedicationTracker";
import { useMedicationLogs } from "@/hooks/useMedicationLogs";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface MedicationDetails {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

interface UserProfile {
  conditions: string[];
  known_symptoms: string[];
  known_triggers: string[];
  medications: MedicationDetails[];
  physician_name: string | null;
  physician_email: string | null;
  physician_phone: string | null;
  physician_practice: string | null;
  onboarding_completed: boolean;
}

const Index = () => {
  const [currentView, setCurrentView] = useState<'track' | 'history' | 'insights' | 'profile' | 'progress' | 'meds'>('track');
  const [entries, setEntries] = useState<FlareEntry[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDetailedEntry, setShowDetailedEntry] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ city?: string } | null>(null);
  const [insightViewCount, setInsightViewCount] = useState(0);
  const smartTrackRef = useRef<SmartTrackRef>(null);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updateEngagementOnLog, getEngagement, syncEngagementTotals, checkCorrelationBadges, checkTrackingBadges, awardBadge } = useEngagement();
  
  // Use correlations hook
  const { topCorrelations, recentActivities } = useCorrelations(user?.id || null);
  
  // Medication logs hook
  const { logs: medicationLogs, addLog: addMedicationLog } = useMedicationLogs(user?.id);

  // Check for special badges when correlations change
  useEffect(() => {
    const checkBadges = async () => {
      if (!user || topCorrelations.length === 0) return;
      
      const newBadges = await checkCorrelationBadges(user.id);
      if (newBadges.length > 0) {
        toast({
          title: "🏆 Badge Earned!",
          description: `You earned: ${newBadges.map(b => b === 'pattern_detective' ? 'Pattern Detective' : 'Health Analyst').join(', ')}`,
        });
      }
    };
    checkBadges();
  }, [topCorrelations.length, user?.id]);

  // Check auth and load data
  useEffect(() => {
    if (!user && !loading) {
      navigate('/auth');
      return;
    }

    if (user) {
      loadProfile();
      loadEntries();
      loadEngagementData();
    }
  }, [user, loading, navigate]);

  // Get location
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { getCurrentLocation, fetchWeatherData } = await import("@/services/weatherService");
        const location = await getCurrentLocation();
        if (location) {
          const weatherData = await fetchWeatherData(location.latitude, location.longitude);
          if (weatherData?.location?.city) {
            setCurrentLocation({ city: weatherData.location.city });
          }
        }
      } catch (e) {
        console.log('Could not get location');
      }
    };
    getLocation();
  }, []);

  const loadEngagementData = async () => {
    if (!user) return;
    const engagement = await getEngagement(user.id);
    if (engagement) {
      setCurrentStreak(engagement.current_streak || 0);
      await syncEngagementTotals(user.id);
    }
  };

  const loadProfile = async () => {
    if (!user) return;
    setIsLoadingProfile(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('conditions, known_symptoms, known_triggers, physician_name, physician_email, physician_phone, physician_practice, onboarding_completed, metadata')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const profileData = data as any;
        const medications = profileData.metadata?.medications || [];
        
        setUserProfile({
          conditions: data.conditions || [],
          known_symptoms: data.known_symptoms || [],
          known_triggers: data.known_triggers || [],
          medications: medications,
          physician_name: data.physician_name,
          physician_email: data.physician_email,
          physician_phone: data.physician_phone,
          physician_practice: data.physician_practice,
          onboarding_completed: data.onboarding_completed || false,
        });

        if (!data.onboarding_completed) {
          setShowOnboarding(true);
        }
      } else {
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleOnboardingComplete = async (data: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          conditions: data.conditions,
          known_symptoms: data.symptoms,
          known_triggers: data.triggers,
          physician_name: data.physicianName || null,
          physician_email: data.physicianEmail || null,
          physician_phone: data.physicianPhone || null,
          physician_practice: data.physicianPractice || null,
          date_of_birth: data.dateOfBirth || null,
          gender: data.gender || null,
          biological_sex: data.biologicalSex || null,
          height_cm: data.heightCm || null,
          weight_kg: data.weightKg || null,
          blood_type: data.bloodType || null,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (error) throw error;

      setUserProfile({
        conditions: data.conditions,
        known_symptoms: data.symptoms,
        known_triggers: data.triggers,
        medications: [],
        physician_name: data.physicianName || null,
        physician_email: data.physicianEmail || null,
        physician_phone: data.physicianPhone || null,
        physician_practice: data.physicianPractice || null,
        onboarding_completed: true,
      });

      setShowOnboarding(false);

      toast({
        title: "Welcome to Jvala! 💜",
        description: "You're all set. Start tracking to see insights.",
      });
    } catch (error) {
      console.error('Failed to save onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to save your profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const loadEntries = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('flare_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      if (data) {
        setEntries(data.map((entry: any) => ({
          id: entry.id,
          timestamp: new Date(entry.timestamp),
          type: entry.entry_type,
          severity: entry.severity,
          energyLevel: entry.energy_level,
          symptoms: entry.symptoms,
          medications: entry.medications,
          triggers: entry.triggers,
          note: entry.note,
          photos: entry.photos || [],
          voiceTranscript: entry.voice_transcript,
          followUps: entry.follow_ups || [],
          environmentalData: entry.environmental_data,
          physiologicalData: entry.physiological_data,
        })));
      }
    } catch (error) {
      console.error('Failed to load entries:', error);
    }
  };

  const handleSaveEntry = async (entryData: Partial<FlareEntry>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('flare_entries')
        .insert({
          user_id: user.id,
          timestamp: (entryData.timestamp || new Date()).toISOString(),
          entry_type: entryData.type || 'note',
          severity: entryData.severity || null,
          energy_level: entryData.energyLevel || null,
          symptoms: entryData.symptoms || null,
          medications: entryData.medications || null,
          triggers: entryData.triggers || null,
          note: entryData.note || null,
          photos: entryData.photos || null,
          voice_transcript: entryData.voiceTranscript || null,
          environmental_data: entryData.environmentalData as any || null,
          physiological_data: entryData.physiologicalData as any || null,
          latitude: entryData.environmentalData?.location?.latitude || null,
          longitude: entryData.environmentalData?.location?.longitude || null,
          city: entryData.environmentalData?.location?.city || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newEntry: FlareEntry = {
          id: data.id,
          timestamp: new Date(data.timestamp),
          type: data.entry_type as any,
          severity: data.severity as any,
          energyLevel: data.energy_level as any,
          symptoms: data.symptoms || undefined,
          medications: data.medications || undefined,
          triggers: data.triggers || undefined,
          note: data.note || undefined,
          environmentalData: data.environmental_data as any,
          physiologicalData: data.physiological_data as any,
        };

        setEntries(prev => [newEntry, ...prev]);

        // Update engagement
        const isDetailed = !!(entryData.symptoms?.length || entryData.triggers?.length || entryData.note || entryData.medications?.length);
        const { newBadges, streakIncreased, currentStreak: newStreak } = await updateEngagementOnLog(user.id, isDetailed);
        setCurrentStreak(newStreak);
        
        // Check for tracking variety badges
        const trackingBadges = await checkTrackingBadges(user.id);
        const allNewBadges = [...newBadges, ...trackingBadges];
        
        // Award photo/voice badges if applicable
        if (entryData.photos?.length && await awardBadge(user.id, 'photo_first')) {
          allNewBadges.push('photo_first');
        }
        if (entryData.voiceTranscript && await awardBadge(user.id, 'voice_first')) {
          allNewBadges.push('voice_first');
        }
        
        if (allNewBadges.length > 0) {
          toast({
            title: "🏆 Badge Earned!",
            description: `You earned: ${allNewBadges.join(', ')}`,
          });
        }
      }
    } catch (error) {
      console.error('Failed to save entry:', error);
      toast({
        title: "Error saving entry",
        description: "Failed to save your health data",
        variant: "destructive"
      });
    }
  };

  const handleUpdateEntry = async (entryId: string, updates: Partial<FlareEntry>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('flare_entries')
        .update({
          timestamp: updates.timestamp?.toISOString(),
          severity: updates.severity || null,
          energy_level: updates.energyLevel || null,
          symptoms: updates.symptoms || null,
          medications: updates.medications || null,
          triggers: updates.triggers || null,
          note: updates.note || null,
        })
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (error) throw error;

      setEntries(prev => prev.map(entry => 
        entry.id === entryId ? { ...entry, ...updates } : entry
      ));

      toast({ title: "Entry updated" });
    } catch (error) {
      console.error('Failed to update entry:', error);
      toast({ title: "Error updating entry", variant: "destructive" });
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('flare_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (error) throw error;

      setEntries(prev => prev.filter(entry => entry.id !== entryId));
      toast({ title: "Entry deleted" });
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast({ title: "Error deleting entry", variant: "destructive" });
    }
  };

  const handleAddFollowUp = async (entryId: string, followUpNote: string) => {
    if (!user) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const newFollowUp = {
        timestamp: new Date().toISOString(),
        note: followUpNote
      };

      const updatedFollowUps = [...(entry.followUps || []), newFollowUp];

      const { error } = await supabase
        .from('flare_entries')
        .update({ follow_ups: updatedFollowUps })
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (error) throw error;

      setEntries(prev => prev.map(e => 
        e.id === entryId ? { ...e, followUps: updatedFollowUps } : e
      ));

      toast({ title: "Follow-up added" });
    } catch (error) {
      console.error('Failed to add follow-up:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Filter entries for selected date in history view
  const selectedDateEntries = useMemo(() => {
    return entries.filter(e => isSameDay(e.timestamp, selectedDate));
  }, [entries, selectedDate]);

  // Show onboarding if needed
  if (showOnboarding && !isLoadingProfile) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  // Get condition names for display
  const userConditionNames = userProfile?.conditions
    .map(id => CONDITIONS.find(c => c.id === id)?.name)
    .filter(Boolean) || [];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b shadow-soft">
        <div className="container max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={jvalaLogo} alt="jvala" className="w-7 h-7" />
              <div>
                <h1 className="text-base font-medical text-foreground leading-tight">Jvala</h1>
                <p className="text-[10px] text-muted-foreground">{format(new Date(), 'EEEE, MMM d')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Streak Badge */}
              {currentStreak > 0 && (
                <StreakBadge 
                  streak={currentStreak} 
                  onClick={() => setCurrentView('progress')}
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentView('profile')}
                className="h-9 w-9 rounded-full"
              >
                <UserIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/settings')}
                className="h-9 w-9 rounded-full"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="container max-w-md mx-auto px-4 py-4">
        <div className="flex bg-card/80 backdrop-blur rounded-2xl p-1 shadow-soft border">
          <Button
            variant={currentView === 'track' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('track')}
            className={`flex-1 text-xs h-9 rounded-xl px-2 ${currentView === 'track' ? 'shadow-primary' : ''}`}
          >
            <Activity className="w-3.5 h-3.5 mr-1" />
            Track
          </Button>
          <Button
            variant={currentView === 'meds' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('meds')}
            className={`flex-1 text-xs h-9 rounded-xl px-2 ${currentView === 'meds' ? 'shadow-primary' : ''}`}
          >
            <Pill className="w-3.5 h-3.5 mr-1" />
            Meds
          </Button>
          <Button
            variant={currentView === 'history' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('history')}
            className={`flex-1 text-xs h-9 rounded-xl px-2 ${currentView === 'history' ? 'shadow-primary' : ''}`}
          >
            <Calendar className="w-3.5 h-3.5 mr-1" />
            History
          </Button>
          <Button
            variant={currentView === 'insights' ? 'default' : 'ghost'}
            size="sm"
            onClick={async () => {
              setCurrentView('insights');
              // Track insight views for badge
              const newCount = insightViewCount + 1;
              setInsightViewCount(newCount);
              if (newCount === 5 && user?.id) {
                const awarded = await awardBadge(user.id, 'insight_seeker');
                if (awarded) {
                  toast({ title: "🏆 Badge Earned!", description: "Insight Seeker - Viewed insights 5 times" });
                }
              }
            }}
            className={`flex-1 text-xs h-9 rounded-xl px-2 ${currentView === 'insights' ? 'shadow-primary' : ''}`}
          >
            <BarChart3 className="w-3.5 h-3.5 mr-1" />
            Insights
          </Button>
        </div>
      </div>

      {/* Content */}
      <main className="container max-w-md mx-auto px-4 pb-8 space-y-4">
        {/* Proactive Risk Alerts */}
        {currentView === 'track' && entries.length > 0 && (
          <ProactiveRiskAlerts 
            recentEntries={entries}
            userTriggers={userProfile?.known_triggers || []}
            userConditions={userProfile?.conditions || []}
          />
        )}
        
        {/* Weekly Report Card */}
        {currentView === 'track' && user && (
          <WeeklyReportCard 
            userId={user.id}
            onViewDetails={() => setCurrentView('insights')}
          />
        )}
        
        {/* Correlation Insights - show discovered patterns */}
        {currentView === 'track' && topCorrelations.length > 0 && (
          <CorrelationInsights 
            correlations={topCorrelations}
            onViewDetails={() => setCurrentView('insights')}
          />
        )}
        
        {/* Track View */}
        {currentView === 'track' && user && (
          <Card className="p-4 shadow-soft-lg bg-gradient-card border-0 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-soft">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-clinical">How are you feeling?</h2>
                  {currentLocation?.city && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{currentLocation.city}</span>
                    </div>
                  )}
                </div>
                {userConditionNames.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {userConditionNames.slice(0, 2).join(', ')}
                    {userConditionNames.length > 2 && ` +${userConditionNames.length - 2}`}
                  </p>
                )}
              </div>
            </div>
            
            <SmartTrack
              ref={smartTrackRef}
              onSave={handleSaveEntry}
              onUpdateEntry={handleUpdateEntry}
              userSymptoms={userProfile?.known_symptoms || []}
              userConditions={userProfile?.conditions || []}
              userTriggers={userProfile?.known_triggers || []}
              userMedications={userProfile?.medications || []}
              recentEntries={entries}
              userId={user.id}
            />
            
            {/* Detailed Entry Toggle */}
            <div className="pt-3 mt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetailedEntry(!showDetailedEntry)}
                className="w-full text-xs text-muted-foreground"
              >
                <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${showDetailedEntry ? 'rotate-180' : ''}`} />
                {showDetailedEntry ? 'Hide detailed entry' : 'Add more details'}
              </Button>
              {showDetailedEntry && (
                <div className="mt-3 animate-fade-in">
                  <DetailedEntry 
                    onSave={handleSaveEntry} 
                    onDetailedSave={(entry) => {
                      smartTrackRef.current?.addDetailedEntry(entry);
                      setShowDetailedEntry(false);
                    }}
                  />
                </div>
              )}
            </div>
          </Card>
        )}

        {/* History View */}
        {currentView === 'history' && (
          <div className="space-y-4">
            <Card className="p-4 shadow-soft-lg bg-gradient-card border-0">
              <CalendarHistory 
                entries={entries}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </Card>

            {/* Timeline for selected date */}
            {selectedDateEntries.length > 0 ? (
              <div className="animate-fade-in">
                <h3 className="text-sm font-clinical mb-3 text-muted-foreground">
                  {format(selectedDate, 'EEEE, MMMM d')} — {selectedDateEntries.length} {selectedDateEntries.length === 1 ? 'entry' : 'entries'}
                </h3>
                <FlareTimeline 
                  entries={selectedDateEntries} 
                  onUpdate={handleUpdateEntry}
                  onDelete={handleDeleteEntry}
                  onAddFollowUp={handleAddFollowUp}
                />
              </div>
            ) : (
              <Card className="p-6 text-center bg-gradient-card border-0">
                <p className="text-sm text-muted-foreground">
                  No entries on {format(selectedDate, 'MMMM d')}
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Meds View */}
        {currentView === 'meds' && user && (
          <MedicationTracker
            logs={medicationLogs}
            onLogMedication={addMedicationLog}
            userMedications={userProfile?.medications?.map(m => m.name) || []}
          />
        )}

        {/* Insights View */}
        {currentView === 'insights' && (
          <CleanInsights 
            entries={entries} 
            userConditions={userProfile?.conditions}
          />
        )}

        {/* Profile View */}
        {currentView === 'profile' && (
          <ProfileManager 
            onRequireOnboarding={() => setShowOnboarding(true)}
          />
        )}

        {/* Progress Dashboard */}
        {currentView === 'progress' && user && (
          <ProgressDashboard 
            userId={user.id}
            entries={entries}
            onBack={() => setCurrentView('track')}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
