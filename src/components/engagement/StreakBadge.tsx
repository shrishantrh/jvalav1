import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface StreakBadgeProps {
  streak: number;
  onClick?: () => void;
}

export const StreakBadge = ({ streak, onClick }: StreakBadgeProps) => {
  if (streak === 0) return null;

  const handleClick = () => {
    haptics.light();
    onClick?.();
  };

  // Weekly progress: dots for each day of the week
  const dayOfWeek = new Date().getDay(); // 0=Sun
  const weekProgress = Math.min(streak, 7);

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-bold transition-all duration-300",
        "active:scale-95 touch-manipulation relative overflow-hidden",
        streak >= 7 
          ? "text-white" 
          : "bg-primary/10 text-primary border border-primary/20"
      )}
      style={streak >= 7 ? {
        background: 'var(--gradient-primary)',
        boxShadow: '0 4px 16px hsl(var(--primary) / 0.35)',
      } : undefined}
    >
      {/* Animated glow for 7+ streaks */}
      {streak >= 7 && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 animate-[shimmer_2s_ease-in-out_infinite]" 
          style={{ animationName: 'shimmer' }}
        />
      )}
      
      <div className="relative flex items-center gap-1.5">
        {/* Flame with pulse animation */}
        <span className={cn(
          "text-base",
          streak >= 7 && "animate-pulse"
        )}>
          🔥
        </span>
        
        <span className="relative">{streak}</span>
      </div>

      {/* Week progress dots */}
      <div className="flex gap-0.5">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div 
            key={i} 
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all",
              i < weekProgress 
                ? streak >= 7 ? "bg-white" : "bg-primary" 
                : streak >= 7 ? "bg-white/30" : "bg-primary/20"
            )}
          />
        ))}
      </div>
    </button>
  );
};
