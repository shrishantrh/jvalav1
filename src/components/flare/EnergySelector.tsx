import { Button } from "@/components/ui/button";
import { EnergyLevel } from "@/types/flare";
import { Battery, BatteryLow } from "lucide-react";

interface EnergySelectorProps {
  selectedEnergy: EnergyLevel | null;
  onEnergySelect: (energy: EnergyLevel) => void;
}

const energyOptions = [
  {
    value: 'very-low' as const,
    label: 'Empty',
    description: 'Completely drained',
    color: 'text-red-600',
    bgColor: 'bg-red-50 hover:bg-red-100',
    borderColor: 'border-red-200',
  },
  {
    value: 'low' as const,
    label: 'Low',
    description: 'Running on fumes',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
    borderColor: 'border-orange-200',
  },
  {
    value: 'moderate' as const,
    label: 'Moderate',
    description: 'Getting by',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 hover:bg-yellow-100',
    borderColor: 'border-yellow-200',
  },
  {
    value: 'good' as const,
    label: 'Good',
    description: 'Feeling capable',
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100',
    borderColor: 'border-green-200',
  },
  {
    value: 'high' as const,
    label: 'High',
    description: 'Energized',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    borderColor: 'border-blue-200',
  },
];

export const EnergySelector = ({ selectedEnergy, onEnergySelect }: EnergySelectorProps) => {
  return (
    <div className="space-y-2">
      {energyOptions.map((option) => {
        const isSelected = selectedEnergy === option.value;
        const batteryPercentage = ['very-low', 'low', 'moderate', 'good', 'high'].indexOf(option.value) * 25;
        
        return (
          <Button
            key={option.value}
            variant="outline"
            onClick={() => onEnergySelect(option.value)}
            className={`
              w-full h-12 p-3 flex items-center justify-between
              transition-all duration-200 border-2
              ${option.bgColor} ${option.color}
              ${isSelected 
                ? `${option.borderColor} shadow-sm` 
                : 'border-border hover:border-muted-foreground'
              }
            `}
          >
            <div className="flex items-center gap-3">
              {batteryPercentage <= 25 ? (
                <BatteryLow className="w-5 h-5" />
              ) : (
                <Battery className="w-5 h-5" />
              )}
              <div className="text-left">
                <div className="font-clinical text-sm">{option.label}</div>
                <div className="text-xs opacity-75">{option.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-6 rounded-sm ${
                    i < (batteryPercentage / 20) ? 'bg-current' : 'bg-current/20'
                  }`}
                />
              ))}
            </div>
          </Button>
        );
      })}
    </div>
  );
};