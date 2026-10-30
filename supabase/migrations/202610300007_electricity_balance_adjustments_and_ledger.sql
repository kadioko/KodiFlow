BEGIN;

ALTER TABLE public.electricity_readings
  ADD COLUMN IF NOT EXISTS adjustment_units NUMERIC(14, 3) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.electricity_balance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  adjustment_date DATE NOT NULL,
  adjustment_units NUMERIC(14, 3) NOT NULL CHECK (adjustment_units <> 0 AND abs(adjustment_units) <= 100000),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  applied_reading_id UUID,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT electricity_balance_adjustments_account_owner_fkey
    FOREIGN KEY (account_id, owner_user_id)
    REFERENCES public.electricity_accounts (id, owner_user_id) ON DELETE RESTRICT,
  CONSTRAINT electricity_balance_adjustments_reading_fkey
    FOREIGN KEY (account_id, applied_reading_id)
    REFERENCES public.electricity_readings (account_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS electricity_balance_adjustments_account_date_idx
  ON public.electricity_balance_adjustments (account_id, adjustment_date, created_at);

ALTER TABLE public.electricity_balance_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Accessible electricity balance adjustments are readable"
  ON public.electricity_balance_adjustments;
CREATE POLICY "Accessible electricity balance adjustments are readable"
  ON public.electricity_balance_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.electricity_accounts a
      WHERE a.id = electricity_balance_adjustments.account_id
        AND a.owner_user_id = electricity_balance_adjustments.owner_user_id
        AND public.can_access_electricity_property(a.property_id)
    )
  );

