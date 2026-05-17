-- KodiFlow manual SQL Editor patch.
-- Paste this whole file into Supabase SQL Editor, press Ctrl+A, then Run.
-- Do not run selected fragments inside either CREATE FUNCTION block.

DO $kodiflow_migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rent_invoices_lease_billing_period_unique'
      AND conrelid = 'public.rent_invoices'::regclass
  ) THEN
    ALTER TABLE public.rent_invoices
      ADD CONSTRAINT rent_invoices_lease_billing_period_unique
      UNIQUE (lease_id, billing_month, billing_year);
  END IF;
END;
$kodiflow_migration$;

CREATE OR REPLACE FUNCTION public.create_rent_invoice_for_lease(
  p_lease_id UUID,
  p_billing_month INTEGER,
  p_billing_year INTEGER,
  p_due_day INTEGER DEFAULT 5
)
RETURNS TABLE(invoice_id UUID, result TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $create_rent_invoice$
DECLARE
  _uid UUID := auth.uid();
  _lease_id UUID;
  _tenant_id UUID;
  _unit_id UUID;
  _property_id UUID;
  _rent NUMERIC;
  _billing_frequency TEXT;
  _rent_wht_enabled BOOLEAN;
  _service_wht_enabled BOOLEAN;
  _rent_wht_rate NUMERIC;
  _service_wht_rate NUMERIC;
  _months INTEGER;
  _start_date DATE;
  _end_date DATE;
  _due_day INTEGER;
  _due_date DATE;
  _new_invoice_id UUID;
  _subtotal NUMERIC := 0;
  _service_total NUMERIC := 0;
  _rent_wht NUMERIC := 0;
  _service_wht NUMERIC := 0;
  _charge RECORD;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  IF p_billing_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Billing month must be between 1 and 12';
  END IF;

  SELECT
    l.id,
    l.tenant_id,
    l.unit_id,
    l.property_id,
    l.monthly_rent,
    l.billing_frequency,
    t.rent_withholding_tax_enabled,
    t.service_charge_withholding_tax_enabled,
    t.rent_withholding_tax_rate,
    t.service_charge_withholding_tax_rate
  INTO
    _lease_id,
    _tenant_id,
    _unit_id,
    _property_id,
    _rent,
    _billing_frequency,
    _rent_wht_enabled,
    _service_wht_enabled,
    _rent_wht_rate,
    _service_wht_rate
  FROM public.leases l
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE l.id = p_lease_id
    AND l.user_id = _uid
    AND l.status = 'active';

  IF _lease_id IS NULL THEN
    RAISE EXCEPTION 'Active lease not found';
  END IF;

  SELECT ri.id INTO _new_invoice_id
  FROM public.rent_invoices ri
  WHERE ri.lease_id = p_lease_id
    AND ri.billing_month = p_billing_month
    AND ri.billing_year = p_billing_year;

  IF _new_invoice_id IS NOT NULL THEN
    invoice_id := _new_invoice_id;
    result := 'skipped';
    RETURN NEXT;
    RETURN;
  END IF;

  _months := CASE _billing_frequency
    WHEN 'quarterly' THEN 3
    WHEN 'semi_annually' THEN 6
    WHEN 'annually' THEN 12
    ELSE 1
  END;

  _start_date := make_date(p_billing_year, p_billing_month, 1);
  _end_date := (_start_date + (_months || ' months')::INTERVAL - INTERVAL '1 day')::DATE;
  _due_day := LEAST(GREATEST(COALESCE(p_due_day, 5), 1), EXTRACT(DAY FROM (date_trunc('month', _start_date) + INTERVAL '1 month - 1 day'))::INTEGER);
  _due_date := make_date(p_billing_year, p_billing_month, _due_day);

  _subtotal := COALESCE(_rent, 0) * _months;

  FOR _charge IN
    SELECT charge_name, charge_type, amount, notes
    FROM public.charges
    WHERE lease_id = p_lease_id
      AND user_id = _uid
      AND is_active = TRUE
      AND charge_type <> 'rent'
  LOOP
    _subtotal := _subtotal + (COALESCE(_charge.amount, 0) * _months);

    IF _charge.charge_type = 'service_charge' THEN
      _service_total := _service_total + (COALESCE(_charge.amount, 0) * _months);
    END IF;
  END LOOP;

  IF COALESCE(_rent_wht_enabled, FALSE) THEN
    _rent_wht := (COALESCE(_rent, 0) * _months * COALESCE(_rent_wht_rate, 10)) / 100;
  END IF;

  IF COALESCE(_service_wht_enabled, FALSE) THEN
    _service_wht := (_service_total * COALESCE(_service_wht_rate, 5)) / 100;
  END IF;

  _subtotal := GREATEST(_subtotal - _rent_wht - _service_wht, 0);

  INSERT INTO public.rent_invoices (
    user_id,
    lease_id,
    tenant_id,
    unit_id,
    property_id,
    billing_period_start,
    billing_period_end,
    billing_month,
    billing_year,
    subtotal,
    due_date,
    status
  )
  VALUES (
    _uid,
    _lease_id,
    _tenant_id,
    _unit_id,
    _property_id,
    _start_date,
    _end_date,
    p_billing_month,
    p_billing_year,
    _subtotal,
    _due_date,
    'unpaid'
  )
  RETURNING id INTO _new_invoice_id;

  INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount)
  VALUES (
    _uid,
    _new_invoice_id,
    CASE WHEN _months = 1 THEN to_char(_start_date, 'Month YYYY') || ' Rent' ELSE _months || '-Month ' || p_billing_year || ' Rent' END,
    'rent',
    COALESCE(_rent, 0) * _months
  );

  FOR _charge IN
    SELECT charge_name, charge_type, amount, notes
    FROM public.charges
    WHERE lease_id = p_lease_id
      AND user_id = _uid
      AND is_active = TRUE
      AND charge_type <> 'rent'
  LOOP
    INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount, notes)
    VALUES (
      _uid,
      _new_invoice_id,
      _charge.charge_name,
      _charge.charge_type,
      COALESCE(_charge.amount, 0) * _months,
      _charge.notes
    );
  END LOOP;

  IF _rent_wht > 0 THEN
    INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount, notes)
    VALUES (
      _uid,
      _new_invoice_id,
      'Rent Withholding Tax (' || COALESCE(_rent_wht_rate, 10) || '%)',
      'tax',
      -_rent_wht,
      'Tenant withholding tax deduction on rent'
    );
  END IF;

  IF _service_wht > 0 THEN
    INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount, notes)
    VALUES (
      _uid,
      _new_invoice_id,
      'Service Charge Withholding Tax (' || COALESCE(_service_wht_rate, 5) || '%)',
      'tax',
      -_service_wht,
      'Tenant withholding tax deduction on service charge'
    );
  END IF;

  invoice_id := _new_invoice_id;
  result := 'created';
  RETURN NEXT;
