import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Check, Sparkles, Thermometer, Droplets, Calendar, AlertTriangle, BarChart3, Activity, TrendingUp, Search, ExternalLink } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { FluidLogSelector } from "./FluidLogSelector";
import { Badge } from "@/components/ui/badge";
import { useCorrelations } from "@/hooks/useCorrelations";
import { useEntryContext } from "@/hooks/useEntryContext";
import { DynamicChart, DynamicChartRenderer } from "@/components/chat/DynamicChartRenderer";
import { AIChatPrompts, generateFollowUps } from "@/components/chat/AIChatPrompts";


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
  userName?: string | null;
  userDOB?: string | null;
  userBiologicalSex?: string | null;
  recentEntries?: any[];
  userId: string;
  onOpenDetails?: () => void;
}

export interface SmartTrackRef {
  addDetailedEntry: (entry: Partial<FlareEntry>) => void;
  sendChatMessage: (message: string) => void;
}

const STORAGE_KEY = 'jvala_smart_chat';

// Module-level chat cache to persist across tab switches (in-memory only, not localStorage)
const chatCache = new Map<string, ChatMessage[]>();

const getPersonalizedGreeting = (conditions: string[], recentEntries: any[]): string => {
  const hour = new Date().getHours();
  let timeGreeting = '';
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 17) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';
  return `${timeGreeting}! How are you feeling?`;
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
  if (completed) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground animate-in fade-in duration-300">
        <Check className="w-3 h-3 text-green-500" />
        <span>Check-in complete</span>
      </div>
    );
  }

  // Find the current unanswered field
  const currentFieldIndex = form.fields.findIndex(f => !responses[f.id]);
  const currentField = form.fields[currentFieldIndex];
  if (!currentField) return null;

  const progress = currentFieldIndex / form.fields.length;

  return (
    <div className="mt-2 max-w-[85%] animate-in slide-in-from-bottom-2 duration-300">
      {/* Progress dots */}
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
            onClick={() => onRespond(currentField.id, opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              "bg-white/80 dark:bg-slate-800/80 border border-border/50",
              "hover:bg-primary/10 hover:border-primary/30 active:scale-95",
              "shadow-sm"
            )}
          >
            {opt.emoji && <span className="mr-1">{opt.emoji}</span>}
            {opt.label}
          </button>
        ))}
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
  userName,
  userDOB,
  userBiologicalSex,
  recentEntries = [],
  userId,
  onOpenDetails
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
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; city?: string } | null>(null);
  const [lastLoggedEntryId, setLastLoggedEntryId] = useState<string | null>(null);
  const [pendingFollowUp, setPendingFollowUp] = useState<{ activityType: string; activityId: string; followUpTime: Date } | null>(null);
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasLoadedMessages = useRef(false);
  
  // Use correlations hook
  const { topCorrelations, pendingFollowUps, getCorrelationsForTrigger } = useCorrelations(userId);
  
  // Use entry context hook for unified environmental + wearable data
  const { getEntryContext, hasWearableConnected, currentWearableData } = useEntryContext();

  // Background discovery engine: runs analysis after each log
  const runDiscoveryAnalysis = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('correlation-engine', {
        body: {
          action: 'deep_analysis',
          data: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        },
      });
      if (error) { console.warn('Discovery analysis error:', error); return; }
      
      // Surface new discoveries in chat
      const newDiscoveries = data?.newDiscoveries || [];
      if (newDiscoveries.length > 0) {
        const discoveryIds = newDiscoveries.map((d: any) => d.id);
        
        // Mark them as surfaced
        await supabase.functions.invoke('correlation-engine', {
          body: { action: 'mark_surfaced', data: { discoveryIds } },
        });

        // Show discovery cards in chat
        for (const disc of newDiscoveries.slice(0, 2)) {
          const emoji = disc.discovery_type === 'trigger' ? '🔍' : 
                       disc.discovery_type === 'protective_factor' ? '🛡️' :
                       disc.discovery_type === 'pattern' ? '📊' : '💡';
          const statusLabel = disc.status === 'strong' ? 'Strong evidence' :
                             disc.status === 'confirmed' ? 'Confirmed' :
                             disc.status === 'investigating' ? 'Investigating' : 'Emerging';
          const confPct = Math.round((disc.confidence || 0) * 100);
          
          let title = '';
          if (disc.discovery_type === 'trigger') {
            title = `New trigger detected: ${disc.factor_a}`;
          } else if (disc.discovery_type === 'protective_factor') {
            title = `Protective factor: ${disc.factor_a}`;
          } else if (disc.discovery_type === 'pattern') {
            title = `Pattern found: ${disc.factor_a}`;
          } else {
            title = `Discovery: ${disc.factor_a}`;
          }

          const discoveryMessage: ChatMessage = {
            id: Date.now().toString() + Math.random(),
            role: 'assistant',
            content: `${emoji} **${title}**\n\n${disc.evidence_summary}\n\n_${statusLabel} • ${confPct}% confidence • ${disc.occurrence_count} occurrences_`,
            timestamp: new Date(),
            isAIGenerated: true,
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

  // Proactive checkin — call edge function on first load
  useEffect(() => {
    if (hasLoadedMessages.current) return;
    hasLoadedMessages.current = true;
    
    const cached = chatCache.get(userId);
    if (cached && cached.length > 0) return;
    
    // Show typing indicator while AI loads
    setMessages([{
      id: 'typing',
      role: 'assistant',
      content: '...',
      timestamp: new Date(),
    }]);

    // Fetch proactive AI message (no static greeting first)
    const fetchProactive = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('proactive-checkin', {
          body: { 
            clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });
        
        const message = data?.message || getPersonalizedGreeting(userConditions, recentEntries);
        
        // Handle multiple messages (e.g., intro tour sends 2 messages)
        const allMessages: string[] = data?.messages || [message];
        
        const newMessages: ChatMessage[] = allMessages.map((msg: string, i: number) => ({
          id: (Date.now() + i).toString(),
          role: 'assistant' as const,
          content: msg,
          timestamp: new Date(Date.now() + i),
          proactiveForm: i === 0 ? (data?.form || undefined) : undefined,
        }));

        // Replace typing indicator with real messages
        setMessages(newMessages);
      } catch (e) {
        console.log('[ProactiveCheckin] Could not fetch:', e);
        // Fallback to static greeting
        setMessages([{
          id: Date.now().toString(),
          role: 'assistant',
          content: getPersonalizedGreeting(userConditions, recentEntries),
          timestamp: new Date(),
        }]);
      }
    };

    // Small delay to show typing indicator
    setTimeout(fetchProactive, 300);
  }, [userId, userConditions, recentEntries]);

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
      // Trigger handleSend with the provided message
      handleSend(message);
    }
  }));

  // No localStorage persistence — health data stays in-memory only for privacy

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  // ── Smart response system: every log gets EITHER a reaction OR a text response ──
  const reactionCountRef = useRef(0); // track total reactions given this session
  const lastReactionTimeRef = useRef(0);

  const getResponseStrategy = (logLabel: string, recentSameCount: number): { reaction: string; text: string } => {
    const now = Date.now();
    const recentUserMsgs = messages.filter(m => m.role === 'user' && (now - m.timestamp.getTime()) < 5 * 60 * 1000);
    const rapidFire = recentUserMsgs.length >= 3;
    const veryRapid = recentUserMsgs.length >= 5;
    
    // Reaction fatigue: max 4 reactions in 10 min window, then text only for a bit
    const timeSinceLastReaction = now - lastReactionTimeRef.current;
    const reactionFatigue = reactionCountRef.current >= 4 && timeSinceLastReaction < 10 * 60 * 1000;
    // Reset fatigue counter after 10 min
    if (timeSinceLastReaction > 10 * 60 * 1000) reactionCountRef.current = 0;

    const giveReaction = (pool: string[]): { reaction: string; text: string } => {
      const emoji = pool[Math.floor(Math.random() * pool.length)];
      reactionCountRef.current++;
      lastReactionTimeRef.current = now;
      return { reaction: emoji, text: '' };
    };

    // 5+ same item rapidly → always text commentary
    if (veryRapid && recentSameCount >= 4) {
      const texts = [
        `whoa — ${recentSameCount + 1}x ${logLabel.toLowerCase()} in a few minutes, you good? 😅`,
        `okay ${recentSameCount + 1} ${logLabel.toLowerCase()} logs back to back… take it easy!`,
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
        return giveReaction(['👀', '😏', '🫡', '💪']);
      }
      return { reaction: '', text: `another ${logLabel.toLowerCase()} — noted` };
    }
    // First log → 50% reaction, 50% short text
    if (!reactionFatigue && Math.random() < 0.5) {
      return giveReaction(['👍', '💪', '🔥', '👏', '✌️', '🫡']);
    }
    const shortTexts = [`got it`, `logged`, `noted`, `tracked`];
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
    onSave(entry);

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
    onSave(entry);

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
    onSave(entry);

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

    try {
      // Get the most recent entry ID for potential updates
      const mostRecentEntry = recentEntries[0];

      const userContext = {
        conditions: userConditions,
        knownSymptoms: userSymptoms,
        knownTriggers: userTriggers,
        medications: userMedications,
        currentLocation,
        userName,
        dateOfBirth: userDOB,
        biologicalSex: userBiologicalSex,
        mostRecentEntryId: mostRecentEntry?.id,
        recentEntries: recentEntries.slice(0, 50).map(e => ({
          id: e.id,
          type: e.type,
          severity: e.severity,
          symptoms: e.symptoms || [],
          triggers: e.triggers || [],
          note: e.note || '',
          timestamp: e.timestamp,
          environmental_data: e.environmentalData,
          physiological_data: e.physiologicalData,
        })),
      };

      // Run both assistants:
      // - smart-assistant (keeps existing structured logging/update behavior)
      // - limitless-ai (richer reasoning + charts)
      const [smartResult, limitlessResult] = await Promise.allSettled([
        supabase.functions.invoke('smart-assistant', {
          body: {
            message: text,
            userContext,
            userId,
            clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            history: messages.slice(-8).map(m => ({
              role: m.role === 'system' ? 'assistant' : m.role,
              content: m.content,
            }))
          }
        }),
        supabase.functions.invoke('limitless-ai', {
          body: { 
            query: text, 
            userId, 
            clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            chatHistory: messages.slice(-20).map(m => ({
              role: m.role === 'system' ? 'assistant' : m.role,
              content: m.content + (m.entryData ? ` [LOG: ${m.entryData.type}${m.entryData.severity ? ' ' + m.entryData.severity : ''}]` : ''),
            })),
          },
        })
      ]);

      const smart = smartResult.status === 'fulfilled' ? smartResult.value : null;
      const limitless = limitlessResult.status === 'fulfilled' ? limitlessResult.value : null;

      if (smart?.error) throw smart.error;
      if (limitless?.error) console.warn('Limitless AI error:', limitless.error);

      const smartData = smart?.data;
      const limitlessData = limitless?.data;

      // Prefer Limitless response if present
      let responseContent = (limitlessData?.response || smartData?.response || "").trim();
      if (!responseContent) responseContent = "Tell me more.";

      // Keep correlation follow-up messaging from smart-assistant (if present)
      if (smartData?.activityLog && smartData?.correlationWarning) {
        const warning = smartData.correlationWarning;
        const delayText = warning.avgDelayMinutes < 60
          ? `${warning.avgDelayMinutes} min`
          : `${Math.round(warning.avgDelayMinutes / 60)} hr`;

        responseContent += `\n\n⚠️ Pattern detected: ${warning.triggerValue} has preceded ${warning.outcomeValue} ${warning.occurrenceCount} times (~${delayText} later). I'll check in with you later.`;
      } else if (smartData?.activityLog && smartData?.shouldFollowUp) {
        responseContent += `\n\n📋 Logged your ${smartData.activityLog.activity_type}. I'll check in ${smartData.followUpDelay} min to see how you feel.`;

        setPendingFollowUp({
          activityType: smartData.activityLog.activity_type,
          activityId: smartData.activityLog.id,
          followUpTime: new Date(Date.now() + smartData.followUpDelay * 60 * 1000)
        });
      }

      // Handle entry updates if AI suggests one
      if (smartData?.updateEntry && smartData.updateEntry.entryId && onUpdateEntry) {
        onUpdateEntry(smartData.updateEntry.entryId, smartData.updateEntry.updates);
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        // smart-assistant fields
        entryData: smartData?.entryData,
        isAIGenerated: smartData?.isAIGenerated,
        dataUsed: smartData?.dataUsed,
        weatherUsed: smartData?.weatherUsed,
        weatherCard: smartData?.weatherCard,
        chartData: smartData?.chartData,
        updateInfo: smartData?.updateEntry,
        activityDetected: smartData?.activityLog ? { type: smartData.activityLog.activity_type, intensity: smartData.activityLog.intensity } : undefined,
        correlationWarning: smartData?.correlationWarning,
        // limitless-ai fields
        visualization: limitlessData?.visualization,
        followUp: limitlessData?.followUp,
        dynamicFollowUps: limitlessData?.dynamicFollowUps,
        // Research & citations
        citations: limitlessData?.citations || [],
        wasResearched: limitlessData?.wasResearched || false,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Preserve existing structured logging behavior (smart-assistant)
      if (smartData?.multipleEntries && smartData.multipleEntries.length > 0) {
        console.log('📝 Logging multiple entries:', smartData.multipleEntries.length);

        const contextData = await getEntryContext();

        for (const entryData of smartData.multipleEntries) {
          const entry: Partial<FlareEntry> = {
            ...entryData,
            note: text,
            timestamp: new Date(),
            environmentalData: contextData.environmentalData || undefined,
            physiologicalData: contextData.physiologicalData || undefined,
          };
          await onSave(entry);
        }
      } else if (smartData?.entryData && smartData?.shouldLog) {
        const contextData = await getEntryContext();

        const entry: Partial<FlareEntry> = {
          ...smartData.entryData,
          note: text,
          timestamp: new Date(),
          environmentalData: contextData.environmentalData || undefined,
          physiologicalData: contextData.physiologicalData || undefined,
        };

        await onSave(entry);
      }

      // Trigger background discovery analysis after any chat-based log
      if (smartData?.multipleEntries?.length > 0 || (smartData?.entryData && smartData?.shouldLog)) {
        scheduleAnalysis();
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Something went wrong. Basic logging still works!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
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

  // Get the last assistant message's dynamic follow-ups
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  const dynamicFollowUps = lastAssistantMessage?.dynamicFollowUps || 
    (lastAssistantMessage ? generateFollowUps(
      lastAssistantMessage.content, 
      !!lastAssistantMessage.chartData || !!lastAssistantMessage.visualization
    ) : []);

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
          // Add bottom padding to prevent content hiding behind fixed input
          paddingBottom: '180px' 
        }}
      >
        {/* AI Capability buttons - show when no messages or few messages */}
        {messages.length <= 2 && (
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
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
                  : "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-700/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_4px_12px_rgba(0,0,0,0.04)]"
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
                      <p className="text-sm whitespace-pre-wrap relative z-10">{displayContent}</p>
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
              
              {/* iMessage-style reaction overlay — top-left corner of user bubble */}
              {msg.reaction && msg.role === 'user' && (
                <div 
                  className="absolute -top-3 -left-2 z-20 animate-reaction-pop"
                  style={{ animationDelay: '300ms', animationFillMode: 'both' }}
                >
                  <div className="bg-white dark:bg-slate-800 rounded-full px-1.5 py-0.5 shadow-lg border border-border/50 text-sm">
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
                      // Log the form data
                      const formNote = Object.entries(newResponses)
                        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                        .join('; ');
                      onSave({
                        type: 'note',
                        note: `[Proactive Check-in] ${formNote}`,
                        timestamp: new Date(),
                      });
                      // Add closing message
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
          <div className="flex items-start">
            <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed bottom section - contains follow-ups, quick actions, and input */}
      <div 
        className="absolute bottom-0 left-0 right-0 flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, hsl(0 0% 100% / 0.92) 0%, hsl(0 0% 98% / 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid hsl(0 0% 100% / 0.5)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.03)',
        }}
      >
        {/* Dynamic follow-up suggestions after AI responds */}
        {dynamicFollowUps.length > 0 && messages.length > 2 && !isProcessing && (
          <div className="px-3 py-2 border-b border-white/20">
            <AIChatPrompts 
              onSendPrompt={handlePromptClick} 
              variant="followups" 
              followUps={dynamicFollowUps} 
            />
          </div>
        )}

        {/* Quick actions - compact */}
        <div className="px-3 py-2 border-b border-white/20">
          <FluidLogSelector
            userSymptoms={userSymptoms}
            userMedications={userMedications}
            aiLogCategories={aiLogCategories}
            customTrackables={customTrackables}
            onLogSymptom={handleFluidLog}
            onLogMedication={handleMedicationLog}
            onLogWellness={handleWellnessLog}
            onLogEnergy={handleEnergyLog}
            onLogRecovery={handleRecoveryLog}
            onLogCustom={handleCustomLog}
            onAddTrackable={onAddTrackable}
            onRemoveTrackable={onRemoveTrackable}
            onReorderTrackables={onReorderTrackables}
            onOpenDetails={onOpenDetails}
          />
        </div>

        {/* Input */}
        <div className="p-3 pt-2">
          <div className="flex items-center gap-2">
            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              className="shrink-0 h-9 w-9"
              onClick={toggleRecording}
              style={{
                background: isRecording ? undefined : 'hsl(0 0% 100% / 0.8)',
                borderColor: isRecording ? undefined : 'hsl(0 0% 100% / 0.6)',
              }}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isRecording ? "Listening..." : "Ask me anything..."}
              className="flex-1 h-9"
              disabled={isProcessing}
              style={{
                background: 'hsl(0 0% 100% / 0.7)',
                borderColor: 'hsl(0 0% 100% / 0.5)',
              }}
            />
            
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isProcessing}
              size="icon"
              className="shrink-0 h-9 w-9"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
