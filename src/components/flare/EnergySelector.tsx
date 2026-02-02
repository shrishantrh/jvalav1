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
    color: 'text-severity-severe',
    bgColor: 'bg-severity-severe/12 hover:bg-severity-severe/18',
    borderColor: 'border-severity-severe/25',
  },
  {
    value: 'low' as const,
    label: 'Low',
    description: 'Running on fumes',
    color: 'text-severity-moderate',
    bgColor: 'bg-severity-moderate/12 hover:bg-severity-moderate/18',
    borderColor: 'border-severity-moderate/25',
  },
  {
    value: 'moderate' as const,
    label: 'Moderate',
    description: 'Getting by',
    color: 'text-severity-mild',
    bgColor: 'bg-severity-mild/12 hover:bg-severity-mild/18',
    borderColor: 'border-severity-mild/25',
  },
  {
    value: 'good' as const,
    label: 'Good',
    description: 'Feeling capable',
    color: 'text-severity-none',
    bgColor: 'bg-severity-none/12 hover:bg-severity-none/18',
    borderColor: 'border-severity-none/25',
  },
  {
    value: 'high' as const,
    label: 'High',
    description: 'Energized',
    color: 'text-primary',
    bgColor: 'bg-primary/12 hover:bg-primary/18',
    borderColor: 'border-primary/25',
  },
];

export const EnergySelector = ({ selectedEnergy, onEnergySelect }: EnergySelectorProps) => {
  return (
    <div className="space-y-2.5">
      {energyOptions.map((option) => {
        const isSelected = selectedEnergy === option.value;
        const batteryPercentage = ['very-low', 'low', 'moderate', 'good', 'high'].indexOf(option.value) * 25;
        
        return (
          <Button
            key={option.value}
            variant="outline"
            onClick={() => onEnergySelect(option.value)}
            className={`
              w-full h-14 p-4 flex items-center justify-between
              transition-all duration-300 border rounded-xl backdrop-blur-sm
              ${option.bgColor} ${option.color}
              ${isSelected 
                ? `${option.borderColor} ring-2 ring-offset-1 ring-offset-transparent ${option.borderColor.replace('border-', 'ring-')}` 
                : 'border-white/20 hover:border-white/35'
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
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs opacity-75">{option.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-6 rounded-sm transition-colors ${
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