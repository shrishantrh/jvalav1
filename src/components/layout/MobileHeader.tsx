import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Flame, User } from "lucide-react";
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
  onProfileClick?: () => void;
  rightAction?: ReactNode;
  showSettings?: boolean;
}

export const MobileHeader = ({
  title = "Jvala",
  subtitle,
  showLogo = true,
  streak = 0,
  onStreakClick,
  onProfileClick,
  rightAction,
  showSettings = true,
}: MobileHeaderProps) => {
  const navigate = useNavigate();
  
  const handleStreakClick = () => {
    haptics.light();
    onStreakClick?.();
  };

  const handleProfileClick = () => {
    haptics.selection();
    onProfileClick?.();
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
              className="w-10 h-10 rounded-2xl"
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
      
      {/* Right: Actions — Liquid Glass buttons */}
      <div className="flex items-center gap-2">
        {/* Streak pill — Liquid Glass */}
        {onStreakClick && (
          <button
            onClick={handleStreakClick}
            data-tour="streak-pill"
            className={cn(
              "relative flex items-center gap-1.5 px-4 py-2 rounded-2xl overflow-hidden",
              "active:scale-95 touch-manipulation"
            )}
            style={{
              background: 'hsl(var(--glass-bg) / 0.55)',
              backdropFilter: 'blur(20px) saturate(200%)',
              WebkitBackdropFilter: 'blur(20px) saturate(200%)',
              border: '1px solid hsl(var(--glass-highlight) / 0.18)',
              boxShadow: 'var(--glass-shadow), inset 0 1px 0 hsl(var(--glass-specular) / 0.3)',
              transition: 'var(--transition-liquid)',
            }}
          >
            <Flame className="w-4 h-4 text-primary relative z-10" strokeWidth={2.5} />
            <span className="text-sm font-bold text-primary tabular-nums relative z-10">
              {streak}
            </span>
          </button>
        )}
        
        {/* Profile button — Liquid Glass */}
        {onProfileClick && (
          <button
            onClick={handleProfileClick}
            data-tour="profile-button"
            className={cn(
              "relative h-10 w-10 rounded-2xl flex items-center justify-center overflow-hidden",
              "active:scale-95 touch-manipulation"
            )}
            style={{
              background: 'hsl(var(--glass-bg) / 0.55)',
              backdropFilter: 'blur(20px) saturate(200%)',
              WebkitBackdropFilter: 'blur(20px) saturate(200%)',
              border: '1px solid hsl(var(--glass-highlight) / 0.18)',
              boxShadow: 'var(--glass-shadow), inset 0 1px 0 hsl(var(--glass-specular) / 0.3)',
              transition: 'var(--transition-liquid)',
            }}
          >
            <User className="w-5 h-5 text-muted-foreground relative z-10" />
          </button>
        )}
        
        {rightAction}
        
        {/* Settings — Liquid Glass */}
        {showSettings && (
          <button
            onClick={handleSettingsClick}
            className={cn(
              "relative h-10 w-10 rounded-2xl flex items-center justify-center overflow-hidden",
              "active:scale-95 touch-manipulation"
            )}
            style={{
              background: 'hsl(var(--glass-bg) / 0.55)',
              backdropFilter: 'blur(20px) saturate(200%)',
              WebkitBackdropFilter: 'blur(20px) saturate(200%)',
              border: '1px solid hsl(var(--glass-highlight) / 0.18)',
              boxShadow: 'var(--glass-shadow), inset 0 1px 0 hsl(var(--glass-specular) / 0.3)',
              transition: 'var(--transition-liquid)',
            }}
          >
            <Settings className="w-5 h-5 text-muted-foreground relative z-10" />
          </button>
        )}
      </div>
    </div>
  );
};
