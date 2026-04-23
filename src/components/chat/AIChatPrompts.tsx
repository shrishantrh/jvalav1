import { BarChart3, Brain, TrendingUp, Sparkles, Target, Clock, Utensils, Pill, Heart, Shield, Activity, Thermometer, Moon, Zap, MapPin, CalendarDays, Scale, Flame, Dumbbell, Droplets, Eye, Wind, Beaker, AlertTriangle, Leaf, Timer, Layers, Gauge, Footprints, Coffee, Stethoscope, Waves, ScanLine, GitCompare, Salad, Sunrise, FlaskConical, Orbit, TreePine } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIChatPromptsProps {
  onSendPrompt: (prompt: string) => void;
  variant?: 'capabilities' | 'followups';
  followUps?: string[];
}

// 40 capability buttons — each maps to a real analytical feature
const CAPABILITY_PROMPTS = [
  { icon: Brain, label: "Deep analysis", prompt: "Give me a deep analysis of all my triggers, protective factors, and emerging patterns. What's statistically significant, what's getting worse, and what should I act on right now?", color: "text-pink-500" },
  { icon: BarChart3, label: "30-day chart", prompt: "Show me a chart of my daily flare count and severity breakdown over the last 30 days. Include a trend line and highlight any spikes.", color: "text-blue-500" },
  { icon: Target, label: "Flare risk now", prompt: "What's my flare risk right now? Factor in my sleep, recent activity, weather, diet, medications, and any missed doses. Give me a percentage and explain your reasoning.", color: "text-orange-500" },
  { icon: Pill, label: "Meds effectiveness", prompt: "Which of my medications reduced my flare severity the most? Show me a comparison chart with severity reduction percentages, flare-free rates, time-to-relief, and timing consistency for each.", color: "text-purple-500" },
  { icon: Utensils, label: "Food & flares", prompt: "Analyze my food logs against my flare history. Which foods are suspicious? Which are protective? What about inflammatory vs anti-inflammatory balance? Show me the data.", color: "text-green-500" },
  { icon: Clock, label: "Time patterns", prompt: "Show me charts of what hours and days of the week I flare most. What's my worst hour? What are my golden hours with zero flares? Do weekends differ from weekdays?", color: "text-cyan-500" },
  { icon: Heart, label: "Body metrics", prompt: "Compare my heart rate, HRV, sleep, SpO2, and steps on flare days vs non-flare days. Show me the HRV 14-day trend. Are there any autonomic warning signs before flares?", color: "text-red-500" },
  { icon: Shield, label: "What helps me", prompt: "What are my confirmed protective factors? What specifically reduces my flare risk based on my actual data? Rank them by effectiveness.", color: "text-emerald-500" },
  { icon: Scale, label: "Health score", prompt: "What's my current health score and what factors are bringing it down? Give me the full breakdown including escalation penalty, meal regularity, diet diversity, and the single change that would improve it the most.", color: "text-amber-500" },
  { icon: TrendingUp, label: "Week comparison", prompt: "How am I doing this week compared to last week and last month? Show me a comparison chart with flare count, severity, velocity, and any improvements.", color: "text-indigo-500" },
  { icon: Moon, label: "Sleep impact", prompt: "How does my sleep quality and duration affect my flares? Show me the sleep-flare lag correlation and what happens the day after bad sleep.", color: "text-violet-500" },
  { icon: Activity, label: "Severity trajectory", prompt: "Is my condition getting better or worse over time? Show me my EWMA severity trend, severity slope, and tell me honestly where things are heading.", color: "text-rose-500" },
  { icon: Thermometer, label: "Weather effects", prompt: "How does weather affect my flares? Show me correlations between temperature, pressure, humidity, AQI, pollen and my flare frequency/severity. Include Pearson r coefficients.", color: "text-sky-500" },
  { icon: MapPin, label: "Location patterns", prompt: "Do I flare more in certain locations or cities? Show me my top flare locations with severity rankings and any geographic patterns.", color: "text-teal-500" },
  { icon: Zap, label: "Trigger chains", prompt: "Which of my triggers lead to which specific symptoms? Show me the trigger-to-symptom mapping with frequencies, severities, and the most dangerous trigger combos.", color: "text-yellow-500" },
  { icon: CalendarDays, label: "Monthly report", prompt: "Give me a complete monthly health report: total flares, severity breakdown, top triggers, medications used, best and worst days, food patterns, exercise impact, EWMA trend, and 3 actionable recommendations.", color: "text-fuchsia-500" },
  { icon: Flame, label: "Symptom clusters", prompt: "Which of my symptoms tend to appear together? Show me symptom co-occurrence pairs and what triggers the clusters. Which symptom is the most severe and most persistent?", color: "text-orange-400" },
  { icon: Dumbbell, label: "Recovery analysis", prompt: "What conditions or behaviors precede my longest flare-free periods? What was different during my best streak? Help me recreate those conditions.", color: "text-lime-500" },
  { icon: Droplets, label: "Daily briefing", prompt: "Give me my daily health briefing — how am I doing, what's my risk today, what should I watch out for, and what should I focus on?", color: "text-blue-400" },
  { icon: Eye, label: "Worst flare deep-dive", prompt: "Tell me about my worst flare — what happened, what triggers were present, what did my body metrics look like, what was the weather, and what can I learn from it?", color: "text-red-400" },
  { icon: AlertTriangle, label: "Dangerous combos", prompt: "Which of my trigger combinations lead to the most severe flares? Rank them by average severity and show me the combo danger scores.", color: "text-red-600" },
  { icon: Leaf, label: "Diet deep-dive", prompt: "Break down my diet: daily calorie averages, protein/fiber/sugar/sodium ratios, meal timing regularity, late-night eating rate, caffeine patterns, alcohol intake, diet diversity score, and which specific foods are suspicious vs protective.", color: "text-green-600" },
  { icon: Timer, label: "Flare duration", prompt: "How long do my flares typically last? Does duration vary by severity level? What about by trigger? Show me the data.", color: "text-orange-600" },
  { icon: Layers, label: "Seasonal patterns", prompt: "Do I have seasonal patterns? Which months am I worst? Is there a cyclical pattern? Show me a seasonal breakdown chart.", color: "text-teal-600" },
  { icon: Gauge, label: "Med adherence", prompt: "How consistent am I with my medications? Show me adherence rates for each medication, timing consistency scores, gap days, polypharmacy days, and whether adherence correlates with fewer flares.", color: "text-purple-400" },
  { icon: Footprints, label: "Steps & activity", prompt: "How do my daily steps correlate with flares? Show me the steps-flare correlation and whether more active days are better or worse.", color: "text-lime-600" },
  { icon: Coffee, label: "Caffeine & timing", prompt: "Am I having too much caffeine? How much is after 2pm? How does caffeine relate to my flare patterns and sleep quality?", color: "text-amber-600" },
  { icon: Waves, label: "HRV trend", prompt: "Show me my HRV trend over the last 14 days as a line chart. What's the direction and how does it compare on flare vs non-flare days?", color: "text-violet-400" },
  { icon: Stethoscope, label: "Escalation detection", prompt: "Am I in an escalation pattern? How many rapid escalation windows and flare bursts have I had? What's my EWMA trend showing? Should I be concerned?", color: "text-rose-600" },
  { icon: ScanLine, label: "Golden hours", prompt: "What are my golden hours — times with zero flares? When am I safest? Show me the hourly heatmap.", color: "text-emerald-400" },
  { icon: GitCompare, label: "Weekend vs weekday", prompt: "Compare my weekend flares vs weekday flares in detail. Are there severity differences? Different triggers? What's causing the pattern?", color: "text-indigo-400" },
  { icon: Salad, label: "Diet diversity", prompt: "How diverse is my diet? How many unique foods have I eaten in the last 7 days? What's my diet diversity score and how does it affect my health?", color: "text-green-400" },
  { icon: Sunrise, label: "Breakfast analysis", prompt: "How often do I skip breakfast? Does skipping breakfast correlate with more flares or lower energy? Show me the data.", color: "text-amber-400" },
  { icon: FlaskConical, label: "Polypharmacy check", prompt: "How many days am I taking 3+ medications? Is there a pattern to polypharmacy days vs flare severity? Should I be concerned about interactions?", color: "text-purple-600" },
  { icon: Orbit, label: "Symptom persistence", prompt: "Which of my symptoms persist across consecutive flares? Show me the most persistent symptoms and what might be causing the carryover.", color: "text-pink-400" },
  { icon: TreePine, label: "Flare-free recipe", prompt: "What's the recipe for my best days? Analyze my flare-free periods — what did I eat, how did I sleep, what was my activity, and what was the weather? Give me a repeatable formula.", color: "text-emerald-600" },
  { icon: Beaker, label: "Research something", prompt: "I have a medical question I'd like you to research for me: ", color: "text-blue-600" },
  { icon: Wind, label: "Flare velocity", prompt: "Is my flare rate accelerating or decelerating? Show me the week-over-week velocity, severity slope, and whether I'm in an escalation or remission trend.", color: "text-sky-600" },
  { icon: Sparkles, label: "Surprise me", prompt: "Look at all my data and tell me the most surprising or interesting pattern I probably don't know about. Connect dots I haven't connected.", color: "text-pink-400" },
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
              "flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full",
              "bg-primary/10 hover:bg-primary/20 border border-primary/20",
              "text-sm font-medium text-primary transition-all"
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
              "flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full",
              "bg-muted/50 hover:bg-muted border border-border/50",
              "text-[15px] font-medium transition-all hover:scale-[1.02]"
            )}
        >
          <Icon className={cn("w-5 h-5", color)} />
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
    followUps.push("Which trigger combos are most dangerous?");
    followUps.push("Show me a chart comparing trigger danger levels");
  }
  
  if (lower.includes('flare') || lower.includes('symptom')) {
    followUps.push("Compare this week's flares to last week");
    followUps.push("Which medications help reduce my flare severity?");
  }
  
  if (lower.includes('weather') || lower.includes('pressure') || lower.includes('humidity')) {
    followUps.push("Show me weather conditions vs flare severity with Pearson r coefficients");
  }
  
  if (lower.includes('sleep') || lower.includes('rest') || lower.includes('fatigue')) {
    followUps.push("How does my sleep duration correlate with next-day flares?");
    followUps.push("Show my HRV 14-day trend");
  }
  
  if (lower.includes('medication') || lower.includes('medicine') || lower.includes('drug')) {
    followUps.push("Which medication gave me the most flare-free days?");
    followUps.push("Show me medication timing consistency scores");
    followUps.push("Do I have polypharmacy concerns?");
  }
  
  if (lower.includes('food') || lower.includes('diet') || lower.includes('eat') || lower.includes('calori')) {
    followUps.push("Which foods appear before my worst flares?");
    followUps.push("What's my diet diversity score?");
    followUps.push("How's my inflammatory balance?");
  }
  
  if (lower.includes('severity') || lower.includes('worse') || lower.includes('better') || lower.includes('trajectory')) {
    followUps.push("Show my EWMA severity trend with slope");
    followUps.push("Am I in an escalation pattern?");
  }
  
  if (hasCharts) {
    followUps.push("Break this down by severity level");
    followUps.push("Compare to last month's data");
  }
  
  if (lower.includes('risk') || lower.includes('predict')) {
    followUps.push("What can I do right now to lower my risk?");
    followUps.push("Show me my prediction accuracy over time");
  }
  
  if (lower.includes('score') || lower.includes('health')) {
    followUps.push("What's bringing my health score down?");
    followUps.push("What would improve my score the most?");
  }

  if (lower.includes('cluster') || lower.includes('co-occur')) {
    followUps.push("What triggers my worst symptom clusters?");
    followUps.push("Which symptoms persist across flares?");
  }

  if (lower.includes('recover') || lower.includes('flare-free') || lower.includes('streak')) {
    followUps.push("What was I doing during my best period?");
    followUps.push("Give me a flare-free recipe based on my data");
  }

  if (lower.includes('exercise') || lower.includes('activity') || lower.includes('workout') || lower.includes('steps')) {
    followUps.push("Which exercise types are safest for me?");
    followUps.push("How do daily steps correlate with my flares?");
  }

  if (lower.includes('season') || lower.includes('month') || lower.includes('winter') || lower.includes('summer')) {
    followUps.push("Show me my seasonal flare pattern");
  }

  if (lower.includes('danger') || lower.includes('severe') || lower.includes('worst')) {
    followUps.push("What was different about my worst flare?");
    followUps.push("Which trigger combos are most dangerous?");
  }

  if (lower.includes('caffeine') || lower.includes('coffee')) {
    followUps.push("Does afternoon caffeine affect my sleep-flare lag?");
  }

  if (lower.includes('escalat') || lower.includes('acceleration') || lower.includes('burst')) {
    followUps.push("How many escalation windows and bursts have I had?");
    followUps.push("What breaks an escalation cycle for me?");
  }

  if (lower.includes('golden hour') || lower.includes('safe time') || lower.includes('heatmap')) {
    followUps.push("What am I doing differently during golden hours?");
  }

  if (lower.includes('weekend') || lower.includes('weekday')) {
    followUps.push("Are my weekend triggers different from weekday ones?");
    followUps.push("Compare weekend vs weekday severity averages");
  }

  if (lower.includes('location') || lower.includes('city')) {
    followUps.push("Which city has my highest average severity?");
  }

  if (lower.includes('hrv') || lower.includes('heart rate variability')) {
    followUps.push("Is my HRV trending up or down?");
    followUps.push("What's my HRV on flare days vs baseline?");
  }

  if (lower.includes('diversity') || lower.includes('variety')) {
    followUps.push("How can I improve my diet diversity?");
  }

  if (lower.includes('breakfast') || lower.includes('skip')) {
    followUps.push("Does skipping meals affect my flare risk?");
  }

  if (lower.includes('persist') || lower.includes('chronic') || lower.includes('ongoing')) {
    followUps.push("Which symptoms carry over between consecutive flares?");
  }

  if (lower.includes('polypharmacy') || lower.includes('multiple med')) {
    followUps.push("Should I discuss my medication schedule with my doctor?");
  }

  if (lower.includes('slope') || lower.includes('accelerat') || lower.includes('decelerat')) {
    followUps.push("Show me my severity and frequency slopes");
  }
  
  if (followUps.length < 3) {
    followUps.push("Show me my 30-day flare trend");
    followUps.push("What's my flare risk right now?");
    followUps.push("Surprise me with a pattern I don't know about");
  }
  
  return [...new Set(followUps)].slice(0, 4);
};
