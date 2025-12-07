import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Check, Sparkles, Cloud, Pill } from "lucide-react";
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
  suggestedFollowUp?: string;
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
  const recentFlares = recentEntries.filter(e => e.type === 'flare').slice(0, 3);
  const lastFlare = recentFlares[0];
  
  let timeGreeting = '';
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 17) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';
  
  // Check recent activity
  if (lastFlare) {
    const hoursSinceFlare = (Date.now() - new Date(lastFlare.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursSinceFlare < 24 && lastFlare.severity === 'severe') {
      return `${timeGreeting}. How are you feeling after yesterday's flare? 💜`;
    }
    if (hoursSinceFlare < 6) {
      return `${timeGreeting}. I see you logged earlier. Any updates?`;
    }
  }
  
  // No recent flares
  if (recentFlares.length === 0) {
    return `${timeGreeting}! Tap a symptom below to start logging.`;
  }
  
  const daysSinceFlare = lastFlare ? 
    Math.floor((Date.now() - new Date(lastFlare.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  if (daysSinceFlare >= 3) {
    return `${timeGreeting}! ${daysSinceFlare} days since your last flare - great streak! 🎉`;
  }
  
  return `${timeGreeting}! How are you feeling right now?`;
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
        content: "Detailed entry logged! 💜 I'll factor this into your pattern analysis.",
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
        suggestedFollowUp: data.suggestedFollowUp,
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
        {messages.map((message, idx) => (
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
                
                {/* AI Generated indicator with weather icon */}
                {message.role === 'assistant' && message.isAIGenerated && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>AI-generated</span>
                    {message.weatherUsed && (
                      <span className="flex items-center gap-0.5 text-primary/70">
                        <Cloud className="w-2.5 h-2.5" />
                        live weather
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

                {/* Suggested follow-up button */}
                {message.suggestedFollowUp && idx === messages.length - 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={() => handleSend(message.suggestedFollowUp)}
                  >
                    {message.suggestedFollowUp}
                  </Button>
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
          placeholder={isRecording ? "Listening..." : "Ask about patterns, travel..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 rounded-full h-9 text-sm"
          disabled={isRecording || isProcessing}
        />

        <Button onClick={() => handleSend()} disabled={isProcessing || !input.trim()} size="icon" className="h-9 w-9 rounded-full">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});

SmartTrack.displayName = 'SmartTrack';