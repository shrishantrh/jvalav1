CREATE TABLE public.ai_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  importance float NOT NULL DEFAULT 0.5,
  evidence_count int NOT NULL DEFAULT 1,
  last_reinforced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ai_memories_user ON public.ai_memories(user_id);
CREATE INDEX idx_ai_memories_importance ON public.ai_memories(user_id, importance DESC);

ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memories" ON public.ai_memories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memories" ON public.ai_memories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memories" ON public.ai_memories FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON public.ai_memories FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_memories_updated_at BEFORE UPDATE ON public.ai_memories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();