import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Mail, 
  Calendar, 
  Loader2, 
  Check, 
  Clock,
  BarChart3,
  Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface WeeklyDigestSettingsProps {
  userId: string;
  userEmail?: string;
  userName?: string;
}

interface DigestSettings {
  enabled: boolean;
  dayOfWeek: number;
  time: string;
  lastSent?: Date;
}

export const WeeklyDigestSettings = ({ userId, userEmail, userName }: WeeklyDigestSettingsProps) => {
  const [settings, setSettings] = useState<DigestSettings>(() => {
    const stored = localStorage.getItem('weekly_digest_settings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { enabled: false, dayOfWeek: 0, time: '09:00' };
      }
    }
    return { enabled: false, dayOfWeek: 0, time: '09:00' };
  });
  
  const [isSending, setIsSending] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<'success' | 'error' | null>(null);
  const { toast } = useToast();

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  const updateSettings = (updates: Partial<DigestSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    localStorage.setItem('weekly_digest_settings', JSON.stringify(newSettings));
  };

  const sendTestDigest = async () => {
    if (!userEmail) {
      toast({
        title: 'Email Required',
        description: 'Please add an email address to your profile to receive digests',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setLastSendResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-weekly-digest', {
        body: {
          userId,
          email: userEmail,
          fullName: userName,
        }
      });

      if (error) throw error;

      setLastSendResult('success');
      updateSettings({ lastSent: new Date() });
      
      toast({
        title: 'Digest Sent!',
        description: `Weekly digest sent to ${userEmail}`,
      });
    } catch (error) {
      console.error('Error sending digest:', error);
      setLastSendResult('error');
      toast({
        title: 'Failed to Send',
        description: 'Could not send the weekly digest. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="p-5 bg-gradient-card border-0 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Weekly Email Digest</h3>
            <p className="text-xs text-muted-foreground">
              Receive a summary of your health data
            </p>
          </div>
        </div>
        <Switch 
          checked={settings.enabled}
          onCheckedChange={(enabled) => updateSettings({ enabled })}
        />
      </div>

      {settings.enabled && (
        <div className="space-y-4 pt-2">
          {/* Email Display */}
          {userEmail && (
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{userEmail}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                Verified
              </Badge>
            </div>
          )}

          {/* Schedule Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Delivery Schedule</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Day of Week</label>
                <select
                  value={settings.dayOfWeek}
                  onChange={(e) => updateSettings({ dayOfWeek: parseInt(e.target.value) })}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  {daysOfWeek.map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Time</label>
                <input
                  type="time"
                  value={settings.time}
                  onChange={(e) => updateSettings({ time: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                />
              </div>
            </div>
          </div>

          {/* What's Included */}
          <div className="p-3 bg-muted/30 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">What's Included</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6">
              <li>• Weekly flare count and severity trends</li>
              <li>• Top symptoms and triggers</li>
              <li>• Logging consistency score</li>
              <li>• Current streak status</li>
              <li>• Personalized insights</li>
            </ul>
          </div>

          {/* Test Send */}
          <div className="flex items-center gap-3">
            <Button 
              onClick={sendTestDigest}
              disabled={isSending || !userEmail}
              className="flex-1"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Test Digest Now
                </>
              )}
            </Button>
            
            {lastSendResult === 'success' && (
              <div className="p-2 bg-green-100 rounded-full">
                <Check className="w-4 h-4 text-green-600" />
              </div>
            )}
          </div>

          {settings.lastSent && (
            <p className="text-xs text-muted-foreground text-center">
              Last sent: {format(new Date(settings.lastSent), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      )}

      {!settings.enabled && (
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">
            Enable weekly digests to receive automated health summaries via email.
          </p>
        </div>
      )}
    </Card>
  );
};
