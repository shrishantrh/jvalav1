-- Create exports log table
CREATE TABLE IF NOT EXISTS public.report_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN ('simple_pdf', 'medical_pdf', 'hl7_fhir', 'e2b_icsr', 'meddra_csv')),
  file_path TEXT,
  password_hash TEXT,
  share_token TEXT UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own exports"
  ON public.report_exports
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exports"
  ON public.report_exports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exports"
  ON public.report_exports
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exports"
  ON public.report_exports
  FOR DELETE
  USING (auth.uid() = user_id);

-- Public access for share tokens (without authentication)
CREATE POLICY "Anyone can view exports with valid share token"
  ON public.report_exports
  FOR SELECT
  USING (share_token IS NOT NULL AND expires_at > now());

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('health-reports', 'health-reports', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for health reports
CREATE POLICY "Users can upload their own reports"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'health-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own reports"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'health-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own reports"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'health-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create index for faster lookups
CREATE INDEX idx_report_exports_share_token ON public.report_exports(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_report_exports_user_id ON public.report_exports(user_id);
CREATE INDEX idx_report_exports_created_at ON public.report_exports(created_at DESC);