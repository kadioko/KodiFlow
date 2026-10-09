BEGIN;

CREATE OR REPLACE FUNCTION public.update_unit_status_on_lease_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $update_unit_status_on_lease_change$
DECLARE
  active_leases_count INTEGER;
  expired_leases_count INTEGER;
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.units
    SET status = 'occupied', updated_at = NOW()
    WHERE id = NEW.unit_id
      AND user_id = NEW.user_id;
  ELSIF TG_OP = 'UPDATE'
    AND NEW.status = 'terminated'
    AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT
      COUNT(*) FILTER (WHERE status = 'active'),
      COUNT(*) FILTER (WHERE status = 'expired')
    INTO active_leases_count, expired_leases_count
    FROM public.leases
    WHERE unit_id = NEW.unit_id
      AND user_id = NEW.user_id
      AND id <> NEW.id;

    IF active_leases_count = 0 AND expired_leases_count = 0 THEN
      UPDATE public.units
      SET status = 'vacant', updated_at = NOW()
      WHERE id = NEW.unit_id
        AND user_id = NEW.user_id
        AND status = 'occupied';
    END IF;
  END IF;

  RETURN NEW;
END;
$update_unit_status_on_lease_change$;

DROP TRIGGER IF EXISTS trigger_update_unit_on_lease ON public.leases;
CREATE TRIGGER trigger_update_unit_on_lease
  AFTER INSERT OR UPDATE OF status ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_unit_status_on_lease_change();

COMMIT;
