BEGIN;

UPDATE public.electricity_accounts AS account
SET meter_number = source.meter_number,
    updated_at = now()
FROM public.properties AS property
JOIN (VALUES
  ('Basement', '37233113788'),
  ('Ground Floor', '22251960989'),
  ('First Floor', '24730217841'),
  ('Second Floor', '37233108994'),
  ('Third Floor', '37220591210'),
  ('Fourth Floor', '37233109000'),
  ('Fifth Floor', '37220591228'),
  ('B. Hall', '37233113770')
) AS source(floor_label, meter_number) ON TRUE
WHERE account.property_id = property.id
  AND account.owner_user_id = property.user_id
  AND account.meter_kind = 'floor_main'
  AND account.active
  AND property.id = '85246880-a4ba-4e4b-8118-208b68ed28d4'::UUID
  AND lower(btrim(property.name)) = 'dora tower'
  AND lower(btrim(account.floor_label)) = lower(source.floor_label)
  AND account.meter_number IS NULL;

COMMIT;
