-- Update default duration to 15 minutes for instant flares
ALTER TABLE flare_entries 
ALTER COLUMN duration_minutes SET DEFAULT 15;

-- Update existing entries with 60 minutes to 15 minutes to make them instant
UPDATE flare_entries 
SET duration_minutes = 15
WHERE duration_minutes = 60 OR duration_minutes IS NULL;