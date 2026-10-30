BEGIN;

CREATE TEMP TABLE dora_import_start (
  unit_identifier TEXT PRIMARY KEY,
  source_label TEXT NOT NULL,
  initial_meter_reading NUMERIC(14, 3) NOT NULL,
  opening_balance_units NUMERIC(14, 3) NOT NULL
) ON COMMIT DROP;

INSERT INTO dora_import_start VALUES
  ('B1', 'Seba', 15250.8, 2.9),
  ('B2', 'VSS', 2172.8, 99.5),
  ('B3', 'Twilight', 2511.1, 78.5),
  ('B4', 'Neo life 3', 2104.5, 9.0),
  ('B5', 'Azudu', 1860.9, 0.1),
  ('11', 'PowerHouse', 3296.8, 10.1),
  ('12', 'EverMark', 12080.2, 85.1),
  ('13', 'Arm City', 4742.1, 19.0),
  ('14', 'Caperone', 3216.3, 211.4),
  ('31', 'Extra Solutions', 4893.7, 12.7),
  ('32', 'Godfrey Binamu', 2741.4, 10.3),
  ('33', 'NBE Consulting', 1138.7, 56.6),
  ('34', 'Heritage', 1409.1, 147.0),
  ('35', 'Freshway Developers', 589.9, 106.4),
  ('36', 'Montatina', 2039.7, 124.7),
  ('37', 'Vintech', 6335.1, 41.9),
  ('38', 'Elite Aces', 2976.4, 40.3),
  ('G1', 'Ndiba Stores', 160.3, 252.6),
  ('52', 'Economic Diplomacy', 1161.7, 6.8),
  ('23', 'BUTA (Flora)', 8180.5, 26.7),
  ('24', 'HNK Company Limited', 4271.7, 124.6),
  ('51', 'Sigalla', 4724.2, 65.6),
  ('55', 'Stamara', 2660.2, 494.6);

CREATE TEMP TABLE dora_import_new_accounts (
  unit_identifier TEXT PRIMARY KEY,
  current_tenant_name TEXT NOT NULL,
  ledger_tenant_label TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO dora_import_new_accounts VALUES
  ('23', 'Flora', 'BUTA (Flora)'),
  ('24', 'HNK Company Limited', 'HNK Company Limited'),
  ('33', 'NBE', 'NBE Consulting'),
  ('51', 'Stamara', 'Sigalla'),
  ('55', 'Sigara', 'Stamara'),
  ('52', 'Oasis', 'Economic Diplomacy'),
  ('54', 'Economic Diplomacy', 'Oasis');

DO $create_missing_accounts$
DECLARE
  v_property_id UUID;
  v_owner_id UUID;
  v_missing TEXT;
BEGIN
  SELECT p.id, p.user_id INTO v_property_id, v_owner_id
  FROM public.properties p
  WHERE p.id = '85246880-a4ba-4e4b-8118-208b68ed28d4'::UUID
    AND lower(btrim(p.name)) = 'dora tower';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dora Tower property was not found; no electricity records were imported';
  END IF;

  SELECT string_agg(source.unit_identifier, ', ' ORDER BY source.unit_identifier)
  INTO v_missing
  FROM dora_import_new_accounts source
  LEFT JOIN public.units u
    ON u.property_id = v_property_id
   AND btrim(u.unit_identifier) = source.unit_identifier
  LEFT JOIN public.tenants t
    ON t.user_id = v_owner_id
   AND lower(btrim(COALESCE(NULLIF(t.business_name, ''), t.full_name, ''))) = lower(source.current_tenant_name)
  WHERE u.id IS NULL OR t.id IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Could not safely map Dora Tower units/tenants for electricity rows: %', v_missing;
  END IF;

  INSERT INTO public.electricity_accounts (
    owner_user_id, property_id, meter_kind, unit_id, tenant_id, floor_label,
    ledger_tenant_label, initial_meter_reading, initial_reading_date,
    opening_balance_units, low_units_threshold, created_by
  )
  SELECT
    v_owner_id, v_property_id, 'submeter', u.id, t.id,
    COALESCE(section.name, 'Unassigned floor'), source.ledger_tenant_label,
    start.initial_meter_reading, DATE '2026-10-18', start.opening_balance_units,
    10, v_owner_id
  FROM dora_import_new_accounts source
  JOIN dora_import_start start USING (unit_identifier)
  JOIN public.units u
    ON u.property_id = v_property_id
   AND btrim(u.unit_identifier) = source.unit_identifier
  JOIN public.tenants t
    ON t.user_id = v_owner_id
   AND lower(btrim(COALESCE(NULLIF(t.business_name, ''), t.full_name, ''))) = lower(source.current_tenant_name)
  LEFT JOIN public.property_sections section
    ON section.id = u.section_id
   AND section.property_id = v_property_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.electricity_accounts existing
    WHERE existing.unit_id = u.id
      AND existing.meter_kind = 'submeter'
      AND existing.active
  );

  UPDATE public.electricity_accounts account
  SET ledger_tenant_label = source.ledger_tenant_label,
      updated_at = now()
  FROM dora_import_new_accounts source
  JOIN public.units u
    ON u.property_id = v_property_id
   AND btrim(u.unit_identifier) = source.unit_identifier
  WHERE account.unit_id = u.id
    AND account.property_id = v_property_id
    AND account.meter_kind = 'submeter'
    AND account.active;
