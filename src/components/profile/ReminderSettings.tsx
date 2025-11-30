import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Bell, Clock, Mail, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReminderSettingsProps {
  userEmail?: string | null;
}

interface EngagementSettings {
  reminder_enabled: boolean;
  reminder_times: string[];
}

const TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
];

export const ReminderSettings = ({ userEmail }: ReminderSettingsProps) => {
  const [settings, setSettings] = useState<EngagementSettings>({
    reminder_enabled: false,
    reminder_times: ['08:00', '20:00'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('engagement')
        .select('reminder_enabled, reminder_times')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setSettings({
          reminder_enabled: data.reminder_enabled || false,
          reminder_times: data.reminder_times || ['08:00', '20:00'],
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

      const { error } = await supabase
        .from('engagement')
        .upsert({
          user_id: user.id,
          reminder_enabled: updatedSettings.reminder_enabled,
          reminder_times: updatedSettings.reminder_times,
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
    if (!userEmail) {
      toast({ title: "No email found", description: "Please set your email in profile first", variant: "destructive" });
      return;
    }

    setTestSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('send-reminder', {
        body: { 
          userId: user.id,
          email: userEmail,
          type: 'test'
        }
      });

      if (error) throw error;
      toast({ 
        title: "Test reminder sent! 📧", 
        description: `Check ${userEmail}` 
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Daily Reminders</CardTitle>
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
                {settings.reminder_enabled ? 'You\'ll receive daily nudges' : 'Reminders are off'}
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
                  You'll receive a reminder if you haven't logged by the selected times. 
                  Reminders pause when you've already tracked that day.
                </AlertDescription>
              </Alert>
            </div>
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
          {userEmail ? (
            <>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{userEmail}</p>
                  <p className="text-xs text-muted-foreground">Reminders will be sent here</p>
                </div>
                <CheckCircle className="w-4 h-4 text-severity-none" />
              </div>
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
            </>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                No email found. Add your email in the Personal tab to receive reminders.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Alert className="bg-muted/50">
        <Bell className="w-4 h-4" />
        <AlertDescription className="text-xs">
          <strong>How it works:</strong> Each morning/evening at your selected times, 
          we'll check if you've logged that day. If not, you'll get a friendly email 
          reminder. Logging resets the reminder until the next check time.
        </AlertDescription>
      </Alert>
    </div>
  );
};
