ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dashboard_hidden_property_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE leases
  DROP CONSTRAINT IF EXISTS leases_billing_frequency_check;

ALTER TABLE leases
  ADD CONSTRAINT leases_billing_frequency_check
  CHECK (billing_frequency IN ('monthly', 'quarterly', 'semi_annually', 'annually'));
