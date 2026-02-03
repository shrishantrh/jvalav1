import { FlareSeverity } from "@/types/flare";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface SeveritySelectorProps {
  selectedSeverity: FlareSeverity | null;
  onSeveritySelect: (severity: FlareSeverity) => void;
}

export const SeveritySelector = ({ selectedSeverity, onSeveritySelect }: SeveritySelectorProps) => {
  const handleSelect = (severity: FlareSeverity) => {
    haptics.medium();
    onSeveritySelect(severity);
  };

  const severityOptions = [
    {
      value: 'none' as const,
      label: 'Great',
      emoji: '😊',
      description: 'Feeling good',
      hue: 145,
      saturation: 60,
      lightness: 50,
    },
    {
      value: 'mild' as const,
      label: 'Mild',
      emoji: '😐',
      description: 'Slight discomfort',
      hue: 50,
      saturation: 85,
      lightness: 52,
    },
    {
      value: 'moderate' as const,
      label: 'Moderate',
      emoji: '😟',
      description: 'Noticeable',
      hue: 28,
      saturation: 90,
      lightness: 50,
    },
    {
      value: 'severe' as const,
      label: 'Severe',
      emoji: '😣',
      description: 'Significant',
      hue: 0,
      saturation: 75,
      lightness: 52,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {severityOptions.map((option) => {
        const isSelected = selectedSeverity === option.value;
        const { hue, saturation, lightness } = option;
        
        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "relative flex flex-col items-center justify-center py-5 px-3 rounded-3xl",
              "transition-all duration-300 touch-manipulation no-select",
              "active:scale-95"
            )}
            style={{
              background: isSelected
                ? `linear-gradient(145deg, 
                    hsl(${hue} ${saturation}% ${lightness + 42}%) 0%, 
                    hsl(${hue} ${saturation - 10}% ${lightness + 38}%) 100%
                  )`
                : `linear-gradient(145deg, 
                    hsl(${hue} ${saturation}% ${lightness + 45}%) 0%, 
                    hsl(${hue} ${saturation - 15}% ${lightness + 42}%) 100%
                  )`,
              border: isSelected 
                ? `2px solid hsl(${hue} ${saturation}% ${lightness}%)`
                : `1px solid hsl(${hue} ${saturation}% ${lightness + 25}%)`,
              boxShadow: isSelected
                ? `
                    inset 0 2px 4px hsl(${hue} ${saturation}% ${lightness + 30}% / 0.5),
                    0 4px 16px hsl(${hue} ${saturation}% ${lightness}% / 0.25),
                    0 8px 24px hsl(${hue} ${saturation}% ${lightness}% / 0.15)
                  `
                : `
                    inset 0 1px 2px hsl(0 0% 100% / 0.5),
                    0 2px 8px hsl(${hue} ${saturation}% ${lightness}% / 0.08)
                  `,
              transform: isSelected ? 'scale(1.03)' : undefined,
            }}
          >
            {/* Glossy overlay */}
            <div 
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{
                background: `linear-gradient(180deg, 
                  hsl(0 0% 100% / ${isSelected ? 0.2 : 0.15}) 0%, 
                  transparent 50%
                )`,
              }}
            />
            
            {/* Emoji with 3D shadow */}
            <span 
              className={cn(
                "relative text-4xl mb-1.5 transition-transform duration-500",
                isSelected && "animate-bounce-soft scale-110"
              )}
              style={{
                filter: isSelected ? 'drop-shadow(0 4px 6px hsl(0 0% 0% / 0.15))' : undefined,
              }}
            >
              {option.emoji}
            </span>
            
            {/* Label */}
            <span 
              className="relative font-bold text-sm mb-0.5 transition-colors"
              style={{ 
                color: `hsl(${hue} ${saturation}% ${isSelected ? lightness - 5 : lightness + 5}%)` 
              }}
            >
              {option.label}
            </span>
            
            {/* Description */}
            <span 
              className="relative text-[10px] font-medium text-center leading-tight"
              style={{ 
                color: `hsl(${hue} ${saturation - 20}% ${lightness + 15}%)` 
              }}
            >
              {option.description}
            </span>

            {/* Selected check indicator */}
            {isSelected && (
              <div 
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(145deg, 
                    hsl(${hue} ${saturation}% ${lightness + 5}%) 0%, 
                    hsl(${hue} ${saturation}% ${lightness - 5}%) 100%
                  )`,
                  boxShadow: `
                    inset 0 1px 2px hsl(0 0% 100% / 0.3),
                    0 2px 6px hsl(${hue} ${saturation}% ${lightness}% / 0.4)
                  `,
                }}
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
