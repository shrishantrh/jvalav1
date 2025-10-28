-- Add full_name to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add share settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS share_password_hash TEXT,
ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT false;