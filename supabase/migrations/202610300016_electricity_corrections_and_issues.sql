BEGIN;

ALTER TABLE public.electricity_topups
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

ALTER TABLE public.electricity_readings
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

ALTER TABLE public.electricity_main_meter_balances
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

ALTER TABLE public.electricity_balance_adjustments
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

ALTER TABLE public.electricity_cutoff_events
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

ALTER TABLE public.electricity_readings
  DROP CONSTRAINT IF EXISTS electricity_readings_account_id_reading_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS electricity_readings_active_account_date_key
  ON public.electricity_readings(account_id, reading_date)
  WHERE reversed_at IS NULL;

ALTER TABLE public.electricity_main_meter_balances
  DROP CONSTRAINT IF EXISTS electricity_main_meter_balances_account_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS electricity_main_balance_active_account_date_key
  ON public.electricity_main_meter_balances(account_id, reading_date)
  WHERE reversed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.electricity_entry_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.electricity_accounts(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('reading', 'topup', 'main_balance', 'adjustment', 'cutoff')),
  entry_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('confirmed', 'edited', 'reversed')),
  reason TEXT,
  previous_values JSONB NOT NULL DEFAULT '{}'::JSONB,
  new_values JSONB NOT NULL DEFAULT '{}'::JSONB,
  acted_by UUID NOT NULL REFERENCES auth.users(id),
  acted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS electricity_entry_audit_account_time_idx
  ON public.electricity_entry_audit(account_id, acted_at DESC);

ALTER TABLE public.electricity_entry_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accessible electricity entry audit is readable" ON public.electricity_entry_audit;
CREATE POLICY "Accessible electricity entry audit is readable"
  ON public.electricity_entry_audit FOR SELECT
  USING (
    owner_user_id = (SELECT a.owner_user_id FROM public.electricity_accounts a WHERE a.id = account_id)
    AND EXISTS (
      SELECT 1 FROM public.electricity_accounts a
      WHERE a.id = electricity_entry_audit.account_id
        AND public.can_access_electricity_property(a.property_id)
    )
  );
GRANT SELECT ON public.electricity_entry_audit TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.electricity_entry_audit FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.audit_electricity_topup_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $audit_topup_confirmation$
BEGIN
  IF OLD.status = 'reported' AND NEW.status = 'verified' THEN
    INSERT INTO public.electricity_entry_audit (
      owner_user_id, account_id, entry_type, entry_id, action, reason,
      previous_values, new_values, acted_by, acted_at
    ) VALUES (
      NEW.owner_user_id, NEW.account_id, 'topup', NEW.id, 'confirmed',
      'Confirmed against the client submeter', to_jsonb(OLD) - 'token_code', to_jsonb(NEW) - 'token_code',
      NEW.verified_by, COALESCE(NEW.verified_at, now())
    );
  END IF;
  RETURN NEW;
END;
$audit_topup_confirmation$;

DROP TRIGGER IF EXISTS electricity_topup_confirmation_audit ON public.electricity_topups;
CREATE TRIGGER electricity_topup_confirmation_audit
  AFTER UPDATE OF status ON public.electricity_topups
  FOR EACH ROW EXECUTE FUNCTION public.audit_electricity_topup_confirmation();
