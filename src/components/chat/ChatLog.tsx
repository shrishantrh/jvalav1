import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Sparkles, Bot, User } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  entryData?: Partial<FlareEntry>;
}

interface ChatLogProps {
  onSave: (entry: Partial<FlareEntry>) => void;
  userSymptoms?: string[];
  userConditions?: string[];
}

export const ChatLog = ({ onSave, userSymptoms = [], userConditions = [] }: ChatLogProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! How are you feeling? You can tell me about your symptoms, log a flare, or ask me anything about your health journey.",
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
      // Call the unified AI endpoint
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { 
          message: messageText,
          userSymptoms,
          userConditions,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
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
    <div className="flex flex-col h-[400px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-2 animate-fade-in",
              message.role === 'user' ? 'flex-row-reverse' : ''
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted'
            )}>
              {message.role === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
              message.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-md'
                : 'bg-muted rounded-tl-md'
            )}>
              <p>{message.content}</p>
              {message.entryData && (
                <div className="mt-2 pt-2 border-t border-current/10 text-xs opacity-75">
                  ✓ Entry logged: {message.entryData.type} 
                  {message.entryData.severity && ` • ${message.entryData.severity}`}
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-2 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-center border-t pt-3">
        <Button
          variant="outline"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            "h-10 w-10 flex-shrink-0 rounded-full transition-all",
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
          placeholder={isRecording ? "Listening..." : "Type how you're feeling..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 rounded-full h-10"
          disabled={isRecording || isProcessing}
        />

        <Button
          onClick={handleSend}
          disabled={isProcessing || !input.trim()}
          size="icon"
          className="h-10 w-10 rounded-full"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
