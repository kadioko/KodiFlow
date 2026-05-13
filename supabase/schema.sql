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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0) INTO NEW.amount_paid
  FROM payments
  WHERE invoice_id = NEW.id;

  -- Update status based on payment and due date
  IF NEW.amount_paid >= NEW.subtotal THEN
    NEW.status = 'paid';
  ELSIF NEW.amount_paid > 0 THEN
    NEW.status = 'partially_paid';
  ELSIF NEW.due_date < CURRENT_DATE THEN
    NEW.status = 'overdue';
  ELSE
    NEW.status = 'unpaid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Leases: Users can only access their own leases
CREATE POLICY "Users can view own leases" ON leases
  FOR SELECT USING (auth.uid() = user_id);

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
