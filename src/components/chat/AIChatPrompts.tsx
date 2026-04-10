import { BarChart3, Brain, TrendingUp, Sparkles, Target, Clock, MapPin, Utensils, Pill, Heart, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIChatPromptsProps {
  onSendPrompt: (prompt: string) => void;
  variant?: 'capabilities' | 'followups';
  followUps?: string[];
}

// Static capability buttons — each one the AI can definitively answer
const CAPABILITY_PROMPTS = [
  { icon: Brain, label: "Deep analysis", prompt: "Give me a deep analysis of all my triggers, protective factors, and patterns. What's statistically significant and what should I act on?", color: "text-pink-500" },
  { icon: BarChart3, label: "30-day chart", prompt: "Show me a chart of my daily flare count and severity over the last 30 days with a trend line", color: "text-blue-500" },
  { icon: Target, label: "Flare risk", prompt: "What's my flare risk right now? Factor in my sleep, recent activity, weather, diet, and any medications I've missed.", color: "text-orange-500" },
  { icon: TrendingUp, label: "Meds analysis", prompt: "Which of my medications reduced my flare severity the most? Show me a comparison chart.", color: "text-purple-500" },
  { icon: Utensils, label: "Food patterns", prompt: "Analyze my food logs — are any foods correlated with my flares? Show me the data.", color: "text-green-500" },
  { icon: Clock, label: "Time patterns", prompt: "Show me charts of what hours and days I flare most, and whether there's a circadian pattern", color: "text-cyan-500" },
  { icon: Heart, label: "Body metrics", prompt: "Compare my heart rate, HRV, and sleep metrics on flare days vs non-flare days. What stands out?", color: "text-red-500" },
  { icon: Shield, label: "What helps", prompt: "What are my confirmed protective factors? What reduces my flare risk based on my actual data?", color: "text-emerald-500" },
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
            {prompt.length > 45 ? prompt.slice(0, 45) + '...' : prompt}
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
  const lower = aiResponse.toLowerCase();
  
  if (lower.includes('trigger') || lower.includes('pattern')) {
    followUps.push("Which triggers lead to my worst symptoms?");
    followUps.push("Show me a chart comparing trigger frequency");
  }
  
  if (lower.includes('flare') || lower.includes('symptom')) {
    followUps.push("Compare this week's flares to last week");
    followUps.push("Which medications help reduce my flare severity?");
  }
  
  if (lower.includes('weather') || lower.includes('pressure') || lower.includes('humidity')) {
    followUps.push("Show me a chart of barometric pressure vs flares");
  }
  
  if (lower.includes('sleep') || lower.includes('rest') || lower.includes('fatigue')) {
    followUps.push("How does my sleep duration correlate with next-day flares?");
    followUps.push("Show my HRV trend over the last month");
  }
  
  if (lower.includes('medication') || lower.includes('medicine') || lower.includes('drug')) {
    followUps.push("Which medication gave me the most flare-free days?");
    followUps.push("Am I missing any medication doses?");
  }
  
  if (lower.includes('food') || lower.includes('diet') || lower.includes('eat')) {
    followUps.push("Which foods appear before my worst flares?");
    followUps.push("Show me my daily calorie intake vs flare severity");
  }
  
  if (hasCharts) {
    followUps.push("Break this down by severity level");
    followUps.push("Compare to last month's data");
  }
  
  if (lower.includes('risk') || lower.includes('predict')) {
    followUps.push("What can I do right now to lower my risk?");
    followUps.push("How accurate have your predictions been?");
  }
  
  if (followUps.length < 3) {
    followUps.push("Show me my 30-day flare trend");
    followUps.push("What's my flare risk right now?");
    followUps.push("Give me a full health summary");
  }
  
  // Deduplicate and limit
  return [...new Set(followUps)].slice(0, 4);
};
