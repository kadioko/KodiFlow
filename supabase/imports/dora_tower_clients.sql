-- Dora Tower import for doratower2020@gmail.com.
-- Run this after the user account exists and after all app migrations are applied.
--
-- Amount notes:
-- - For leases described as 3-month/6-month paid periods, this script stores monthly
--   rent/service charge on the lease by dividing the period totals by the number of months.
-- - It also creates one paid invoice and one payment for the full period amount.
-- - Tenants without rent/date details are created with their units, but no lease is created yet.
-- - Withholding tax toggles default to off because the tenant-specific WHT list was not provided.

DO $$
DECLARE
  v_user_id UUID;
  v_property_id UUID;
  v_section_id UUID;
  v_tenant_id UUID;
  v_unit_id UUID;
  v_lease_id UUID;
  v_invoice_id UUID;
  v_unit_name TEXT;
  v_invoice_number TEXT;
  r RECORD;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower('doratower2020@gmail.com')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User doratower2020@gmail.com was not found in auth.users';
  END IF;

  SELECT id INTO v_property_id
  FROM public.properties
  WHERE user_id = v_user_id AND lower(name) = lower('Dora Tower')
  LIMIT 1;

  IF v_property_id IS NULL THEN
    INSERT INTO public.properties (user_id, name, property_type, location, description)
    VALUES (v_user_id, 'Dora Tower', 'commercial', 'Dar es Salaam', 'Imported Dora Tower tenant and unit records')
    RETURNING id INTO v_property_id;
  END IF;

  CREATE TEMP TABLE tmp_dora_sections (
    name TEXT PRIMARY KEY,
    section_type TEXT
  ) ON COMMIT DROP;

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
  SELECT v_user_id, v_property_id, name, section_type
  FROM tmp_dora_sections s
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.property_sections ps
    WHERE ps.user_id = v_user_id
      AND ps.property_id = v_property_id
      AND lower(ps.name) = lower(s.name)
  );

  CREATE TEMP TABLE tmp_dora_units (
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
  ) ON COMMIT DROP;

  INSERT INTO tmp_dora_units
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

  FOR r IN SELECT * FROM tmp_dora_units LOOP
    SELECT id INTO v_section_id
    FROM public.property_sections
    WHERE user_id = v_user_id
      AND property_id = v_property_id
      AND lower(name) = lower(r.floor_name)
    LIMIT 1;

    v_tenant_id := NULL;
    IF r.tenant_name IS NOT NULL THEN
      SELECT id INTO v_tenant_id
      FROM public.tenants
      WHERE user_id = v_user_id
        AND lower(coalesce(business_name, full_name, '')) = lower(r.tenant_name)
      LIMIT 1;

      IF v_tenant_id IS NULL THEN
        INSERT INTO public.tenants (
          user_id,
          tenant_type,
          business_name,
          phone,
          notes,
          rent_withholding_tax_enabled,
          service_charge_withholding_tax_enabled
        )
        VALUES (
          v_user_id,
          'business',
          r.tenant_name,
          'Not provided',
          'Imported from Dora Tower client list',
          FALSE,
          FALSE
        )
        RETURNING id INTO v_tenant_id;
      END IF;
    END IF;

    v_unit_name := coalesce(r.tenant_name, 'Vacant Unit') ||
      CASE WHEN r.unit_identifier IS NOT NULL THEN ' ' || r.unit_identifier ELSE '' END;

    SELECT id INTO v_unit_id
    FROM public.units
    WHERE user_id = v_user_id
      AND property_id = v_property_id
      AND (
        (r.unit_identifier IS NOT NULL AND lower(unit_identifier) = lower(r.unit_identifier))
        OR (r.unit_identifier IS NULL AND lower(unit_name) = lower(v_unit_name))
      )
    LIMIT 1;

    IF v_unit_id IS NULL THEN
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
      VALUES (
        v_user_id,
        v_property_id,
        v_section_id,
        v_unit_name,
        r.unit_identifier,
        'office',
        'commercial',
        coalesce(r.period_rent / nullif(r.period_months, 0), 0),
        r.size_sqm,
        'sqm',
        r.status,
        'Imported from Dora Tower client list'
      )
      RETURNING id INTO v_unit_id;
    ELSE
      UPDATE public.units
      SET
        section_id = v_section_id,
        unit_name = v_unit_name,
        unit_identifier = r.unit_identifier,
        size = r.size_sqm,
        size_unit = 'sqm',
        status = r.status,
        monthly_rent = coalesce(r.period_rent / nullif(r.period_months, 0), monthly_rent),
        updated_at = now()
      WHERE id = v_unit_id AND user_id = v_user_id;
    END IF;

    IF v_tenant_id IS NOT NULL AND r.period_start IS NOT NULL THEN
      SELECT id INTO v_lease_id
      FROM public.leases
      WHERE user_id = v_user_id
        AND tenant_id = v_tenant_id
        AND unit_id = v_unit_id
        AND start_date = r.period_start
        AND end_date = r.period_end
      LIMIT 1;

      IF v_lease_id IS NULL THEN
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
        VALUES (
          v_user_id,
          v_tenant_id,
          v_unit_id,
          v_property_id,
          r.period_start,
          r.period_end,
          r.period_rent / r.period_months,
          0,
          1,
          'commercial',
          CASE WHEN r.period_months = 6 THEN 'semi_annually' ELSE 'quarterly' END,
          'active',
          'Imported paid lease from Dora Tower client list'
        )
        RETURNING id INTO v_lease_id;
      END IF;

      IF coalesce(r.period_service_charge, 0) > 0 THEN
        INSERT INTO public.charges (user_id, lease_id, charge_name, charge_type, amount, frequency, is_active, notes)
        SELECT
          v_user_id,
          v_lease_id,
          'Service Charge',
          'service_charge',
          r.period_service_charge / r.period_months,
          'monthly',
          TRUE,
          'Imported service charge'
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.charges
          WHERE user_id = v_user_id
            AND lease_id = v_lease_id
            AND charge_type = 'service_charge'
            AND is_active = TRUE
        );
      END IF;

      IF r.paid THEN
        SELECT id INTO v_invoice_id
        FROM public.rent_invoices
        WHERE user_id = v_user_id
          AND lease_id = v_lease_id
          AND billing_period_start = r.period_start
          AND billing_period_end = r.period_end
        LIMIT 1;

        IF v_invoice_id IS NULL THEN
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
            v_user_id,
            v_lease_id,
            v_tenant_id,
            v_unit_id,
            v_property_id,
            r.period_start,
            r.period_end,
            extract(month from r.period_start)::INTEGER,
            extract(year from r.period_start)::INTEGER,
            coalesce(r.period_rent, 0) + coalesce(r.period_service_charge, 0),
            r.period_start,
            'unpaid'
          )
          RETURNING id, invoice_number INTO v_invoice_id, v_invoice_number;

          INSERT INTO public.invoice_items (user_id, invoice_id, item_name, item_type, amount)
          VALUES
            (v_user_id, v_invoice_id, 'Base Rent', 'rent', coalesce(r.period_rent, 0)),
            (v_user_id, v_invoice_id, 'Service Charge', 'service_charge', coalesce(r.period_service_charge, 0));

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
          VALUES (
            v_user_id,
            v_invoice_id,
            v_tenant_id,
            v_lease_id,
            v_property_id,
            v_unit_id,
            coalesce(r.period_rent, 0) + coalesce(r.period_service_charge, 0),
            r.period_end,
            'bank',
            'Imported paid period',
            'Imported from Dora Tower client list'
          );

          PERFORM public.refresh_invoice_payment_status(v_invoice_id);
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;
