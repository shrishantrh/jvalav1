import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { Send, Mic, MicOff, Bot, User, Check, Flame, BarChart3 } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface Visualization {
  type: string;
  title: string;
  data: any[];
  insight?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  entryData?: Partial<FlareEntry>;
  isQuickLog?: boolean;
  visualization?: Visualization;
  confidence?: number;
  evidenceSources?: string[];
  suggestedFollowUp?: string;
}

interface ChatLogProps {
  onSave: (entry: Partial<FlareEntry>) => void;
  userSymptoms?: string[];
  userConditions?: string[];
  userId?: string;
}

type Severity = 'mild' | 'moderate' | 'severe';

const CHART_COLORS = [
  'hsl(280, 70%, 55%)',
  'hsl(320, 70%, 55%)',
  'hsl(200, 70%, 55%)',
  'hsl(150, 70%, 55%)',
  'hsl(40, 70%, 55%)',
  'hsl(0, 70%, 55%)',
];

const SEVERITY_COLORS = {
  mild: 'hsl(42, 85%, 55%)',
  moderate: 'hsl(25, 85%, 58%)',
  severe: 'hsl(355, 75%, 52%)',
};

const VisualizationRenderer = ({ visualization }: { visualization: Visualization }) => {
  const { type, title, data, insight } = visualization;

  if (!data || data.length === 0) return null;

  const renderChart = () => {
    switch (type) {
      case 'severity_breakdown':
        return (
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={45}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color || SEVERITY_COLORS[entry.name?.toLowerCase() as keyof typeof SEVERITY_COLORS] || CHART_COLORS[index % CHART_COLORS.length]} 
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'symptom_frequency':
      case 'trigger_frequency':
      case 'weather_correlation':
        return (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={60} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'timeline':
      case 'weekly_trend':
      case 'hrv_trend':
        return (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey={data[0]?.value !== undefined ? 'value' : 'count'} 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'time_of_day':
        return (
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="period" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'medication_log':
      case 'medication_adherence':
        return (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {data.slice(0, 6).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-1 px-2 bg-background/50 rounded text-xs">
                <span className="font-medium">{item.medication || item.date}</span>
                <span className="text-muted-foreground">{item.time || item.adherence + '%'}</span>
              </div>
            ))}
          </div>
        );

      case 'trigger_severity_matrix':
        return (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="trigger" tick={{ fontSize: 8 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="severe" stackId="a" fill={SEVERITY_COLORS.severe} />
              <Bar dataKey="moderate" stackId="a" fill={SEVERITY_COLORS.moderate} />
              <Bar dataKey="mild" stackId="a" fill={SEVERITY_COLORS.mild} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'monthly_comparison':
      case 'comparative_analysis':
        return (
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="metric" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="thisWeek" fill="hsl(var(--primary))" name="This Period" />
              <Bar dataKey="lastWeek" fill="hsl(var(--muted-foreground))" name="Last Period" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pattern_summary':
      case 'health_score':
        return (
          <div className="grid grid-cols-2 gap-2">
            {data.map((item, idx) => (
              <div key={idx} className="p-2 bg-background/50 rounded text-center">
                <span className="text-lg font-bold block">{item.value}</span>
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        );

      default:
        // Fallback: simple bar chart for any data with name/count or similar
        if (data[0]?.count !== undefined) {
          return (
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          );
        }
        return (
          <div className="p-2 bg-background/50 rounded text-xs">
            {JSON.stringify(data).slice(0, 100)}...
          </div>
        );
    }
  };

  return (
    <Card className="mt-2 p-3 bg-background/60 border border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium">{title}</span>
      </div>
      {renderChart()}
      {insight && (
        <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/30">
          💡 {insight}
        </p>
      )}
    </Card>
  );
};

export const ChatLog = ({ onSave, userSymptoms = [], userConditions = [], userId }: ChatLogProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "How are you feeling? Tap a button to quick log, or ask me anything about your health data.",
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
    const severityEmoji = severity === 'mild' ? '🟡' : severity === 'moderate' ? '🟠' : '🔴';
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `${severityEmoji} ${severity.charAt(0).toUpperCase() + severity.slice(1)} flare`,
      timestamp: new Date(),
      isQuickLog: true,
    };
    setMessages(prev => [...prev, userMessage]);

    const entry: Partial<FlareEntry> = {
      type: 'flare',
      severity,
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
      const historyForAI = messages
        .slice(-20)
        .map((m) => ({ role: m.role === 'system' ? 'assistant' : m.role, content: m.content }))
        // The backend only expects user/assistant roles
        .filter((m): m is { role: 'user' | 'assistant'; content: string } => m.role === 'user' || m.role === 'assistant');

      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: {
          message: messageText,
          userSymptoms,
          userConditions,
          userId,
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          history: historyForAI,
        },
      });

      if (error) throw error;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "Got it!",
        timestamp: new Date(),
        entryData: data.entryData,
        visualization: data.visualization,
        confidence: data.confidence,
        evidenceSources: data.evidenceSources,
        suggestedFollowUp: data.suggestedFollowUp,
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
    <div className="flex flex-col h-[480px]">
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
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-md'
                    : 'bg-muted rounded-tl-md',
                  message.isQuickLog && 'font-medium'
                )}>
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ul]:mb-0 [&>ol]:mt-1 [&>ol]:mb-0">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  {message.entryData && message.role === 'assistant' && (
                    <div className="mt-1.5 pt-1.5 border-t border-current/10 text-xs opacity-75">
                      ✓ {message.entryData.type} logged
                      {message.entryData.severity && ` • ${message.entryData.severity}`}
                    </div>
                  )}
                  {message.visualization && (
                    <VisualizationRenderer visualization={message.visualization} />
                  )}
                  {/* Confidence & Evidence */}
                  {message.role === 'assistant' && message.confidence != null && (
                    <div className="mt-2 pt-1.5 border-t border-current/5 text-[10px] text-muted-foreground/70 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          message.confidence >= 0.8 ? "bg-green-500" : message.confidence >= 0.5 ? "bg-yellow-500" : "bg-orange-500"
                        )} />
                        <span>{Math.round(message.confidence * 100)}% confidence</span>
                        {message.evidenceSources?.length ? (
                          <span className="opacity-60">• {message.evidenceSources.slice(0, 2).join(", ")}</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {/* Suggested follow-up */}
                  {message.suggestedFollowUp && (
                    <button
                      onClick={() => setInput(message.suggestedFollowUp!)}
                      className="mt-2 text-[10px] text-primary hover:underline block"
                    >
                      💡 {message.suggestedFollowUp}
                    </button>
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
          placeholder={isRecording ? "Listening..." : "Ask about your data, meds, patterns..."}
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
