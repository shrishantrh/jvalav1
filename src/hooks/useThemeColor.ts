import { useState, useEffect, useCallback } from 'react';

export type ThemeColor = 'amber' | 'pink' | 'blue' | 'purple' | 'red' | 'green' | 'teal';
export type ThemeMode = 'light' | 'dark';

interface ThemeColorConfig {
  name: string;
  label: string;
  hue: number;
  saturation: number;
  lightness: number;
  emoji: string;
}

export const THEME_COLORS: Record<ThemeColor, ThemeColorConfig> = {
  amber: { name: 'amber', label: 'Amber', hue: 25, saturation: 75, lightness: 50, emoji: '🔥' },
  pink: { name: 'pink', label: 'Pink', hue: 330, saturation: 80, lightness: 55, emoji: '💗' },
  blue: { name: 'blue', label: 'Blue', hue: 215, saturation: 75, lightness: 52, emoji: '💎' },
  purple: { name: 'purple', label: 'Purple', hue: 270, saturation: 70, lightness: 55, emoji: '🔮' },
  red: { name: 'red', label: 'Red', hue: 0, saturation: 75, lightness: 52, emoji: '❤️' },
  green: { name: 'green', label: 'Green', hue: 145, saturation: 60, lightness: 45, emoji: '🌿' },
  teal: { name: 'teal', label: 'Teal', hue: 175, saturation: 65, lightness: 45, emoji: '🌊' },
};

const COLOR_STORAGE_KEY = 'jvala-theme-color';
const MODE_STORAGE_KEY = 'jvala-theme-mode';

function applyThemeColor(color: ThemeColor, mode: ThemeMode) {
  const config = THEME_COLORS[color];
  const root = document.documentElement;
  const isDark = mode === 'dark';

  // Apply dark class
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Primary color — slightly boost lightness in dark mode for visibility
  const primaryL = isDark ? Math.min(config.lightness + 8, 70) : config.lightness;
  
  root.style.setProperty('--primary', `${config.hue} ${config.saturation}% ${primaryL}%`);
  root.style.setProperty('--primary-hover', `${config.hue} ${config.saturation + 5}% ${primaryL - 5}%`);
  root.style.setProperty('--primary-glow', `${config.hue} ${config.saturation + 10}% ${primaryL + 10}%`);
  root.style.setProperty('--ring', `${config.hue} ${config.saturation}% ${primaryL}%`);
  
  // Update gradients
  root.style.setProperty(
    '--gradient-primary', 
    `linear-gradient(145deg, hsl(${config.hue} ${config.saturation}% ${primaryL + 5}%) 0%, hsl(${config.hue + 10} ${config.saturation - 5}% ${primaryL}%) 100%)`
  );
  root.style.setProperty(
    '--gradient-warm', 
    `linear-gradient(145deg, hsl(${config.hue + 5} ${config.saturation + 5}% ${primaryL + 2}%) 0%, hsl(${config.hue - 5} ${config.saturation}% ${primaryL - 2}%) 100%)`
  );
  root.style.setProperty(
    '--gradient-hero', 
    `linear-gradient(160deg, hsl(${config.hue + 5} ${config.saturation - 5}% ${primaryL + 5}%) 0%, hsl(${config.hue} ${config.saturation}% ${primaryL - 2}%) 50%, hsl(${config.hue - 5} ${config.saturation + 5}% ${primaryL - 8}%) 100%)`
  );
  
  // Shadow with theme color
  const shadowAlpha = isDark ? 0.35 : 0.25;
  const glowAlpha = isDark ? 0.2 : 0.15;
  root.style.setProperty(
    '--shadow-primary', 
    `0 4px 16px hsl(${config.hue} ${config.saturation}% ${primaryL}% / ${shadowAlpha})`
  );
  root.style.setProperty(
    '--shadow-glow', 
    `0 0 24px hsl(${config.hue} ${config.saturation}% ${primaryL}% / ${glowAlpha})`
  );

  // Sidebar primary
  root.style.setProperty('--sidebar-primary', `${config.hue} ${config.saturation}% ${primaryL}%`);
  root.style.setProperty('--sidebar-ring', `${config.hue} ${config.saturation}% ${primaryL}%`);
}

export function useThemeColor() {
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COLOR_STORAGE_KEY);
      if (saved && saved in THEME_COLORS) return saved as ThemeColor;
    }
    return 'pink';
  });

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    applyThemeColor(themeColor, themeMode);
  }, [themeColor, themeMode]);

  const setThemeColor = useCallback((color: ThemeColor) => {
    setThemeColorState(color);
    localStorage.setItem(COLOR_STORAGE_KEY, color);
    applyThemeColor(color, themeMode);
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    applyThemeColor(themeColor, mode);
  }, [themeColor]);

  const toggleDarkMode = useCallback(() => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
  }, [themeMode, setThemeMode]);

  return {
    themeColor,
    setThemeColor,
    themeColors: THEME_COLORS,
    themeMode,
    setThemeMode,
    toggleDarkMode,
    isDark: themeMode === 'dark',
  };
}

// Initialize theme on app load
export function initializeThemeColor() {
  if (typeof window !== 'undefined') {
    const savedColor = localStorage.getItem(COLOR_STORAGE_KEY);
    const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
    
    const color: ThemeColor = (savedColor && savedColor in THEME_COLORS) 
      ? savedColor as ThemeColor 
      : 'pink';
    const mode: ThemeMode = (savedMode === 'dark') ? 'dark' : 'light';
    
    if (!savedColor) localStorage.setItem(COLOR_STORAGE_KEY, 'pink');
    if (!savedMode) localStorage.setItem(MODE_STORAGE_KEY, 'light');
    
    applyThemeColor(color, mode);
  }
}
