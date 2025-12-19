import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Check, Sparkles, Thermometer, Droplets, Calendar, AlertTriangle, BarChart3, MapPin, Activity, TrendingUp, Heart } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { FluidLogSelector } from "./FluidLogSelector";
import { Badge } from "@/components/ui/badge";
import { useCorrelations, Correlation } from "@/hooks/useCorrelations";
import { useEntryContext } from "@/hooks/useEntryContext";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  entryData?: Partial<FlareEntry>;
  isAIGenerated?: boolean;
  dataUsed?: string[];
  weatherUsed?: boolean;
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

interface SmartTrackProps {
  onSave: (entry: Partial<FlareEntry>) => void;
  onUpdateEntry?: (entryId: string, updates: Partial<FlareEntry>) => void;
  userSymptoms?: string[];
  userConditions?: string[];
  userTriggers?: string[];
  userMedications?: MedicationDetails[];
  recentEntries?: any[];
  userId: string;
}

export interface SmartTrackRef {
  addDetailedEntry: (entry: Partial<FlareEntry>) => void;
}

const STORAGE_KEY = 'jvala_smart_chat';

const getPersonalizedGreeting = (conditions: string[], recentEntries: any[]): string => {
  const hour = new Date().getHours();
  const recentFlares = recentEntries.filter(e => e.type === 'flare').slice(0, 10);
  const lastFlare = recentFlares[0];
  
  let timeGreeting = '';
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 17) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';
  
  const last24hFlares = recentFlares.filter(f => {
    const hoursSince = (Date.now() - new Date(f.timestamp).getTime()) / (1000 * 60 * 60);
    return hoursSince < 24;
  });
  
  if (last24hFlares.length >= 3) {
    return `${timeGreeting}. I noticed you've had ${last24hFlares.length} flares in the last day. How are you feeling now?`;
  }
  
  if (lastFlare) {
    const hoursSinceFlare = (Date.now() - new Date(lastFlare.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursSinceFlare < 24 && lastFlare.severity === 'severe') {
      return `${timeGreeting}. How are you feeling after yesterday's severe flare?`;
    }
    if (hoursSinceFlare < 6) {
      return `${timeGreeting}. I see you logged earlier. Any updates?`;
    }
  }
  
  const daysSinceFlare = lastFlare ? 
    Math.floor((Date.now() - new Date(lastFlare.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  if (daysSinceFlare >= 3 && recentFlares.length > 0) {
    return `${timeGreeting}! ${daysSinceFlare} days flare-free - great streak!`;
  }
  
  if (recentFlares.length === 0) {
    return `${timeGreeting}! Tap a symptom below to start logging.`;
  }
  
  return `${timeGreeting}! How are you feeling right now?`;
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
  recentEntries = [],
  userId 
}, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  useEffect(() => {
    if (hasLoadedMessages.current) return;
    hasLoadedMessages.current = true;
    
    const saved = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const lastMsg = parsed[parsed.length - 1];
        if (lastMsg && (Date.now() - new Date(lastMsg.timestamp).getTime()) < 24 * 60 * 60 * 1000) {
          setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
          return;
        }
      } catch {}
    }
    
    const greeting = getPersonalizedGreeting(userConditions, recentEntries);
    setMessages([{
      id: '1',
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    }]);
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
    }
  }));

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(messages));
    }
  }, [messages, userId]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  const handleFluidLog = async (symptom: string, severity: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `${severity} ${symptom}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    const entry: Partial<FlareEntry> = {
      type: 'flare',
      severity: severity as 'mild' | 'moderate' | 'severe',
      symptoms: [symptom],
      timestamp: new Date(),
    };

    // Get unified context data (environmental + wearable)
    try {
      const contextData = await getEntryContext();
      if (contextData.environmentalData) {
        entry.environmentalData = contextData.environmentalData;
      }
      if (contextData.physiologicalData) {
        entry.physiologicalData = contextData.physiologicalData;
      }
    } catch (e) {
      console.log('Could not get context data:', e);
    }

    onSave(entry);
    
    // Track the last logged entry for potential updates
    const entryId = Date.now().toString();
    setLastLoggedEntryId(entryId);

    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Logged ${severity} ${symptom}.`,
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleMedicationLog = async (medicationName: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `Took ${medicationName}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

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
      content: `${medicationName} logged.`,
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
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: labels[level],
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    const entry: Partial<FlareEntry> = {
      type: 'energy',
      energyLevel: level === 'high' ? 'high' : level === 'moderate' ? 'moderate' : 'low',
      note: labels[level],
      timestamp: new Date(),
    };
    onSave(entry);

    const responses: Record<string, string> = {
      low: "Logged low energy. Take it easy.",
      moderate: "Noted. Pace yourself!",
      high: "Great energy! Make the most of it.",
    };

    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responses[level],
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
        })),
      };

      const { data, error } = await supabase.functions.invoke('smart-assistant', {
        body: { 
          message: text,
          userContext,
          userId, // Pass userId for correlation engine
          history: messages.slice(-8).map(m => ({ 
            role: m.role === 'system' ? 'assistant' : m.role, 
            content: m.content 
          }))
        }
      });

      if (error) throw error;

      // Handle entry updates if AI suggests one
      if (data.updateEntry && data.updateEntry.entryId && onUpdateEntry) {
        onUpdateEntry(data.updateEntry.entryId, data.updateEntry.updates);
      }

      // Build response content with correlation warning if applicable
      let responseContent = data.response || "I need more data to answer that.";
      
      // If activity was detected and has correlation warning, enhance the response
      if (data.activityLog && data.correlationWarning) {
        const warning = data.correlationWarning;
        const delayText = warning.avgDelayMinutes < 60 
          ? `${warning.avgDelayMinutes} min` 
          : `${Math.round(warning.avgDelayMinutes / 60)} hr`;
        
        responseContent += `\n\n⚠️ Pattern detected: ${warning.triggerValue} has preceded ${warning.outcomeValue} ${warning.occurrenceCount} times (~${delayText} later). I'll check in with you later.`;
      } else if (data.activityLog && data.shouldFollowUp) {
        responseContent += `\n\n📋 Logged your ${data.activityLog.activity_type}. I'll check in ${data.followUpDelay} min to see how you feel.`;
        
        // Set pending follow-up
        setPendingFollowUp({
          activityType: data.activityLog.activity_type,
          activityId: data.activityLog.id,
          followUpTime: new Date(Date.now() + data.followUpDelay * 60 * 1000)
        });
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        entryData: data.entryData,
        isAIGenerated: data.isAIGenerated,
        dataUsed: data.dataUsed,
        weatherUsed: data.weatherUsed,
        weatherCard: data.weatherCard,
        chartData: data.chartData,
        updateInfo: data.updateEntry,
        activityDetected: data.activityLog ? { type: data.activityLog.activity_type, intensity: data.activityLog.intensity } : undefined,
        correlationWarning: data.correlationWarning,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Handle multiple entries from a single message (e.g., "felt pain and took meds")
      if (data.multipleEntries && data.multipleEntries.length > 0) {
        console.log('📝 Logging multiple entries:', data.multipleEntries.length);
        
        // Get unified context data (environmental + wearable)
        const contextData = await getEntryContext();
        
        // Save each entry with context
        for (const entryData of data.multipleEntries) {
          const entry: Partial<FlareEntry> = {
            ...entryData,
            note: text,
            timestamp: new Date(),
            environmentalData: contextData.environmentalData || undefined,
            physiologicalData: contextData.physiologicalData || undefined,
          };
          onSave(entry);
        }
      } else if (data.entryData && data.shouldLog) {
        // Single entry - get unified context data
        const contextData = await getEntryContext();
        
        const entry: Partial<FlareEntry> = {
          ...data.entryData,
          note: text,
          timestamp: new Date(),
          environmentalData: contextData.environmentalData || undefined,
          physiologicalData: contextData.physiologicalData || undefined,
        };

        onSave(entry);
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

  return (
    <div className="flex flex-col h-[520px] bg-gradient-card rounded-xl overflow-hidden">
      
      {/* Messages - scrollable container with hidden scrollbar */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className={cn(
            "flex flex-col",
            msg.role === 'user' ? "items-end" : "items-start"
          )}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5",
              msg.role === 'user' 
                ? "bg-primary text-primary-foreground rounded-br-md" 
                : "bg-muted/50 rounded-bl-md"
            )}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
            
            {msg.weatherCard && <WeatherCard weather={msg.weatherCard} />}
            {msg.chartData && <MiniChart chartData={msg.chartData} />}
            
            {msg.updateInfo && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-primary">
                <Check className="w-3 h-3" />
                <span>Entry updated</span>
              </div>
            )}
            
            {msg.entryData && !msg.updateInfo && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Check className="w-3 h-3 text-green-500" />
                <span>{msg.entryData.type} logged</span>
              </div>
            )}
            
            {msg.isAIGenerated && msg.dataUsed && msg.dataUsed.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                <span className="opacity-75">{msg.dataUsed.join(', ')}</span>
              </div>
            )}
            
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
        ))}
        
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
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions - compact */}
      <div className="px-3 py-2 border-t bg-background/50">
        <FluidLogSelector
          userSymptoms={userSymptoms}
          userMedications={userMedications}
          onLogSymptom={handleFluidLog}
          onLogMedication={handleMedicationLog}
          onLogWellness={handleWellnessLog}
          onLogEnergy={handleEnergyLog}
          onLogRecovery={handleRecoveryLog}
        />
      </div>

      {/* Input - fixed at bottom */}
      <div className="p-3 pt-2 border-t bg-background/80">
        <div className="flex items-center gap-2">
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            className="shrink-0 h-9 w-9"
            onClick={toggleRecording}
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
  );
});
