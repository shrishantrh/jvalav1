import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, BellRing, Clock, Flame, Pill, AlertCircle } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

interface NotificationSettingsProps {
  onSettingsChange?: (settings: NotificationSettings) => void;
}

interface NotificationSettings {
  medicationReminders: boolean;
  flareAlerts: boolean;
  streakReminders: boolean;
  morningReminder: boolean;
  eveningReminder: boolean;
  morningTime: string;
  eveningTime: string;
}

export const NotificationSettings = ({ onSettingsChange }: NotificationSettingsProps) => {
  const { isSupported, permission, isSubscribed, requestPermission, sendStreakReminder } = usePushNotifications();
  
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const stored = localStorage.getItem('notification_settings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {
          medicationReminders: true,
          flareAlerts: true,
          streakReminders: true,
          morningReminder: true,
          eveningReminder: true,
          morningTime: '09:00',
          eveningTime: '21:00',
        };
      }
    }
    return {
      medicationReminders: true,
      flareAlerts: true,
      streakReminders: true,
      morningReminder: true,
      eveningReminder: true,
      morningTime: '09:00',
      eveningTime: '21:00',
    };
  });

  useEffect(() => {
    localStorage.setItem('notification_settings', JSON.stringify(settings));
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  const handleEnableNotifications = async () => {
    await requestPermission();
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const testNotification = () => {
    sendStreakReminder();
  };

  if (!isSupported) {
    return (
      <Card className="p-4 bg-muted/50">
        <div className="flex items-center gap-3 text-muted-foreground">
          <AlertCircle className="w-5 h-5" />
          <div>
            <span className="text-sm font-medium">Push Notifications</span>
            <p className="text-xs">Push notifications require a modern browser with service worker support. Try using Chrome, Firefox, Edge, or Safari on your device. If installed as an app, notifications work even when closed.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-5 bg-gradient-card border-0 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {permission === 'granted' ? (
            <div className="p-2 bg-green-100 rounded-full">
              <BellRing className="w-5 h-5 text-green-600" />
            </div>
          ) : (
            <div className="p-2 bg-muted rounded-full">
              <BellOff className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <h3 className="font-semibold">Push Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {permission === 'granted' 
                ? 'Notifications enabled'
                : permission === 'denied'
                ? 'Notifications blocked'
                : 'Enable to receive reminders'}
            </p>
          </div>
        </div>
        {permission !== 'granted' && (
          <Button 
            size="sm" 
            onClick={handleEnableNotifications}
            className="bg-primary hover:bg-primary/90"
          >
            <Bell className="w-4 h-4 mr-2" />
            Enable
          </Button>
        )}
        {permission === 'granted' && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              Active
            </Badge>
            {isSubscribed && (
              <Badge variant="outline" className="text-xs">
                Background enabled
              </Badge>
            )}
          </div>
        )}
      </div>

      {permission === 'granted' && (
        <div className="space-y-4 pt-2">
          {/* Medication Reminders */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Pill className="w-4 h-4 text-primary" />
              <div>
                <span className="text-sm font-medium">Medication Reminders</span>
                <p className="text-xs text-muted-foreground">Get reminded to take your meds</p>
              </div>
            </div>
            <Switch 
              checked={settings.medicationReminders}
              onCheckedChange={(v) => updateSetting('medicationReminders', v)}
            />
          </div>

          {/* Flare Alerts */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-primary" />
              <div>
                <span className="text-sm font-medium">Flare Confirmations</span>
                <p className="text-xs text-muted-foreground">Confirm when flares are logged</p>
              </div>
            </div>
            <Switch 
              checked={settings.flareAlerts}
              onCheckedChange={(v) => updateSetting('flareAlerts', v)}
            />
          </div>

          {/* Streak Reminders */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Flame className="w-4 h-4 text-orange-500" />
              <div>
                <span className="text-sm font-medium">Streak Reminders</span>
                <p className="text-xs text-muted-foreground">Don't break your logging streak</p>
              </div>
            </div>
            <Switch 
              checked={settings.streakReminders}
              onCheckedChange={(v) => updateSetting('streakReminders', v)}
            />
          </div>

          {/* Daily Reminders */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Daily Check-in Reminders</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(
                "p-3 rounded-lg border",
                settings.morningReminder ? "bg-primary/5 border-primary/20" : "bg-muted/30"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">Morning</span>
                  <Switch 
                    checked={settings.morningReminder}
                    onCheckedChange={(v) => updateSetting('morningReminder', v)}
                  />
                </div>
                <input 
                  type="time"
                  value={settings.morningTime}
                  onChange={(e) => updateSetting('morningTime', e.target.value)}
                  disabled={!settings.morningReminder}
                  className="w-full text-sm bg-transparent border-0 p-0 focus:outline-none disabled:opacity-50"
                />
              </div>
              
              <div className={cn(
                "p-3 rounded-lg border",
                settings.eveningReminder ? "bg-primary/5 border-primary/20" : "bg-muted/30"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">Evening</span>
                  <Switch 
                    checked={settings.eveningReminder}
                    onCheckedChange={(v) => updateSetting('eveningReminder', v)}
                  />
                </div>
                <input 
                  type="time"
                  value={settings.eveningTime}
                  onChange={(e) => updateSetting('eveningTime', e.target.value)}
                  disabled={!settings.eveningReminder}
                  className="w-full text-sm bg-transparent border-0 p-0 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Test Notification */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={testNotification}
            className="w-full mt-2"
          >
            <Bell className="w-4 h-4 mr-2" />
            Test Notification
          </Button>
        </div>
      )}

      {permission === 'denied' && (
        <div className="p-3 bg-destructive/10 rounded-lg">
          <p className="text-xs text-destructive">
            Notifications are blocked. Please enable them in your browser settings to receive reminders.
          </p>
        </div>
      )}
    </Card>
  );
};
