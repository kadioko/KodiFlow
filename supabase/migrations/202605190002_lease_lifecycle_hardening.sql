-- Harden lease expiry, renewal, invoice cadence, and charge frequency handling.

CREATE OR REPLACE FUNCTION public.billing_frequency_months(p_frequency TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_frequency
    WHEN 'quarterly' THEN 3
    WHEN 'semi_annually' THEN 6
    WHEN 'annually' THEN 12
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.charge_amount_for_billing_period(
  p_amount NUMERIC,
  p_charge_frequency TEXT,
  p_billing_frequency TEXT
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_charge_frequency
    WHEN 'one_time' THEN COALESCE(p_amount, 0)
    WHEN 'custom' THEN COALESCE(p_amount, 0)
    WHEN 'quarterly' THEN
      CASE WHEN public.billing_frequency_months(p_billing_frequency) >= 3
        THEN COALESCE(p_amount, 0) * FLOOR(public.billing_frequency_months(p_billing_frequency)::NUMERIC / 3)
        ELSE 0
      END
    WHEN 'annually' THEN
      CASE WHEN public.billing_frequency_months(p_billing_frequency) >= 12
        THEN COALESCE(p_amount, 0) * FLOOR(public.billing_frequency_months(p_billing_frequency)::NUMERIC / 12)
        ELSE 0
      END
    ELSE COALESCE(p_amount, 0) * public.billing_frequency_months(p_billing_frequency)
  END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_leases()
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

  UPDATE public.leases
  SET status = 'expired',
      updated_at = NOW()
  WHERE user_id = _uid
    AND status = 'active'
    AND end_date < CURRENT_DATE;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RETURN _updated_count;
END;
$$;

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
    AND status <> 'cancelled';

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RETURN _updated_count;
END;
$$;

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
  _opening_balance NUMERIC := 0;
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

  SELECT COALESCE(SUM(GREATEST(balance, 0)), 0)
  INTO _opening_balance
  FROM public.rent_invoices
  WHERE lease_id = p_lease_id
    AND user_id = _uid
    AND status NOT IN ('paid', 'cancelled');

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

  IF _opening_balance > 0 THEN
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
      'Opening Balance',
      'other',
      _opening_balance,
      'one_time',
      TRUE,
      'Outstanding balance carried from renewed lease ' || p_lease_id
    );
  END IF;

  new_lease_id := _new_lease_id;
  opening_balance := _opening_balance;
  new_start_date := _new_start_date;
  new_end_date := p_new_end_date;
  RETURN NEXT;
END;
$$;

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
  _lease_start DATE;
  _lease_end DATE;
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
  _charge_amount NUMERIC := 0;
  _charge RECORD;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  IF p_billing_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Billing month must be between 1 and 12';
  END IF;

  PERFORM public.expire_stale_leases();

  SELECT
    l.id,
    l.tenant_id,
    l.unit_id,
    l.property_id,
    l.monthly_rent,
    l.billing_frequency,
    l.start_date,
    l.end_date,
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
    _lease_start,
    _lease_end,
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

  _months := public.billing_frequency_months(_billing_frequency);
  _start_date := make_date(p_billing_year, p_billing_month, 1);
  _end_date := (_start_date + (_months || ' months')::INTERVAL - INTERVAL '1 day')::DATE;

  IF MOD(
    (p_billing_year * 12 + p_billing_month) -
    (EXTRACT(YEAR FROM _lease_start)::INTEGER * 12 + EXTRACT(MONTH FROM _lease_start)::INTEGER),
    _months
  ) <> 0 THEN
    RAISE EXCEPTION 'Billing period does not match lease billing frequency cadence';
  END IF;

  IF _start_date < _lease_start OR _end_date > _lease_end THEN
    RAISE EXCEPTION 'Billing period is outside the lease term';
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

  _due_day := LEAST(GREATEST(COALESCE(p_due_day, 5), 1), EXTRACT(DAY FROM (date_trunc('month', _start_date) + INTERVAL '1 month - 1 day'))::INTEGER);
  _due_date := make_date(p_billing_year, p_billing_month, _due_day);

  _subtotal := COALESCE(_rent, 0) * _months;

  FOR _charge IN
    SELECT charge_name, charge_type, amount, frequency, notes
    FROM public.charges
    WHERE lease_id = p_lease_id
      AND user_id = _uid
      AND is_active = TRUE
      AND charge_type <> 'rent'
  LOOP
    _charge_amount := public.charge_amount_for_billing_period(_charge.amount, _charge.frequency, _billing_frequency);
    _subtotal := _subtotal + _charge_amount;

    IF _charge.charge_type = 'service_charge' THEN
      _service_total := _service_total + _charge_amount;
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
    SELECT charge_name, charge_type, amount, frequency, notes
    FROM public.charges
    WHERE lease_id = p_lease_id
      AND user_id = _uid
      AND is_active = TRUE
      AND charge_type <> 'rent'
  LOOP
    _charge_amount := public.charge_amount_for_billing_period(_charge.amount, _charge.frequency, _billing_frequency);

    IF _charge_amount <> 0 THEN
      INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount, notes)
      VALUES (
        _uid,
        _new_invoice_id,
        _charge.charge_name,
        _charge.charge_type,
        _charge_amount,
        _charge.notes
      );
    END IF;
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

  UPDATE public.charges
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE lease_id = p_lease_id
    AND user_id = _uid
    AND is_active = TRUE
    AND frequency = 'one_time';

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
