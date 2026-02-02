import { Button } from "@/components/ui/button";
import { 
  Brain, 
  Heart, 
  Zap, 
  Moon, 
  Thermometer, 
  Activity,
  Headphones,
  Eye
} from "lucide-react";

interface SymptomSelectorProps {
  selectedSymptoms: string[];
  onSymptomToggle: (symptom: string) => void;
}

const commonSymptoms = [
  { name: 'Fatigue', icon: Moon },
  { name: 'Brain fog', icon: Brain },
  { name: 'Joint pain', icon: Activity },
  { name: 'Headache', icon: Headphones },
  { name: 'Nausea', icon: Thermometer },
  { name: 'Dizziness', icon: Zap },
  { name: 'Heart racing', icon: Heart },
  { name: 'Vision issues', icon: Eye },
];

export const SymptomSelector = ({ selectedSymptoms, onSymptomToggle }: SymptomSelectorProps) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      {commonSymptoms.map((symptom) => {
        const Icon = symptom.icon;
        const isSelected = selectedSymptoms.includes(symptom.name);
        
        return (
          <Button
            key={symptom.name}
            variant="outline"
            onClick={() => onSymptomToggle(symptom.name)}
            className={`
              h-16 p-2 flex flex-col items-center justify-center gap-1
              transition-all duration-300 border rounded-xl backdrop-blur-sm
              ${isSelected 
                ? 'bg-primary/15 border-primary/30 text-primary ring-2 ring-primary/20 ring-offset-1 ring-offset-transparent' 
                : 'border-white/20 hover:border-white/35 hover:bg-white/50 text-foreground/85'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="text-xs font-medium leading-tight text-center">
              {symptom.name}
            </span>
          </Button>
        );
      })}
    </div>
  );
};