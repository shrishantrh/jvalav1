import { useState } from "react";
import jvalaLogo from "@/assets/jvala-logo.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { QuickEntry } from "@/components/QuickEntry";
import { DetailedEntry } from "@/components/DetailedEntry";
import { InsightsPanel } from "@/components/InsightsPanel";
import { FlareTimeline } from "@/components/flare/FlareTimeline";
import { Calendar, TrendingUp, Plus, Activity, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, subDays, subHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const Demo = () => {
  const [currentView, setCurrentView] = useState<'today' | 'timeline' | 'insights'>('today');
  const { toast } = useToast();
  const navigate = useNavigate();

  // Sample demo data
  const [entries, setEntries] = useState<FlareEntry[]>([
    {
      id: '1',
      timestamp: new Date(),
      type: 'flare',
      severity: 'moderate',
      symptoms: ['Joint Pain', 'Fatigue'],
      note: 'Woke up with stiffness in hands',
      environmentalData: {
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          city: 'San Francisco',
          country: 'USA'
        },
        weather: {
          temperature: 72,
          humidity: 65,
          pressure: 30.1,
          condition: 'Cloudy',
          windSpeed: 8
        }
      },
      physiologicalData: {
        heartRate: 78,
        bloodPressure: { systolic: 120, diastolic: 80 },
        sleepHours: 6.5,
        sleepQuality: 'fair',
        stressLevel: 6,
        steps: 4500
      }
    },
    {
      id: '2',
      timestamp: subHours(new Date(), 3),
      type: 'medication',
      medications: ['Ibuprofen 200mg'],
      note: 'Took for joint pain'
    },
    {
      id: '3',
      timestamp: subDays(new Date(), 1),
      type: 'flare',
      severity: 'mild',
      symptoms: ['Muscle Stiffness'],
      environmentalData: {
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          city: 'San Francisco',
          country: 'USA'
        },
        weather: {
          temperature: 68,
          humidity: 70,
          pressure: 29.9,
          condition: 'Rainy',
          windSpeed: 12
        }
      }
    },
    {
      id: '4',
      timestamp: subDays(new Date(), 2),
      type: 'energy',
      energyLevel: 'good',
      note: 'Felt energized after yoga'
    },
    {
      id: '5',
      timestamp: subDays(new Date(), 3),
      type: 'flare',
      severity: 'severe',
      symptoms: ['Joint Pain', 'Fatigue', 'Swelling', 'Morning Stiffness'],
      note: 'Bad flare day, stayed in bed',
      environmentalData: {
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          city: 'San Francisco',
          country: 'USA'
        },
        weather: {
          temperature: 65,
          humidity: 80,
          pressure: 29.5,
          condition: 'Storm',
          windSpeed: 20
        }
      }
    }
  ]);

  const handleSaveEntry = (entryData: Partial<FlareEntry>) => {
    const newEntry: FlareEntry = {
      id: Date.now().toString(),
      timestamp: entryData.timestamp || new Date(),
      type: entryData.type || 'note',
      severity: entryData.severity,
      energyLevel: entryData.energyLevel,
      symptoms: entryData.symptoms,
      medications: entryData.medications,
      triggers: entryData.triggers,
      note: entryData.note,
      environmentalData: entryData.environmentalData,
      physiologicalData: entryData.physiologicalData,
    };

    setEntries(prev => [newEntry, ...prev]);

    toast({
      title: "Demo entry added",
      description: "This is demo mode - data is not saved permanently",
    });
  };

  const handleUpdateEntry = (entryId: string, updates: Partial<FlareEntry>) => {
    setEntries(prev => prev.map(entry => 
      entry.id === entryId ? { ...entry, ...updates } : entry
    ));

    toast({
      title: "Entry updated",
      description: "Demo mode - changes won't be saved",
    });
  };

  const handleDeleteEntry = (entryId: string) => {
    setEntries(prev => prev.filter(entry => entry.id !== entryId));

    toast({
      title: "Entry deleted",
      description: "Demo mode - entry removed from view",
    });
  };

  const handleAddFollowUp = (entryId: string, followUpNote: string) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        const followUps = entry.followUps || [];
        return {
          ...entry,
          followUps: [...followUps, {
            timestamp: new Date().toISOString(),
            note: followUpNote
          }]
        };
      }
      return entry;
    }));

    toast({
      title: "Follow-up added",
      description: "Demo mode - follow-up added to entry",
    });
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
              <Badge variant="secondary" className="text-xs">
                Demo Mode - Data Not Saved
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/auth')}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-md mx-auto px-4 py-6 space-y-6 pb-24">
        {/* View Selector */}
        <Card className="glass border-0 shadow-soft">
          <div className="grid grid-cols-3 p-1">
            <Button
              variant={currentView === 'today' ? 'default' : 'ghost'}
              onClick={() => setCurrentView('today')}
              className="flex flex-col items-center gap-1 h-14"
              size="sm"
            >
              <Calendar className="w-4 h-4" />
              <span className="text-xs">Today</span>
            </Button>
            <Button
              variant={currentView === 'timeline' ? 'default' : 'ghost'}
              onClick={() => setCurrentView('timeline')}
              className="flex flex-col items-center gap-1 h-14"
              size="sm"
            >
              <Activity className="w-4 h-4" />
              <span className="text-xs">History</span>
            </Button>
            <Button
              variant={currentView === 'insights' ? 'default' : 'ghost'}
              onClick={() => setCurrentView('insights')}
              className="flex flex-col items-center gap-1 h-14"
              size="sm"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Insights</span>
            </Button>
          </div>
        </Card>

        {/* Today View */}
        {currentView === 'today' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="glass shadow-soft border-0">
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-clinical">Quick Track</h2>
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <QuickEntry onSave={handleSaveEntry} />
                <div className="pt-2 border-t">
                  <DetailedEntry onSave={handleSaveEntry} />
                </div>
              </div>
            </Card>

            {/* Today's Summary */}
            <Card className="glass shadow-soft border-0">
              <div className="p-4">
                <h2 className="text-lg font-clinical mb-4">Today's Activity</h2>
                {todaysEntries.length > 0 ? (
                  <div className="space-y-3">
                    {todaysEntries.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <span className="text-2xl">{getEntryIcon(entry.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-clinical capitalize">{entry.type}</span>
                            {entry.severity && (
                              <span className={`text-xs font-medium ${getSeverityColor(entry.severity)}`}>
                                {entry.severity}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{format(entry.timestamp, 'h:mm a')}</p>
                          {entry.note && (
                            <p className="text-sm mt-1 text-foreground/80">{entry.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No entries yet today</p>
                    <p className="text-xs mt-1">Use Quick Track above to log your first entry</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Timeline View */}
        {currentView === 'timeline' && (
          <FlareTimeline entries={entries} />
        )}

        {/* Insights View */}
        {currentView === 'insights' && (
          <InsightsPanel entries={entries} />
        )}
      </main>

      {/* Demo Notice Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-primary/10 border-t border-primary/20 p-3 text-center">
        <p className="text-sm text-primary font-medium">
          🎭 Demo Mode - Sign up to save your real health data
        </p>
      </div>
    </div>
  );
};

export default Demo;
