-- Add photos storage policy for authenticated users
CREATE POLICY "Users can upload photos to their folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'health-reports' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can view their own photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'health-reports' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can delete their own photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'health-reports' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Add photos and voice_transcript columns to flare_entries
ALTER TABLE public.flare_entries 
ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS voice_transcript text;