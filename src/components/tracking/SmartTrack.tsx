import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Check, Sparkles, Thermometer, Droplets, Calendar, AlertTriangle, BarChart3, Activity, TrendingUp, Search, ExternalLink, Phone } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { FluidLogSelector } from "./FluidLogSelector";
import { CONDITIONS } from "@/data/conditions";
import { Badge } from "@/components/ui/badge";
import { useCorrelations } from "@/hooks/useCorrelations";
import { useEntryContext } from "@/hooks/useEntryContext";
import { DynamicChart, DynamicChartRenderer } from "@/components/chat/DynamicChartRenderer";
import { AIChatPrompts, generateFollowUps } from "@/components/chat/AIChatPrompts";
import { LiveActivityIndicator, ToolTimelineTag, predictToolActivities, completeActivities, ToolActivity, buildActivitiesFromKinds } from "@/components/chat/ToolActivityChips";

// No message splitting — AI controls its own length via system prompt


interface ProactiveFormField {
  id: string;
  label: string;
  type: 'single_select' | 'multi_select';
  options: { label: string; value: string; emoji?: string }[];
}

interface ProactiveForm {
  fields: ProactiveFormField[];
  closingMessage: string;
}

interface DiscoveryCard {
  factor: string;
  confidence: number;
  lift: number;
  occurrences: number;
  total: number;
  category: 'trigger' | 'protective' | 'investigating';
  summary?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  entryData?: Partial<FlareEntry>;
  isAIGenerated?: boolean;
  dataUsed?: string[];
  weatherUsed?: boolean;
  reaction?: string;
  weatherCard?: {
    location: string;
    country?: string;
    isHistorical?: boolean;
    historicalNote?: string;
    current: {
      temp_f: number;
      temp_c?: number;
      condition: string;
      icon?: string;
      humidity: number;
      uv?: number;
      feelslike_f: number;
    };
    forecast?: {
      date?: string;
      maxtemp_f: number;
      mintemp_f: number;
      condition: string;
      icon?: string;
      daily_chance_of_rain: number;
    };
    aqi?: number;
  };
  chartData?: {
    type: 'severity' | 'symptoms' | 'triggers' | 'timeline';
    data: any;
  };
  visualization?: DynamicChart;
  followUp?: string;
  dynamicFollowUps?: string[];
  // Proactive form from AI
  proactiveForm?: ProactiveForm;
  formCompleted?: boolean;
  formResponses?: Record<string, string | string[]>;

  // Research & citations
  citations?: Array<{ index: number; title: string; url: string }>;
  wasResearched?: boolean;

  // Discovery cards
  discoveryCards?: DiscoveryCard[];
  toolActivities?: ToolActivity[];

  updateInfo?: {
    entryId: string;
    updates: Partial<FlareEntry>;
  };
  activityDetected?: {
    type: string;
    intensity: string;
  };
  correlationWarning?: {
    triggerType: string;
    triggerValue: string;
    outcomeType: string;
    outcomeValue: string;
    occurrenceCount: number;
    confidence: number;
    avgDelayMinutes: number;
  };
}

interface MedicationDetails {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

// Re-export SmartTrackable from FluidLogSelector
import type { SmartTrackable } from "./FluidLogSelector";
type CustomTrackable = SmartTrackable;

interface SmartTrackProps {
  onSave: (entry: Partial<FlareEntry>) => Promise<boolean>;
  onUpdateEntry?: (entryId: string, updates: Partial<FlareEntry>) => void;
  userSymptoms?: string[];
  userConditions?: string[];
  userTriggers?: string[];
  userMedications?: MedicationDetails[];
  aiLogCategories?: any[];
  customTrackables?: CustomTrackable[];
  onAddTrackable?: (trackable: CustomTrackable) => void;
  onRemoveTrackable?: (trackableId: string) => void;
  onReorderTrackables?: (trackables: CustomTrackable[]) => void;
  onAddMedication?: (med: MedicationDetails) => void;
  onRemoveMedication?: (medName: string) => void;
  onAddSymptom?: (symptom: string) => void;
  onRemoveSymptom?: (symptom: string) => void;
  userName?: string | null;
  userDOB?: string | null;
  userBiologicalSex?: string | null;
  recentEntries?: any[];
  userId: string;
  onOpenDetails?: () => void;
  onOpenFood?: () => void;
  onOpenVoiceCall?: () => void;
  onNavigateToTrends?: () => void;
  aiConsented?: boolean;
  onRequestAIConsent?: () => void;
}

export interface SmartTrackRef {
  addDetailedEntry: (entry: Partial<FlareEntry>) => void;
  sendChatMessage: (message: string) => void;
  addFoodLogMessage: (foodName: string, calories: number, mealType: string) => void;
}

const STORAGE_KEY = 'jvala_smart_chat';

// Module-level chat cache to persist across tab switches (in-memory only, not localStorage)
const chatCache = new Map<string, ChatMessage[]>();

const getPersonalizedGreeting = (conditions: string[], recentEntries: any[], userName?: string | null): string => {
  const hour = new Date().getHours();
  const name = userName?.split(' ')[0] || '';
  const nameStr = name ? `, ${name}` : '';
  
  // Check recent activity
  const today = new Date();
  const todayStr = today.toDateString();
  const todayEntries = recentEntries.filter(e => new Date(e.timestamp || e.created_at).toDateString() === todayStr);
  const lastEntry = recentEntries[0];
  const lastSeverity = lastEntry?.severity;
  const daysSinceLastLog = lastEntry ? Math.floor((Date.now() - new Date(lastEntry.timestamp || lastEntry.created_at).getTime()) / 86400000) : null;
  
  // Condition-aware context
  const conditionName = conditions[0] || '';
  
  if (hour < 6) {
    if (lastSeverity === 'severe') return `Up early${nameStr}? Hope you're feeling better after that rough one. How's the night been?`;
    return `Late night${nameStr}? If something woke you up, let's log it while it's fresh.`;
  }
  
  if (hour < 12) {
    if (todayEntries.length > 0) return `Already logging today${nameStr} — great discipline. Anything new to track?`;
    if (daysSinceLastLog !== null && daysSinceLastLog >= 3) return `Hey${nameStr}, it's been ${daysSinceLastLog} days. How have things been? Even a quick check-in helps your AI learn.`;
    if (lastSeverity === 'severe') return `Morning${nameStr}. Yesterday was tough — how are you feeling today? Any overnight changes?`;
    if (lastSeverity === 'mild') return `Morning${nameStr}! Things were looking good yesterday. Let's keep tracking that progress.`;
    return `Morning${nameStr}! How did you sleep? Start your day with a quick check-in.`;
  }
  
  if (hour < 17) {
    if (todayEntries.length > 0) return `Afternoon check${nameStr}. Anything shift since this morning?`;
    if (daysSinceLastLog !== null && daysSinceLastLog >= 2) return `Haven't heard from you in a bit${nameStr}. Drop a quick log — even "feeling fine" is data your AI can use.`;
    return `Afternoon${nameStr}. How's the day going? Any changes worth noting?`;
  }
  
  if (hour < 21) {
    if (todayEntries.length === 0) return `Evening${nameStr}! Don't forget to log today — your streak thanks you. How was your day?`;
    return `Wrapping up the day${nameStr}. Any evening symptoms or just checking in?`;
  }
  
  // Night
  if (todayEntries.length === 0) return `Still time to log today${nameStr}. A quick entry before bed keeps your data complete.`;
  return `Winding down${nameStr}. Anything to note before bed? Sleep quality matters for your patterns.`;
};

// Proactive AI Form Card
const ProactiveFormCard = ({ 
  form, completed, responses, onRespond 
}: { 
  form: ProactiveForm; 
  completed: boolean; 
  responses: Record<string, string | string[]>;
  onRespond: (fieldId: string, value: string | string[]) => void;
}) => {
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  if (completed) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground animate-in fade-in duration-300">
        <Check className="w-3 h-3 text-green-500" />
        <span>Check-in complete</span>
      </div>
    );
  }

  const currentFieldIndex = form.fields.findIndex(f => !responses[f.id]);
  const currentField = form.fields[currentFieldIndex];
  if (!currentField) return null;

  const handleCustomSubmit = () => {
    const val = customInput.trim();
    if (!val) return;
    onRespond(currentField.id, val);
    setCustomInput('');
    setShowCustom(false);
  };

  return (
    <div className="mt-2 max-w-[85%] animate-in slide-in-from-bottom-2 duration-300">
      {form.fields.length > 1 && (
        <div className="flex gap-1 mb-2">
          {form.fields.map((f, i) => (
            <div
              key={f.id}
              className={cn(
                "h-1 rounded-full flex-1 transition-all duration-300",
                i < currentFieldIndex ? "bg-primary" :
                i === currentFieldIndex ? "bg-primary/60" : "bg-muted"
              )}
            />
          ))}
        </div>
      )}

      <p className="text-xs font-medium text-foreground mb-2">{currentField.label}</p>
      
      <div className="flex flex-wrap gap-1.5">
        {currentField.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setShowCustom(false); onRespond(currentField.id, opt.value); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                "bg-card/80 border border-border/50",
                "hover:bg-primary/10 hover:border-primary/30 active:scale-95",
                "shadow-sm"
            )}
          >
            {opt.emoji && <span className="mr-1">{opt.emoji}</span>}
            {opt.label}
          </button>
        ))}
        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              "bg-card/80 border border-dashed border-border/50",
              "hover:bg-primary/10 hover:border-primary/30 active:scale-95",
              "shadow-sm text-muted-foreground"
            )}
          >
            + Other
          </button>
        ) : (
          <div className="flex items-center gap-1.5 w-full mt-1">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Type your own..."
              className="h-7 text-xs flex-1"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCustomSubmit} disabled={!customInput.trim()}>
              <Check className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Weather card component
