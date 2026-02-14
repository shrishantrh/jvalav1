import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Check, Plus, X } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  entryData?: Partial<FlareEntry>;
}

interface QuickTrackProps {
  onSave: (entry: Partial<FlareEntry>) => void;
  userSymptoms?: string[];
  userConditions?: string[];
  userId: string;
}

type Severity = 'mild' | 'moderate' | 'severe';

const STORAGE_KEY = 'jvala_chat_messages';

const COMMON_SYMPTOMS = [
  'Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Pain', 
  'Brain fog', 'Sensitivity', 'Cramping', 'Weakness'
];

export const QuickTrack = ({ onSave, userSymptoms = [], userConditions = [], userId }: QuickTrackProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1',
    role: 'assistant',
    content: "Hey! Tap severity or add symptoms below. I'm here if you want to chat.",
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // No localStorage persistence — health data stays in-memory only for privacy

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const allSymptoms = [...new Set([...userSymptoms, ...COMMON_SYMPTOMS])];

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleQuickLog = async (severity: Severity) => {
    // Create message content
    const symptomText = selectedSymptoms.length > 0 
      ? ` with ${selectedSymptoms.join(', ')}` 
      : '';
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `${severity.charAt(0).toUpperCase() + severity.slice(1)}${symptomText}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Create entry data
    const entry: Partial<FlareEntry> = {
      type: 'flare',
      severity,
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
      timestamp: new Date(),
    };

    // Collect environmental data
    try {
      const { getCurrentLocation, fetchWeatherData } = await import("@/services/weatherService");
      const location = await getCurrentLocation();
      if (location) {
        const weatherData = await fetchWeatherData(location.latitude, location.longitude);
        if (weatherData) {
          entry.environmentalData = weatherData;
        }
      }
    } catch (e) {
      console.log('Could not get location data');
    }

    // Save the entry
    onSave(entry);

    // Clear symptoms
    setSelectedSymptoms([]);
    setShowSymptoms(false);

    // Add confirmation (no AI)
    const responses = [
      "Got it, logged! 💜",
      "Tracked. Take care of yourself.",
      "Logged. Hope you feel better soon.",
      "Noted! Let me know how you're doing later.",
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
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { 
          message: messageText,
          userSymptoms,
          userConditions,
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
        content: data.response || "Got it!",
        timestamp: new Date(),
        entryData: data.entryData,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // If there's entry data, save it
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
            if (weatherData) {
              entry.environmentalData = weatherData;
            }
          }
        } catch (e) {
          console.log('Could not get location data');
        }

        onSave(entry);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, something went wrong. Try again?",
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
                {message.entryData && message.role === 'assistant' && (
                  <div className="mt-1.5 pt-1.5 border-t border-current/10 text-xs opacity-75 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {message.entryData.severity} logged
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
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => setShowSymptoms(false)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allSymptoms.slice(0, 12).map(symptom => (
              <Badge
                key={symptom}
                variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                className={cn(
                  "text-xs cursor-pointer transition-all",
                  selectedSymptoms.includes(symptom) && "bg-primary"
                )}
                onClick={() => toggleSymptom(symptom)}
              >
                {symptom}
              </Badge>
            ))}
          </div>
          {selectedSymptoms.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Selected: {selectedSymptoms.join(', ')}
            </p>
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
          {isRecording ? (
            <MicOff className="w-4 h-4 text-destructive" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>
        
        <Input
          placeholder={isRecording ? "Listening..." : "Ask me anything or describe how you feel..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 rounded-full h-9 text-sm"
          disabled={isRecording || isProcessing}
        />

        <Button
          onClick={handleSend}
          disabled={isProcessing || !input.trim()}
          size="icon"
          className="h-9 w-9 rounded-full"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
