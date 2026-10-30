BEGIN;

ALTER TABLE public.electricity_accounts
  ADD COLUMN IF NOT EXISTS ledger_tenant_label TEXT;

CREATE TABLE IF NOT EXISTS public.electricity_main_meter_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  units_remaining NUMERIC(14, 3) NOT NULL CHECK (units_remaining >= 0),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT electricity_main_meter_balances_account_owner_fkey
    FOREIGN KEY (account_id, owner_user_id)
    REFERENCES public.electricity_accounts (id, owner_user_id) ON DELETE RESTRICT,
  CONSTRAINT electricity_main_meter_balances_account_date_key
    UNIQUE (account_id, reading_date)
);

CREATE INDEX IF NOT EXISTS electricity_main_meter_balances_date_idx
  ON public.electricity_main_meter_balances (account_id, reading_date DESC);

ALTER TABLE public.electricity_main_meter_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Accessible main meter balances are readable"
  ON public.electricity_main_meter_balances;
CREATE POLICY "Accessible main meter balances are readable"
  ON public.electricity_main_meter_balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.electricity_accounts a
      WHERE a.id = electricity_main_meter_balances.account_id
        AND a.owner_user_id = electricity_main_meter_balances.owner_user_id
        AND a.meter_kind = 'floor_main'
        AND public.can_access_electricity_property(a.property_id)
    )
  );

GRANT SELECT ON public.electricity_main_meter_balances TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.electricity_main_meter_balances FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.record_electricity_main_meter_balance(
  p_account_id UUID,
  p_units_remaining NUMERIC,
  p_reading_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.electricity_main_meter_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $record_main_meter_balance$
DECLARE
  v_account public.electricity_accounts%ROWTYPE;
  v_balance public.electricity_main_meter_balances%ROWTYPE;
  v_notes TEXT := NULLIF(btrim(p_notes), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF p_units_remaining IS NULL OR p_units_remaining < 0 OR p_units_remaining > 1000000 THEN
    RAISE EXCEPTION 'Enter a valid main-meter balance between 0 and 1,000,000 kWh';
  END IF;
  IF p_reading_date IS NULL OR p_reading_date > (now() AT TIME ZONE 'Africa/Nairobi')::DATE THEN
    RAISE EXCEPTION 'Main-meter balance date must be today or earlier';
  END IF;
  IF length(v_notes) > 500 THEN
    RAISE EXCEPTION 'Notes must be 500 characters or less';
  END IF;

  SELECT a.* INTO v_account
  FROM public.electricity_accounts a
  WHERE a.id = p_account_id
    AND a.active
    AND a.meter_kind = 'floor_main'
    AND public.can_access_electricity_property(a.property_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active main meter not found or access denied';
  END IF;

  INSERT INTO public.electricity_main_meter_balances (
    account_id, owner_user_id, reading_date, units_remaining, notes, recorded_by
  ) VALUES (
    v_account.id, v_account.owner_user_id, p_reading_date, p_units_remaining,
    v_notes, auth.uid()
  ) RETURNING * INTO v_balance;

  RETURN v_balance;
END;
$record_main_meter_balance$;

REVOKE ALL ON FUNCTION public.record_electricity_main_meter_balance(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_main_meter_balance(UUID, NUMERIC, DATE, TEXT) TO authenticated;

COMMIT;
