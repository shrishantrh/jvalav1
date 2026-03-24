import { useState, useEffect, useCallback, useRef } from "react";
import { Square, X, Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

interface InlineVoiceRecorderProps {
  onTranscriptReady: (text: string) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

/** Sleek inline waveform that replaces the text input bar — iMessage-style */
const InlineWaveform = ({ level, isActive }: { level: number; isActive: boolean }) => {
  const barCount = 32;
  return (
    <div className="flex items-center justify-center gap-[2px] h-8 flex-1 px-1">
      {Array.from({ length: barCount }).map((_, i) => {
        const center = barCount / 2;
        const dist = Math.abs(i - center) / center;
        const base = isActive ? 0.12 : 0.06;
        const maxH = Math.max(base, level * (1 - dist * 0.5));
        const jitter = isActive ? Math.random() * 0.12 * level : 0;
        const h = Math.min(1, maxH + jitter);
        return (
          <div
            key={i}
            className="w-[2.5px] rounded-full bg-primary transition-all"
            style={{
              height: `${Math.max(3, h * 28)}px`,
              opacity: isActive ? 0.5 + h * 0.5 : 0.25,
              transitionDuration: "60ms",
            }}
          />
        );
      })}
    </div>
  );
};

export const InlineVoiceRecorder = ({
  onTranscriptReady,
  onCancel,
  isProcessing,
}: InlineVoiceRecorderProps) => {
  const {
    isRecording,
    transcript,
    audioLevel,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    clearRecording,
  } = useVoiceRecording();
  const hasStartedRef = useRef(false);
  const [showTranscribing, setShowTranscribing] = useState(false);

  // Auto-start recording on mount
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startRecording();
    }
    return () => {
      // cleanup handled by hook
    };
  }, [startRecording]);

  const formatDur = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleStop = useCallback(() => {
    stopRecording();

    // If we have a live transcript, send it
    if (transcript.trim()) {
      onTranscriptReady(transcript.trim());
      clearRecording();
      return;
    }

    // Otherwise wait for blob
    setShowTranscribing(true);
  }, [transcript, stopRecording, onTranscriptReady, clearRecording]);

  // When blob is ready and we need it
  useEffect(() => {
    if (!showTranscribing || !audioBlob) return;

    const convertAndSend = async () => {
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(audioBlob);
        });
        // Import supabase dynamically to keep component light
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("transcribe-voice", {
          body: { audio: base64, mimeType: audioBlob.type },
        });
        if (error) throw error;
        const text = data?.transcript || data?.extracted?.notes || "";
        if (text.trim()) {
          onTranscriptReady(text.trim());
        } else {
          onCancel(); // nothing detected
        }
      } catch (e) {
        console.error("[Voice] Server transcription failed:", e);
        onCancel();
      } finally {
        clearRecording();
        setShowTranscribing(false);
      }
    };
    convertAndSend();
  }, [showTranscribing, audioBlob, onTranscriptReady, onCancel, clearRecording]);

  const handleCancel = useCallback(() => {
    stopRecording();
    clearRecording();
    setShowTranscribing(false);
    onCancel();
  }, [stopRecording, clearRecording, onCancel]);

  if (showTranscribing || isProcessing) {
    return (
      <div className="flex items-center gap-3 w-full h-10 px-3 rounded-full bg-primary/5 border border-primary/20 animate-fade-in">
        <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
        <span className="text-xs text-muted-foreground flex-1">Processing voice...</span>
        <button onClick={handleCancel} className="p-1 rounded-full hover:bg-muted/60 transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 w-full animate-fade-in">
      {/* Cancel */}
      <button
        onClick={handleCancel}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted transition-all active:scale-90 flex-shrink-0"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Waveform + duration */}
      <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-full bg-primary/5 border border-primary/20 overflow-hidden">
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse flex-shrink-0" />
        <span className="text-xs font-mono text-muted-foreground w-8 flex-shrink-0">
          {formatDur(duration)}
        </span>
        <InlineWaveform level={audioLevel} isActive={isRecording} />
      </div>

      {/* Stop / Send button */}
      <button
        onClick={handleStop}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 flex-shrink-0",
          "bg-primary text-primary-foreground shadow-md shadow-primary/20"
        )}
      >
        <Square className="w-4 h-4 fill-current" />
      </button>

      {/* Live transcript hint */}
      {transcript && (
        <div className="absolute bottom-full left-0 right-0 mb-2 px-4">
          <div className="bg-muted/90 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-muted-foreground italic max-w-full truncate border border-border/30">
            "{transcript}"
          </div>
        </div>
      )}
    </div>
  );
};
