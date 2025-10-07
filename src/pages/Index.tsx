import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { Settings } from "@/components/Settings";
import { QuickEntry } from "@/components/QuickEntry";
import { DetailedEntry } from "@/components/DetailedEntry";
import { InsightsPanel } from "@/components/InsightsPanel";
import { FlareTimeline } from "@/components/flare/FlareTimeline";
import { Calendar, TrendingUp, Plus, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday } from "date-fns";
import { analyzeNoteForEntry } from "@/utils/geminiService";

const Index = () => {
  const [currentView, setCurrentView] = useState<'today' | 'timeline' | 'insights'>('today');
  const [entries, setEntries] = useState<FlareEntry[]>([]);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const { toast } = useToast();

  // Load data from localStorage
  useEffect(() => {
    const savedEntries = localStorage.getItem('flare-entries');
    const savedApiKey = localStorage.getItem('gemini-api-key');
    
    if (savedEntries) {
      try {
        const parsed = JSON.parse(savedEntries);
        setEntries(parsed.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        })));
      } catch (error) {
        console.error('Failed to load entries:', error);
      }
    }
    
    if (savedApiKey) {
      setGeminiApiKey(savedApiKey);
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    localStorage.setItem('flare-entries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('gemini-api-key', geminiApiKey);
  }, [geminiApiKey]);

  const handleSaveEntry = (entryData: Partial<FlareEntry>) => {
    const newEntry: FlareEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type: 'note',
      ...entryData,
    } as FlareEntry;

    setEntries(prev => [newEntry, ...prev]);
    
    toast({
      title: "Entry saved",
      description: `${newEntry.type.charAt(0).toUpperCase() + newEntry.type.slice(1)} logged successfully`,
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
            <Settings 
              geminiApiKey={geminiApiKey} 
              onApiKeyChange={setGeminiApiKey} 
            />
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
                onAiSuggestion={analyzeNoteForEntry}
                geminiApiKey={geminiApiKey}
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
          <FlareTimeline entries={entries} />
        )}

        {/* Insights View */}
        {currentView === 'insights' && (
          <InsightsPanel entries={entries} geminiApiKey={geminiApiKey} />
        )}
      </main>
    </div>
  );
};

export default Index;