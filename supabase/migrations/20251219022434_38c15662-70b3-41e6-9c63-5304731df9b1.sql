-- Create medication_logs table for tracking medication intake
CREATE TABLE public.medication_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT DEFAULT 'standard',
  frequency TEXT DEFAULT 'as-needed',
  taken_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own medication logs"
  ON public.medication_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own medication logs"
  ON public.medication_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own medication logs"
  ON public.medication_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own medication logs"
  ON public.medication_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_medication_logs_user_taken ON public.medication_logs(user_id, taken_at DESC);