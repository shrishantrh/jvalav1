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
        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
        "hover:scale-102 active:scale-98 border",
        streak >= 7 
          ? "bg-gradient-primary text-white border-transparent shadow-sm" 
          : "bg-severity-moderate/10 text-severity-moderate border-severity-moderate/20"
      )}
    >
      <Flame className="w-3.5 h-3.5" />
      <span>{streak}</span>
    </button>
  );
};