-- Fix security issues: add search_path to functions

-- Drop and recreate functions with proper search_path
DROP FUNCTION IF EXISTS public.get_city_symptom_stats(text);
DROP FUNCTION IF EXISTS public.get_city_trigger_stats(text);

-- Recreate with search_path set
CREATE OR REPLACE FUNCTION public.get_city_symptom_stats(city_name text)
RETURNS TABLE (symptom text, frequency bigint) 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unnest(symptoms) as symptom, COUNT(*) as frequency
  FROM public.flare_entries
  WHERE city = city_name 
    AND symptoms IS NOT NULL 
    AND array_length(symptoms, 1) > 0
    AND entry_type = 'flare'
  GROUP BY symptom
  ORDER BY frequency DESC
  LIMIT 5;
$$;

CREATE OR REPLACE FUNCTION public.get_city_trigger_stats(city_name text)
RETURNS TABLE (trigger text, frequency bigint)
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unnest(triggers) as trigger, COUNT(*) as frequency
  FROM public.flare_entries
  WHERE city = city_name 
    AND triggers IS NOT NULL 
    AND array_length(triggers, 1) > 0
    AND entry_type = 'flare'
  GROUP BY trigger
  ORDER BY frequency DESC
  LIMIT 5;
$$;

-- The security definer view warning is expected - we need it to allow aggregate access
-- The view itself only exposes aggregated, anonymized data which is intentional