import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Check, Plus, X, Sparkles } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  entryData?: Partial<FlareEntry>;
  isAIGenerated?: boolean;
  dataUsed?: string[];
}

interface SmartTrackProps {
  onSave: (entry: Partial<FlareEntry>) => void;
  userSymptoms?: string[];
  userConditions?: string[];
  userTriggers?: string[];
  recentEntries?: any[];
  userId: string;
}

export interface SmartTrackRef {
  addDetailedEntry: (entry: Partial<FlareEntry>) => void;
}

type Severity = 'mild' | 'moderate' | 'severe';

const STORAGE_KEY = 'jvala_smart_chat';

const COMMON_SYMPTOMS = [
  'Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Pain', 
  'Brain fog', 'Sensitivity', 'Cramping', 'Weakness'
];

export const SmartTrack = forwardRef<SmartTrackRef, SmartTrackProps>(({ 
  onSave, 
  userSymptoms = [], 
  userConditions = [], 
  userTriggers = [],
  recentEntries = [],
  userId 
}, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch { }
    }
    return [{
      id: '1',
      role: 'assistant',
      content: "Hey! Quick log below, or ask me anything about your health patterns.",
      timestamp: new Date(),
    }];
  });
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Expose method to add detailed entry as a message
  useImperativeHandle(ref, () => ({
    addDetailedEntry: (entry: Partial<FlareEntry>) => {
      // Build user message describing what was logged
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
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(messages));
  }, [messages, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  const allSymptoms = [...new Set([...userSymptoms, ...COMMON_SYMPTOMS])];

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );
  };

  const handleQuickLog = async (severity: Severity) => {
    const symptomText = selectedSymptoms.length > 0 
      ? ` with ${selectedSymptoms.join(', ')}` : '';
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `${severity.charAt(0).toUpperCase() + severity.slice(1)}${symptomText}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    const entry: Partial<FlareEntry> = {
      type: 'flare',
      severity,
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
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
    setSelectedSymptoms([]);
    setShowSymptoms(false);

    const responses = [
      "Logged! 💜 Take care.",
      "Got it. Hope you feel better soon.",
      "Tracked. Rest up if you need to.",
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

  const handleSend = async () => {
    const messageText = input.trim();
    if (!messageText || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
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
        recentEntries: recentEntries.slice(0, 30).map(e => ({
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
          message: messageText,
          userContext,
          history: messages.slice(-6).map(m => ({ 
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
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.entryData && data.shouldLog) {
        const entry: Partial<FlareEntry> = {
          ...data.entryData,
          note: messageText,
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
    <div className="flex flex-col h-[460px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
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
                <p>{message.content}</p>
                
                {/* AI Generated indicator */}
                {message.role === 'assistant' && message.isAIGenerated && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>AI-generated</span>
                    {message.dataUsed && message.dataUsed.length > 0 && (
                      <span className="opacity-60">• Using: {message.dataUsed.join(', ')}</span>
                    )}
                  </div>
                )}
                
                {message.entryData && message.role === 'assistant' && (
                  <div className="mt-1.5 pt-1.5 border-t border-current/10 text-xs opacity-75 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {message.entryData.severity || message.entryData.type} logged
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

      {/* Symptom Selection */}
      {showSymptoms && (
        <div className="mb-3 p-3 bg-muted/30 rounded-xl border animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Add symptoms (optional)</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowSymptoms(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allSymptoms.slice(0, 12).map(symptom => (
              <Badge
                key={symptom}
                variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                className={cn("text-xs cursor-pointer transition-all", selectedSymptoms.includes(symptom) && "bg-primary")}
                onClick={() => toggleSymptom(symptom)}
              >
                {symptom}
              </Badge>
            ))}
          </div>
          {selectedSymptoms.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">Selected: {selectedSymptoms.join(', ')}</p>
          )}
        </div>
      )}

      {/* Quick Log Buttons */}
      <div className="flex gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickLog('mild')}
          disabled={isProcessing}
          className="flex-1 h-10 border-severity-mild/50 hover:bg-severity-mild/20 hover:border-severity-mild text-xs font-medium"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-severity-mild mr-2" />
          Mild
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickLog('moderate')}
          disabled={isProcessing}
          className="flex-1 h-10 border-severity-moderate/50 hover:bg-severity-moderate/20 hover:border-severity-moderate text-xs font-medium"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-severity-moderate mr-2" />
          Moderate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickLog('severe')}
          disabled={isProcessing}
          className="flex-1 h-10 border-severity-severe/50 hover:bg-severity-severe/20 hover:border-severity-severe text-xs font-medium"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-severity-severe mr-2" />
          Severe
        </Button>
      </div>

      {/* Symptom Toggle */}
      {!showSymptoms && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSymptoms(true)}
          className="mb-3 text-xs text-muted-foreground h-8"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add symptoms to log
        </Button>
      )}

      {/* Input */}
      <div className="flex gap-2 items-center border-t pt-3">
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
          placeholder={isRecording ? "Listening..." : "Ask about patterns, travel risks, triggers..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 rounded-full h-9 text-sm"
          disabled={isRecording || isProcessing}
        />

        <Button onClick={handleSend} disabled={isProcessing || !input.trim()} size="icon" className="h-9 w-9 rounded-full">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});

SmartTrack.displayName = 'SmartTrack';
