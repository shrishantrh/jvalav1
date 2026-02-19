import { useState, useRef } from "react";
import { Camera, X, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoAnalyzerProps {
  onPhotoMessage: (text: string, imageDataUrl: string) => void;
  disabled?: boolean;
}

export const PhotoAnalyzer = ({ onPhotoMessage, disabled }: PhotoAnalyzerProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      // Compress via canvas
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 1024;
        let { width, height } = img;
        if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        setPreviewUrl(compressed);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    if (!previewUrl) return;
    const message = caption.trim() || "Analyze this image — what do you see? If it's a medication, identify it and suggest a schedule.";
    onPhotoMessage(message, previewUrl);
    setPreviewUrl(null);
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancel = () => {
    setPreviewUrl(null);
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (previewUrl) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 bg-card rounded-2xl border shadow-lg p-3 animate-scale-in">
        <div className="flex items-start gap-3">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={handleCancel}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add context (optional)..."
              className="w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <p className="text-[10px] text-muted-foreground mt-1">AI will analyze this photo</p>
          </div>
          <Button size="icon" className="h-8 w-8 rounded-full flex-shrink-0" onClick={handleSend}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
      <Button
        variant="outline"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="h-9 w-9 flex-shrink-0 rounded-full"
      >
        <Camera className="w-4 h-4" />
      </Button>
    </>
  );
};
