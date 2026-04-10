
-- Create prediction_logs table for tracking forecast accuracy
CREATE TABLE public.prediction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  predicted_at timestamp with time zone NOT NULL DEFAULT now(),
  risk_score integer NOT NULL,
  risk_level text NOT NULL,
  confidence double precision NOT NULL,
  factors jsonb DEFAULT '[]'::jsonb,
  timeframe text DEFAULT 'next 24 hours',
  model_version text DEFAULT 'v3-bayesian-ewma',
  
  -- Verification
  outcome_logged boolean DEFAULT false,
  outcome_severity text,
  outcome_flare_count integer DEFAULT 0,
  verified_at timestamp with time zone,
  was_correct boolean,
  brier_score double precision,
  user_feedback text,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prediction_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own predictions"
  ON public.prediction_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own predictions"
  ON public.prediction_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions"
  ON public.prediction_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own predictions"
  ON public.prediction_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast queries
CREATE INDEX idx_prediction_logs_user_predicted ON public.prediction_logs (user_id, predicted_at DESC);
CREATE INDEX idx_prediction_logs_unverified ON public.prediction_logs (user_id, outcome_logged) WHERE outcome_logged = false;

-- Updated_at trigger
CREATE TRIGGER update_prediction_logs_updated_at
  BEFORE UPDATE ON public.prediction_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
