
-- ============================================================
-- FIX 1: Tighten profiles RLS - add TO authenticated to block anon access
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = id);

-- ============================================================
-- FIX 2: Tighten medication_logs RLS - add TO authenticated
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can insert their own medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can update their own medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can delete their own medication logs" ON public.medication_logs;

CREATE POLICY "Users can view their own medication logs"
ON public.medication_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own medication logs"
ON public.medication_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own medication logs"
ON public.medication_logs FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own medication logs"
ON public.medication_logs FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ============================================================
-- FIX 3: Disable EHR feature - drop all ehr_tokens policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own EHR tokens" ON public.ehr_tokens;
DROP POLICY IF EXISTS "Users can insert their own EHR tokens" ON public.ehr_tokens;
DROP POLICY IF EXISTS "Users can update their own EHR tokens" ON public.ehr_tokens;
DROP POLICY IF EXISTS "Users can delete their own EHR tokens" ON public.ehr_tokens;

-- Deny all access to ehr_tokens (feature disabled)
CREATE POLICY "EHR feature disabled - no access"
ON public.ehr_tokens FOR ALL TO authenticated
USING (false)
WITH CHECK (false);

-- Same for ehr_connections
DROP POLICY IF EXISTS "Users can view their own EHR connections" ON public.ehr_connections;
DROP POLICY IF EXISTS "Users can create their own EHR connections" ON public.ehr_connections;
DROP POLICY IF EXISTS "Users can update their own EHR connections" ON public.ehr_connections;
DROP POLICY IF EXISTS "Users can delete their own EHR connections" ON public.ehr_connections;

CREATE POLICY "EHR feature disabled - no access"
ON public.ehr_connections FOR ALL TO authenticated
USING (false)
WITH CHECK (false);
