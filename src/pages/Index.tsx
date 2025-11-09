import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import jvalaLogo from "@/assets/jvala-logo.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlareEntry } from "@/types/flare";
import { QuickEntry } from "@/components/QuickEntry";
import { DetailedEntry } from "@/components/DetailedEntry";
import { InsightsPanel } from "@/components/InsightsPanel";
import { FlareTimeline } from "@/components/flare/FlareTimeline";
import { ProfileSettings } from "@/components/ProfileSettings";
import { 
  LayoutDashboard, 
  Calendar, 
  TrendingUp, 
  FileText, 
  User as UserIcon, 
  LogOut,
  Activity,
  Plus,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'timeline' | 'insights' | 'reports' | 'profile'>('dashboard');
  const [entries, setEntries] = useState<FlareEntry[]>([]);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check auth and load data
  useEffect(() => {
    if (!user && !loading) {
      navigate('/auth');
      return;
    }

    if (user) {
      loadEntries();
    }
  }, [user, loading, navigate]);

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
          followUps: entry.follow_ups || [],
          environmentalData: entry.environmental_data,
          physiologicalData: entry.physiological_data,
        })));
      }
    } catch (error) {
      console.error('Failed to load entries:', error);
      toast({
        title: "Error loading entries",
        description: "Failed to load your health data",
        variant: "destructive"
      });
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
          environmental_data: entryData.environmentalData as any || null,
          physiological_data: entryData.physiologicalData as any || null,
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
        
        toast({
          title: "Entry saved",
          description: `${newEntry.type.charAt(0).toUpperCase() + newEntry.type.slice(1)} logged successfully`,
        });
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

      toast({
        title: "Entry updated",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error('Failed to update entry:', error);
      toast({
        title: "Error updating entry",
        description: "Failed to update your entry",
        variant: "destructive"
      });
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

      toast({
        title: "Entry deleted",
        description: "Entry removed successfully",
      });
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast({
        title: "Error deleting entry",
        description: "Failed to delete your entry",
        variant: "destructive"
      });
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
        .update({
          follow_ups: updatedFollowUps
        })
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (error) throw error;

      setEntries(prev => prev.map(e => 
        e.id === entryId ? { ...e, followUps: updatedFollowUps } : e
      ));

      toast({
        title: "Follow-up added",
        description: "Update saved successfully",
      });
    } catch (error) {
      console.error('Failed to add follow-up:', error);
      toast({
        title: "Error adding follow-up",
        description: "Failed to save your update",
        variant: "destructive"
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Dashboard calculations
  const getTodaysEntries = () => entries.filter(entry => isToday(entry.timestamp));
  const getWeekEntries = () => {
    const now = new Date();
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    return entries.filter(entry => entry.timestamp >= start && entry.timestamp <= end);
  };

  const getFlareStats = () => {
    const weekEntries = getWeekEntries();
    const flares = weekEntries.filter(e => e.type === 'flare');
    const severeCount = flares.filter(e => e.severity === 'severe').length;
    const moderateCount = flares.filter(e => e.severity === 'moderate').length;
    const mildCount = flares.filter(e => e.severity === 'mild').length;
    
    return { total: flares.length, severe: severeCount, moderate: moderateCount, mild: mildCount };
  };

  const getSymptomFrequency = () => {
    const weekEntries = getWeekEntries();
    const symptomMap: Record<string, number> = {};
    
    weekEntries.forEach(entry => {
      if (entry.symptoms) {
        entry.symptoms.forEach(symptom => {
          symptomMap[symptom] = (symptomMap[symptom] || 0) + 1;
        });
      }
    });
    
    return Object.entries(symptomMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  };

  const getWeekCalendar = () => {
    const now = new Date();
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    const days = eachDayOfInterval({ start, end });
    
    return days.map(day => {
      const dayEntries = entries.filter(entry => 
        format(entry.timestamp, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );
      const hasFlare = dayEntries.some(e => e.type === 'flare');
      const severity = dayEntries.find(e => e.type === 'flare')?.severity;
      
      return { date: day, count: dayEntries.length, hasFlare, severity };
    });
  };

  const todaysEntries = getTodaysEntries();
  const flareStats = getFlareStats();
  const topSymptoms = getSymptomFrequency();
  const weekCalendar = getWeekCalendar();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-screen w-20 border-r bg-card flex flex-col items-center py-6 gap-8 z-50">
        <img src={jvalaLogo} alt="jvala" className="w-10 h-10" />
        
        <nav className="flex-1 flex flex-col gap-2">
          <Button
            variant={currentView === 'dashboard' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setCurrentView('dashboard')}
            className="w-12 h-12 rounded-xl"
            title="Dashboard"
          >
            <LayoutDashboard className="w-5 h-5" />
          </Button>
          
          <Button
            variant={currentView === 'timeline' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setCurrentView('timeline')}
            className="w-12 h-12 rounded-xl"
            title="Timeline"
          >
            <Calendar className="w-5 h-5" />
          </Button>
          
          <Button
            variant={currentView === 'insights' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setCurrentView('insights')}
            className="w-12 h-12 rounded-xl"
            title="Insights"
          >
            <TrendingUp className="w-5 h-5" />
          </Button>
          
          <Button
            variant={currentView === 'reports' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setCurrentView('reports')}
            className="w-12 h-12 rounded-xl"
            title="Medical Reports"
          >
            <FileText className="w-5 h-5" />
          </Button>
        </nav>
        
        <div className="flex flex-col gap-2">
          <Button
            variant={currentView === 'profile' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setCurrentView('profile')}
            className="w-12 h-12 rounded-xl"
            title="Profile"
          >
            <UserIcon className="w-5 h-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="w-12 h-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-20 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
          <div className="container max-w-7xl mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">
                  {currentView === 'dashboard' && 'Dashboard'}
                  {currentView === 'timeline' && 'Timeline'}
                  {currentView === 'insights' && 'Insights & Analytics'}
                  {currentView === 'reports' && 'Medical Reports'}
                  {currentView === 'profile' && 'Profile Settings'}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
              
              {currentView === 'dashboard' && (
                <DetailedEntry onSave={handleSaveEntry} />
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="container max-w-7xl mx-auto px-8 py-8">
          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Quick Entry & Today's Activity */}
              <div className="lg:col-span-1 space-y-6">
                {/* Quick Entry */}
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-primary" />
                    </div>
                    <h2 className="font-semibold">Quick Track</h2>
                  </div>
                  <QuickEntry onSave={handleSaveEntry} />
                </Card>

                {/* Today's Summary */}
                <Card className="p-6">
                  <h2 className="font-semibold mb-4">Today's Activity</h2>
                  {todaysEntries.length > 0 ? (
                    <div className="space-y-3">
                      {todaysEntries.slice(0, 5).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium capitalize">{entry.type}</p>
                              {entry.severity && (
                                <p className="text-xs text-muted-foreground capitalize">{entry.severity}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(entry.timestamp, 'h:mm a')}
                          </span>
                        </div>
                      ))}
                      {todaysEntries.length > 5 && (
                        <p className="text-xs text-center text-muted-foreground">
                          +{todaysEntries.length - 5} more entries
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No entries today</p>
                    </div>
                  )}
                </Card>
              </div>

              {/* Middle Column - Week Overview & Stats */}
              <div className="lg:col-span-2 space-y-6">
                {/* Week Calendar */}
                <Card className="p-6">
                  <h2 className="font-semibold mb-4">This Week</h2>
                  <div className="grid grid-cols-7 gap-2">
                    {weekCalendar.map((day, idx) => (
                      <div key={idx} className="text-center">
                        <p className="text-xs text-muted-foreground mb-2">
                          {format(day.date, 'EEE')}
                        </p>
                        <div 
                          className={`
                            aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-xs
                            ${isToday(day.date) ? 'border-primary bg-primary/5' : 'border-border'}
                            ${day.hasFlare && day.severity === 'severe' ? 'bg-severity-severe/10' : ''}
                            ${day.hasFlare && day.severity === 'moderate' ? 'bg-severity-moderate/10' : ''}
                            ${day.hasFlare && day.severity === 'mild' ? 'bg-severity-mild/10' : ''}
                          `}
                        >
                          <span className="font-semibold">{format(day.date, 'd')}</span>
                          {day.count > 0 && (
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {day.count}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Flares This Week</h3>
                      <AlertCircle className="w-4 h-4 text-severity-moderate" />
                    </div>
                    <p className="text-3xl font-bold mb-1">{flareStats.total}</p>
                    {flareStats.total > 0 && (
                      <div className="flex gap-2 text-xs">
                        {flareStats.severe > 0 && (
                          <span className="text-severity-severe">{flareStats.severe} severe</span>
                        )}
                        {flareStats.moderate > 0 && (
                          <span className="text-severity-moderate">{flareStats.moderate} moderate</span>
                        )}
                        {flareStats.mild > 0 && (
                          <span className="text-severity-mild">{flareStats.mild} mild</span>
                        )}
                      </div>
                    )}
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Total Entries</h3>
                      <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-3xl font-bold mb-1">{getWeekEntries().length}</p>
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                  </Card>
                </div>

                {/* Top Symptoms */}
                {topSymptoms.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold mb-4">Most Frequent Symptoms</h3>
                    <div className="space-y-3">
                      {topSymptoms.map(([symptom, count]) => (
                        <div key={symptom}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{symptom}</span>
                            <span className="text-xs text-muted-foreground">{count} times</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${(count / Math.max(...topSymptoms.map(s => s[1]))) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Timeline View */}
          {currentView === 'timeline' && (
            <FlareTimeline 
              entries={entries} 
              onUpdate={handleUpdateEntry}
              onDelete={handleDeleteEntry}
              onAddFollowUp={handleAddFollowUp}
            />
          )}

          {/* Insights View */}
          {currentView === 'insights' && (
            <InsightsPanel entries={entries} />
          )}

          {/* Reports View */}
          {currentView === 'reports' && (
            <div className="max-w-4xl">
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-2">Medical Reports</h2>
                <p className="text-muted-foreground mb-6">
                  Generate comprehensive reports for your healthcare provider
                </p>
                
                <div className="space-y-4">
                  <Tabs defaultValue="export" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="export">Export Data</TabsTrigger>
                      <TabsTrigger value="share">Share Report</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="export" className="space-y-4 mt-6">
                      {/* Import export components inline */}
                      <div className="text-center py-8">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          Export functionality available in Insights tab
                        </p>
                        <Button 
                          onClick={() => setCurrentView('insights')}
                          className="mt-4"
                        >
                          Go to Insights
                        </Button>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="share" className="space-y-4 mt-6">
                      <div className="text-center py-8">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          Profile sharing available in Profile settings
                        </p>
                        <Button 
                          onClick={() => setCurrentView('profile')}
                          className="mt-4"
                        >
                          Go to Profile
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </Card>
            </div>
          )}

          {/* Profile View */}
          {currentView === 'profile' && (
            <div className="max-w-4xl">
              <ProfileSettings />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
