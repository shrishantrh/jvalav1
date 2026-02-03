import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import jvalaLogo from "@/assets/jvala-logo.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { SmartTrack, SmartTrackRef } from "@/components/tracking/SmartTrack";
import { DetailedEntry } from "@/components/DetailedEntry";
import { RevampedInsights } from "@/components/insights/RevampedInsights";
import { CalendarHistory } from "@/components/history/CalendarHistory";
import { EnhancedFlareHistory } from "@/components/history/EnhancedFlareHistory";
import { ClinicalRecordGenerator } from "@/components/history/ClinicalRecordGenerator";
import { ProfileManager } from "@/components/profile/ProfileManager";
import { ProgressDashboard } from "@/components/engagement/ProgressDashboard";
import { RevolutionaryOnboarding } from "@/components/onboarding/RevolutionaryOnboarding";
import { HealthForecast } from "@/components/forecast/HealthForecast";
import { CycleTracker } from "@/components/tracking/CycleTracker";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { ColorfulStatCard, ProgressCard } from "@/components/cards/ColorfulStatCard";
import { ActionCard, QuickAction, WeekDaySelector } from "@/components/cards/ActionCard";
import { CONDITIONS } from "@/data/conditions";
import { useEngagement } from "@/hooks/useEngagement";
import { useCorrelations } from "@/hooks/useCorrelations";
import { CorrelationInsights } from "@/components/insights/CorrelationInsights";
import { WeeklyReportCard } from "@/components/insights/WeeklyReportCard";
import { Activity, ChevronDown, ChevronRight, MapPin, Sparkles, Heart, Zap, Moon, TrendingUp, Smile, Frown, Meh, Calendar as CalendarIcon } from "lucide-react";
import { MedicationTracker } from "@/components/medication/MedicationTracker";
import { useMedicationLogs } from "@/hooks/useMedicationLogs";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, subDays, startOfWeek, addDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LimitlessAIChat } from "@/components/ai/LimitlessAIChat";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
  full_name?: string;
}

