BEGIN;

ALTER TABLE public.electricity_staff
  ADD COLUMN IF NOT EXISTS language_preference TEXT NOT NULL DEFAULT 'en';

ALTER TABLE public.electricity_staff
  DROP CONSTRAINT IF EXISTS electricity_staff_language_preference_check;

ALTER TABLE public.electricity_staff
  ADD CONSTRAINT electricity_staff_language_preference_check
  CHECK (language_preference IN ('en', 'sw'));

COMMIT;
