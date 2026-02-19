import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

interface VoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptSend: (text: string) => void;
}

export const VoiceOverlay = ({ isOpen, onClose, onTranscriptSend }: VoiceOverlayProps) => {
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const [isClosing, setIsClosing] = useState(false);
  const [pulseScale, setPulseScale] = useState(1);
  const hasStartedRef = useRef(false);

  // Start recording when overlay opens
  useEffect(() => {
    if (isOpen && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startRecording();
    }
    if (!isOpen) {
      hasStartedRef.current = false;
    }
  }, [isOpen, startRecording]);

  // Pulse animation
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setPulseScale(s => s === 1 ? 1.08 : 1);
    }, 800);
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleSend = useCallback(() => {
    if (transcript.trim()) {
      stopRecording();
      setIsClosing(true);
      setTimeout(() => {
        onTranscriptSend(transcript.trim());
        clearRecording();
        setIsClosing(false);
        onClose();
      }, 300);
    }
  }, [transcript, stopRecording, onTranscriptSend, clearRecording, onClose]);

  const handleCancel = useCallback(() => {
    stopRecording();
    clearRecording();
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  }, [stopRecording, clearRecording, onClose]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-300",
        isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"
      )}
      style={{
        background: "linear-gradient(180deg, hsl(330 80% 55% / 0.05) 0%, hsl(270 60% 50% / 0.08) 50%, hsl(330 80% 55% / 0.03) 100%)",
        backdropFilter: "blur(40px) saturate(1.3)",
        WebkitBackdropFilter: "blur(40px) saturate(1.3)",
      }}
    >
      {/* Close button */}
      <button
        onClick={handleCancel}
        className="absolute top-14 right-6 w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center transition-transform active:scale-90"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Live transcript */}
      <div className="flex-1 flex items-center justify-center px-8 max-w-md w-full">
        <p className={cn(
          "text-center text-lg font-medium leading-relaxed transition-opacity duration-300",
          transcript ? "text-foreground" : "text-muted-foreground/60"
        )}>
          {transcript || "Listening..."}
        </p>
      </div>

      {/* Mic button area */}
      <div className="pb-24 flex flex-col items-center gap-6">
        {/* Ripple rings */}
        <div className="relative">
          {isRecording && (
            <>
              <div className="absolute inset-0 w-28 h-28 -m-4 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="absolute inset-0 w-24 h-24 -m-2 rounded-full border border-primary/15 animate-ping" style={{ animationDuration: "1.5s", animationDelay: "0.3s" }} />
            </>
          )}
          
          {/* Main mic button */}
          <button
            onPointerUp={handleSend}
            className={cn(
              "relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
              isRecording
                ? "bg-gradient-to-br from-primary to-primary/80 shadow-primary/30"
                : "bg-muted"
            )}
            style={{ transform: `scale(${isRecording ? pulseScale : 1})` }}
          >
            <Mic className={cn(
              "w-8 h-8 transition-colors",
              isRecording ? "text-primary-foreground" : "text-muted-foreground"
            )} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground/70 font-medium">
          {isRecording ? (transcript ? "Release to send" : "Speak now...") : "Starting..."}
        </p>
      </div>
    </div>
  );
};
