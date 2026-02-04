import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.jvala.health',
  appName: 'Jvala',
  webDir: 'dist',
  server: {
    // Development: Hot reload from Lovable preview
    url: 'https://7319d3cd-d538-457c-8551-4e2c9224cf96.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
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
