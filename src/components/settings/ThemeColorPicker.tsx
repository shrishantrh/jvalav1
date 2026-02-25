import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useThemeColor, THEME_COLORS, ThemeColor, ThemeMode } from "@/hooks/useThemeColor";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Palette, Check, Sun, Moon, Smartphone } from "lucide-react";

export const ThemeColorPicker = () => {
  const { themeColor, setThemeColor, themeMode, setThemeMode, isDark } = useThemeColor();

  const handleColorChange = (color: ThemeColor) => {
    haptics.selection();
    setThemeColor(color);
  };

  const modes: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'auto', icon: Smartphone, label: 'Auto' },
  ];

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          Appearance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        {/* Mode selector — 3-way segmented control */}
        <div className="flex rounded-xl bg-muted/60 p-0.5 gap-0.5">
          {modes.map(({ value, icon: Icon, label }) => {
            const isActive = themeMode === value;
            return (
              <button
                key={value}
                onClick={() => {
                  haptics.selection();
                  setThemeMode(value);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-xs font-medium transition-all duration-300",
                  "active:scale-95 touch-manipulation",
                  isActive
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground/70"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Accent color grid */}
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(THEME_COLORS) as [ThemeColor, typeof THEME_COLORS[ThemeColor]][]).map(([key, config]) => {
            const isSelected = themeColor === key;
            const bgColor = `hsl(${config.hue} ${config.saturation}% ${config.lightness}%)`;
            
            return (
              <button
                key={key}
                onClick={() => handleColorChange(key)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-300",
                  "active:scale-95 touch-manipulation",
                  isSelected 
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                    : "hover:bg-muted/50"
                )}
                style={{
                  boxShadow: isSelected ? `0 4px 20px ${bgColor}40` : undefined,
                }}
              >
                <div 
                  className={cn(
                    "relative w-10 h-10 rounded-full transition-all duration-300 shadow-lg",
                    isSelected && "scale-110"
                  )}
                  style={{
                    background: `linear-gradient(135deg, 
                      hsl(${config.hue} ${config.saturation}% ${config.lightness + 15}%) 0%, 
                      hsl(${config.hue} ${config.saturation}% ${config.lightness}%) 50%,
                      hsl(${config.hue} ${config.saturation}% ${config.lightness - 10}%) 100%)`,
                    boxShadow: `
                      inset 0 2px 4px hsl(${config.hue} ${config.saturation}% ${config.lightness + 30}% / 0.4),
                      inset 0 -2px 4px hsl(${config.hue} ${config.saturation}% ${config.lightness - 20}% / 0.3),
                      0 4px 12px hsl(${config.hue} ${config.saturation}% ${config.lightness}% / 0.35)`,
                  }}
                >
                  <div 
                    className="absolute inset-0.5 rounded-full"
                    style={{
                      background: `linear-gradient(145deg, 
                        hsl(${config.hue} ${config.saturation}% ${config.lightness + 25}% / 0.3) 0%, 
                        transparent 50%)`,
                    }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white drop-shadow-md" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )}>
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
