-- KodiFlow Property Management Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  currency_preference TEXT DEFAULT 'TZS',
  dashboard_hidden_property_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  language_preference TEXT DEFAULT 'en' CHECK (language_preference IN ('en', 'sw')),
  late_fee_rate DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. PROPERTIES TABLE
-- ============================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('residential', 'commercial', 'mixed_use')),
  location TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. PROPERTY SECTIONS TABLE
-- ============================================
CREATE TABLE property_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  section_type TEXT NOT NULL CHECK (section_type IN ('floor', 'block', 'wing', 'area', 'compound', 'market_zone', 'parking_area', 'other')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. UNITS TABLE
-- ============================================
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  section_id UUID REFERENCES property_sections(id) ON DELETE SET NULL,
  unit_name TEXT NOT NULL,
  unit_identifier TEXT,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('apartment', 'room', 'house', 'shop', 'office', 'stall', 'kiosk', 'warehouse', 'godown', 'parking_slot', 'land_space', 'other')),
  usage_type TEXT NOT NULL CHECK (usage_type IN ('residential', 'commercial', 'mixed')),
  monthly_rent DECIMAL(12, 2) DEFAULT 0,
  size DECIMAL(10, 2),
  size_unit TEXT DEFAULT 'sqm',
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'reserved', 'under_maintenance', 'inactive')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. TENANTS TABLE
-- ============================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_type TEXT NOT NULL CHECK (tenant_type IN ('individual', 'business', 'organization')),
  full_name TEXT,
  business_name TEXT,
  contact_person_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  id_number TEXT,
  tin_number TEXT,
  business_license_number TEXT,
  rent_withholding_tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  service_charge_withholding_tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rent_withholding_tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 10,
  service_charge_withholding_tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 5,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. LEASES TABLE
-- ============================================
CREATE TABLE leases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent DECIMAL(12, 2) NOT NULL,
  deposit_amount DECIMAL(12, 2) DEFAULT 0,
  deposit_paid_amount DECIMAL(12, 2) DEFAULT 0,
  deposit_status TEXT DEFAULT 'pending' CHECK (deposit_status IN ('pending', 'partial', 'paid', 'refunded')),
  rent_due_day INTEGER DEFAULT 1 CHECK (rent_due_day BETWEEN 1 AND 31),
  lease_type TEXT NOT NULL CHECK (lease_type IN ('residential', 'commercial')),
  billing_frequency TEXT DEFAULT 'monthly' CHECK (billing_frequency IN ('monthly', 'quarterly', 'semi_annually', 'annually')),
  rent_escalation_type TEXT DEFAULT 'none' CHECK (rent_escalation_type IN ('none', 'percentage', 'fixed_amount')),
  rent_escalation_value DECIMAL(10, 2),
  rent_escalation_frequency TEXT DEFAULT 'none' CHECK (rent_escalation_frequency IN ('none', 'annually', 'custom')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated', 'renewed', 'pending')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. CHARGES TABLE
-- ============================================
CREATE TABLE charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  charge_name TEXT NOT NULL,
  charge_type TEXT NOT NULL CHECK (charge_type IN ('rent', 'service_charge', 'security', 'water', 'electricity', 'garbage', 'maintenance', 'parking', 'tax', 'penalty', 'other')),
  amount DECIMAL(12, 2) NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'annually', 'one_time', 'custom')),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. RENT INVOICES TABLE
-- ============================================
CREATE TABLE rent_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  billing_year INTEGER NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12, 2) DEFAULT 0,
  balance DECIMAL(12, 2) GENERATED ALWAYS AS (subtotal - amount_paid) STORED,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT rent_invoices_lease_billing_period_unique UNIQUE (lease_id, billing_month, billing_year)
);

-- ============================================
-- 9. INVOICE ITEMS TABLE
-- ============================================
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES rent_invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('rent', 'service_charge', 'security', 'water', 'electricity', 'garbage', 'maintenance', 'parking', 'tax', 'penalty', 'other')),
  amount DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 10. PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES rent_invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank', 'mobile_money', 'cheque', 'card', 'other')),
  reference TEXT,
  notes TEXT,
  client_request_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 11. EXPENSES TABLE
