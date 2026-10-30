BEGIN;

CREATE TEMP TABLE dora_tower_submeter_import (
  owner_user_id UUID NOT NULL,
  property_id UUID NOT NULL,
  unit_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  floor_label TEXT NOT NULL,
  initial_meter_reading NUMERIC(14, 3) NOT NULL,
  previous_meter_reading NUMERIC(14, 3) NOT NULL,
  current_meter_reading NUMERIC(14, 3) NOT NULL,
  closing_balance_units NUMERIC(14, 3) NOT NULL,
  source_note TEXT
) ON COMMIT DROP;

INSERT INTO dora_tower_submeter_import (
  owner_user_id, property_id, unit_id, tenant_id, floor_label,
  initial_meter_reading, previous_meter_reading, current_meter_reading,
  closing_balance_units, source_note
)
SELECT
  p.user_id,
  p.id,
  u.id,
  t.id,
  s.name,
  source.current_reading,
  source.previous_reading,
  source.current_reading,
  source.closing_balance,
  source.source_note
FROM (VALUES
  ('Seba', 'B1', 15372.9::NUMERIC, 15417.4::NUMERIC, -23.4::NUMERIC, NULL::TEXT),
  ('VSS', 'B2', 2210.7::NUMERIC, 2222.9::NUMERIC, 49.4::NUMERIC, 'Ledger says 10.9 units used, but the meter readings calculate 12.2; usage is calculated from the readings.'),
  ('Twilight', 'B3', 2555.7::NUMERIC, 2568.9::NUMERIC, 20.9::NUMERIC, 'Ledger carry-forward differs by 0.2 from brought-forward units minus meter usage; the written carry-forward was retained.'),
  ('Neo life 3', 'B4', 2131.7::NUMERIC, 2145.9::NUMERIC, 23.8::NUMERIC, NULL),
  ('Azudu', 'B5', 1865.0::NUMERIC, 1879.4::NUMERIC, 23.7::NUMERIC, NULL),
  ('PowerHouse', '11', 3299.0::NUMERIC, 3299.3::NUMERIC, 35.6::NUMERIC, NULL),
  ('EverMark', '12', 2130.6::NUMERIC, 2156.7::NUMERIC, 8.6::NUMERIC, NULL),
  ('Arm City', '13', 4753.8::NUMERIC, 4754.0::NUMERIC, 7.1::NUMERIC, NULL),
  ('Caperone', '14', 3276.8::NUMERIC, 3310.0::NUMERIC, 117.1::NUMERIC, NULL),
  ('Extra Solutions', '31', 4899.0::NUMERIC, 4901.6::NUMERIC, 4.8::NUMERIC, NULL),
  ('Godfrey Binamu', '32', 2755.0::NUMERIC, 2755.9::NUMERIC, 9.8::NUMERIC, NULL),
  ('Heritage', '34', 1441.2::NUMERIC, 1448.3::NUMERIC, 107.8::NUMERIC, NULL),
  ('Freshway Developers', '35', 617.5::NUMERIC, 630.2::NUMERIC, 66.1::NUMERIC, NULL),
  ('Montatina', '36', 2040.2::NUMERIC, 2040.4::NUMERIC, 124.0::NUMERIC, NULL),
  ('Vintech', '37', 6340.5::NUMERIC, 6342.3::NUMERIC, 34.7::NUMERIC, NULL),
  ('Elite Aces', '38', 3009.2::NUMERIC, 3038.5::NUMERIC, 118.5::NUMERIC, 'The sheet lists 140.3 purchased units and a token reference, but the token row names EverMark; no token or purchase transaction was imported.'),
  ('Codd Zoss', '39', 3038.4::NUMERIC, 3038.4::NUMERIC, -11.7::NUMERIC, NULL),
  ('Ndiba Stores', 'G1', 175.5::NUMERIC, 180.4::NUMERIC, 232.5::NUMERIC, NULL),
  ('Economic Diplomacy', '54', 1178.6::NUMERIC, 1181.1::NUMERIC, -12.5::NUMERIC, 'The handwritten row ID is 52; the current tenant record is assigned to unit 54, so the account follows the current named tenant/unit mapping.'),
  ('Oasis', '52', 2819.2::NUMERIC, 2882.7::NUMERIC, 272.1::NUMERIC, 'The handwritten row ID is 54; the current tenant record is assigned to unit 52, so the account follows the current named tenant/unit mapping.')
) AS source(tenant_name, unit_identifier, previous_reading, current_reading, closing_balance, source_note)
JOIN public.properties p
  ON p.id = '85246880-a4ba-4e4b-8118-208b68ed28d4'::UUID
 AND lower(btrim(p.name)) = 'dora tower'
