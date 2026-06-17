-- Move old lease balances into the renewed lease without double-counting old invoices.

ALTER TABLE public.rent_invoices
  DROP CONSTRAINT IF EXISTS rent_invoices_status_check;

ALTER TABLE public.rent_invoices
  ADD CONSTRAINT rent_invoices_status_check
  CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled', 'transferred'));

CREATE OR REPLACE FUNCTION public.refresh_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _updated_count INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  UPDATE public.rent_invoices
  SET status = CASE
      WHEN amount_paid >= subtotal THEN 'paid'
      WHEN due_date < CURRENT_DATE AND (subtotal - amount_paid) > 0 THEN 'overdue'
      WHEN amount_paid > 0 THEN 'partially_paid'
      ELSE 'unpaid'
    END,
    updated_at = NOW()
  WHERE user_id = _uid
    AND status NOT IN ('cancelled', 'transferred');

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RETURN _updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_invoice_payment_status(target_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  v_amount_paid NUMERIC;
  v_subtotal NUMERIC;
  v_due_date DATE;
  v_status TEXT;
BEGIN
  SELECT subtotal, due_date, status
  INTO v_subtotal, v_due_date, v_status
  FROM public.rent_invoices
  WHERE id = target_invoice_id;

  IF v_subtotal IS NULL OR v_status IN ('cancelled', 'transferred') THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_amount_paid
  FROM public.payments
  WHERE invoice_id = target_invoice_id;

  UPDATE public.rent_invoices
  SET
    amount_paid = v_amount_paid,
    status = CASE
      WHEN v_amount_paid >= v_subtotal THEN 'paid'
      WHEN v_amount_paid > 0 THEN 'partially_paid'
      WHEN v_due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'unpaid'
    END,
    updated_at = NOW()
  WHERE id = target_invoice_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.renew_lease(
  p_lease_id UUID,
  p_new_end_date DATE,
  p_new_rent NUMERIC,
  p_new_service_charge NUMERIC DEFAULT NULL
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
    AND status NOT IN ('cancelled', 'transferred');

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
    CASE
      WHEN charge_type = 'service_charge' AND p_new_service_charge IS NOT NULL
        THEN p_new_service_charge
      ELSE amount
    END,
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
        WHEN _net_opening_balance > 0 THEN 'Outstanding balance transferred from renewed lease ' || p_lease_id
        ELSE 'Overpayment credit transferred from renewed lease ' || p_lease_id
      END
    );

    UPDATE public.rent_invoices
    SET amount_paid = subtotal,
        status = 'transferred',
        notes = trim(both E'\n' FROM concat_ws(E'\n', notes, 'Balance transferred to renewed lease ' || _new_lease_id)),
        updated_at = NOW()
    WHERE lease_id = p_lease_id
      AND user_id = _uid
      AND status NOT IN ('cancelled', 'transferred')
      AND balance <> 0;
  END IF;

  new_lease_id := _new_lease_id;
  opening_balance := _net_opening_balance;
  new_start_date := _new_start_date;
  new_end_date := p_new_end_date;
  RETURN NEXT;
END;
$$;
