import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2, Key, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SettingsProps {
  geminiApiKey: string;
  onApiKeyChange: (key: string) => void;
}

export const Settings = ({ geminiApiKey, onApiKeyChange }: SettingsProps) => {
  const [open, setOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(geminiApiKey);
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTempApiKey(geminiApiKey);
  }, [geminiApiKey]);

  const validateApiKey = async (key: string): Promise<boolean> => {
    if (!key.trim()) return false;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (!tempApiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Gemini API key to enable AI features",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    const isValid = await validateApiKey(tempApiKey);
    setIsValidating(false);

    if (!isValid) {
      toast({
        title: "Invalid API Key",
        description: "Please check your Gemini API key and try again",
        variant: "destructive",
      });
      return;
    }

    onApiKeyChange(tempApiKey);
    setOpen(false);
    toast({
      title: "Settings saved",
      description: "AI insights and features are now enabled",
    });
  };

  const isConfigured = !!geminiApiKey;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Settings2 className="w-4 h-4" />
          {isConfigured && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-severity-none rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              <Label htmlFor="apiKey">Gemini API Key</Label>
              {isConfigured && <Check className="w-4 h-4 text-severity-none" />}
            </div>
            <Input
              id="apiKey"
              type="password"
              placeholder="AIzaSy..."
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              className="font-mono text-sm"
            />
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <div>
                Get your API key from{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google AI Studio
                </a>
                . Required for AI insights and suggestions.
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isValidating || tempApiKey === geminiApiKey}
              className="flex-1"
            >
              {isValidating ? "Validating..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTempApiKey(geminiApiKey);
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};