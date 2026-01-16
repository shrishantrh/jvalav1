import { Button } from "@/components/ui/button";
import { FlareSeverity } from "@/types/flare";
import { CheckCircle, AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SeveritySelectorProps {
  selectedSeverity: FlareSeverity | null;
  onSeveritySelect: (severity: FlareSeverity) => void;
}

export const SeveritySelector = ({ selectedSeverity, onSeveritySelect }: SeveritySelectorProps) => {
  const severityOptions = [
    {
      value: 'none' as const,
      label: 'None',
      description: 'Feeling good',
      icon: CheckCircle,
      colorClass: 'text-severity-none',
      bgClass: 'bg-severity-none-bg hover:bg-severity-none-bg/80',
      borderClass: 'border-severity-none',
      selectedBg: 'bg-severity-none/10',
    },
    {
      value: 'mild' as const,
      label: 'Mild',
      description: 'Slight discomfort',
      icon: AlertCircle,
      colorClass: 'text-severity-mild',
      bgClass: 'bg-severity-mild-bg hover:bg-severity-mild-bg/80',
      borderClass: 'border-severity-mild',
      selectedBg: 'bg-severity-mild/10',
    },
    {
      value: 'moderate' as const,
      label: 'Moderate',
      description: 'Noticeable symptoms',
      icon: AlertTriangle,
      colorClass: 'text-severity-moderate',
      bgClass: 'bg-severity-moderate-bg hover:bg-severity-moderate-bg/80',
      borderClass: 'border-severity-moderate',
      selectedBg: 'bg-severity-moderate/10',
    },
    {
      value: 'severe' as const,
      label: 'Severe',
      description: 'Significant impact',
      icon: XCircle,
      colorClass: 'text-severity-severe',
      bgClass: 'bg-severity-severe-bg hover:bg-severity-severe-bg/80',
      borderClass: 'border-severity-severe',
      selectedBg: 'bg-severity-severe/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {severityOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedSeverity === option.value;
        
        return (
          <Button
            key={option.value}
            variant="outline"
            onClick={() => onSeveritySelect(option.value)}
            className={cn(
              "h-[72px] p-3 flex flex-col items-center justify-center gap-1.5",
              "transition-all duration-200 border-2 rounded-xl",
              option.bgClass,
              option.colorClass,
              isSelected 
                ? `${option.borderClass} shadow-sm ring-1 ring-offset-1 ring-offset-background ${option.borderClass.replace('border-', 'ring-')}` 
                : 'border-border/60 hover:border-muted-foreground/40'
            )}
          >
            <Icon className={cn("w-5 h-5", option.colorClass)} />
            <div className="text-center">
              <div className="font-semibold text-sm">{option.label}</div>
              <div className="text-[10px] opacity-70 font-medium">{option.description}</div>
            </div>
          </Button>
        );
      })}
    </div>
  );
};