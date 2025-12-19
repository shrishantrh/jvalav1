-- Create correlations table for activity-symptom relationships
CREATE TABLE public.correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL, -- 'activity', 'food', 'weather', 'medication', 'time_of_day'
  trigger_value TEXT NOT NULL,
  outcome_type TEXT NOT NULL, -- 'symptom', 'flare', 'severity'
  outcome_value TEXT NOT NULL,
  avg_delay_minutes INTEGER DEFAULT 0,
  occurrence_count INTEGER DEFAULT 1,
  confidence FLOAT DEFAULT 0.0,
  last_occurred TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create activity_logs table for first-class activity entries
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'run', 'walk', 'gym', 'work', 'sleep', 'eat', 'commute'
  activity_value TEXT,
  duration_minutes INTEGER,
  intensity TEXT, -- 'low', 'moderate', 'high'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  followed_up BOOLEAN DEFAULT false,
  follow_up_result JSONB DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create weekly_reports table for pre-computed health summaries
CREATE TABLE public.weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  health_score INTEGER, -- 0-100
  flare_count INTEGER DEFAULT 0,
  avg_severity FLOAT,
  trend TEXT, -- 'improving', 'stable', 'worsening'
  logging_consistency FLOAT, -- percentage of days logged
  key_insights JSONB DEFAULT '[]',
  top_correlations JSONB DEFAULT '[]',
  top_symptoms JSONB DEFAULT '[]',
  top_triggers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create physician_access table for secure shareable links
CREATE TABLE public.physician_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  access_token TEXT UNIQUE NOT NULL,
  physician_email TEXT,
  physician_name TEXT,
  physician_practice TEXT,
  access_level TEXT DEFAULT 'read', -- 'read', 'full'
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physician_access ENABLE ROW LEVEL SECURITY;

-- Correlations policies
CREATE POLICY "Users can view their own correlations"
ON public.correlations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own correlations"
ON public.correlations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own correlations"
ON public.correlations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own correlations"
ON public.correlations FOR DELETE
USING (auth.uid() = user_id);

-- Activity logs policies
CREATE POLICY "Users can view their own activity logs"
ON public.activity_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity logs"
ON public.activity_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity logs"
ON public.activity_logs FOR DELETE
USING (auth.uid() = user_id);

-- Weekly reports policies
CREATE POLICY "Users can view their own weekly reports"
ON public.weekly_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly reports"
ON public.weekly_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly reports"
ON public.weekly_reports FOR UPDATE
USING (auth.uid() = user_id);

-- Physician access policies
CREATE POLICY "Users can view their own physician access"
ON public.physician_access FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own physician access"
ON public.physician_access FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own physician access"
ON public.physician_access FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own physician access"
ON public.physician_access FOR DELETE
USING (auth.uid() = user_id);

-- Allow anyone to view physician access with valid token (for doctors)
CREATE POLICY "Anyone can view with valid access token"
ON public.physician_access FOR SELECT
USING (access_token IS NOT NULL AND expires_at > now());

-- Create indexes for performance
CREATE INDEX idx_correlations_user_id ON public.correlations(user_id);
CREATE INDEX idx_correlations_trigger ON public.correlations(user_id, trigger_type, trigger_value);
CREATE INDEX idx_correlations_confidence ON public.correlations(user_id, confidence DESC);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_timestamp ON public.activity_logs(user_id, timestamp DESC);
CREATE INDEX idx_activity_logs_not_followed_up ON public.activity_logs(user_id, followed_up) WHERE followed_up = false;
CREATE INDEX idx_weekly_reports_user_week ON public.weekly_reports(user_id, week_start DESC);
CREATE INDEX idx_physician_access_token ON public.physician_access(access_token);

-- Create updated_at trigger for correlations
CREATE TRIGGER update_correlations_updated_at
BEFORE UPDATE ON public.correlations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();