-- Add duration tracking to flare_entries
ALTER TABLE flare_entries 
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS end_timestamp TIMESTAMP WITH TIME ZONE;

-- Set end_timestamp based on duration for existing entries
UPDATE flare_entries 
SET end_timestamp = timestamp + (duration_minutes || ' minutes')::INTERVAL
WHERE end_timestamp IS NULL;