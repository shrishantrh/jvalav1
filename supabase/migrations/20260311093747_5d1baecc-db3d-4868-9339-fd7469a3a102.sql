
-- Fix: drop overly permissive policy and replace with service-role-only pattern
DROP POLICY IF EXISTS "Service can insert sms conversations" ON public.sms_conversations;

-- The webhook uses service_role which bypasses RLS entirely, so no INSERT policy needed for anon.
-- Authenticated users shouldn't insert SMS messages directly.
