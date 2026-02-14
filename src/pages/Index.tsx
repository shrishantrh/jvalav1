import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import jvalaLogo from "@/assets/jvala-logo.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { SmartTrack, SmartTrackRef } from "@/components/tracking/SmartTrack";
import { DetailedEntry } from "@/components/DetailedEntry";
import { RevampedInsights } from "@/components/insights/RevampedInsights";
import { EnhancedMedicalExport } from "@/components/insights/EnhancedMedicalExport";
import { WeekCalendarHistory } from "@/components/history/WeekCalendarHistory";
import { ClinicalRecordGenerator } from "@/components/history/ClinicalRecordGenerator";
import { ProfileManager } from "@/components/profile/ProfileManager";
import { TimelineProgress } from "@/components/engagement/TimelineProgress";
import { RevolutionaryOnboarding } from "@/components/onboarding/RevolutionaryOnboarding";
import { HealthForecast } from "@/components/forecast/HealthForecast";
import { CycleTracker } from "@/components/tracking/CycleTracker";
import { StreakBadge } from "@/components/engagement/StreakBadge";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { CONDITIONS } from "@/data/conditions";
import { useEngagement } from "@/hooks/useEngagement";
import { useCorrelations } from "@/hooks/useCorrelations";
import { CorrelationInsights } from "@/components/insights/CorrelationInsights";
import { WeeklyReportCard } from "@/components/insights/WeeklyReportCard";
import { Activity, ChevronDown, MapPin, Sparkles } from "lucide-react";
import { MedicationTracker } from "@/components/medication/MedicationTracker";
import { useMedicationLogs } from "@/hooks/useMedicationLogs";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LimitlessAIChat } from "@/components/ai/LimitlessAIChat";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import type { SmartTrackable } from "@/components/tracking/FluidLogSelector";

interface MedicationDetails {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

type CustomTrackable = SmartTrackable;

interface UserProfile {
  conditions: string[];
  known_symptoms: string[];
  known_triggers: string[];
  medications: MedicationDetails[];
  aiLogCategories: any[];
  customTrackables: CustomTrackable[];
  physician_name: string | null;
  physician_email: string | null;
  physician_phone: string | null;
  physician_practice: string | null;
  onboarding_completed: boolean;
  full_name: string | null;
  date_of_birth: string | null;
  biological_sex: string | null;
}

const Index = () => {
  const [currentView, setCurrentView] = useState<'track' | 'history' | 'insights' | 'exports'>('track');
  const [entries, setEntries] = useState<FlareEntry[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDetailedEntry, setShowDetailedEntry] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ city?: string } | null>(null);
  const [insightViewCount, setInsightViewCount] = useState(0);
  const [clinicalRecordEntry, setClinicalRecordEntry] = useState<FlareEntry | null>(null);
  const [showClinicalRecord, setShowClinicalRecord] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const smartTrackRef = useRef<SmartTrackRef>(null);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { updateEngagementOnLog, getEngagement, syncEngagementTotals, checkCorrelationBadges, checkTrackingBadges, awardBadge } = useEngagement();
  
