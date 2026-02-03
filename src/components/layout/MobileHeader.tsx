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
    <div className="flex items-center justify-between px-5 py-4">
      {/* Left: Logo + Brand */}
      <div className="flex items-center gap-3">
        {showLogo && (
          <div className="relative">
            <img 
              src={jvalaLogo} 
              alt="Jvala" 
              className="w-10 h-10 rounded-2xl shadow-md"
            />
            {/* Subtle glow behind logo */}
            <div className="absolute inset-0 -z-10 blur-xl opacity-25 bg-primary rounded-2xl scale-150" />
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
        {/* Streak pill */}
        {onStreakClick && (
          <button
            onClick={handleStreakClick}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-2xl transition-all duration-300",
              "bg-gradient-to-br from-primary/12 to-primary/6 border border-primary/20",
              "hover:from-primary/18 hover:to-primary/10 hover:border-primary/30",
              "active:scale-95 touch-manipulation shadow-sm"
            )}
          >
            <div className="relative">
              <Flame className="w-4.5 h-4.5 text-primary" strokeWidth={2.5} />
              {streak > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              )}
            </div>
            <span className="text-sm font-bold text-primary tabular-nums">
              {streak}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-primary/50" />
          </button>
        )}
        
        {rightAction}
        
        {showSettings && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSettingsClick}
            className="h-10 w-10 rounded-2xl hover:bg-muted/50 active:scale-95 transition-all"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
};
