import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface CompactStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

const variantStyles = {
  default: "bg-card border-white/10",
  primary: "bg-primary/10 border-primary/20",
  success: "bg-severity-none/10 border-severity-none/20",
  warning: "bg-severity-mild/10 border-severity-mild/20",
  danger: "bg-severity-severe/10 border-severity-severe/20",
};

const iconVariantStyles = {
  default: "bg-muted text-foreground",
  primary: "bg-primary/20 text-primary",
  success: "bg-severity-none/20 text-severity-none",
  warning: "bg-severity-mild/20 text-severity-mild",
  danger: "bg-severity-severe/20 text-severity-severe",
};

export const CompactStatCard = ({
  icon: Icon,
  label,
  value,
  sublabel,
  trend,
  trendValue,
  variant = 'default',
  onClick,
  className,
}: CompactStatCardProps) => {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left w-full",
        "backdrop-blur-xl",
        variantStyles[variant],
        onClick && "press-effect hover:scale-[1.02]",
        !onClick && "cursor-default",
        className
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
        iconVariantStyles[variant]
      )}>
        <Icon className="w-5 h-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-foreground">{value}</span>
          {trendValue && (
            <span className={cn(
              "text-[10px] font-medium",
              trend === 'up' && "text-severity-none",
              trend === 'down' && "text-severity-severe",
              trend === 'neutral' && "text-muted-foreground"
            )}>
              {trend === 'up' && '↑'}{trend === 'down' && '↓'} {trendValue}
            </span>
          )}
        </div>
        {sublabel && (
          <p className="text-[10px] text-muted-foreground truncate">{sublabel}</p>
        )}
      </div>
    </button>
  );
};
