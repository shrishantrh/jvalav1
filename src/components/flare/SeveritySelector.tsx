import { Button } from "@/components/ui/button";
import { FlareSeverity } from "@/types/flare";
import { CheckCircle, AlertCircle, AlertTriangle, XCircle } from "lucide-react";

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
      bgColor: 'bg-severity-none-bg hover:bg-severity-none-bg/80',
      textColor: 'text-severity-none',
      borderColor: 'border-severity-none',
    },
    {
      value: 'mild' as const,
      label: 'Mild',
      description: 'Slight discomfort',
      icon: AlertCircle,
      bgColor: 'bg-severity-mild-bg hover:bg-severity-mild-bg/80',
      textColor: 'text-severity-mild',
      borderColor: 'border-severity-mild',
    },
    {
      value: 'moderate' as const,
      label: 'Moderate',
      description: 'Noticeable symptoms',
      icon: AlertTriangle,
      bgColor: 'bg-severity-moderate-bg hover:bg-severity-moderate-bg/80',
      textColor: 'text-severity-moderate',
      borderColor: 'border-severity-moderate',
    },
    {
      value: 'severe' as const,
      label: 'Severe',
      description: 'Significant impact',
      icon: XCircle,
      bgColor: 'bg-severity-severe-bg hover:bg-severity-severe-bg/80',
      textColor: 'text-severity-severe',
      borderColor: 'border-severity-severe',
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
            className={`
              h-20 p-4 flex flex-col items-center justify-center gap-2 
              transition-all duration-200 border-2
              ${option.bgColor} ${option.textColor}
              ${isSelected 
                ? `${option.borderColor} shadow-md scale-105` 
                : 'border-border hover:border-muted-foreground'
              }
            `}
          >
            <Icon className="w-6 h-6" />
            <div className="text-center">
              <div className="font-clinical text-sm">{option.label}</div>
              <div className="text-xs opacity-75">{option.description}</div>
            </div>
          </Button>
        );
      })}
    </div>
  );
};