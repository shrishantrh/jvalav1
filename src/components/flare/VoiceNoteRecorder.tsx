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

export const VoiceNoteRecorder = ({ onTranscriptComplete, disabled }: VoiceNoteRecorderProps) => {
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const handleStartRecording = () => {
    clearRecording();
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
    setShowPreview(true);
  };

  const handleConfirmTranscript = async () => {
    if (!transcript.trim()) {
      toast({
        title: "No transcript",
        description: "Please record something first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("transcribe-voice", {
        body: { transcript: transcript.trim() }
      });

      if (error) {
        console.error("Transcription error:", error);
        throw error;
      }

      if (data?.extracted) {
        onTranscriptComplete({
          transcript: transcript.trim(),
          severity: data.extracted.severity || undefined,
          symptoms: data.extracted.symptoms || [],
          triggers: data.extracted.triggers || [],
          medications: data.extracted.medications || [],
          notes: data.extracted.notes || transcript.trim(),
          energyLevel: data.extracted.energy_level || undefined,
        });

        toast({
          title: "Voice note processed",
          description: `Extracted ${data.extracted.symptoms?.length || 0} symptoms and ${data.extracted.triggers?.length || 0} triggers`,
        });
      } else {
        // Fallback if AI extraction fails
        onTranscriptComplete({
          transcript: transcript.trim(),
          notes: transcript.trim(),
        });
      }

      clearRecording();
      setShowPreview(false);
    } catch (error) {
      console.error("Error processing voice note:", error);
      toast({
        title: "Processing failed",
        description: "Using transcript as note instead",
        variant: "destructive",
      });
      
      // Fallback - just use the transcript as a note
      onTranscriptComplete({
        transcript: transcript.trim(),
        notes: transcript.trim(),
      });
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

  if (showPreview && transcript) {
    return (
      <Card className="p-4 space-y-3 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 animate-scale-in">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <div className="p-1.5 rounded-lg bg-primary/10 animate-float">
            <Mic className="w-4 h-4" />
          </div>
          Voice Note Preview
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed bg-background/50 p-3 rounded-lg border">
          "{transcript}"
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleConfirmTranscript}
            disabled={isProcessing}
            className="flex-1 shadow-primary press-effect"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Process with AI
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancelTranscript}
            disabled={isProcessing}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        {isProcessing && (
          <p className="text-[10px] text-muted-foreground text-center animate-pulse">
            AI is extracting symptoms, triggers, and severity...
          </p>
        )}
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
        className={cn(
          "w-full transition-all hover-lift",
          isRecording && "animate-glow-pulse"
        )}
      >
        {isRecording ? (
          <>
            <Square className="w-4 h-4 mr-2" />
            Stop Recording
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 mr-2" />
            Voice Note
          </>
        )}
      </Button>
      
      {isRecording && (
        <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs font-medium text-destructive">Recording...</span>
          </div>
          {transcript && (
            <p className="text-xs text-muted-foreground italic">
              "{transcript}"
            </p>
          )}
        </div>
      )}
    </div>
  );
};
