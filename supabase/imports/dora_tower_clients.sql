-- Dora Tower import for doratower2020@gmail.com.
-- Run the whole script in Supabase SQL Editor after the user exists and migrations are applied.
-- This version is plain SQL: no IF, no LOOP, no DO block.

BEGIN;

DROP TABLE IF EXISTS tmp_dora_user;
DROP TABLE IF EXISTS tmp_dora_property;
DROP TABLE IF EXISTS tmp_dora_sections;
DROP TABLE IF EXISTS tmp_dora_rows;
DROP TABLE IF EXISTS tmp_dora_bound;

CREATE TEMP TABLE tmp_dora_user AS
SELECT id AS user_id
FROM auth.users
WHERE lower(email) = lower('doratower2020@gmail.com')
LIMIT 1;

INSERT INTO public.properties (user_id, name, property_type, location, description)
SELECT user_id, 'Dora Tower', 'commercial', 'Dar es Salaam', 'Imported Dora Tower tenant and unit records'
FROM tmp_dora_user u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.properties p
  WHERE p.user_id = u.user_id AND lower(p.name) = lower('Dora Tower')
);

CREATE TEMP TABLE tmp_dora_property AS
SELECT u.user_id, p.id AS property_id
FROM tmp_dora_user u
JOIN public.properties p
  ON p.user_id = u.user_id
 AND lower(p.name) = lower('Dora Tower');

CREATE TEMP TABLE tmp_dora_sections (
  name TEXT PRIMARY KEY,
  section_type TEXT
);

INSERT INTO tmp_dora_sections (name, section_type)
VALUES
  ('Basement', 'floor'),
  ('Ground Floor', 'floor'),
  ('First Floor', 'floor'),
  ('Second Floor', 'floor'),
  ('Third Floor', 'floor'),
  ('Fourth Floor', 'floor'),
  ('Fifth Floor', 'floor');

INSERT INTO public.property_sections (user_id, property_id, name, section_type)
SELECT p.user_id, p.property_id, s.name, s.section_type
FROM tmp_dora_property p
CROSS JOIN tmp_dora_sections s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.property_sections ps
  WHERE ps.user_id = p.user_id
    AND ps.property_id = p.property_id
    AND lower(ps.name) = lower(s.name)
);

CREATE TEMP TABLE tmp_dora_rows (
  floor_name TEXT,
  tenant_name TEXT,
  unit_identifier TEXT,
  size_sqm NUMERIC,
  status TEXT,
  period_start DATE,
  period_end DATE,
  period_months NUMERIC,
  period_rent NUMERIC,
  period_service_charge NUMERIC,
  paid BOOLEAN
);

INSERT INTO tmp_dora_rows
  (floor_name, tenant_name, unit_identifier, size_sqm, status, period_start, period_end, period_months, period_rent, period_service_charge, paid)
