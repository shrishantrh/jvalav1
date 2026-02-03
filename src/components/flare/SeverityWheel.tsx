import { useState, useEffect } from "react";
import { FlareSeverity } from "@/types/flare";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface SeverityWheelProps {
  selectedSeverity: FlareSeverity | null;
  onSeveritySelect: (severity: FlareSeverity) => void;
}

const severityOptions = [
  {
    value: 'severe' as const,
    label: 'Worst',
    emoji: '😣',
    angle: -60, // leftmost
    color: { h: 0, s: 72, l: 55 },
  },
  {
    value: 'moderate' as const,
    label: 'Poor',
    emoji: '😟',
    angle: -30,
    color: { h: 28, s: 85, l: 52 },
  },
  {
    value: 'mild' as const,
    label: 'Fair',
    emoji: '😐',
    angle: 0, // center
    color: { h: 50, s: 80, l: 55 },
  },
  {
    value: 'none' as const,
    label: 'Good',
    emoji: '🙂',
    angle: 30,
    color: { h: 80, s: 55, l: 50 },
  },
  {
    value: 'great' as const,
    label: 'Excellent',
    emoji: '😊',
    angle: 60, // rightmost
    color: { h: 145, s: 60, l: 45 },
  },
];

export const SeverityWheel = ({ selectedSeverity, onSeveritySelect }: SeverityWheelProps) => {
  const [activeIndex, setActiveIndex] = useState(2); // Start at center (Fair)
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (selectedSeverity) {
      const idx = severityOptions.findIndex(o => o.value === selectedSeverity);
      if (idx !== -1) setActiveIndex(idx);
    }
  }, [selectedSeverity]);

  const handleSelect = (index: number) => {
    haptics.medium();
    setActiveIndex(index);
    const option = severityOptions[index];
    // Map 'great' to 'none' for the actual entry (since we only have 4 severity levels)
    const mappedValue = option.value === 'great' ? 'none' : option.value;
    onSeveritySelect(mappedValue as FlareSeverity);
  };

  const activeOption = severityOptions[activeIndex];
  const { h, s, l } = activeOption.color;

  return (
    <div className="flex flex-col items-center py-4">
      {/* Title */}
      <h2 className="text-xl font-bold text-foreground mb-1">
        How would you describe your mood?
      </h2>
      
      {/* Current label */}
      <p className="text-base text-muted-foreground mb-6">
        I Feel <span className="font-semibold text-foreground">{activeOption.label}</span>
      </p>

      {/* Large emoji with glow effect */}
      <div 
        className="relative mb-8 transition-all duration-500"
        style={{
          filter: `drop-shadow(0 8px 24px hsl(${h} ${s}% ${l}% / 0.4))`,
        }}
      >
        <span 
          className="text-[120px] leading-none block animate-float"
          style={{
            textShadow: `0 4px 24px hsl(${h} ${s}% ${l}% / 0.3)`,
          }}
        >
          {activeOption.emoji}
        </span>
        
        {/* Subtle reflection */}
        <span 
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[80px] opacity-15 scale-y-[-0.3] blur-[2px]"
        >
          {activeOption.emoji}
        </span>
      </div>

      {/* Arc selector */}
      <div className="relative w-full h-32 overflow-hidden">
        {/* Arc background */}
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full"
          style={{
            background: `conic-gradient(
              from 210deg,
              hsl(0 72% 55%) 0deg,
              hsl(28 85% 52%) 36deg,
              hsl(50 80% 55%) 72deg,
              hsl(80 55% 50%) 108deg,
              hsl(145 60% 45%) 144deg,
              hsl(145 60% 45%) 150deg
            )`,
            clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
          }}
        />
        
        {/* Glass overlay */}
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full"
          style={{
            background: 'linear-gradient(180deg, hsl(var(--background) / 0.3) 50%, transparent 100%)',
            clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
          }}
        />

        {/* Emoji buttons on arc */}
        {severityOptions.map((option, idx) => {
          const isActive = activeIndex === idx;
          const angleRad = (option.angle - 90) * (Math.PI / 180);
          const radius = 140;
          const x = Math.cos(angleRad) * radius;
          const y = Math.sin(angleRad) * radius + 20;
          
          return (
            <button
              key={option.value}
              onClick={() => handleSelect(idx)}
              className={cn(
                "absolute left-1/2 bottom-0 -translate-x-1/2",
                "w-14 h-14 rounded-full flex items-center justify-center",
                "transition-all duration-300 touch-manipulation",
                isActive && "scale-125 z-10",
                !isActive && "opacity-70 hover:opacity-100"
              )}
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                background: isActive 
                  ? `linear-gradient(145deg, hsl(${option.color.h} ${option.color.s}% ${option.color.l + 15}%), hsl(${option.color.h} ${option.color.s}% ${option.color.l}%))`
                  : 'transparent',
                boxShadow: isActive 
                  ? `0 4px 20px hsl(${option.color.h} ${option.color.s}% ${option.color.l}% / 0.5), inset 0 2px 4px hsl(0 0% 100% / 0.3)`
                  : 'none',
              }}
            >
              <span className={cn(
                "text-2xl transition-transform duration-300",
                isActive && "scale-110"
              )}>
                {option.emoji}
              </span>
            </button>
          );
        })}

        {/* Pointer/indicator at top center */}
        <div 
          className="absolute bottom-[90px] left-1/2 -translate-x-1/2 w-3 h-8 rounded-full z-20"
          style={{
            background: `linear-gradient(180deg, hsl(${h} ${s}% ${l}%) 0%, hsl(${h} ${s}% ${l - 10}%) 100%)`,
            boxShadow: `0 4px 12px hsl(${h} ${s}% ${l}% / 0.4)`,
          }}
        />
        
        {/* Center circle decoration */}
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-8 rounded-t-full"
          style={{
            background: `linear-gradient(180deg, hsl(${h} ${s}% ${l + 20}% / 0.3) 0%, hsl(${h} ${s}% ${l}% / 0.1) 100%)`,
          }}
        />
      </div>

      {/* Labels under arc */}
      <div className="flex justify-between w-full px-4 mt-3">
        {severityOptions.map((option, idx) => (
          <button
            key={option.value}
            onClick={() => handleSelect(idx)}
            className={cn(
              "flex flex-col items-center gap-0.5 transition-all duration-200 touch-manipulation",
              activeIndex === idx ? "opacity-100" : "opacity-50"
            )}
          >
            <span className="text-[11px] font-medium text-muted-foreground">
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
