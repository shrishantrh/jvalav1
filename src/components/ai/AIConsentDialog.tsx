import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, ExternalLink, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AIConsentDialogProps {
  open: boolean;
  onConsent: () => void;
  onDecline: () => void;
}

export const AIConsentDialog = ({ open, onConsent, onDecline }: AIConsentDialogProps) => {
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDecline(); }}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-lg">AI Data Sharing Permission</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            Jvala uses AI to provide health insights. Before using AI features, please review what data is shared.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* What data is sent */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              What data is sent
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
              <li>Flare log entries (severity, symptoms, triggers)</li>
              <li>Text notes and voice transcriptions</li>
              <li>Medication names</li>
              <li>Environmental data (weather, AQI)</li>
              <li>Aggregate health patterns for analysis</li>
            </ul>
          </div>

          {/* Who receives the data */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Who receives the data</h4>
            <p className="text-sm text-muted-foreground">
              Your data is processed by <strong>Google Gemini AI</strong> (operated by Google LLC) through secure backend servers. Data is sent only when you use AI-powered features such as insights, voice analysis, health forecasts, and the AI chat assistant.
            </p>
          </div>

          {/* How data is protected */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">How your data is protected</h4>
            <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
              <li>All data is transmitted over encrypted connections (TLS)</li>
              <li>Your data is <strong>not used to train AI models</strong></li>
              <li>No data is sold to or shared with advertisers</li>
              <li>You can revoke this permission at any time in Settings</li>
            </ul>
          </div>

          <button
            onClick={() => navigate('/privacy')}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Read full Privacy Policy <ExternalLink className="w-3 h-3" />
          </button>

          {/* Consent checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 rounded border-primary text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground leading-relaxed">
              I understand and agree that my health data will be sent to Google Gemini AI for analysis, as described above.
            </span>
          </label>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onDecline}
              className="flex-1"
            >
              Not Now
            </Button>
            <Button
              onClick={onConsent}
              disabled={!accepted}
              className="flex-1"
            >
              Allow AI Features
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            You can change this anytime in Settings → Privacy.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
