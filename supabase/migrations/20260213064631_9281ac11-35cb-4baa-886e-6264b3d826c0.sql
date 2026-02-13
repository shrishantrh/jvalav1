-- Constraint #5: Idempotency for flare inserts
-- Create a unique index on user_id + timestamp to prevent duplicate flare logs from double-taps
-- Using a unique index instead of constraint so we can use ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_flare_entries_user_timestamp 
ON public.flare_entries (user_id, timestamp);
