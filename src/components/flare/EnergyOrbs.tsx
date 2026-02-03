import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface EnergyOrbsProps {
  onSelect: (level: 'low' | 'moderate' | 'high') => void;
}

const ENERGY_OPTIONS = [
  {
    value: 'low' as const,
    label: 'Low',
    gradient: 'from-slate-300 via-gray-200 to-slate-100',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    faceColor: '#64748b',
  },
  {
    value: 'moderate' as const,
    label: 'Fair',
    gradient: 'from-amber-200 via-yellow-100 to-orange-50',
    glowColor: 'rgba(251, 191, 36, 0.4)',
    faceColor: '#d97706',
  },
  {
    value: 'high' as const,
    label: 'Good',
    gradient: 'from-emerald-200 via-teal-100 to-green-50',
    glowColor: 'rgba(52, 211, 153, 0.4)',
    faceColor: '#059669',
  },
];

const EnergyOrb = ({ 
  option, 
  onClick 
}: { 
  option: typeof ENERGY_OPTIONS[0];
  onClick: () => void;
}) => {
  const renderFace = () => {
    switch (option.value) {
      case 'low':
        return (
          <>
            {/* Tired droopy eyes */}
            <path d="M16 22 Q21 24 26 22" stroke={option.faceColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M34 22 Q39 24 44 22" stroke={option.faceColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            {/* Slight frown */}
            <path d="M24 38 Q30 35 36 38" stroke={option.faceColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </>
        );
      case 'moderate':
        return (
          <>
            {/* Neutral eyes */}
            <circle cx="21" cy="22" r="3" fill={option.faceColor} />
            <circle cx="39" cy="22" r="3" fill={option.faceColor} />
            {/* Straight mouth */}
            <path d="M24 38 L36 38" stroke={option.faceColor} strokeWidth="2.5" strokeLinecap="round" />
          </>
        );
      case 'high':
        return (
          <>
            {/* Bright happy eyes */}
            <circle cx="21" cy="22" r="3.5" fill={option.faceColor} />
            <circle cx="39" cy="22" r="3.5" fill={option.faceColor} />
            {/* Eye sparkles */}
            <circle cx="22.5" cy="20.5" r="1" fill="white" />
            <circle cx="40.5" cy="20.5" r="1" fill="white" />
            {/* Big smile */}
            <path d="M20 35 Q30 45 40 35" stroke={option.faceColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </>
        );
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2 transition-all duration-300",
        "touch-manipulation active:scale-95 hover:scale-105"
      )}
    >
      {/* 3D Orb container */}
      <div
        className="relative w-20 h-20 rounded-full overflow-hidden"
        style={{
          boxShadow: `0 6px 20px ${option.glowColor}, inset 0 -8px 20px rgba(0,0,0,0.1)`,
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
        
        {/* Inner glow */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.5), inset 0 -4px 12px rgba(0,0,0,0.1)',
          }}
        />
        
        {/* Face SVG */}
        <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full">
          {renderFace()}
        </svg>
      </div>
      
      {/* Label */}
      <span 
        className="text-sm font-semibold"
        style={{ color: option.faceColor }}
      >
        {option.label}
      </span>
    </button>
  );
};

export const EnergyOrbs = ({ onSelect }: EnergyOrbsProps) => {
  const handleSelect = (level: 'low' | 'moderate' | 'high') => {
    haptics.success();
    onSelect(level);
  };

  return (
    <div className="flex items-center justify-around py-2">
      {ENERGY_OPTIONS.map((option) => (
        <EnergyOrb
          key={option.value}
          option={option}
          onClick={() => handleSelect(option.value)}
        />
      ))}
    </div>
  );
};
