import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { toast } = useToast();

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Notifications are not supported in this browser',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive health reminders',
        });
        return true;
      } else if (result === 'denied') {
        toast({
          title: 'Notifications Blocked',
          description: 'Please enable notifications in your browser settings',
          variant: 'destructive',
        });
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported, toast]);

  const sendNotification = useCallback((options: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.log('Notifications not available');
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        requireInteraction: options.requireInteraction ?? false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  const scheduleMedicationReminder = useCallback((
    medicationName: string,
    timeMs: number
  ) => {
    if (permission !== 'granted') return null;

    const timeoutId = setTimeout(() => {
      sendNotification({
        title: '💊 Medication Reminder',
        body: `Time to take your ${medicationName}`,
        tag: `med-${medicationName}`,
        requireInteraction: true,
      });
    }, timeMs);

    return timeoutId;
  }, [permission, sendNotification]);

  const sendFlareAlert = useCallback((severity: string) => {
    if (permission !== 'granted') return;

    const severityEmoji = severity === 'severe' ? '🔴' : severity === 'moderate' ? '🟡' : '🟢';
    
    sendNotification({
      title: `${severityEmoji} Flare Logged`,
      body: `${severity.charAt(0).toUpperCase() + severity.slice(1)} flare recorded. Remember to add details when you can.`,
      tag: 'flare-alert',
    });
  }, [permission, sendNotification]);

  const sendStreakReminder = useCallback(() => {
    if (permission !== 'granted') return;

    sendNotification({
      title: '🔥 Keep Your Streak!',
      body: "Don't forget to log today to maintain your streak",
      tag: 'streak-reminder',
      requireInteraction: true,
    });
  }, [permission, sendNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    scheduleMedicationReminder,
    sendFlareAlert,
    sendStreakReminder,
  };
};
