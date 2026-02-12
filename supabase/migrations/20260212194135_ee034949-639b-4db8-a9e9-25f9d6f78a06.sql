
-- Add input validation to city stats functions
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
  
  -- Input validation
  IF city_name IS NULL OR length(city_name) > 100 OR length(city_name) < 1 THEN
    RAISE EXCEPTION 'Invalid city name';
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
  
  -- Input validation
  IF city_name IS NULL OR length(city_name) > 100 OR length(city_name) < 1 THEN
    RAISE EXCEPTION 'Invalid city name';
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
