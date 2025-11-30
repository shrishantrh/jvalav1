import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Bot, User, Check, Flame } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  entryData?: Partial<FlareEntry>;
  isQuickLog?: boolean;
}

interface ChatLogProps {
  onSave: (entry: Partial<FlareEntry>) => void;
  userSymptoms?: string[];
  userConditions?: string[];
}

type Severity = 'mild' | 'moderate' | 'severe';

export const ChatLog = ({ onSave, userSymptoms = [], userConditions = [] }: ChatLogProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "How are you feeling? Tap a button to quick log, or type/speak to chat.",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const handleQuickLog = async (severity: Severity) => {
    // Add as user message
    const severityEmoji = severity === 'mild' ? '🟡' : severity === 'moderate' ? '🟠' : '🔴';
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `${severityEmoji} ${severity.charAt(0).toUpperCase() + severity.slice(1)} flare`,
      timestamp: new Date(),
      isQuickLog: true,
    };
    setMessages(prev => [...prev, userMessage]);

    // Create entry data
    const entry: Partial<FlareEntry> = {
      type: 'flare',
      severity,
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

    // Add system confirmation (no AI call needed)
    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'system',
      content: `✓ Logged`,
      timestamp: new Date(),
      entryData: entry,
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleSend = async () => {
    const messageText = input.trim();
    if (!messageText || isProcessing) return;

    // Add user message
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
      // Call the AI endpoint
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { 
          message: messageText,
          userSymptoms,
          userConditions,
          history: messages.slice(-6).map(m => ({ role: m.role === 'system' ? 'assistant' : m.role, content: m.content }))
        }
      });

      if (error) throw error;

      // Add assistant response
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

        onSave(entry);
      }
    } catch (error) {
      console.error('Chat error:', error);
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
    <div className="flex flex-col h-[420px]">
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
              <>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                )}>
                  {message.role === 'user' ? (
                    <User className="w-3 h-3" />
                  ) : (
                    <Bot className="w-3 h-3" />
                  )}
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-md'
                    : 'bg-muted rounded-tl-md',
                  message.isQuickLog && 'font-medium'
                )}>
                  <p>{message.content}</p>
                  {message.entryData && message.role === 'assistant' && (
                    <div className="mt-1.5 pt-1.5 border-t border-current/10 text-xs opacity-75">
                      ✓ {message.entryData.type} logged
                      {message.entryData.severity && ` • ${message.entryData.severity}`}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-2 animate-fade-in">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-3 h-3 animate-pulse" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-md px-3 py-2">
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

      {/* Quick Log Buttons */}
      <div className="flex gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickLog('mild')}
          disabled={isProcessing}
          className="flex-1 h-9 border-severity-mild/50 hover:bg-severity-mild/10 hover:border-severity-mild text-xs font-medium"
        >
          <span className="w-2 h-2 rounded-full bg-severity-mild mr-1.5" />
          Mild
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickLog('moderate')}
          disabled={isProcessing}
          className="flex-1 h-9 border-severity-moderate/50 hover:bg-severity-moderate/10 hover:border-severity-moderate text-xs font-medium"
        >
          <span className="w-2 h-2 rounded-full bg-severity-moderate mr-1.5" />
          Moderate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickLog('severe')}
          disabled={isProcessing}
          className="flex-1 h-9 border-severity-severe/50 hover:bg-severity-severe/10 hover:border-severity-severe text-xs font-medium"
        >
          <span className="w-2 h-2 rounded-full bg-severity-severe mr-1.5" />
          Severe
        </Button>
      </div>

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
          placeholder={isRecording ? "Listening..." : "Ask anything or describe how you feel..."}
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