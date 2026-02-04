/**
 * Capacitor Native Bridge
 * 
 * This module provides native mobile capabilities when running in Capacitor.
 * Falls back gracefully to web APIs when running in browser.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// Check if running in native app
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/**
 * Native Haptics - Enhanced feedback for native apps
 */
export const nativeHaptics = {
  light: async () => {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  },
  medium: async () => {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  },
  heavy: async () => {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  },
  success: async () => {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    }
  },
  warning: async () => {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Warning });
    }
  },
  error: async () => {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Error });
    }
  },
  selection: async () => {
    if (isNative) {
      await Haptics.selectionStart();
      await Haptics.selectionEnd();
    }
  }
};

/**
 * Status Bar Control
 */
export const statusBar = {
  setDark: async () => {
    if (isNative) {
      await StatusBar.setStyle({ style: Style.Dark });
    }
  },
  setLight: async () => {
    if (isNative) {
      await StatusBar.setStyle({ style: Style.Light });
    }
  },
  hide: async () => {
    if (isNative) {
      await StatusBar.hide();
    }
  },
  show: async () => {
    if (isNative) {
      await StatusBar.show();
    }
  },
  setBackgroundColor: async (color: string) => {
    if (isNative && platform === 'android') {
      await StatusBar.setBackgroundColor({ color });
    }
  }
};

/**
 * Splash Screen Control
 */
export const splashScreen = {
  hide: async () => {
    if (isNative) {
      await SplashScreen.hide();
    }
  },
  show: async () => {
    if (isNative) {
      await SplashScreen.show();
    }
  }
};

/**
 * Push Notifications
 */
export const pushNotifications = {
  requestPermissions: async () => {
    if (!isNative) return { receive: 'denied' as const };
    
    const result = await PushNotifications.requestPermissions();
    return result;
  },
  
  register: async () => {
    if (!isNative) return;
    await PushNotifications.register();
  },
  
  addListeners: (callbacks: {
    onRegistration?: (token: string) => void;
    onNotification?: (notification: any) => void;
    onAction?: (action: any) => void;
    onError?: (error: any) => void;
  }) => {
    if (!isNative) return () => {};
    
    const listeners: (() => void)[] = [];
    
    if (callbacks.onRegistration) {
      PushNotifications.addListener('registration', (token) => {
        callbacks.onRegistration?.(token.value);
      }).then(l => listeners.push(() => l.remove()));
    }
    
    if (callbacks.onNotification) {
      PushNotifications.addListener('pushNotificationReceived', callbacks.onNotification)
        .then(l => listeners.push(() => l.remove()));
    }
    
    if (callbacks.onAction) {
      PushNotifications.addListener('pushNotificationActionPerformed', callbacks.onAction)
        .then(l => listeners.push(() => l.remove()));
    }
    
    if (callbacks.onError) {
      PushNotifications.addListener('registrationError', callbacks.onError)
        .then(l => listeners.push(() => l.remove()));
    }
    
    // Return cleanup function
    return () => listeners.forEach(remove => remove());
  }
};

/**
 * Native Camera
 */
export const nativeCamera = {
  takePhoto: async () => {
    if (!isNative) {
      // Fallback to web file input
      return null;
    }
    
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      
      return image.dataUrl;
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  },
  
  pickFromGallery: async () => {
    if (!isNative) {
      return null;
    }
    
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });
      
      return image.dataUrl;
    } catch (error) {
      console.error('Gallery error:', error);
      return null;
    }
  },
  
  checkPermissions: async () => {
    if (!isNative) return { camera: 'granted', photos: 'granted' };
    
    const result = await Camera.checkPermissions();
    return result;
  },
  
  requestPermissions: async () => {
    if (!isNative) return { camera: 'granted', photos: 'granted' };
    
    const result = await Camera.requestPermissions();
    return result;
  }
};

/**
 * Initialize Capacitor when app starts
 */
export const initializeCapacitor = async () => {
  if (!isNative) {
    console.log('Running in web mode');
    return;
  }
  
  console.log(`Running in native mode on ${platform}`);
  
  // Hide splash screen after a delay
  setTimeout(async () => {
    await splashScreen.hide();
  }, 500);
  
  // Set status bar style
  await statusBar.setDark();
};
