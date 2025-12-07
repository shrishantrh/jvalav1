import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Bell, Clock, Mail, CheckCircle, AlertTriangle, Plus, Trash2, Edit2, Pill } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReminderSettingsProps {
  userEmail?: string | null;
}

interface CustomReminder {
  id: string;
  name: string;
  time: string;
  type: 'medication' | 'checkin' | 'custom';
  enabled: boolean;
}

interface EngagementSettings {
  reminder_enabled: boolean;
  reminder_times: string[];
  custom_reminders?: CustomReminder[];
  reminder_email?: string;
}

const TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
];

export const ReminderSettings = ({ userEmail }: ReminderSettingsProps) => {
  const [settings, setSettings] = useState<EngagementSettings>({
    reminder_enabled: false,
    reminder_times: ['08:00', '20:00'],
    custom_reminders: [],
    reminder_email: userEmail || '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newReminder, setNewReminder] = useState<Partial<CustomReminder>>({
    name: '',
    time: '09:00',
    type: 'custom',
    enabled: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (userEmail && !settings.reminder_email) {
      setSettings(prev => ({ ...prev, reminder_email: userEmail }));
    }
  }, [userEmail]);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('engagement')
        .select('reminder_enabled, reminder_times, home_shortcuts')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        // Parse custom reminders from home_shortcuts field (repurposed for now)
        let customReminders: CustomReminder[] = [];
        try {
          if (data.home_shortcuts && Array.isArray(data.home_shortcuts)) {
            customReminders = data.home_shortcuts
              .filter((s: any) => typeof s === 'object' && s.type === 'reminder')
              .map((s: any) => s as CustomReminder);
          }
        } catch {}

        setSettings({
          reminder_enabled: data.reminder_enabled || false,
          reminder_times: data.reminder_times || ['08:00', '20:00'],
          custom_reminders: customReminders,
          reminder_email: userEmail || '',
        });
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<EngagementSettings>) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      // Store custom reminders in home_shortcuts for now
      const homeShortcuts = updatedSettings.custom_reminders?.map(r => ({
        ...r,
        type: 'reminder'
      })) || [];

      const { error } = await supabase
        .from('engagement')
        .upsert({
          user_id: user.id,
          reminder_enabled: updatedSettings.reminder_enabled,
          reminder_times: updatedSettings.reminder_times,
          home_shortcuts: homeShortcuts as any,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      toast({ title: "Reminder settings saved" });
    } catch (error: any) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendTestReminder = async () => {
    const email = settings.reminder_email || userEmail;
    if (!email) {
      toast({ title: "No email found", description: "Please set your email first", variant: "destructive" });
      return;
    }

    setTestSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('send-reminder', {
        body: { 
          userId: user.id,
          email,
          type: 'test'
        }
      });

      if (error) throw error;
      toast({ 
        title: "Test reminder sent! 📧", 
        description: `Check ${email}` 
      });
    } catch (error: any) {
      toast({ 
        title: "Failed to send", 
        description: error.message || "Check that email is configured correctly", 
        variant: "destructive" 
      });
    } finally {
      setTestSending(false);
    }
  };

  const updateMorningTime = (time: string) => {
    const newTimes = [time, settings.reminder_times[1] || '20:00'];
    saveSettings({ reminder_times: newTimes });
  };

  const updateEveningTime = (time: string) => {
    const newTimes = [settings.reminder_times[0] || '08:00', time];
    saveSettings({ reminder_times: newTimes });
  };

  const addCustomReminder = () => {
    if (!newReminder.name || !newReminder.time) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    const reminder: CustomReminder = {
      id: Date.now().toString(),
      name: newReminder.name,
      time: newReminder.time!,
      type: newReminder.type as 'medication' | 'checkin' | 'custom',
      enabled: true,
    };

    const updatedReminders = [...(settings.custom_reminders || []), reminder];
    saveSettings({ custom_reminders: updatedReminders });
    setNewReminder({ name: '', time: '09:00', type: 'custom', enabled: true });
    setShowAddDialog(false);
  };

  const deleteCustomReminder = (id: string) => {
    const updatedReminders = settings.custom_reminders?.filter(r => r.id !== id) || [];
    saveSettings({ custom_reminders: updatedReminders });
  };

  const toggleCustomReminder = (id: string) => {
    const updatedReminders = settings.custom_reminders?.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ) || [];
    saveSettings({ custom_reminders: updatedReminders });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const activeEmail = settings.reminder_email || userEmail;

  return (
    <div className="space-y-4">
      {/* Daily Reminders */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Daily Check-in Reminders</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Get gentle email nudges to maintain your tracking streak
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <Label className="font-medium">Enable Reminders</Label>
              <p className="text-xs text-muted-foreground">
                {settings.reminder_enabled ? "You'll receive daily check-in nudges" : 'Reminders are off'}
              </p>
            </div>
            <Switch
              checked={settings.reminder_enabled}
              onCheckedChange={(checked) => saveSettings({ reminder_enabled: checked })}
              disabled={saving}
            />
          </div>

          {/* Time Selection */}
          {settings.reminder_enabled && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-2">
                    <Clock className="w-3 h-3" />
                    Morning Check-in
                  </Label>
                  <Select 
                    value={settings.reminder_times[0] || '08:00'} 
                    onValueChange={updateMorningTime}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.filter(t => parseInt(t.value) < 12).map(time => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-2">
                    <Clock className="w-3 h-3" />
                    Evening Check-in
                  </Label>
                  <Select 
                    value={settings.reminder_times[1] || '20:00'} 
                    onValueChange={updateEveningTime}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.filter(t => parseInt(t.value) >= 12).map(time => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Alert className="bg-primary/5 border-primary/20">
                <CheckCircle className="w-4 h-4 text-primary" />
                <AlertDescription className="text-xs">
                  Reminders only sent if you haven't logged yet that day.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Reminders */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Custom Reminders</CardTitle>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Custom Reminder</DialogTitle>
                  <DialogDescription>
                    Create a reminder for medication, check-ins, or anything else
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Reminder Name</Label>
                    <Input
                      placeholder="e.g., Take morning medication"
                      value={newReminder.name || ''}
                      onChange={(e) => setNewReminder(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Time</Label>
                      <Select 
                        value={newReminder.time || '09:00'} 
                        onValueChange={(v) => setNewReminder(prev => ({ ...prev, time: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(time => (
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select 
                        value={newReminder.type || 'custom'} 
                        onValueChange={(v) => setNewReminder(prev => ({ ...prev, type: v as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medication">Medication</SelectItem>
                          <SelectItem value="checkin">Check-in</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={addCustomReminder} className="w-full">
                    Add Reminder
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription className="text-xs">
            Medication reminders and custom alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings.custom_reminders && settings.custom_reminders.length > 0 ? (
            <div className="space-y-2">
              {settings.custom_reminders.map(reminder => (
                <div 
                  key={reminder.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={reminder.enabled}
                      onCheckedChange={() => toggleCustomReminder(reminder.id)}
                    />
                    <div>
                      <p className="text-sm font-medium">{reminder.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {TIME_OPTIONS.find(t => t.value === reminder.time)?.label || reminder.time}
                        {' • '}
                        {reminder.type}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteCustomReminder(reminder.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No custom reminders yet. Add one to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Email Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Email Delivery</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Delivery Email</Label>
            <Input
              type="email"
              value={settings.reminder_email || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, reminder_email: e.target.value }))}
              onBlur={() => saveSettings({ reminder_email: settings.reminder_email })}
              placeholder="your@email.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              All reminders will be sent to this address
            </p>
          </div>

          {activeEmail && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={sendTestReminder}
              disabled={testSending}
            >
              {testSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Send Test Reminder
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
