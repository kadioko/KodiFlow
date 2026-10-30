BEGIN;

ALTER TABLE public.electricity_accounts
  ALTER COLUMN low_units_threshold SET DEFAULT 50;

UPDATE public.electricity_accounts
SET low_units_threshold = 50
WHERE meter_kind = 'floor_main'
  AND low_units_threshold = 0;

ALTER TABLE public.electricity_accounts
  DROP CONSTRAINT IF EXISTS electricity_accounts_floor_main_threshold_check;

ALTER TABLE public.electricity_accounts
  ADD CONSTRAINT electricity_accounts_floor_main_threshold_check
  CHECK (meter_kind <> 'floor_main' OR low_units_threshold > 0);

ALTER TABLE public.electricity_main_meter_balances
  ADD COLUMN IF NOT EXISTS units_purchased_since_previous NUMERIC(14, 3)
  CHECK (units_purchased_since_previous IS NULL OR units_purchased_since_previous BETWEEN 0 AND 1000000);

DROP FUNCTION IF EXISTS public.record_electricity_main_meter_balance(UUID, NUMERIC, DATE, TEXT);
DROP FUNCTION IF EXISTS public.record_electricity_main_meter_balance(UUID, NUMERIC, DATE, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.record_electricity_main_meter_balance(
  p_account_id UUID,
  p_units_remaining NUMERIC,
  p_reading_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_units_purchased_since_previous NUMERIC DEFAULT 0,
  p_zero_confirmed BOOLEAN DEFAULT FALSE
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
  IF p_units_purchased_since_previous IS NULL
    OR p_units_purchased_since_previous < 0
    OR p_units_purchased_since_previous > 1000000 THEN
    RAISE EXCEPTION 'Units added since the previous check must be between 0 and 1,000,000 kWh';
  END IF;
  IF p_units_remaining = 0 AND NOT COALESCE(p_zero_confirmed, FALSE) THEN
    RAISE EXCEPTION 'Confirm that the main LUKU balance is truly zero before recording an outage';
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

  IF EXISTS (
    SELECT 1
    FROM public.electricity_main_meter_balances b
    WHERE b.account_id = v_account.id
      AND b.reading_date > p_reading_date
  ) THEN
    RAISE EXCEPTION 'Main-meter balance snapshots must be entered oldest to newest so recharge and usage calculations stay accurate';
  END IF;

  INSERT INTO public.electricity_main_meter_balances (
    account_id, owner_user_id, reading_date, units_remaining,
    units_purchased_since_previous, notes, recorded_by
  ) VALUES (
    v_account.id, v_account.owner_user_id, p_reading_date, p_units_remaining,
    p_units_purchased_since_previous, v_notes, auth.uid()
  ) RETURNING * INTO v_balance;

  RETURN v_balance;
END;
$record_main_meter_balance$;

REVOKE ALL ON FUNCTION public.record_electricity_main_meter_balance(UUID, NUMERIC, DATE, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_main_meter_balance(UUID, NUMERIC, DATE, TEXT, NUMERIC, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_floor_main_cumulative_reading()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $reject_floor_main_reading$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.electricity_accounts a
    WHERE a.id = NEW.account_id
      AND a.meter_kind = 'floor_main'
  ) THEN
    RAISE EXCEPTION 'Shared main meters use decreasing TANESCO LUKU balance snapshots; record this in Meters and balances.';
  END IF;

  RETURN NEW;
END;
$reject_floor_main_reading$;

DROP TRIGGER IF EXISTS reject_floor_main_cumulative_reading
  ON public.electricity_readings;
CREATE TRIGGER reject_floor_main_cumulative_reading
  BEFORE INSERT OR UPDATE OF account_id, current_meter_reading
  ON public.electricity_readings
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_floor_main_cumulative_reading();

REVOKE ALL ON FUNCTION public.reject_floor_main_cumulative_reading() FROM PUBLIC;

COMMIT;
