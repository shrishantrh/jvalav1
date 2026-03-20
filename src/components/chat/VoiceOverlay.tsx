import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, Square, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";

interface VoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptSend: (text: string) => void;
}

/** Waveform bars driven by real audio level */
const WaveformBars = ({ level, isActive }: { level: number; isActive: boolean }) => {
  const barCount = 24;
  return (
    <div className="flex items-center justify-center gap-[3px] h-16 px-4">
      {Array.from({ length: barCount }).map((_, i) => {
        // Create a wave pattern that responds to audio level
        const center = barCount / 2;
        const distFromCenter = Math.abs(i - center) / center;
        const baseHeight = isActive ? 0.15 : 0.08;
        const maxHeight = Math.max(baseHeight, level * (1 - distFromCenter * 0.6));
        // Add some randomness for organic feel
        const jitter = isActive ? Math.random() * 0.15 * level : 0;
        const height = Math.min(1, maxHeight + jitter);
        
        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-primary transition-all"
            style={{
              height: `${Math.max(4, height * 56)}px`,
              opacity: isActive ? 0.6 + height * 0.4 : 0.3,
              transitionDuration: '80ms',
            }}
          />
        );
      })}
    </div>
  );
};

export const VoiceOverlay = ({ isOpen, onClose, onTranscriptSend }: VoiceOverlayProps) => {
  const { isRecording, transcript, audioLevel, duration, audioBlob, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const [isClosing, setIsClosing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
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

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleStop = useCallback(async () => {
    stopRecording();
    
    // If we have a live transcript from Speech API, send it directly
    if (transcript.trim()) {
      setIsClosing(true);
      setTimeout(() => {
        onTranscriptSend(transcript.trim());
        clearRecording();
        setIsClosing(false);
        onClose();
      }, 300);
      return;
    }

    // Otherwise, wait for audio blob and transcribe server-side
    setIsTranscribing(true);
  }, [transcript, stopRecording, onTranscriptSend, clearRecording, onClose]);

  // When audio blob is ready and we need server transcription
  useEffect(() => {
    if (!isTranscribing || !audioBlob) return;

    const transcribeServerSide = async () => {
      try {
        // Convert blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
        });
        reader.readAsDataURL(audioBlob);
        const audioBase64 = await base64Promise;

        const { data, error } = await supabase.functions.invoke('transcribe-voice', {
          body: { audio: audioBase64, mimeType: audioBlob.type },
        });

        if (error) throw error;

        const text = data?.transcript || data?.extracted?.notes || '';
        if (text.trim()) {
          setIsClosing(true);
          setTimeout(() => {
            onTranscriptSend(text.trim());
            clearRecording();
            setIsClosing(false);
            setIsTranscribing(false);
            onClose();
          }, 300);
        } else {
          setIsTranscribing(false);
          // No transcript obtained
        }
      } catch (e) {
        console.error('[Voice] Server transcription failed:', e);
        setIsTranscribing(false);
      }
    };

    transcribeServerSide();
  }, [isTranscribing, audioBlob, onTranscriptSend, clearRecording, onClose]);

  const handleCancel = useCallback(() => {
    stopRecording();
    clearRecording();
    setIsTranscribing(false);
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
        "fixed inset-0 z-[100] flex flex-col items-center justify-between transition-all duration-300",
        isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"
      )}
      style={{
        background: "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.97) 100%)",
        backdropFilter: "blur(40px) saturate(1.3)",
        WebkitBackdropFilter: "blur(40px) saturate(1.3)",
        paddingTop: 'env(safe-area-inset-top, 20px)',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)',
      }}
    >
      {/* Top bar */}
      <div className="w-full flex items-center justify-between px-5 pt-4">
        <button
          onClick={handleCancel}
          className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center transition-transform active:scale-90"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="text-sm font-medium text-muted-foreground">
          {isTranscribing ? 'Transcribing...' : isRecording ? formatDuration(duration) : 'Ready'}
        </div>
        <div className="w-10" /> {/* spacer */}
      </div>

      {/* Center: transcript + waveform */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-md w-full gap-6">
        {/* Live transcript or placeholder */}
        <div className="min-h-[80px] flex items-center">
          <p className={cn(
            "text-center text-lg font-medium leading-relaxed transition-opacity duration-300",
            transcript ? "text-foreground" : "text-muted-foreground/50"
          )}>
            {isTranscribing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing your voice...
              </span>
            ) : transcript || (isRecording ? "Listening..." : "Tap mic to start")}
          </p>
        </div>

        {/* Waveform visualization */}
        <WaveformBars level={audioLevel} isActive={isRecording} />
      </div>

      {/* Bottom: controls */}
      <div className="pb-10 flex flex-col items-center gap-4 w-full px-8">
        {isRecording ? (
          <div className="flex items-center gap-6">
            {/* Cancel */}
            <button
              onClick={handleCancel}
              className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center transition-transform active:scale-90"
            >
              <X className="w-6 h-6 text-muted-foreground" />
            </button>

            {/* Stop & send */}
            <button
              onClick={handleStop}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30 transition-transform active:scale-95"
            >
              <Square className="w-7 h-7 text-primary-foreground fill-primary-foreground" />
            </button>

            {/* Send if has transcript */}
            <button
              onClick={handleStop}
              disabled={!transcript.trim()}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90",
                transcript.trim()
                  ? "bg-primary/20 text-primary"
                  : "bg-muted/30 text-muted-foreground/30"
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              clearRecording();
              startRecording();
            }}
            disabled={isTranscribing}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30 transition-transform active:scale-95 disabled:opacity-50"
          >
            {isTranscribing ? (
              <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
            ) : (
              <Mic className="w-8 h-8 text-primary-foreground" />
            )}
          </button>
        )}

        <p className="text-xs text-muted-foreground/70 font-medium text-center">
          {isTranscribing
            ? "AI is transcribing your audio..."
            : isRecording
            ? "Tap stop when done • Your voice stays private"
            : "Tap to start recording"}
        </p>
      </div>
    </div>
  );
};
