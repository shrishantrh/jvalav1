/**
 * Capacitor Native Bridge
 * 
 * This module provides native mobile capabilities when running in Capacitor.
 * Falls back gracefully to web APIs when running in browser.
 */

// Safe check for Capacitor availability
const getCapacitor = () => {
  try {
    return typeof window !== 'undefined' && (window as any).Capacitor;
  } catch {
    return null;
  }
};

// Check if running in native app - with safety checks
export const isNative = (() => {
  try {
    const cap = getCapacitor();
    return cap?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
})();

export const platform = (() => {
  try {
    const cap = getCapacitor();
    return cap?.getPlatform?.() ?? 'web';
  } catch {
    return 'web';
  }
})();

/**
 * Safely import Capacitor plugins - only when available
 */
const loadPlugins = async () => {
  if (!isNative) return null;
  
  try {
    const [haptics, statusBar, splash, push, camera, health] = await Promise.all([
      import('@capacitor/haptics').catch(() => null),
      import('@capacitor/status-bar').catch(() => null),
      import('@capacitor/splash-screen').catch(() => null),
      import('@capacitor/push-notifications').catch(() => null),
      import('@capacitor/camera').catch(() => null),
      import('@capgo/capacitor-health').catch(() => null),
    ]);
    
    return { haptics, statusBar, splash, push, camera, health };
  } catch {
    return null;
  }
};

let plugins: Awaited<ReturnType<typeof loadPlugins>> = null;

/**
 * Native Haptics - Enhanced feedback for native apps
 */
export const nativeHaptics = {
  light: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.haptics) {
        await p.haptics.Haptics.impact({ style: p.haptics.ImpactStyle.Light });
      }
    } catch (e) {
      console.log('Haptics not available:', e);
    }
  },
  medium: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.haptics) {
        await p.haptics.Haptics.impact({ style: p.haptics.ImpactStyle.Medium });
      }
    } catch (e) {
      console.log('Haptics not available:', e);
    }
  },
  heavy: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.haptics) {
        await p.haptics.Haptics.impact({ style: p.haptics.ImpactStyle.Heavy });
      }
    } catch (e) {
      console.log('Haptics not available:', e);
    }
  },
  success: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.haptics) {
        await p.haptics.Haptics.notification({ type: p.haptics.NotificationType.Success });
      }
    } catch (e) {
      console.log('Haptics not available:', e);
    }
  },
  warning: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.haptics) {
        await p.haptics.Haptics.notification({ type: p.haptics.NotificationType.Warning });
      }
    } catch (e) {
      console.log('Haptics not available:', e);
    }
  },
  error: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.haptics) {
        await p.haptics.Haptics.notification({ type: p.haptics.NotificationType.Error });
      }
    } catch (e) {
      console.log('Haptics not available:', e);
    }
  },
  selection: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.haptics) {
        await p.haptics.Haptics.selectionStart();
        await p.haptics.Haptics.selectionEnd();
      }
    } catch (e) {
      console.log('Haptics not available:', e);
    }
  }
};

/**
 * Status Bar Control
 */
export const statusBar = {
  setDark: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.statusBar) {
        await p.statusBar.StatusBar.setStyle({ style: p.statusBar.Style.Dark });
      }
    } catch (e) {
      console.log('StatusBar not available:', e);
    }
  },
  setLight: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.statusBar) {
        await p.statusBar.StatusBar.setStyle({ style: p.statusBar.Style.Light });
      }
    } catch (e) {
      console.log('StatusBar not available:', e);
    }
  },
  hide: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.statusBar) {
        await p.statusBar.StatusBar.hide();
      }
    } catch (e) {
      console.log('StatusBar not available:', e);
    }
  },
  show: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.statusBar) {
        await p.statusBar.StatusBar.show();
      }
    } catch (e) {
      console.log('StatusBar not available:', e);
    }
  },
  setBackgroundColor: async (color: string) => {
    if (!isNative || platform !== 'android') return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.statusBar) {
        await p.statusBar.StatusBar.setBackgroundColor({ color });
      }
    } catch (e) {
      console.log('StatusBar not available:', e);
    }
  }
};

/**
 * Splash Screen Control
 */
export const splashScreen = {
  hide: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.splash) {
        await p.splash.SplashScreen.hide();
      }
    } catch (e) {
      console.log('SplashScreen not available:', e);
    }
  },
  show: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.splash) {
        await p.splash.SplashScreen.show();
      }
    } catch (e) {
      console.log('SplashScreen not available:', e);
    }
  }
};

