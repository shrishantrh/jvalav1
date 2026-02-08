import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FlareEntry } from "@/types/flare";
import {
  Thermometer,
  Battery,
  Pill,
  AlertTriangle,
  Heart,
  StickyNote,
  Sparkles,
  Mic,
  MicOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useEntryContext } from "@/hooks/useEntryContext";

interface QuickEntryProps {
  onSave: (entry: Partial<FlareEntry>) => void;
}

const QUICK_ACTIONS = [
  { type: "flare" as const, severity: "mild" as const, icon: Thermometer, label: "Mild Flare", color: "severity-mild" },
  { type: "flare" as const, severity: "moderate" as const, icon: Thermometer, label: "Moderate Flare", color: "severity-moderate" },
  { type: "flare" as const, severity: "severe" as const, icon: Thermometer, label: "Severe Flare", color: "severity-severe" },
  { type: "energy" as const, energyLevel: "low" as const, icon: Battery, label: "Low Energy", color: "muted-foreground" },
  { type: "energy" as const, energyLevel: "good" as const, icon: Battery, label: "Good Energy", color: "severity-none" },
  { type: "medication" as const, icon: Pill, label: "Took Meds", color: "primary" },
  { type: "trigger" as const, icon: AlertTriangle, label: "Trigger", color: "severity-moderate" },
  { type: "recovery" as const, icon: Heart, label: "Recovery", color: "severity-none" },
];

export const QuickEntry = ({ onSave }: QuickEntryProps) => {
  const [note, setNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { isRecording, transcript, startRecording, stopRecording, clearRecording } = useVoiceRecording();
  const { getEntryContext } = useEntryContext();

  const handleQuickAction = async (action: (typeof QUICK_ACTIONS)[number]) => {
    const entry: Partial<FlareEntry> = {
      type: action.type,
      timestamp: new Date(),
    };

    if ("severity" in action && action.severity) {
      entry.severity = action.severity;
    }
    if ("energyLevel" in action && action.energyLevel) {
      entry.energyLevel = action.energyLevel;
    }

    // Collect environmental + wearable data (real, when available)
    // Critical: do not generate dummy data; attach whatever we can fetch quickly.
    try {
      const ctx = await getEntryContext();
      if (ctx.environmentalData) entry.environmentalData = ctx.environmentalData as any;
      if (ctx.physiologicalData) entry.physiologicalData = ctx.physiologicalData as any;
    } catch (error) {
      console.log("Error collecting quick-log context:", error);
    }

    onSave(entry);

    toast({
      title: "Entry logged",
      description: "Saved with available wearable + environmental context.",
      duration: 2500,
    });
  };


  const handleVoiceEntry = async () => {
    if (!transcript.trim()) return;

    setIsProcessing(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      
      // Send transcribed text to Gemini for analysis
      const { data, error } = await supabase.functions.invoke('analyze-note', {
        body: { note: transcript }
      });

      if (error) throw error;

      if (data?.success && data.result) {
        const fullEntry = { 
          ...data.result, 
          note: transcript.trim(), 
          timestamp: new Date() 
        };
        
        onSave(fullEntry);
        clearRecording();
        toast({
          title: "Voice entry created",
          description: `AI analyzed your voice note as a ${data.result.type} entry`,
        });
      }
    } catch (error) {
      console.error('❌ Voice entry error:', error);
      toast({
        title: "Voice processing failed",
        description: "Please try again or use text entry",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSmartEntry = async () => {
    if (!note.trim()) {
      toast({
        title: "Note required",
        description: "Please describe what you'd like to track",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    console.log('🚀 Starting smart entry processing...');
    console.log('📝 Note content:', note);
    
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('analyze-note', {
        body: { note }
      });

      if (error) throw error;

      console.log('🤖 AI response:', data);
      
      if (data?.success && data.result) {
        const fullEntry = { ...data.result, note: note.trim(), timestamp: new Date() };
        console.log('✅ Saving AI-analyzed entry:', fullEntry);
        onSave(fullEntry);
        setNote('');
        toast({
          title: "Smart entry created",
          description: `AI analyzed your note and created a ${data.result.type} entry`,
        });
      } else {
        console.log('⚠️ No AI suggestion, falling back to note entry');
        onSave({
          type: 'note',
          note: note.trim(),
          timestamp: new Date(),
        });
        setNote('');
        toast({
          title: "Note entry created",
          description: "Entry saved as a note",
        });
      }
    } catch (error) {
      console.error('❌ Smart entry error:', error);
      toast({
        title: "AI processing failed",
        description: "Created a simple note entry instead",
        variant: "destructive",
      });
      onSave({
        type: 'note',
        note: note.trim(),
        timestamp: new Date(),
      });
      setNote('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action, index) => {
          const IconComponent = action.icon;
          const getIconColor = (color: string) => {
            switch (color) {
              case 'severity-mild': return 'text-severity-mild';
              case 'severity-moderate': return 'text-severity-moderate';
              case 'severity-severe': return 'text-severity-severe';
              case 'severity-none': return 'text-severity-none';
              case 'primary': return 'text-primary';
              default: return 'text-muted-foreground';
            }
          };
          
          return (
            <Button
              key={index}
              variant="outline"
              onClick={() => handleQuickAction(action)}
              className="h-12 flex flex-col gap-1 p-2 hover:bg-muted/50"
              size="sm"
            >
              <IconComponent className={`w-4 h-4 ${getIconColor(action.color)}`} />
              <span className="text-xs">{action.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Smart Entry */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-clinical">Smart Entry</span>
        </div>
        
        {/* Voice Recording Section */}
        {transcript ? (
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Transcription:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearRecording}
                className="h-8"
              >
                Clear
              </Button>
            </div>
            <p className="text-sm text-muted-foreground italic">{transcript}</p>
            <Button
              onClick={handleVoiceEntry}
              disabled={isProcessing}
              className="w-full"
              size="sm"
            >
              {isProcessing ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze Transcription
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex-shrink-0 ${isRecording ? 'bg-destructive/10 animate-pulse' : ''}`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-4 h-4 mr-2 text-destructive" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Voice
                </>
              )}
            </Button>
            <Textarea
              placeholder="Type or use voice... (AI will analyze and categorize)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-20 text-sm flex-1"
              disabled={isRecording}
            />
          </div>
        )}
        
        {!transcript && (
          <Button
            onClick={handleSmartEntry}
            disabled={!note.trim() || isProcessing || isRecording}
            className="w-full"
            size="sm"
          >
            {isProcessing ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <StickyNote className="w-4 h-4 mr-2" />
                Add Entry
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};