VALUES
  ('Basement', 'Azudu', NULL, NULL, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Basement', 'Twilight', 'B3', 40, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Basement', 'Neo Life 3', 'B4', 35, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Basement', 'Seba', 'B1', 35, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Basement', NULL, 'B2', NULL, 'vacant', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Ground Floor', 'Ndiba Stores', 'G1', 14, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Ground Floor', NULL, 'G2', NULL, 'vacant', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Ground Floor', NULL, 'G3', NULL, 'vacant', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('First Floor', 'PowerHouse', '11', 80, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('First Floor', 'Caperone', '14', 40, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('First Floor', 'Arm City', '23', 36, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('First Floor', 'EverMark', '12', 42, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Second Floor', 'PhytoScience', '21', 80, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Second Floor', 'Fahari Motors', '22', 42, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Second Floor', 'Flora', '23', 36, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Third Floor', 'Codd Zoss', '39', 56, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Third Floor', 'Vintech', '37', 24, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Third Floor', 'Heritage', '34', 18, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Third Floor', 'NBE', '33', 13, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Third Floor', 'Extra Solutions', '31', 13, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Third Floor', 'Godfrey Binamu', '32', 13, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Third Floor', 'Montatina', '36', 18, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Fourth Floor', 'Akiba', NULL, 104, 'occupied', '2026-04-01', '2026-06-30', 3, 1361360, 583440, TRUE),
  ('Fourth Floor', 'Royal', NULL, NULL, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Fourth Floor', 'Perfect Property', NULL, NULL, 'occupied', NULL, NULL, NULL, NULL, NULL, FALSE),
  ('Fifth Floor', 'Stamara', '51', 40, 'occupied', '2026-04-01', '2026-06-30', 3, 616000, 264000, TRUE),
  ('Fifth Floor', 'Oasis', '52', 60, 'occupied', '2026-04-01', '2026-06-30', 3, 770000, 230000, TRUE),
  ('Fifth Floor', 'Neo Life 2', '53', 24, 'occupied', '2026-04-01', '2026-06-30', 3, 350000, 150000, TRUE),
  ('Fifth Floor', 'Sigara', '55', 40, 'occupied', '2025-12-01', '2026-05-30', 6, 700000, 300000, TRUE),
  ('Fifth Floor', 'Economic Diplomacy', '54', 54, 'occupied', '2025-12-01', '2026-05-30', 6, 945000, 405000, TRUE);

INSERT INTO public.tenants (
  user_id,
  tenant_type,
  business_name,
  phone,
  notes,
  rent_withholding_tax_enabled,
  service_charge_withholding_tax_enabled
)
SELECT DISTINCT
  p.user_id,
  'business',
  r.tenant_name,
  'Not provided',
  'Imported from Dora Tower client list',
  FALSE,
  FALSE
FROM tmp_dora_rows r
CROSS JOIN tmp_dora_property p
WHERE r.tenant_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.user_id = p.user_id
      AND lower(coalesce(t.business_name, t.full_name, '')) = lower(r.tenant_name)
  );

CREATE TEMP TABLE tmp_dora_bound AS
SELECT
  p.user_id,
  p.property_id,
  ps.id AS section_id,
  t.id AS tenant_id,
  r.*,
  coalesce(r.tenant_name, 'Vacant Unit') ||
    CASE WHEN r.unit_identifier IS NOT NULL THEN ' ' || r.unit_identifier ELSE '' END AS unit_name,
  coalesce(r.period_rent / nullif(r.period_months, 0), 0) AS monthly_rent,
  coalesce(r.period_service_charge / nullif(r.period_months, 0), 0) AS monthly_service_charge
FROM tmp_dora_rows r
CROSS JOIN tmp_dora_property p
JOIN public.property_sections ps
  ON ps.user_id = p.user_id
 AND ps.property_id = p.property_id
 AND lower(ps.name) = lower(r.floor_name)
LEFT JOIN public.tenants t
  ON t.user_id = p.user_id
 AND lower(coalesce(t.business_name, t.full_name, '')) = lower(r.tenant_name);

INSERT INTO public.units (
  user_id,
  property_id,
  section_id,
  unit_name,
  unit_identifier,
  unit_type,
  usage_type,
  monthly_rent,
  size,
  size_unit,
  status,
  notes
)
SELECT
  b.user_id,
  b.property_id,
  b.section_id,
  b.unit_name,
  b.unit_identifier,
  'office',
  'commercial',
  b.monthly_rent,
  b.size_sqm,
  'sqm',
  b.status,
  'Imported from Dora Tower client list'
FROM tmp_dora_bound b
WHERE NOT EXISTS (
  SELECT 1
  FROM public.units u
  WHERE u.user_id = b.user_id
    AND u.property_id = b.property_id
    AND u.section_id = b.section_id
    AND (
      (b.unit_identifier IS NOT NULL AND lower(u.unit_identifier) = lower(b.unit_identifier))
      OR (b.unit_identifier IS NULL AND lower(u.unit_name) = lower(b.unit_name))
    )
);

