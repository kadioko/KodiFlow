-- Allow setting a new service charge amount when renewing a lease.

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

  -- Copy recurring charges, applying the new service charge amount if provided
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
