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
      description: 'Feeling good today',
      gradient: 'from-emerald-400/20 to-emerald-500/10',
      borderColor: 'border-emerald-400/30',
      ringColor: 'ring-emerald-400/40',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      bgHover: 'hover:from-emerald-400/25 hover:to-emerald-500/15',
    },
    {
      value: 'mild' as const,
      label: 'Mild',
      emoji: '😐',
      description: 'Slight discomfort',
      gradient: 'from-amber-400/20 to-amber-500/10',
      borderColor: 'border-amber-400/30',
      ringColor: 'ring-amber-400/40',
      textColor: 'text-amber-600 dark:text-amber-400',
      bgHover: 'hover:from-amber-400/25 hover:to-amber-500/15',
    },
    {
      value: 'moderate' as const,
      label: 'Moderate',
      emoji: '😟',
      description: 'Noticeable symptoms',
      gradient: 'from-orange-400/20 to-orange-500/10',
      borderColor: 'border-orange-400/30',
      ringColor: 'ring-orange-400/40',
      textColor: 'text-orange-600 dark:text-orange-400',
      bgHover: 'hover:from-orange-400/25 hover:to-orange-500/15',
    },
    {
      value: 'severe' as const,
      label: 'Severe',
      emoji: '😣',
      description: 'Significant impact',
      gradient: 'from-red-400/20 to-red-500/10',
      borderColor: 'border-red-400/30',
      ringColor: 'ring-red-400/40',
      textColor: 'text-red-600 dark:text-red-400',
      bgHover: 'hover:from-red-400/25 hover:to-red-500/15',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {severityOptions.map((option) => {
        const isSelected = selectedSeverity === option.value;
        
        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "relative flex flex-col items-center justify-center py-6 px-4 rounded-3xl",
              "bg-gradient-to-br transition-all duration-300 touch-manipulation",
              "border-2 backdrop-blur-sm",
              option.gradient,
              option.bgHover,
              isSelected 
                ? `${option.borderColor} ring-2 ring-offset-2 ring-offset-background ${option.ringColor} scale-[1.02] shadow-lg` 
                : "border-transparent hover:border-border/50",
              "active:scale-95"
            )}
          >
            {/* Emoji with subtle bounce on select */}
            <span 
              className={cn(
                "text-4xl mb-2 transition-transform duration-500",
                isSelected && "animate-bounce-soft"
              )}
            >
              {option.emoji}
            </span>
            
            {/* Label */}
            <span className={cn(
              "font-bold text-base mb-0.5 transition-colors",
              isSelected ? option.textColor : "text-foreground"
            )}>
              {option.label}
            </span>
            
            {/* Description */}
            <span className="text-[11px] text-muted-foreground font-medium text-center leading-tight">
              {option.description}
            </span>

            {/* Selected indicator */}
            {isSelected && (
              <div className={cn(
                "absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center",
                "bg-card shadow-md border border-border/50"
              )}>
                <div className={cn("w-2.5 h-2.5 rounded-full", option.textColor.replace('text-', 'bg-'))} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
