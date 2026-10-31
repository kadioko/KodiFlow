BEGIN;

ALTER TABLE public.electricity_entry_audit
  ADD CONSTRAINT electricity_entry_audit_reason_required
  CHECK (action = 'confirmed' OR (reason IS NOT NULL AND length(btrim(reason)) BETWEEN 3 AND 500)) NOT VALID;
ALTER TABLE public.electricity_entry_audit VALIDATE CONSTRAINT electricity_entry_audit_reason_required;

CREATE OR REPLACE FUNCTION public.validate_electricity_entry_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $validate_electricity_entry_date$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Africa/Nairobi')::DATE;
  v_baseline DATE;
BEGIN
  IF TG_TABLE_NAME = 'electricity_readings' THEN
    IF NEW.reading_date IS DISTINCT FROM OLD.reading_date THEN
      SELECT initial_reading_date INTO v_baseline FROM public.electricity_accounts WHERE id = NEW.account_id;
      IF NEW.reading_date > v_today OR NEW.reading_date <= v_baseline THEN
        RAISE EXCEPTION 'Reading date must be after the meter baseline and no later than today';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'electricity_main_meter_balances' THEN
    IF NEW.reading_date IS DISTINCT FROM OLD.reading_date AND NEW.reading_date > v_today THEN
      RAISE EXCEPTION 'Main-meter balance date must be today or earlier';
    END IF;
  ELSIF TG_TABLE_NAME = 'electricity_topups' THEN
    IF NEW.purchase_date IS DISTINCT FROM OLD.purchase_date AND NEW.purchase_date > v_today THEN
      RAISE EXCEPTION 'Purchase date must be today or earlier';
    END IF;
  ELSIF TG_TABLE_NAME = 'electricity_balance_adjustments' THEN
    IF NEW.adjustment_date IS DISTINCT FROM OLD.adjustment_date AND NEW.adjustment_date > v_today THEN
      RAISE EXCEPTION 'Adjustment date must be today or earlier';
    END IF;
  END IF;
  RETURN NEW;
END;
$validate_electricity_entry_date$;

CREATE TRIGGER electricity_reading_date_change_guard BEFORE UPDATE OF reading_date ON public.electricity_readings
  FOR EACH ROW EXECUTE FUNCTION public.validate_electricity_entry_date_change();
CREATE TRIGGER electricity_main_balance_date_change_guard BEFORE UPDATE OF reading_date ON public.electricity_main_meter_balances
  FOR EACH ROW EXECUTE FUNCTION public.validate_electricity_entry_date_change();
CREATE TRIGGER electricity_topup_date_change_guard BEFORE UPDATE OF purchase_date ON public.electricity_topups
  FOR EACH ROW EXECUTE FUNCTION public.validate_electricity_entry_date_change();
CREATE TRIGGER electricity_adjustment_date_change_guard BEFORE UPDATE OF adjustment_date ON public.electricity_balance_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.validate_electricity_entry_date_change();

REVOKE ALL ON FUNCTION public.validate_electricity_entry_date_change() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.protect_electricity_balance_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $protect_electricity_adjustment$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.owner_user_id AND (
    NEW.adjustment_units IS DISTINCT FROM OLD.adjustment_units
    OR NEW.adjustment_date IS DISTINCT FROM OLD.adjustment_date
    OR NEW.reason IS DISTINCT FROM OLD.reason
  ) THEN
    RAISE EXCEPTION 'Only the property owner can change a balance adjustment';
  END IF;
  RETURN NEW;
END;
$protect_electricity_adjustment$;

CREATE TRIGGER electricity_adjustment_owner_guard
  BEFORE UPDATE OF adjustment_units, adjustment_date, reason ON public.electricity_balance_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.protect_electricity_balance_adjustment();
REVOKE ALL ON FUNCTION public.protect_electricity_balance_adjustment() FROM PUBLIC;
COMMIT;
