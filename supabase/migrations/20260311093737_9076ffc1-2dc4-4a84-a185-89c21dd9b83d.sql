
-- Add phone_number to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text UNIQUE;

-- Create SMS conversations table
CREATE TABLE public.sms_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_number text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookup by phone
CREATE INDEX idx_sms_conversations_phone ON public.sms_conversations(phone_number, created_at DESC);
CREATE INDEX idx_sms_conversations_user ON public.sms_conversations(user_id, created_at DESC);
CREATE INDEX idx_profiles_phone ON public.profiles(phone_number) WHERE phone_number IS NOT NULL;

-- RLS
ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own SMS history
CREATE POLICY "Users can view their own sms conversations"
  ON public.sms_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role inserts (webhook uses service role key)
CREATE POLICY "Service can insert sms conversations"
  ON public.sms_conversations FOR INSERT
  WITH CHECK (true);

-- Users can delete their own
CREATE POLICY "Users can delete their own sms conversations"
  ON public.sms_conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
