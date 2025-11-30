import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import jvalaLogo from "@/assets/jvala-logo.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { QuickEntry } from "@/components/QuickEntry";
import { DetailedEntry } from "@/components/DetailedEntry";
import { InsightsPanel } from "@/components/InsightsPanel";
import { FlareTimeline } from "@/components/flare/FlareTimeline";
import { ProfileSettings } from "@/components/ProfileSettings";
import { Calendar, TrendingUp, Plus, Activity, LogOut, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [currentView, setCurrentView] = useState<'today' | 'timeline' | 'insights' | 'profile'>('today');
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
      // Get current entry
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

  const getTodaysEntries = () => entries.filter(entry => isToday(entry.timestamp));
  const todaysEntries = getTodaysEntries();

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'flare': return '🔥';
      case 'energy': return '⚡';
      case 'medication': return '💊';
      case 'trigger': return '⚠️';
      case 'recovery': return '💚';
      default: return '📝';
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'mild': return 'text-severity-mild';
      case 'moderate': return 'text-severity-moderate';
      case 'severe': return 'text-severity-severe';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b shadow-soft">
        <div className="container max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <img src={jvalaLogo} alt="jvala" className="w-8 h-8" />
                <h1 className="text-lg font-medical text-foreground">
                  Flare Journal <span className="text-sm text-primary">DEMO</span>
                </h1>
              </div>
              <div className="text-xs text-muted-foreground ml-10">
                {format(new Date(), 'EEEE, MMM d')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentView('profile')}
                className="h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary transition-all"
                title="Profile"
              >
                <UserIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="container max-w-md mx-auto px-4 py-5">
        <div className="flex bg-card/80 backdrop-blur rounded-2xl p-1.5 shadow-soft border">
          <Button
            variant={currentView === 'today' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('today')}
            className={`flex-1 text-xs h-9 rounded-xl transition-all ${
              currentView === 'today' 
                ? 'shadow-primary' 
                : 'hover:bg-accent/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Today
          </Button>
          <Button
            variant={currentView === 'timeline' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('timeline')}
            className={`flex-1 text-xs h-9 rounded-xl transition-all ${
              currentView === 'timeline' 
                ? 'shadow-primary' 
                : 'hover:bg-accent/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            History
          </Button>
          <Button
            variant={currentView === 'insights' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('insights')}
            className={`flex-1 text-xs h-9 rounded-xl transition-all ${
              currentView === 'insights' 
                ? 'shadow-primary' 
                : 'hover:bg-accent/50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Insights
          </Button>
        </div>
      </div>

      {/* Content */}
      <main className="container max-w-md mx-auto px-4 pb-8 space-y-5">
        {/* Today View */}
        {currentView === 'today' && (
          <>
            {/* Today's Summary */}
            {todaysEntries.length > 0 && (
              <Card className="p-5 shadow-soft-lg hover-lift bg-gradient-card border-0 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-clinical">Today's Activity</h2>
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {todaysEntries.length} {todaysEntries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {todaysEntries.slice(0, 3).map((entry, idx) => (
                    <div 
                      key={entry.id} 
                      className="flex items-center justify-between p-3 bg-muted/40 rounded-xl hover:bg-muted/60 transition-all cursor-pointer hover-scale"
                      style={{ animationDelay: `${idx * 0.1}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getEntryIcon(entry.type)}</span>
                        <div>
                          <span className="text-sm font-clinical capitalize">{entry.type}</span>
                          {entry.severity && (
                            <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${getSeverityColor(entry.severity)} bg-current/10`}>
                              {entry.severity}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {format(entry.timestamp, 'h:mm a')}
                      </span>
                    </div>
                  ))}
                  {todaysEntries.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center pt-2 font-medium">
                      +{todaysEntries.length - 3} more entries
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Quick Entry */}
            <Card className="p-5 shadow-soft-lg hover-lift bg-gradient-card border-0 animate-fade-in">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-soft">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-clinical">Quick Track</h2>
              </div>
              <QuickEntry
                onSave={handleSaveEntry}
              />
              
              {/* Detailed Entry Option */}
              <div className="pt-4 mt-4 border-t">
                <DetailedEntry onSave={handleSaveEntry} />
              </div>
            </Card>

            {/* Empty state */}
            {todaysEntries.length === 0 && (
              <Card className="p-8 text-center shadow-soft-lg bg-gradient-card border-0 animate-scale-in">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-primary/10 flex items-center justify-center">
                  <span className="text-4xl">🌟</span>
                </div>
                <h3 className="text-base font-clinical mb-2">Start tracking today</h3>
                <p className="text-sm text-muted-foreground">
                  Use the quick actions above to log your first entry
                </p>
              </Card>
            )}
          </>
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

        {/* Profile View */}
        {currentView === 'profile' && (
          <ProfileSettings />
        )}
      </main>
    </div>
  );
};

export default Index;