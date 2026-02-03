import { FlareSeverity } from "@/types/flare";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface SeveritySelectorProps {
  selectedSeverity: FlareSeverity | null;
  onSeveritySelect: (severity: FlareSeverity) => void;
  question?: string;
  compact?: boolean;
}

export const SeveritySelector = ({ 
  selectedSeverity, 
  onSeveritySelect,
  question,
  compact = false
}: SeveritySelectorProps) => {
  const handleSelect = (severity: FlareSeverity) => {
    haptics.medium();
    onSeveritySelect(severity);
  };

  const severityOptions = [
    {
      value: 'none' as const,
      label: 'Great',
      emoji: '😊',
      hue: 145,
      saturation: 60,
      lightness: 50,
    },
    {
      value: 'mild' as const,
      label: 'Mild',
      emoji: '😐',
      hue: 50,
      saturation: 85,
      lightness: 52,
    },
    {
      value: 'moderate' as const,
      label: 'Moderate',
      emoji: '😟',
      hue: 28,
      saturation: 90,
      lightness: 50,
    },
    {
      value: 'severe' as const,
      label: 'Severe',
      emoji: '😣',
      hue: 0,
      saturation: 75,
      lightness: 52,
    },
  ];

  return (
    <div className="space-y-3">
      {question && (
        <p className="text-center text-base font-medium text-foreground/90">{question}</p>
      )}
      <div className={cn("grid gap-2.5", compact ? "grid-cols-4" : "grid-cols-2 gap-3")}>
        {severityOptions.map((option) => {
          const isSelected = selectedSeverity === option.value;
          const { hue, saturation, lightness } = option;
          
          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-2xl overflow-hidden",
                "transition-all duration-300 touch-manipulation",
                "active:scale-95",
                compact ? "py-3 px-2" : "py-4 px-3"
              )}
              style={{
                // 3D frosted glass background
                background: `linear-gradient(145deg, 
                  hsl(${hue} ${saturation}% ${lightness + 40}% / 0.9) 0%, 
                  hsl(${hue} ${saturation - 10}% ${lightness + 35}% / 0.85) 100%
                )`,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: isSelected 
                  ? `2.5px solid hsl(${hue} ${saturation}% ${lightness}%)`
                  : `1px solid hsl(${hue} ${saturation}% ${lightness + 20}% / 0.5)`,
                boxShadow: isSelected
                  ? `
                      inset 0 1px 2px hsl(0 0% 100% / 0.4),
                      0 4px 16px hsl(${hue} ${saturation}% ${lightness}% / 0.3),
                      0 8px 24px hsl(${hue} ${saturation}% ${lightness}% / 0.15)
                    `
                  : `
                      inset 0 1px 2px hsl(0 0% 100% / 0.3),
                      0 2px 8px hsl(${hue} ${saturation}% ${lightness}% / 0.1)
                    `,
                transform: isSelected ? 'scale(1.05)' : undefined,
              }}
            >
              {/* Glass highlight overlay */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(180deg, 
                    hsl(0 0% 100% / 0.25) 0%, 
                    transparent 50%
                  )`,
                  borderRadius: 'inherit',
                }}
              />
              
              {/* Emoji */}
              <span className={cn(
                "relative text-2xl transition-transform duration-300",
                compact ? "text-xl" : "text-3xl mb-1",
                isSelected && "scale-110"
              )}>
                {option.emoji}
              </span>
              
              {/* Label */}
              <span 
                className={cn(
                  "relative font-bold transition-colors",
                  compact ? "text-xs" : "text-sm"
                )}
                style={{ 
                  color: `hsl(${hue} ${saturation}% ${isSelected ? lightness - 10 : lightness}%)` 
                }}
              >
                {option.label}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <div 
                  className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(145deg, 
                      hsl(${hue} ${saturation}% ${lightness + 5}%) 0%, 
                      hsl(${hue} ${saturation}% ${lightness - 5}%) 100%
                    )`,
                    boxShadow: `inset 0 1px 2px hsl(0 0% 100% / 0.3)`,
                  }}
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
