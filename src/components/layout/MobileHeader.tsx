import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import jvalaLogo from "@/assets/jvala-logo.png";

interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  streak?: number;
  onStreakClick?: () => void;
  rightAction?: ReactNode;
  showSettings?: boolean;
  userName?: string;
}

export const MobileHeader = ({
  title,
  subtitle,
  showLogo = true,
  streak = 0,
  onStreakClick,
  rightAction,
  showSettings = true,
  userName,
}: MobileHeaderProps) => {
  const navigate = useNavigate();
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const displayTitle = userName ? `${getGreeting()}, ${userName.split(' ')[0]}` : title || getGreeting();
  
  return (
    <div className="flex items-center justify-between px-4 py-4 safe-area-top">
      <div className="flex items-center gap-3">
        {showLogo && (
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm">
            <img src={jvalaLogo} alt="Jvala" className="w-full h-full object-cover" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {displayTitle}
          </h1>
          <p className="text-xs text-muted-foreground">
            {subtitle || format(new Date(), 'EEEE, MMM d')}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {streak > 0 && (
          <button 
            onClick={onStreakClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-accent/10 rounded-full press-effect"
          >
            <span className="text-lg">🔥</span>
            <span className="text-sm font-bold text-yellow-accent">{streak}</span>
          </button>
        )}
        
        {rightAction}
        
        {showSettings && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
            className="h-10 w-10 rounded-xl"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
};
