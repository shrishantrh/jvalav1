import { useState, useRef } from "react";
import { FlareSeverity } from "@/types/flare";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface SeverityWheelProps {
  selectedSeverity: FlareSeverity | null;
  onSeveritySelect: (severity: FlareSeverity) => void;
  question?: string;
}

const SEVERITY_OPTIONS = [
  {
    value: 'none' as const,
    label: 'Great',
    gradient: 'from-emerald-200 via-emerald-100 to-teal-50',
    glowColor: 'rgba(52, 211, 153, 0.4)',
    faceColor: '#059669',
  },
  {
    value: 'mild' as const,
    label: 'Mild',
    gradient: 'from-amber-200 via-yellow-100 to-orange-50',
    glowColor: 'rgba(251, 191, 36, 0.4)',
    faceColor: '#d97706',
  },
  {
    value: 'moderate' as const,
    label: 'Moderate',
    gradient: 'from-orange-300 via-orange-200 to-amber-100',
    glowColor: 'rgba(251, 146, 60, 0.4)',
    faceColor: '#ea580c',
  },
  {
    value: 'severe' as const,
    label: 'Severe',
    gradient: 'from-rose-300 via-pink-200 to-red-100',
    glowColor: 'rgba(244, 63, 94, 0.4)',
    faceColor: '#dc2626',
  },
];

// 3D Orb Face Component - inspired by the reference images
const OrbFace = ({ 
  option, 
  isSelected, 
  onClick 
}: { 
  option: typeof SEVERITY_OPTIONS[0];
  isSelected: boolean;
  onClick: () => void;
}) => {
  const renderFace = () => {
    switch (option.value) {
      case 'none':
        return (
          <>
            {/* Happy eyes - curved lines */}
            <path 
              d="M18 20 Q21 17 24 20" 
              stroke={option.faceColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none"
            />
            <path 
              d="M36 20 Q39 17 42 20" 
              stroke={option.faceColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none"
            />
            {/* Big smile */}
            <path 
              d="M20 35 Q30 45 40 35" 
              stroke={option.faceColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none"
            />
          </>
        );
      case 'mild':
        return (
          <>
            {/* Neutral eyes */}
            <circle cx="21" cy="22" r="3" fill={option.faceColor} />
            <circle cx="39" cy="22" r="3" fill={option.faceColor} />
            {/* Straight mouth */}
            <path 
              d="M22 38 L38 38" 
              stroke={option.faceColor} 
              strokeWidth="2.5" 
              strokeLinecap="round"
            />
          </>
        );
      case 'moderate':
        return (
          <>
            {/* Worried eyes */}
            <circle cx="21" cy="22" r="3" fill={option.faceColor} />
            <circle cx="39" cy="22" r="3" fill={option.faceColor} />
            {/* Worried eyebrows */}
            <path 
              d="M16 16 Q21 14 26 16" 
              stroke={option.faceColor} 
              strokeWidth="2" 
              strokeLinecap="round" 
              fill="none"
            />
            <path 
              d="M34 16 Q39 14 44 16" 
              stroke={option.faceColor} 
              strokeWidth="2" 
              strokeLinecap="round" 
              fill="none"
            />
            {/* Frown */}
            <path 
              d="M22 40 Q30 34 38 40" 
              stroke={option.faceColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none"
            />
          </>
        );
      case 'severe':
        return (
          <>
            {/* Very sad droopy eyes */}
            <ellipse cx="21" cy="23" rx="3.5" ry="4" fill={option.faceColor} />
            <ellipse cx="39" cy="23" rx="3.5" ry="4" fill={option.faceColor} />
            {/* Sad eyebrows - angled up in the middle */}
            <path 
              d="M15 14 Q21 18 27 15" 
              stroke={option.faceColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none"
            />
            <path 
              d="M33 15 Q39 18 45 14" 
              stroke={option.faceColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none"
            />
            {/* Deep frown - very curved */}
            <path 
              d="M20 42 Q30 32 40 42" 
              stroke={option.faceColor} 
              strokeWidth="3" 
              strokeLinecap="round" 
              fill="none"
            />
          </>
        );
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1.5 transition-all duration-300",
        "touch-manipulation active:scale-95",
        isSelected && "scale-110"
      )}
    >
      {/* 3D Orb container */}
      <div
        className={cn(
          "relative w-16 h-16 rounded-full overflow-hidden",
          "transition-all duration-300"
        )}
        style={{
          boxShadow: isSelected
            ? `0 8px 24px ${option.glowColor}, 0 0 40px ${option.glowColor}, inset 0 -8px 20px rgba(0,0,0,0.1)`
            : `0 4px 12px rgba(0,0,0,0.1), inset 0 -6px 16px rgba(0,0,0,0.08)`,
          transform: isSelected ? 'translateY(-2px)' : undefined,
        }}
      >
        {/* Gradient background */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br",
          option.gradient
        )} />
        
        {/* Top highlight for 3D effect */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 30%, transparent 60%)',
          }}
        />
        
        {/* Inner shadow for depth */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.5), inset 0 -4px 12px rgba(0,0,0,0.1)',
          }}
        />
        
        {/* Face SVG */}
        <svg 
          viewBox="0 0 60 60" 
          className="absolute inset-0 w-full h-full"
        >
          {renderFace()}
        </svg>
      </div>
      
      {/* Label */}
      <span 
        className={cn(
          "text-sm font-semibold transition-all",
          isSelected ? "opacity-100" : "opacity-70"
        )}
        style={{ color: option.faceColor }}
      >
        {option.label}
      </span>
      
      {/* Selected indicator */}
      {isSelected && (
        <div 
          className="absolute -bottom-1 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: option.faceColor }}
        />
      )}
    </button>
  );
};

export const SeverityWheel = ({ 
  selectedSeverity, 
  onSeveritySelect,
  question
}: SeverityWheelProps) => {
  const handleSelect = (severity: FlareSeverity) => {
    haptics.medium();
    onSeveritySelect(severity);
  };

  return (
    <div className="w-full space-y-4">
      {question && (
        <p className="text-center text-base font-medium text-foreground/90 mb-4">
          {question}
        </p>
      )}
      
      {/* Horizontal orb layout - fits mobile */}
      <div className="flex items-center justify-around px-2">
        {SEVERITY_OPTIONS.map((option) => (
          <OrbFace
            key={option.value}
            option={option}
            isSelected={selectedSeverity === option.value}
            onClick={() => handleSelect(option.value)}
          />
        ))}
      </div>
    </div>
  );
};
