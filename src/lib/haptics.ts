// Haptic feedback utilities for mobile devices

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export function haptic(type: HapticType = 'light') {
  // Check for Vibration API support
  if (!('vibrate' in navigator)) return;

  const patterns: Record<HapticType, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [20, 40, 20],
    error: [30, 50, 30, 50, 30],
    selection: 5,
  };

  try {
    navigator.vibrate(patterns[type]);
  } catch (e) {
    // Silently fail if vibration not supported
  }
}

// Convenience methods
export const haptics = {
  light: () => haptic('light'),
  medium: () => haptic('medium'),
  heavy: () => haptic('heavy'),
  success: () => haptic('success'),
  warning: () => haptic('warning'),
  error: () => haptic('error'),
  selection: () => haptic('selection'),
  
  // Custom pattern
  custom: (pattern: number | number[]) => {
    if (!('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Silently fail
    }
  },
};

// React hook for haptic feedback
export function useHaptic() {
  return haptics;
}