REVOKE ALL ON FUNCTION public.audit_electricity_topup_confirmation() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.recalculate_electricity_submeter_history(p_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $recalculate_electricity_submeter_history$
DECLARE
  v_account public.electricity_accounts%ROWTYPE;
  v_reading public.electricity_readings%ROWTYPE;
  v_previous_reading NUMERIC(14, 3);
  v_previous_date DATE;
  v_previous_balance NUMERIC(14, 3);
  v_topup_units NUMERIC(14, 3);
  v_adjustment_units NUMERIC(14, 3);
  v_first_reading BOOLEAN := TRUE;
BEGIN
  SELECT * INTO v_account
  FROM public.electricity_accounts
  WHERE id = p_account_id AND meter_kind = 'submeter'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.electricity_topups
  SET applied_reading_id = NULL
  WHERE account_id = p_account_id;
  UPDATE public.electricity_balance_adjustments
  SET applied_reading_id = NULL
  WHERE account_id = p_account_id;

  v_previous_reading := v_account.initial_meter_reading;
  v_previous_date := v_account.initial_reading_date;
  v_previous_balance := v_account.opening_balance_units;

  FOR v_reading IN
    SELECT * FROM public.electricity_readings
    WHERE account_id = p_account_id AND reversed_at IS NULL
    ORDER BY reading_date, created_at, id
    FOR UPDATE
  LOOP
    IF v_first_reading AND v_reading.previous_reading_date IS NULL
      AND v_reading.reading_date <= v_account.initial_reading_date THEN
      v_previous_reading := v_reading.previous_meter_reading;
      v_previous_date := NULL;
      v_previous_balance := v_reading.opening_balance_units;
    END IF;
    IF v_reading.current_meter_reading < v_previous_reading THEN
      RAISE EXCEPTION 'Correction would put a reading below the previous active meter reading';
    END IF;

    SELECT COALESCE(SUM(t.units), 0) INTO v_topup_units
    FROM public.electricity_topups t
    WHERE t.account_id = p_account_id
      AND t.status = 'verified'
      AND t.reversed_at IS NULL
      AND t.applied_reading_id IS NULL
      AND t.purchase_date <= v_reading.reading_date;

    SELECT COALESCE(SUM(a.adjustment_units), 0) INTO v_adjustment_units
    FROM public.electricity_balance_adjustments a
    WHERE a.account_id = p_account_id
      AND a.reversed_at IS NULL
      AND a.applied_reading_id IS NULL
      AND a.adjustment_date < v_reading.reading_date;

    UPDATE public.electricity_readings
    SET previous_meter_reading = v_previous_reading,
        previous_reading_date = v_previous_date,
        opening_balance_units = v_previous_balance,
        topup_units = v_topup_units,
        adjustment_units = v_adjustment_units,
        closing_balance_units = v_previous_balance + v_topup_units + v_adjustment_units
          - (v_reading.current_meter_reading - v_previous_reading)
    WHERE id = v_reading.id
    RETURNING * INTO v_reading;

    UPDATE public.electricity_topups
    SET applied_reading_id = v_reading.id
    WHERE account_id = p_account_id AND status = 'verified'
      AND reversed_at IS NULL AND applied_reading_id IS NULL
      AND purchase_date <= v_reading.reading_date;
    UPDATE public.electricity_balance_adjustments
    SET applied_reading_id = v_reading.id
    WHERE account_id = p_account_id AND reversed_at IS NULL
      AND applied_reading_id IS NULL AND adjustment_date < v_reading.reading_date;

    v_previous_reading := v_reading.current_meter_reading;
    v_previous_date := v_reading.reading_date;
    v_previous_balance := v_reading.closing_balance_units;
    v_first_reading := FALSE;
  END LOOP;
END;
$recalculate_electricity_submeter_history$;
REVOKE ALL ON FUNCTION public.recalculate_electricity_submeter_history(UUID) FROM PUBLIC;

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
  v_next_reading NUMERIC(14, 3);
  v_reading public.electricity_readings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_current_reading IS NULL OR p_current_reading < 0 THEN RAISE EXCEPTION 'Enter a valid non-negative meter reading'; END IF;
  IF p_reading_date IS NULL OR p_reading_date > (now() AT TIME ZONE 'Africa/Nairobi')::DATE THEN
    RAISE EXCEPTION 'Reading date must be today or earlier';
  END IF;

  SELECT * INTO v_account
  FROM public.electricity_accounts a
  WHERE a.id = p_account_id AND a.active
    AND public.can_access_electricity_property(a.property_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Electricity meter not found or access denied'; END IF;

  IF p_reading_date <= v_account.initial_reading_date THEN
    RAISE EXCEPTION 'Reading date must be later than the meter baseline date (%)', v_account.initial_reading_date;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.electricity_readings r
    WHERE r.account_id = p_account_id AND r.reading_date = p_reading_date AND r.reversed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A reading session already exists for this meter on %', p_reading_date;
  END IF;

  SELECT r.current_meter_reading, r.closing_balance_units, r.reading_date
  INTO v_previous_reading, v_previous_balance, v_previous_date
  FROM public.electricity_readings r
  WHERE r.account_id = p_account_id AND r.reading_date < p_reading_date AND r.reversed_at IS NULL
  ORDER BY r.reading_date DESC, r.created_at DESC
  LIMIT 1;

  v_previous_reading := COALESCE(v_previous_reading, v_account.initial_meter_reading);
  v_previous_balance := COALESCE(v_previous_balance, v_account.opening_balance_units);
  v_previous_date := COALESCE(v_previous_date, v_account.initial_reading_date);
  IF p_current_reading < v_previous_reading THEN
    RAISE EXCEPTION 'Current meter reading cannot be below the previous reading (%).', v_previous_reading;
  END IF;

  SELECT r.current_meter_reading INTO v_next_reading
  FROM public.electricity_readings r
  WHERE r.account_id = p_account_id AND r.reading_date > p_reading_date AND r.reversed_at IS NULL
  ORDER BY r.reading_date, r.created_at
  LIMIT 1;
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
      THEN v_previous_balance - (p_current_reading - v_previous_reading) ELSE NULL END,
    v_previous_date, p_reading_date, NULLIF(btrim(p_notes), ''), auth.uid()
  ) RETURNING * INTO v_reading;

  IF v_account.meter_kind = 'submeter' THEN
    PERFORM public.recalculate_electricity_submeter_history(p_account_id);
    SELECT * INTO v_reading FROM public.electricity_readings WHERE id = v_reading.id;
  END IF;
  RETURN v_reading;
END;
$record_meter_reading$;

REVOKE ALL ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) TO authenticated;

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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_units_remaining IS NULL OR p_units_remaining < 0 OR p_units_remaining > 1000000 THEN
    RAISE EXCEPTION 'Enter a valid main-meter balance between 0 and 1,000,000 kWh';
  END IF;
  IF p_units_purchased_since_previous IS NULL OR p_units_purchased_since_previous < 0 OR p_units_purchased_since_previous > 1000000 THEN
    RAISE EXCEPTION 'Units added since the previous check must be between 0 and 1,000,000 kWh';
  END IF;
  IF p_units_remaining = 0 AND NOT COALESCE(p_zero_confirmed, FALSE) THEN
    RAISE EXCEPTION 'Confirm that the main LUKU balance is truly zero before recording an outage';
  END IF;
  IF p_reading_date IS NULL OR p_reading_date > (now() AT TIME ZONE 'Africa/Nairobi')::DATE THEN
    RAISE EXCEPTION 'Main-meter balance date must be today or earlier';
  END IF;
  IF length(v_notes) > 500 THEN RAISE EXCEPTION 'Notes must be 500 characters or less'; END IF;

  SELECT * INTO v_account FROM public.electricity_accounts a
  WHERE a.id = p_account_id AND a.active AND a.meter_kind = 'floor_main'
    AND public.can_access_electricity_property(a.property_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active main meter not found or access denied'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.electricity_main_meter_balances b
    WHERE b.account_id = v_account.id AND b.reversed_at IS NULL
      AND b.reading_date > p_reading_date
  ) THEN
    RAISE EXCEPTION 'Main-meter balance snapshots must be entered oldest to newest';
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

