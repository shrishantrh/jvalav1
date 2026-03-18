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
    } catch {
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
      void ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const settings: Record<HapticType, { freq: number; duration: number; volume: number }> = {
      light: { freq: 1200, duration: 0.01, volume: 0.05 },
      selection: { freq: 1400, duration: 0.008, volume: 0.04 },
      medium: { freq: 800, duration: 0.02, volume: 0.07 },
      heavy: { freq: 400, duration: 0.032, volume: 0.1 },
      success: { freq: 1000, duration: 0.025, volume: 0.08 },
      warning: { freq: 600, duration: 0.04, volume: 0.1 },
      error: { freq: 300, duration: 0.055, volume: 0.12 },
      impact: { freq: 500, duration: 0.018, volume: 0.09 },
    };

    const { freq, duration, volume } = settings[type];

    oscillator.frequency.value = freq;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
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
  } catch {
    // Fallback to web haptics
    webHaptic(type);
  }
}

// Web fallback haptic feedback
function webHaptic(type: HapticType) {
  // Try Vibration API first (works on Android)
  if ('vibrate' in navigator && !isIOS()) {
    const patterns: Record<HapticType, number | number[]> = {
      light: 10,
      medium: 22,
      heavy: 36,
      success: [14, 50, 20, 40],
      warning: [20, 35, 20],
      error: [30, 45, 30, 45, 30],
      selection: 8,
      impact: 16,
    };

    try {
      navigator.vibrate(patterns[type]);
      return;
    } catch {
      // Fall through to audio feedback
    }
  }

  // For iOS or when vibration fails, use audio feedback
  if (isIOS() || isAndroid()) {
    playHapticSound(type);
  }
}

function triggerHaptic(type: HapticType = 'light') {
  if (isNative) {
    void nativeHaptic(type);
  } else {
    webHaptic(type);
  }
}

function runSequence(steps: Array<{ type: HapticType; delay: number }>) {
  steps.forEach((step) => {
    window.setTimeout(() => triggerHaptic(step.type), step.delay);
  });
}

export function haptic(type: HapticType = 'light') {
  triggerHaptic(type);
}

// Convenience methods - work in both native and web
export const haptics = {
  light: () => triggerHaptic('light'),
  medium: () => triggerHaptic('medium'),
  heavy: () => triggerHaptic('heavy'),
  warning: () => triggerHaptic('warning'),
  error: () => triggerHaptic('error'),
  selection: () => triggerHaptic('selection'),
  impact: () => triggerHaptic('impact'),

  // Longer success confirmation for milestones and completions
  success: () => {
    triggerHaptic('success');
    runSequence([
      { type: 'medium', delay: 110 },
      { type: 'light', delay: 220 },
    ]);
  },

  // Strong celebration chain for badges / major wins
  celebrate: () => {
    triggerHaptic('heavy');
    runSequence([
      { type: 'success', delay: 120 },
      { type: 'medium', delay: 260 },
      { type: 'success', delay: 420 },
    ]);
  },

  // Pulsing feedback for long actions (e.g., drag/slide)
  pulse: () => {
    triggerHaptic('light');
    runSequence([
      { type: 'light', delay: 80 },
      { type: 'impact', delay: 180 },
    ]);
  },

  // Custom pattern (Android/web vibration only)
  custom: (pattern: number | number[]) => {
    if (isNative) {
      triggerHaptic('medium');
      runSequence([{ type: 'light', delay: 90 }]);
      return;
    }
    if (!('vibrate' in navigator) || isIOS()) {
      playHapticSound('medium');
      return;
    }
    try {
      navigator.vibrate(pattern);
    } catch {
      playHapticSound('medium');
    }
  },
};

// React hook for haptic feedback
export function useHaptic() {
  return haptics;
}
