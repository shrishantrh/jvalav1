-- Add follow_ups field to track updates on flare entries
ALTER TABLE flare_entries 
ADD COLUMN follow_ups JSONB DEFAULT '[]'::jsonb;