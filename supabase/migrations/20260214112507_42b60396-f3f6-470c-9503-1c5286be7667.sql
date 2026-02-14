
-- Persistent discoveries table for AI-detected patterns, triggers, trends
CREATE TABLE public.discoveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  discovery_type text NOT NULL, -- 'trigger', 'pattern', 'trend', 'correlation', 'protective_factor'
  category text NOT NULL, -- 'food', 'weather', 'time', 'location', 'physiological', 'activity', 'environmental', 'medication', 'lifestyle'
  
  -- What was discovered
  factor_a text NOT NULL, -- e.g. 'pizza', 'high humidity', 'poor sleep'
  factor_b text, -- e.g. 'forehead breakout', 'migraine', 'severe flare'
  relationship text NOT NULL DEFAULT 'increases_risk', -- 'increases_risk', 'decreases_risk', 'correlates_with', 'precedes', 'follows'
  
  -- Statistical evidence
  occurrence_count integer NOT NULL DEFAULT 1,
  total_exposures integer NOT NULL DEFAULT 1, -- times factor_a happened (with or without factor_b)
  confidence double precision NOT NULL DEFAULT 0.1, -- Bayesian posterior probability 0-1
  lift double precision, -- association rule lift ratio (>1 = positive association)
  avg_delay_hours double precision, -- avg time between factor_a and factor_b
  p_value double precision, -- statistical significance
  
  -- Evidence trail
  supporting_entry_ids uuid[] DEFAULT '{}',
  evidence_summary text, -- human-readable explanation of the evidence
  
  -- Status
  status text NOT NULL DEFAULT 'emerging', -- 'emerging', 'investigating', 'confirmed', 'strong', 'declining', 'disproven'
  surfaced_at timestamp with time zone, -- when user was notified
  acknowledged_at timestamp with time zone, -- when user saw it
  
  -- Metadata
  last_evidence_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_discovery UNIQUE(user_id, discovery_type, factor_a, factor_b, category)
);

ALTER TABLE public.discoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own discoveries" ON public.discoveries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own discoveries" ON public.discoveries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own discoveries" ON public.discoveries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own discoveries" ON public.discoveries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_discoveries_updated_at BEFORE UPDATE ON public.discoveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_discoveries_user_status ON public.discoveries(user_id, status);
CREATE INDEX idx_discoveries_user_confidence ON public.discoveries(user_id, confidence DESC);
CREATE INDEX idx_discoveries_unsurfaced ON public.discoveries(user_id) WHERE surfaced_at IS NULL AND confidence >= 0.3;
