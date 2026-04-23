import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { Phone, PhoneOff, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/lib/haptics";

interface VoiceConversationProps {
  onClose: () => void;
  userName?: string;
  agentId?: string;
}

export const VoiceConversation = ({ onClose, userName, agentId }: VoiceConversationProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const animFrame = useRef<number>(0);

  const conversation = useConversation({
    onConnect: () => {
      console.log("[VoiceConversation] Connected");
      haptics.impact();
    },
    onDisconnect: () => {
      console.log("[VoiceConversation] Disconnected");
      haptics.impact();
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

      if (agentId) {
        try {
          const { data, error: fnError } = await supabase.functions.invoke("voice-conversation-token", {
            body: { agentId },
          });

          if (data?.token) {
            const sessionOpts: any = {
              conversationToken: data.token,
              connectionType: "webrtc",
            };
            
            if (data.userContext) {
              sessionOpts.overrides = {
                agent: {
                  prompt: {
                    prompt: data.userContext,
                  },
                },
              };
            }
            
            await conversation.startSession(sessionOpts);
            return;
          }
        } catch (tokenErr) {
          console.warn("Token fetch failed, trying public agent:", tokenErr);
        }

        await conversation.startSession({
          agentId,
          connectionType: "webrtc",
        });
      } else {
        setError("Voice agent not configured yet.");
      }
    } catch (err: any) {
      console.error("Failed to start voice conversation:", err);
      if (err.name === "NotAllowedError") {
        setError("Microphone access required.");
      } else {
        setError("Couldn't connect. Check back soon.");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, agentId]);

  const endConversation = useCallback(async () => {
    await conversation.endSession();
    haptics.impact();
    onClose();
  }, [conversation, onClose]);

  const isSpeaking = conversation.isSpeaking;
  const isConnected = conversation.status === "connected";

  // Premium waveform bars
  const renderWaveform = (level: number, count: number, isAgent: boolean) => (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {Array.from({ length: count }).map((_, i) => {
        const center = count / 2;
        const dist = Math.abs(i - center) / center;
        const h = Math.max(0.06, level * (1 - dist * 0.5) + (level > 0.05 ? Math.random() * 0.06 : 0));
        return (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{
              width: '3px',
              height: `${Math.max(4, h * 56)}px`,
              backgroundColor: isAgent ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              opacity: 0.3 + h * 0.7,
              transitionDuration: "60ms",
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'hsl(var(--background))' }}>
      <div style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} />
      
      {/* Header - frosted glass */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="text-sm text-muted-foreground font-medium">
          {isConnected ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          ) : "Voice Call"}
        </div>
        <button
          onClick={isConnected ? endConversation : onClose}
          className={cn(
            "text-sm font-medium px-4 py-2 rounded-xl transition-all active:scale-95",
            "bg-card/60 backdrop-blur-xl border border-border/30",
            "text-muted-foreground hover:text-foreground"
          )}
        >
          {isConnected ? "End" : "Close"}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
        {/* Avatar with glow */}
        <div className="relative">
          {isSpeaking && (
            <>
              <div className="absolute -inset-6 rounded-full bg-primary/8 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="absolute -inset-10 rounded-full bg-primary/4 animate-ping" style={{ animationDuration: "3s" }} />
            </>
          )}
          <div className={cn(
            "w-28 h-28 rounded-full flex items-center justify-center transition-all duration-700",
            "bg-card/70 backdrop-blur-xl border border-border/30",
            isConnected && isSpeaking && "shadow-[0_0_60px_-10px_hsl(var(--primary)/0.3)]",
            isConnected && !isSpeaking && "shadow-lg",
          )}>
            <span className={cn(
              "text-4xl font-bold transition-colors duration-300",
              isConnected ? "text-primary" : "text-muted-foreground"
            )}>
              J
            </span>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            {isConnected ? "Jvala" : "Talk to Jvala"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
            {isConnecting
              ? "Connecting..."
              : isConnected
              ? isSpeaking
                ? "Speaking..."
                : "Listening..."
              : error || "Have a real conversation about your health."}
          </p>
        </div>

        {/* Waveform */}
        {isConnected && (
          <div className="w-full max-w-xs">
            {isSpeaking 
              ? renderWaveform(outputLevel, 28, true) 
              : (
                <div className="flex flex-col items-center gap-2">
                  {renderWaveform(inputLevel, 28, false)}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mic className="w-3 h-3" />
                    <span>Speak naturally</span>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Transcripts - frosted glass cards */}
        {transcripts.length > 0 && (
          <div className="w-full max-w-sm space-y-2 max-h-44 overflow-y-auto scrollbar-hide">
            {transcripts.slice(-5).map((t, i) => (
              <div
                key={i}
                className={cn(
                  "text-xs px-4 py-2.5 rounded-2xl max-w-[85%] backdrop-blur-sm",
                  t.role === "user"
                    ? "ml-auto bg-primary/10 border border-primary/20 text-foreground"
                    : "mr-auto bg-card/60 border border-border/20 text-muted-foreground"
                )}
              >
                {t.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call controls */}
      <div className="flex items-center justify-center gap-6 pb-12" 
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 48px)' }}>
        {isConnected ? (
          <button
            onClick={endConversation}
            className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/25 active:scale-90 transition-transform"
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
                : "bg-primary shadow-primary/25"
            )}
          >
            <Phone className={cn("w-7 h-7", isConnecting ? "text-muted-foreground" : "text-primary-foreground")} />
          </button>
        )}
      </div>
    </div>
  );
};
