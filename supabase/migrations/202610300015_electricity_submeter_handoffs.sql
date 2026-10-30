BEGIN;

ALTER TABLE public.electricity_accounts
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE public.electricity_accounts
  DROP CONSTRAINT IF EXISTS electricity_accounts_display_name_check;

ALTER TABLE public.electricity_accounts
  ADD CONSTRAINT electricity_accounts_display_name_check
  CHECK (
    display_name IS NULL
    OR (btrim(display_name) <> '' AND length(display_name) <= 100)
  );

CREATE OR REPLACE FUNCTION public.replace_electricity_submeter(
  p_account_id UUID,
  p_tenant_id UUID,
  p_current_meter_reading NUMERIC,
  p_reading_date DATE,
  p_opening_balance_units NUMERIC,
  p_display_name TEXT DEFAULT NULL
)
RETURNS public.electricity_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $replace_electricity_submeter$
DECLARE
  v_old public.electricity_accounts%ROWTYPE;
  v_new public.electricity_accounts%ROWTYPE;
  v_last_reading NUMERIC;
  v_last_reading_date DATE;
  v_display_name TEXT := NULLIF(btrim(p_display_name), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT a.* INTO v_old
  FROM public.electricity_accounts a
  WHERE a.id = p_account_id
    AND a.owner_user_id = auth.uid()
    AND a.meter_kind = 'submeter'
    AND a.active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active client submeter not found or access denied';
  END IF;
  IF p_tenant_id IS NULL OR p_tenant_id = v_old.tenant_id THEN
    RAISE EXCEPTION 'Choose a different tenant for a submeter handoff';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'The selected tenant does not belong to this owner';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.units u
    WHERE u.id = v_old.unit_id
      AND u.property_id = v_old.property_id
      AND u.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'The submeter unit is no longer available';
  END IF;
  IF p_current_meter_reading IS NULL OR p_current_meter_reading < 0 OR p_current_meter_reading > 1000000000 THEN
    RAISE EXCEPTION 'Enter a current submeter reading between 0 and 1,000,000,000 kWh';
  END IF;
  IF p_opening_balance_units IS NULL OR abs(p_opening_balance_units) > 1000000 THEN
    RAISE EXCEPTION 'Opening units must be between -1,000,000 and 1,000,000 kWh';
  END IF;
  IF p_reading_date IS NULL OR p_reading_date > (now() AT TIME ZONE 'Africa/Nairobi')::DATE THEN
    RAISE EXCEPTION 'The handoff reading date must be today or earlier';
  END IF;
  IF length(v_display_name) > 100 THEN
    RAISE EXCEPTION 'Submeter display name must be 100 characters or less';
  END IF;

  SELECT r.current_meter_reading, r.reading_date
  INTO v_last_reading, v_last_reading_date
  FROM public.electricity_readings r
  WHERE r.account_id = v_old.id
  ORDER BY r.reading_date DESC, r.created_at DESC
  LIMIT 1;

  v_last_reading := COALESCE(v_last_reading, v_old.initial_meter_reading);
  v_last_reading_date := COALESCE(v_last_reading_date, v_old.initial_reading_date);

  IF p_current_meter_reading < v_last_reading THEN
    RAISE EXCEPTION 'The handoff reading cannot be below the last recorded reading of % kWh', v_last_reading;
  END IF;
  IF p_reading_date < v_last_reading_date THEN
    RAISE EXCEPTION 'The handoff date cannot be earlier than the last recorded reading';
  END IF;
  IF p_reading_date = v_last_reading_date AND p_current_meter_reading <> v_last_reading THEN
    RAISE EXCEPTION 'A different reading on the last recorded date cannot be used for handoff';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.electricity_accounts a
    WHERE a.unit_id = v_old.unit_id
      AND a.meter_kind = 'submeter'
      AND a.active
      AND a.id <> v_old.id
  ) THEN
    RAISE EXCEPTION 'Another active submeter already uses this unit';
  END IF;

  IF p_reading_date > v_last_reading_date THEN
    PERFORM public.record_electricity_meter_reading(
      v_old.id,
      p_current_meter_reading,
      p_reading_date,
      'Final reading at tenant handoff'
    );
  END IF;

  UPDATE public.electricity_accounts
  SET active = FALSE, updated_at = now()
  WHERE id = v_old.id;

  INSERT INTO public.electricity_accounts (
    owner_user_id, property_id, meter_kind, unit_id, tenant_id,
    floor_label, ledger_tenant_label, display_name, meter_number,
    initial_meter_reading, initial_reading_date, opening_balance_units,
    low_units_threshold, active, created_by
  ) VALUES (
    v_old.owner_user_id, v_old.property_id, 'submeter', v_old.unit_id, p_tenant_id,
    v_old.floor_label, NULL, v_display_name, v_old.meter_number,
    p_current_meter_reading, p_reading_date, p_opening_balance_units,
    v_old.low_units_threshold, TRUE, auth.uid()
  ) RETURNING * INTO v_new;

  RETURN v_new;
END;
$replace_electricity_submeter$;

REVOKE ALL ON FUNCTION public.replace_electricity_submeter(UUID, UUID, NUMERIC, DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_electricity_submeter(UUID, UUID, NUMERIC, DATE, NUMERIC, TEXT) TO authenticated;

COMMIT;
