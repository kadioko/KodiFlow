BEGIN;

CREATE TABLE IF NOT EXISTS public.electricity_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL,
  login_email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT electricity_staff_id_format CHECK (staff_id ~ '^[A-Za-z0-9._-]{3,24}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS electricity_staff_id_lower_unique
  ON public.electricity_staff (lower(staff_id));

CREATE TABLE IF NOT EXISTS public.electricity_staff_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.electricity_staff(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, property_id)
);

CREATE INDEX IF NOT EXISTS electricity_staff_properties_property_idx
  ON public.electricity_staff_properties(property_id, staff_id);

CREATE TABLE IF NOT EXISTS public.electricity_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  meter_kind TEXT NOT NULL CHECK (meter_kind IN ('submeter', 'floor_main')),
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  floor_label TEXT NOT NULL,
  meter_number TEXT,
  initial_meter_reading NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (initial_meter_reading >= 0),
  opening_balance_units NUMERIC(14, 3) NOT NULL DEFAULT 0,
  low_units_threshold NUMERIC(10, 3) NOT NULL DEFAULT 10 CHECK (low_units_threshold >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT electricity_account_scope CHECK (
    (meter_kind = 'submeter' AND unit_id IS NOT NULL AND tenant_id IS NOT NULL)
    OR (meter_kind = 'floor_main' AND unit_id IS NULL AND tenant_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS electricity_active_submeter_unit_unique
  ON public.electricity_accounts(unit_id)
  WHERE meter_kind = 'submeter' AND active;

CREATE UNIQUE INDEX IF NOT EXISTS electricity_active_floor_main_unique
  ON public.electricity_accounts(property_id, lower(floor_label))
  WHERE meter_kind = 'floor_main' AND active;

CREATE INDEX IF NOT EXISTS electricity_accounts_owner_property_idx
  ON public.electricity_accounts(owner_user_id, property_id, active);

CREATE TABLE IF NOT EXISTS public.electricity_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.electricity_accounts(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  units NUMERIC(14, 3) NOT NULL CHECK (units > 0),
  token_suffix TEXT CHECK (token_suffix IS NULL OR token_suffix ~ '^[A-Za-z0-9-]{2,8}$'),
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'verified')),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  applied_reading_id UUID,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT electricity_topup_verification_consistency CHECK (
    (status = 'reported' AND verified_at IS NULL AND verified_by IS NULL)
    OR (status = 'verified' AND verified_at IS NOT NULL AND verified_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS electricity_topups_account_date_idx
  ON public.electricity_topups(account_id, purchase_date, created_at);

CREATE TABLE IF NOT EXISTS public.electricity_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.electricity_accounts(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_meter_reading NUMERIC(14, 3) NOT NULL CHECK (previous_meter_reading >= 0),
  current_meter_reading NUMERIC(14, 3) NOT NULL CHECK (current_meter_reading >= previous_meter_reading),
  usage_units NUMERIC(14, 3) GENERATED ALWAYS AS (current_meter_reading - previous_meter_reading) STORED,
  opening_balance_units NUMERIC(14, 3),
  topup_units NUMERIC(14, 3) NOT NULL DEFAULT 0,
  closing_balance_units NUMERIC(14, 3),
  reading_date DATE NOT NULL,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, reading_date),
  CHECK (
    (opening_balance_units IS NULL AND closing_balance_units IS NULL AND topup_units = 0)
    OR (opening_balance_units IS NOT NULL AND closing_balance_units IS NOT NULL)
  )
);

ALTER TABLE public.electricity_topups
  DROP CONSTRAINT IF EXISTS electricity_topups_applied_reading_id_fkey;
ALTER TABLE public.electricity_topups
  ADD CONSTRAINT electricity_topups_applied_reading_id_fkey
  FOREIGN KEY (applied_reading_id) REFERENCES public.electricity_readings(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS electricity_readings_account_date_idx
  ON public.electricity_readings(account_id, reading_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.electricity_cutoff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.electricity_accounts(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('disconnected', 'restored')),
  meter_reading NUMERIC(14, 3) CHECK (meter_reading IS NULL OR meter_reading >= 0),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS electricity_cutoff_events_account_date_idx
  ON public.electricity_cutoff_events(account_id, performed_at DESC);

CREATE OR REPLACE FUNCTION public.can_access_electricity_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = p_property_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.electricity_staff s
    JOIN public.electricity_staff_properties sp ON sp.staff_id = s.id
    WHERE s.auth_user_id = auth.uid()
      AND s.active
      AND sp.property_id = p_property_id
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_electricity_property(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_electricity_property(UUID) TO authenticated;

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
AS $$
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
  IF v_previous_date IS NOT NULL AND p_reading_date <= v_previous_date THEN
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
    opening_balance_units, topup_units, closing_balance_units, reading_date,
    notes, recorded_by
  ) VALUES (
    v_account.id, v_account.owner_user_id, v_previous_reading, p_current_reading,
    v_previous_balance, v_topup_units, v_closing_balance, p_reading_date,
    NULLIF(btrim(p_notes), ''), auth.uid()
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
$$;

REVOKE ALL ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_meter_reading(UUID, NUMERIC, DATE, TEXT) TO authenticated;

ALTER TABLE public.electricity_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_staff_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_cutoff_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage electricity staff"
  ON public.electricity_staff FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Staff can view own electricity staff record"
  ON public.electricity_staff FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Owners manage electricity staff property access"
  ON public.electricity_staff_properties FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Staff can view own assigned electricity properties"
  ON public.electricity_staff_properties FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.electricity_staff s
    WHERE s.id = electricity_staff_properties.staff_id AND s.auth_user_id = auth.uid() AND s.active
  ));

CREATE POLICY "Accessible electricity accounts are readable"
  ON public.electricity_accounts FOR SELECT
  USING (public.can_access_electricity_property(property_id));

CREATE POLICY "Property owners manage electricity accounts"
  ON public.electricity_accounts FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Accessible electricity top-ups are readable"
  ON public.electricity_topups FOR SELECT
  USING (public.can_access_electricity_property((SELECT a.property_id FROM public.electricity_accounts a WHERE a.id = account_id)));

CREATE POLICY "Property owners manage electricity top-ups"
  ON public.electricity_topups FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Accessible electricity readings are readable"
  ON public.electricity_readings FOR SELECT
  USING (public.can_access_electricity_property((SELECT a.property_id FROM public.electricity_accounts a WHERE a.id = account_id)));

CREATE POLICY "Property owners manage electricity readings"
  ON public.electricity_readings FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Accessible staff can record electricity readings"
  ON public.electricity_readings FOR INSERT
  WITH CHECK (
    recorded_by = auth.uid()
    AND public.can_access_electricity_property((SELECT a.property_id FROM public.electricity_accounts a WHERE a.id = account_id))
  );

CREATE POLICY "Accessible electricity cut-off history is readable"
  ON public.electricity_cutoff_events FOR SELECT
  USING (public.can_access_electricity_property((SELECT a.property_id FROM public.electricity_accounts a WHERE a.id = account_id)));

CREATE POLICY "Accessible users record electricity cut-off actions"
  ON public.electricity_cutoff_events FOR INSERT
  WITH CHECK (
    performed_by = auth.uid()
    AND public.can_access_electricity_property((SELECT a.property_id FROM public.electricity_accounts a WHERE a.id = account_id))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.electricity_staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.electricity_staff_properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.electricity_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.electricity_topups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.electricity_readings TO authenticated;
GRANT SELECT, INSERT ON public.electricity_cutoff_events TO authenticated;

COMMIT;
