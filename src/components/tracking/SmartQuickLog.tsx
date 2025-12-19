import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FlareEntry, FlareSeverity } from "@/types/flare";
import { 
  Mic, 
  MicOff, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useEntryContext } from "@/hooks/useEntryContext";
import { cn } from "@/lib/utils";

interface SmartQuickLogProps {
  onSave: (entry: Partial<FlareEntry>) => void;
  userSymptoms?: string[];
  recentSymptoms?: string[];
}

const SEVERITY_OPTIONS: { value: FlareSeverity; label: string; color: string; bgColor: string }[] = [
  { value: 'mild', label: 'Mild', color: 'text-severity-mild', bgColor: 'bg-severity-mild/20 border-severity-mild' },
  { value: 'moderate', label: 'Moderate', color: 'text-severity-moderate', bgColor: 'bg-severity-moderate/20 border-severity-moderate' },
  { value: 'severe', label: 'Severe', color: 'text-severity-severe', bgColor: 'bg-severity-severe/20 border-severity-severe' },
];

export const SmartQuickLog = ({ onSave, userSymptoms = [], recentSymptoms = [] }: SmartQuickLogProps) => {
  const [selectedSeverity, setSelectedSeverity] = useState<FlareSeverity | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const { getEntryContext, hasWearableConnected } = useEntryContext();

  // Combine user's known symptoms with recent ones, prioritizing recent
  const prioritizedSymptoms = [...new Set([...recentSymptoms, ...userSymptoms])].slice(0, 12);
  const displayedSymptoms = showMore ? prioritizedSymptoms : prioritizedSymptoms.slice(0, 6);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );
  };

  const handleQuickLog = async () => {
    if (!selectedSeverity) {
      toast({
        title: "Select severity",
        description: "Please select how you're feeling",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    const entry: Partial<FlareEntry> = {
      type: 'flare',
      severity: selectedSeverity,
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
      note: note.trim() || undefined,
      timestamp: new Date(),
    };

    // Collect unified context data (environmental + wearable)
    try {
      const contextData = await getEntryContext();
      
      if (contextData.environmentalData) {
        entry.environmentalData = contextData.environmentalData;
      }
      
      if (contextData.physiologicalData) {
        entry.physiologicalData = contextData.physiologicalData;
      }
    } catch (error) {
      console.log('Error collecting context data:', error);
    }

    onSave(entry);
    
    // Reset form
    setSelectedSeverity(null);
    setSelectedSymptoms([]);
    setNote("");
    setIsProcessing(false);

    toast({
      title: "Logged",
      description: `${selectedSeverity} flare with ${selectedSymptoms.length} symptoms`,
    });
  };

  const handleVoiceLog = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('analyze-note', {
        body: { note: transcript }
      });

      if (error) throw error;

      if (data?.success && data.result) {
        onSave({ ...data.result, note: transcript.trim(), timestamp: new Date() });
        clearRecording();
        toast({
          title: "Voice entry logged",
          description: `AI detected: ${data.result.type} - ${data.result.severity || 'noted'}`,
        });
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      toast({ title: "Processing failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Severity Selection - Prominent */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">How are you feeling?</p>
        <div className="grid grid-cols-3 gap-2">
          {SEVERITY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              onClick={() => setSelectedSeverity(option.value)}
              className={cn(
                "h-14 flex flex-col gap-1 transition-all border-2",
                selectedSeverity === option.value
                  ? option.bgColor
                  : "hover:bg-muted/50"
              )}
            >
              <span className={cn(
                "text-2xl",
                selectedSeverity === option.value ? option.color : ""
              )}>
                {option.value === 'mild' ? '😐' : option.value === 'moderate' ? '😣' : '😫'}
              </span>
              <span className={cn(
                "text-xs font-medium",
                selectedSeverity === option.value ? option.color : ""
              )}>
                {option.label}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Symptom Chips - Personalized */}
      {selectedSeverity && prioritizedSymptoms.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-sm font-medium text-muted-foreground">Quick symptoms</p>
          <div className="flex flex-wrap gap-2">
            {displayedSymptoms.map((symptom) => (
              <Badge
                key={symptom}
                variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all px-3 py-1.5 text-xs",
                  selectedSymptoms.includes(symptom)
                    ? "bg-primary hover:bg-primary/90"
                    : "hover:bg-muted"
                )}
                onClick={() => toggleSymptom(symptom)}
              >
                {symptom}
              </Badge>
            ))}
          </div>
          {prioritizedSymptoms.length > 6 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMore(!showMore)}
              className="text-xs h-6 px-2"
            >
              {showMore ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              {showMore ? 'Less' : `+${prioritizedSymptoms.length - 6} more`}
            </Button>
          )}
        </div>
      )}

      {/* Voice/Text Input Row */}
      <div className="flex gap-2 items-end">
        <Button
          variant="outline"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            "h-10 w-10 flex-shrink-0 transition-all",
            isRecording && "bg-destructive/10 border-destructive animate-pulse"
          )}
        >
          {isRecording ? (
            <MicOff className="w-4 h-4 text-destructive" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>
        
        <Textarea
          placeholder={isRecording ? "Listening..." : "Add a note (optional)"}
          value={transcript || note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[40px] max-h-20 text-sm resize-none flex-1"
          disabled={isRecording}
        />

        <Button
          onClick={transcript ? handleVoiceLog : handleQuickLog}
          disabled={isProcessing || (!selectedSeverity && !transcript)}
          size="icon"
          className="h-10 w-10 flex-shrink-0"
        >
          {isProcessing ? (
            <Sparkles className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Transcript Preview */}
      {transcript && (
        <div className="bg-muted/50 rounded-lg p-3 text-sm animate-fade-in">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Transcription</span>
            <Button variant="ghost" size="sm" onClick={clearRecording} className="h-6 text-xs">
              Clear
            </Button>
          </div>
          <p className="text-muted-foreground italic">{transcript}</p>
        </div>
      )}
    </div>
  );
};