-- ============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  section_id UUID REFERENCES property_sections(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  expense_date DATE NOT NULL,
  vendor TEXT,
  description TEXT,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 12. DOCUMENTS TABLE
-- ============================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('lease_agreement', 'id_document', 'business_license', 'receipt', 'inspection_report', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 13. UTILITY METER READINGS TABLE
-- ============================================
CREATE TABLE utility_meter_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  utility_type TEXT NOT NULL CHECK (utility_type IN ('water', 'electricity')),
  previous_reading DECIMAL(12, 2) NOT NULL DEFAULT 0,
  current_reading DECIMAL(12, 2) NOT NULL,
  usage_amount DECIMAL(12, 2) GENERATED ALWAYS AS (current_reading - previous_reading) STORED,
  rate_per_unit DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) GENERATED ALWAYS AS ((current_reading - previous_reading) * rate_per_unit) STORED,
  reading_date DATE NOT NULL,
  billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  billing_year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_property_sections_property_id ON property_sections(property_id);
CREATE INDEX idx_property_sections_user_id ON property_sections(user_id);
CREATE INDEX idx_units_property_id ON units(property_id);
CREATE INDEX idx_units_section_id ON units(section_id);
CREATE INDEX idx_units_user_id ON units(user_id);
CREATE INDEX idx_units_status ON units(status);
CREATE UNIQUE INDEX idx_units_section_identifier_unique ON units(user_id, property_id, section_id, lower(unit_identifier)) WHERE unit_identifier IS NOT NULL AND btrim(unit_identifier) <> '';
CREATE INDEX idx_tenants_user_id ON tenants(user_id);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX idx_leases_unit_id ON leases(unit_id);
CREATE INDEX idx_leases_property_id ON leases(property_id);
CREATE INDEX idx_leases_user_id ON leases(user_id);
CREATE INDEX idx_leases_status ON leases(status);
CREATE INDEX idx_charges_lease_id ON charges(lease_id);
CREATE INDEX idx_charges_user_id ON charges(user_id);
CREATE INDEX idx_rent_invoices_lease_id ON rent_invoices(lease_id);
CREATE INDEX idx_rent_invoices_tenant_id ON rent_invoices(tenant_id);
CREATE INDEX idx_rent_invoices_property_id ON rent_invoices(property_id);
CREATE INDEX idx_rent_invoices_user_id ON rent_invoices(user_id);
CREATE INDEX idx_rent_invoices_status ON rent_invoices(status);
CREATE INDEX idx_rent_invoices_billing ON rent_invoices(billing_month, billing_year);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_property_id ON payments(property_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE UNIQUE INDEX payments_user_client_request_id_unique ON payments(user_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX idx_expenses_property_id ON expenses(property_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_documents_property_id ON documents(property_id);
CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX idx_documents_lease_id ON documents(lease_id);
CREATE INDEX idx_utility_meter_readings_user_id ON utility_meter_readings(user_id);
CREATE INDEX idx_utility_meter_readings_property_id ON utility_meter_readings(property_id);
CREATE INDEX idx_utility_meter_readings_unit_id ON utility_meter_readings(unit_id);
CREATE INDEX idx_utility_meter_readings_billing ON utility_meter_readings(billing_month, billing_year);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.invoice_number = 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Trigger to auto-generate invoice number
CREATE TRIGGER trigger_generate_invoice_number
  BEFORE INSERT ON rent_invoices
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();

-- Function to update invoice status based on payments
CREATE OR REPLACE FUNCTION refresh_invoice_payment_status(target_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  v_amount_paid NUMERIC;
  subtotal_amount NUMERIC;
  due_date_value DATE;
BEGIN
  SELECT subtotal, due_date
  INTO subtotal_amount, due_date_value
  FROM rent_invoices
  WHERE id = target_invoice_id;

  IF subtotal_amount IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_amount_paid
  FROM payments
  WHERE invoice_id = target_invoice_id;

  UPDATE rent_invoices
  SET
    amount_paid = v_amount_paid,
    status = CASE
      WHEN v_amount_paid >= subtotal_amount THEN 'paid'
      WHEN v_amount_paid > 0 THEN 'partially_paid'
      WHEN due_date_value < CURRENT_DATE THEN 'overdue'
      ELSE 'unpaid'
    END,
    updated_at = NOW()
  WHERE id = target_invoice_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_invoice_payment_status_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM refresh_invoice_payment_status(NEW.invoice_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM refresh_invoice_payment_status(OLD.invoice_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to create an invoice and its line items atomically
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

  SELECT
    l.id,
    l.tenant_id,
    l.unit_id,
    l.property_id,
    l.monthly_rent,
    l.billing_frequency,
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

  _months := CASE _billing_frequency
    WHEN 'quarterly' THEN 3
    WHEN 'semi_annually' THEN 6
    WHEN 'annually' THEN 12
    ELSE 1
  END;

  _start_date := make_date(p_billing_year, p_billing_month, 1);
  _end_date := (_start_date + (_months || ' months')::INTERVAL - INTERVAL '1 day')::DATE;
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
    _charge_amount := CASE
      WHEN _charge.frequency = 'one_time' THEN COALESCE(_charge.amount, 0)
      ELSE COALESCE(_charge.amount, 0) * _months
    END;
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
    _charge_amount := CASE
      WHEN _charge.frequency = 'one_time' THEN COALESCE(_charge.amount, 0)
      ELSE COALESCE(_charge.amount, 0) * _months
    END;

    INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount, notes)
    VALUES (
      _uid,
      _new_invoice_id,
      _charge.charge_name,
      _charge.charge_type,
      _charge_amount,
      _charge.notes
    );
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


-- Function to update unit status when lease changes
CREATE OR REPLACE FUNCTION update_unit_status_on_lease_change()
RETURNS TRIGGER AS $$
DECLARE
  active_leases_count INTEGER;
BEGIN
  -- Count active leases for this unit
  SELECT COUNT(*) INTO active_leases_count
  FROM leases
  WHERE unit_id = NEW.unit_id
  AND status = 'active';

  -- Update unit status
  IF active_leases_count > 0 THEN
    UPDATE units SET status = 'occupied', updated_at = NOW() WHERE id = NEW.unit_id;
  ELSE
    UPDATE units SET status = 'vacant', updated_at = NOW() WHERE id = NEW.unit_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for lease changes
CREATE TRIGGER trigger_update_unit_on_lease
  AFTER INSERT OR UPDATE OF status ON leases
  FOR EACH ROW
  EXECUTE FUNCTION update_unit_status_on_lease_change();

CREATE TRIGGER trigger_refresh_invoice_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION refresh_invoice_payment_status_trigger();

-- Function to prevent overlapping active leases
CREATE OR REPLACE FUNCTION check_overlapping_leases()
RETURNS TRIGGER AS $$
DECLARE
  overlapping_count INTEGER;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT COUNT(*) INTO overlapping_count
    FROM leases
    WHERE unit_id = NEW.unit_id
    AND status = 'active'
    AND id != NEW.id
    AND (start_date, end_date) OVERLAPS (NEW.start_date, NEW.end_date);

    IF overlapping_count > 0 THEN
      RAISE EXCEPTION 'Overlapping active lease exists for this unit';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check overlapping leases
CREATE TRIGGER trigger_check_overlapping_leases
  BEFORE INSERT OR UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION check_overlapping_leases();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_property_sections_updated_at BEFORE UPDATE ON property_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON leases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_charges_updated_at BEFORE UPDATE ON charges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rent_invoices_updated_at BEFORE UPDATE ON rent_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_meter_readings ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Properties: Users can only access their own properties
CREATE POLICY "Users can view own properties" ON properties
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Tenant users can view linked properties" ON properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN tenants t ON t.id = l.tenant_id
      WHERE l.property_id = properties.id
        AND lower(t.email) = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Users can insert own properties" ON properties
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own properties" ON properties
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own properties" ON properties
  FOR DELETE USING (auth.uid() = user_id);

-- Property Sections: Users can only access their own sections
CREATE POLICY "Users can view own sections" ON property_sections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sections" ON property_sections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sections" ON property_sections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sections" ON property_sections
  FOR DELETE USING (auth.uid() = user_id);

-- Units: Users can only access their own units
CREATE POLICY "Users can view own units" ON units
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Tenant users can view linked units" ON units
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN tenants t ON t.id = l.tenant_id
      WHERE l.unit_id = units.id
        AND lower(t.email) = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Users can insert own units" ON units
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own units" ON units
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own units" ON units
  FOR DELETE USING (auth.uid() = user_id);

-- Tenants: Users can only access their own tenants
CREATE POLICY "Users can view own tenants" ON tenants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tenants" ON tenants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tenants" ON tenants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tenants" ON tenants
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Tenant users can view linked tenant profile" ON tenants
  FOR SELECT USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Leases: Users can only access their own leases
CREATE POLICY "Users can view own leases" ON leases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Tenant users can view linked leases" ON leases
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tenants t
      WHERE t.id = leases.tenant_id
        AND lower(t.email) = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Users can insert own leases" ON leases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leases" ON leases
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leases" ON leases
  FOR DELETE USING (auth.uid() = user_id);

-- Charges: Users can only access their own charges
CREATE POLICY "Users can view own charges" ON charges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own charges" ON charges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own charges" ON charges
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own charges" ON charges
  FOR DELETE USING (auth.uid() = user_id);

-- Rent Invoices: Users can only access their own invoices
CREATE POLICY "Users can view own invoices" ON rent_invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices" ON rent_invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices" ON rent_invoices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices" ON rent_invoices
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Tenant users can view linked invoices" ON rent_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tenants t
      WHERE t.id = rent_invoices.tenant_id
        AND lower(t.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- Invoice Items: Users can only access their own invoice items
CREATE POLICY "Users can view own invoice items" ON invoice_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoice items" ON invoice_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoice items" ON invoice_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoice items" ON invoice_items
  FOR DELETE USING (auth.uid() = user_id);

-- Payments: Users can only access their own payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" ON payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments" ON payments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payments" ON payments
  FOR DELETE USING (auth.uid() = user_id);

-- Expenses: Users can only access their own expenses
CREATE POLICY "Users can view own expenses" ON expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses" ON expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses" ON expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" ON expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Documents: Users can only access their own documents
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- Utility meter readings: Users can only access their own readings
CREATE POLICY "Users can view own utility meter readings" ON utility_meter_readings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own utility meter readings" ON utility_meter_readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own utility meter readings" ON utility_meter_readings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own utility meter readings" ON utility_meter_readings
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket and policies for private document files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  FALSE,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Users can view own document files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Users can upload own document files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Users can update own document files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  ) WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Users can delete own document files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
