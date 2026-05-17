-- Harden billing writes, tenant portal reads, and document storage setup.

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
  v_user_id UUID := auth.uid();
  v_lease RECORD;
  v_months INTEGER;
  v_period_start DATE;
  v_period_end DATE;
  v_due_day INTEGER;
  v_due_date DATE;
  v_invoice_id UUID;
  v_subtotal NUMERIC := 0;
  v_service_charge_total NUMERIC := 0;
  v_rent_withholding NUMERIC := 0;
  v_service_withholding NUMERIC := 0;
  v_charge RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  IF p_billing_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Billing month must be between 1 and 12';
  END IF;

  SELECT
    l.id,
    l.user_id,
    l.tenant_id,
    l.unit_id,
    l.property_id,
    l.monthly_rent,
    l.billing_frequency,
    t.rent_withholding_tax_enabled,
    t.service_charge_withholding_tax_enabled,
    t.rent_withholding_tax_rate,
    t.service_charge_withholding_tax_rate
  INTO v_lease
  FROM public.leases l
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE l.id = p_lease_id
    AND l.user_id = v_user_id
    AND l.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active lease not found';
  END IF;

  SELECT ri.id INTO v_invoice_id
  FROM public.rent_invoices ri
  WHERE ri.lease_id = p_lease_id
    AND ri.billing_month = p_billing_month
    AND ri.billing_year = p_billing_year;

  IF FOUND THEN
    invoice_id := v_invoice_id;
    result := 'skipped';
    RETURN NEXT;
    RETURN;
  END IF;

  v_months := CASE v_lease.billing_frequency
    WHEN 'quarterly' THEN 3
    WHEN 'semi_annually' THEN 6
    WHEN 'annually' THEN 12
    ELSE 1
  END;

  v_period_start := make_date(p_billing_year, p_billing_month, 1);
  v_period_end := (v_period_start + (v_months || ' months')::INTERVAL - INTERVAL '1 day')::DATE;
  v_due_day := LEAST(GREATEST(COALESCE(p_due_day, 5), 1), EXTRACT(DAY FROM (date_trunc('month', v_period_start) + INTERVAL '1 month - 1 day'))::INTEGER);
  v_due_date := make_date(p_billing_year, p_billing_month, v_due_day);

  v_subtotal := COALESCE(v_lease.monthly_rent, 0) * v_months;

  FOR v_charge IN
    SELECT charge_name, charge_type, amount, notes
    FROM public.charges
    WHERE lease_id = p_lease_id
      AND user_id = v_user_id
      AND is_active = TRUE
      AND charge_type <> 'rent'
  LOOP
    v_subtotal := v_subtotal + (COALESCE(v_charge.amount, 0) * v_months);

    IF v_charge.charge_type = 'service_charge' THEN
      v_service_charge_total := v_service_charge_total + (COALESCE(v_charge.amount, 0) * v_months);
    END IF;
  END LOOP;

  IF COALESCE(v_lease.rent_withholding_tax_enabled, FALSE) THEN
    v_rent_withholding := (COALESCE(v_lease.monthly_rent, 0) * v_months * COALESCE(v_lease.rent_withholding_tax_rate, 10)) / 100;
  END IF;

  IF COALESCE(v_lease.service_charge_withholding_tax_enabled, FALSE) THEN
    v_service_withholding := (v_service_charge_total * COALESCE(v_lease.service_charge_withholding_tax_rate, 5)) / 100;
  END IF;

  v_subtotal := GREATEST(v_subtotal - v_rent_withholding - v_service_withholding, 0);

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
    v_user_id,
    v_lease.id,
    v_lease.tenant_id,
    v_lease.unit_id,
    v_lease.property_id,
    v_period_start,
    v_period_end,
    p_billing_month,
    p_billing_year,
    v_subtotal,
    v_due_date,
    'unpaid'
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount)
  VALUES (
    v_user_id,
    v_invoice_id,
    CASE WHEN v_months = 1 THEN to_char(v_period_start, 'Month YYYY') || ' Rent' ELSE v_months || '-Month ' || p_billing_year || ' Rent' END,
    'rent',
    COALESCE(v_lease.monthly_rent, 0) * v_months
  );

  FOR v_charge IN
    SELECT charge_name, charge_type, amount, notes
    FROM public.charges
    WHERE lease_id = p_lease_id
      AND user_id = v_user_id
      AND is_active = TRUE
      AND charge_type <> 'rent'
  LOOP
    INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount, notes)
    VALUES (
      v_user_id,
      v_invoice_id,
      v_charge.charge_name,
      v_charge.charge_type,
      COALESCE(v_charge.amount, 0) * v_months,
      v_charge.notes
    );
  END LOOP;

  IF v_rent_withholding > 0 THEN
    INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount, notes)
    VALUES (
      v_user_id,
      v_invoice_id,
      'Rent Withholding Tax (' || COALESCE(v_lease.rent_withholding_tax_rate, 10) || '%)',
      'tax',
      -v_rent_withholding,
      'Tenant withholding tax deduction on rent'
    );
  END IF;

  IF v_service_withholding > 0 THEN
    INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount, notes)
    VALUES (
      v_user_id,
      v_invoice_id,
      'Service Charge Withholding Tax (' || COALESCE(v_lease.service_charge_withholding_tax_rate, 5) || '%)',
      'tax',
      -v_service_withholding,
      'Tenant withholding tax deduction on service charge'
    );
  END IF;

  invoice_id := v_invoice_id;
  result := 'created';
  RETURN NEXT;
EXCEPTION
  WHEN unique_violation THEN
    SELECT ri.id INTO v_invoice_id
    FROM public.rent_invoices ri
    WHERE ri.lease_id = p_lease_id
      AND ri.billing_month = p_billing_month
      AND ri.billing_year = p_billing_year;

    invoice_id := v_invoice_id;
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
  v_user_id UUID := auth.uid();
  v_invoice RECORD;
  v_payment_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.rent_invoices
  WHERE id = p_invoice_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot record a payment against a cancelled invoice';
  END IF;

  IF p_amount > v_invoice.balance THEN
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
    v_user_id,
    v_invoice.id,
    v_invoice.tenant_id,
    v_invoice.lease_id,
    v_invoice.property_id,
    v_invoice.unit_id,
    p_amount,
    p_payment_date,
    p_payment_method,
    NULLIF(p_reference, ''),
    NULLIF(p_notes, '')
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
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
