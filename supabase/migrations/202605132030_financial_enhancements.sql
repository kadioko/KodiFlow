ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS late_fee_rate DECIMAL(5, 2) DEFAULT 0;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS deposit_paid_amount DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'pending';

ALTER TABLE leases
  DROP CONSTRAINT IF EXISTS leases_deposit_status_check;

ALTER TABLE leases
  ADD CONSTRAINT leases_deposit_status_check
  CHECK (deposit_status IN ('pending', 'partial', 'paid', 'refunded'));