JOIN public.units u
  ON u.property_id = p.id
 AND u.user_id = p.user_id
 AND btrim(u.unit_identifier) = source.unit_identifier
JOIN public.property_sections s
  ON s.id = u.section_id
 AND s.property_id = p.id
JOIN public.tenants t
  ON t.user_id = p.user_id
 AND lower(btrim(COALESCE(t.business_name, t.full_name, ''))) = lower(source.tenant_name);

CREATE TEMP TABLE dora_tower_imported_accounts (
  account_id UUID NOT NULL,
  unit_id UUID NOT NULL,
  PRIMARY KEY (unit_id)
) ON COMMIT DROP;

WITH inserted_accounts AS (
  INSERT INTO public.electricity_accounts (
    owner_user_id, property_id, meter_kind, unit_id, tenant_id, floor_label,
    initial_meter_reading, initial_reading_date, opening_balance_units,
    low_units_threshold, created_by
  )
  SELECT
    source.owner_user_id, source.property_id, 'submeter', source.unit_id,
    source.tenant_id, source.floor_label, source.initial_meter_reading,
    DATE '2026-10-29', source.closing_balance_units, 10, source.owner_user_id
  FROM dora_tower_submeter_import source
  WHERE NOT EXISTS (
    SELECT 1 FROM public.electricity_accounts a
    WHERE a.unit_id = source.unit_id
      AND a.meter_kind = 'submeter'
      AND a.active
  )
  ON CONFLICT (unit_id) WHERE meter_kind = 'submeter' AND active DO NOTHING
  RETURNING id, unit_id
)
INSERT INTO dora_tower_imported_accounts (account_id, unit_id)
SELECT id, unit_id FROM inserted_accounts;

INSERT INTO public.electricity_readings (
  account_id, owner_user_id, previous_meter_reading, current_meter_reading,
  previous_reading_date, opening_balance_units, topup_units,
  closing_balance_units, reading_date, notes, recorded_by
)
SELECT
  a.account_id,
  source.owner_user_id,
  source.previous_meter_reading,
  source.current_meter_reading,
  NULL,
  source.closing_balance_units + (source.current_meter_reading - source.previous_meter_reading),
  0,
  source.closing_balance_units,
  DATE '2026-10-29',
  concat_ws(' ',
    'Imported from the Dora Tower handwritten electricity ledger dated 29/10/2026. The prior reading date was not present; compare with a later main-meter reading only when dates match.',
    source.source_note
  ),
  source.owner_user_id
FROM dora_tower_submeter_import source
JOIN dora_tower_imported_accounts a ON a.unit_id = source.unit_id
ON CONFLICT (account_id, reading_date) DO NOTHING;

INSERT INTO public.electricity_accounts (
  owner_user_id, property_id, meter_kind, floor_label, initial_meter_reading,
  initial_reading_date, opening_balance_units, low_units_threshold, created_by
)
SELECT
  p.user_id,
  p.id,
  'floor_main',
  source.floor_label,
  source.current_reading,
  DATE '2026-10-29',
  0,
  0,
  p.user_id
FROM public.properties p
CROSS JOIN (VALUES
  ('Basement', 281.69::NUMERIC),
  ('Ground Floor', 147.29::NUMERIC),
  ('First Floor', 140.30::NUMERIC),
  ('Second Floor', 39.00::NUMERIC),
  ('Third Floor', 473.81::NUMERIC),
  ('Fourth Floor', 801.89::NUMERIC),
  ('Fifth Floor', 38.89::NUMERIC),
  ('B. Hall', 108.23::NUMERIC)
) AS source(floor_label, current_reading)
WHERE p.id = '85246880-a4ba-4e4b-8118-208b68ed28d4'::UUID
  AND lower(btrim(p.name)) = 'dora tower'
  AND NOT EXISTS (
    SELECT 1 FROM public.electricity_accounts a
    WHERE a.property_id = p.id
      AND a.meter_kind = 'floor_main'
      AND lower(btrim(a.floor_label)) = lower(btrim(source.floor_label))
      AND a.active
  )
ON CONFLICT DO NOTHING;

COMMIT;
