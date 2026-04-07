import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/lib/haptics";

interface VoiceConversationProps {
  onClose: () => void;
  userName?: string;
}

// Jvala's ElevenLabs Agent ID — configure in ElevenLabs dashboard
const JVALA_AGENT_ID = "jvala-health-companion";

export const VoiceConversation = ({ onClose, userName }: VoiceConversationProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const animFrame = useRef<number>(0);

  const conversation = useConversation({
    onConnect: () => {
      console.log("[VoiceConversation] Connected");
      haptics.impact("medium");
    },
    onDisconnect: () => {
      console.log("[VoiceConversation] Disconnected");
      haptics.impact("light");
    },
    onMessage: (message: any) => {
      if (message.type === "user_transcript" && message.user_transcription_event?.user_transcript) {
        setTranscripts(prev => [...prev, { role: "user", text: message.user_transcription_event.user_transcript }]);
      }
      if (message.type === "agent_response" && message.agent_response_event?.agent_response) {
        setTranscripts(prev => [...prev, { role: "agent", text: message.agent_response_event.agent_response }]);
      }
    },
    onError: (error: any) => {
      console.error("[VoiceConversation] Error:", error);
      setError("Connection lost. Tap to try again.");
    },
  });

  // Animate audio levels
  useEffect(() => {
    const update = () => {
      if (conversation.status === "connected") {
        setInputLevel(conversation.getInputVolume());
        setOutputLevel(conversation.getOutputVolume());
      }
      animFrame.current = requestAnimationFrame(update);
    };
    animFrame.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrame.current);
  }, [conversation]);

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // For now, use the public agent approach since we need to configure the agent first
      // In production, use the signed URL from our edge function
      await conversation.startSession({
        agentId: JVALA_AGENT_ID,
      });
    } catch (err: any) {
      console.error("Failed to start voice conversation:", err);
      if (err.name === "NotAllowedError") {
        setError("Microphone access required. Please enable it in your settings.");
      } else {
        setError("Couldn't connect. Voice calls are being set up — check back soon!");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [conversation]);

  const endConversation = useCallback(async () => {
    await conversation.endSession();
    haptics.impact("light");
    onClose();
  }, [conversation, onClose]);

  const isSpeaking = conversation.isSpeaking;
  const isConnected = conversation.status === "connected";

  // Generate waveform bars based on audio level
  const renderWaveform = (level: number, count: number, color: string) => (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {Array.from({ length: count }).map((_, i) => {
        const center = count / 2;
        const dist = Math.abs(i - center) / center;
        const h = Math.max(0.08, level * (1 - dist * 0.6) + (level > 0.05 ? Math.random() * 0.08 : 0));
        return (
          <div
            key={i}
            className="w-[3px] rounded-full transition-all"
            style={{
              height: `${Math.max(4, h * 56)}px`,
              backgroundColor: color,
              opacity: 0.4 + h * 0.6,
              transitionDuration: "50ms",
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-background via-background to-primary/5">
      {/* Safe area top */}
      <div className="pt-[env(safe-area-inset-top,0px)]" />
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="text-sm text-muted-foreground">
          {isConnected ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Connected
            </span>
          ) : "Voice Call"}
        </div>
        <button
          onClick={isConnected ? endConversation : onClose}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isConnected ? "End" : "Close"}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
        {/* Avatar / Visual */}
        <div className="relative">
          {/* Pulsing rings when speaking */}
          {isSpeaking && (
            <>
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="absolute -inset-4 rounded-full bg-primary/5 animate-ping" style={{ animationDuration: "3s" }} />
            </>
          )}
          
          {/* Main circle */}
          <div className={cn(
            "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500",
            isConnected 
              ? isSpeaking 
                ? "bg-primary/20 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.4)]" 
                : "bg-primary/10"
              : "bg-muted/30"
          )}>
            <div className={cn(
              "text-4xl font-bold transition-all",
              isConnected ? "text-primary" : "text-muted-foreground"
            )}>
              J
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">
            {isConnected ? "Jvala" : "Talk to Jvala"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            {isConnecting
              ? "Connecting..."
              : isConnected
              ? isSpeaking
                ? "Jvala is speaking..."
                : "Listening..."
              : error || "Have a real conversation about your health. Just talk naturally."}
          </p>
        </div>

        {/* Waveform visualization */}
        {isConnected && (
          <div className="w-full max-w-xs space-y-4">
            {/* Agent speaking waveform */}
            {isSpeaking && renderWaveform(outputLevel, 24, "hsl(var(--primary))")}
            
            {/* User input waveform */}
            {!isSpeaking && (
              <div className="flex flex-col items-center gap-2">
                {renderWaveform(inputLevel, 24, "hsl(var(--muted-foreground))")}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mic className="w-3 h-3" />
                  <span>Speak naturally</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent transcript */}
        {transcripts.length > 0 && (
          <div className="w-full max-w-sm space-y-2 max-h-40 overflow-y-auto">
            {transcripts.slice(-4).map((t, i) => (
              <div
                key={i}
                className={cn(
                  "text-xs px-3 py-2 rounded-xl max-w-[85%]",
                  t.role === "user"
                    ? "ml-auto bg-primary/10 text-foreground"
                    : "mr-auto bg-muted/50 text-muted-foreground"
                )}
              >
                {t.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call controls */}
      <div className="flex items-center justify-center gap-6 pb-12 pb-[calc(env(safe-area-inset-bottom,0px)+48px)]">
        {isConnected ? (
          <button
            onClick={endConversation}
            className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/30 active:scale-90 transition-transform"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
        ) : (
          <button
            onClick={startConversation}
            disabled={isConnecting}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all",
              isConnecting
                ? "bg-muted animate-pulse"
                : "bg-primary shadow-primary/30"
            )}
          >
            <Phone className={cn("w-7 h-7", isConnecting ? "text-muted-foreground" : "text-primary-foreground")} />
          </button>
        )}
      </div>
    </div>
  );
};
