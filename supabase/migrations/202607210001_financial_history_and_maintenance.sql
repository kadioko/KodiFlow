-- Financial history, audit trail, and maintenance workflow.

ALTER TABLE public.rent_invoices
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS reversal_payment_id UUID REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS reverses_payment_id UUID REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_user_entity_created_idx
  ON public.activity_log(user_id, entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_row_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  record_data JSONB := to_jsonb(COALESCE(NEW, OLD));
  action_name TEXT := lower(TG_OP);
BEGIN
  INSERT INTO public.activity_log (user_id, actor_user_id, entity_type, entity_id, action, summary, metadata)
  VALUES (
    (record_data ->> 'user_id')::UUID,
    auth.uid(),
    TG_TABLE_NAME,
    (record_data ->> 'id')::UUID,
    action_name,
    initcap(replace(TG_TABLE_NAME, '_', ' ')) || ' ' || action_name,
    CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('before', record_data) ELSE jsonb_build_object('record', record_data) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS activity_log_tenants ON public.tenants;
CREATE TRIGGER activity_log_tenants AFTER INSERT OR UPDATE OR DELETE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.log_row_activity();
DROP TRIGGER IF EXISTS activity_log_units ON public.units;
CREATE TRIGGER activity_log_units AFTER INSERT OR UPDATE OR DELETE ON public.units FOR EACH ROW EXECUTE FUNCTION public.log_row_activity();
DROP TRIGGER IF EXISTS activity_log_leases ON public.leases;
CREATE TRIGGER activity_log_leases AFTER INSERT OR UPDATE OR DELETE ON public.leases FOR EACH ROW EXECUTE FUNCTION public.log_row_activity();
DROP TRIGGER IF EXISTS activity_log_rent_invoices ON public.rent_invoices;
CREATE TRIGGER activity_log_rent_invoices AFTER INSERT OR UPDATE OR DELETE ON public.rent_invoices FOR EACH ROW EXECUTE FUNCTION public.log_row_activity();
DROP TRIGGER IF EXISTS activity_log_payments ON public.payments;
CREATE TRIGGER activity_log_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.log_row_activity();

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own activity" ON public.activity_log;
CREATE POLICY "Users can view own activity" ON public.activity_log FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  invoice_record public.rent_invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be logged in'; END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN RAISE EXCEPTION 'A void reason is required'; END IF;

  SELECT * INTO invoice_record FROM public.rent_invoices WHERE id = p_invoice_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF invoice_record.status = 'cancelled' THEN RAISE EXCEPTION 'Invoice is already voided'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE invoice_id = p_invoice_id AND voided_at IS NULL AND is_reversal = FALSE) THEN
    RAISE EXCEPTION 'Reverse active payments before voiding this invoice';
  END IF;

  UPDATE public.rent_invoices
  SET status = 'cancelled', voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_payment(p_payment_id UUID, p_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  payment_record public.payments%ROWTYPE;
  reversal_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be logged in'; END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN RAISE EXCEPTION 'A reversal reason is required'; END IF;

  SELECT * INTO payment_record FROM public.payments WHERE id = p_payment_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF payment_record.voided_at IS NOT NULL OR payment_record.is_reversal THEN RAISE EXCEPTION 'Payment is already reversed or voided'; END IF;

  INSERT INTO public.payments (
    user_id, invoice_id, tenant_id, lease_id, property_id, unit_id, amount, payment_date,
    payment_method, reference, notes, reverses_payment_id, is_reversal
  ) VALUES (
    payment_record.user_id, payment_record.invoice_id, payment_record.tenant_id, payment_record.lease_id,
    payment_record.property_id, payment_record.unit_id, -payment_record.amount, CURRENT_DATE,
    payment_record.payment_method, CONCAT('Reversal of ', COALESCE(payment_record.reference, payment_record.id::TEXT)),
    btrim(p_reason), payment_record.id, TRUE
  ) RETURNING id INTO reversal_id;

  UPDATE public.payments
  SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason), reversal_payment_id = reversal_id
  WHERE id = payment_record.id;

  RETURN reversal_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'waiting_for_tenant', 'completed', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  vendor_name TEXT,
  assigned_to TEXT,
  estimated_cost NUMERIC(12, 2),
  actual_cost NUMERIC(12, 2),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  maintenance_request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_requests_user_status_idx ON public.maintenance_requests(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS maintenance_requests_property_idx ON public.maintenance_requests(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS maintenance_attachments_request_idx ON public.maintenance_attachments(maintenance_request_id);

DROP TRIGGER IF EXISTS maintenance_requests_updated_at ON public.maintenance_requests;
CREATE TRIGGER maintenance_requests_updated_at BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS activity_log_maintenance_requests ON public.maintenance_requests;
CREATE TRIGGER activity_log_maintenance_requests AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.log_row_activity();

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Users manage own maintenance requests" ON public.maintenance_requests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own maintenance attachments" ON public.maintenance_attachments;
CREATE POLICY "Users manage own maintenance attachments" ON public.maintenance_attachments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
