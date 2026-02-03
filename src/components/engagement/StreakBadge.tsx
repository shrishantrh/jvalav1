import { Flame } from "lucide-react";
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

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all duration-300",
        "active:scale-95 touch-manipulation",
        streak >= 7 
          ? "bg-gradient-primary text-white" 
          : "bg-primary/15 text-primary border border-primary/25"
      )}
    >
      <Flame className="w-4 h-4" />
      <span>{streak}</span>
    </button>
  );
};