-- AI Memories: persistent facts Jvala learns about the user over time
-- Each row = one discrete fact, preference, or pattern the AI has learned

CREATE TABLE IF NOT EXISTS ai_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- Category of memory for filtering and display
  category text NOT NULL CHECK (category IN (
    'health',       -- medical facts, diagnoses, symptoms, conditions
    'lifestyle',    -- routines, habits, sleep, diet, work
    'emotional',    -- emotional patterns, mental health observations
    'social',       -- relationships, family, support network
    'preference',   -- what helps / what makes things worse
    'personal',     -- name, location, job, personal facts
    'pattern'       -- observed behavioral or health patterns
  )),
  content text NOT NULL,                -- The actual memory text
  importance integer DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  reinforcement_count integer DEFAULT 1, -- How many times this has been confirmed
  last_reinforced timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast per-user memory retrieval sorted by importance
CREATE INDEX IF NOT EXISTS ai_memories_user_importance_idx
  ON ai_memories (user_id, importance DESC);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS ai_memories_user_category_idx
  ON ai_memories (user_id, category);

-- RLS: users can only read/write their own memories
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memories"
  ON ai_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
  ON ai_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories"
  ON ai_memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
  ON ai_memories FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (edge functions) can do everything
CREATE POLICY "Service role full access"
  ON ai_memories FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ai_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_memories_updated_at
  BEFORE UPDATE ON ai_memories
  FOR EACH ROW EXECUTE FUNCTION update_ai_memories_updated_at();
