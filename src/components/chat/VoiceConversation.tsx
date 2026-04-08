import { useState, useEffect, useRef, useCallback } from "react";
import { useConversation } from "@11labs/react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneOff, X } from "lucide-react";

interface VoiceConversationProps {
  isOpen: boolean;
  onClose: () => void;
}

type CallStatus = "idle" | "connecting" | "connected" | "error";

interface TranscriptEntry {
  id: string;
  role: "agent" | "user";
  text: string;
}

// Animated waveform bars — respond to speaking state
function WaveBars({ active, count = 11 }: { active: boolean; count?: number }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: count }).map((_, i) => {
        const baseHeight = 4;
        const maxExtra = 28;
        // Create a bell-curve shape across the bars
        const curve = Math.sin((i / (count - 1)) * Math.PI);
        const targetHeight = active ? baseHeight + curve * maxExtra : baseHeight;
        return (
          <div
            key={i}
            className="rounded-full bg-pink-400/80 transition-all"
            style={{
              width: 3,
              height: targetHeight,
              animationName: active ? "wavePulse" : "none",
              animationDuration: `${0.5 + i * 0.06}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              animationDirection: "alternate",
            }}
          />
        );
      })}
    </div>
  );
}

// Pulse ring that appears behind the orb when speaking
function OrbPulse({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <>
      <div
        className="absolute rounded-full bg-pink-500/10"
        style={{ width: 220, height: 220, animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite" }}
      />
      <div
        className="absolute rounded-full bg-pink-500/15"
        style={{ width: 190, height: 190, animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
      />
    </>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceConversation({ isOpen, onClose }: VoiceConversationProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  const conversation = useConversation({
    onConnect: () => {
      setCallStatus("connected");
      durationTimerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    },
    onDisconnect: () => {
      setCallStatus("idle");
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    },
    onMessage: ({ message, source }: { message: string; source: string }) => {
      setTranscript((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, role: source === "ai" ? "agent" : "user", text: message },
      ]);
    },
    onError: (error: string) => {
      setErrorMsg(typeof error === "string" ? error : "Connection failed. Please try again.");
      setCallStatus("error");
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    },
  });

  const startCall = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    setCallStatus("connecting");
    setTranscript([]);
    setDuration(0);
    setErrorMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in to use voice calling.");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-conversation-token`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Could not start the call.");
      }

      const { signed_url } = await resp.json();
      await conversation.startSession({ signedUrl: signed_url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setErrorMsg(msg);
      setCallStatus("error");
      hasStarted.current = false;
    }
  }, [conversation]);

  const endCall = useCallback(async () => {
    await conversation.endSession().catch(() => {});
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    hasStarted.current = false;
    onClose();
  }, [conversation, onClose]);

  // Auto-start when opened
  useEffect(() => {
    if (isOpen && callStatus === "idle") {
      startCall();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []);

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  if (!isOpen) return null;

  const isConnected = callStatus === "connected";
  const isConnecting = callStatus === "connecting";
  const isError = callStatus === "error";
  const isSpeaking = conversation.isSpeaking;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: "linear-gradient(135deg, #0d0d14 0%, #16101e 50%, #0d0d14 100%)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Dismiss button (top-left) */}
      <div className="flex items-center justify-between px-6 pt-14 pb-2">
        <button
          onClick={endCall}
          className="text-white/30 hover:text-white/60 transition-colors p-2 -ml-2"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Call timer */}
        <div className="text-center">
          <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase">
            Jvala
          </p>
          {isConnected && (
            <p className="text-white/25 text-xs mt-0.5 tabular-nums">
              {formatDuration(duration)}
            </p>
          )}
        </div>

        {/* Status pill */}
        <div className={`h-6 px-2.5 rounded-full flex items-center gap-1.5 text-xs font-medium ${
          isConnected ? "bg-green-500/20 text-green-400" :
          isConnecting ? "bg-yellow-500/20 text-yellow-400" :
          isError ? "bg-red-500/20 text-red-400" :
          "bg-white/10 text-white/40"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? "bg-green-400 animate-pulse" :
            isConnecting ? "bg-yellow-400 animate-pulse" :
            isError ? "bg-red-400" : "bg-white/40"
          }`} />
          {isConnected ? "Live" : isConnecting ? "Connecting" : isError ? "Error" : "Idle"}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
        {/* Jvala Orb */}
        <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
          <OrbPulse active={isSpeaking} />

          {/* Orb */}
          <div
            className="relative flex items-center justify-center rounded-full transition-all duration-500"
            style={{
              width: 140,
              height: 140,
              background: isSpeaking
                ? "radial-gradient(circle at 35% 35%, #f472b6, #db2777, #9d174d)"
                : isConnected
                ? "radial-gradient(circle at 35% 35%, rgba(244,114,182,0.5), rgba(219,39,119,0.4), rgba(157,23,77,0.3))"
                : "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
              boxShadow: isSpeaking
                ? "0 0 80px rgba(236, 72, 153, 0.5), 0 0 30px rgba(236, 72, 153, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)"
                : isConnected
                ? "0 0 40px rgba(236, 72, 153, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
                : "inset 0 1px 0 rgba(255,255,255,0.08)",
              transform: isSpeaking ? "scale(1.08)" : "scale(1)",
            }}
          >
            {/* Specular highlight */}
            <div
              className="absolute rounded-full"
              style={{
                top: "15%", left: "20%",
                width: "35%", height: "25%",
                background: "radial-gradient(ellipse, rgba(255,255,255,0.3), transparent)",
                filter: "blur(4px)",
              }}
            />
            {/* J glyph */}
            <span
              className="relative select-none text-white font-bold"
              style={{ fontSize: 52, lineHeight: 1, letterSpacing: -2 }}
            >
              J
            </span>
          </div>
        </div>

        {/* State label */}
        <div className="text-center min-h-[2.5rem] flex flex-col items-center justify-center gap-1">
          {isConnecting && (
            <p className="text-white/40 text-sm animate-pulse tracking-wide">
              Connecting to Jvala...
            </p>
          )}
          {isConnected && !isSpeaking && (
            <p className="text-white/30 text-sm tracking-wide">Listening...</p>
          )}
          {isConnected && isSpeaking && (
            <p className="text-pink-400/80 text-sm tracking-wide">Jvala is speaking</p>
          )}
          {isError && (
            <p className="text-red-400/80 text-sm text-center max-w-xs">{errorMsg}</p>
          )}
        </div>

        {/* Waveform */}
        {isConnected && <WaveBars active={isSpeaking} />}

        {/* Error retry */}
        {isError && (
          <button
            onClick={() => { hasStarted.current = false; startCall(); }}
            className="text-white/50 hover:text-white text-sm underline underline-offset-2 transition-colors"
          >
            Try again
          </button>
        )}
      </div>

      {/* ── Transcript ── */}
      {transcript.length > 0 && (
        <div className="px-6 pb-4 max-h-44 overflow-y-auto space-y-2">
          {transcript.slice(-6).map((entry) => (
            <div
              key={entry.id}
              className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <p
                className={`
                  max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-snug
                  ${entry.role === "agent"
                    ? "bg-white/8 text-white/70 rounded-tl-sm"
                    : "bg-pink-500/20 text-white/60 rounded-tr-sm"
                  }
                `}
              >
                {entry.text}
              </p>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}

      {/* ── End call button ── */}
      <div className="flex items-center justify-center pb-16">
        <button
          onClick={endCall}
          className="
            w-[68px] h-[68px] rounded-full flex items-center justify-center
            transition-all duration-150 active:scale-95
          "
          style={{
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            boxShadow: "0 8px 32px rgba(239,68,68,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
          aria-label="End call"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes wavePulse {
          from { transform: scaleY(0.6); }
          to   { transform: scaleY(1.4); }
        }
      `}</style>
    </div>
  );
}
