BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS properties_id_user_id_electricity_scope_uq
  ON public.properties (id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS units_id_property_user_electricity_scope_uq
  ON public.units (id, property_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_id_user_electricity_scope_uq
  ON public.tenants (id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS electricity_staff_id_owner_scope_uq
  ON public.electricity_staff (id, owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS electricity_accounts_id_owner_scope_uq
  ON public.electricity_accounts (id, owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS electricity_readings_account_id_id_scope_uq
  ON public.electricity_readings (account_id, id);

DELETE FROM public.electricity_staff_properties sp
USING public.electricity_staff s, public.properties p
WHERE sp.staff_id = s.id
  AND sp.property_id = p.id
  AND (sp.owner_user_id <> s.owner_user_id OR sp.owner_user_id <> p.user_id);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_staff_properties'::regclass
      AND conname = 'electricity_staff_properties_staff_owner_fkey'
  ) THEN
    ALTER TABLE public.electricity_staff_properties
      ADD CONSTRAINT electricity_staff_properties_staff_owner_fkey
      FOREIGN KEY (staff_id, owner_user_id)
      REFERENCES public.electricity_staff (id, owner_user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_staff_properties'::regclass
      AND conname = 'electricity_staff_properties_property_owner_fkey'
  ) THEN
    ALTER TABLE public.electricity_staff_properties
      ADD CONSTRAINT electricity_staff_properties_property_owner_fkey
      FOREIGN KEY (property_id, owner_user_id)
      REFERENCES public.properties (id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_accounts'::regclass
      AND conname = 'electricity_accounts_property_owner_fkey'
  ) THEN
    ALTER TABLE public.electricity_accounts
      ADD CONSTRAINT electricity_accounts_property_owner_fkey
      FOREIGN KEY (property_id, owner_user_id)
      REFERENCES public.properties (id, user_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_accounts'::regclass
      AND conname = 'electricity_accounts_unit_property_owner_fkey'
  ) THEN
    ALTER TABLE public.electricity_accounts
      ADD CONSTRAINT electricity_accounts_unit_property_owner_fkey
      FOREIGN KEY (unit_id, property_id, owner_user_id)
      REFERENCES public.units (id, property_id, user_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_accounts'::regclass
      AND conname = 'electricity_accounts_tenant_owner_fkey'
  ) THEN
    ALTER TABLE public.electricity_accounts
      ADD CONSTRAINT electricity_accounts_tenant_owner_fkey
      FOREIGN KEY (tenant_id, owner_user_id)
      REFERENCES public.tenants (id, user_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_topups'::regclass
      AND conname = 'electricity_topups_account_owner_fkey'
  ) THEN
    ALTER TABLE public.electricity_topups
      ADD CONSTRAINT electricity_topups_account_owner_fkey
      FOREIGN KEY (account_id, owner_user_id)
      REFERENCES public.electricity_accounts (id, owner_user_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_topups'::regclass
      AND conname = 'electricity_topups_applied_reading_scope_fkey'
  ) THEN
    ALTER TABLE public.electricity_topups
      ADD CONSTRAINT electricity_topups_applied_reading_scope_fkey
      FOREIGN KEY (account_id, applied_reading_id)
      REFERENCES public.electricity_readings (account_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_readings'::regclass
      AND conname = 'electricity_readings_account_owner_fkey'
  ) THEN
    ALTER TABLE public.electricity_readings
      ADD CONSTRAINT electricity_readings_account_owner_fkey
      FOREIGN KEY (account_id, owner_user_id)
      REFERENCES public.electricity_accounts (id, owner_user_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.electricity_cutoff_events'::regclass
      AND conname = 'electricity_cutoff_events_account_owner_fkey'
  ) THEN
    ALTER TABLE public.electricity_cutoff_events
      ADD CONSTRAINT electricity_cutoff_events_account_owner_fkey
      FOREIGN KEY (account_id, owner_user_id)
      REFERENCES public.electricity_accounts (id, owner_user_id)
      ON DELETE RESTRICT;
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.can_access_electricity_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $property_access$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = p_property_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.electricity_staff s
    JOIN public.electricity_staff_properties sp ON sp.staff_id = s.id
    JOIN public.properties p ON p.id = sp.property_id
    WHERE s.auth_user_id = auth.uid()
      AND s.active
      AND sp.owner_user_id = s.owner_user_id
      AND p.user_id = s.owner_user_id
      AND sp.property_id = p_property_id
  );
$property_access$;

REVOKE ALL ON FUNCTION public.can_access_electricity_property(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_electricity_property(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_electricity_account(
  p_property_id UUID,
  p_owner_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $account_access$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = p_property_id
      AND p.user_id = p_owner_user_id
      AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.electricity_staff s
    JOIN public.electricity_staff_properties sp ON sp.staff_id = s.id
    JOIN public.properties p ON p.id = sp.property_id
    WHERE s.auth_user_id = auth.uid()
      AND s.active
      AND s.owner_user_id = p_owner_user_id
      AND sp.owner_user_id = p_owner_user_id
      AND sp.property_id = p_property_id
      AND p.user_id = p_owner_user_id
  );
$account_access$;

REVOKE ALL ON FUNCTION public.can_access_electricity_account(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_electricity_account(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Accessible electricity accounts are readable" ON public.electricity_accounts;
CREATE POLICY "Accessible electricity accounts are readable"
  ON public.electricity_accounts FOR SELECT
  USING (public.can_access_electricity_account(property_id, owner_user_id));

DROP POLICY IF EXISTS "Accessible electricity top-ups are readable" ON public.electricity_topups;
CREATE POLICY "Accessible electricity top-ups are readable"
  ON public.electricity_topups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.electricity_accounts a
    WHERE a.id = electricity_topups.account_id
      AND a.owner_user_id = electricity_topups.owner_user_id
      AND public.can_access_electricity_account(a.property_id, a.owner_user_id)
  ));

DROP POLICY IF EXISTS "Accessible electricity readings are readable" ON public.electricity_readings;
CREATE POLICY "Accessible electricity readings are readable"
  ON public.electricity_readings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.electricity_accounts a
    WHERE a.id = electricity_readings.account_id
      AND a.owner_user_id = electricity_readings.owner_user_id
      AND public.can_access_electricity_account(a.property_id, a.owner_user_id)
  ));

DROP POLICY IF EXISTS "Accessible electricity cut-off history is readable" ON public.electricity_cutoff_events;
CREATE POLICY "Accessible electricity cut-off history is readable"
  ON public.electricity_cutoff_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.electricity_accounts a
    WHERE a.id = electricity_cutoff_events.account_id
      AND a.owner_user_id = electricity_cutoff_events.owner_user_id
      AND public.can_access_electricity_account(a.property_id, a.owner_user_id)
  ));

CREATE OR REPLACE FUNCTION public.set_electricity_staff_properties(
  p_staff_id UUID,
  p_property_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_owner_user_id UUID := auth.uid();
BEGIN
  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  PERFORM 1 FROM public.electricity_staff s
  WHERE s.id = p_staff_id AND s.owner_user_id = v_owner_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff account not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_property_ids, ARRAY[]::UUID[])) AS requested(property_id)
    LEFT JOIN public.properties p
      ON p.id = requested.property_id AND p.user_id = v_owner_user_id
    WHERE requested.property_id IS NULL OR p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every assigned property must belong to you';
  END IF;

  DELETE FROM public.electricity_staff_properties sp
  WHERE sp.staff_id = p_staff_id AND sp.owner_user_id = v_owner_user_id;

  INSERT INTO public.electricity_staff_properties (staff_id, owner_user_id, property_id)
  SELECT p_staff_id, v_owner_user_id, selected.property_id
  FROM (
    SELECT DISTINCT requested.property_id
    FROM unnest(COALESCE(p_property_ids, ARRAY[]::UUID[])) AS requested(property_id)
  ) selected
  ON CONFLICT (staff_id, property_id) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_electricity_topup_to_history(p_topup_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_topup public.electricity_topups%ROWTYPE;
  v_reading public.electricity_readings%ROWTYPE;
  v_running_balance NUMERIC(14, 3);
BEGIN
  SELECT * INTO v_topup
  FROM public.electricity_topups t
  WHERE t.id = p_topup_id AND t.status = 'verified' AND t.applied_reading_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_reading
  FROM public.electricity_readings r
  WHERE r.account_id = v_topup.account_id
    AND r.reading_date >= v_topup.purchase_date
  ORDER BY r.reading_date, r.created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.electricity_readings r
  SET topup_units = r.topup_units + v_topup.units,
      closing_balance_units = r.opening_balance_units + r.topup_units + v_topup.units - r.usage_units
  WHERE r.id = v_reading.id
  RETURNING * INTO v_reading;

  UPDATE public.electricity_topups t
  SET applied_reading_id = v_reading.id
  WHERE t.id = v_topup.id;

  v_running_balance := v_reading.closing_balance_units;
  FOR v_reading IN
    SELECT r.*
    FROM public.electricity_readings r
    WHERE r.account_id = v_topup.account_id
      AND r.reading_date > v_reading.reading_date
    ORDER BY r.reading_date, r.created_at
    FOR UPDATE
  LOOP
    UPDATE public.electricity_readings r
    SET opening_balance_units = v_running_balance,
        closing_balance_units = v_running_balance + r.topup_units - r.usage_units
    WHERE r.id = v_reading.id
    RETURNING r.closing_balance_units INTO v_running_balance;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_electricity_topup(
  p_account_id UUID,
  p_purchase_date DATE,
  p_units NUMERIC,
  p_token_suffix TEXT DEFAULT NULL,
  p_verified BOOLEAN DEFAULT FALSE,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.electricity_topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_account public.electricity_accounts%ROWTYPE;
  v_topup public.electricity_topups%ROWTYPE;
  v_token_suffix TEXT := NULLIF(btrim(p_token_suffix), '');
  v_notes TEXT := NULLIF(btrim(p_notes), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF p_purchase_date IS NULL OR p_purchase_date > (now() AT TIME ZONE 'Africa/Nairobi')::DATE THEN
    RAISE EXCEPTION 'Purchase date must be today or earlier';
  END IF;
  IF p_units IS NULL OR p_units <= 0 THEN
    RAISE EXCEPTION 'Top-up units must be greater than zero';
  END IF;
  IF v_token_suffix IS NOT NULL AND v_token_suffix !~ '^[A-Za-z0-9-]{2,8}$' THEN
    RAISE EXCEPTION 'Only the last 2-8 token characters may be stored';
  END IF;
  IF length(v_notes) > 500 THEN
    RAISE EXCEPTION 'Notes must be 500 characters or less';
  END IF;

  SELECT * INTO v_account
  FROM public.electricity_accounts a
  WHERE a.id = p_account_id
    AND a.active
    AND a.meter_kind = 'submeter'
    AND public.can_access_electricity_property(a.property_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submeter not found or access denied';
  END IF;

  INSERT INTO public.electricity_topups (
    account_id, owner_user_id, purchase_date, units, token_suffix, status,
    verified_at, verified_by, recorded_by, notes
  ) VALUES (
    v_account.id, v_account.owner_user_id, p_purchase_date, p_units, v_token_suffix,
    CASE WHEN p_verified THEN 'verified' ELSE 'reported' END,
    CASE WHEN p_verified THEN now() ELSE NULL END,
    CASE WHEN p_verified THEN auth.uid() ELSE NULL END,
    auth.uid(), v_notes
  ) RETURNING * INTO v_topup;

  IF p_verified THEN
    PERFORM public.apply_electricity_topup_to_history(v_topup.id);
    SELECT * INTO v_topup FROM public.electricity_topups t WHERE t.id = v_topup.id;
  END IF;

  RETURN v_topup;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_electricity_topup(p_topup_id UUID)
RETURNS public.electricity_topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_account_id UUID;
  v_account public.electricity_accounts%ROWTYPE;
  v_topup public.electricity_topups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT t.account_id INTO v_account_id
  FROM public.electricity_topups t
  WHERE t.id = p_topup_id AND t.status = 'reported';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an unverified top-up can be confirmed';
  END IF;

  SELECT * INTO v_account
  FROM public.electricity_accounts a
  WHERE a.id = v_account_id
    AND a.active
    AND a.meter_kind = 'submeter'
    AND public.can_access_electricity_property(a.property_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submeter not found or access denied';
  END IF;

  UPDATE public.electricity_topups t
  SET status = 'verified', verified_at = now(), verified_by = auth.uid()
  WHERE t.id = p_topup_id
    AND t.account_id = v_account.id
    AND t.status = 'reported'
  RETURNING * INTO v_topup;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This top-up was already confirmed';
  END IF;

  PERFORM public.apply_electricity_topup_to_history(v_topup.id);
  SELECT * INTO v_topup FROM public.electricity_topups t WHERE t.id = v_topup.id;

  RETURN v_topup;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_electricity_topup_to_history(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_electricity_staff_properties(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_electricity_staff_properties(UUID, UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.record_electricity_topup(UUID, DATE, NUMERIC, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_electricity_topup(UUID, DATE, NUMERIC, TEXT, BOOLEAN, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.verify_electricity_topup(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_electricity_topup(UUID) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON
  public.electricity_staff,
  public.electricity_staff_properties,
  public.electricity_accounts,
  public.electricity_topups,
  public.electricity_readings,
  public.electricity_cutoff_events
FROM authenticated;

GRANT SELECT ON
  public.electricity_staff,
  public.electricity_staff_properties,
  public.electricity_accounts,
  public.electricity_topups,
  public.electricity_readings,
  public.electricity_cutoff_events
TO authenticated;

GRANT ALL ON
  public.electricity_staff,
  public.electricity_staff_properties,
  public.electricity_accounts,
  public.electricity_topups,
  public.electricity_readings,
  public.electricity_cutoff_events
TO service_role;

COMMIT;
