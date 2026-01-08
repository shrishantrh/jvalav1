import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { 
  Brain, 
  Send, 
  Sparkles, 
  BarChart3, 
  PieChart,
  TrendingUp,
  Activity,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line, Tooltip } from "recharts";

interface Message {
  role: "user" | "assistant";
  content: string;
  visualization?: {
    type: string;
    title: string;
    data: any[];
    config?: any;
  };
  followUp?: string;
}

interface LimitlessAIChatProps {
  userId: string;
}

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--severity-moderate))", "hsl(var(--severity-severe))", "#8b5cf6", "#10b981", "#f59e0b"];

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
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("limitless-ai", {
        body: { query: input, userId },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response || "I'm here to help with your health patterns.",
        visualization: data.visualization,
        followUp: data.followUp,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error("AI error:", err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I had trouble processing that. Try again?",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderVisualization = (viz: Message["visualization"]) => {
    if (!viz || !viz.data || viz.data.length === 0) return null;

    const height = 180;

    switch (viz.type) {
      case "bar_chart":
      case "symptom_frequency":
      case "trigger_frequency":
        return (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
            <h4 className="text-xs font-medium mb-2">{viz.title}</h4>
            <ResponsiveContainer width="100%" height={height}>
              <BarChart data={viz.data} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case "pie_chart":
      case "severity_breakdown":
        return (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
            <h4 className="text-xs font-medium mb-2">{viz.title}</h4>
            <ResponsiveContainer width="100%" height={height}>
              <RePieChart>
                <Pie
                  data={viz.data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {viz.data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        );

      case "line_chart":
      case "timeline":
        return (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
            <h4 className="text-xs font-medium mb-2">{viz.title}</h4>
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={viz.data}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case "pattern_summary":
        return (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-2">
            <h4 className="text-xs font-medium">{viz.title}</h4>
            {viz.data.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span>{item.label}</span>
                <span className="font-medium">{item.value}{item.extra ? ` ${item.extra}` : ""}</span>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
            <h4 className="text-xs font-medium mb-2">{viz.title}</h4>
            <div className="text-xs text-muted-foreground">
              {JSON.stringify(viz.data.slice(0, 5), null, 2)}
            </div>
          </div>
        );
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
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  
                  {msg.visualization && renderVisualization(msg.visualization)}
                  
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
