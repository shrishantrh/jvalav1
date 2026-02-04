// Haptic feedback utilities for iOS/Android native feel
// Uses Capacitor for native apps, web fallbacks otherwise

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'impact';

// Check if running in native Capacitor app
const isNative = Capacitor.isNativePlatform();

// AudioContext for web fallback (creates subtle click sounds)
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext && typeof AudioContext !== 'undefined') {
    try {
      audioContext = new AudioContext();
    } catch (e) {
      // AudioContext not supported
    }
  }
  return audioContext;
}

// Generate a subtle click sound as haptic fallback for web
function playHapticSound(type: HapticType) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const settings: Record<HapticType, { freq: number; duration: number; volume: number }> = {
      light: { freq: 1200, duration: 0.008, volume: 0.03 },
      selection: { freq: 1400, duration: 0.006, volume: 0.02 },
      medium: { freq: 800, duration: 0.015, volume: 0.05 },
      heavy: { freq: 400, duration: 0.025, volume: 0.08 },
      success: { freq: 1000, duration: 0.020, volume: 0.04 },
      warning: { freq: 600, duration: 0.030, volume: 0.06 },
      error: { freq: 300, duration: 0.050, volume: 0.10 },
      impact: { freq: 500, duration: 0.012, volume: 0.07 },
    };

    const { freq, duration, volume } = settings[type];

    oscillator.frequency.value = freq;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silently fail
  }
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

// Native Capacitor haptic feedback
async function nativeHaptic(type: HapticType): Promise<void> {
  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
      case 'impact':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        break;
      case 'selection':
        await Haptics.selectionStart();
        await Haptics.selectionEnd();
        break;
    }
  } catch (e) {
    // Fallback to web haptics
    webHaptic(type);
  }
}

// Web fallback haptic feedback
function webHaptic(type: HapticType) {
  // Try Vibration API first (works on Android)
  if ('vibrate' in navigator && !isIOS()) {
    const patterns: Record<HapticType, number | number[]> = {
      light: 8,
      medium: 15,
      heavy: 25,
      success: [8, 40, 8],
      warning: [15, 35, 15],
      error: [25, 45, 25, 45, 25],
      selection: 5,
      impact: 12,
    };

    try {
      navigator.vibrate(patterns[type]);
      return;
    } catch (e) {
      // Fall through to audio feedback
    }
  }

  // For iOS or when vibration fails, use audio feedback
  if (isIOS() || isAndroid()) {
    playHapticSound(type);
  }
}

export function haptic(type: HapticType = 'light') {
  if (isNative) {
    nativeHaptic(type);
  } else {
    webHaptic(type);
  }
}

// Convenience methods - work in both native and web
export const haptics = {
  light: () => haptic('light'),
  medium: () => haptic('medium'),
  heavy: () => haptic('heavy'),
  success: () => haptic('success'),
  warning: () => haptic('warning'),
  error: () => haptic('error'),
  selection: () => haptic('selection'),
  impact: () => haptic('impact'),
  
  // Custom pattern (Android/web vibration only)
  custom: (pattern: number | number[]) => {
    if (isNative) {
      // Native doesn't support custom patterns, use medium
      nativeHaptic('medium');
      return;
    }
    if (!('vibrate' in navigator) || isIOS()) {
      playHapticSound('medium');
      return;
    }
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      playHapticSound('medium');
    }
  },
};

// React hook for haptic feedback
export function useHaptic() {
  return haptics;
}
