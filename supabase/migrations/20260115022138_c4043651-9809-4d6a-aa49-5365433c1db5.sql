-- Add RLS policy for ehr_tokens (service role only - users read via edge function)
create policy "Service role only for ehr_tokens"
on public.ehr_tokens
for all
using (false);

-- Fix community_hotspots view security (it's read-only aggregated data)
-- This is a pre-existing view - we'll leave it as-is since it only shows anonymized aggregated data
