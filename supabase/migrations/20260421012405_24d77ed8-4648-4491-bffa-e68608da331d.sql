-- ============================================================================
-- INDUSTRY-GRADE CLINICIAN PORTAL — FOUNDATION (reordered)
-- ============================================================================

-- 1. ROLES
CREATE TYPE public.app_role AS ENUM ('patient', 'clinician', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. CLINICIAN PROFILES (table only; cross-ref policy added later)
CREATE TABLE public.clinician_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  npi TEXT,
  specialty TEXT,
  license_number TEXT,
  license_state TEXT,
  practice_name TEXT,
  practice_address TEXT,
  practice_phone TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinician_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians can view their own profile" ON public.clinician_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Clinicians can insert their own profile" ON public.clinician_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Clinicians can update their own profile" ON public.clinician_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TRIGGER update_clinician_profiles_updated_at
  BEFORE UPDATE ON public.clinician_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. PATIENT ↔ CLINICIAN LINKS
CREATE TABLE public.patient_clinician_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinician_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked','declined')),
  access_level TEXT NOT NULL DEFAULT 'full' CHECK (access_level IN ('read','full')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  invitation_token TEXT UNIQUE,
  invitation_expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, clinician_id)
);
CREATE INDEX idx_pcl_patient ON public.patient_clinician_links(patient_id, status);
CREATE INDEX idx_pcl_clinician ON public.patient_clinician_links(clinician_id, status);
CREATE INDEX idx_pcl_invited_email ON public.patient_clinician_links(invited_email) WHERE clinician_id IS NULL;

ALTER TABLE public.patient_clinician_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view their own links" ON public.patient_clinician_links
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Clinicians can view links to themselves" ON public.patient_clinician_links
  FOR SELECT TO authenticated USING (auth.uid() = clinician_id);
CREATE POLICY "Patients can create invitations" ON public.patient_clinician_links
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients can update their own links" ON public.patient_clinician_links
  FOR UPDATE TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Clinicians can update links to themselves" ON public.patient_clinician_links
  FOR UPDATE TO authenticated USING (auth.uid() = clinician_id);
CREATE POLICY "Patients can delete their own links" ON public.patient_clinician_links
  FOR DELETE TO authenticated USING (auth.uid() = patient_id);

CREATE TRIGGER update_pcl_updated_at
  BEFORE UPDATE ON public.patient_clinician_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Now safe to add the cross-reference policy on clinician_profiles
CREATE POLICY "Linked patients can view their clinician profile" ON public.clinician_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patient_clinician_links pcl
    WHERE pcl.clinician_id = clinician_profiles.id
      AND pcl.patient_id = auth.uid()
      AND pcl.status = 'active'
  ));

-- Helper function
CREATE OR REPLACE FUNCTION public.is_clinician_for_patient(_clinician_id UUID, _patient_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_clinician_links
    WHERE clinician_id = _clinician_id AND patient_id = _patient_id AND status = 'active'
  )
$$;

-- 4. CLINICAL ALERTS
CREATE TABLE public.clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'drug_interaction','adr_signal','severity_escalation','missed_dose_pattern',
    'critical_risk','frequency_spike','new_symptom_cluster','medication_overuse'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX idx_alerts_patient ON public.clinical_alerts(patient_id, severity, dismissed, created_at DESC);
ALTER TABLE public.clinical_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view their own alerts" ON public.clinical_alerts
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Linked clinicians can view patient alerts" ON public.clinical_alerts
  FOR SELECT TO authenticated USING (public.is_clinician_for_patient(auth.uid(), patient_id));
CREATE POLICY "Linked clinicians can acknowledge alerts" ON public.clinical_alerts
  FOR UPDATE TO authenticated USING (public.is_clinician_for_patient(auth.uid(), patient_id));

-- 5. SOAP NOTES
CREATE TABLE public.soap_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  chief_complaint TEXT,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  ai_model TEXT,
  ai_evidence_entry_ids UUID[] DEFAULT '{}'::uuid[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','amended')),
  finalized_at TIMESTAMPTZ,
  signed_by UUID REFERENCES auth.users(id),
  signed_clinician_name TEXT,
  signed_clinician_npi TEXT,
  amendment_of UUID REFERENCES public.soap_notes(id),
  pdf_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_soap_patient ON public.soap_notes(patient_id, visit_date DESC);
CREATE INDEX idx_soap_clinician ON public.soap_notes(clinician_id, visit_date DESC);
ALTER TABLE public.soap_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view their own SOAP notes" ON public.soap_notes
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Clinicians can view SOAP for linked patients" ON public.soap_notes
  FOR SELECT TO authenticated USING (auth.uid() = clinician_id AND public.is_clinician_for_patient(auth.uid(), patient_id));
CREATE POLICY "Clinicians can create SOAP for linked patients" ON public.soap_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = clinician_id AND public.is_clinician_for_patient(auth.uid(), patient_id));
CREATE POLICY "Clinicians can update their draft SOAP notes" ON public.soap_notes
  FOR UPDATE TO authenticated USING (auth.uid() = clinician_id AND status = 'draft');
