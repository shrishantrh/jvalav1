import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Flame, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import jvalaLogo from "@/assets/jvala-logo.png";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  streak?: number;
  onStreakClick?: () => void;
  rightAction?: ReactNode;
  showSettings?: boolean;
}

export const MobileHeader = ({
  title = "Jvala",
  subtitle,
  showLogo = true,
  streak = 0,
  onStreakClick,
  rightAction,
  showSettings = true,
}: MobileHeaderProps) => {
  const navigate = useNavigate();
  
  const handleStreakClick = () => {
    haptics.light();
    onStreakClick?.();
  };

  const handleSettingsClick = () => {
    haptics.selection();
    navigate('/settings');
  };
  
  return (
    <div className="flex items-center justify-between px-5 py-3">
      {/* Left: Logo + Brand */}
      <div className="flex items-center gap-3">
        {showLogo && (
          <div className="relative">
            <img 
              src={jvalaLogo} 
              alt="Jvala" 
              className="w-9 h-9 rounded-xl"
            />
          </div>
        )}
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground font-medium -mt-0.5">
            {subtitle || format(new Date(), 'EEEE, MMM d')}
          </p>
        </div>
      </div>
      
      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Streak pill - Clean design without dot */}
        {onStreakClick && streak > 0 && (
          <button
            onClick={handleStreakClick}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-300",
              "bg-gradient-to-r from-primary/15 to-primary/10 border border-primary/25",
              "active:scale-95 touch-manipulation"
            )}
          >
            <Flame className="w-4 h-4 text-primary" strokeWidth={2.5} />
            <span className="text-sm font-bold text-primary tabular-nums">
              {streak}
            </span>
          </button>
        )}
        
        {rightAction}
        
        {showSettings && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSettingsClick}
            className="h-9 w-9 rounded-xl hover:bg-muted/50 active:scale-95 transition-all"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
};
