
-- Add tour_status column to profiles table
-- Values: 'not_started', 'in_progress', 'done'
ALTER TABLE public.profiles ADD COLUMN tour_status text NOT NULL DEFAULT 'not_started';
