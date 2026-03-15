/**
 * Native iOS/Android push notification registration.
 * Uses @capacitor/push-notifications to get APNs/FCM device token
 * and saves it to the push_subscriptions table.
 */
import { useEffect, useCallback, useRef } from 'react';
import { isNative } from '@/lib/capacitor';
import { supabase } from '@/integrations/supabase/client';

export const useNativePush = () => {
  const registeredRef = useRef(false);

  const saveDeviceToken = useCallback(async (token: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[NativePush] No user, skipping token save');
        return;
      }

      console.log('[NativePush] Saving device token:', token.substring(0, 20) + '...');

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          platform: 'ios',
          device_token: token,
          endpoint: '',
          p256dh_key: '',
          auth_key: '',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,device_token',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('[NativePush] Error saving device token:', error);
      } else {
        console.log('[NativePush] Device token saved successfully');
      }
    } catch (e) {
      console.error('[NativePush] Error:', e);
    }
  }, []);

  const requestAndRegister = useCallback(async () => {
    if (!isNative || registeredRef.current) return;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Set up listeners BEFORE requesting permissions
      await PushNotifications.addListener('registration', (token) => {
        console.log('[NativePush] Got device token:', token.value.substring(0, 20) + '...');
        saveDeviceToken(token.value);
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('[NativePush] Registration error:', error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[NativePush] Notification received:', notification.title);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[NativePush] Notification action:', action.notification.title);
      });

      // Check current permission status
      const permStatus = await PushNotifications.checkPermissions();
      console.log('[NativePush] Current permission:', permStatus.receive);

      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        // Request permission
        const result = await PushNotifications.requestPermissions();
        console.log('[NativePush] Permission result:', result.receive);
        if (result.receive === 'granted') {
          await PushNotifications.register();
          registeredRef.current = true;
        }
      } else if (permStatus.receive === 'granted') {
        // Already granted, just register to get token
        await PushNotifications.register();
        registeredRef.current = true;
      } else {
        console.log('[NativePush] Permission denied, skipping registration');
      }
    } catch (e) {
      console.error('[NativePush] Setup error:', e);
    }
  }, [saveDeviceToken]);

  // Auto-register on mount if native
  useEffect(() => {
    if (!isNative) return;

    // Small delay to ensure auth is ready
    const timer = setTimeout(() => {
      requestAndRegister();
    }, 1500);

    return () => clearTimeout(timer);
  }, [requestAndRegister]);

  return { requestAndRegister };
};
