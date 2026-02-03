import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, Plus } from "lucide-react";

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  onClick: () => void;
  color?: 'teal' | 'purple' | 'coral' | 'mint' | 'navy' | 'default';
  showAdd?: boolean;
  badge?: string;
  className?: string;
}

const colorStyles = {
  teal: "bg-teal text-white",
  purple: "bg-purple-accent text-white",
  coral: "bg-coral text-white",
  mint: "bg-mint text-white",
  navy: "bg-navy text-white",
  default: "bg-card text-foreground shadow-sm",
};

export const ActionCard = ({
  icon: Icon,
  title,
  description,
  onClick,
  color = 'default',
  showAdd = false,
  badge,
  className,
}: ActionCardProps) => {
  const isColored = color !== 'default';
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between w-full rounded-2xl p-4 transition-all press-effect",
        colorStyles[color],
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          isColored ? "bg-white/20" : "bg-muted"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold">{title}</p>
          {description && (
            <p className={cn(
              "text-xs mt-0.5",
              isColored ? "text-white/70" : "text-muted-foreground"
            )}>
              {description}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {badge && (
          <span className={cn(
            "text-xs font-semibold px-2 py-1 rounded-full",
            isColored ? "bg-white/20" : "bg-primary/10 text-primary"
          )}>
            {badge}
          </span>
        )}
        {showAdd && (
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            isColored ? "bg-white/20" : "bg-muted"
          )}>
            <Plus className="w-4 h-4" />
          </div>
        )}
      </div>
    </button>
  );
};

// Quick action grid item
interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'mild' | 'moderate' | 'severe' | 'good' | 'default';
  isSelected?: boolean;
  className?: string;
}

const variantStyles = {
  mild: {
    bg: "bg-yellow-accent-light",
    active: "bg-yellow-accent text-white",
    icon: "text-yellow-accent",
  },
  moderate: {
    bg: "bg-coral-light",
    active: "bg-coral text-white",
    icon: "text-coral",
  },
  severe: {
    bg: "bg-severity-severe-bg",
    active: "bg-severity-severe text-white",
    icon: "text-severity-severe",
  },
  good: {
    bg: "bg-mint-light",
    active: "bg-mint text-white",
    icon: "text-mint",
  },
  default: {
    bg: "bg-card shadow-sm",
    active: "bg-primary text-white",
    icon: "text-foreground",
  },
};

export const QuickAction = ({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  isSelected = false,
  className,
}: QuickActionProps) => {
  const styles = variantStyles[variant];
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all press-effect min-h-[80px]",
        isSelected ? styles.active : styles.bg,
        className
      )}
    >
      <Icon className={cn(
        "w-6 h-6",
        isSelected ? "text-inherit" : styles.icon
      )} />
      <span className={cn(
        "text-xs font-semibold",
        !isSelected && "text-foreground"
      )}>
        {label}
      </span>
    </button>
  );
};

// Week day selector
interface WeekDayProps {
  days: { 
    date: Date; 
    hasEntry: boolean; 
    severity?: 'mild' | 'moderate' | 'severe' | 'none';
  }[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export const WeekDaySelector = ({ days, selectedDate, onSelectDate }: WeekDayProps) => {
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  
  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'severe': return 'bg-severity-severe text-white';
      case 'moderate': return 'bg-coral text-white';
      case 'mild': return 'bg-yellow-accent text-white';
      case 'none': return 'bg-mint text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };
  
  return (
    <div className="flex items-center justify-between gap-1">
      {days.map((day, index) => {
        const isSelected = day.date.toDateString() === selectedDate.toDateString();
        const dayOfWeek = day.date.getDay();
        const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        return (
          <button
            key={index}
            onClick={() => onSelectDate(day.date)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all press-effect flex-1",
              isSelected && "ring-2 ring-foreground ring-offset-2"
            )}
          >
            <span className="text-[10px] font-medium text-muted-foreground">
              {dayNames[dayIndex]}
            </span>
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
              day.hasEntry ? getSeverityColor(day.severity) : 'bg-muted/50 text-muted-foreground'
            )}>
              {day.date.getDate()}
            </div>
          </button>
        );
      })}
    </div>
  );
};
