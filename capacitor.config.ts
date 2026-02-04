import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.jvala.health',
  appName: 'Jvala',
  webDir: 'dist',
  // No server.url = loads local bundled assets from dist/
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Haptics: {
      // Uses system defaults
    }
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'jvala'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0a0a'
  }
};

export default config;
