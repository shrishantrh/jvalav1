import { useState, useEffect, useRef } from "react";
import { FlareSeverity } from "@/types/flare";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface SeverityWheelProps {
  selectedSeverity: FlareSeverity | null;
  onSeveritySelect: (severity: FlareSeverity) => void;
  question?: string;
}

const severityOptions = [
  {
    value: 'severe' as const,
    label: 'Worst',
    emoji: '😫',
    color: { h: 270, s: 70, l: 50 }, // Purple
  },
  {
    value: 'moderate' as const,
    label: 'Poor',
    emoji: '😟',
    color: { h: 0, s: 65, l: 55 }, // Red/coral
  },
  {
    value: 'mild' as const,
    label: 'Fair',
    emoji: '😐',
    color: { h: 35, s: 75, l: 55 }, // Amber/tan
  },
  {
    value: 'none' as const,
    label: 'Good',
    emoji: '🙂',
    color: { h: 50, s: 70, l: 55 }, // Yellow
  },
  {
    value: 'great' as const,
    label: 'Excellent',
    emoji: '😊',
    color: { h: 145, s: 50, l: 45 }, // Green
  },
];

export const SeverityWheel = ({ 
  selectedSeverity, 
  onSeveritySelect,
  question = "How would you describe your mood?"
}: SeverityWheelProps) => {
  const [activeIndex, setActiveIndex] = useState(2); // Start at center (Fair/Neutral)
  const wheelRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col items-center py-6 px-4">
      {/* Question */}
      <h2 className="text-2xl font-bold text-foreground text-center mb-2 leading-tight">
        {question}
      </h2>
      
      {/* Current label with feeling */}
      <p className="text-lg text-muted-foreground mb-8">
        I Feel <span 
          className="font-semibold transition-colors duration-300"
          style={{ color: `hsl(${h} ${s}% ${l}%)` }}
        >
          {activeOption.label}
        </span>.
      </p>

      {/* Large centered emoji with glow and smooth animation */}
      <div 
        className="relative mb-10 transition-all duration-500 ease-out"
        style={{
          filter: `drop-shadow(0 12px 40px hsl(${h} ${s}% ${l}% / 0.5))`,
        }}
      >
        {/* Background glow circle */}
        <div 
          className="absolute inset-0 rounded-full blur-2xl transition-all duration-500"
          style={{
            background: `radial-gradient(circle, hsl(${h} ${s}% ${l}% / 0.3) 0%, transparent 70%)`,
            transform: 'scale(1.5)',
          }}
        />
        
        {/* Main emoji - large yellow circle like reference */}
        <div 
          className="relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 animate-float"
          style={{
            background: `radial-gradient(circle at 30% 30%, hsl(${h} ${s}% ${l + 15}%), hsl(${h} ${s}% ${l}%))`,
            boxShadow: `
              inset 0 -8px 16px hsl(${h} ${s}% ${l - 15}% / 0.4),
              inset 0 4px 8px hsl(0 0% 100% / 0.3),
              0 8px 32px hsl(${h} ${s}% ${l}% / 0.4)
            `,
          }}
        >
          <span className="text-6xl select-none">{activeOption.emoji}</span>
        </div>
      </div>

      {/* Faded peek emoji below */}
      <div className="mb-6 opacity-30">
        <span className="text-4xl">
          {activeIndex < severityOptions.length - 1 
            ? severityOptions[activeIndex + 1].emoji 
            : severityOptions[0].emoji}
        </span>
      </div>

      {/* Arc/Wheel selector - semi-circle at bottom */}
      <div 
        ref={wheelRef}
        className="relative w-full h-36 overflow-hidden"
      >
        {/* Arc background with color gradient segments */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <svg width="340" height="170" viewBox="0 0 340 170" className="overflow-visible">
            <defs>
              {/* Gradient for each segment */}
              {severityOptions.map((opt, i) => (
                <linearGradient 
                  key={`grad-${i}`}
                  id={`segment-grad-${i}`}
                  x1="0%" y1="0%" x2="100%" y2="100%"
                >
                  <stop offset="0%" stopColor={`hsl(${opt.color.h} ${opt.color.s}% ${opt.color.l + 10}%)`} />
                  <stop offset="100%" stopColor={`hsl(${opt.color.h} ${opt.color.s}% ${opt.color.l - 5}%)`} />
                </linearGradient>
              ))}
            </defs>
            
            {/* Arc segments */}
            {severityOptions.map((opt, i) => {
              const segmentAngle = 180 / severityOptions.length;
              const startAngle = 180 + (i * segmentAngle);
              const endAngle = startAngle + segmentAngle;
              const isActive = i === activeIndex;
              
              const radius = 160;
              const innerRadius = 80;
              
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              
              const x1 = 170 + radius * Math.cos(startRad);
              const y1 = 170 + radius * Math.sin(startRad);
              const x2 = 170 + radius * Math.cos(endRad);
              const y2 = 170 + radius * Math.sin(endRad);
              const x3 = 170 + innerRadius * Math.cos(endRad);
              const y3 = 170 + innerRadius * Math.sin(endRad);
              const x4 = 170 + innerRadius * Math.cos(startRad);
              const y4 = 170 + innerRadius * Math.sin(startRad);
              
              const pathD = `
                M ${x1} ${y1}
                A ${radius} ${radius} 0 0 1 ${x2} ${y2}
                L ${x3} ${y3}
                A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4}
                Z
              `;
              
              return (
                <path
                  key={opt.value}
                  d={pathD}
                  fill={`url(#segment-grad-${i})`}
                  className={cn(
                    "cursor-pointer transition-all duration-300",
                    isActive ? "opacity-100" : "opacity-70 hover:opacity-90"
                  )}
                  onClick={() => handleSelect(i)}
                  style={{
                    filter: isActive ? 'brightness(1.1)' : 'none',
                  }}
                />
              );
            })}
            
            {/* Emoji faces on each segment */}
            {severityOptions.map((opt, i) => {
              const segmentAngle = 180 / severityOptions.length;
              const midAngle = 180 + (i * segmentAngle) + (segmentAngle / 2);
              const midRad = (midAngle * Math.PI) / 180;
              const emojiRadius = 120;
              const isActive = i === activeIndex;
              
              const x = 170 + emojiRadius * Math.cos(midRad);
              const y = 170 + emojiRadius * Math.sin(midRad);
              
              return (
                <g 
                  key={`emoji-${i}`}
                  className="cursor-pointer"
                  onClick={() => handleSelect(i)}
                >
                  {/* Background circle for emoji */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 24 : 20}
                    fill={isActive ? `hsl(${opt.color.h} ${opt.color.s}% ${opt.color.l}%)` : 'transparent'}
                    className="transition-all duration-300"
                    style={{
                      filter: isActive ? `drop-shadow(0 4px 12px hsl(${opt.color.h} ${opt.color.s}% ${opt.color.l}% / 0.5))` : 'none',
                    }}
                  />
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={isActive ? 28 : 22}
                    className={cn(
                      "transition-all duration-300 select-none pointer-events-none",
                      isActive ? "opacity-100" : "opacity-60"
                    )}
                  >
                    {opt.emoji}
                  </text>
                </g>
              );
            })}
            
            {/* Center indicator/pointer */}
            <circle
              cx="170"
              cy="170"
              r="8"
              fill={`hsl(${h} ${s}% ${l}%)`}
              className="transition-all duration-300"
              style={{
                filter: `drop-shadow(0 2px 8px hsl(${h} ${s}% ${l}% / 0.6))`,
              }}
            />
            
            {/* Pointer triangle */}
            <polygon
              points="170,95 164,110 176,110"
              fill={`hsl(${h} ${s}% ${l}%)`}
              className="transition-all duration-500"
              style={{
                filter: `drop-shadow(0 2px 8px hsl(${h} ${s}% ${l}% / 0.5))`,
                transformOrigin: '170px 170px',
                transform: `rotate(${(activeIndex - 2) * (180 / severityOptions.length)}deg)`,
              }}
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
