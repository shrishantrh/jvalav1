import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.jvala.health',
  appName: 'Jvala',
  webDir: 'dist',
  // No server.url = loads local bundled assets from dist/
  backgroundColor: '#F3F0EA',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#F3F0EA',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F3F0EA',
      overlaysWebView: true
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
    scheme: 'jvala',
    backgroundColor: '#F3F0EA'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#F3F0EA'
  }
};

export default config;
