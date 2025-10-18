import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { QuickEntry } from "@/components/QuickEntry";
import { DetailedEntry } from "@/components/DetailedEntry";
import { InsightsPanel } from "@/components/InsightsPanel";
import { FlareTimeline } from "@/components/flare/FlareTimeline";
import { Calendar, TrendingUp, Plus, Activity, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [currentView, setCurrentView] = useState<'today' | 'timeline' | 'insights'>('today');
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-medical text-primary">Flare Journal</h1>
              <div className="text-xs text-muted-foreground">
                {format(new Date(), 'EEEE, MMM d')}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="h-9 w-9 p-0"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="container max-w-md mx-auto px-4 py-4">
        <div className="flex bg-muted rounded-medical p-1">
          <Button
            variant={currentView === 'today' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('today')}
            className="flex-1 text-xs h-8"
          >
            <Activity className="w-3 h-3 mr-1" />
            Today
          </Button>
          <Button
            variant={currentView === 'timeline' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('timeline')}
            className="flex-1 text-xs h-8"
          >
            <Calendar className="w-3 h-3 mr-1" />
            History
          </Button>
          <Button
            variant={currentView === 'insights' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('insights')}
            className="flex-1 text-xs h-8"
          >
            <TrendingUp className="w-3 h-3 mr-1" />
            Insights
          </Button>
        </div>
      </div>

      {/* Content */}
      <main className="container max-w-md mx-auto px-4 pb-6 space-y-4">
        {/* Today View */}
        {currentView === 'today' && (
          <>
            {/* Today's Summary */}
            {todaysEntries.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-clinical">Today's Activity</h2>
                  <span className="text-xs text-muted-foreground">
                    {todaysEntries.length} entries
                  </span>
                </div>
                <div className="space-y-2">
                  {todaysEntries.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{getEntryIcon(entry.type)}</span>
                        <div>
                          <span className="text-sm font-clinical capitalize">{entry.type}</span>
                          {entry.severity && (
                            <span className={`text-xs ml-2 ${getSeverityColor(entry.severity)}`}>
                              {entry.severity}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(entry.timestamp, 'h:mm a')}
                      </span>
                    </div>
                  ))}
                  {todaysEntries.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center pt-1">
                      +{todaysEntries.length - 3} more entries
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Quick Entry */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-clinical">Quick Track</h2>
              </div>
              <QuickEntry
                onSave={handleSaveEntry}
              />
              
              {/* Detailed Entry Option */}
              <div className="pt-3 border-t">
                <DetailedEntry onSave={handleSaveEntry} />
              </div>
            </Card>

            {/* Empty state */}
            {todaysEntries.length === 0 && (
              <Card className="p-6 text-center">
                <div className="text-4xl mb-2">🌟</div>
                <h3 className="text-sm font-clinical mb-1">Start tracking today</h3>
                <p className="text-xs text-muted-foreground">
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
      </main>
    </div>
  );
};

export default Index;