const Index = () => {
  const [currentView, setCurrentView] = useState<'track' | 'history' | 'insights' | 'profile'>('track');
  const [entries, setEntries] = useState<FlareEntry[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDetailedEntry, setShowDetailedEntry] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ city?: string } | null>(null);
  const [showProtocolChat, setShowProtocolChat] = useState(false);
  const [protocolPrompt, setProtocolPrompt] = useState<string | null>(null);
  const [clinicalRecordEntry, setClinicalRecordEntry] = useState<FlareEntry | null>(null);
  const [showClinicalRecord, setShowClinicalRecord] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const smartTrackRef = useRef<SmartTrackRef>(null);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { updateEngagementOnLog, getEngagement, syncEngagementTotals, checkCorrelationBadges, checkTrackingBadges, awardBadge } = useEngagement();
  
  const { topCorrelations, recentActivities } = useCorrelations(user?.id || null);
  const { logs: medicationLogs, addLog: addMedicationLog } = useMedicationLogs(user?.id);

  // Calculate week days for selector
  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const dayEntries = entries.filter(e => isSameDay(e.timestamp, date));
      const hasEntry = dayEntries.length > 0;
      const severity = dayEntries.find(e => e.severity)?.severity;
      return { date, hasEntry, severity: severity as any };
    });
  }, [entries]);

  // Calculate stats
  const stats = useMemo(() => {
    const last7Days = entries.filter(e => {
      const daysDiff = (new Date().getTime() - e.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });
    
    const flares = last7Days.filter(e => e.type === 'flare');
    const avgSeverity = flares.length > 0 
      ? flares.reduce((acc, e) => acc + (e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1), 0) / flares.length 
      : 0;
    
    return {
      totalLogs: entries.length,
      weeklyFlares: flares.length,
      avgSeverity: avgSeverity.toFixed(1),
      streak: currentStreak,
    };
  }, [entries, currentStreak]);

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

  // Handle protocol prompt from navigation state
  useEffect(() => {
    const state = location.state as { protocolPrompt?: string } | null;
    if (state?.protocolPrompt) {
      setProtocolPrompt(state.protocolPrompt);
      setShowProtocolChat(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

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
        .select('conditions, known_symptoms, known_triggers, physician_name, physician_email, physician_phone, physician_practice, onboarding_completed, metadata, full_name')
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
          full_name: data.full_name || undefined,
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

        const isDetailed = !!(entryData.symptoms?.length || entryData.triggers?.length || entryData.note || entryData.medications?.length);
        const { newBadges, streakIncreased, currentStreak: newStreak } = await updateEngagementOnLog(user.id, isDetailed);
        setCurrentStreak(newStreak);
        
        const trackingBadges = await checkTrackingBadges(user.id);
        const allNewBadges = [...newBadges, ...trackingBadges];
        
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

  const handleQuickLog = (severity: 'mild' | 'moderate' | 'severe') => {
    handleSaveEntry({
      type: 'flare',
      severity,
      timestamp: new Date(),
    });
    toast({ 
      title: `${severity.charAt(0).toUpperCase() + severity.slice(1)} flare logged`,
      description: "Tap to add more details"
    });
  };

  const selectedDateEntries = useMemo(() => {
    return entries.filter(e => isSameDay(e.timestamp, selectedDate));
  }, [entries, selectedDate]);

  // Show onboarding if needed
  if (showOnboarding && !isLoadingProfile) {
    return <RevolutionaryOnboarding onComplete={(data) => {
      handleOnboardingComplete({
        conditions: data.conditions,
        symptoms: [],
        triggers: [],
        enableReminders: data.enableReminders,
        reminderTime: data.reminderTime,
      });
    }} />;
  }

  // Show progress dashboard in a dialog
  if (showProgress && user) {
    return (
      <MobileLayout showNav={false}>
        <ProgressDashboard 
          userId={user.id}
          entries={entries}
          onBack={() => setShowProgress(false)}
        />
      </MobileLayout>
    );
  }

  return (
    <>
      <MobileLayout
        currentView={currentView}
        onViewChange={setCurrentView}
        header={
          <MobileHeader 
            streak={currentStreak}
            onStreakClick={() => setShowProgress(true)}
            userName={userProfile?.full_name}
          />
        }
      >
        {/* Track View */}
        {currentView === 'track' && user && (
          <div className="space-y-5 stagger-fade-in">
            {/* Progress Card */}
            {entries.length >= 3 && (
              <ProgressCard
                title="Your Progress"
                value={Math.min(100, Math.round((currentStreak / 7) * 100))}
                label={`${currentStreak}d`}
                sublabel={format(new Date(), 'd MMMM')}
                onClick={() => setShowProgress(true)}
              />
            )}
            
            {/* How are you feeling */}
            <Card className="p-5">
              <h2 className="text-base font-bold mb-1">How are you feeling?</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {currentLocation?.city && `📍 ${currentLocation.city} • `}
                Tap to log
              </p>
              
              <div className="grid grid-cols-3 gap-3">
                <QuickAction
                  icon={Smile}
                  label="Mild"
                  onClick={() => handleQuickLog('mild')}
                  variant="mild"
                />
                <QuickAction
                  icon={Meh}
                  label="Moderate"
                  onClick={() => handleQuickLog('moderate')}
                  variant="moderate"
                />
                <QuickAction
                  icon={Frown}
                  label="Severe"
                  onClick={() => handleQuickLog('severe')}
                  variant="severe"
                />
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetailedEntry(!showDetailedEntry)}
                className="w-full mt-4 text-xs text-muted-foreground"
              >
                <ChevronDown className={cn(
                  "w-4 h-4 mr-1 transition-transform",
                  showDetailedEntry && "rotate-180"
                )} />
                Add more details
              </Button>
              
              {showDetailedEntry && (
                <div className="mt-4 pt-4 border-t animate-fade-in">
                  <DetailedEntry 
                    onSave={handleSaveEntry} 
                    onDetailedSave={(entry) => {
                      smartTrackRef.current?.addDetailedEntry(entry);
                      setShowDetailedEntry(false);
                    }}
                  />
                </div>
              )}
            </Card>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <ColorfulStatCard
                icon={Activity}
                label="This Week"
                value={stats.weeklyFlares}
                sublabel="flares logged"
                color="coral"
              />
              <ColorfulStatCard
                icon={TrendingUp}
                label="Total Logs"
                value={stats.totalLogs}
                sublabel="all time"
                color="teal"
              />
            </div>

            {/* Health Forecast */}
            {entries.length >= 5 && (
              <HealthForecast 
                userId={user.id}
                currentWeather={currentLocation ? undefined : undefined}
                onViewDetails={() => setCurrentView('insights')}
              />
            )}

            {/* Cycle Tracker */}
            {userProfile?.conditions?.some(c => 
              ['menstrual-disorders', 'endometriosis', 'pcos', 'pmdd', 'pms'].includes(c)
            ) && (
              <CycleTracker userId={user.id} />
            )}
            
            {/* Discovered Patterns */}
            {topCorrelations.length > 0 && (
              <CorrelationInsights 
                correlations={topCorrelations}
                onViewDetails={() => setCurrentView('insights')}
              />
            )}
          </div>
        )}

        {/* History View */}
        {currentView === 'history' && (
          <div className="space-y-5 stagger-fade-in">
            {/* Week selector */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold">Week Days</h2>
                <button className="text-xs text-primary font-semibold flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                </button>
              </div>
              <WeekDaySelector
                days={weekDays}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </Card>
            
            {/* Full Calendar */}
            <Card className="p-4">
              <CalendarHistory 
                entries={entries}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </Card>

            {selectedDateEntries.length > 0 ? (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold">
                    {format(selectedDate, 'EEEE, MMM d')}
                  </h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {selectedDateEntries.length} {selectedDateEntries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <EnhancedFlareHistory 
                  entries={selectedDateEntries} 
                  onUpdate={handleUpdateEntry}
                  onDelete={handleDeleteEntry}
                  onAddFollowUp={handleAddFollowUp}
                  onGenerateClinicalRecord={(entry) => {
                    setClinicalRecordEntry(entry);
                    setShowClinicalRecord(true);
                  }}
                  onGenerateBulkClinicalRecord={(entries) => {
                    setClinicalRecordEntry(entries[0]);
                    setShowClinicalRecord(true);
                  }}
                />
              </div>
            ) : (
              <Card className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <CalendarIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No entries</p>
                <p className="text-xs text-muted-foreground">
                  {format(selectedDate, 'MMM d, yyyy')}
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Insights View */}
        {currentView === 'insights' && user && (
          <div className="space-y-5 stagger-fade-in">
            <WeeklyReportCard userId={user.id} />
            
            <RevampedInsights 
              entries={entries} 
              userConditions={userProfile?.conditions}
              medicationLogs={medicationLogs}
              onLogMedication={addMedicationLog}
              userMedications={userProfile?.medications?.map(m => m.name) || []}
              onStartProtocol={(rec) => {
                setProtocolPrompt(rec);
                setShowProtocolChat(true);
              }}
            />
          </div>
        )}

        {/* Profile View */}
        {currentView === 'profile' && (
          <ProfileManager 
            onRequireOnboarding={() => setShowOnboarding(true)}
          />
        )}
      </MobileLayout>

      {/* Protocol Builder Chat Dialog */}
      <Dialog open={showProtocolChat} onOpenChange={setShowProtocolChat}>
        <DialogContent className="max-w-md p-0 overflow-hidden max-h-[90vh]">
          {user && (
            <LimitlessAIChat 
              userId={user.id}
              initialPrompt={protocolPrompt || undefined}
              isProtocolMode={true}
              onClose={() => {
                setShowProtocolChat(false);
                setProtocolPrompt(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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
