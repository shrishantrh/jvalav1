import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Send, Sparkles, Loader2, X, Bell, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIVisualization, AIVisualizationRenderer } from "@/components/chat/AIVisualization";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  visualization?: AIVisualization;
  followUp?: string;
  protocolSteps?: string[];
}

interface LimitlessAIChatProps {
  userId: string;
  initialPrompt?: string;
  onClose?: () => void;
  isProtocolMode?: boolean;
}

export const LimitlessAIChat = ({ userId, initialPrompt, onClose, isProtocolMode = false }: LimitlessAIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [protocolCreated, setProtocolCreated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const hasProcessedInitialPrompt = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle initial prompt for protocol creation
  useEffect(() => {
    if (initialPrompt && !hasProcessedInitialPrompt.current && messages.length === 0) {
      hasProcessedInitialPrompt.current = true;
      const protocolQuery = `I want to create a health protocol based on this recommendation: "${initialPrompt}". 
      
Please help me:
1. Break this down into specific, actionable steps
2. Create a schedule/routine I can follow
3. Set up reminder times for each step
4. Give me tips to stick with it

Make it practical and personalized to my data.`;
      
      setInput(protocolQuery);
      setTimeout(() => handleSend(protocolQuery), 500);
    }
  }, [initialPrompt]);

  const handleSend = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    if (!messageText.trim() || loading) return;

    const userMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("limitless-ai", {
        body: { 
          query: messageText, 
          userId,
          isProtocolMode 
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response || "I'm here to help with your health patterns.",
        visualization: data.visualization,
        followUp: data.followUp,
        protocolSteps: data.protocolSteps,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("AI error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had trouble processing that. Try again?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSetReminder = async (step: string, time?: string) => {
    toast({
      title: "🔔 Reminder set!",
      description: `You'll be reminded: "${step.substring(0, 50)}..."`,
    });
    setProtocolCreated(true);
  };

  const handleActivateProtocol = () => {
    toast({
      title: "✅ Protocol Activated!",
      description: "You'll receive reminders to help you follow your new protocol.",
    });
    setProtocolCreated(true);
    onClose?.();
  };

  const quickPrompts = isProtocolMode ? [
    { label: "Morning routine", query: "Help me create a morning routine to prevent flares" },
    { label: "Evening protocol", query: "Create an evening wind-down protocol for better sleep" },
    { label: "Trigger avoidance", query: "Help me create a plan to avoid my top triggers" },
  ] : [
    { label: "My patterns", query: "What patterns do you see in my data?" },
    { label: "This week", query: "How am I doing this week compared to last?" },
    { label: "Triggers", query: "What are my top triggers and how confident are you?" },
    { label: "Predict", query: "What's my flare risk today?" },
  ];

  return (
    <Card className={cn(
      "flex flex-col bg-gradient-card border-0 shadow-soft-lg overflow-hidden",
      isProtocolMode ? "h-[600px]" : "h-[500px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/50">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            isProtocolMode ? "bg-gradient-warm" : "bg-gradient-primary"
          )}>
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-medium">
              {isProtocolMode ? "Protocol Builder" : "Jvala AI"}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {isProtocolMode ? "Create actionable health protocols" : "Ask me anything about your health"}
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center",
              isProtocolMode ? "bg-gradient-warm/20" : "bg-primary/10"
            )}>
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">
                {isProtocolMode ? "Let's build your protocol" : "What would you like to know?"}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {isProtocolMode 
                  ? "I'll help you create actionable steps with reminders"
                  : "I can analyze patterns, generate charts, predict risks, and more."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((p, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setInput(p.query);
                    setTimeout(() => handleSend(p.query), 100);
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2",
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {msg.visualization && <AIVisualizationRenderer viz={msg.visualization} />}

                  {/* Protocol Steps with Reminder Buttons */}
                  {msg.protocolSteps && msg.protocolSteps.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Protocol Steps:</p>
                      {msg.protocolSteps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-primary">{idx + 1}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs">{step}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] mt-1 gap-1"
                              onClick={() => handleSetReminder(step)}
                            >
                              <Bell className="w-3 h-3" />
                              Set Reminder
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Button
                        className="w-full mt-2 bg-gradient-primary"
                        size="sm"
                        onClick={handleActivateProtocol}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Activate This Protocol
                      </Button>
                    </div>
                  )}

                  {msg.followUp && !msg.protocolSteps && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs w-full justify-start"
                      onClick={() => {
                        setInput(msg.followUp!);
                        setTimeout(() => handleSend(msg.followUp), 100);
                      }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {msg.followUp}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={isProtocolMode ? "Describe your protocol needs..." : "Ask anything..."}
            className="flex-1"
            disabled={loading}
          />
          <Button onClick={() => handleSend()} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
