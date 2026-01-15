import { BarChart3, Brain, TrendingUp, Sparkles, Target, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIChatPromptsProps {
  onSendPrompt: (prompt: string) => void;
  variant?: 'capabilities' | 'followups';
  followUps?: string[];
}

// Static capability buttons showing what AI can do
const CAPABILITY_PROMPTS = [
  { icon: BarChart3, label: "Generate chart", prompt: "Show me a chart of my flares over the last 30 days", color: "text-blue-500" },
  { icon: TrendingUp, label: "Predict", prompt: "Based on my patterns, predict my flare risk for the next few days", color: "text-purple-500" },
  { icon: Brain, label: "Find patterns", prompt: "What patterns have you noticed in my health data?", color: "text-pink-500" },
  { icon: Target, label: "Top triggers", prompt: "What are my top 5 triggers and how often do they cause flares?", color: "text-orange-500" },
  { icon: Clock, label: "Time patterns", prompt: "When am I most likely to experience flares during the day?", color: "text-cyan-500" },
  { icon: MapPin, label: "Location analysis", prompt: "How does my location or weather affect my symptoms?", color: "text-green-500" },
];

export const AIChatPrompts = ({ onSendPrompt, variant = 'capabilities', followUps = [] }: AIChatPromptsProps) => {
  if (variant === 'followups' && followUps.length > 0) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {followUps.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSendPrompt(prompt)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full",
              "bg-primary/10 hover:bg-primary/20 border border-primary/20",
              "text-xs font-medium text-primary transition-all"
            )}
          >
            <Sparkles className="w-3 h-3" />
            {prompt.length > 40 ? prompt.slice(0, 40) + '...' : prompt}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      {CAPABILITY_PROMPTS.map(({ icon: Icon, label, prompt, color }) => (
        <button
          key={label}
          onClick={() => onSendPrompt(prompt)}
          className={cn(
            "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "bg-muted/50 hover:bg-muted border border-border/50",
            "text-xs font-medium transition-all hover:scale-[1.02]"
          )}
        >
          <Icon className={cn("w-3.5 h-3.5", color)} />
          {label}
        </button>
      ))}
    </div>
  );
};

// Dynamic follow-up suggestions based on AI response content
export const generateFollowUps = (aiResponse: string, hasCharts: boolean): string[] => {
  const followUps: string[] = [];
  const lowerResponse = aiResponse.toLowerCase();
  
  // Context-aware follow-ups based on what the AI just said
  if (lowerResponse.includes('trigger') || lowerResponse.includes('pattern')) {
    followUps.push("How can I avoid these triggers?");
    followUps.push("Show me a chart of these patterns");
  }
  
  if (lowerResponse.includes('flare') || lowerResponse.includes('symptom')) {
    followUps.push("Compare to last month");
    followUps.push("What medications helped most?");
  }
  
  if (lowerResponse.includes('weather') || lowerResponse.includes('temperature')) {
    followUps.push("Show weather correlation chart");
    followUps.push("Predict based on forecast");
  }
  
  if (lowerResponse.includes('sleep') || lowerResponse.includes('rest')) {
    followUps.push("How does sleep affect my flares?");
  }
  
  if (lowerResponse.includes('medication') || lowerResponse.includes('medicine')) {
    followUps.push("Track medication effectiveness");
    followUps.push("When should I take my next dose?");
  }
  
  if (hasCharts) {
    followUps.push("Explain this in more detail");
    followUps.push("Show me weekly breakdown");
  }
  
  // Always add some generic useful ones
  if (followUps.length < 3) {
    followUps.push("What should I track today?");
    followUps.push("Give me health tips");
  }
  
  // Limit to 4 suggestions max
  return followUps.slice(0, 4);
};
