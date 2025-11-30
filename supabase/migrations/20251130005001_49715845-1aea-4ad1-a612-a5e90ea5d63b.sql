-- Add enhanced profile fields for conditions, symptoms, triggers, physician
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS conditions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS known_symptoms text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS known_triggers text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS physician_name text,
ADD COLUMN IF NOT EXISTS physician_email text,
ADD COLUMN IF NOT EXISTS physician_phone text,
ADD COLUMN IF NOT EXISTS physician_practice text,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;