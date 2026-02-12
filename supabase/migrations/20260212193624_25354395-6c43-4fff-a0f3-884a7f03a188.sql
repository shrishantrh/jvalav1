
-- 1. Fix community_hotspots view: change from SECURITY DEFINER to SECURITY INVOKER
DROP VIEW IF EXISTS public.community_hotspots;

CREATE VIEW public.community_hotspots
WITH (security_invoker = true)
AS
SELECT
  city,
  COUNT(*) AS report_count,
  ROUND(AVG(
    CASE severity
      WHEN 'mild' THEN 1
      WHEN 'moderate' THEN 2
      WHEN 'severe' THEN 3
      ELSE NULL
    END
  ), 1) AS avg_severity,
  COUNT(*) FILTER (WHERE timestamp > now() - interval '7 days') AS recent_count,
  COUNT(*) FILTER (WHERE timestamp > now() - interval '30 days') AS monthly_count,
  (
    SELECT unnest(symptoms)
    FROM public.flare_entries fe2
    WHERE fe2.city = fe.city
      AND fe2.symptoms IS NOT NULL
      AND array_length(fe2.symptoms, 1) > 0
    GROUP BY unnest(symptoms)
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS top_symptom
FROM public.flare_entries fe
WHERE city IS NOT NULL
  AND entry_type = 'flare'
GROUP BY city
HAVING COUNT(*) >= 3;

-- 2. Fix get_city_symptom_stats: add proper authorization check
CREATE OR REPLACE FUNCTION public.get_city_symptom_stats(city_name text)
RETURNS TABLE(symptom text, frequency bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Require authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  RETURN QUERY
  SELECT unnest(symptoms) as symptom, COUNT(*) as frequency
  FROM public.flare_entries
  WHERE city = city_name 
    AND symptoms IS NOT NULL 
    AND array_length(symptoms, 1) > 0
    AND entry_type = 'flare'
  GROUP BY symptom
  ORDER BY frequency DESC
  LIMIT 5;
END;
$function$;

-- 3. Fix get_city_trigger_stats: add proper authorization check
CREATE OR REPLACE FUNCTION public.get_city_trigger_stats(city_name text)
RETURNS TABLE(trigger text, frequency bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Require authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  RETURN QUERY
  SELECT unnest(triggers) as trigger, COUNT(*) as frequency
  FROM public.flare_entries
  WHERE city = city_name 
    AND triggers IS NOT NULL 
    AND array_length(triggers, 1) > 0
    AND entry_type = 'flare'
  GROUP BY trigger
  ORDER BY frequency DESC
  LIMIT 5;
END;
$function$;

-- 4. Add expiry + password requirement to physician_access token policy
-- Drop the overly-permissive policy
DROP POLICY IF EXISTS "Anyone can view with valid access token" ON public.physician_access;

-- Replace with a policy that requires password_hash checking to be done in the edge function
-- The anon SELECT is needed for the shared-profile flow but we tighten it:
-- tokens must not be expired and we add a created_at check to prevent ancient tokens
CREATE POLICY "Shared access with valid unexpired token"
ON public.physician_access
FOR SELECT
USING (
  access_token IS NOT NULL
  AND expires_at > now()
  AND created_at > now() - interval '90 days'
);

-- 5. Tighten report_exports share policy similarly
DROP POLICY IF EXISTS "Anyone can view exports with valid share token" ON public.report_exports;

CREATE POLICY "Shared exports with valid unexpired token"
ON public.report_exports
FOR SELECT
USING (
  share_token IS NOT NULL
  AND expires_at IS NOT NULL
  AND expires_at > now()
  AND created_at > now() - interval '90 days'
);
