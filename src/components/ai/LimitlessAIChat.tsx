import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain, Send, Sparkles, Loader2, X, Bell, CheckCircle2, Calendar,
  TrendingUp, Shield, Search, ArrowRight, Mic, MicOff, Zap, MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIVisualization, AIVisualizationRenderer } from "@/components/chat/AIVisualization";
import { AIChatPrompts, generateFollowUps } from "@/components/chat/AIChatPrompts";
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
  dynamicFollowUps?: string[];
  protocolSteps?: string[];
  proactiveInsight?: string;
  loggedEntry?: { type: string; severity?: string; symptoms?: string[] };
  isStreaming?: boolean;
}

interface LimitlessAIChatProps {
  userId: string;
  initialPrompt?: string;
  onClose?: () => void;
  onNavigateToTrends?: () => void;
  isProtocolMode?: boolean;
}

// ─── Discovery Card ───
const DiscoveryCard = ({ discovery, onViewTrends }: { discovery: StructuredDiscovery; onViewTrends?: () => void }) => {
  const Icon = discovery.category === 'trigger' ? TrendingUp :
               discovery.category === 'protective' ? Shield : Search;
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
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
        <span>{summary}</span>
        {discovery.lift > 1 && <span className="font-medium" style={{ color: colors.icon }}>{discovery.lift}× likely</span>}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${discovery.confidence}%`, background: colors.bar }} />
        </div>
        <span className="text-[10px] font-medium" style={{ color: colors.icon }}>{discovery.confidence}%</span>
      </div>
      {onViewTrends && (
        <button onClick={onViewTrends} className="flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:opacity-80" style={{ color: colors.icon }}>
          View in Trends <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

function cleanDiscoveryText(text: string): string {
  return text
    .replace(/(?:💡\s*)?(?:\*{1,2})?Discovery:\s*[^\n]+\*{0,2}\n[\s\S]*?(?=(?:💡\s*)?(?:\*{1,2})?Discovery:|$)/gi, '')
    .replace(/_[A-Za-z]+\s*•\s*\d+%?\s*confidence\s*•\s*\d+\s*occurrences?_/gi, '')
    .replace(/^\d+\s*out\s*of\s*\d+\s*times?\s*\(\d+%\).*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const RichTextLine = ({ text }: { text: string }) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} style={{ fontWeight: 700 }}>{part}</strong> : <span key={i}>{part}</span>
      )}
    </>
  );
};

const MessageContent = ({ content, role, discoveries, onNavigateToTrends }: { content: string; role: string; discoveries?: StructuredDiscovery[]; onNavigateToTrends?: () => void }) => {
  let cleanText = cleanDiscoveryText(content).replace(/\\\*/g, '*');
  const paragraphs = cleanText.split('\n').filter(Boolean);

  return (
    <div className="text-sm">
      {cleanText && (
        <div className="space-y-1.5">
          {paragraphs.map((p, i) => (
            <p key={i} className="m-0 leading-relaxed">
              <RichTextLine text={p} />
            </p>
          ))}
        </div>
      )}
      {discoveries && discoveries.length > 0 && discoveries.map((d, i) => (
        <DiscoveryCard key={i} discovery={d} onViewTrends={onNavigateToTrends} />
      ))}
    </div>
  );
};

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

// ─── Streaming SSE helper ───
async function streamChatSSE({
  message,
  userId,
  history,
  isProtocolMode,
  onDelta,
  onComplete,
  onError,
}: {
  message: string;
  userId: string;
  history: { role: string; content: string }[];
  isProtocolMode: boolean;
  onDelta: (chunk: string) => void;
  onComplete: (fullResponse: any) => void;
  onError: (err: Error) => void;
}) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`;
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) { onError(new Error("Not authenticated")); return; }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        message,
        userId,
        history,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isProtocolMode,
        stream: true,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let parsed: any;
      try { parsed = JSON.parse(errText); } catch { parsed = { response: errText }; }
      if (resp.status === 429) { onError(new Error("Rate limited — try again in a moment")); return; }
      if (resp.status === 402) { onError(new Error("AI credits exhausted")); return; }
      // Non-streaming response (JSON)
      onComplete(parsed);
      return;
    }

    const contentType = resp.headers.get("content-type") || "";
    
    // If server returned JSON (non-streaming fallback)
    if (contentType.includes("application/json")) {
      const data = await resp.json();
      onComplete(data);
      return;
    }

    // SSE streaming
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let toolArgs = "";
    let toolName = "";
    let contentAccum = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) { contentAccum += delta.content; onDelta(delta.content); }
          if (delta.tool_calls?.[0]) {
            const tc = delta.tool_calls[0];
            if (tc.function?.name) toolName = tc.function.name;
            if (tc.function?.arguments) toolArgs += tc.function.arguments;
          }
        } catch { /* partial */ }
      }
    }

    // Parse tool call result
    if (toolName === "respond" && toolArgs) {
      try {
        const parsed = JSON.parse(toolArgs);
        onComplete({
          response: (parsed.response || contentAccum || "").replace(/\\\*/g, '*'),
          shouldLog: Boolean(parsed.shouldLog),
          entryData: parsed.entryData ?? null,
          visualization: parsed.visualization ?? null,
          emotionalTone: parsed.emotionalTone ?? "neutral",
          discoveries: parsed.discoveries ?? [],
          dynamicFollowUps: parsed.dynamicFollowUps ?? [],
          proactiveInsight: parsed.proactiveInsight ?? null,
          protocolSteps: parsed.protocolSteps ?? [],
        });
        return;
      } catch { /* fall through */ }
    }

    // Fallback
    onComplete({
      response: contentAccum || "Tell me more about how you're feeling.",
      shouldLog: false, entryData: null, visualization: null, emotionalTone: "neutral",
      discoveries: [], dynamicFollowUps: [],
    });

  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export const LimitlessAIChat = ({ userId, initialPrompt, onClose, onNavigateToTrends, isProtocolMode = false }: LimitlessAIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [protocolCreated, setProtocolCreated] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(true);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const hasProcessedInitialPrompt = useRef(false);
  const hasFetchedBriefing = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch memory count on mount
  useEffect(() => {
    (async () => {
      const { count } = await supabase.from("ai_memories").select("id", { count: "exact", head: true }).eq("user_id", userId);
      setMemoryCount(count);
    })();
  }, [userId]);

  // Handle initial prompt
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

  // Auto-log health complaints from AI response
  const autoLogEntry = useCallback(async (entryData: any) => {
    if (!entryData || entryData.type !== "flare") return;
    try {
      const { error } = await supabase.from("flare_entries").insert({
        user_id: userId,
        entry_type: "flare",
        severity: entryData.severity || "moderate",
        symptoms: entryData.symptoms || [],
        triggers: entryData.triggers || [],
        medications: entryData.medications || [],
        note: entryData.notes || null,
        energy_level: entryData.energyLevel || null,
        timestamp: new Date().toISOString(),
      });
      if (!error) {
        toast({
          title: "📝 Logged from conversation",
          description: `${entryData.severity || "moderate"} flare${entryData.symptoms?.length ? ` — ${entryData.symptoms.slice(0, 2).join(", ")}` : ""}`,
        });
      }
    } catch (e) {
      console.error("Auto-log error:", e);
    }
  }, [userId, toast]);

  const handleSend = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    if (!messageText.trim() || loading) return;

    const userMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setShowCapabilities(false);

    const historyForAI = messages
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }))
      .filter((m): m is { role: 'user' | 'assistant'; content: string } => m.role === 'user' || m.role === 'assistant');

    // Add streaming assistant placeholder
    setMessages(prev => [...prev, { role: "assistant", content: "", isStreaming: true }]);

    try {
      await streamChatSSE({
        message: messageText,
        userId,
        history: historyForAI,
        isProtocolMode,
        onDelta: (chunk) => {
          // Token-by-token update to last assistant message
          setMessages(prev => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg?.role === "assistant") {
              updated[updated.length - 1] = { ...lastMsg, content: lastMsg.content + chunk };
            }
            return updated;
          });
        },
        onComplete: (data) => {
          const assistantMessage: Message = {
            role: "assistant",
            content: data.response || "I'm here to help with your health patterns.",
            visualization: data.visualization,
            discoveries: data.discoveries,
            followUp: data.dynamicFollowUps?.[0] || data.followUp,
            dynamicFollowUps: data.dynamicFollowUps || generateFollowUps(data.response || "", !!data.visualization),
            protocolSteps: data.protocolSteps,
            proactiveInsight: data.proactiveInsight,
            loggedEntry: data.shouldLog ? data.entryData : undefined,
            isStreaming: false,
          };

          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = assistantMessage;
            return updated;
          });

          // Auto-log if AI detected a health complaint
          if (data.shouldLog && data.entryData) {
            autoLogEntry(data.entryData);
          }

          setLoading(false);
        },
        onError: (err) => {
          console.error("AI error:", err);
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: err.message.includes("Rate limited") 
                ? "⏳ Too many requests — wait a moment and try again."
                : err.message.includes("credits")
                ? "💳 AI credits need topping up in your workspace settings."
                : "Sorry, I had trouble processing that. Try again?",
              isStreaming: false,
            };
            return updated;
          });
          setLoading(false);
        },
      });
    } catch (err) {
      console.error("AI error:", err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, I had trouble processing that. Try again?", isStreaming: false };
        return updated;
      });
      setLoading(false);
    }
  };

  const handleSetReminder = async (step: string) => {
    toast({ title: "🔔 Reminder set!", description: `You'll be reminded: "${step.substring(0, 50)}..."` });
  };

  const handleAddToCalendar = (step: string, index: number) => {
    const title = encodeURIComponent(`Health Protocol: Step ${index + 1}`);
    const details = encodeURIComponent(step);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const startDate = tomorrow.toISOString().replace(/-|:|\.\d\d\d/g, '').slice(0, 15) + 'Z';
    tomorrow.setHours(10, 0, 0, 0);
    const endDate = tomorrow.toISOString().replace(/-|:|\.\d\d\d/g, '').slice(0, 15) + 'Z';
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startDate}/${endDate}`;
    window.open(calendarUrl, '_blank');
    toast({ title: "📅 Opening Google Calendar", description: "Add this step to your schedule" });
  };

  const handleActivateProtocol = () => {
    toast({ title: "✅ Protocol Activated!", description: "You'll receive reminders to help you follow your new protocol." });
    setProtocolCreated(true);
    onClose?.();
  };

  const quickPrompts = isProtocolMode ? [
    { label: "Morning routine", query: "Help me create a morning routine to prevent flares" },
    { label: "Evening protocol", query: "Create an evening wind-down protocol for better sleep" },
    { label: "Trigger avoidance", query: "Help me create a plan to avoid my top triggers" },
  ] : [
    { label: "Daily briefing", query: "Give me my daily health briefing — how am I doing, what's my risk, and what should I focus on today?" },
    { label: "My patterns", query: "What patterns do you see in my data?" },
    { label: "This week", query: "How am I doing this week compared to last?" },
    { label: "Predict", query: "What's my flare risk today?" },
  ];

  // Get the last assistant message for dynamic follow-ups
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant" && !m.isStreaming);
  const dynamicFollowUps = lastAssistantMsg?.dynamicFollowUps || [];

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
              {memoryCount !== null && memoryCount > 0
                ? `${memoryCount} memories · knows your patterns`
                : isProtocolMode ? "Create actionable health protocols" : "Ask me anything about your health"}
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
                  : "I analyze patterns, generate charts, predict risks, and auto-log from our conversation."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((p, i) => (
                <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => { setInput(p.query); setTimeout(() => handleSend(p.query), 100); }}>
                  {p.label}
                </Button>
              ))}
            </div>
            {/* Capability chips */}
            {!isProtocolMode && (
              <div className="w-full mt-2">
                <AIChatPrompts onSendPrompt={(prompt) => { setInput(prompt); setTimeout(() => handleSend(prompt), 100); }} />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {msg.isStreaming && !msg.content ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Thinking...</span>
                    </div>
                  ) : (
                    <MessageContent content={msg.content} role={msg.role} discoveries={msg.discoveries} onNavigateToTrends={onClose} />
                  )}

                  {msg.visualization && !msg.isStreaming && <AIVisualizationRenderer viz={msg.visualization} autoExpand={true} />}

                  {msg.proactiveInsight && !msg.isStreaming && (
                    <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">💡 {msg.proactiveInsight}</p>
                    </div>
                  )}

                  {/* Logged entry badge */}
                  {msg.loggedEntry && !msg.isStreaming && (
                    <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        Auto-logged: {msg.loggedEntry.severity} {msg.loggedEntry.type}
                        {msg.loggedEntry.symptoms?.length ? ` — ${msg.loggedEntry.symptoms.slice(0, 2).join(", ")}` : ""}
                      </span>
                    </div>
                  )}

                  {/* Protocol Steps */}
                  {msg.protocolSteps && msg.protocolSteps.length > 0 && !msg.isStreaming && (
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
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => handleSetReminder(step)}>
                                <Bell className="w-3 h-3" /> Remind
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => handleAddToCalendar(step, idx)}>
                                <GoogleCalendarIcon /> Calendar
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button className="w-full mt-2 bg-gradient-primary" size="sm" onClick={handleActivateProtocol}>
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Activate This Protocol
                      </Button>
                    </div>
                  )}

                  {msg.followUp && !msg.protocolSteps && !msg.isStreaming && (
                    <Button variant="ghost" size="sm" className="mt-2 text-xs w-full justify-start" onClick={() => { setInput(msg.followUp!); setTimeout(() => handleSend(msg.followUp), 100); }}>
                      <Sparkles className="w-3 h-3 mr-1" /> {msg.followUp}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Dynamic follow-up chips after last assistant message */}
            {dynamicFollowUps.length > 0 && !loading && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                {dynamicFollowUps.slice(0, 4).map((fu, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(fu); setTimeout(() => handleSend(fu), 100); }}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                      "bg-primary/10 hover:bg-primary/20 border border-primary/20",
                      "text-xs font-medium text-primary transition-all"
                    )}
                  >
                    <Zap className="w-3 h-3" />
                    {fu.length > 40 ? fu.slice(0, 40) + '...' : fu}
                  </button>
                ))}
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Capability chips when chat has messages */}
      {messages.length > 0 && !loading && showCapabilities === false && (
        <div className="px-4 pb-1">
          <AIChatPrompts onSendPrompt={(prompt) => { setInput(prompt); setTimeout(() => handleSend(prompt), 100); }} />
        </div>
      )}

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
            placeholder={isProtocolMode ? "Describe your protocol needs..." : "Tell me anything — I'll log it if it's health-related"}
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
