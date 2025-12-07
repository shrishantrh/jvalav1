import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Check, Sparkles, Cloud, Thermometer, Droplets } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { FluidLogSelector } from "./FluidLogSelector";

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
    current: {
      temp_f: number;
      temp_c: number;
      condition: string;
      icon: string;
      humidity: number;
      uv: number;
      feelslike_f: number;
    };
    forecast?: {
      date?: string;
      maxtemp_f: number;
      mintemp_f: number;
      condition: string;
      icon: string;
      daily_chance_of_rain: number;
    };
    aqi?: number;
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

// Generate personalized greeting based on time and context
const getPersonalizedGreeting = (conditions: string[], recentEntries: any[]): string => {
  const hour = new Date().getHours();
  const recentFlares = recentEntries.filter(e => e.type === 'flare').slice(0, 10);
  const lastFlare = recentFlares[0];
  
  let timeGreeting = '';
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 17) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';
  
  // Check for high flare activity recently
  const last24hFlares = recentFlares.filter(f => {
    const hoursSince = (Date.now() - new Date(f.timestamp).getTime()) / (1000 * 60 * 60);
    return hoursSince < 24;
  });
  
  if (last24hFlares.length >= 3) {
    return `${timeGreeting}. I noticed you've had ${last24hFlares.length} flares in the last day. How are you feeling now?`;
  }
  
  // Check recent severe flare
  if (lastFlare) {
    const hoursSinceFlare = (Date.now() - new Date(lastFlare.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursSinceFlare < 24 && lastFlare.severity === 'severe') {
      return `${timeGreeting}. How are you feeling after yesterday's severe flare?`;
    }
    if (hoursSinceFlare < 6) {
      return `${timeGreeting}. I see you logged earlier. Any updates?`;
    }
  }
  
  // Calculate days since last flare
  const daysSinceFlare = lastFlare ? 
    Math.floor((Date.now() - new Date(lastFlare.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  if (daysSinceFlare >= 3 && recentFlares.length > 0) {
    return `${timeGreeting}! ${daysSinceFlare} days flare-free - great streak! 🎉`;
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
    <Card className="p-3 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-0 mt-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{weather.location}{weather.country ? `, ${weather.country}` : ''}</p>
          <div className="flex items-center gap-2 mt-1">
            <Thermometer className="w-4 h-4 text-orange-500" />
            <span className="text-lg font-bold">{weather.current?.temp_f}°F</span>
            <span className="text-xs text-muted-foreground">Feels {weather.current?.feelslike_f}°F</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{weather.current?.condition}</p>
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

export const SmartTrack = forwardRef<SmartTrackRef, SmartTrackProps>(({ 
  onSave, 
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
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedMessages = useRef(false);

  // Load messages and set personalized greeting
  useEffect(() => {
    if (hasLoadedMessages.current) return;
    hasLoadedMessages.current = true;
    
    const saved = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only load if less than 24 hours old
        const lastMsg = parsed[parsed.length - 1];
        if (lastMsg && (Date.now() - new Date(lastMsg.timestamp).getTime()) < 24 * 60 * 60 * 1000) {
          setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
          return;
        }
      } catch {}
    }
    
    // Create fresh greeting
    const greeting = getPersonalizedGreeting(userConditions, recentEntries);
    setMessages([{
      id: '1',
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    }]);
  }, [userId, userConditions, recentEntries]);

  // Get current location on mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { getCurrentLocation, fetchWeatherData } = await import("@/services/weatherService");
        const location = await getCurrentLocation();
        if (location) {
          setCurrentLocation(location);
          // Try to get city name
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

  // Expose method to add detailed entry as a message
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    try {
      const { getCurrentLocation, fetchWeatherData } = await import("@/services/weatherService");
      const location = await getCurrentLocation();
      if (location) {
        const weatherData = await fetchWeatherData(location.latitude, location.longitude);
        if (weatherData) entry.environmentalData = weatherData;
      }
    } catch (e) {
      console.log('Could not get location data');
    }

    onSave(entry);

    const responses = [
      `Logged ${severity} ${symptom}. Take care 💜`,
      `Got it. ${symptom} noted as ${severity}.`,
      `Tracked. Rest up if you need to.`,
    ];
    
    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responses[Math.floor(Math.random() * responses.length)],
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
      content: `${medicationName} logged! Keep up with your routine 💊`,
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleWellnessLog = async () => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: 'Feeling good! 😊',
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
      content: "Great to hear! Logged your positive update 💜",
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
      low: "Logged low energy. Take it easy today 💜",
      moderate: "Noted. Pace yourself!",
      high: "Great energy! Make the most of it 🎉",
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
      content: 'Feeling better / Recovery',
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
      content: "So glad you're recovering! Logged 💜",
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
      const userContext = {
        conditions: userConditions,
        knownSymptoms: userSymptoms,
        knownTriggers: userTriggers,
        medications: userMedications,
        currentLocation,
        recentEntries: recentEntries.slice(0, 30).map(e => ({
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
          history: messages.slice(-8).map(m => ({ 
            role: m.role === 'system' ? 'assistant' : m.role, 
            content: m.content 
          }))
        }
      });

      if (error) throw error;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "I need more data to answer that.",
        timestamp: new Date(),
        entryData: data.entryData,
        isAIGenerated: data.isAIGenerated,
        dataUsed: data.dataUsed,
        weatherUsed: data.weatherUsed,
        weatherCard: data.weatherCard,
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.entryData && data.shouldLog) {
        const entry: Partial<FlareEntry> = {
          ...data.entryData,
          note: text,
          timestamp: new Date(),
        };

        try {
          const { getCurrentLocation, fetchWeatherData } = await import("@/services/weatherService");
          const location = await getCurrentLocation();
          if (location) {
            const weatherData = await fetchWeatherData(location.latitude, location.longitude);
            if (weatherData) entry.environmentalData = weatherData;
          }
        } catch {}

        onSave(entry);
      }
    } catch (error) {
      console.error('Smart assistant error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I couldn't process that. Try again?",
        timestamp: new Date(),
      }]);
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

  return (
    <div className="flex flex-col h-[520px]">
      {/* Messages - hidden scrollbar */}
      <div 
        className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-2 animate-fade-in",
              message.role === 'user' ? 'flex-row-reverse' : '',
              message.role === 'system' ? 'justify-center' : ''
            )}
          >
            {message.role === 'system' ? (
              <div className="flex items-center gap-1.5 text-xs text-severity-none bg-severity-none/10 px-3 py-1.5 rounded-full">
                <Check className="w-3 h-3" />
                {message.content}
              </div>
            ) : (
              <div className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-muted rounded-tl-sm'
              )}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                
                {/* Weather Card if available */}
                {message.weatherCard && (
                  <WeatherCard weather={message.weatherCard} />
                )}
                
                {/* AI Generated indicator with data sources */}
                {message.role === 'assistant' && message.isAIGenerated && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>AI</span>
                    {message.weatherUsed && (
                      <span className="flex items-center gap-0.5 text-blue-400">
                        <Cloud className="w-2.5 h-2.5" />
                        weather
                      </span>
                    )}
                  </div>
                )}
                
                {message.entryData && message.role === 'assistant' && (
                  <div className="mt-1.5 pt-1.5 border-t border-current/10 text-xs opacity-75 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {message.entryData.type || message.entryData.severity} logged
                    {message.entryData.symptoms && message.entryData.symptoms.length > 0 && (
                      <span> • {message.entryData.symptoms.length} symptoms</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-2 animate-fade-in">
            <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Fluid Log Selector */}
      <FluidLogSelector
        userSymptoms={userSymptoms}
        userMedications={userMedications}
        onLogSymptom={handleFluidLog}
        onLogMedication={handleMedicationLog}
        onLogWellness={handleWellnessLog}
        onLogEnergy={handleEnergyLog}
        onLogRecovery={handleRecoveryLog}
        disabled={isProcessing}
      />

      {/* Input */}
      <div className="flex gap-2 items-center border-t pt-3 mt-3">
        <Button
          variant="outline"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            "h-9 w-9 flex-shrink-0 rounded-full transition-all",
            isRecording && "bg-destructive/10 border-destructive animate-pulse"
          )}
        >
          {isRecording ? <MicOff className="w-4 h-4 text-destructive" /> : <Mic className="w-4 h-4" />}
        </Button>
        
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ask me anything..."
          className="h-9 text-sm rounded-full"
          disabled={isProcessing}
        />
        
        <Button
          variant="default"
          size="icon"
          onClick={() => handleSend()}
          disabled={!input.trim() || isProcessing}
          className="h-9 w-9 flex-shrink-0 rounded-full"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});

SmartTrack.displayName = 'SmartTrack';
