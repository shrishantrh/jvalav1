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
      bgClass: 'bg-severity-none/12 hover:bg-severity-none/18',
      borderClass: 'border-severity-none/25',
    },
    {
      value: 'mild' as const,
      label: 'Mild',
      description: 'Slight discomfort',
      icon: AlertCircle,
      colorClass: 'text-severity-mild',
      bgClass: 'bg-severity-mild/12 hover:bg-severity-mild/18',
      borderClass: 'border-severity-mild/25',
    },
    {
      value: 'moderate' as const,
      label: 'Moderate',
      description: 'Noticeable symptoms',
      icon: AlertTriangle,
      colorClass: 'text-severity-moderate',
      bgClass: 'bg-severity-moderate/12 hover:bg-severity-moderate/18',
      borderClass: 'border-severity-moderate/25',
    },
    {
      value: 'severe' as const,
      label: 'Severe',
      description: 'Significant impact',
      icon: XCircle,
      colorClass: 'text-severity-severe',
      bgClass: 'bg-severity-severe/12 hover:bg-severity-severe/18',
      borderClass: 'border-severity-severe/25',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {severityOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedSeverity === option.value;
        
        return (
          <Button
            key={option.value}
            variant="outline"
            onClick={() => onSeveritySelect(option.value)}
            className={cn(
              "h-[76px] p-4 flex flex-col items-center justify-center gap-2",
              "transition-all duration-300 border rounded-xl backdrop-blur-sm",
              option.bgClass,
              option.colorClass,
              isSelected 
                ? `${option.borderClass} ring-2 ring-offset-2 ring-offset-transparent ${option.borderClass.replace('border-', 'ring-')}` 
                : 'border-white/20 hover:border-white/35'
            )}
          >
            <Icon className={cn("w-5 h-5", option.colorClass)} />
            <div className="text-center">
              <div className="font-semibold text-sm">{option.label}</div>
              <div className="text-[10px] opacity-75 font-medium">{option.description}</div>
            </div>
          </Button>
        );
      })}
    </div>
  );
};