END;
$create_missing_accounts$;

CREATE TEMP TABLE dora_import_readings (
  unit_identifier TEXT NOT NULL,
  reading_date DATE NOT NULL,
  source_label TEXT NOT NULL,
  previous_meter_reading NUMERIC(14, 3) NOT NULL,
  current_meter_reading NUMERIC(14, 3) NOT NULL,
  PRIMARY KEY (unit_identifier, reading_date)
) ON COMMIT DROP;

INSERT INTO dora_import_readings VALUES
  ('B1', '2026-10-19', 'Seba', 15250.8, 15295.9),
  ('B2', '2026-10-19', 'VSS', 2172.8, 2184.8),
  ('B3', '2026-10-19', 'Twilight', 2511.1, 2524.8),
  ('B4', '2026-10-19', 'Neo life 3', 2104.5, 2115.3),
  ('B5', '2026-10-19', 'Azudu', 1860.9, 1862.3),
  ('11', '2026-10-19', 'PowerHouse', 3296.8, 3297.6),
  ('12', '2026-10-19', 'EverMark', 12080.2, 12099.2),
  ('13', '2026-10-19', 'Arm City', 4742.1, 4745.2),
  ('14', '2026-10-19', 'Caperone', 3216.3, 3222.9),
  ('31', '2026-10-19', 'Extra Solutions', 4893.7, 4893.9),
  ('32', '2026-10-19', 'Godfrey Binamu', 2741.4, 2747.4),
  ('33', '2026-10-19', 'NBE Consulting', 1138.7, 1141.3),
  ('34', '2026-10-19', 'Heritage', 1409.1, 1422.2),
  ('35', '2026-10-19', 'Freshway Developers', 589.9, 598.7),
  ('36', '2026-10-19', 'Montatina', 2039.7, 2039.8),
  ('37', '2026-10-19', 'Vintech', 6335.1, 6337.0),
  ('38', '2026-10-19', 'Elite Aces', 2976.4, 2990.1),
  ('G1', '2026-10-19', 'Ndiba Stores', 160.3, 166.4),
  ('52', '2026-10-19', 'Economic Diplomacy', 1161.7, 1173.6),
  ('23', '2026-10-19', 'BUTA (Flora)', 8180.5, 8196.3),
  ('24', '2026-10-19', 'HNK Company Limited', 4271.7, 4289.4),
  ('51', '2026-10-19', 'Sigalla', 4724.2, 4743.1),
  ('55', '2026-10-19', 'Stamara', 2660.2, 2694.0),
  ('G1', '2026-10-20', 'Ndiba Stores', 166.4, 170.6),
  ('52', '2026-10-20', 'Economic Diplomacy', 1173.6, 1175.3),
  ('23', '2026-10-20', 'BUTA (Flora)', 8196.3, 8214.1),
  ('24', '2026-10-20', 'HNK Company Limited', 4289.4, 4315.5),
  ('51', '2026-10-20', 'Sigalla', 4743.1, 4763.1),
  ('55', '2026-10-20', 'Stamara', 2694.0, 2750.4),
  ('B1', '2026-10-22', 'Seba', 15295.9, 15339.9),
  ('B2', '2026-10-22', 'VSS', 2184.8, 2197.7),
  ('B3', '2026-10-22', 'Twilight', 2524.8, 2540.9),
  ('B4', '2026-10-22', 'Neo life 3', 2115.3, 2125.9),
  ('B5', '2026-10-22', 'Azudu', 1862.3, 1862.3),
  ('11', '2026-10-22', 'PowerHouse', 3297.6, 3298.3),
  ('12', '2026-10-22', 'EverMark', 12099.2, 12116.4),
  ('13', '2026-10-22', 'Arm City', 4745.2, 4750.5),
  ('14', '2026-10-22', 'Caperone', 3222.9, 3251.0),
  ('31', '2026-10-22', 'Extra Solutions', 4893.9, 4894.8),
  ('32', '2026-10-22', 'Godfrey Binamu', 2747.4, 2753.2),
  ('33', '2026-10-22', 'NBE Consulting', 1141.3, 1143.1),
  ('34', '2026-10-22', 'Heritage', 1422.2, 1432.3),
  ('35', '2026-10-22', 'Freshway Developers', 598.7, 609.8),
  ('36', '2026-10-22', 'Montatina', 2039.8, 2040.0),
  ('37', '2026-10-22', 'Vintech', 6337.0, 6339.4),
  ('38', '2026-10-22', 'Elite Aces', 2990.1, 3004.2),
  ('G1', '2026-10-22', 'Ndiba Stores', 170.6, 175.5),
  ('52', '2026-10-22', 'Economic Diplomacy', 1175.3, 1178.6),
  ('23', '2026-10-22', 'BUTA (Flora)', 8214.1, 8220.8),
  ('24', '2026-10-22', 'HNK Company Limited', 4315.5, 4341.7),
  ('51', '2026-10-22', 'Sigalla', 4763.1, 4782.5),
  ('55', '2026-10-22', 'Stamara', 2750.4, 2819.2),
  ('B1', '2026-10-25', 'Seba', 15339.9, 15372.9),
  ('B2', '2026-10-25', 'VSS', 2197.7, 2210.7),
  ('B3', '2026-10-25', 'Twilight', 2540.9, 2555.7),
  ('B4', '2026-10-25', 'Neo life 3', 2125.9, 2131.7),
  ('B5', '2026-10-25', 'Azudu', 1862.3, 1865.0),
  ('11', '2026-10-25', 'PowerHouse', 3298.3, 3299.0),
  ('12', '2026-10-25', 'EverMark', 12116.4, 12130.6),
  ('13', '2026-10-25', 'Arm City', 4750.5, 4753.8),
  ('14', '2026-10-25', 'Caperone', 3251.0, 3276.8),
  ('31', '2026-10-25', 'Extra Solutions', 4894.8, 4899.0),
  ('32', '2026-10-25', 'Godfrey Binamu', 2753.2, 2755.0),
  ('33', '2026-10-25', 'NBE Consulting', 1143.1, 1143.1),
  ('34', '2026-10-25', 'Heritage', 1432.3, 1441.2),
  ('35', '2026-10-25', 'Freshway Developers', 609.8, 617.5),
  ('36', '2026-10-25', 'Montatina', 2040.0, 2040.2),
  ('37', '2026-10-25', 'Vintech', 6339.4, 6340.5),
  ('38', '2026-10-25', 'Elite Aces', 3004.2, 3009.2),
  ('23', '2026-10-29', 'BUTA (Flora)', 8220.8, 8233.3),
  ('24', '2026-10-29', 'HNK Company Limited', 4341.7, 4365.3),
  ('51', '2026-10-29', 'Sigalla', 4782.5, 4815.7);

