import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Flame, User, TrendingUp, TrendingDown, Minus, Wind, Thermometer, Droplets } from "lucide-react";
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
  riskScore?: number | null;
  riskLevel?: string | null;
  envData?: {
    temp?: number | null;
    aqi?: number | null;
    humidity?: number | null;
    pressure?: number | null;
    pressureTrend?: 'rising' | 'falling' | 'stable' | null;
  } | null;
}

const RiskGauge = ({ score, level }: { score: number; level: string }) => {
  const color = level === 'low' ? 'text-emerald-600' :
    level === 'moderate' ? 'text-yellow-600' :
    level === 'high' ? 'text-orange-600' : 'text-red-600';
  const bgColor = level === 'low' ? 'bg-emerald-500/15' :
    level === 'moderate' ? 'bg-yellow-500/15' :
    level === 'high' ? 'bg-orange-500/15' : 'bg-red-500/15';
  const borderColor = level === 'low' ? 'border-emerald-500/30' :
    level === 'moderate' ? 'border-yellow-500/30' :
    level === 'high' ? 'border-orange-500/30' : 'border-red-500/30';

  return (
    <div className={cn(
      "flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold tabular-nums border",
      bgColor, borderColor, color
    )}>
      <span>{score}%</span>
    </div>
  );
};

const EnvContextBar = ({ envData }: { envData: NonNullable<MobileHeaderProps['envData']> }) => {
  const hasSomething = envData.temp != null || envData.aqi != null || envData.pressure != null;
  if (!hasSomething) return null;

  const PressureIcon = envData.pressureTrend === 'rising' ? TrendingUp :
    envData.pressureTrend === 'falling' ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-3 px-5 pb-1.5 overflow-x-auto scrollbar-hide">
      {envData.temp != null && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <Thermometer className="w-3 h-3" />
          <span className="font-medium tabular-nums">{Math.round(envData.temp)}°F</span>
        </div>
      )}
      {envData.aqi != null && (
        <div className={cn(
          "flex items-center gap-1 text-[10px] shrink-0",
          envData.aqi <= 50 ? "text-emerald-600" :
          envData.aqi <= 100 ? "text-yellow-600" :
          "text-red-600"
        )}>
          <Wind className="w-3 h-3" />
          <span className="font-medium tabular-nums">AQI {envData.aqi}</span>
        </div>
      )}
      {envData.humidity != null && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <Droplets className="w-3 h-3" />
          <span className="font-medium tabular-nums">{Math.round(envData.humidity)}%</span>
        </div>
      )}
      {envData.pressure != null && (
        <div className={cn(
          "flex items-center gap-1 text-[10px] shrink-0",
          envData.pressureTrend === 'falling' ? "text-orange-600" : "text-muted-foreground"
        )}>
          <PressureIcon className="w-3 h-3" />
          <span className="font-medium tabular-nums">{Math.round(envData.pressure)} hPa</span>
        </div>
      )}
    </div>
  );
};

export const MobileHeader = ({
  title = "Jvala",
  subtitle,
  showLogo = true,
  streak = 0,
  onStreakClick,
  onProfileClick,
  rightAction,
  showSettings = true,
  riskScore,
  riskLevel,
  envData,
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
    <div>
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
        
        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Risk Score Gauge */}
          {riskScore != null && riskLevel && (
            <RiskGauge score={riskScore} level={riskLevel} />
          )}
          
          {/* Streak pill */}
          {onStreakClick && (
            <button
              onClick={handleStreakClick}
              data-tour="streak-pill"
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300 overflow-hidden",
                "bg-card/70 backdrop-blur-xl",
                "border border-glass-border/30",
                "before:absolute before:inset-0 before:rounded-2xl before:pointer-events-none",
                "before:bg-gradient-to-b before:from-glass-highlight/30 before:to-transparent",
                "shadow-soft",
                "active:scale-95 touch-manipulation"
              )}
            >
              <Flame className="w-4 h-4 text-primary relative z-10" strokeWidth={2.5} />
              <span className="text-sm font-bold text-primary tabular-nums relative z-10">
                {streak}
              </span>
            </button>
          )}
          
          {/* Profile button */}
          {onProfileClick && (
            <button
              onClick={handleProfileClick}
              data-tour="profile-button"
              className={cn(
                "relative h-10 w-10 rounded-2xl flex items-center justify-center transition-all overflow-hidden",
                "bg-card/70 backdrop-blur-xl",
                "border border-glass-border/30",
                "before:absolute before:inset-0 before:rounded-2xl before:pointer-events-none",
                "before:bg-gradient-to-b before:from-glass-highlight/30 before:to-transparent",
                "shadow-soft",
                "active:scale-95 touch-manipulation"
              )}
            >
              <User className="w-5 h-5 text-muted-foreground relative z-10" />
            </button>
          )}
          
          {rightAction}
          
          {/* Settings */}
          {showSettings && (
            <button
              onClick={handleSettingsClick}
              className={cn(
                "relative h-10 w-10 rounded-2xl flex items-center justify-center transition-all overflow-hidden",
                "bg-card/70 backdrop-blur-xl",
                "border border-glass-border/30",
                "before:absolute before:inset-0 before:rounded-2xl before:pointer-events-none",
                "before:bg-gradient-to-b before:from-glass-highlight/30 before:to-transparent",
                "shadow-soft",
                "active:scale-95 touch-manipulation"
              )}
            >
              <Settings className="w-5 h-5 text-muted-foreground relative z-10" />
            </button>
          )}
        </div>
      </div>
      
      {/* Environmental context bar */}
      {envData && <EnvContextBar envData={envData} />}
    </div>
  );
};
