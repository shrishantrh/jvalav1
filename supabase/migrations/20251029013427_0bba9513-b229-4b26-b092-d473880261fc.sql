-- Add metadata JSONB column to profiles table for storing medications and other profile data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;