CREATE OR REPLACE FUNCTION public.verify_electricity_topup(p_topup_id UUID)
RETURNS public.electricity_topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $verify_electricity_topup$
DECLARE
  v_account public.electricity_accounts%ROWTYPE;
  v_topup public.electricity_topups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  SELECT a.* INTO v_account
  FROM public.electricity_topups t
  JOIN public.electricity_accounts a ON a.id = t.account_id
  WHERE t.id = p_topup_id AND t.status = 'reported' AND t.reversed_at IS NULL
    AND a.active AND a.meter_kind = 'submeter'
    AND public.can_access_electricity_property(a.property_id)
  FOR UPDATE OF t, a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an active, unverified top-up can be confirmed'; END IF;

  UPDATE public.electricity_topups
  SET status = 'verified', verified_at = now(), verified_by = auth.uid()
  WHERE id = p_topup_id AND status = 'reported' AND reversed_at IS NULL
  RETURNING * INTO v_topup;
  IF NOT FOUND THEN RAISE EXCEPTION 'This top-up was already confirmed'; END IF;

  PERFORM public.recalculate_electricity_submeter_history(v_topup.account_id);
  SELECT * INTO v_topup FROM public.electricity_topups WHERE id = p_topup_id;
  RETURN v_topup;
END;
$verify_electricity_topup$;

