BEGIN;

ALTER TABLE public.electricity_accounts
  ADD COLUMN IF NOT EXISTS initial_reading_date DATE;

UPDATE public.electricity_accounts a
SET initial_reading_date = CASE
  WHEN (
    SELECT MIN(r.reading_date)
    FROM public.electricity_readings r
    WHERE r.account_id = a.id
  ) IS NOT NULL
    AND (a.created_at AT TIME ZONE 'Africa/Nairobi')::DATE >= (
      SELECT MIN(r.reading_date)
      FROM public.electricity_readings r
      WHERE r.account_id = a.id
    )
    THEN (
      SELECT MIN(r.reading_date) - 1
      FROM public.electricity_readings r
      WHERE r.account_id = a.id
    )
  ELSE (a.created_at AT TIME ZONE 'Africa/Nairobi')::DATE
END
WHERE a.initial_reading_date IS NULL;

ALTER TABLE public.electricity_accounts
  ALTER COLUMN initial_reading_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN initial_reading_date SET NOT NULL;

ALTER TABLE public.electricity_readings
  ADD COLUMN IF NOT EXISTS previous_reading_date DATE;

WITH ordered_readings AS (
  SELECT
    r.id,
    LAG(r.reading_date) OVER (
      PARTITION BY r.account_id
      ORDER BY r.reading_date, r.created_at, r.id
    ) AS previous_date
  FROM public.electricity_readings r
)
UPDATE public.electricity_readings r
SET previous_reading_date = ordered_readings.previous_date
FROM ordered_readings
WHERE r.id = ordered_readings.id
  AND r.previous_reading_date IS NULL
  AND ordered_readings.previous_date IS NOT NULL;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_readings'::regclass
      AND conname = 'electricity_reading_period_order_check'
  ) THEN
    ALTER TABLE public.electricity_readings
      ADD CONSTRAINT electricity_reading_period_order_check
      CHECK (previous_reading_date IS NULL OR previous_reading_date < reading_date);
  END IF;
END;
$constraint$;

CREATE OR REPLACE FUNCTION public.record_electricity_meter_reading(
  p_account_id UUID,
  p_current_reading NUMERIC,
  p_reading_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.electricity_readings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $record_meter_reading$
DECLARE
  v_account public.electricity_accounts%ROWTYPE;
  v_previous_reading NUMERIC(14, 3);
  v_previous_balance NUMERIC(14, 3);
  v_previous_date DATE;
  v_topup_units NUMERIC(14, 3) := 0;
  v_closing_balance NUMERIC(14, 3);
  v_reading public.electricity_readings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF p_current_reading IS NULL OR p_current_reading < 0 THEN
    RAISE EXCEPTION 'Enter a valid non-negative meter reading';
  END IF;
  IF p_reading_date IS NULL THEN
    RAISE EXCEPTION 'Reading date is required';
  END IF;
  IF p_reading_date > (now() AT TIME ZONE 'Africa/Nairobi')::DATE THEN
    RAISE EXCEPTION 'Reading date cannot be in the future';
  END IF;

  SELECT * INTO v_account
  FROM public.electricity_accounts a
  WHERE a.id = p_account_id AND a.active
    AND public.can_access_electricity_property(a.property_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Electricity meter not found or access denied';
  END IF;

  SELECT r.current_meter_reading, r.closing_balance_units, r.reading_date
  INTO v_previous_reading, v_previous_balance, v_previous_date
  FROM public.electricity_readings r
  WHERE r.account_id = p_account_id
  ORDER BY r.reading_date DESC, r.created_at DESC
  LIMIT 1;

  v_previous_reading := COALESCE(v_previous_reading, v_account.initial_meter_reading);
  v_previous_date := COALESCE(v_previous_date, v_account.initial_reading_date);
  IF p_reading_date <= v_previous_date THEN
    RAISE EXCEPTION 'Choose a date later than the last meter reading (%).', v_previous_date;
  END IF;
  IF p_current_reading < v_previous_reading THEN
    RAISE EXCEPTION 'Current meter reading cannot be below the previous reading (%).', v_previous_reading;
  END IF;

  IF v_account.meter_kind = 'submeter' THEN
    SELECT COALESCE(SUM(t.units), 0) INTO v_topup_units
    FROM public.electricity_topups t
    WHERE t.account_id = p_account_id
      AND t.status = 'verified'
      AND t.applied_reading_id IS NULL
      AND t.purchase_date <= p_reading_date;

    v_previous_balance := COALESCE(v_previous_balance, v_account.opening_balance_units);
    v_closing_balance := v_previous_balance + v_topup_units - (p_current_reading - v_previous_reading);
  ELSE
    v_previous_balance := NULL;
    v_closing_balance := NULL;
    v_topup_units := 0;
  END IF;

  INSERT INTO public.electricity_readings (
    account_id, owner_user_id, previous_meter_reading, current_meter_reading,
    opening_balance_units, topup_units, closing_balance_units,
    previous_reading_date, reading_date, notes, recorded_by
  ) VALUES (
    v_account.id, v_account.owner_user_id, v_previous_reading, p_current_reading,
    v_previous_balance, v_topup_units, v_closing_balance,
    v_previous_date, p_reading_date, NULLIF(btrim(p_notes), ''), auth.uid()
  ) RETURNING * INTO v_reading;

  IF v_account.meter_kind = 'submeter' THEN
    UPDATE public.electricity_topups
    SET applied_reading_id = v_reading.id
    WHERE account_id = p_account_id
      AND status = 'verified'
      AND applied_reading_id IS NULL
      AND purchase_date <= p_reading_date;
  END IF;

  RETURN v_reading;
END;
$record_meter_reading$;

REVOKE ALL ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) TO authenticated;

COMMIT;
