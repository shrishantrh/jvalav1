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
      <Card className="p-4 space-y-3 border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Mic className="w-4 h-4" />
          Voice Note Preview
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          "{transcript}"
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleConfirmTranscript}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Confirm & Process
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
          "w-full transition-all",
          isRecording && "animate-pulse"
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
      
      {isRecording && transcript && (
        <p className="text-xs text-muted-foreground italic animate-pulse">
          "{transcript}"
        </p>
      )}
    </div>
  );
};
