-- Tenant-level withholding tax controls.
-- Rent WHT defaults to 10%; service charge WHT defaults to 5%.
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS rent_withholding_tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS service_charge_withholding_tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rent_withholding_tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS service_charge_withholding_tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 5;

