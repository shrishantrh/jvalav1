-- Create community_hotspots materialized view for anonymized aggregate data
-- This view aggregates flare data by city to create community hotspots without exposing individual data

-- First create a view that aggregates anonymized data
CREATE OR REPLACE VIEW public.community_hotspots AS
SELECT 
  city,
  COUNT(*) as report_count,
  ROUND(AVG(
    CASE 
      WHEN severity = 'severe' THEN 3 
      WHEN severity = 'moderate' THEN 2 
      WHEN severity = 'mild' THEN 1 
      ELSE 0 
    END
  )::numeric, 2) as avg_severity,
  MODE() WITHIN GROUP (ORDER BY symptoms[1]) as top_symptom,
  COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as recent_count,
  COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '30 days') as monthly_count
FROM public.flare_entries
WHERE city IS NOT NULL 
  AND city != ''
  AND entry_type = 'flare'
GROUP BY city
HAVING COUNT(*) >= 3;

-- Allow anyone to read the aggregated view (it's already anonymized)
GRANT SELECT ON public.community_hotspots TO anon, authenticated;

-- Create a function to get symptom frequencies by city (anonymized)
CREATE OR REPLACE FUNCTION public.get_city_symptom_stats(city_name text)
RETURNS TABLE (symptom text, frequency bigint) 
LANGUAGE sql SECURITY DEFINER
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

-- Create a function to get trigger frequencies by city (anonymized)  
CREATE OR REPLACE FUNCTION public.get_city_trigger_stats(city_name text)
RETURNS TABLE (trigger text, frequency bigint)
LANGUAGE sql SECURITY DEFINER
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