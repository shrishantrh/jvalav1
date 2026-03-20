import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Loader2, Check, X } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VoiceNoteRecorderProps {
  onTranscriptComplete: (data: {
    transcript: string;
    severity?: string;
    symptoms?: string[];
    triggers?: string[];
    medications?: string[];
    notes?: string;
    energyLevel?: string;
  }) => void;
  disabled?: boolean;
}

/** Inline waveform bars */
const InlineWaveform = ({ level, isActive }: { level: number; isActive: boolean }) => (
  <div className="flex items-center gap-[2px] h-6">
    {Array.from({ length: 16 }).map((_, i) => {
      const center = 8;
      const dist = Math.abs(i - center) / center;
      const base = isActive ? 0.15 : 0.08;
      const h = Math.min(1, Math.max(base, level * (1 - dist * 0.7) + (isActive ? Math.random() * 0.1 * level : 0)));
      return (
        <div
          key={i}
          className="w-[2.5px] rounded-full bg-destructive transition-all"
          style={{ height: `${Math.max(3, h * 22)}px`, opacity: 0.5 + h * 0.5, transitionDuration: '80ms' }}
        />
      );
    })}
  </div>
);

export const VoiceNoteRecorder = ({ onTranscriptComplete, disabled }: VoiceNoteRecorderProps) => {
  const { isRecording, transcript, audioLevel, duration, audioBlob, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleStartRecording = () => {
    clearRecording();
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
    setShowPreview(true);
  };

  const handleConfirmTranscript = async () => {
    setIsProcessing(true);

    try {
      let textToProcess = transcript.trim();

      // If no live transcript, try server-side transcription of audio blob
      if (!textToProcess && audioBlob) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(audioBlob);
        });

        const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-voice', {
          body: { audio: base64, mimeType: audioBlob.type },
        });
        if (transcribeError) throw transcribeError;
        textToProcess = transcribeData?.transcript || transcribeData?.extracted?.notes || '';
      }

      if (!textToProcess) {
        toast({ title: "No speech detected", description: "Please try again and speak clearly", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("transcribe-voice", {
        body: { transcript: textToProcess }
      });

      if (error) throw error;

      if (data?.extracted) {
        onTranscriptComplete({
          transcript: textToProcess,
          severity: data.extracted.severity || undefined,
          symptoms: data.extracted.symptoms || [],
          triggers: data.extracted.triggers || [],
          medications: data.extracted.medications || [],
          notes: data.extracted.notes || textToProcess,
          energyLevel: data.extracted.energy_level || undefined,
        });
        toast({ title: "Voice note processed", description: `Extracted ${data.extracted.symptoms?.length || 0} symptoms` });
      } else {
        onTranscriptComplete({ transcript: textToProcess, notes: textToProcess });
      }

      clearRecording();
      setShowPreview(false);
    } catch (error) {
      console.error("Error processing voice note:", error);
      const fallbackText = transcript.trim();
      if (fallbackText) {
        onTranscriptComplete({ transcript: fallbackText, notes: fallbackText });
      }
      toast({ title: "Processing failed", description: "Using transcript as note", variant: "destructive" });
      clearRecording();
      setShowPreview(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelTranscript = () => {
    clearRecording();
    setShowPreview(false);
  };

  if (showPreview && (transcript || audioBlob)) {
    return (
      <Card className="p-4 space-y-3 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 animate-scale-in">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Mic className="w-4 h-4" />
          </div>
          Voice Note Preview
        </div>
        {transcript ? (
          <p className="text-sm text-muted-foreground leading-relaxed bg-background/50 p-3 rounded-lg border">
            "{transcript}"
          </p>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed bg-background/50 p-3 rounded-lg border italic">
            Audio recorded ({formatDuration(duration)}) — AI will transcribe
          </p>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleConfirmTranscript} disabled={isProcessing} className="flex-1 shadow-primary press-effect">
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
            ) : (
              <><Check className="w-4 h-4 mr-2" />Process with AI</>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancelTranscript} disabled={isProcessing}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant={isRecording ? "destructive" : "outline"}
        size="sm"
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        disabled={disabled || isProcessing}
        className={cn("w-full transition-all hover-lift", isRecording && "animate-glow-pulse")}
      >
        {isRecording ? (
          <><Square className="w-4 h-4 mr-2" />Stop ({formatDuration(duration)})</>
        ) : (
          <><Mic className="w-4 h-4 mr-2" />Voice Note</>
        )}
      </Button>

      {isRecording && (
        <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20 animate-fade-in">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs font-medium text-destructive">Recording</span>
            </div>
            <InlineWaveform level={audioLevel} isActive={true} />
          </div>
          {transcript && (
            <p className="text-xs text-muted-foreground italic mt-1">"{transcript}"</p>
          )}
        </div>
      )}
    </div>
  );
};