CREATE POLICY "Clinicians can delete their draft SOAP notes" ON public.soap_notes
  FOR DELETE TO authenticated USING (auth.uid() = clinician_id AND status = 'draft');

CREATE TRIGGER update_soap_notes_updated_at
  BEFORE UPDATE ON public.soap_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. VISIT SUMMARIES
CREATE TABLE public.visit_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soap_note_id UUID REFERENCES public.soap_notes(id) ON DELETE SET NULL,
  visit_date TIMESTAMPTZ NOT NULL,
  summary_md TEXT NOT NULL,
  pdf_path TEXT,
  shared_with_patient BOOLEAN NOT NULL DEFAULT false,
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_summaries_patient ON public.visit_summaries(patient_id, visit_date DESC);
ALTER TABLE public.visit_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view shared summaries" ON public.visit_summaries
  FOR SELECT TO authenticated USING (auth.uid() = patient_id AND shared_with_patient = true);
CREATE POLICY "Clinicians can view their summaries" ON public.visit_summaries
  FOR SELECT TO authenticated USING (auth.uid() = clinician_id AND public.is_clinician_for_patient(auth.uid(), patient_id));
CREATE POLICY "Clinicians can create summaries" ON public.visit_summaries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = clinician_id AND public.is_clinician_for_patient(auth.uid(), patient_id));
CREATE POLICY "Clinicians can update their summaries" ON public.visit_summaries
  FOR UPDATE TO authenticated USING (auth.uid() = clinician_id);

-- 7. AUDIT LOG
CREATE TABLE public.clinician_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_clinician ON public.clinician_audit_log(clinician_id, created_at DESC);
CREATE INDEX idx_audit_patient ON public.clinician_audit_log(patient_id, created_at DESC);
ALTER TABLE public.clinician_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians can view their audit trail" ON public.clinician_audit_log
  FOR SELECT TO authenticated USING (auth.uid() = clinician_id);
CREATE POLICY "Patients can view who accessed their data" ON public.clinician_audit_log
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Authenticated users can insert their audit entries" ON public.clinician_audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = clinician_id);

-- 8. EXTEND patient-data tables to allow linked clinician reads
CREATE POLICY "Linked clinicians can view patient flare entries" ON public.flare_entries
  FOR SELECT TO authenticated USING (public.is_clinician_for_patient(auth.uid(), user_id));
CREATE POLICY "Linked clinicians can view patient medication logs" ON public.medication_logs
  FOR SELECT TO authenticated USING (public.is_clinician_for_patient(auth.uid(), user_id));
CREATE POLICY "Linked clinicians can view patient food logs" ON public.food_logs
  FOR SELECT TO authenticated USING (public.is_clinician_for_patient(auth.uid(), user_id));
CREATE POLICY "Linked clinicians can view patient activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.is_clinician_for_patient(auth.uid(), user_id));
CREATE POLICY "Linked clinicians can view patient profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_clinician_for_patient(auth.uid(), id));
CREATE POLICY "Linked clinicians can view patient discoveries" ON public.discoveries
  FOR SELECT TO authenticated USING (public.is_clinician_for_patient(auth.uid(), user_id));
CREATE POLICY "Linked clinicians can view patient predictions" ON public.prediction_logs
  FOR SELECT TO authenticated USING (public.is_clinician_for_patient(auth.uid(), user_id));

-- 9. AUTO-LINK pending invites on clinician signup
CREATE OR REPLACE FUNCTION public.auto_link_pending_invites()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.patient_clinician_links
  SET clinician_id = NEW.id, status = 'active', accepted_at = now(), updated_at = now()
  WHERE invited_email = NEW.email AND clinician_id IS NULL AND status = 'pending';
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_link_invites_on_clinician_signup
  AFTER INSERT ON public.clinician_profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_pending_invites();
