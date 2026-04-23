
-- RPM time tracking for billing
CREATE TABLE public.rpm_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  activity_type text NOT NULL DEFAULT 'chart_review',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rpm_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians manage own time entries"
ON public.rpm_time_entries FOR ALL TO authenticated
USING (auth.uid() = clinician_id)
WITH CHECK (auth.uid() = clinician_id);

-- clinical_alerts INSERT policy (currently missing)
CREATE POLICY "Linked clinicians can insert alerts"
ON public.clinical_alerts FOR INSERT TO authenticated
WITH CHECK (is_clinician_for_patient(auth.uid(), patient_id));
