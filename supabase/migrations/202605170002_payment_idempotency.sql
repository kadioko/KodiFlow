ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS client_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS payments_user_client_request_id_unique
  ON public.payments (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

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

  IF p_amount > invoice_record.balance THEN
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
