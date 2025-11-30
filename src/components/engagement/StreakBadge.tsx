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
        "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all",
        "hover:scale-105 active:scale-95",
        streak >= 7 
          ? "bg-gradient-primary text-white shadow-soft" 
          : "bg-severity-moderate/20 text-severity-moderate"
      )}
    >
      <Flame className="w-3 h-3" />
      <span>{streak}</span>
    </button>
  );
};