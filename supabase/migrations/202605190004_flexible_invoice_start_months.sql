-- Allow invoice generation from any selected month, anchored to the lease's original start day.

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
  _months_since_start INTEGER;
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
  _months_since_start :=
    (p_billing_year * 12 + p_billing_month) -
    (EXTRACT(YEAR FROM _lease_start)::INTEGER * 12 + EXTRACT(MONTH FROM _lease_start)::INTEGER);

  IF _months_since_start < 0 THEN
    RAISE EXCEPTION 'Billing period starts before the lease term';
  END IF;

  _start_date := (_lease_start + (_months_since_start || ' months')::INTERVAL)::DATE;
  _end_date := (_start_date + (_months || ' months')::INTERVAL - INTERVAL '1 day')::DATE;

  IF _end_date > _lease_end THEN
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
  _due_date := make_date(EXTRACT(YEAR FROM _start_date)::INTEGER, EXTRACT(MONTH FROM _start_date)::INTEGER, _due_day);

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
    CASE WHEN _months = 1 THEN to_char(_start_date, 'DD Mon YYYY') || ' Rent' ELSE _months || '-Month Rent from ' || to_char(_start_date, 'DD Mon YYYY') END,
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
