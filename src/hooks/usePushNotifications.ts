import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

// Get VAPID public key from environment or use a fallback check
const getVapidPublicKey = async (): Promise<string | null> => {
  try {
    // Try to get it from the edge function
    const { data } = await supabase.functions.invoke('get-vapid-key');
    return data?.publicKey || null;
  } catch {
    return null;
  }
};

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if notifications and service workers are supported
    const checkSupport = async () => {
      const notificationsSupported = 'Notification' in window;
      const serviceWorkerSupported = 'serviceWorker' in navigator;
      const pushSupported = 'PushManager' in window;
      
      const supported = notificationsSupported && serviceWorkerSupported && pushSupported;
      setIsSupported(supported);
      
      if (notificationsSupported) {
        setPermission(Notification.permission);
      }
      
      if (supported) {
        try {
          // Register service worker
          const reg = await navigator.serviceWorker.register('/sw.js');
          setRegistration(reg);
          console.log('[Push] Service worker registered');
          
          // Check if already subscribed
          const subscription = await reg.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (error) {
          console.error('[Push] Service worker registration failed:', error);
        }
      }
    };
    
    checkSupport();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications require a modern browser with service worker support. Try Chrome, Firefox, or Safari.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        // Subscribe to push notifications
        const subscribed = await subscribeToPush();
        if (subscribed) {
          toast({
            title: 'Notifications Enabled',
            description: 'You will receive reminders even when the app is closed',
          });
        }
        return subscribed;
      } else if (result === 'denied') {
        toast({
          title: 'Notifications Blocked',
          description: 'Please enable notifications in your browser settings',
          variant: 'destructive',
        });
      }
      return false;
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
      return false;
    }
  }, [isSupported, toast]);

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!registration) {
      console.error('[Push] No service worker registration');
      return false;
    }

    try {
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        console.log('[Push] VAPID key not available, using local notifications only');
        return true; // Still enable local notifications
      }

      // Convert VAPID key to Uint8Array
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Save subscription to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const subscriptionJson = subscription.toJSON();
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh_key: subscriptionJson.keys?.p256dh || '',
            auth_key: subscriptionJson.keys?.auth || '',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,endpoint'
          });

        if (error) {
          console.error('[Push] Error saving subscription:', error);
        } else {
          console.log('[Push] Subscription saved to database');
          setIsSubscribed(true);
        }
      }

      return true;
    } catch (error) {
      console.error('[Push] Error subscribing to push:', error);
      // Even if push subscription fails, local notifications can still work
      return true;
    }
  }, [registration]);

  const sendNotification = useCallback((options: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.log('[Push] Notifications not available');
      return null;
    }

    try {
      // Use service worker to show notification (works even when app is in background)
      if (registration) {
        registration.showNotification(options.title, {
          body: options.body,
          icon: options.icon || '/favicon.ico',
          tag: options.tag,
          requireInteraction: options.requireInteraction ?? false,
        });
        return true;
      }
      
      // Fallback to regular notification API
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
      console.error('[Push] Error sending notification:', error);
      return null;
    }
  }, [isSupported, permission, registration]);

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

  const unsubscribe = useCallback(async () => {
    if (!registration) return;

    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove from database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
        }
        
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
    }
  }, [registration]);

  return {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    sendNotification,
    scheduleMedicationReminder,
    sendFlareAlert,
    sendStreakReminder,
    unsubscribe,
  };
};