GRANT SELECT ON public.electricity_balance_adjustments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.electricity_balance_adjustments FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.adjust_electricity_balance(
  p_account_id UUID,
  p_adjustment_units NUMERIC,
  p_adjustment_date DATE,
  p_reason TEXT
)
RETURNS public.electricity_balance_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $adjust_balance$
DECLARE
  v_account public.electricity_accounts%ROWTYPE;
  v_last_reading_date DATE;
  v_adjustment public.electricity_balance_adjustments%ROWTYPE;
  v_reason TEXT := NULLIF(btrim(p_reason), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF p_adjustment_units IS NULL OR p_adjustment_units = 0 OR abs(p_adjustment_units) > 100000 THEN
    RAISE EXCEPTION 'Enter a non-zero adjustment between -100,000 and 100,000 kWh';
  END IF;
  IF p_adjustment_date IS NULL OR p_adjustment_date > (now() AT TIME ZONE 'Africa/Nairobi')::DATE THEN
    RAISE EXCEPTION 'Adjustment date must be today or earlier';
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'Enter a reason between 3 and 500 characters';
  END IF;

  SELECT a.* INTO v_account
  FROM public.electricity_accounts a
  JOIN public.properties p ON p.id = a.property_id
  WHERE a.id = p_account_id
    AND a.active
    AND a.meter_kind = 'submeter'
    AND p.user_id = auth.uid()
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the property owner can adjust an active client submeter balance';
  END IF;

  SELECT COALESCE(MAX(r.reading_date), v_account.initial_reading_date)
  INTO v_last_reading_date
  FROM public.electricity_readings r
  WHERE r.account_id = p_account_id;

  IF p_adjustment_date < v_last_reading_date THEN
    RAISE EXCEPTION 'Adjustment date cannot be earlier than the last meter reading (%)', v_last_reading_date;
  END IF;

  INSERT INTO public.electricity_balance_adjustments (
    account_id, owner_user_id, adjustment_date, adjustment_units, reason, recorded_by
  ) VALUES (
    v_account.id, v_account.owner_user_id, p_adjustment_date, p_adjustment_units, v_reason, auth.uid()
  ) RETURNING * INTO v_adjustment;

  RETURN v_adjustment;
END;
$adjust_balance$;

REVOKE ALL ON FUNCTION public.adjust_electricity_balance(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_electricity_balance(UUID, NUMERIC, DATE, TEXT) TO authenticated;

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
  v_adjustment_units NUMERIC(14, 3) := 0;
  v_closing_balance NUMERIC(14, 3);
  v_reading public.electricity_readings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF p_current_reading IS NULL OR p_current_reading < 0 THEN
    RAISE EXCEPTION 'Enter a valid non-negative meter reading';
  END IF;
  IF p_reading_date IS NULL OR p_reading_date > (now() AT TIME ZONE 'Africa/Nairobi')::DATE THEN
    RAISE EXCEPTION 'Reading date must be today or earlier';
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

    SELECT COALESCE(SUM(a.adjustment_units), 0) INTO v_adjustment_units
    FROM public.electricity_balance_adjustments a
    WHERE a.account_id = p_account_id
      AND a.applied_reading_id IS NULL
      AND a.adjustment_date <= p_reading_date;

    v_previous_balance := COALESCE(v_previous_balance, v_account.opening_balance_units);
    v_closing_balance := v_previous_balance + v_topup_units + v_adjustment_units
      - (p_current_reading - v_previous_reading);
  ELSE
    v_previous_balance := NULL;
    v_closing_balance := NULL;
    v_topup_units := 0;
    v_adjustment_units := 0;
  END IF;

  INSERT INTO public.electricity_readings (
    account_id, owner_user_id, previous_meter_reading, current_meter_reading,
    opening_balance_units, topup_units, adjustment_units, closing_balance_units,
    previous_reading_date, reading_date, notes, recorded_by
  ) VALUES (
    v_account.id, v_account.owner_user_id, v_previous_reading, p_current_reading,
    v_previous_balance, v_topup_units, v_adjustment_units, v_closing_balance,
    v_previous_date, p_reading_date, NULLIF(btrim(p_notes), ''), auth.uid()
  ) RETURNING * INTO v_reading;

  IF v_account.meter_kind = 'submeter' THEN
    UPDATE public.electricity_topups
    SET applied_reading_id = v_reading.id
    WHERE account_id = p_account_id
      AND status = 'verified'
      AND applied_reading_id IS NULL
      AND purchase_date <= p_reading_date;

    UPDATE public.electricity_balance_adjustments
    SET applied_reading_id = v_reading.id
    WHERE account_id = p_account_id
      AND applied_reading_id IS NULL
      AND adjustment_date <= p_reading_date;
  END IF;

  RETURN v_reading;
END;
$record_meter_reading$;

REVOKE ALL ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_electricity_topup_to_history(p_topup_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $apply_topup$
DECLARE
  v_topup public.electricity_topups%ROWTYPE;
  v_reading public.electricity_readings%ROWTYPE;
  v_running_balance NUMERIC(14, 3);
BEGIN
  SELECT * INTO v_topup
  FROM public.electricity_topups t
  WHERE t.id = p_topup_id AND t.status = 'verified' AND t.applied_reading_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_reading
  FROM public.electricity_readings r
  WHERE r.account_id = v_topup.account_id
    AND r.reading_date >= v_topup.purchase_date
  ORDER BY r.reading_date, r.created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.electricity_readings r
  SET topup_units = r.topup_units + v_topup.units,
      closing_balance_units = r.opening_balance_units + r.topup_units + v_topup.units
        + r.adjustment_units - r.usage_units
  WHERE r.id = v_reading.id
  RETURNING * INTO v_reading;

  UPDATE public.electricity_topups t
  SET applied_reading_id = v_reading.id
  WHERE t.id = v_topup.id;

  v_running_balance := v_reading.closing_balance_units;
  FOR v_reading IN
    SELECT r.* FROM public.electricity_readings r
    WHERE r.account_id = v_topup.account_id
      AND r.reading_date > v_reading.reading_date
    ORDER BY r.reading_date, r.created_at
    FOR UPDATE
  LOOP
    UPDATE public.electricity_readings r
    SET opening_balance_units = v_running_balance,
        closing_balance_units = v_running_balance + r.topup_units + r.adjustment_units - r.usage_units
    WHERE r.id = v_reading.id
    RETURNING r.closing_balance_units INTO v_running_balance;
  END LOOP;
END;
$apply_topup$;

REVOKE ALL ON FUNCTION public.apply_electricity_topup_to_history(UUID) FROM PUBLIC;

COMMIT;
