import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pill, Clock, Sparkles, AlertCircle, Check } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MedicationDetails {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

interface SmartReminder {
  id: string;
  medicationName: string;
  suggestedTime: string;
  reason: string;
  enabled: boolean;
}

interface SmartMedicationRemindersProps {
  medications: MedicationDetails[];
}

// Parse frequency to suggest reminder times
const parseFrequencyToTimes = (frequency: string | undefined, notes: string | undefined): { time: string; reason: string }[] => {
  const lower = (frequency || '').toLowerCase() + ' ' + (notes || '').toLowerCase();
  
  const times: { time: string; reason: string }[] = [];
  
  // Morning patterns
  if (/morning|breakfast|wake|am\b|before\s+eating|empty\s+stomach/i.test(lower)) {
    times.push({ time: '07:00', reason: 'Morning dose' });
  }
  
  // Midday patterns  
  if (/lunch|noon|midday|afternoon/i.test(lower)) {
    times.push({ time: '12:00', reason: 'Midday dose' });
  }
  
  // Evening patterns
  if (/evening|dinner|supper/i.test(lower)) {
    times.push({ time: '18:00', reason: 'Evening dose' });
  }
  
  // Night/bedtime patterns
  if (/night|bed|sleep|pm\b/i.test(lower)) {
    times.push({ time: '21:00', reason: 'Bedtime dose' });
  }
  
  // Frequency-based
  if (/twice\s*(a\s*)?daily|2x\s*daily|bid/i.test(lower)) {
    if (times.length === 0) {
      times.push({ time: '08:00', reason: 'Morning (twice daily)' });
      times.push({ time: '20:00', reason: 'Evening (twice daily)' });
    }
  } else if (/three\s*times|3x\s*daily|tid/i.test(lower)) {
    if (times.length === 0) {
      times.push({ time: '08:00', reason: 'Morning (3x daily)' });
      times.push({ time: '14:00', reason: 'Afternoon (3x daily)' });
      times.push({ time: '20:00', reason: 'Evening (3x daily)' });
    }
  } else if (/once\s*(a\s*)?daily|daily|qd/i.test(lower)) {
    if (times.length === 0) {
      times.push({ time: '08:00', reason: 'Daily dose' });
    }
  }
  
  // Insulin patterns
  if (/insulin|before\s+meal|with\s+meal/i.test(lower)) {
    if (times.length === 0) {
      times.push({ time: '07:30', reason: 'Before breakfast' });
      times.push({ time: '12:30', reason: 'Before lunch' });
      times.push({ time: '18:30', reason: 'Before dinner' });
    }
  }
  
  // Default if nothing matched
  if (times.length === 0) {
    times.push({ time: '09:00', reason: 'Daily reminder' });
  }
  
  return times;
};

const TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '07:30', label: '7:30 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
  { value: '22:00', label: '10:00 PM' },
];

export const SmartMedicationReminders = ({ medications }: SmartMedicationRemindersProps) => {
  const [reminders, setReminders] = useState<SmartReminder[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const { toast } = useToast();

  // Load saved reminders
  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('engagement')
        .select('home_shortcuts')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.home_shortcuts) {
        const savedReminders = (data.home_shortcuts as any[])
          .filter(s => s.type === 'medication_reminder')
          .map(s => s as SmartReminder);
        
        if (savedReminders.length > 0) {
          setReminders(savedReminders);
          setHasGenerated(true);
        }
      }
    } catch (error) {
      console.error('Error loading medication reminders:', error);
    }
  };

  const generateSmartReminders = () => {
    const newReminders: SmartReminder[] = [];
    
    medications.forEach(med => {
      const suggestedTimes = parseFrequencyToTimes(med.frequency, med.notes);
      
      suggestedTimes.forEach((suggestion, idx) => {
        newReminders.push({
          id: `${med.name}-${idx}-${Date.now()}`,
          medicationName: med.name,
          suggestedTime: suggestion.time,
          reason: suggestion.reason,
          enabled: true,
        });
      });
    });
    
    setReminders(newReminders);
    setHasGenerated(true);
    saveReminders(newReminders);
    
    toast({
      title: "Smart reminders generated! ✨",
      description: `Created ${newReminders.length} medication reminders based on your schedule`,
    });
  };

  const saveReminders = async (remindersToSave: SmartReminder[]) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current home_shortcuts and filter out old medication reminders
      const { data: current } = await supabase
        .from('engagement')
        .select('home_shortcuts')
        .eq('user_id', user.id)
        .maybeSingle();

      const existingShortcuts = (current?.home_shortcuts as any[] || [])
        .filter(s => s.type !== 'medication_reminder');

      // Add new medication reminders
      const updatedShortcuts = [
        ...existingShortcuts,
        ...remindersToSave.map(r => ({ ...r, type: 'medication_reminder' }))
      ];

      const { error } = await supabase
        .from('engagement')
        .upsert({
          user_id: user.id,
          home_shortcuts: updatedShortcuts as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleReminder = (id: string) => {
    const updated = reminders.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    setReminders(updated);
    saveReminders(updated);
  };

  const updateReminderTime = (id: string, newTime: string) => {
    const updated = reminders.map(r => 
      r.id === id ? { ...r, suggestedTime: newTime } : r
    );
    setReminders(updated);
    saveReminders(updated);
  };

  const deleteReminder = (id: string) => {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    saveReminders(updated);
  };

  if (medications.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Pill className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Add medications in your Profile → Health section to enable smart reminders
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Smart Medication Reminders</CardTitle>
          </div>
          {!hasGenerated && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={generateSmartReminders}
              disabled={saving}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Generate
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">
          AI-analyzed reminders based on your medication schedule
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasGenerated && reminders.length > 0 ? (
          <div className="space-y-3">
            {reminders.map(reminder => (
              <div 
                key={reminder.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={reminder.enabled}
                    onCheckedChange={() => toggleReminder(reminder.id)}
                  />
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {reminder.medicationName}
                      <Badge variant="outline" className="text-[10px] h-4">
                        {reminder.reason}
                      </Badge>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Select 
                        value={reminder.suggestedTime}
                        onValueChange={(v) => updateReminderTime(reminder.id, v)}
                      >
                        <SelectTrigger className="h-6 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => deleteReminder(reminder.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
            
            <div className="pt-2 border-t mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={generateSmartReminders}
                disabled={saving}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Regenerate from medications
              </Button>
            </div>
          </div>
        ) : hasGenerated ? (
          <div className="text-center py-4">
            <Check className="w-6 h-6 mx-auto text-severity-none mb-2" />
            <p className="text-sm text-muted-foreground">
              No medication reminders configured
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={generateSmartReminders}
            >
              Generate Reminders
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              We can analyze your {medications.length} medication{medications.length > 1 ? 's' : ''} and create smart reminders
            </p>
            <Button onClick={generateSmartReminders} disabled={saving}>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Smart Reminders
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