UPDATE public.units u
SET
  unit_name = b.unit_name,
  unit_identifier = b.unit_identifier,
  size = b.size_sqm,
  size_unit = 'sqm',
  status = b.status,
  monthly_rent = CASE WHEN b.monthly_rent > 0 THEN b.monthly_rent ELSE u.monthly_rent END,
  updated_at = now()
FROM tmp_dora_bound b
WHERE u.user_id = b.user_id
  AND u.property_id = b.property_id
  AND u.section_id = b.section_id
  AND (
    (b.unit_identifier IS NOT NULL AND lower(u.unit_identifier) = lower(b.unit_identifier))
    OR (b.unit_identifier IS NULL AND lower(u.unit_name) = lower(b.unit_name))
  );

DROP TABLE IF EXISTS tmp_dora_bound;

CREATE TEMP TABLE tmp_dora_bound AS
SELECT
  p.user_id,
  p.property_id,
  ps.id AS section_id,
  t.id AS tenant_id,
  u.id AS unit_id,
  r.*,
  coalesce(r.period_rent / nullif(r.period_months, 0), 0) AS monthly_rent,
  coalesce(r.period_service_charge / nullif(r.period_months, 0), 0) AS monthly_service_charge
FROM tmp_dora_rows r
CROSS JOIN tmp_dora_property p
JOIN public.property_sections ps
  ON ps.user_id = p.user_id
 AND ps.property_id = p.property_id
 AND lower(ps.name) = lower(r.floor_name)
LEFT JOIN public.tenants t
  ON t.user_id = p.user_id
 AND lower(coalesce(t.business_name, t.full_name, '')) = lower(r.tenant_name)
JOIN public.units u
  ON u.user_id = p.user_id
 AND u.property_id = p.property_id
 AND u.section_id = ps.id
 AND (
   (r.unit_identifier IS NOT NULL AND lower(u.unit_identifier) = lower(r.unit_identifier))
   OR (
     r.unit_identifier IS NULL
     AND lower(u.unit_name) = lower(coalesce(r.tenant_name, 'Vacant Unit'))
   )
 );

INSERT INTO public.leases (
  user_id,
  tenant_id,
  unit_id,
  property_id,
  start_date,
  end_date,
  monthly_rent,
  deposit_amount,
  rent_due_day,
  lease_type,
  billing_frequency,
  status,
  notes
)
SELECT
  b.user_id,
  b.tenant_id,
  b.unit_id,
  b.property_id,
  b.period_start,
  b.period_end,
  b.monthly_rent,
  0,
  1,
  'commercial',
  CASE WHEN b.period_months = 6 THEN 'semi_annually' ELSE 'quarterly' END,
  'active',
  'Imported paid lease from Dora Tower client list'
FROM tmp_dora_bound b
WHERE b.tenant_id IS NOT NULL
  AND b.period_start IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.leases l
    WHERE l.user_id = b.user_id
      AND l.tenant_id = b.tenant_id
      AND l.unit_id = b.unit_id
      AND l.start_date = b.period_start
      AND l.end_date = b.period_end
  );

INSERT INTO public.charges (user_id, lease_id, charge_name, charge_type, amount, frequency, is_active, notes)
SELECT
  b.user_id,
  l.id,
  'Service Charge',
  'service_charge',
  b.monthly_service_charge,
  'monthly',
  TRUE,
  'Imported service charge'
FROM tmp_dora_bound b
JOIN public.leases l
  ON l.user_id = b.user_id
 AND l.tenant_id = b.tenant_id
 AND l.unit_id = b.unit_id
 AND l.start_date = b.period_start
 AND l.end_date = b.period_end
WHERE b.monthly_service_charge > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.charges c
    WHERE c.user_id = b.user_id
      AND c.lease_id = l.id
      AND c.charge_type = 'service_charge'
      AND c.is_active = TRUE
  );

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
SELECT
  b.user_id,
  l.id,
  b.tenant_id,
  b.unit_id,
  b.property_id,
  b.period_start,
  b.period_end,
  extract(month from b.period_start)::INTEGER,
  extract(year from b.period_start)::INTEGER,
  coalesce(b.period_rent, 0) + coalesce(b.period_service_charge, 0),
  b.period_start,
  'unpaid'
