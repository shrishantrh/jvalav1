import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface QuickActionCardProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  badge?: string;
  className?: string;
}

export const QuickActionCard = ({
  icon: Icon,
  label,
  description,
  onClick,
  variant = 'default',
  size = 'md',
  badge,
  className,
}: QuickActionCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border transition-all press-effect",
        "backdrop-blur-xl overflow-hidden",
        size === 'sm' && "p-3 min-h-[70px]",
        size === 'md' && "p-4 min-h-[90px]",
        size === 'lg' && "p-5 min-h-[110px]",
        variant === 'default' && "bg-card border-white/10 hover:bg-white/5",
        variant === 'primary' && "bg-primary/10 border-primary/20 hover:bg-primary/15",
        variant === 'gradient' && "bg-gradient-primary border-transparent text-white",
        className
      )}
    >
      {badge && (
        <span className="absolute top-2 right-2 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
          {badge}
        </span>
      )}
      
      <div className={cn(
        "rounded-xl flex items-center justify-center",
        size === 'sm' && "w-8 h-8",
        size === 'md' && "w-10 h-10",
        size === 'lg' && "w-12 h-12",
        variant === 'gradient' ? "bg-white/20" : "bg-muted"
      )}>
        <Icon className={cn(
          variant === 'gradient' ? "text-white" : "text-foreground",
          size === 'sm' && "w-4 h-4",
          size === 'md' && "w-5 h-5",
          size === 'lg' && "w-6 h-6",
        )} />
      </div>
      
      <span className={cn(
        "font-medium text-center",
        size === 'sm' && "text-[11px]",
        size === 'md' && "text-xs",
        size === 'lg' && "text-sm",
        variant === 'gradient' ? "text-white" : "text-foreground"
      )}>
        {label}
      </span>
      
      {description && (
        <span className={cn(
          "text-center",
          size === 'sm' && "text-[9px]",
          size === 'md' && "text-[10px]",
          size === 'lg' && "text-[11px]",
          variant === 'gradient' ? "text-white/70" : "text-muted-foreground"
        )}>
          {description}
        </span>
      )}
    </button>
  );
};
