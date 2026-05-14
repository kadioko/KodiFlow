-- Add a building-facing identifier/code for units, such as A-101, B2-04, or SHOP-G01.
ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS unit_identifier TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_units_property_identifier_unique
ON public.units(user_id, property_id, lower(unit_identifier))
WHERE unit_identifier IS NOT NULL AND btrim(unit_identifier) <> '';

