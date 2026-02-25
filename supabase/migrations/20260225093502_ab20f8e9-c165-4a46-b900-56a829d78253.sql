CREATE TABLE IF NOT EXISTS public.temp_auth_relay (
  nonce text PRIMARY KEY,
  tokens jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- No RLS needed - accessed only via edge function with service role
ALTER TABLE public.temp_auth_relay ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup trigger: remove entries older than 5 minutes on every insert
CREATE OR REPLACE FUNCTION public.cleanup_temp_auth_relay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.temp_auth_relay WHERE created_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_temp_relay
  AFTER INSERT ON public.temp_auth_relay
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_temp_auth_relay();