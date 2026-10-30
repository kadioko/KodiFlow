BEGIN;

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
  v_rebuild_previous_reading NUMERIC(14, 3);
  v_rebuild_previous_date DATE;
  v_period_previous_reading NUMERIC(14, 3);
  v_next_reading NUMERIC(14, 3);
  v_reading public.electricity_readings%ROWTYPE;
  v_ordered_reading public.electricity_readings%ROWTYPE;
  v_running_balance NUMERIC(14, 3);
  v_topup_units NUMERIC(14, 3);
  v_adjustment_units NUMERIC(14, 3);
  v_closing_balance NUMERIC(14, 3);
  v_first_reading BOOLEAN := TRUE;
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
  IF p_reading_date <= v_account.initial_reading_date THEN
    RAISE EXCEPTION 'Reading date must be later than the meter baseline date (%)', v_account.initial_reading_date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.electricity_readings r
    WHERE r.account_id = p_account_id AND r.reading_date = p_reading_date
  ) THEN
    RAISE EXCEPTION 'A reading session already exists for this meter on %', p_reading_date;
  END IF;

  SELECT r.current_meter_reading, r.closing_balance_units, r.reading_date
  INTO v_previous_reading, v_previous_balance, v_previous_date
  FROM public.electricity_readings r
  WHERE r.account_id = p_account_id AND r.reading_date < p_reading_date
  ORDER BY r.reading_date DESC
  LIMIT 1;

  v_previous_reading := COALESCE(v_previous_reading, v_account.initial_meter_reading);
  v_previous_date := COALESCE(v_previous_date, v_account.initial_reading_date);
  v_previous_balance := COALESCE(v_previous_balance, v_account.opening_balance_units);

  SELECT r.current_meter_reading INTO v_next_reading
  FROM public.electricity_readings r
  WHERE r.account_id = p_account_id AND r.reading_date > p_reading_date
  ORDER BY r.reading_date
  LIMIT 1;

  IF p_current_reading < v_previous_reading THEN
    RAISE EXCEPTION 'Current meter reading cannot be below the previous reading (%)', v_previous_reading;
  END IF;
  IF v_next_reading IS NOT NULL AND p_current_reading > v_next_reading THEN
    RAISE EXCEPTION 'Current meter reading cannot exceed the next saved reading (%)', v_next_reading;
  END IF;

  INSERT INTO public.electricity_readings (
    account_id, owner_user_id, previous_meter_reading, current_meter_reading,
    opening_balance_units, topup_units, adjustment_units, closing_balance_units,
    previous_reading_date, reading_date, notes, recorded_by
  ) VALUES (
    v_account.id, v_account.owner_user_id, v_previous_reading, p_current_reading,
    CASE WHEN v_account.meter_kind = 'submeter' THEN v_previous_balance ELSE NULL END,
    0, 0,
    CASE WHEN v_account.meter_kind = 'submeter'
      THEN v_previous_balance - (p_current_reading - v_previous_reading)
      ELSE NULL
    END,
    v_previous_date, p_reading_date, NULLIF(btrim(p_notes), ''), auth.uid()
  ) RETURNING * INTO v_reading;

  UPDATE public.electricity_topups t
  SET applied_reading_id = (
    SELECT r.id FROM public.electricity_readings r
    WHERE r.account_id = t.account_id AND r.reading_date >= t.purchase_date
    ORDER BY r.reading_date
    LIMIT 1
  )
  WHERE t.account_id = p_account_id AND t.status = 'verified';

  UPDATE public.electricity_balance_adjustments a
  SET applied_reading_id = (
    SELECT r.id FROM public.electricity_readings r
    WHERE r.account_id = a.account_id AND r.reading_date > a.adjustment_date
    ORDER BY r.reading_date
    LIMIT 1
  )
  WHERE a.account_id = p_account_id;

  SELECT r.opening_balance_units INTO v_running_balance
  FROM public.electricity_readings r
  WHERE r.account_id = p_account_id
  ORDER BY r.reading_date
  LIMIT 1;
  v_running_balance := COALESCE(v_running_balance, v_account.opening_balance_units);
  v_rebuild_previous_reading := v_account.initial_meter_reading;
  v_rebuild_previous_date := v_account.initial_reading_date;

  FOR v_ordered_reading IN
    SELECT r.* FROM public.electricity_readings r
    WHERE r.account_id = p_account_id
    ORDER BY r.reading_date
    FOR UPDATE
  LOOP
    IF v_first_reading AND v_ordered_reading.previous_reading_date IS NULL THEN
      v_period_previous_reading := v_ordered_reading.previous_meter_reading;
      v_rebuild_previous_date := NULL;
    ELSE
      v_period_previous_reading := v_rebuild_previous_reading;
      UPDATE public.electricity_readings r
      SET previous_meter_reading = v_rebuild_previous_reading,
          previous_reading_date = v_rebuild_previous_date
      WHERE r.id = v_ordered_reading.id;
    END IF;

    SELECT COALESCE(SUM(t.units), 0) INTO v_topup_units
    FROM public.electricity_topups t
    WHERE t.applied_reading_id = v_ordered_reading.id AND t.status = 'verified';

    SELECT COALESCE(SUM(a.adjustment_units), 0) INTO v_adjustment_units
    FROM public.electricity_balance_adjustments a
    WHERE a.applied_reading_id = v_ordered_reading.id;

    IF v_account.meter_kind = 'submeter' THEN
      IF v_first_reading AND v_ordered_reading.previous_reading_date IS NULL THEN
        v_running_balance := COALESCE(v_ordered_reading.opening_balance_units, v_account.opening_balance_units);
      END IF;
      v_closing_balance := v_running_balance + v_topup_units + v_adjustment_units
        - (v_ordered_reading.current_meter_reading - v_period_previous_reading);

      UPDATE public.electricity_readings r
      SET opening_balance_units = v_running_balance,
          topup_units = v_topup_units,
          adjustment_units = v_adjustment_units,
          closing_balance_units = v_closing_balance
      WHERE r.id = v_ordered_reading.id;
      v_running_balance := v_closing_balance;
    ELSE
      UPDATE public.electricity_readings r
      SET opening_balance_units = NULL,
          topup_units = 0,
          adjustment_units = 0,
          closing_balance_units = NULL
      WHERE r.id = v_ordered_reading.id;
    END IF;

    v_first_reading := FALSE;
    v_rebuild_previous_reading := v_ordered_reading.current_meter_reading;
    v_rebuild_previous_date := v_ordered_reading.reading_date;
  END LOOP;

  SELECT * INTO v_reading FROM public.electricity_readings WHERE id = v_reading.id;
  RETURN v_reading;
END;
$record_meter_reading$;

REVOKE ALL ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) TO authenticated;

COMMIT;