const WeatherCard = ({ weather }: { weather: ChatMessage['weatherCard'] }) => {
  if (!weather) return null;
  
  return (
    <Card className={cn(
      "p-3 border-0 mt-2",
      weather.isHistorical 
        ? "bg-gradient-to-br from-amber-500/10 to-orange-500/10"
        : "bg-gradient-to-br from-blue-500/10 to-purple-500/10"
    )}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{weather.location}{weather.country ? `, ${weather.country}` : ''}</p>
            {weather.isHistorical && (
              <Badge variant="outline" className="text-[10px] h-4 bg-amber-500/10">
                <Calendar className="w-2.5 h-2.5 mr-1" />
                Historical
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Thermometer className="w-4 h-4 text-orange-500" />
            <span className="text-lg font-bold">{weather.current?.temp_f}°F</span>
            {!weather.isHistorical && (
              <span className="text-xs text-muted-foreground">Feels {weather.current?.feelslike_f}°F</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{weather.current?.condition}</p>
          {weather.historicalNote && (
            <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {weather.historicalNote}
            </p>
          )}
        </div>
        <div className="text-right text-xs space-y-1">
          <div className="flex items-center gap-1 justify-end">
            <Droplets className="w-3 h-3 text-blue-400" />
            <span>{weather.current?.humidity}%</span>
          </div>
          {weather.aqi && (
            <div className="flex items-center gap-1 justify-end">
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                weather.aqi <= 2 ? "bg-green-500/20 text-green-600" :
                weather.aqi <= 4 ? "bg-yellow-500/20 text-yellow-600" :
                "bg-red-500/20 text-red-600"
              )}>
                AQI {weather.aqi}
              </span>
            </div>
          )}
        </div>
      </div>
      {weather.forecast && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{weather.forecast.date || 'Today'}</span>
          <span>H: {weather.forecast.maxtemp_f}° L: {weather.forecast.mintemp_f}°</span>
          {weather.forecast.daily_chance_of_rain > 0 && (
            <span className="text-blue-400">{weather.forecast.daily_chance_of_rain}% rain</span>
          )}
        </div>
      )}
    </Card>
  );
};

// Mini chart for severity/symptoms
const MiniChart = ({ chartData }: { chartData: ChatMessage['chartData'] }) => {
  if (!chartData) return null;
  
  if (chartData.type === 'severity') {
    const { severe = 0, moderate = 0, mild = 0 } = chartData.data || {};
    const total = severe + moderate + mild;
    if (total === 0) return null;
    
    return (
      <Card className="p-3 border-0 mt-2 bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">Severity Breakdown</span>
        </div>
        <div className="flex gap-1 h-6 rounded overflow-hidden">
          {severe > 0 && (
            <div 
              className="bg-severity-severe flex items-center justify-center text-[10px] font-medium text-white"
              style={{ width: `${(severe / total) * 100}%` }}
            >
              {severe}
            </div>
          )}
          {moderate > 0 && (
            <div 
              className="bg-severity-moderate flex items-center justify-center text-[10px] font-medium text-white"
              style={{ width: `${(moderate / total) * 100}%` }}
            >
              {moderate}
            </div>
          )}
          {mild > 0 && (
            <div 
              className="bg-severity-mild flex items-center justify-center text-[10px] font-medium"
              style={{ width: `${(mild / total) * 100}%` }}
            >
              {mild}
            </div>
          )}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>🔴 Severe: {severe}</span>
          <span>🟠 Moderate: {moderate}</span>
          <span>🟡 Mild: {mild}</span>
        </div>
      </Card>
    );
  }
  
  if (chartData.type === 'symptoms' || chartData.type === 'triggers') {
    const items = chartData.data || [];
    if (items.length === 0) return null;
    
    return (
      <Card className="p-3 border-0 mt-2 bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">Top {chartData.type === 'symptoms' ? 'Symptoms' : 'Triggers'}</span>
        </div>
        <div className="space-y-1.5">
          {items.slice(0, 4).map(([name, count]: [string, number], i: number) => (
            <div key={name} className="flex items-center gap-2">
              <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded transition-all",
                    chartData.type === 'symptoms' ? 'bg-primary/70' : 'bg-orange-500/70'
                  )}
                  style={{ width: `${(count / items[0][1]) * 100}%` }}
                />
              </div>
              <span className="text-[10px] w-20 truncate">{name}</span>
              <span className="text-[10px] text-muted-foreground w-6 text-right">{count}x</span>
            </div>
          ))}
        </div>
      </Card>
    );
  }
  
  return null;
};