EXCEPTION
  WHEN unique_violation THEN
    SELECT ri.id INTO _new_invoice_id
    FROM public.rent_invoices ri
    WHERE ri.lease_id = p_lease_id
      AND ri.billing_month = p_billing_month
      AND ri.billing_year = p_billing_year;

    invoice_id := _new_invoice_id;
    result := 'skipped';
    RETURN NEXT;
END;
$create_rent_invoice$;
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_payment_method TEXT,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $record_invoice_payment$
DECLARE
  current_user_id UUID := auth.uid();
  invoice_record RECORD;
  payment_uuid UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  SELECT *
  INTO invoice_record
  FROM public.rent_invoices
  WHERE id = p_invoice_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF invoice_record.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot record a payment against a cancelled invoice';
  END IF;

  IF p_amount > invoice_record.balance THEN
    RAISE EXCEPTION 'Payment amount cannot exceed the invoice balance';
  END IF;

  INSERT INTO public.payments (
    user_id,
    invoice_id,
    tenant_id,
    lease_id,
    property_id,
    unit_id,
    amount,
    payment_date,
    payment_method,
    reference,
    notes
  )
  VALUES (
    current_user_id,
    invoice_record.id,
    invoice_record.tenant_id,
    invoice_record.lease_id,
    invoice_record.property_id,
    invoice_record.unit_id,
    p_amount,
    p_payment_date,
    p_payment_method,
    NULLIF(p_reference, ''),
    NULLIF(p_notes, '')
  )
  RETURNING id INTO payment_uuid;

  RETURN payment_uuid;
END;
$record_invoice_payment$;

DROP POLICY IF EXISTS "Tenant users can view linked tenant profile" ON public.tenants;
CREATE POLICY "Tenant users can view linked tenant profile" ON public.tenants
  FOR SELECT USING (lower(email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Tenant users can view linked leases" ON public.leases;
CREATE POLICY "Tenant users can view linked leases" ON public.leases
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = leases.tenant_id
        AND lower(t.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Tenant users can view linked invoices" ON public.rent_invoices;
CREATE POLICY "Tenant users can view linked invoices" ON public.rent_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = rent_invoices.tenant_id
        AND lower(t.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Tenant users can view linked properties" ON public.properties;
CREATE POLICY "Tenant users can view linked properties" ON public.properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.leases l
      JOIN public.tenants t ON t.id = l.tenant_id
      WHERE l.property_id = properties.id
        AND lower(t.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Tenant users can view linked units" ON public.units;
CREATE POLICY "Tenant users can view linked units" ON public.units
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.leases l
      JOIN public.tenants t ON t.id = l.tenant_id
      WHERE l.unit_id = units.id
        AND lower(t.email) = lower(auth.jwt() ->> 'email')
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  FALSE,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can view own document files" ON storage.objects;
CREATE POLICY "Users can view own document files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Users can upload own document files" ON storage.objects;
CREATE POLICY "Users can upload own document files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Users can update own document files" ON storage.objects;
CREATE POLICY "Users can update own document files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  ) WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Users can delete own document files" ON storage.objects;
CREATE POLICY "Users can delete own document files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
