-- Unit identifiers can repeat on different floors/sections in the same property.
DROP INDEX IF EXISTS public.idx_units_property_identifier_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_units_section_identifier_unique
ON public.units(user_id, property_id, section_id, lower(unit_identifier))
WHERE unit_identifier IS NOT NULL AND btrim(unit_identifier) <> '';

