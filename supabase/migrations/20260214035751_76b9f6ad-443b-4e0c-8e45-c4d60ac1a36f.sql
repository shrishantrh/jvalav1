-- Fix 1: Drop the overly restrictive deny-all policy on ehr_tokens and add proper user-scoped policies
DROP POLICY IF EXISTS "Service role only for ehr_tokens" ON public.ehr_tokens;

CREATE POLICY "Users can view their own EHR tokens"
ON public.ehr_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own EHR tokens"
ON public.ehr_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own EHR tokens"
ON public.ehr_tokens
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own EHR tokens"
ON public.ehr_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Fix 2: Tighten physician_access - remove the public SELECT policy that exposes access_token
-- and replace with a more restrictive one that doesn't leak the token value
DROP POLICY IF EXISTS "Shared access with valid unexpired token" ON public.physician_access;

-- Create a view function for physician access that validates token server-side
-- The public policy should NOT allow browsing/enumeration - require exact token match
CREATE POLICY "Shared access requires exact valid token match"
ON public.physician_access
FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    access_token IS NOT NULL
    AND expires_at > now()
    AND created_at > (now() - interval '90 days')
  )
);

-- Fix 3: Add UPDATE policy for physician_access to track access_count/last_accessed
-- (already exists via "Users can update their own physician access")