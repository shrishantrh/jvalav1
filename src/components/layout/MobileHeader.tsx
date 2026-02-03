import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import jvalaLogo from "@/assets/jvala-logo.png";
import { StreakBadge } from "@/components/engagement/StreakBadge";

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
  
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2.5">
        {showLogo && (
          <img src={jvalaLogo} alt="Jvala" className="w-8 h-8 rounded-xl" />
        )}
        <div>
          <h1 className="text-base font-semibold text-foreground tracking-tight">
            {title}
          </h1>
          <p className="text-[10px] text-muted-foreground font-medium">
            {subtitle || format(new Date(), 'EEEE, MMM d')}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        {streak > 0 && (
          <StreakBadge 
            streak={streak} 
            onClick={onStreakClick}
          />
        )}
        
        {rightAction}
        
        {showSettings && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
            className="h-9 w-9 rounded-xl hover:bg-white/10"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
};
