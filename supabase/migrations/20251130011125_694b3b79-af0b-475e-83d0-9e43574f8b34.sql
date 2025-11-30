-- Create engagement table for streaks, badges, reminders
CREATE TABLE public.engagement (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  last_log_date DATE,
  total_logs INTEGER DEFAULT 0,
  reminder_enabled BOOLEAN DEFAULT false,
  reminder_times TEXT[] DEFAULT '{}',
  home_shortcuts TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.engagement ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own engagement"
ON public.engagement FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own engagement"
ON public.engagement FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own engagement"
ON public.engagement FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for timestamp using existing function
CREATE TRIGGER update_engagement_updated_at
BEFORE UPDATE ON public.engagement
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add location columns to flare_entries if they don't exist
ALTER TABLE public.flare_entries 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS city TEXT;