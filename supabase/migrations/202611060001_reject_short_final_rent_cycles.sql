CREATE OR REPLACE FUNCTION public.validate_rent_invoice_billing_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $validate_rent_invoice_billing_period$
DECLARE
  _lease_start DATE;
  _lease_end DATE;
  _billing_frequency TEXT;
  _months INTEGER;
  _cycle_end DATE;
BEGIN
  IF NEW.lease_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT start_date, end_date, billing_frequency
  INTO _lease_start, _lease_end, _billing_frequency
  FROM public.leases
  WHERE id = NEW.lease_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _months := CASE _billing_frequency
    WHEN 'quarterly' THEN 3
    WHEN 'semi_annually' THEN 6
    WHEN 'annually' THEN 12
    ELSE 1
  END;

  IF NEW.billing_period_start < _lease_start OR NEW.billing_period_start > _lease_end THEN
    RAISE EXCEPTION 'Invoice period must start within the lease dates';
  END IF;

  _cycle_end := (
    NEW.billing_period_start + (_months || ' months')::INTERVAL - INTERVAL '1 day'
  )::DATE;

  IF _cycle_end > _lease_end THEN
    RAISE EXCEPTION 'Lease ends before the full % month billing cycle ends; renew or correct the lease dates before invoicing', _months;
  END IF;

  IF NEW.billing_period_end <> _cycle_end THEN
    RAISE EXCEPTION 'Invoice period must cover the complete % month billing cycle ending on %', _months, _cycle_end;
  END IF;

  RETURN NEW;
END;
$validate_rent_invoice_billing_period$;

DROP TRIGGER IF EXISTS validate_rent_invoice_billing_period ON public.rent_invoices;
CREATE TRIGGER validate_rent_invoice_billing_period
  BEFORE INSERT OR UPDATE OF lease_id, billing_period_start, billing_period_end
  ON public.rent_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_rent_invoice_billing_period();
