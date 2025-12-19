import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Image, X, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PhotoCaptureProps {
  onPhotoCapture: (photoUrl: string) => void;
  existingPhotos?: string[];
  maxPhotos?: number;
  disabled?: boolean;
}

export const PhotoCapture = ({ 
  onPhotoCapture, 
  existingPhotos = [], 
  maxPhotos = 3,
  disabled 
}: PhotoCaptureProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const canAddMore = existingPhotos.length < maxPhotos;

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new window.Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 1200px width/height)
        const maxSize = 1200;
        let { width, height } = img;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          "image/jpeg",
          0.8 // 80% quality
        );
      };
      
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpload = async () => {
    if (!previewUrl || !fileInputRef.current?.files?.[0]) return;

    setIsUploading(true);
    const file = fileInputRef.current.files[0];

    try {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Please sign in to upload photos");
      }

      // Compress image
      const compressedBlob = await compressImage(file);
      
      // Check size (must be < 1MB)
      if (compressedBlob.size > 1024 * 1024) {
        throw new Error("Image too large. Please try a smaller image.");
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${user.id}/${timestamp}.jpg`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("health-reports")
        .upload(`photos/${filename}`, compressedBlob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (error) {
        console.error("Upload error:", error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("health-reports")
        .getPublicUrl(`photos/${filename}`);

      onPhotoCapture(urlData.publicUrl);
      
      toast({
        title: "Photo uploaded",
        description: "Photo added to your entry",
      });

      // Clean up
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (!canAddMore) {
    return (
      <p className="text-xs text-muted-foreground">
        Maximum {maxPhotos} photos reached
      </p>
    );
  }

  if (previewUrl) {
    return (
      <Card className="p-3 space-y-3 border-primary/20 bg-primary/5">
        <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={isUploading}
            className="flex-1"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isUploading}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        className="w-full"
      >
        <Camera className="w-4 h-4 mr-2" />
        Add Photo
      </Button>
      
      {existingPhotos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {existingPhotos.map((url, index) => (
            <div 
              key={index}
              className="w-12 h-12 rounded-md overflow-hidden bg-muted border"
            >
              <img 
                src={url} 
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