CREATE TEMP TABLE dora_import_topups (
  unit_identifier TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  units NUMERIC(14, 3) NOT NULL,
  verified BOOLEAN NOT NULL,
  source_note TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO dora_import_topups VALUES
  ('B1', '2026-10-22', 140.3, TRUE, 'The 22/10 sheet lists 140.3 kWh purchased.'),
  ('B4', '2026-10-22', 56.1, TRUE, 'The 22/10 sheet lists 56.1 kWh purchased.'),
  ('11', '2026-10-22', 28.0, TRUE, 'The 22/10 token table lists 28.0 kWh for PowerHouse.'),
  ('32', '2026-10-22', 14.0, TRUE, 'The 22/10 sheet lists 14.0 kWh purchased.'),
  ('51', '2026-10-22', 140.3, TRUE, 'The 22/10 token table lists 140.3 kWh for Sigalla.'),
  ('B5', '2026-10-26', 42.1, TRUE, 'The 25/10 sheet token table lists 42.1 kWh purchased on 26/10.'),
  ('38', '2026-10-28', 140.3, TRUE, 'The 25/10 sheet token table lists 140.3 kWh purchased on 28/10.'),
  ('12', '2026-10-30', 140.3, FALSE, 'Reported in the 29/10 sheet token table for purchase on 30/10.'),
  ('54', '2026-10-30', 280.7, FALSE, 'Reported in the 29/10 sheet token table for Oasis, with purchase date 30/10.'),
  ('23', '2026-10-29', 56.1, FALSE, 'Reported in the 29/10 sheet token table for BUTA.');

CREATE TEMP TABLE dora_import_main_balances (
  floor_label TEXT NOT NULL,
  reading_date DATE NOT NULL,
  units_remaining NUMERIC(14, 3) NOT NULL,
  PRIMARY KEY (floor_label, reading_date)
) ON COMMIT DROP;

INSERT INTO dora_import_main_balances VALUES
  ('Basement', '2026-10-19', 304.65),
  ('Ground Floor', '2026-10-19', 110.59),
  ('First Floor', '2026-10-19', 128.88),
  ('Second Floor', '2026-10-19', 318.47),
  ('Third Floor', '2026-10-19', 466.26),
  ('Fourth Floor', '2026-10-19', 471.06),
  ('Fifth Floor', '2026-10-19', 262.97),
  ('B. Hall', '2026-10-19', 121.46),
  ('Basement', '2026-10-22', 410.37),
  ('Ground Floor', '2026-10-22', 36.23),
  ('First Floor', '2026-10-22', 90.46),
  ('Second Floor', '2026-10-22', 257.68),
  ('Third Floor', '2026-10-22', 425.15),
  ('Fourth Floor', '2026-10-22', 338.36),
  ('Fifth Floor', '2026-10-22', 134.52),
  ('B. Hall', '2026-10-22', 117.23),
  ('Basement', '2026-10-25', 336.41),
  ('Ground Floor', '2026-10-25', 225.56),
  ('First Floor', '2026-10-25', 50.37),
  ('Second Floor', '2026-10-25', 87.67),
  ('Third Floor', '2026-10-25', 392.19),
  ('Fourth Floor', '2026-10-25', 135.16),
  ('Fifth Floor', '2026-10-25', 126.03),
  ('B. Hall', '2026-10-25', 112.22),
  ('Basement', '2026-10-29', 281.69),
  ('Ground Floor', '2026-10-29', 147.29),
  ('First Floor', '2026-10-29', 140.30),
  ('Second Floor', '2026-10-29', 39.00),
  ('Third Floor', '2026-10-29', 473.81),
  ('Fourth Floor', '2026-10-29', 801.89),
  ('Fifth Floor', '2026-10-29', 38.89),
  ('B. Hall', '2026-10-29', 108.23);

DO $import_dora_readings$
DECLARE
  v_property_id UUID;
  v_owner_id UUID;
  v_missing TEXT;
  v_row RECORD;
  v_account_id UUID;
  v_previous_reading NUMERIC(14, 3);
  v_count INTEGER;
BEGIN
  SELECT p.id, p.user_id INTO v_property_id, v_owner_id
  FROM public.properties p
  WHERE p.id = '85246880-a4ba-4e4b-8118-208b68ed28d4'::UUID
    AND lower(btrim(p.name)) = 'dora tower';

  SELECT string_agg(missing.unit_identifier, ', ' ORDER BY missing.unit_identifier)
  INTO v_missing
  FROM (
    SELECT source.unit_identifier
    FROM dora_import_start source
    LEFT JOIN public.units u
      ON u.property_id = v_property_id
     AND btrim(u.unit_identifier) = source.unit_identifier
    LEFT JOIN public.electricity_accounts a
      ON a.unit_id = u.id AND a.property_id = v_property_id
     AND a.meter_kind = 'submeter' AND a.active
    GROUP BY source.unit_identifier
    HAVING count(a.id) <> 1
  ) missing;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Expected one active submeter account for each imported unit; unresolved units: %', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM dora_import_start source
    JOIN public.units u ON u.property_id = v_property_id AND btrim(u.unit_identifier) = source.unit_identifier
    JOIN public.electricity_accounts a ON a.unit_id = u.id AND a.active AND a.meter_kind = 'submeter'
    JOIN public.electricity_readings r ON r.account_id = a.id
    WHERE r.reading_date IN (DATE '2026-10-19', DATE '2026-10-20', DATE '2026-10-22', DATE '2026-10-25')
  ) THEN
    RAISE EXCEPTION 'Dora Tower historical import dates already contain readings; no records were changed';
  END IF;

  UPDATE public.electricity_accounts a
  SET initial_meter_reading = source.initial_meter_reading,
      initial_reading_date = DATE '2026-10-18',
      opening_balance_units = source.opening_balance_units,
      updated_at = now()
  FROM dora_import_start source
  JOIN public.units u ON u.property_id = v_property_id AND btrim(u.unit_identifier) = source.unit_identifier
  WHERE a.unit_id = u.id
    AND a.property_id = v_property_id
    AND a.meter_kind = 'submeter'
    AND a.active;

  UPDATE public.electricity_accounts a
  SET initial_meter_reading = 2819.2,
      initial_reading_date = DATE '2026-10-28',
      opening_balance_units = 335.6,
      updated_at = now()
  FROM public.units u
  WHERE a.unit_id = u.id
    AND u.property_id = v_property_id
    AND btrim(u.unit_identifier) = '54'
    AND a.property_id = v_property_id
    AND a.meter_kind = 'submeter'
    AND a.active;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected one active meter 54 (Oasis) to set its paper baseline; found %', v_count;
  END IF;

  UPDATE public.electricity_readings r
  SET previous_meter_reading = 1178.6,
      current_meter_reading = 1181.1,
      notes = concat_ws(' ', r.notes, 'The prior import attached this paper meter row to the wrong unit. Corrected to meter 52, Economic Diplomacy.')
  FROM public.electricity_accounts a
  JOIN public.units u ON u.id = a.unit_id
  WHERE a.id = r.account_id
    AND u.property_id = v_property_id
    AND btrim(u.unit_identifier) = '52'
    AND r.reading_date = DATE '2026-10-29'
    AND r.previous_meter_reading = 2819.2
    AND r.current_meter_reading = 2882.7;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected the original Oasis paper row on meter 52 to correct; found % matching rows', v_count;
  END IF;

  UPDATE public.electricity_readings r
  SET previous_meter_reading = 2819.2,
      current_meter_reading = 2882.7,
      opening_balance_units = 335.6,
      closing_balance_units = 272.1,
      notes = concat_ws(' ', r.notes, 'The prior import attached this paper meter row to the wrong unit. Corrected to meter 54, Oasis.')
  FROM public.electricity_accounts a
  JOIN public.units u ON u.id = a.unit_id
  WHERE a.id = r.account_id
    AND u.property_id = v_property_id
    AND btrim(u.unit_identifier) = '54'
    AND r.reading_date = DATE '2026-10-29'
    AND r.previous_meter_reading = 1178.6
    AND r.current_meter_reading = 1181.1;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected the original Economic Diplomacy paper row on meter 54 to correct; found % matching rows', v_count;
  END IF;

  UPDATE public.electricity_readings r
  SET previous_meter_reading = 12130.6,
      current_meter_reading = 12156.7,
      notes = concat_ws(' ', r.notes, 'Corrected from the clearer 29/10/2026 sheet: meter values include the leading 1.')
  FROM public.electricity_accounts a
  JOIN public.units u ON u.id = a.unit_id
  WHERE a.id = r.account_id
    AND u.property_id = v_property_id
    AND btrim(u.unit_identifier) = '12'
    AND r.reading_date = DATE '2026-10-29'
    AND r.previous_meter_reading = 2130.6
    AND r.current_meter_reading = 2156.7;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected the original EverMark 29/10 reading to correct; found % matching rows', v_count;
  END IF;

  UPDATE public.electricity_readings r
  SET current_meter_reading = 2568.7,
      notes = concat_ws(' ', r.notes, 'Corrected from the clearer 29/10/2026 sheet: Twilight current reading is 2568.7.')
  FROM public.electricity_accounts a
  JOIN public.units u ON u.id = a.unit_id
  WHERE a.id = r.account_id
    AND u.property_id = v_property_id
    AND btrim(u.unit_identifier) = 'B3'
    AND r.reading_date = DATE '2026-10-29'
    AND r.previous_meter_reading = 2555.7
    AND r.current_meter_reading = 2568.9;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected the original Twilight 29/10 reading to correct; found % matching rows', v_count;
  END IF;

  INSERT INTO public.electricity_topups (
    account_id, owner_user_id, purchase_date, units, status, verified_at,
    verified_by, recorded_by, notes
  )
  SELECT
    a.id, v_owner_id, source.purchase_date, source.units,
    CASE WHEN source.verified THEN 'verified' ELSE 'reported' END,
    CASE WHEN source.verified THEN now() ELSE NULL END,
    CASE WHEN source.verified THEN v_owner_id ELSE NULL END,
    v_owner_id,
    concat('Dora Tower paper import: ', source.source_note, ' Full token code not stored.')
  FROM dora_import_topups source
  JOIN public.units u ON u.property_id = v_property_id AND btrim(u.unit_identifier) = source.unit_identifier
  JOIN public.electricity_accounts a ON a.unit_id = u.id AND a.active AND a.meter_kind = 'submeter'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.electricity_topups existing
    WHERE existing.account_id = a.id
      AND existing.purchase_date = source.purchase_date
      AND existing.units = source.units
      AND existing.notes LIKE 'Dora Tower paper import:%'
  );

  INSERT INTO public.electricity_main_meter_balances (
    account_id, owner_user_id, reading_date, units_remaining, notes, recorded_by
  )
  SELECT
    a.id, v_owner_id, source.reading_date, source.units_remaining,
    concat('Imported from the Dora Tower handwritten main-LUKU balance sheet dated ', to_char(source.reading_date, 'DD/MM/YYYY'), '.'),
    v_owner_id
  FROM dora_import_main_balances source
  JOIN public.electricity_accounts a
    ON a.property_id = v_property_id
   AND a.meter_kind = 'floor_main'
   AND a.active
   AND lower(btrim(a.floor_label)) = lower(source.floor_label)
  ON CONFLICT (account_id, reading_date) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', v_owner_id::TEXT, true);

  FOR v_row IN
    SELECT * FROM dora_import_readings ORDER BY reading_date, unit_identifier
  LOOP
    SELECT a.id, COALESCE(previous.current_meter_reading, a.initial_meter_reading)
    INTO v_account_id, v_previous_reading
    FROM public.units u
    JOIN public.electricity_accounts a
      ON a.unit_id = u.id AND a.property_id = v_property_id
     AND a.meter_kind = 'submeter' AND a.active
    LEFT JOIN LATERAL (
      SELECT r.current_meter_reading
      FROM public.electricity_readings r
      WHERE r.account_id = a.id AND r.reading_date < v_row.reading_date
      ORDER BY r.reading_date DESC
      LIMIT 1
    ) previous ON TRUE
    WHERE u.property_id = v_property_id
      AND btrim(u.unit_identifier) = v_row.unit_identifier;

    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'No active submeter account found for Dora Tower unit %', v_row.unit_identifier;
    END IF;
    IF round(v_previous_reading, 3) <> round(v_row.previous_meter_reading, 3) THEN
      RAISE EXCEPTION 'Source previous reading mismatch for Dora Tower unit % on %: expected %, found %',
        v_row.unit_identifier, to_char(v_row.reading_date, 'DD/MM/YYYY'), v_row.previous_meter_reading, v_previous_reading;
    END IF;

    PERFORM public.record_electricity_meter_reading(
      v_account_id,
      v_row.current_meter_reading,
      v_row.reading_date,
      concat('Imported from Dora Tower paper electricity sheet dated ', to_char(v_row.reading_date, 'DD/MM/YYYY'), '; source label: ', v_row.source_label, '.')
    );
  END LOOP;
END;
$import_dora_readings$;

COMMIT;
