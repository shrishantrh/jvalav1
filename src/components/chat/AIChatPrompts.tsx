import { BarChart3, Brain, TrendingUp, Sparkles, Target, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIChatPromptsProps {
  onSendPrompt: (prompt: string) => void;
  variant?: 'capabilities' | 'followups';
  followUps?: string[];
}

// Static capability buttons showing what AI can do
const CAPABILITY_PROMPTS = [
  { icon: BarChart3, label: "30-day chart", prompt: "Show me a chart of my daily flare count over the last 30 days", color: "text-blue-500" },
  { icon: TrendingUp, label: "Med effectiveness", prompt: "Which of my medications reduced my flare severity the most?", color: "text-purple-500" },
  { icon: Brain, label: "My patterns", prompt: "What are my strongest confirmed patterns and triggers?", color: "text-pink-500" },
  { icon: Target, label: "Trigger → symptom", prompt: "Which triggers lead to which symptoms for me, and how often?", color: "text-orange-500" },
  { icon: Clock, label: "Peak times", prompt: "Show me a chart of what hours and days I flare most", color: "text-cyan-500" },
  { icon: MapPin, label: "Weekly trend", prompt: "Show me a chart of my weekly flare trend with severity breakdown", color: "text-green-500" },
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
  
  if (lowerResponse.includes('trigger') || lowerResponse.includes('pattern')) {
    followUps.push("Which triggers lead to my worst symptoms?");
    followUps.push("Show me a chart of my top triggers");
  }
  
  if (lowerResponse.includes('flare') || lowerResponse.includes('symptom')) {
    followUps.push("Show me my weekly severity trend");
    followUps.push("Which medications reduced my flare severity?");
  }
  
  if (lowerResponse.includes('weather') || lowerResponse.includes('temperature')) {
    followUps.push("Show me a chart of weather vs flares");
  }
  
  if (lowerResponse.includes('sleep') || lowerResponse.includes('rest')) {
    followUps.push("How does sleep affect my flare severity?");
  }
  
  if (lowerResponse.includes('medication') || lowerResponse.includes('medicine')) {
    followUps.push("Which medication gave me the most flare-free days?");
    followUps.push("Show me a chart comparing medication effectiveness");
  }
  
  if (hasCharts) {
    followUps.push("Break this down by severity");
    followUps.push("Compare to last month");
  }
  
  if (followUps.length < 3) {
    followUps.push("Show me my 30-day flare chart");
    followUps.push("What's my flare risk today?");
  }
  
  return followUps.slice(0, 4);
};