/**
 * Push Notifications
 */
export const pushNotifications = {
  requestPermissions: async () => {
    if (!isNative) return { receive: 'denied' as const };
    try {
      const p = plugins || await loadPlugins();
      if (p?.push) {
        return await p.push.PushNotifications.requestPermissions();
      }
    } catch (e) {
      console.log('PushNotifications not available:', e);
    }
    return { receive: 'denied' as const };
  },
  
  register: async () => {
    if (!isNative) return;
    try {
      const p = plugins || await loadPlugins();
      if (p?.push) {
        await p.push.PushNotifications.register();
      }
    } catch (e) {
      console.log('PushNotifications not available:', e);
    }
  },
  
  addListeners: (callbacks: {
    onRegistration?: (token: string) => void;
    onNotification?: (notification: any) => void;
    onAction?: (action: any) => void;
    onError?: (error: any) => void;
  }) => {
    if (!isNative) return () => {};
    
    const setupListeners = async () => {
      try {
        const p = plugins || await loadPlugins();
        if (!p?.push) return () => {};
        
        const listeners: (() => void)[] = [];
        
        if (callbacks.onRegistration) {
          const l = await p.push.PushNotifications.addListener('registration', (token) => {
            callbacks.onRegistration?.(token.value);
          });
          listeners.push(() => l.remove());
        }
        
        if (callbacks.onNotification) {
          const l = await p.push.PushNotifications.addListener('pushNotificationReceived', callbacks.onNotification);
          listeners.push(() => l.remove());
        }
        
        if (callbacks.onAction) {
          const l = await p.push.PushNotifications.addListener('pushNotificationActionPerformed', callbacks.onAction);
          listeners.push(() => l.remove());
        }
        
        if (callbacks.onError) {
          const l = await p.push.PushNotifications.addListener('registrationError', callbacks.onError);
          listeners.push(() => l.remove());
        }
        
        return () => listeners.forEach(remove => remove());
      } catch (e) {
        console.log('PushNotifications listeners not available:', e);
        return () => {};
      }
    };
    
    let cleanup = () => {};
    setupListeners().then(c => { cleanup = c; });
    return () => cleanup();
  }
};

/**
 * Native Camera
 */
export const nativeCamera = {
  takePhoto: async () => {
    if (!isNative) return null;
    
    try {
      const p = plugins || await loadPlugins();
      if (!p?.camera) return null;
      
      const image = await p.camera.Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: p.camera.CameraResultType.DataUrl,
        source: p.camera.CameraSource.Camera
      });
      
      return image.dataUrl;
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  },
  
  pickFromGallery: async () => {
    if (!isNative) return null;
    
    try {
      const p = plugins || await loadPlugins();
      if (!p?.camera) return null;
      
      const image = await p.camera.Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: p.camera.CameraResultType.DataUrl,
        source: p.camera.CameraSource.Photos
      });
      
      return image.dataUrl;
    } catch (error) {
      console.error('Gallery error:', error);
      return null;
    }
  },
  
  checkPermissions: async () => {
    if (!isNative) return { camera: 'granted', photos: 'granted' };
    
    try {
      const p = plugins || await loadPlugins();
      if (!p?.camera) return { camera: 'granted', photos: 'granted' };
      
      return await p.camera.Camera.checkPermissions();
    } catch (e) {
      console.log('Camera permissions check failed:', e);
      return { camera: 'granted', photos: 'granted' };
    }
  },
  
  requestPermissions: async () => {
    if (!isNative) return { camera: 'granted', photos: 'granted' };
    
    try {
      const p = plugins || await loadPlugins();
      if (!p?.camera) return { camera: 'granted', photos: 'granted' };
      
      return await p.camera.Camera.requestPermissions();
    } catch (e) {
      console.log('Camera permissions request failed:', e);
      return { camera: 'granted', photos: 'granted' };
    }
  }
};

/**
 * Initialize Capacitor when app starts
 */
export const initializeCapacitor = async () => {
  console.log(`Running in ${isNative ? 'native' : 'web'} mode on ${platform}`);
  
  if (!isNative) return;
  
  try {
    // Pre-load plugins
    plugins = await loadPlugins();
    
    // Hide splash screen after a short delay to ensure UI is ready
    setTimeout(async () => {
      await splashScreen.hide();
    }, 300);
    
    // Set status bar style
    await statusBar.setDark();
  } catch (e) {
    console.log('Capacitor initialization error (this is normal for remote preview):', e);
  }
};
