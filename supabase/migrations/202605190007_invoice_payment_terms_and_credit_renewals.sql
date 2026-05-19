ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invoice_payment_instructions TEXT DEFAULT 'Please pay at CRDB Bank, Ac: 01J2026378300 (Godfrey Daniel Mariki)',
  ADD COLUMN IF NOT EXISTS invoice_footer_note TEXT DEFAULT 'E.&.O.E.';

DROP POLICY IF EXISTS "Tenant users can view landlord invoice settings" ON public.profiles;
CREATE POLICY "Tenant users can view landlord invoice settings" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.rent_invoices ri
      JOIN public.tenants t ON t.id = ri.tenant_id
      WHERE ri.user_id = profiles.id
        AND lower(t.email) = lower((auth.jwt() ->> 'email'))
    )
  );

CREATE OR REPLACE FUNCTION public.renew_lease(
  p_lease_id UUID,
  p_new_end_date DATE,
  p_new_rent NUMERIC
)
RETURNS TABLE(new_lease_id UUID, opening_balance NUMERIC, new_start_date DATE, new_end_date DATE)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _old_lease public.leases%ROWTYPE;
  _new_lease_id UUID;
  _new_start_date DATE;
  _net_opening_balance NUMERIC := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  IF p_new_rent IS NULL OR p_new_rent < 0 THEN
    RAISE EXCEPTION 'New rent must be zero or greater';
  END IF;

  SELECT *
  INTO _old_lease
  FROM public.leases
  WHERE id = p_lease_id
    AND user_id = _uid
    AND status IN ('active', 'expired')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Renewable lease not found';
  END IF;

  _new_start_date := _old_lease.end_date + INTERVAL '1 day';

  IF p_new_end_date < _new_start_date THEN
    RAISE EXCEPTION 'New end date must be on or after the new start date';
  END IF;

  SELECT COALESCE(SUM(balance), 0)
  INTO _net_opening_balance
  FROM public.rent_invoices
  WHERE lease_id = p_lease_id
    AND user_id = _uid
    AND status <> 'cancelled';

  UPDATE public.leases
  SET status = 'renewed',
      updated_at = NOW()
  WHERE id = p_lease_id
    AND user_id = _uid;

  INSERT INTO public.leases (
    user_id,
    tenant_id,
    unit_id,
    property_id,
    start_date,
    end_date,
    monthly_rent,
    deposit_amount,
    deposit_paid_amount,
    deposit_status,
    rent_due_day,
    lease_type,
    billing_frequency,
    rent_escalation_type,
    rent_escalation_value,
    rent_escalation_frequency,
    status,
    notes
  )
  VALUES (
    _uid,
    _old_lease.tenant_id,
    _old_lease.unit_id,
    _old_lease.property_id,
    _new_start_date,
    p_new_end_date,
    p_new_rent,
    _old_lease.deposit_amount,
    _old_lease.deposit_paid_amount,
    _old_lease.deposit_status,
    _old_lease.rent_due_day,
    _old_lease.lease_type,
    _old_lease.billing_frequency,
    _old_lease.rent_escalation_type,
    _old_lease.rent_escalation_value,
    _old_lease.rent_escalation_frequency,
    'active',
    'Renewed from lease ' || p_lease_id
  )
  RETURNING id INTO _new_lease_id;

  INSERT INTO public.charges (
    user_id,
    lease_id,
    charge_name,
    charge_type,
    amount,
    frequency,
    start_date,
    end_date,
    is_active,
    notes
  )
  SELECT
    _uid,
    _new_lease_id,
    charge_name,
    charge_type,
    amount,
    frequency,
    _new_start_date,
    p_new_end_date,
    TRUE,
    notes
  FROM public.charges
  WHERE lease_id = p_lease_id
    AND user_id = _uid
    AND is_active = TRUE
    AND frequency <> 'one_time';

  IF _net_opening_balance <> 0 THEN
    INSERT INTO public.charges (
      user_id,
      lease_id,
      charge_name,
      charge_type,
      amount,
      frequency,
      is_active,
      notes
    )
    VALUES (
      _uid,
      _new_lease_id,
      CASE WHEN _net_opening_balance > 0 THEN 'Opening Balance' ELSE 'Opening Credit' END,
      'other',
      _net_opening_balance,
      'one_time',
      TRUE,
      CASE
        WHEN _net_opening_balance > 0 THEN 'Outstanding balance carried from renewed lease ' || p_lease_id
        ELSE 'Overpayment credit carried from renewed lease ' || p_lease_id
      END
    );
  END IF;

  new_lease_id := _new_lease_id;
  opening_balance := _net_opening_balance;
  new_start_date := _new_start_date;
  new_end_date := p_new_end_date;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_payment_method TEXT,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_client_request_id UUID DEFAULT NULL
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

  IF p_client_request_id IS NOT NULL THEN
    SELECT id INTO payment_uuid
    FROM public.payments
    WHERE user_id = current_user_id
      AND client_request_id = p_client_request_id;

    IF payment_uuid IS NOT NULL THEN
      RETURN payment_uuid;
    END IF;
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
    notes,
    client_request_id
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
    NULLIF(p_notes, ''),
    p_client_request_id
  )
  ON CONFLICT (user_id, client_request_id) WHERE client_request_id IS NOT NULL
  DO UPDATE SET client_request_id = EXCLUDED.client_request_id
  RETURNING id INTO payment_uuid;

  RETURN payment_uuid;
END;
$record_invoice_payment$;

DROP POLICY IF EXISTS "Tenant users can view linked invoice items" ON public.invoice_items;
CREATE POLICY "Tenant users can view linked invoice items" ON public.invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.rent_invoices ri
      JOIN public.tenants t ON t.id = ri.tenant_id
      WHERE ri.id = invoice_items.invoice_id
        AND lower(t.email) = lower((auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "Tenant users can view linked invoice payments" ON public.payments;
CREATE POLICY "Tenant users can view linked invoice payments" ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = payments.tenant_id
        AND lower(t.email) = lower((auth.jwt() ->> 'email'))
    )
  );