  const { topCorrelations, recentActivities } = useCorrelations(user?.id || null);
  const { logs: medicationLogs, addLog: addMedicationLog } = useMedicationLogs(user?.id);
  const { schedulePostFlareFollowUps, checkStreakMilestone, checkEnvironmentalChanges } = useSmartNotifications();

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
        const loc = await getCurrentLocation();
        if (loc) {
          const weatherData = await fetchWeatherData(loc.latitude, loc.longitude);
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
        .select('conditions, known_symptoms, known_triggers, physician_name, physician_email, physician_phone, physician_practice, onboarding_completed, metadata, full_name, date_of_birth, biological_sex')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const profileData = data as any;
        const medications = profileData.metadata?.medications || [];
        const aiLogCategories = profileData.metadata?.aiLogCategories || [];
        const customTrackables = profileData.metadata?.customTrackables || [];
        
        setUserProfile({
          conditions: data.conditions || [],
          known_symptoms: data.known_symptoms || [],
          known_triggers: data.known_triggers || [],
          medications: medications,
          aiLogCategories: aiLogCategories,
          customTrackables: customTrackables,
          physician_name: data.physician_name,
          physician_email: data.physician_email,
          physician_phone: data.physician_phone,
          physician_practice: data.physician_practice,
          onboarding_completed: data.onboarding_completed || false,
          full_name: (data as any).full_name || null,
          date_of_birth: (data as any).date_of_birth || null,
          biological_sex: (data as any).biological_sex || null,
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
      // Merge selected condition IDs with custom condition names
      const conditionIds = data.conditions || [];
      const customConditions = data.customConditions || [];
      const allConditions = [
        ...conditionIds,
        ...customConditions,
      ];

      const knownSymptoms = data.knownSymptoms || [];
      const knownTriggers = data.knownTriggers || [];
      const medications = data.medications || [];

      // Store medications and AI log categories in metadata
      const medicationDetails = medications.map((name: string) => ({
        name,
        dosage: 'standard',
        frequency: 'as-needed',
      }));

      const aiLogCategories = data.aiLogCategories || [];

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.firstName || null,
          conditions: allConditions,
          known_symptoms: knownSymptoms,
          known_triggers: knownTriggers,
          date_of_birth: data.dateOfBirth || null,
          biological_sex: data.biologicalSex || null,
          onboarding_completed: true,
          metadata: { medications: medicationDetails, aiLogCategories },
        })
        .eq('id', user.id);

      if (error) throw error;

      setUserProfile({
        conditions: allConditions,
        known_symptoms: knownSymptoms,
        known_triggers: knownTriggers,
        medications: medicationDetails,
        aiLogCategories: aiLogCategories,
        customTrackables: [],
        physician_name: null,
        physician_email: null,
        physician_phone: null,
        physician_practice: null,
        onboarding_completed: true,
        full_name: data.firstName || null,
        date_of_birth: data.dateOfBirth || null,
        biological_sex: data.biologicalSex || null,
      });

      setShowOnboarding(false);

      toast({
        title: `Welcome${data.firstName ? `, ${data.firstName}` : ''}! ✨`,
        description: "Your AI health companion is ready.",
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

  const handleSaveEntry = async (entryData: Partial<FlareEntry>): Promise<boolean> => {
    if (!user) return false;

    // Optimistic UI so we never “pretend” without either showing it in History or showing an error.
    const optimisticId = `pending_${Date.now()}`;
    const optimisticEntry: FlareEntry = {
      id: optimisticId,
      timestamp: entryData.timestamp || new Date(),
      type: (entryData.type || 'note') as any,
      severity: entryData.severity as any,
      energyLevel: entryData.energyLevel as any,
      symptoms: entryData.symptoms || undefined,
      medications: entryData.medications || undefined,
      triggers: entryData.triggers || undefined,
      note: entryData.note || undefined,
      photos: entryData.photos || undefined,
      voiceTranscript: entryData.voiceTranscript || undefined,
      environmentalData: entryData.environmentalData as any,
      physiologicalData: entryData.physiologicalData as any,
      followUps: entryData.followUps as any,
    };

    setEntries(prev => [optimisticEntry, ...prev]);

    try {
      console.log('[entries] saving entry:', entryData);

      // Idempotent insert: ON CONFLICT (user_id, timestamp) DO NOTHING
      // prevents duplicate rows from double-taps or retries.
      const { data, error } = await supabase
        .from('flare_entries')
        .upsert({
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
          environmental_data: (entryData.environmentalData as any) || null,
          physiological_data: (entryData.physiologicalData as any) || null,
          latitude: entryData.environmentalData?.location?.latitude || null,
          longitude: entryData.environmentalData?.location?.longitude || null,
          city: entryData.environmentalData?.location?.city || null,
        }, { onConflict: 'user_id,timestamp', ignoreDuplicates: true })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const savedEntry: FlareEntry = {
          id: data.id,
          timestamp: new Date(data.timestamp),
          type: data.entry_type as any,
          severity: data.severity as any,
          energyLevel: data.energy_level as any,
          symptoms: data.symptoms || undefined,
          medications: data.medications || undefined,
          triggers: data.triggers || undefined,
          note: data.note || undefined,
          photos: data.photos || undefined,
          voiceTranscript: data.voice_transcript || undefined,
          followUps: (data.follow_ups as any) || undefined,
          environmentalData: data.environmental_data as any,
          physiologicalData: data.physiological_data as any,
        };

        // Replace the optimistic row with the real one from the backend
        setEntries(prev => prev.map(e => (e.id === optimisticId ? savedEntry : e)));

        // Explicit, honest confirmation: only after the backend insert succeeds.
        toast({
          title: 'Saved to History',
          description: savedEntry.type === 'flare' ? 'Flare logged.' : 'Entry logged.',
          duration: 2000,
        });

        const isDetailed = !!(
          entryData.symptoms?.length ||
          entryData.triggers?.length ||
          entryData.note ||
          entryData.medications?.length
        );

        const { newBadges, currentStreak: newStreak } = await updateEngagementOnLog(user.id, isDetailed);
        setCurrentStreak(newStreak);
        checkStreakMilestone(newStreak);

        // Schedule post-flare follow-up notifications
        if (entryData.type === 'flare' && entryData.severity) {
          schedulePostFlareFollowUps(entryData.severity);
        }

        // Check environmental changes for proactive alerts
        if (entryData.environmentalData) {
          const envData = entryData.environmentalData as any;
          checkEnvironmentalChanges({
            temperature: envData.temperature,
            pressure: envData.pressure,
            aqi: envData.aqi,
          });
        }

        const trackingBadges = await checkTrackingBadges(user.id);
        const allNewBadges = [...newBadges, ...trackingBadges];

        if (entryData.photos?.length && (await awardBadge(user.id, 'photo_first'))) {
          allNewBadges.push('photo_first');
        }
        if (entryData.voiceTranscript && (await awardBadge(user.id, 'voice_first'))) {
          allNewBadges.push('voice_first');
        }

        if (allNewBadges.length > 0) {
          toast({
            title: '🏆 Badge Earned!',
            description: `You earned: ${allNewBadges.join(', ')}`,
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to save entry:', error);

      // Remove optimistic row
      setEntries(prev => prev.filter(e => e.id !== optimisticId));

      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error);

      toast({
        title: 'Entry not saved',
        description: message,
        variant: 'destructive',
      });

      return false;
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

  const selectedDateEntries = useMemo(() => {
    return entries.filter(e => isSameDay(e.timestamp, selectedDate));
  }, [entries, selectedDate]);

  // Show onboarding if needed
  if (showOnboarding && !isLoadingProfile) {
    return <RevolutionaryOnboarding onComplete={(onboardingData) => {
      handleOnboardingComplete(onboardingData);
    }} />;
  }

  // Show progress dashboard in a dialog
  if (showProgress && user) {
    return (
      <MobileLayout showNav={false}>
        <TimelineProgress 
          userId={user.id}
          entries={entries}
          onBack={() => setShowProgress(false)}
        />
      </MobileLayout>
    );
  }

  const handleRefresh = async () => {
    await loadEntries();
    await loadEngagementData();
  };

  return (
    <>
      <MobileLayout
        currentView={currentView}
        onViewChange={setCurrentView}
        onRefresh={handleRefresh}
        header={
          <MobileHeader 
            streak={currentStreak}
            onStreakClick={() => setShowProgress(true)}
            onProfileClick={() => setShowProfile(true)}
          />
        }
      >

        {/* Track View - Full height chat */}
        {currentView === 'track' && user && (
          <div 
            className="flex flex-col -mx-5 -my-4 -mb-28"
            style={{ 
              height: 'calc(100vh - env(safe-area-inset-top, 0px) - 140px)',
              minHeight: '400px',
            }}
          >
            <SmartTrack
              ref={smartTrackRef}
              onSave={handleSaveEntry}
              onUpdateEntry={handleUpdateEntry}
              userSymptoms={userProfile?.known_symptoms || []}
              userConditions={userProfile?.conditions || []}
              userTriggers={userProfile?.known_triggers || []}
              userMedications={userProfile?.medications || []}
              aiLogCategories={userProfile?.aiLogCategories || []}
              customTrackables={userProfile?.customTrackables || []}
              onAddTrackable={async (trackable) => {
                if (!user || !userProfile) return;
                const updated = [...(userProfile.customTrackables || []), trackable];
                setUserProfile(prev => prev ? { ...prev, customTrackables: updated } : prev);
                const currentMeta: Record<string, any> = {
                  medications: (userProfile.medications || []).map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })),
                  aiLogCategories: userProfile.aiLogCategories || [],
                  customTrackables: updated.map(t => ({ id: t.id, label: t.label, icon: t.icon, type: t.type, color: t.color, interactionType: t.interactionType, subOptions: t.subOptions, unit: t.unit, logMessage: t.logMessage })),
                };
                await supabase.from('profiles').update({ metadata: currentMeta as any }).eq('id', user.id);
              }}
              userName={userProfile?.full_name}
              userDOB={userProfile?.date_of_birth}
              userBiologicalSex={userProfile?.biological_sex}
              recentEntries={entries}
              userId={user.id}
              onOpenDetails={() => setShowDetailedEntry(true)}
            />
            
            {/* Detailed Entry Dialog */}
            <Dialog open={showDetailedEntry} onOpenChange={setShowDetailedEntry}>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DetailedEntry 
                  onSave={handleSaveEntry} 
                  onDetailedSave={(entry) => {
                    smartTrackRef.current?.addDetailedEntry(entry);
                    setShowDetailedEntry(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* History View */}
        {currentView === 'history' && (
          <WeekCalendarHistory 
            entries={entries}
            onUpdate={handleUpdateEntry}
            onDelete={handleDeleteEntry}
            onAddFollowUp={handleAddFollowUp}
          />
        )}

        {/* Insights/Trends View */}
        {currentView === 'insights' && user && (
          <div className="space-y-4">
            <WeeklyReportCard userId={user.id} />
            
            <RevampedInsights 
              entries={entries} 
              userConditions={userProfile?.conditions}
              medicationLogs={medicationLogs}
              onLogMedication={addMedicationLog}
              userMedications={userProfile?.medications?.map(m => m.name) || []}
              onStartProtocol={(rec) => {
                setCurrentView('track');
                setTimeout(() => {
                  smartTrackRef.current?.addDetailedEntry({ 
                    type: 'note', 
                    note: rec 
                  });
                }, 100);
              }}
              onAskAI={(prompt) => {
                setCurrentView('track');
                setTimeout(() => {
                  smartTrackRef.current?.sendChatMessage(prompt);
                }, 150);
              }}
            />
          </div>
        )}

        {/* Exports View */}
        {currentView === 'exports' && (
          <EnhancedMedicalExport 
            entries={entries} 
            conditions={userProfile?.conditions || []} 
          />
        )}
      </MobileLayout>

      {/* Profile Sheet - iOS style bottom sheet */}
      {showProfile && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowProfile(false)}
          />
          
          {/* Sheet content */}
          <div 
            className="relative flex-1 mt-12 bg-background rounded-t-3xl overflow-hidden flex flex-col"
            style={{ 
              boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
            
            {/* Header with close button */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-border/50">
              <h2 className="text-lg font-semibold">Profile</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowProfile(false)}
                className="text-muted-foreground"
              >
                Done
              </Button>
            </div>
            
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ProfileManager 
                onRequireOnboarding={() => {
                  setShowProfile(false);
                  setShowOnboarding(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Clinical Record Generator */}
      <ClinicalRecordGenerator 
        entry={clinicalRecordEntry}
        open={showClinicalRecord}
        onOpenChange={setShowClinicalRecord}
      />
    </>
  );
};

export default Index;
