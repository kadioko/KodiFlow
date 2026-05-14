-- Keep invoice paid amount and status in sync whenever payments change.
CREATE OR REPLACE FUNCTION public.refresh_invoice_payment_status(target_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  v_amount_paid NUMERIC;
  v_subtotal NUMERIC;
  v_due_date DATE;
BEGIN
  SELECT subtotal, due_date
  INTO v_subtotal, v_due_date
  FROM public.rent_invoices
  WHERE id = target_invoice_id;

  IF v_subtotal IS NULL THEN
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

CREATE OR REPLACE FUNCTION public.refresh_invoice_payment_status_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_invoice_payment_status(NEW.invoice_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_invoice_payment_status(OLD.invoice_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_refresh_invoice_payment_status ON public.payments;

CREATE TRIGGER trigger_refresh_invoice_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_invoice_payment_status_trigger();