REVOKE ALL ON FUNCTION public.verify_electricity_topup(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_electricity_topup(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.manage_electricity_entry(
  p_entry_type TEXT,
  p_entry_id UUID,
  p_action TEXT,
  p_changes JSONB DEFAULT '{}'::JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $manage_electricity_entry$
DECLARE
  v_account_id UUID;
  v_property_id UUID;
  v_owner_user_id UUID;
  v_is_owner BOOLEAN;
  v_before JSONB;
  v_after JSONB;
  v_reason TEXT := NULLIF(btrim(p_reason), '');
  v_token TEXT;
  v_requires_reconfirmation BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_entry_type NOT IN ('reading', 'topup', 'main_balance', 'adjustment', 'cutoff') THEN
    RAISE EXCEPTION 'Unsupported electricity entry type';
  END IF;
  IF p_action NOT IN ('edit', 'reverse') THEN RAISE EXCEPTION 'Unsupported entry action'; END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'Enter a reason between 3 and 500 characters';
  END IF;

  CASE p_entry_type
    WHEN 'reading' THEN
      SELECT account_id, to_jsonb(r) INTO v_account_id, v_before
      FROM public.electricity_readings r WHERE id = p_entry_id FOR UPDATE;
    WHEN 'topup' THEN
      SELECT account_id, to_jsonb(t) INTO v_account_id, v_before
      FROM public.electricity_topups t WHERE id = p_entry_id FOR UPDATE;
    WHEN 'main_balance' THEN
      SELECT account_id, to_jsonb(b) INTO v_account_id, v_before
      FROM public.electricity_main_meter_balances b WHERE id = p_entry_id FOR UPDATE;
    WHEN 'adjustment' THEN
      SELECT account_id, to_jsonb(a) INTO v_account_id, v_before
      FROM public.electricity_balance_adjustments a WHERE id = p_entry_id FOR UPDATE;
    WHEN 'cutoff' THEN
      SELECT account_id, to_jsonb(c) INTO v_account_id, v_before
      FROM public.electricity_cutoff_events c WHERE id = p_entry_id FOR UPDATE;
  END CASE;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'Electricity entry not found'; END IF;

  SELECT a.property_id, a.owner_user_id INTO v_property_id, v_owner_user_id
  FROM public.electricity_accounts a
  WHERE a.id = v_account_id
    AND public.can_access_electricity_property(a.property_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meter not found or access denied'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = v_property_id AND p.user_id = auth.uid()
  ) INTO v_is_owner;
  IF p_action = 'reverse' AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Only the property owner can reverse an electricity entry';
  END IF;
  IF COALESCE((v_before->>'reversed_at') IS NOT NULL, FALSE) THEN
    RAISE EXCEPTION 'This entry has already been reversed';
  END IF;

  IF p_action = 'reverse' THEN
    CASE p_entry_type
      WHEN 'reading' THEN
        UPDATE public.electricity_readings SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = v_reason WHERE id = p_entry_id;
      WHEN 'topup' THEN
        UPDATE public.electricity_topups SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = v_reason WHERE id = p_entry_id;
      WHEN 'main_balance' THEN
        UPDATE public.electricity_main_meter_balances SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = v_reason WHERE id = p_entry_id;
      WHEN 'adjustment' THEN
        UPDATE public.electricity_balance_adjustments SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = v_reason WHERE id = p_entry_id;
      WHEN 'cutoff' THEN
        UPDATE public.electricity_cutoff_events SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = v_reason WHERE id = p_entry_id;
    END CASE;
  ELSE
    CASE p_entry_type
      WHEN 'reading' THEN
        UPDATE public.electricity_readings r
        SET current_meter_reading = CASE WHEN p_changes ? 'current_meter_reading' THEN (p_changes->>'current_meter_reading')::NUMERIC ELSE r.current_meter_reading END,
            reading_date = CASE WHEN p_changes ? 'reading_date' THEN (p_changes->>'reading_date')::DATE ELSE r.reading_date END,
            notes = CASE WHEN p_changes ? 'notes' THEN NULLIF(btrim(p_changes->>'notes'), '') ELSE r.notes END
        WHERE id = p_entry_id;
      WHEN 'topup' THEN
        v_token := regexp_replace(COALESCE(p_changes->>'token_code', ''), '[[:space:]]', '', 'g');
        IF p_changes ? 'token_code' AND v_token = '' AND NULLIF(v_before->>'token_code', '') IS NOT NULL THEN
          RAISE EXCEPTION 'The saved full LUKU token cannot be cleared; retain it or correct it to the verified 20-digit token';
        END IF;
        IF p_changes ? 'token_code' AND v_token <> '' AND v_token !~ '^[0-9]{20}$' THEN
          RAISE EXCEPTION 'LUKU token must contain exactly 20 digits';
        END IF;
        v_requires_reconfirmation := v_before->>'status' = 'verified' AND (
          (p_changes ? 'units' AND (p_changes->>'units')::NUMERIC IS DISTINCT FROM (v_before->>'units')::NUMERIC)
          OR (p_changes ? 'purchase_date' AND (p_changes->>'purchase_date')::DATE IS DISTINCT FROM (v_before->>'purchase_date')::DATE)
          OR (p_changes ? 'token_code' AND NULLIF(v_token, '') IS DISTINCT FROM NULLIF(v_before->>'token_code', ''))
        );
        UPDATE public.electricity_topups t
        SET purchase_date = CASE WHEN p_changes ? 'purchase_date' THEN (p_changes->>'purchase_date')::DATE ELSE t.purchase_date END,
            units = CASE WHEN p_changes ? 'units' THEN (p_changes->>'units')::NUMERIC ELSE t.units END,
            purchase_amount_tzs = CASE WHEN p_changes ? 'purchase_amount_tzs' THEN NULLIF(p_changes->>'purchase_amount_tzs', '')::NUMERIC ELSE t.purchase_amount_tzs END,
            token_code = CASE WHEN p_changes ? 'token_code' AND v_token <> '' THEN v_token WHEN p_changes ? 'token_code' THEN NULL ELSE t.token_code END,
            token_suffix = CASE WHEN p_changes ? 'token_code' AND v_token <> '' THEN right(v_token, 4) WHEN p_changes ? 'token_code' THEN NULL ELSE t.token_suffix END,
            status = CASE WHEN v_requires_reconfirmation THEN 'reported' ELSE t.status END,
            verified_at = CASE WHEN v_requires_reconfirmation THEN NULL ELSE t.verified_at END,
            verified_by = CASE WHEN v_requires_reconfirmation THEN NULL ELSE t.verified_by END,
            notes = CASE WHEN p_changes ? 'notes' THEN NULLIF(btrim(p_changes->>'notes'), '') ELSE t.notes END
        WHERE id = p_entry_id;
      WHEN 'main_balance' THEN
        UPDATE public.electricity_main_meter_balances b
        SET reading_date = CASE WHEN p_changes ? 'reading_date' THEN (p_changes->>'reading_date')::DATE ELSE b.reading_date END,
            units_remaining = CASE WHEN p_changes ? 'units_remaining' THEN (p_changes->>'units_remaining')::NUMERIC ELSE b.units_remaining END,
            units_purchased_since_previous = CASE WHEN p_changes ? 'units_purchased_since_previous' THEN NULLIF(p_changes->>'units_purchased_since_previous', '')::NUMERIC ELSE b.units_purchased_since_previous END,
            notes = CASE WHEN p_changes ? 'notes' THEN NULLIF(btrim(p_changes->>'notes'), '') ELSE b.notes END
        WHERE id = p_entry_id;
      WHEN 'adjustment' THEN
        UPDATE public.electricity_balance_adjustments a
        SET adjustment_date = CASE WHEN p_changes ? 'adjustment_date' THEN (p_changes->>'adjustment_date')::DATE ELSE a.adjustment_date END,
            adjustment_units = CASE WHEN p_changes ? 'adjustment_units' THEN (p_changes->>'adjustment_units')::NUMERIC ELSE a.adjustment_units END,
            reason = CASE WHEN p_changes ? 'entry_reason' THEN NULLIF(btrim(p_changes->>'entry_reason'), '') ELSE a.reason END
        WHERE id = p_entry_id;
      WHEN 'cutoff' THEN
        UPDATE public.electricity_cutoff_events c
        SET action = CASE WHEN p_changes ? 'action' THEN p_changes->>'action' ELSE c.action END,
            meter_reading = CASE WHEN p_changes ? 'meter_reading' THEN NULLIF(p_changes->>'meter_reading', '')::NUMERIC ELSE c.meter_reading END,
            reason = CASE WHEN p_changes ? 'entry_reason' THEN NULLIF(btrim(p_changes->>'entry_reason'), '') ELSE c.reason END
        WHERE id = p_entry_id;
    END CASE;
  END IF;

  IF p_entry_type IN ('reading', 'topup', 'adjustment') THEN
    PERFORM public.recalculate_electricity_submeter_history(v_account_id);
  END IF;

  CASE p_entry_type
    WHEN 'reading' THEN SELECT to_jsonb(r) INTO v_after FROM public.electricity_readings r WHERE id = p_entry_id;
    WHEN 'topup' THEN SELECT to_jsonb(t) INTO v_after FROM public.electricity_topups t WHERE id = p_entry_id;
    WHEN 'main_balance' THEN SELECT to_jsonb(b) INTO v_after FROM public.electricity_main_meter_balances b WHERE id = p_entry_id;
    WHEN 'adjustment' THEN SELECT to_jsonb(a) INTO v_after FROM public.electricity_balance_adjustments a WHERE id = p_entry_id;
    WHEN 'cutoff' THEN SELECT to_jsonb(c) INTO v_after FROM public.electricity_cutoff_events c WHERE id = p_entry_id;
  END CASE;

  IF p_entry_type = 'topup' THEN
    v_before := v_before - 'token_code';
    v_after := v_after - 'token_code';
  END IF;

  INSERT INTO public.electricity_entry_audit (
    owner_user_id, account_id, entry_type, entry_id, action, reason,
    previous_values, new_values, acted_by
  ) VALUES (
    v_owner_user_id, v_account_id, p_entry_type, p_entry_id,
    CASE WHEN p_action = 'reverse' THEN 'reversed' ELSE 'edited' END,
    v_reason, v_before, v_after, auth.uid()
  );

  RETURN jsonb_build_object('entry_type', p_entry_type, 'entry_id', p_entry_id, 'entry', v_after);
END;
$manage_electricity_entry$;

REVOKE ALL ON FUNCTION public.manage_electricity_entry(TEXT, UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_electricity_entry(TEXT, UUID, TEXT, JSONB, TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.electricity_issue_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.electricity_accounts(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 3 AND 3000),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_staff', 'resolved', 'closed')),
  resolution TEXT,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT electricity_issue_account_property_fkey
    FOREIGN KEY (account_id, owner_user_id)
    REFERENCES public.electricity_accounts(id, owner_user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS electricity_issue_tickets_property_status_time_idx
  ON public.electricity_issue_tickets(property_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS electricity_issue_tickets_account_time_idx
  ON public.electricity_issue_tickets(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.electricity_issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.electricity_issue_tickets(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS electricity_issue_comments_ticket_time_idx
  ON public.electricity_issue_comments(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.electricity_issue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.electricity_issue_tickets(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opened', 'status_changed', 'resolved', 'reopened')),
  previous_status TEXT,
  new_status TEXT,
  details TEXT,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS electricity_issue_events_ticket_time_idx
  ON public.electricity_issue_events(ticket_id, performed_at);

ALTER TABLE public.electricity_issue_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_issue_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Accessible electricity issues are readable" ON public.electricity_issue_tickets;
CREATE POLICY "Accessible electricity issues are readable"
  ON public.electricity_issue_tickets FOR SELECT
  USING (public.can_access_electricity_property(property_id));
DROP POLICY IF EXISTS "Accessible users can open electricity issues" ON public.electricity_issue_tickets;
CREATE POLICY "Accessible users can open electricity issues"
  ON public.electricity_issue_tickets FOR INSERT
  WITH CHECK (
    opened_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.electricity_accounts a
      WHERE a.id = electricity_issue_tickets.account_id
        AND a.property_id = electricity_issue_tickets.property_id
        AND a.owner_user_id = electricity_issue_tickets.owner_user_id
        AND public.can_access_electricity_property(a.property_id)
    )
  );
DROP POLICY IF EXISTS "Only owners update electricity issues" ON public.electricity_issue_tickets;
CREATE POLICY "Only owners update electricity issues"
  ON public.electricity_issue_tickets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Accessible users can read issue comments" ON public.electricity_issue_comments;
CREATE POLICY "Accessible users can read issue comments"
  ON public.electricity_issue_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.electricity_issue_tickets i
    WHERE i.id = electricity_issue_comments.ticket_id
      AND public.can_access_electricity_property(i.property_id)
  ));
DROP POLICY IF EXISTS "Accessible users can comment on electricity issues" ON public.electricity_issue_comments;
CREATE POLICY "Accessible users can comment on electricity issues"
  ON public.electricity_issue_comments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.electricity_issue_tickets i
      WHERE i.id = electricity_issue_comments.ticket_id
        AND i.owner_user_id = electricity_issue_comments.owner_user_id
        AND public.can_access_electricity_property(i.property_id)
    )
  );

DROP POLICY IF EXISTS "Accessible users can read issue events" ON public.electricity_issue_events;
CREATE POLICY "Accessible users can read issue events"
  ON public.electricity_issue_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.electricity_issue_tickets i
    WHERE i.id = electricity_issue_events.ticket_id
      AND public.can_access_electricity_property(i.property_id)
  ));

GRANT SELECT, INSERT, UPDATE ON public.electricity_issue_tickets TO authenticated;
GRANT SELECT, INSERT ON public.electricity_issue_comments TO authenticated;
GRANT SELECT ON public.electricity_issue_events TO authenticated;
REVOKE DELETE ON public.electricity_issue_tickets, public.electricity_issue_comments, public.electricity_issue_events FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.electricity_issue_events FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.prepare_electricity_issue_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $prepare_electricity_issue$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'resolved' THEN
    IF length(btrim(COALESCE(NEW.resolution, ''))) < 3 THEN
      RAISE EXCEPTION 'Enter at least 3 characters describing the resolution';
    END IF;
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
    NEW.resolved_by := COALESCE(NEW.resolved_by, auth.uid());
  ELSIF OLD.status IN ('resolved', 'closed') AND NEW.status IN ('open', 'in_progress', 'waiting_on_staff') THEN
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
    NEW.resolution := NULL;
  END IF;
  IF NEW.status = 'closed' AND OLD.status NOT IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'Resolve the issue before closing it';
  END IF;
  RETURN NEW;
END;
$prepare_electricity_issue$;

CREATE OR REPLACE FUNCTION public.track_electricity_issue_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $track_electricity_issue$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.electricity_issue_events (
      ticket_id, owner_user_id, action, new_status, details, performed_by
    ) VALUES (NEW.id, NEW.owner_user_id, 'opened', NEW.status, NEW.description, NEW.opened_by);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.resolution IS DISTINCT FROM OLD.resolution THEN
    INSERT INTO public.electricity_issue_events (
      ticket_id, owner_user_id, action, previous_status, new_status, details, performed_by
    ) VALUES (
      NEW.id, NEW.owner_user_id,
      CASE WHEN OLD.status IN ('resolved', 'closed') AND NEW.status NOT IN ('resolved', 'closed') THEN 'reopened'
           WHEN NEW.status = 'resolved' THEN 'resolved'
           ELSE 'status_changed' END,
      OLD.status, NEW.status,
      COALESCE(NULLIF(btrim(NEW.resolution), ''), NULLIF(btrim(OLD.resolution), '')),
      NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$track_electricity_issue$;

DROP TRIGGER IF EXISTS electricity_issue_prepare_update ON public.electricity_issue_tickets;
CREATE TRIGGER electricity_issue_prepare_update
  BEFORE UPDATE ON public.electricity_issue_tickets
  FOR EACH ROW EXECUTE FUNCTION public.prepare_electricity_issue_update();

DROP TRIGGER IF EXISTS electricity_issue_lifecycle_track ON public.electricity_issue_tickets;
CREATE TRIGGER electricity_issue_lifecycle_track
  AFTER INSERT OR UPDATE ON public.electricity_issue_tickets
  FOR EACH ROW EXECUTE FUNCTION public.track_electricity_issue_lifecycle();
REVOKE ALL ON FUNCTION public.track_electricity_issue_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_electricity_issue_update() FROM PUBLIC;

COMMIT;
