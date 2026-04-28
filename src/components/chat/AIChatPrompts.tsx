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
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      {CAPABILITY_PROMPTS.map(({ icon: Icon, label, prompt, color }) => (
        <button
          key={label}
          onClick={() => onSendPrompt(prompt)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full",
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

// Dynamic follow-up suggestions written from the USER's perspective.
// Considers BOTH the AI's reply AND the user's preceding message so chips
// stay relevant to the actual conversation. Returns [] when nothing useful
// applies — better to show no chips than generic ones.
export const generateFollowUps = (
  aiResponse: string,
  hasCharts: boolean,
  userMessage: string = "",
): string[] => {
  const followUps: string[] = [];
  const ai = aiResponse.toLowerCase();
  const usr = userMessage.toLowerCase();
  const both = `${usr} ${ai}`;
  const has = (re: RegExp) => re.test(both);
  const add = (s: string) => { if (!followUps.includes(s)) followUps.push(s); };

  // Weather / environment
  if (has(/\b(weather|temp|temperature|humid|pressure|rain|forecast|aqi|pollen|sunny|cloudy|barometric)\b/)) {
    add("Does weather correlate with my flares?");
    add("Show me my flares on bad-weather days");
  }

  // Location-only
  if (has(/\b(here|near me|my city|nearby|location|in (sf|nyc|la|chicago|boston))\b/) && !has(/weather/)) {
    add("Do I flare more in this city?");
  }

  // Sleep / HRV / wearable
  if (has(/\b(sleep|rest|fatigue|tired|hrv|heart rate|steps|wearable)\b/)) {
    add("How does my sleep affect next-day flares?");
    add("Show me my HRV trend over 14 days");
  }

  // Medications
  if (has(/\b(medication|medicine|drug|dose|pill|insulin|prescribed|adher)\b/)) {
    add("I want to log that I took my medication");
    add("Which medication gives me the most flare-free days?");
  }

  // Food / diet
  if (has(/\b(food|diet|eat|ate|meal|calorie|breakfast|lunch|dinner|snack)\b/)) {
    add("I want to log a meal");
    add("Which foods appear before my worst flares?");
  }

  // Severity / trajectory
  if (has(/\b(severity|worse|better|trajectory|escalat|flare|symptom)\b/)) {
    add("Compare this week to last week");
    add("Am I in an escalation pattern?");
  }

  // Triggers / patterns
  if (has(/\b(trigger|pattern|correlation|cause|why)\b/)) {
    add("What are my top 3 confirmed triggers?");
    add("What protects me from flares?");
  }

  // Charts shown — offer to dig in
  if (hasCharts) {
    add("Break this down by severity");
    add("Compare to last month");
  }

  // Risk / prediction
  if (has(/\b(risk|predict|forecast|likelihood|chance)\b/)) {
    add("What can I do right now to lower my risk?");
  }

  // Health score
  if (has(/\b(health score|score)\b/)) {
    add("What's bringing my score down?");
  }

  // Recovery / streak
  if (has(/\b(recover|flare-free|streak|good day|best day)\b/)) {
    add("What was different during my best stretch?");
  }

  // Exercise
  if (has(/\b(exercise|workout|activity|gym|run|walk)\b/)) {
    add("I want to log a workout");
  }

  // Caffeine
  if (has(/\b(caffeine|coffee|espresso)\b/)) {
    add("Does afternoon caffeine affect my sleep?");
  }

  // Greeting / chit-chat → no follow-ups (keeps UI clean)
  if (
    followUps.length === 0 &&
    /^(hi|hey|hello|yo|sup|thanks|thank you|ok|okay|cool|nice|got it|lol|bye|gn|gm)\b/i.test(usr.trim())
  ) {
    return [];
  }

  // Last-resort fallbacks — only if we truly have nothing relevant.
  if (followUps.length === 0) {
    add("How am I doing this week?");
    add("What's my flare risk right now?");
    add("Log how I'm feeling");
  }

  return [...new Set(followUps)].slice(0, 4);
};