FROM tmp_dora_bound b
JOIN public.leases l
  ON l.user_id = b.user_id
 AND l.tenant_id = b.tenant_id
 AND l.unit_id = b.unit_id
 AND l.start_date = b.period_start
 AND l.end_date = b.period_end
WHERE b.paid = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.rent_invoices i
    WHERE i.user_id = b.user_id
      AND i.lease_id = l.id
      AND i.billing_period_start = b.period_start
      AND i.billing_period_end = b.period_end
  );

INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount)
SELECT b.user_id, i.id, 'Base Rent', 'rent', coalesce(b.period_rent, 0)
FROM tmp_dora_bound b
JOIN public.leases l
  ON l.user_id = b.user_id
 AND l.tenant_id = b.tenant_id
 AND l.unit_id = b.unit_id
 AND l.start_date = b.period_start
 AND l.end_date = b.period_end
JOIN public.rent_invoices i
  ON i.user_id = b.user_id
 AND i.lease_id = l.id
 AND i.billing_period_start = b.period_start
 AND i.billing_period_end = b.period_end
WHERE b.paid = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_items ii WHERE ii.user_id = b.user_id AND ii.invoice_id = i.id AND ii.item_type = 'rent'
  );

INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount)
SELECT b.user_id, i.id, 'Service Charge', 'service_charge', coalesce(b.period_service_charge, 0)
FROM tmp_dora_bound b
JOIN public.leases l
  ON l.user_id = b.user_id
 AND l.tenant_id = b.tenant_id
 AND l.unit_id = b.unit_id
 AND l.start_date = b.period_start
 AND l.end_date = b.period_end
JOIN public.rent_invoices i
  ON i.user_id = b.user_id
 AND i.lease_id = l.id
 AND i.billing_period_start = b.period_start
 AND i.billing_period_end = b.period_end
WHERE b.paid = TRUE
  AND coalesce(b.period_service_charge, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_items ii WHERE ii.user_id = b.user_id AND ii.invoice_id = i.id AND ii.item_type = 'service_charge'
  );

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
  notes
)
SELECT
  b.user_id,
  i.id,
  b.tenant_id,
  l.id,
  b.property_id,
  b.unit_id,
  coalesce(b.period_rent, 0) + coalesce(b.period_service_charge, 0),
  b.period_end,
  'bank',
  'Imported paid period',
  'Imported from Dora Tower client list'
FROM tmp_dora_bound b
JOIN public.leases l
  ON l.user_id = b.user_id
 AND l.tenant_id = b.tenant_id
 AND l.unit_id = b.unit_id
 AND l.start_date = b.period_start
 AND l.end_date = b.period_end
JOIN public.rent_invoices i
  ON i.user_id = b.user_id
 AND i.lease_id = l.id
 AND i.billing_period_start = b.period_start
 AND i.billing_period_end = b.period_end
WHERE b.paid = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p WHERE p.user_id = b.user_id AND p.invoice_id = i.id AND p.reference = 'Imported paid period'
  );

UPDATE public.rent_invoices i
SET
  amount_paid = paid_totals.amount_paid,
  status = CASE
    WHEN paid_totals.amount_paid >= i.subtotal THEN 'paid'
    WHEN paid_totals.amount_paid > 0 THEN 'partially_paid'
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'unpaid'
  END,
  updated_at = now()
FROM (
  SELECT invoice_id, coalesce(sum(amount), 0) AS amount_paid
  FROM public.payments
  GROUP BY invoice_id
) paid_totals
JOIN tmp_dora_bound b
  ON b.paid = TRUE
WHERE i.id = paid_totals.invoice_id
  AND i.user_id = b.user_id
  AND i.billing_period_start = b.period_start
  AND i.billing_period_end = b.period_end;

COMMIT;
