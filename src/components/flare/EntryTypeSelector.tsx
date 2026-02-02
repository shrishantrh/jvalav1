import { Button } from "@/components/ui/button";
import { EntryType } from "@/types/flare";
import { 
  AlertTriangle, 
  Pill, 
  Zap, 
  TrendingUp, 
  Battery, 
  FileText 
} from "lucide-react";

interface EntryTypeSelectorProps {
  selectedType: EntryType;
  onTypeSelect: (type: EntryType) => void;
}

const entryTypes = [
  {
    type: 'flare' as const,
    label: 'Flare Update',
    description: 'How you\'re feeling',
    icon: AlertTriangle,
    color: 'text-orange-600',
  },
  {
    type: 'medication' as const,
    label: 'Medication',
    description: 'Pills taken',
    icon: Pill,
    color: 'text-blue-600',
  },
  {
    type: 'trigger' as const,
    label: 'Trigger',
    description: 'Potential cause',
    icon: Zap,
    color: 'text-red-600',
  },
  {
    type: 'recovery' as const,
    label: 'Recovery',
    description: 'Feeling better',
    icon: TrendingUp,
    color: 'text-green-600',
  },
  {
    type: 'energy' as const,
    label: 'Energy Level',
    description: 'Battery check',
    icon: Battery,
    color: 'text-purple-600',
  },
  {
    type: 'note' as const,
    label: 'Quick Note',
    description: 'Just a thought',
    icon: FileText,
    color: 'text-gray-600',
  },
];

export const EntryTypeSelector = ({ selectedType, onTypeSelect }: EntryTypeSelectorProps) => {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {entryTypes.map((type) => {
        const Icon = type.icon;
        const isSelected = selectedType === type.type;
        
        return (
          <Button
            key={type.type}
            variant={isSelected ? "default" : "outline"}
            onClick={() => onTypeSelect(type.type)}
            className={`
              h-16 p-3 flex flex-col items-center justify-center gap-1
              transition-all duration-300 rounded-xl
              ${isSelected 
                ? '' 
                : 'border-white/20 hover:border-white/35 hover:bg-white/50 backdrop-blur-sm'
              }
            `}
          >
            <Icon className={`w-5 h-5 ${isSelected ? 'text-primary-foreground' : type.color}`} />
            <div className="text-center">
              <div className="text-xs font-medium">{type.label}</div>
              <div className="text-xs opacity-75">{type.description}</div>
            </div>
          </Button>
        );
      })}
    </div>
  );
};