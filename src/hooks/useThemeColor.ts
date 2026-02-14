import { useState, useEffect, useCallback } from 'react';

export type ThemeColor = 'amber' | 'pink' | 'blue' | 'purple' | 'red' | 'green' | 'teal';

interface ThemeColorConfig {
  name: string;
  label: string;
  hue: number;
  saturation: number;
  lightness: number;
  emoji: string;
}

export const THEME_COLORS: Record<ThemeColor, ThemeColorConfig> = {
  amber: {
    name: 'amber',
    label: 'Amber',
    hue: 25,
    saturation: 75,
    lightness: 50,
    emoji: '🔥',
  },
  pink: {
    name: 'pink',
    label: 'Pink',
    hue: 330,
    saturation: 80,
    lightness: 55,
    emoji: '💗',
  },
  blue: {
    name: 'blue',
    label: 'Blue',
    hue: 215,
    saturation: 75,
    lightness: 52,
    emoji: '💎',
  },
  purple: {
    name: 'purple',
    label: 'Purple',
    hue: 270,
    saturation: 70,
    lightness: 55,
    emoji: '🔮',
  },
  red: {
    name: 'red',
    label: 'Red',
    hue: 0,
    saturation: 75,
    lightness: 52,
    emoji: '❤️',
  },
  green: {
    name: 'green',
    label: 'Green',
    hue: 145,
    saturation: 60,
    lightness: 45,
    emoji: '🌿',
  },
  teal: {
    name: 'teal',
    label: 'Teal',
    hue: 175,
    saturation: 65,
    lightness: 45,
    emoji: '🌊',
  },
};

const STORAGE_KEY = 'jvala-theme-color';

function applyThemeColor(color: ThemeColor) {
  const config = THEME_COLORS[color];
  const root = document.documentElement;
  
  // Light mode
  root.style.setProperty('--primary', `${config.hue} ${config.saturation}% ${config.lightness}%`);
  root.style.setProperty('--primary-hover', `${config.hue} ${config.saturation + 5}% ${config.lightness - 5}%`);
  root.style.setProperty('--primary-glow', `${config.hue} ${config.saturation + 10}% ${config.lightness + 10}%`);
  root.style.setProperty('--ring', `${config.hue} ${config.saturation}% ${config.lightness}%`);
  
  // Update gradients
  root.style.setProperty(
    '--gradient-primary', 
    `linear-gradient(145deg, hsl(${config.hue} ${config.saturation}% ${config.lightness + 5}%) 0%, hsl(${config.hue + 10} ${config.saturation - 5}% ${config.lightness}%) 100%)`
  );
  root.style.setProperty(
    '--gradient-warm', 
    `linear-gradient(145deg, hsl(${config.hue + 5} ${config.saturation + 5}% ${config.lightness + 2}%) 0%, hsl(${config.hue - 5} ${config.saturation}% ${config.lightness - 2}%) 100%)`
  );
  root.style.setProperty(
    '--gradient-hero', 
    `linear-gradient(160deg, hsl(${config.hue + 5} ${config.saturation - 5}% ${config.lightness + 5}%) 0%, hsl(${config.hue} ${config.saturation}% ${config.lightness - 2}%) 50%, hsl(${config.hue - 5} ${config.saturation + 5}% ${config.lightness - 8}%) 100%)`
  );
  
  // Shadow with theme color
  root.style.setProperty(
    '--shadow-primary', 
    `0 4px 16px hsl(${config.hue} ${config.saturation}% ${config.lightness}% / 0.25)`
  );
  root.style.setProperty(
    '--shadow-glow', 
    `0 0 24px hsl(${config.hue} ${config.saturation}% ${config.lightness}% / 0.15)`
  );
}

export function useThemeColor() {
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved in THEME_COLORS) {
        return saved as ThemeColor;
      }
    }
    return 'pink';
  });

  // Apply theme on mount and changes
  useEffect(() => {
    applyThemeColor(themeColor);
  }, [themeColor]);

  const setThemeColor = useCallback((color: ThemeColor) => {
    setThemeColorState(color);
    localStorage.setItem(STORAGE_KEY, color);
    applyThemeColor(color);
  }, []);

  return {
    themeColor,
    setThemeColor,
    themeColors: THEME_COLORS,
  };
}

// Initialize theme color on app load
export function initializeThemeColor() {
  if (typeof window !== 'undefined') {
    // Always remove dark class — app is light-only
    document.documentElement.classList.remove('dark');
    
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in THEME_COLORS) {
      applyThemeColor(saved as ThemeColor);
    } else {
      // Default to pink and persist it so it never falls back to anything else
      localStorage.setItem(STORAGE_KEY, 'pink');
      applyThemeColor('pink');
    }
  }
}
