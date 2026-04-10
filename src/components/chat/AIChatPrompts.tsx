import { BarChart3, Brain, TrendingUp, Sparkles, Target, Clock, Utensils, Pill, Heart, Shield, Activity, Thermometer, Moon, Zap, MapPin, CalendarDays, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIChatPromptsProps {
  onSendPrompt: (prompt: string) => void;
  variant?: 'capabilities' | 'followups';
  followUps?: string[];
}

// 16 capability buttons — each one the AI can definitively answer with real data
const CAPABILITY_PROMPTS = [
  { icon: Brain, label: "Deep analysis", prompt: "Give me a deep analysis of all my triggers, protective factors, and emerging patterns. What's statistically significant, what's getting worse, and what should I act on right now?", color: "text-pink-500" },
  { icon: BarChart3, label: "30-day chart", prompt: "Show me a chart of my daily flare count and severity breakdown over the last 30 days. Include a trend line and highlight any spikes.", color: "text-blue-500" },
  { icon: Target, label: "Flare risk now", prompt: "What's my flare risk right now? Factor in my sleep, recent activity, weather, diet, medications, and any missed doses. Give me a percentage and explain your reasoning.", color: "text-orange-500" },
  { icon: Pill, label: "Meds effectiveness", prompt: "Which of my medications reduced my flare severity the most? Show me a comparison chart with severity reduction percentages and flare-free rates for each.", color: "text-purple-500" },
  { icon: Utensils, label: "Food & flares", prompt: "Analyze my food logs against my flare history. Are any foods correlated with flares? What about inflammatory vs anti-inflammatory food balance? Show me the data.", color: "text-green-500" },
  { icon: Clock, label: "Time patterns", prompt: "Show me charts of what hours and days of the week I flare most. Is there a circadian pattern? Do weekends differ from weekdays?", color: "text-cyan-500" },
  { icon: Heart, label: "Body metrics", prompt: "Compare my heart rate, HRV, and sleep metrics on flare days vs non-flare days. Are there any autonomic warning signs before flares?", color: "text-red-500" },
  { icon: Shield, label: "What helps me", prompt: "What are my confirmed protective factors? What specifically reduces my flare risk based on my actual logged data? Rank them by effectiveness.", color: "text-emerald-500" },
  { icon: Scale, label: "Health score", prompt: "What's my current health score and how has it changed over the past month? Break down the factors contributing to it.", color: "text-amber-500" },
  { icon: TrendingUp, label: "Week comparison", prompt: "How am I doing this week compared to last week and last month? Show me the numbers — flare count, severity, triggers, and any improvements or regressions.", color: "text-indigo-500" },
  { icon: Moon, label: "Sleep impact", prompt: "How does my sleep quality and duration affect my flares? Show me the correlation between sleep hours and next-day severity.", color: "text-violet-500" },
  { icon: Activity, label: "Severity trajectory", prompt: "Is my condition getting better or worse over time? Show me my severity trajectory and tell me honestly where things are heading.", color: "text-rose-500" },
  { icon: Thermometer, label: "Weather effects", prompt: "How does weather affect my flares? Show me correlations between temperature, pressure, humidity, and my flare frequency and severity.", color: "text-sky-500" },
  { icon: MapPin, label: "Location patterns", prompt: "Do I flare more in certain locations or cities? Are there geographic patterns in my data?", color: "text-teal-500" },
  { icon: Zap, label: "Trigger chains", prompt: "Which of my triggers lead to which specific symptoms? Show me the trigger-to-symptom mapping with frequencies.", color: "text-yellow-500" },
  { icon: CalendarDays, label: "Monthly report", prompt: "Give me a complete monthly health report: total flares, severity breakdown, top triggers, medications used, best and worst days, and 3 actionable recommendations.", color: "text-fuchsia-500" },
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
    followUps.push("Show me a chart of weather conditions vs flare frequency");
  }
  
  if (lower.includes('sleep') || lower.includes('rest') || lower.includes('fatigue')) {
    followUps.push("How does my sleep duration correlate with next-day flares?");
    followUps.push("Show my HRV trend on flare vs non-flare days");
  }
  
  if (lower.includes('medication') || lower.includes('medicine') || lower.includes('drug')) {
    followUps.push("Which medication gave me the most flare-free days?");
    followUps.push("Am I missing any medication doses recently?");
  }
  
  if (lower.includes('food') || lower.includes('diet') || lower.includes('eat')) {
    followUps.push("Which foods appear before my worst flares?");
    followUps.push("What's my inflammatory vs anti-inflammatory food balance?");
  }
  
  if (lower.includes('severity') || lower.includes('worse') || lower.includes('better')) {
    followUps.push("Show my severity trajectory over the past month");
    followUps.push("What's my health score trend?");
  }
  
  if (hasCharts) {
    followUps.push("Break this down by severity level");
    followUps.push("Compare to last month's data");
  }
  
  if (lower.includes('risk') || lower.includes('predict')) {
    followUps.push("What can I do right now to lower my risk?");
    followUps.push("How accurate have your predictions been?");
  }
  
  if (lower.includes('score') || lower.includes('health')) {
    followUps.push("What's bringing my health score down?");
    followUps.push("What would improve my score the most?");
  }
  
  if (followUps.length < 3) {
    followUps.push("Show me my 30-day flare trend");
    followUps.push("What's my flare risk right now?");
    followUps.push("Give me a full monthly health report");
  }
  
  return [...new Set(followUps)].slice(0, 4);
};
