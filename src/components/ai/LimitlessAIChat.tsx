import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Send, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIVisualization, AIVisualizationRenderer } from "@/components/chat/AIVisualization";

interface Message {
  role: "user" | "assistant";
  content: string;
  visualization?: AIVisualization;
  followUp?: string;
}

interface LimitlessAIChatProps {
  userId: string;
}

export const LimitlessAIChat = ({ userId }: LimitlessAIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("limitless-ai", {
        body: { query: userMessage.content, userId },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response || "I'm here to help with your health patterns.",
        visualization: data.visualization,
        followUp: data.followUp,
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

  const quickPrompts = [
    { label: "My patterns", query: "What patterns do you see in my data?" },
    { label: "This week", query: "How am I doing this week compared to last?" },
    { label: "Triggers", query: "What are my top triggers and how confident are you?" },
    { label: "Predict", query: "What's my flare risk today?" },
  ];

  return (
    <Card className="flex flex-col h-[500px] bg-gradient-card border-0 shadow-soft-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b bg-background/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Brain className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Limitless AI</h3>
          <p className="text-[10px] text-muted-foreground">Ask me anything about your health</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">What would you like to know?</h4>
              <p className="text-xs text-muted-foreground mt-1">
                I can analyze patterns, generate charts, predict risks, and more.
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
                    setTimeout(() => handleSend(), 100);
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

                  {msg.followUp && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs w-full justify-start"
                      onClick={() => {
                        setInput(msg.followUp!);
                        setTimeout(() => handleSend(), 100);
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
            placeholder="Ask anything..."
            className="flex-1"
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