export const SmartTrack = forwardRef<SmartTrackRef, SmartTrackProps>(({ 
  onSave,
  onUpdateEntry,
  userSymptoms = [], 
  userConditions = [], 
  userTriggers = [],
  userMedications = [],
  aiLogCategories = [],
  customTrackables = [],
  onAddTrackable,
  onRemoveTrackable,
  onReorderTrackables,
  onAddMedication,
  onRemoveMedication,
  onAddSymptom,
  onRemoveSymptom,
  userName,
  userDOB,
  userBiologicalSex,
  recentEntries = [],
  userId,
  onOpenDetails,
  onOpenFood,
  onOpenVoiceCall,
  onNavigateToTrends,
  aiConsented,
  onRequestAIConsent,
}, ref) => {
  const [messages, _setMessages] = useState<ChatMessage[]>(() => chatCache.get(userId) || []);
  // Wrap setMessages to also update the module-level cache
  const setMessages: typeof _setMessages = (update) => {
    _setMessages(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      chatCache.set(userId, next);
      return next;
    });
  };
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; city?: string } | null>(null);
  const [lastLoggedEntryId, setLastLoggedEntryId] = useState<string | null>(null);
  const [pendingFollowUp, setPendingFollowUp] = useState<{ activityType: string; activityId: string; followUpTime: Date } | null>(null);
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const hasLoadedMessages = useRef(false);
  
  // Use correlations hook
  const { topCorrelations, pendingFollowUps, getCorrelationsForTrigger } = useCorrelations(userId);
  
  // Use entry context hook for unified environmental + wearable data
  const { getEntryContext, hasWearableConnected, currentWearableData } = useEntryContext();

  // Background discovery engine: runs analysis after each log
  const runDiscoveryAnalysis = async () => {
    try {
      // Run discovery analysis
      const { data, error } = await supabase.functions.invoke('correlation-engine', {
        body: {
          action: 'deep_analysis',
          data: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        },
      });
      if (error) { console.warn('Discovery analysis error:', error); return; }
      
      // Background model update: trigger pattern-learner for continuous model refinement
      supabase.functions.invoke('pattern-learner', {
        body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      }).catch(e => console.warn('[PatternLearner] Background update error:', e));
      
      // Surface new discoveries in chat
      const newDiscoveries = data?.newDiscoveries || [];
      if (newDiscoveries.length > 0) {
        const discoveryIds = newDiscoveries.map((d: any) => d.id);
        
        // Mark them as surfaced
        await supabase.functions.invoke('correlation-engine', {
          body: { action: 'mark_surfaced', data: { discoveryIds } },
        });

        // Show discovery cards in chat as structured visual cards
        const cards: DiscoveryCard[] = newDiscoveries.slice(0, 3).map((disc: any) => {
          const confPct = Math.round((disc.confidence || 0) * 100);
          const category: 'trigger' | 'protective' | 'investigating' = 
            disc.relationship === 'decreases_risk' ? 'protective' :
            disc.status === 'investigating' || disc.status === 'emerging' ? 'investigating' : 'trigger';
          
          return {
            factor: disc.factor_a?.replace(/^(tod:|dow:|pressure:|temperature:|weather_condition:)/, '').replace(/_/g, ' '),
            confidence: confPct,
            lift: disc.lift || 1,
            occurrences: disc.occurrence_count,
            total: disc.total_exposures,
            category,
            summary: disc.evidence_summary?.split('.')[0] || `${disc.occurrence_count}/${disc.total_exposures} times a flare followed`,
          };
        });

        if (cards.length > 0) {
          const discoveryMessage: ChatMessage = {
            id: Date.now().toString() + Math.random(),
            role: 'assistant',
            content: cards.length === 1 
              ? `New pattern detected — **${cards[0].factor}** is linked to your flares.`
              : `Found ${cards.length} new patterns in your data:`,
            timestamp: new Date(),
            isAIGenerated: true,
            discoveryCards: cards,
          };
          setMessages(prev => [...prev, discoveryMessage]);
        }
      }
    } catch (e) {
      console.warn('Discovery engine background error:', e);
    }
  };

  // Debounced analysis: run 5 seconds after last log to batch rapid logs
  const analysisTimerRef = useRef<number | null>(null);
  const scheduleAnalysis = () => {
    if (analysisTimerRef.current) window.clearTimeout(analysisTimerRef.current);
    analysisTimerRef.current = window.setTimeout(runDiscoveryAnalysis, 5000);
  };

  // Proactive checkin — show INSTANT local greeting, then append edge response as a follow-up
  useEffect(() => {
    if (hasLoadedMessages.current) return;
    hasLoadedMessages.current = true;

    const cached = chatCache.get(userId);
    if (cached && cached.length > 0) return;

    // 1. Render local greeting IMMEDIATELY (<50ms perceived latency)
    const localGreeting = getPersonalizedGreeting(userConditions, recentEntries, userName);
    const greetingId = `greeting-${Date.now()}`;
    setMessages([{
      id: greetingId,
      role: 'assistant',
      content: localGreeting,
      timestamp: new Date(),
    }]);

    // 2. In parallel, fetch context-aware proactive message and APPEND as a 2nd message
    const fetchProactive = async () => {
      try {
        const { data } = await supabase.functions.invoke('proactive-checkin', {
          body: {
            clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });

        const edgeMessages: string[] = data?.messages || (data?.message ? [data.message] : []);
        if (edgeMessages.length === 0) return;

        // Skip if edge response is essentially the same as the local greeting
        const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const isDuplicate = edgeMessages.some(m => normalize(m) === normalize(localGreeting));
        if (isDuplicate && !data?.form) return;

        const followUpMessages: ChatMessage[] = edgeMessages.map((msg: string, i: number) => ({
          id: `proactive-${Date.now()}-${i}`,
          role: 'assistant' as const,
          content: msg,
          timestamp: new Date(Date.now() + 100 + i),
          proactiveForm: i === 0 ? (data?.form || undefined) : undefined,
          isAIGenerated: true,
        }));

        // APPEND (do not replace) — local greeting stays visible
        setMessages(prev => [...prev, ...followUpMessages]);
      } catch (e) {
        // Silent fail — local greeting is already shown, no degradation
        console.log('[ProactiveCheckin] Edge fetch failed, local greeting remains:', e);
      }
    };

    // Brief delay so the local greeting renders first and feels instantaneous
    setTimeout(fetchProactive, 600);
  }, [userId, userConditions, recentEntries, aiConsented, userName]);

  useEffect(() => {
    const getLocation = async () => {
      try {
        const { getCurrentLocation, fetchWeatherData } = await import("@/services/weatherService");
        const location = await getCurrentLocation();
        if (location) {
          setCurrentLocation(location);
          const weatherData = await fetchWeatherData(location.latitude, location.longitude);
          if (weatherData?.location?.city) {
            setCurrentLocation(prev => prev ? { ...prev, city: weatherData.location.city } : null);
          }
        }
      } catch (e) {
        console.log('Could not get location');
      }
    };
    getLocation();
  }, []);

  useImperativeHandle(ref, () => ({
    addDetailedEntry: (entry: Partial<FlareEntry>) => {
      const parts: string[] = [];
      if (entry.type) parts.push(`[${entry.type.toUpperCase()}]`);
      if (entry.severity) parts.push(`Severity: ${entry.severity}`);
      if (entry.symptoms?.length) parts.push(`Symptoms: ${entry.symptoms.join(', ')}`);
      if (entry.medications?.length) parts.push(`Meds: ${entry.medications.join(', ')}`);
      if (entry.triggers?.length) parts.push(`Triggers: ${entry.triggers.join(', ')}`);
      if (entry.energyLevel) parts.push(`Energy: ${entry.energyLevel}`);
      if (entry.note) parts.push(`Note: ${entry.note}`);

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: parts.join(' • '),
        timestamp: new Date(),
      };

      const confirmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Detailed entry logged! I'll factor this into your pattern analysis.",
        timestamp: new Date(),
        entryData: entry,
      };

      setMessages(prev => [...prev, userMessage, confirmMessage]);
    },
    sendChatMessage: (message: string) => {
      handleSend(message);
    },
    addFoodLogMessage: (foodName: string, calories: number, mealType: string) => {
      const emoji = mealType === 'breakfast' ? '🌅' : mealType === 'lunch' ? '☀️' : mealType === 'dinner' ? '🌙' : '🍿';
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: `${emoji} Logged ${mealType}: ${foodName}`,
        timestamp: new Date(),
      };
      const confirmMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `✓ ${foodName} · ${calories} kcal`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg, confirmMsg]);
    }
  }));

  // No localStorage persistence — health data stays in-memory only for privacy

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!window.visualViewport) return;

    const updateKeyboardInset = () => {
      const viewport = window.visualViewport;
      const nextInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(nextInset > 80 ? nextInset : 0);

      if (messagesContainerRef.current) {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        });
      }
    };

    updateKeyboardInset();
    window.visualViewport.addEventListener('resize', updateKeyboardInset);
    window.visualViewport.addEventListener('scroll', updateKeyboardInset);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardInset);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardInset);
    };
  }, []);

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  // ── Smart response system: every log gets EITHER a reaction OR a text response ──
  const reactionCountRef = useRef(0); // track total reactions given this session
  const lastReactionTimeRef = useRef(0);

  // Determine if a log label represents something negative/sensitive
  const isNegativeContext = (label: string): boolean => {
    const negativePatterns = /depression|depressive|anxiety|panic|sad|pain|migraine|headache|nausea|fatigue|exhausted|cramp|attack|episode|flare|severe|hurt|ache|dizzy|vomit|insomnia|stress|irritable|angry|cry|breakdown|suicidal|self.harm/i;
    return negativePatterns.test(label);
  };

  const getResponseStrategy = (logLabel: string, recentSameCount: number): { reaction: string; text: string } => {
    const now = Date.now();
    const recentUserMsgs = messages.filter(m => m.role === 'user' && (now - m.timestamp.getTime()) < 5 * 60 * 1000);
    const rapidFire = recentUserMsgs.length >= 3;
    const veryRapid = recentUserMsgs.length >= 5;
    const negative = isNegativeContext(logLabel);
    
    // Reaction fatigue: max 4 reactions in 10 min window, then text only for a bit
    const timeSinceLastReaction = now - lastReactionTimeRef.current;
    const reactionFatigue = reactionCountRef.current >= 4 && timeSinceLastReaction < 10 * 60 * 1000;
    if (timeSinceLastReaction > 10 * 60 * 1000) reactionCountRef.current = 0;

    const giveReaction = (pool: string[]): { reaction: string; text: string } => {
      const emoji = pool[Math.floor(Math.random() * pool.length)];
      reactionCountRef.current++;
      lastReactionTimeRef.current = now;
      return { reaction: emoji, text: '' };
    };

    // 5+ same item rapidly → always text commentary
    if (veryRapid && recentSameCount >= 4) {
      const texts = negative
        ? [
            `${recentSameCount + 1}x ${logLabel.toLowerCase()} — I'm keeping track. hang in there 💜`,
            `noted, ${recentSameCount + 1} ${logLabel.toLowerCase()} logs. take care of yourself.`,
          ]
        : [
            `whoa — ${recentSameCount + 1}x ${logLabel.toLowerCase()} in a few minutes, you good? 😅`,
            `${logLabel} #${recentSameCount + 1} — I'm keeping track but maybe slow down a bit 👀`,
          ];
      return { reaction: '', text: texts[Math.floor(Math.random() * texts.length)] };
    }
    // 3+ rapid → text about the pattern
    if (rapidFire && recentSameCount >= 2) {
      const texts = [
        `${recentSameCount + 1}x ${logLabel.toLowerCase()} — noted, watching this pattern`,
        `that's a lot of ${logLabel.toLowerCase()} recently — ${recentSameCount + 1} and counting`,
      ];
      return { reaction: '', text: texts[Math.floor(Math.random() * texts.length)] };
    }
    // Repeat log (2nd or 3rd) → 60% reaction, 40% text
    if (recentSameCount >= 1 && recentSameCount < 4) {
      if (Math.random() < 0.6 && !reactionFatigue) {
        // Context-aware reactions: gentle for negative, encouraging for positive
        const pool = negative ? ['👍', '💜', '🫂'] : ['👀', '😏', '🫡', '💪'];
        return giveReaction(pool);
      }
      return { reaction: '', text: `another ${logLabel.toLowerCase()} — noted` };
    }
    // First log → 50% reaction, 50% short text
    if (!reactionFatigue && Math.random() < 0.5) {
      // Context-aware: NO celebratory emojis (🔥👏) for negative health events
      const pool = negative ? ['👍', '💜', '🫂', '🤍'] : ['👍', '💪', '🔥', '👏', '✌️', '🫡'];
      return giveReaction(pool);
    }
    const shortTexts = negative 
      ? [`noted`, `logged — hang in there`, `got it 💜`, `tracked`]
      : [`got it`, `logged`, `noted`, `tracked`];
    return { reaction: '', text: shortTexts[Math.floor(Math.random() * shortTexts.length)] };
  };

  const countRecentSameType = (label: string): number => {
    const now = Date.now();
    return messages.filter(m => {
      if (m.role !== 'user') return false;
      if (now - m.timestamp.getTime() > 2 * 60 * 60 * 1000) return false;
      return m.content.toLowerCase().includes(label.toLowerCase());
    }).length;
  };

  const handleFluidLog = async (symptom: string, severity: string) => {
    if (severity === 'severe') haptics.heavy();
    else if (severity === 'moderate') haptics.medium();
    else haptics.light();

    const { reaction, text: responseText } = getResponseStrategy(symptom, countRecentSameType(symptom));
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `${severity} ${symptom}`,
      timestamp: new Date(),
      reaction,
    };
    setMessages(prev => [...prev, userMessage]);

    if (reaction) {
      setTimeout(() => { import('@/lib/haptics').then(({ haptics }) => haptics.light()); }, 400);
    }

    const entry: Partial<FlareEntry> = {
      type: 'flare',
      severity: severity as 'mild' | 'moderate' | 'severe',
      symptoms: [symptom],
      timestamp: new Date(),
    };

    try {
      const contextData = await getEntryContext();
      if (contextData.environmentalData) entry.environmentalData = contextData.environmentalData;
      if (contextData.physiologicalData) entry.physiologicalData = contextData.physiologicalData;
    } catch (e) {
      console.log('Could not get context data:', e);
    }

    const saved = await onSave(entry);
    const entryId = Date.now().toString();
    setLastLoggedEntryId(entryId);

    if (saved) {
      if (severity === 'severe') {
        haptics.heavy();
        setTimeout(() => haptics.success(), 140);
      } else {
        haptics.success();
      }
    } else {
      haptics.warning();
    }

    // Trigger background discovery analysis
    scheduleAnalysis();

    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: saved
        ? (responseText || `Saved ${severity} ${symptom}.`)
        : `Couldn't save that — please try again.`,
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleMedicationLog = async (medicationName: string) => {
    haptics.medium();
    const { reaction, text: responseText } = getResponseStrategy(medicationName, countRecentSameType(medicationName));
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `Took ${medicationName}`,
      timestamp: new Date(),
      reaction,
    };
    setMessages(prev => [...prev, userMessage]);
    if (reaction) setTimeout(() => { import('@/lib/haptics').then(({ haptics }) => haptics.light()); }, 400);

    const entry: Partial<FlareEntry> = {
      type: 'medication',
      medications: [medicationName],
      note: `Took ${medicationName}`,
      timestamp: new Date(),
    };
    const saved = await onSave(entry);
    if (saved) haptics.success();
    else haptics.warning();

    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responseText || `${medicationName} logged.`,
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleWellnessLog = async () => {
    haptics.light();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: 'Feeling good!',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    const entry: Partial<FlareEntry> = {
      type: 'wellness',
      energyLevel: 'high',
      note: 'Feeling good',
      timestamp: new Date(),
    };
    const saved = await onSave(entry);
    if (saved) haptics.success();

    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: "Great to hear! Logged.",
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleEnergyLog = async (level: 'low' | 'moderate' | 'high') => {
    if (level === 'low') haptics.medium();
    else if (level === 'high') haptics.light();
    else haptics.selection();

    const labels = { low: 'Low energy', moderate: 'Moderate energy', high: 'High energy' };
    const { reaction, text: responseText } = getResponseStrategy('energy', countRecentSameType('energy'));
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: labels[level],
      timestamp: new Date(),
      reaction,
    };
    setMessages(prev => [...prev, userMessage]);
    if (reaction) setTimeout(() => { import('@/lib/haptics').then(({ haptics }) => haptics.light()); }, 400);

    const entry: Partial<FlareEntry> = {
      type: 'energy',
      energyLevel: level === 'high' ? 'high' : level === 'moderate' ? 'moderate' : 'low',
      note: labels[level],
      timestamp: new Date(),
    };
    const saved = await onSave(entry);
    if (saved) haptics.success();

    const responses: Record<string, string> = {
      low: "Logged low energy. Take it easy.",
      moderate: "Noted — pace yourself!",
      high: "Great energy! Make the most of it.",
    };

    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responseText || responses[level],
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

    const handleCustomLog = async (trackableLabel: string, value?: string) => {
    // Extract a clean display value from the logMessage template output
    const cleanValue = value 
      ? value.replace(/^Logged\s+/i, '').replace(new RegExp(`^${trackableLabel}:\\s*`, 'i'), '')
      : null;
    const displayText = cleanValue || trackableLabel;
    
    // Find the trackable config for icon/color metadata
    const trackable = customTrackables.find(t => t.label === trackableLabel);
    const trackableType = `trackable:${trackableLabel.toLowerCase().replace(/\s+/g, '_')}`;

    // Count recent logs of same trackable in last 2 hours
    // Search for BOTH the trackable label AND the display text to catch matches
    const searchTerms = [trackableLabel.toLowerCase(), displayText.toLowerCase()];
    const recentSameType = messages.filter(m => {
      if (m.role !== 'user') return false;
      const age = Date.now() - m.timestamp.getTime();
      if (age > 2 * 60 * 60 * 1000) return false;
      const lc = m.content.toLowerCase();
      return searchTerms.some(term => lc.includes(term));
    }).length;

    // Get response strategy: reaction OR text, never nothing
    const { reaction, text: responseText } = getResponseStrategy(trackableLabel, recentSameType);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: displayText,
      timestamp: new Date(),
      reaction,
    };
    setMessages(prev => [...prev, userMessage]);

    // Trigger haptic for the reaction pop-in
    if (reaction) {
      setTimeout(() => {
        import('@/lib/haptics').then(({ haptics }) => haptics.light());
      }, 400);
    }

    const entry: Partial<FlareEntry> = {
      type: trackableType,
      note: JSON.stringify({
        trackableLabel,
        value: cleanValue || trackableLabel,
        icon: trackable?.icon || 'activity',
        color: trackable?.color || 'hsl(250 60% 55%)',
        interactionType: trackable?.interactionType,
      }),
      timestamp: new Date(),
    };

    // Get context data for custom trackables too
    try {
      const contextData = await getEntryContext();
      if (contextData.environmentalData) entry.environmentalData = contextData.environmentalData;
      if (contextData.physiologicalData) entry.physiologicalData = contextData.physiologicalData;
    } catch (e) { /* silent */ }

    onSave(entry);
    scheduleAnalysis();

    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responseText, // may be empty if reaction was given instead
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleMoodLog = async (mood: string) => {
    const moodLabels: Record<string, string> = {
      happy: '😊 Happy',
      calm: '😌 Calm',
      anxious: '😰 Anxious',
      sad: '😢 Sad',
      irritable: '😤 Irritable',
      tired: '😴 Tired',
    };
    const label = moodLabels[mood] || mood;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `Mood: ${label}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    const entry: Partial<FlareEntry> = {
      type: 'wellness',
      note: `Mood: ${label}`,
      context: { mood },
      timestamp: new Date(),
    };

    try {
      const contextData = await getEntryContext();
      if (contextData.environmentalData) entry.environmentalData = contextData.environmentalData;
      if (contextData.physiologicalData) entry.physiologicalData = contextData.physiologicalData;
    } catch (e) { /* silent */ }

    onSave(entry);

    const responses: Record<string, string> = {
      happy: "Great mood! Logged. 🌟",
      calm: "Feeling calm — logged.",
      anxious: "Noted your anxiety. Take a deep breath. 💙",
      sad: "Sorry you're feeling down. Logged. 💜",
      irritable: "Frustration noted. Hope it passes. 🫂",
      tired: "Tiredness logged. Rest up!",
    };

    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responses[mood] || `Mood logged: ${label}`,
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleRecoveryLog = async () => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: 'Feeling better',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    const entry: Partial<FlareEntry> = {
      type: 'recovery',
      note: 'Feeling better',
      timestamp: new Date(),
    };
    onSave(entry);

    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: "Glad you're recovering! Logged.",
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isProcessing) return;

    // AI consent is implied by accepting terms of service

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    clearRecording();
    setIsProcessing(true);
    
    // Show predicted tool activity chips immediately (heuristic)
    const predicted = predictToolActivities(text);
    setToolActivities(predicted);

    try {
      // Single unified AI call — chat-assistant has ALL data access
      const { data: aiData, error: aiError } = await supabase.functions.invoke('chat-assistant', {
        body: {
          message: text,
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          history: messages.slice(-20).map(m => ({
            role: m.role === 'system' ? 'assistant' : m.role,
            content: m.content + (m.entryData ? ` [LOG: ${m.entryData.type}${m.entryData.severity ? ' ' + m.entryData.severity : ''}]` : ''),
          })),
          latitude: currentLocation?.latitude,
          longitude: currentLocation?.longitude,
          city: currentLocation?.city,
        },
      });

      if (aiError) throw aiError;

      let responseContent = (aiData?.response || "").trim();
      if (!responseContent) responseContent = "Tell me more.";
      
      // Build REAL tool activity chips from what the AI actually used
      const realTools: import("@/components/chat/ToolActivityChips").ToolKind[] = [];
      const toolsUsed: string[] = aiData?.toolsUsed || [];
      // Map backend toolsUsed to ToolKind
      if (toolsUsed.includes('logs') || toolsUsed.includes('reading_logs')) realTools.push('reading_logs');
      if (toolsUsed.includes('memories') || toolsUsed.includes('reading_memories')) realTools.push('reading_memories');
      if (toolsUsed.includes('patterns') || toolsUsed.includes('analyzing_patterns')) realTools.push('analyzing_patterns');
      if (toolsUsed.includes('wearable') || toolsUsed.includes('wearable_data')) realTools.push('wearable_data');
      if (toolsUsed.includes('medications') || toolsUsed.includes('medication_check')) realTools.push('medication_check');
      if (toolsUsed.includes('history') || toolsUsed.includes('symptom_history')) realTools.push('symptom_history');
      if (aiData?.wasResearched) realTools.push('researching_web');
      if (aiData?.weatherCard || aiData?.weatherData || toolsUsed.includes('weather')) realTools.push('weather');
      // Deduplicate
      const uniqueTools = [...new Set(realTools)];
      // If backend reports nothing was used, leave the list empty —
      // the timeline tag simply won't render. No fake "thinking" actions.
      
      const summaries: Partial<Record<import("@/components/chat/ToolActivityChips").ToolKind, string>> = {};
      if (aiData?.wasResearched) summaries.researching_web = `${aiData?.citations?.length || 0} sources cited`;
      if (aiData?.weatherCard) summaries.weather = `${aiData.weatherCard?.location} — ${aiData.weatherCard?.current?.temp_f}°F`;
      if (aiData?.visualization) uniqueTools.push('building_chart');

      // Carry user-message-specific labels from prediction so the timeline reads
      // "Reading flares from last 30 days" instead of generic "Read your logs".
      const customLabels: Partial<Record<import("@/components/chat/ToolActivityChips").ToolKind, string>> = {};
      for (const p of predicted) {
        if (!customLabels[p.kind]) customLabels[p.kind] = p.label;
      }

      const finalActivities = buildActivitiesFromKinds([...new Set(uniqueTools)], 'done', summaries, customLabels);
      setToolActivities(finalActivities);

      // Single message — AI controls its own length via system prompt
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        isAIGenerated: true,
        entryData: aiData?.entryData ?? undefined,
        visualization: aiData?.visualization ?? undefined,
        weatherCard: aiData?.weatherCard ?? undefined,
        citations: aiData?.citations ?? [],
        wasResearched: aiData?.wasResearched ?? false,
        toolActivities: finalActivities,
        discoveryCards: (aiData?.discoveries || []).map((d: any) => ({
          factor: d.factor,
          confidence: d.confidence,
          lift: d.lift || 1,
          occurrences: d.occurrences,
          total: d.total,
          category: d.category || 'trigger',
          summary: d.summary,
        })).filter((d: any) => d.factor),
        dynamicFollowUps: aiData?.dynamicFollowUps ?? [],
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Log entry if AI detected health data
      if (aiData?.shouldLog && aiData?.entryData) {
        const contextData = await getEntryContext();
        const entry: Partial<FlareEntry> = {
          ...aiData.entryData,
          note: text,
          timestamp: new Date(),
          environmentalData: contextData.environmentalData || undefined,
          physiologicalData: contextData.physiologicalData || undefined,
        };
        await onSave(entry);
        scheduleAnalysis();
      }
    } catch (error: any) {
      console.error('Chat error details:', error?.message || error, JSON.stringify(error));
      setToolActivities(prev => prev.map(a => ({ ...a, status: 'error' as const })));
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Something went wrong: ${error?.message || 'Unknown error'}. Basic logging still works!`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      // Activities now live on the assistant message via ToolTimelineTag.
      setToolActivities([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      clearRecording();
      startRecording();
    }
  };

  // Always generate follow-ups from the user's POV on the frontend.
  // Edge-function suggestions can read like the AI is asking the user
  // (e.g. "Have you restarted your insulin aspart?") — those belong in
  // the chat itself, not in the suggestion chips.
  const lastAssistantIdx = [...messages].map(m => m.role).lastIndexOf('assistant');
  const lastAssistantMessage = lastAssistantIdx >= 0 ? messages[lastAssistantIdx] : null;
  const lastUserBeforeAssistant = lastAssistantIdx > 0
    ? [...messages.slice(0, lastAssistantIdx)].reverse().find(m => m.role === 'user')
    : null;
  const dynamicFollowUps = lastAssistantMessage
    ? generateFollowUps(
        lastAssistantMessage.content,
        !!lastAssistantMessage.chartData || !!lastAssistantMessage.visualization,
        lastUserBeforeAssistant?.content || ""
      )
    : [];

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => handleSend(prompt), 50);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      
      {/* Scrollable content area - everything except input */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto min-h-0 scrollbar-hide"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          paddingBottom: keyboardInset > 0 ? `${320 + keyboardInset}px` : '264px',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* AI Capability buttons - show when no messages or few messages */}
        {messages.length <= 2 && (
          <div className="px-3 pt-3 pb-1">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5" />
              Try asking me to...
            </p>
            <AIChatPrompts onSendPrompt={handlePromptClick} variant="capabilities" />
          </div>
        )}

        {/* Messages */}
        <div className="p-4 space-y-3">
        {messages.map((msg, index) => {
          // Skip empty assistant messages (confirmation is handled by entryData badge)
          if (msg.role === 'assistant' && !msg.content && !msg.entryData && !msg.visualization && !msg.weatherCard && !msg.chartData && !msg.proactiveForm) return null;
          
          return (
          <div key={msg.id} className={cn(
            "flex flex-col",
            msg.role === 'user' ? "items-end" : "items-start",
            msg.reaction ? "mt-4" : "" // extra space for reaction overlay
          )}>
            {/* 3D Frosted glass chat bubble using accent color */}
            <div 
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 relative",
                msg.role === 'user' ? "rounded-br-md" : "rounded-bl-md",
                // Hide empty assistant bubbles but keep the entryData confirmation below
                msg.role === 'assistant' && !msg.content && msg.entryData ? "hidden" : "",
                msg.role === 'user' 
                  ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground border border-primary/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),0_4px_12px_hsl(var(--primary)/0.25)]"
                  : "bg-card/90 backdrop-blur-xl border border-glass-border/40 shadow-[inset_0_1px_2px_hsl(var(--glass-highlight)/0.3),0_4px_12px_hsl(var(--foreground)/0.04)]"
              )}
            >
              {/* Glass highlight overlay */}
              <div 
                className={cn(
                  "absolute inset-0 pointer-events-none rounded-inherit overflow-hidden",
                  msg.role === 'user'
                    ? "bg-gradient-to-b from-white/15 to-transparent"
                    : "bg-gradient-to-b from-white/25 to-transparent"
                )}
              />
              {(() => {
                // Parse chart JSON from AI text if no visualization was provided
                let displayContent = msg.content;
                let inlineChart: DynamicChart | null = msg.visualization || null;
                
                if (!inlineChart && msg.role === 'assistant' && displayContent) {
                  // Match ```json { "chart_type": ... } ``` or bare { "chart_type": ... }
                  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?"chart_type"[\s\S]*?\})\s*```/;
                  const bareJsonRegex = /(\{[\s\S]*?"chart_type"[\s\S]*?"data"\s*:\s*\[[\s\S]*?\]\s*\})/;
                  const match = displayContent.match(jsonBlockRegex) || displayContent.match(bareJsonRegex);
                  
                  if (match) {
                    try {
                      const parsed = JSON.parse(match[1]);
                      if (parsed.chart_type && parsed.data) {
                        inlineChart = {
                          type: parsed.chart_type,
                          title: parsed.title || '',
                          data: parsed.data,
                          config: parsed.config,
                        };
                        // Strip the JSON block from displayed text
                        displayContent = displayContent.replace(match[0], '').trim();
                      }
                    } catch { /* ignore parse errors */ }
                  }
                }
                
                return (
                  <>
                    {displayContent === '...' ? (
                      <div className="flex items-center gap-1 py-1 relative z-10">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <div className="text-[15px] leading-relaxed whitespace-pre-wrap relative z-10">
                        {displayContent.split('\n').filter(Boolean).map((line: string, li: number) => {
                          // Parse **bold** markers into <strong> tags
                          const unescaped = line.replace(/\\\*/g, '*');
                          const parts = unescaped.split(/\*\*(.*?)\*\*/g);
                          return (
                            <p key={li} className="m-0 leading-relaxed">
                              {parts.length === 1
                                ? unescaped
                                : parts.map((part: string, pi: number) =>
                                    pi % 2 === 1
                                      ? <strong key={pi} style={{ fontWeight: 700 }}>{part}</strong>
                                      : <span key={pi}>{part}</span>
                                  )
                              }
                            </p>
                          );
                        })}
                      </div>
                    )}
                    {inlineChart && <DynamicChartRenderer chart={inlineChart} />}
                  </>
                );
              })()}
              
              {/* Research badge */}
              {msg.wasResearched && msg.role === 'assistant' && (
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-primary/70 relative z-10">
                  <Search className="w-3 h-3" />
                  <span>Researched</span>
                </div>
              )}

              {/* Tool timeline tag — click to see what the AI did */}
              {msg.role === 'assistant' && msg.toolActivities && msg.toolActivities.length > 0 && (
                <div className="relative z-10">
                  <ToolTimelineTag activities={msg.toolActivities} />
                </div>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && msg.role === 'assistant' && (
                <div className="mt-2 pt-2 border-t border-border/30 space-y-1 relative z-10">
                  <p className="text-[10px] text-muted-foreground font-medium">Sources</p>
                  {msg.citations.map((cite) => (
                    <a
                      key={cite.index}
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] text-primary/80 hover:text-primary transition-colors group"
                    >
                      <span className="bg-primary/10 rounded px-1 py-0.5 font-mono font-bold shrink-0">[{cite.index}]</span>
                      <span className="truncate">{cite.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ))}
                </div>
              )}
              
              {/* Discovery Cards */}
              {msg.discoveryCards && msg.discoveryCards.length > 0 && msg.role === 'assistant' && (
                <div className="mt-2 space-y-1.5 relative z-10">
                  {msg.discoveryCards.map((disc, idx) => {
                    const categoryStyles = {
                      trigger: { bg: 'hsl(350 80% 95%)', border: 'hsl(350 60% 85%)', accent: 'hsl(350 70% 50%)', bar: 'hsl(350 70% 55%)' },
                      protective: { bg: 'hsl(150 60% 95%)', border: 'hsl(150 40% 85%)', accent: 'hsl(150 50% 40%)', bar: 'hsl(150 50% 45%)' },
                      investigating: { bg: 'hsl(220 60% 95%)', border: 'hsl(220 40% 85%)', accent: 'hsl(220 50% 50%)', bar: 'hsl(220 50% 55%)' },
                    };
                    const s = categoryStyles[disc.category];
                    const IconComponent = disc.category === 'trigger' ? TrendingUp : disc.category === 'protective' ? Activity : Search;
                    return (
                      <div key={idx} className="rounded-xl p-2.5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${s.accent}20` }}>
                            <IconComponent className="w-3 h-3" style={{ color: s.accent }} />
                          </div>
                          <span className="text-xs font-semibold capitalize">{disc.factor}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-1.5 line-clamp-2">{disc.summary}</p>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 h-1 rounded-full bg-background/60 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${disc.confidence}%`, background: s.bar }} />
                          </div>
                          <span className="text-[9px] font-medium" style={{ color: s.accent }}>{disc.confidence}%</span>
                          {disc.lift > 1 && <span className="text-[9px] font-medium" style={{ color: s.accent }}>{disc.lift.toFixed(1)}×</span>}
                        </div>
                        {onNavigateToTrends && (
                          <button
                            onClick={onNavigateToTrends}
                            className="flex items-center gap-1 text-[10px] font-medium transition-colors hover:opacity-80"
                            style={{ color: s.accent }}
                          >
                            View in Trends
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* iMessage-style reaction overlay — top-left corner of user bubble */}
              {msg.reaction && msg.role === 'user' && (
                <div 
                  className="absolute -top-3 -left-2 z-20 animate-reaction-pop"
                  style={{ animationDelay: '300ms', animationFillMode: 'both' }}
                >
                  <div className="bg-card rounded-full px-1.5 py-0.5 shadow-lg border border-border/50 text-sm">
                    {msg.reaction}
                  </div>
                </div>
              )}
            </div>

            {/* Proactive AI Form */}
            {msg.proactiveForm && msg.role === 'assistant' && (
              <ProactiveFormCard
                form={msg.proactiveForm}
                completed={msg.formCompleted || false}
                responses={msg.formResponses || {}}
                onRespond={(fieldId, value) => {
                  setMessages(prev => prev.map(m => {
                    if (m.id !== msg.id) return m;
                    const newResponses = { ...(m.formResponses || {}), [fieldId]: value };
                    const allAnswered = m.proactiveForm!.fields.every(f => newResponses[f.id]);
                    if (allAnswered) {
                      // Check if this is a severity form (from symptom logging)
                      const isSeverityForm = m.proactiveForm!.fields.some(f => f.id === 'severity');
                      
                      if (isSeverityForm && newResponses.severity && onUpdateEntry) {
                        // Update the most recent flare entry's severity
                        const lastFlare = recentEntries.find(e => e.type === 'flare');
                        if (lastFlare) {
                          onUpdateEntry(lastFlare.id, { severity: newResponses.severity as any });
                        }
                      } else {
                        // Standard proactive form — save as proper typed entries
                        const responses = newResponses;
                        const fields = m.proactiveForm!.fields;
                        
                        // Map form fields to proper entry types
                        for (const field of fields) {
                          const val = responses[field.id];
                          if (!val) continue;
                          const valStr = Array.isArray(val) ? val.join(', ') : val;
                          const fieldLabel = field.label.toLowerCase();
                          
                          // Detect entry type from field semantics
                          if (fieldLabel.includes('mood') || fieldLabel.includes('feeling') || fieldLabel.includes('how are')) {
                            onSave({
                              type: 'wellness',
                              note: `Mood: ${valStr}`,
                              context: { mood: valStr },
                              timestamp: new Date(),
                            });
                          } else if (fieldLabel.includes('sleep')) {
                            onSave({
                              type: 'wellness',
                              note: `Sleep: ${valStr}`,
                              context: { activity: `sleep:${valStr}` },
                              timestamp: new Date(),
                            });
                          } else if (fieldLabel.includes('energy') || fieldLabel.includes('tired')) {
                            const energyMap: Record<string, string> = {
                              'great': 'high', 'good': 'good', 'okay': 'moderate',
                              'low': 'low', 'exhausted': 'very-low', 'tired': 'low',
                            };
                            onSave({
                              type: 'energy',
                              energyLevel: (energyMap[valStr.toLowerCase()] || 'moderate') as any,
                              note: `Energy: ${valStr}`,
                              timestamp: new Date(),
                            });
                          } else if (fieldLabel.includes('symptom') || fieldLabel.includes('pain') || fieldLabel.includes('today') || fieldLabel.includes('flare') || fieldLabel.includes('signs') || fieldLabel.includes('condition') || fieldLabel.includes('arthritis') || fieldLabel.includes('evening') || fieldLabel.includes('morning')) {
                            // Check if it's a "no issues" response
                            const negativeResponses = ['no', 'none', 'nope', 'feeling good', 'all good', 'fine', 'nothing', 'no flare', 'no symptoms', 'good'];
                            const isNegative = negativeResponses.some(r => valStr.toLowerCase().includes(r));
                            
                            if (isNegative) {
                              onSave({
                                type: 'wellness',
                                note: `Feeling good`,
                                timestamp: new Date(),
                              });
                            } else {
                              const symptoms = Array.isArray(val) ? val : [valStr];
                              onSave({
                                type: 'flare',
                                severity: 'mild',
                                symptoms,
                                note: valStr,
                                timestamp: new Date(),
                              });
                            }
                          } else if (fieldLabel.includes('stress')) {
                            onSave({
                              type: 'wellness',
                              note: `Stress: ${valStr}`,
                              context: { mood: `stress:${valStr}` },
                              timestamp: new Date(),
                            });
                          } else if (fieldLabel.includes('trigger') || fieldLabel.includes('duration') || fieldLabel.includes('frequency') || fieldLabel.includes('long') || fieldLabel.includes('often') || fieldLabel.includes('background') || fieldLabel.includes('how long') || fieldLabel.includes('experiencing') || fieldLabel.includes('tried') || fieldLabel.includes('worst') || fieldLabel.includes('time of day') || fieldLabel.includes('treatment')) {
                            // Background/context data — save to profile metadata, NOT as a log entry
                            (async () => {
                              try {
                                const { data: profile } = await supabase
                                  .from('profiles')
                                  .select('metadata')
                                  .eq('id', userId)
                                  .maybeSingle();
                                const existingMeta = (profile?.metadata as Record<string, any>) || {};
                                const aiMemory = existingMeta.ai_memory || [];
                                aiMemory.push({
                                  key: field.id,
                                  question: field.label,
                                  answer: valStr,
                                  recorded_at: new Date().toISOString(),
                                });
                                // Mark context form as complete if this is a multi-field intake form (4+ fields)
                                if (fields.length >= 4) {
                                  aiMemory.push({
                                    key: '_context_form_complete',
                                    question: 'Initial context form',
                                    answer: 'completed',
                                    recorded_at: new Date().toISOString(),
                                  });
                                }
                                await supabase.from('profiles').update({
                                  metadata: { ...existingMeta, ai_memory: aiMemory },
                                }).eq('id', userId);
                              } catch (e) {
                                console.warn('Failed to save to profile memory:', e);
                              }
                            })();
                          } else {
                            // Generic — save as wellness with clean note (no raw question text)
                            onSave({
                              type: 'wellness',
                              note: valStr,
                              timestamp: new Date(),
                            });
                          }
                        }
                      }
                      // Add closing message — NO follow-up form to avoid spam
                      setTimeout(() => {
                        const closingMsg: ChatMessage = {
                          id: Date.now().toString(),
                          role: 'assistant',
                          content: m.proactiveForm!.closingMessage,
                          timestamp: new Date(),
                        };
                        setMessages(prev2 => [...prev2, closingMsg]);
                        import('@/lib/haptics').then(({ haptics }) => haptics.success());
                      }, 400);
                    } else {
                      import('@/lib/haptics').then(({ haptics }) => haptics.light());
                    }
                    return { ...m, formResponses: newResponses, formCompleted: allAnswered };
                  }));
                }}
              />
            )}
            
            {msg.weatherCard && <WeatherCard weather={msg.weatherCard} />}
            {msg.chartData && <MiniChart chartData={msg.chartData} />}

            {msg.updateInfo && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-primary">
                <Check className="w-3 h-3" />
                <span>Entry updated</span>
              </div>
            )}
            
            {msg.entryData && !msg.updateInfo && (
              <div className={cn("flex items-center gap-1.5 text-[10px] text-muted-foreground", msg.reaction ? "mt-3" : "mt-1.5")}>
                <Check className="w-3 h-3 text-green-500" />
                <span>{
                  msg.entryData.type?.startsWith('trackable:') 
                    ? (() => {
                        try {
                          const meta = JSON.parse(msg.entryData.note || '{}');
                          return `${meta.trackableLabel || msg.entryData.type.replace('trackable:', '')} logged`;
                        } catch { return msg.entryData.type.replace('trackable:', '').replace(/_/g, ' ') + ' logged'; }
                      })()
                    : `${msg.entryData.type} logged`
                }{msg.entryData.severity ? ` • ${msg.entryData.severity}` : ''}</span>
              </div>
            )}
            
            {/* Removed: dataUsed display - internal function names should not be shown to users */}
            
            {msg.activityDetected && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-blue-600">
                <Activity className="w-3 h-3" />
                <span>Activity tracked: {msg.activityDetected.type}</span>
              </div>
            )}
            
            {msg.correlationWarning && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-600">
                <TrendingUp className="w-3 h-3" />
                <span>Pattern: {msg.correlationWarning.triggerValue} → {msg.correlationWarning.outcomeValue} ({msg.correlationWarning.occurrenceCount}x)</span>
              </div>
            )}
          </div>
          );
        })}
        
        {/* Show top correlations hint if user has discovered patterns */}
        {topCorrelations.length > 0 && messages.length === 1 && (
          <div className="flex items-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
              <div className="flex items-center gap-1.5 text-xs text-primary mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="font-medium">Patterns Discovered</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {topCorrelations.slice(0, 2).map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ' • '}
                    {c.trigger_value} → {c.outcome_value} ({c.occurrence_count}x)
                  </span>
                ))}
                {topCorrelations.length > 2 && ` +${topCorrelations.length - 2} more`}
              </p>
            </div>
          </div>
        )}
        
        {isProcessing && (
          <div className="flex flex-col items-start gap-1.5 pl-1">
            {/* Typing dots — no border, no bubble */}
            <div className="flex gap-1 py-1">
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            {/* Single live-updating activity, shimmer text */}
            {toolActivities.length > 0 && (
              <LiveActivityIndicator activities={toolActivities.filter(a => a.status === 'running')} />
            )}
          </div>
        )}
        
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed bottom section - contains follow-ups, quick actions, and input */}
      <div 
        ref={composerRef}
        className="absolute bottom-0 left-0 right-0 flex-shrink-0"
        style={{
          bottom: `${keyboardInset}px`,
          background: 'linear-gradient(180deg, hsl(var(--glass-bg) / 0.92) 0%, hsl(var(--glass-bg) / 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid hsl(var(--glass-border) / 0.3)',
          boxShadow: '0 -4px 20px hsl(var(--foreground) / 0.03)',
        }}
      >
        {/* Dynamic follow-up suggestions after AI responds */}
        {dynamicFollowUps.length > 0 && messages.length > 2 && !isProcessing && (
           <div className="px-3 py-2 border-b border-glass-border/20">
            <AIChatPrompts 
              onSendPrompt={handlePromptClick} 
              variant="followups" 
              followUps={dynamicFollowUps} 
            />
          </div>
        )}

        {/* Quick actions - compact */}
        <div className="px-3 py-2 border-b border-glass-border/20">
          <FluidLogSelector
            userSymptoms={userSymptoms}
            userMedications={userMedications}
            aiLogCategories={aiLogCategories}
            customTrackables={customTrackables}
            primaryConditionLabel={
              userConditions[0]
                ? (CONDITIONS.find(c => c.id === userConditions[0])?.name || userConditions[0])
                : null
            }
            onLogSymptom={handleFluidLog}
            onLogMedication={handleMedicationLog}
            onLogWellness={handleWellnessLog}
            onLogMood={handleMoodLog}
            onLogEnergy={handleEnergyLog}
            onLogRecovery={handleRecoveryLog}
            onLogCustom={handleCustomLog}
            onAddTrackable={onAddTrackable}
            onRemoveTrackable={onRemoveTrackable}
            onReorderTrackables={onReorderTrackables}
            onAddMedication={onAddMedication}
            onRemoveMedication={onRemoveMedication}
            onAddSymptom={onAddSymptom}
            onRemoveSymptom={onRemoveSymptom}
            onOpenDetails={onOpenDetails}
            onOpenFood={onOpenFood}
          />
        </div>

        {/* Input */}
        <div className="p-3 pt-2" style={{ paddingBottom: keyboardInset > 0 ? '12px' : 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
          <div className="flex items-end gap-2">
            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              className="shrink-0 h-12 w-12 rounded-2xl"
              onClick={toggleRecording}
              style={{
                background: isRecording ? undefined : 'hsl(var(--card) / 0.9)',
                borderColor: isRecording ? undefined : 'hsl(var(--border) / 0.5)',
              }}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            {/* Voice Call Button */}
            {onOpenVoiceCall && (
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-12 w-12 rounded-2xl"
                onClick={onOpenVoiceCall}
                style={{
                  background: 'hsl(var(--card) / 0.9)',
                  borderColor: 'hsl(var(--border) / 0.5)',
                }}
              >
                <Phone className="w-5 h-5" />
              </Button>
            )}
            
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isRecording ? "Listening..." : "Ask me anything..."}
              rows={1}
              className="min-h-[56px] max-h-36 flex-1 resize-none rounded-2xl px-4 py-3 text-base leading-6"
              disabled={isProcessing}
              style={{
                background: 'hsl(var(--card) / 0.8)',
                borderColor: 'hsl(var(--border) / 0.4)',
              }}
            />
            
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isProcessing}
              size="icon"
              className="shrink-0 h-12 w-12 rounded-2xl"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
