
-- Food logs table for comprehensive nutrition tracking
CREATE TABLE public.food_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Food identification
  food_name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT,
  
  -- Source of data
  source TEXT NOT NULL DEFAULT 'manual', -- manual, barcode, photo_ai, search
  
  -- Meal context
  meal_type TEXT DEFAULT 'snack', -- breakfast, lunch, dinner, snack
  
  -- Serving info
  serving_size TEXT,
  servings NUMERIC(6,2) DEFAULT 1,
  
  -- Macronutrients (per serving * servings)
  calories NUMERIC(8,1),
  total_fat_g NUMERIC(6,1),
  saturated_fat_g NUMERIC(6,1),
  trans_fat_g NUMERIC(6,1),
  cholesterol_mg NUMERIC(6,1),
  sodium_mg NUMERIC(8,1),
  total_carbs_g NUMERIC(6,1),
  dietary_fiber_g NUMERIC(6,1),
  total_sugars_g NUMERIC(6,1),
  added_sugars_g NUMERIC(6,1),
  protein_g NUMERIC(6,1),
  
  -- Micronutrients
  vitamin_d_mcg NUMERIC(6,2),
  calcium_mg NUMERIC(8,1),
  iron_mg NUMERIC(6,2),
  potassium_mg NUMERIC(8,1),
  vitamin_a_mcg NUMERIC(8,1),
  vitamin_c_mg NUMERIC(6,1),
  
  -- Photos
  photos TEXT[],
  
  -- AI analysis metadata
  ai_confidence NUMERIC(3,2),
  raw_ai_response JSONB,
  
  -- Timestamps
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_food_logs_user_id ON public.food_logs(user_id);
CREATE INDEX idx_food_logs_logged_at ON public.food_logs(logged_at);
CREATE INDEX idx_food_logs_barcode ON public.food_logs(barcode) WHERE barcode IS NOT NULL;

-- RLS
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own food logs"
  ON public.food_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food logs"
  ON public.food_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food logs"
  ON public.food_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own food logs"
  ON public.food_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for food logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.food_logs;
