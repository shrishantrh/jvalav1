import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Send, Sparkles, Loader2, X, Bell, CheckCircle2, Calendar, TrendingUp, Shield, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIVisualization, AIVisualizationRenderer } from "@/components/chat/AIVisualization";
import { useToast } from "@/hooks/use-toast";

interface StructuredDiscovery {
  factor: string;
  confidence: number;
  lift: number;
  occurrences: number;
  total: number;
  category: 'trigger' | 'protective' | 'investigating';
  summary?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  visualization?: AIVisualization;
  discoveries?: StructuredDiscovery[];
  followUp?: string;
  protocolSteps?: string[];
}

interface LimitlessAIChatProps {
  userId: string;
  initialPrompt?: string;
  onClose?: () => void;
  onNavigateToTrends?: () => void;
  isProtocolMode?: boolean;
}

// ─── Discovery Card ───
// Renders structured discovery data as compact visual cards

const DiscoveryCard = ({ discovery, onViewTrends }: { discovery: StructuredDiscovery; onViewTrends?: () => void }) => {
  const icon = discovery.category === 'trigger' ? TrendingUp : 
               discovery.category === 'protective' ? Shield : Search;
  const Icon = icon;
  const categoryColors = {
    trigger: { bg: 'hsl(350 80% 95%)', border: 'hsl(350 60% 85%)', icon: 'hsl(350 70% 50%)', bar: 'hsl(350 70% 55%)' },
    protective: { bg: 'hsl(150 60% 95%)', border: 'hsl(150 40% 85%)', icon: 'hsl(150 50% 40%)', bar: 'hsl(150 50% 45%)' },
    investigating: { bg: 'hsl(220 60% 95%)', border: 'hsl(220 40% 85%)', icon: 'hsl(220 50% 50%)', bar: 'hsl(220 50% 55%)' },
  };
  const colors = categoryColors[discovery.category];
  const summary = discovery.summary || `${discovery.occurrences}/${discovery.total} times a flare followed`;

  return (
    <div className="rounded-xl p-3 my-2" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${colors.icon}20` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: colors.icon }} />
        </div>
        <span className="text-sm font-semibold capitalize">{discovery.factor}</span>
      </div>
      
      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
        <span>{summary}</span>
        {discovery.lift > 1 && <span className="font-medium" style={{ color: colors.icon }}>{discovery.lift}× likely</span>}
      </div>

      {/* Confidence bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${discovery.confidence}%`, background: colors.bar }} />
        </div>
        <span className="text-[10px] font-medium" style={{ color: colors.icon }}>{discovery.confidence}%</span>
      </div>

      {/* View in Trends button */}
      {onViewTrends && (
        <button
          onClick={onViewTrends}
          className="flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:opacity-80"
          style={{ color: colors.icon }}
        >
          View in Trends
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// Also clean any leftover raw discovery blocks from text (fallback)
function cleanDiscoveryText(text: string): string {
  return text
    // Strip "💡 **Discovery: X**" blocks with their stat paragraphs
    .replace(/(?:💡\s*)?(?:\*{1,2})?Discovery:\s*[^\n]+\*{0,2}\n[\s\S]*?(?=(?:💡\s*)?(?:\*{1,2})?Discovery:|$)/gi, '')
    // Strip italic status lines like "_Confirmed • 63% confidence • 18 occurrences_"
    .replace(/_[A-Za-z]+\s*•\s*\d+%?\s*confidence\s*•\s*\d+\s*occurrences?_/gi, '')
    // Strip standalone "X out of Y times..." stat lines
    .replace(/^\d+\s*out\s*of\s*\d+\s*times?\s*\(\d+%\).*$/gm, '')
    // Clean up excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const MessageContent = ({ content, role, discoveries, onNavigateToTrends }: { content: string; role: string; discoveries?: StructuredDiscovery[]; onNavigateToTrends?: () => void }) => {
  // Clean any leftover raw discovery blocks from text
  const cleanText = cleanDiscoveryText(content);

  return (
    <div className="text-sm">
      {cleanText && (
        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ul]:mb-0 [&>ol]:mt-1 [&>ol]:mb-0">
          <ReactMarkdown>{cleanText}</ReactMarkdown>
        </div>
      )}
      {discoveries && discoveries.length > 0 && discoveries.map((d, i) => (
        <DiscoveryCard key={i} discovery={d} onViewTrends={onNavigateToTrends} />
      ))}
    </div>
  );
};

// Google Calendar logo as SVG
const GoogleCalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 4H17V2H15V4H9V2H7V4H6C4.9 4 4 4.9 4 6V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V6C20 4.9 19.1 4 18 4Z" fill="#4285F4"/>
    <path d="M18 20H6V9H18V20Z" fill="#FFFFFF"/>
    <path d="M8 11H11V14H8V11Z" fill="#EA4335"/>
    <path d="M13 11H16V14H13V11Z" fill="#FBBC04"/>
    <path d="M8 16H11V19H8V16Z" fill="#34A853"/>
    <path d="M13 16H16V19H13V16Z" fill="#4285F4"/>
  </svg>
);

export const LimitlessAIChat = ({ userId, initialPrompt, onClose, onNavigateToTrends, isProtocolMode = false }: LimitlessAIChatProps) => {
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
        discoveries: data.discoveries,
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
  };

  const handleAddToCalendar = (step: string, index: number) => {
    // Create a Google Calendar event URL
    const title = encodeURIComponent(`Health Protocol: Step ${index + 1}`);
    const details = encodeURIComponent(step);
    
    // Default to tomorrow at 9am
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    
    const startDate = tomorrow.toISOString().replace(/-|:|\.\d\d\d/g, '').slice(0, 15) + 'Z';
    tomorrow.setHours(10, 0, 0, 0);
    const endDate = tomorrow.toISOString().replace(/-|:|\.\d\d\d/g, '').slice(0, 15) + 'Z';
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startDate}/${endDate}`;
    
    window.open(calendarUrl, '_blank');
    toast({
      title: "📅 Opening Google Calendar",
      description: "Add this step to your schedule",
    });
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
                  <MessageContent content={msg.content} role={msg.role} discoveries={msg.discoveries} onNavigateToTrends={onClose} />

                  {msg.visualization && <AIVisualizationRenderer viz={msg.visualization} autoExpand={true} />}

                  {/* Protocol Steps with Reminder & Calendar Buttons */}
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
                            <div className="flex gap-1 mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] gap-1 px-2"
                                onClick={() => handleSetReminder(step)}
                              >
                                <Bell className="w-3 h-3" />
                                Remind
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] gap-1 px-2"
                                onClick={() => handleAddToCalendar(step, idx)}
                              >
                                <GoogleCalendarIcon />
                                Calendar
                              </Button>
                            </div>
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

      {/* Medical disclaimer */}
      <div className="px-4 py-1.5 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground text-center leading-tight">
          Not medical advice. Always consult your doctor before making health decisions.
        </p>
      </div>

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