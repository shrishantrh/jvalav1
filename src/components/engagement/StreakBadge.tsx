import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  streak: number;
  onClick?: () => void;
}

export const StreakBadge = ({ streak, onClick }: StreakBadgeProps) => {
  if (streak === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300",
        "hover:scale-105 active:scale-95 border backdrop-blur-sm",
        streak >= 7 
          ? "bg-gradient-primary text-white border-transparent" 
          : "bg-severity-moderate/15 text-severity-moderate border-severity-moderate/25"
      )}
    >
      <Flame className="w-3.5 h-3.5" />
      <span>{streak}</span>
    </button>
  );
};