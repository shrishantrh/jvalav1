import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ColorfulStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  color?: 'teal' | 'purple' | 'coral' | 'mint' | 'blue' | 'yellow' | 'navy' | 'default';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

const colorStyles = {
  teal: {
    bg: "bg-teal-light",
    icon: "bg-teal text-white",
    text: "text-teal-dark",
  },
  purple: {
    bg: "bg-purple-accent-light",
    icon: "bg-purple-accent text-white",
    text: "text-purple-accent-dark",
  },
  coral: {
    bg: "bg-coral-light",
    icon: "bg-coral text-white",
    text: "text-coral-dark",
  },
  mint: {
    bg: "bg-mint-light",
    icon: "bg-mint text-white",
    text: "text-mint-dark",
  },
  blue: {
    bg: "bg-blue-accent-light",
    icon: "bg-blue-accent text-white",
    text: "text-blue-accent-dark",
  },
  yellow: {
    bg: "bg-yellow-accent-light",
    icon: "bg-yellow-accent text-white",
    text: "text-yellow-accent-dark",
  },
  navy: {
    bg: "bg-navy-light",
    icon: "bg-navy text-white",
    text: "text-navy",
  },
  default: {
    bg: "bg-card",
    icon: "bg-muted text-foreground",
    text: "text-foreground",
  },
};

export const ColorfulStatCard = ({
  icon: Icon,
  label,
  value,
  sublabel,
  trend,
  color = 'default',
  size = 'md',
  onClick,
  className,
}: ColorfulStatCardProps) => {
  const styles = colorStyles[color];
  
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex flex-col rounded-2xl transition-all text-left w-full shadow-sm",
        styles.bg,
        size === 'sm' && "p-3",
        size === 'md' && "p-4",
        size === 'lg' && "p-5",
        onClick && "press-effect hover:shadow-md",
        !onClick && "cursor-default",
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={cn(
          "rounded-xl flex items-center justify-center",
          size === 'sm' && "w-8 h-8",
          size === 'md' && "w-10 h-10",
          size === 'lg' && "w-12 h-12",
          styles.icon
        )}>
          <Icon className={cn(
            size === 'sm' && "w-4 h-4",
            size === 'md' && "w-5 h-5",
            size === 'lg' && "w-6 h-6",
          )} />
        </div>
        
        {trend && (
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            trend.direction === 'up' && "bg-severity-none/20 text-severity-none",
            trend.direction === 'down' && "bg-severity-severe/20 text-severity-severe",
            trend.direction === 'neutral' && "bg-muted text-muted-foreground"
          )}>
            {trend.direction === 'up' && '↑'}{trend.direction === 'down' && '↓'} {trend.value}
          </span>
        )}
      </div>
      
      <div className="mt-auto">
        <p className={cn(
          "font-bold",
          size === 'sm' && "text-xl",
          size === 'md' && "text-2xl",
          size === 'lg' && "text-3xl",
          styles.text
        )}>
          {value}
        </p>
        <p className={cn(
          "text-muted-foreground font-medium mt-0.5",
          size === 'sm' && "text-[10px]",
          size === 'md' && "text-xs",
          size === 'lg' && "text-sm",
        )}>
          {label}
        </p>
        {sublabel && (
          <p className={cn(
            "text-muted-foreground mt-0.5",
            size === 'sm' && "text-[9px]",
            size === 'md' && "text-[10px]",
            size === 'lg' && "text-xs",
          )}>
            {sublabel}
          </p>
        )}
      </div>
    </button>
  );
};

// Progress card with circular indicator
interface ProgressCardProps {
  title: string;
  value: number; // 0-100
  label: string;
  sublabel?: string;
  color?: 'teal' | 'purple' | 'coral' | 'primary';
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export const ProgressCard = ({
  title,
  value,
  label,
  sublabel,
  color = 'teal',
  size = 'md',
  onClick,
  className,
}: ProgressCardProps) => {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  const colorMap = {
    teal: 'stroke-teal',
    purple: 'stroke-purple-accent',
    coral: 'stroke-coral',
    primary: 'stroke-primary',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "bg-teal rounded-2xl text-white transition-all text-left w-full shadow-md",
        size === 'sm' && "p-4",
        size === 'md' && "p-5",
        onClick && "press-effect hover:shadow-lg",
        !onClick && "cursor-default",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-white/80 mb-1">{title}</p>
          <p className={cn(
            "font-bold text-white",
            size === 'sm' && "text-3xl",
            size === 'md' && "text-4xl",
          )}>
            {value}%
          </p>
          <p className="text-xs text-white/70 mt-1">{sublabel}</p>
        </div>
        
        <div className="relative">
          <svg className={cn(
            size === 'sm' && "w-16 h-16",
            size === 'md' && "w-20 h-20",
          )} viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="white"
              strokeOpacity="0.2"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="white"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 50 50)"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-white">{label}</span>
          </div>
        </div>
      </div>
    </button>
  );
};
