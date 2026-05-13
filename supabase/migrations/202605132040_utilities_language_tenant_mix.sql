ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_language_preference_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_language_preference_check
  CHECK (language_preference IN ('en', 'sw'));

CREATE TABLE IF NOT EXISTS utility_meter_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  utility_type TEXT NOT NULL CHECK (utility_type IN ('water', 'electricity')),
  previous_reading DECIMAL(12, 2) NOT NULL DEFAULT 0,
  current_reading DECIMAL(12, 2) NOT NULL,
  usage_amount DECIMAL(12, 2) GENERATED ALWAYS AS (current_reading - previous_reading) STORED,
  rate_per_unit DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) GENERATED ALWAYS AS ((current_reading - previous_reading) * rate_per_unit) STORED,
  reading_date DATE NOT NULL,
  billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  billing_year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_utility_meter_readings_user_id ON utility_meter_readings(user_id);
CREATE INDEX IF NOT EXISTS idx_utility_meter_readings_property_id ON utility_meter_readings(property_id);
CREATE INDEX IF NOT EXISTS idx_utility_meter_readings_unit_id ON utility_meter_readings(unit_id);
CREATE INDEX IF NOT EXISTS idx_utility_meter_readings_billing ON utility_meter_readings(billing_month, billing_year);

ALTER TABLE utility_meter_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own utility meter readings" ON utility_meter_readings;
DROP POLICY IF EXISTS "Users can insert own utility meter readings" ON utility_meter_readings;
DROP POLICY IF EXISTS "Users can update own utility meter readings" ON utility_meter_readings;
DROP POLICY IF EXISTS "Users can delete own utility meter readings" ON utility_meter_readings;

CREATE POLICY "Users can view own utility meter readings" ON utility_meter_readings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own utility meter readings" ON utility_meter_readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own utility meter readings" ON utility_meter_readings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own utility meter readings" ON utility_meter_readings
  FOR DELETE USING (auth.uid() = user_id);
