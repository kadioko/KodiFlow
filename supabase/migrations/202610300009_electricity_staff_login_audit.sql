BEGIN;

ALTER TABLE public.electricity_staff
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.electricity_staff_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.electricity_staff(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS electricity_staff_login_events_owner_time_idx
  ON public.electricity_staff_login_events (owner_user_id, logged_in_at DESC);

CREATE INDEX IF NOT EXISTS electricity_staff_login_events_staff_time_idx
  ON public.electricity_staff_login_events (staff_id, logged_in_at DESC);

ALTER TABLE public.electricity_staff_login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their staff login history"
  ON public.electricity_staff_login_events;
CREATE POLICY "Owners read their staff login history"
  ON public.electricity_staff_login_events FOR SELECT
  USING (owner_user_id = auth.uid());

GRANT SELECT ON public.electricity_staff_login_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.electricity_staff_login_events FROM authenticated, anon;
GRANT INSERT ON public.electricity_staff_login_events TO service_role;

CREATE OR REPLACE FUNCTION public.update_electricity_staff_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $update_staff_login$
BEGIN
  UPDATE public.electricity_staff
  SET last_login_at = GREATEST(COALESCE(last_login_at, NEW.logged_in_at), NEW.logged_in_at),
      updated_at = GREATEST(updated_at, NEW.logged_in_at)
  WHERE id = NEW.staff_id
    AND owner_user_id = NEW.owner_user_id
    AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active staff login not found';
  END IF;

  RETURN NEW;
END;
$update_staff_login$;

DROP TRIGGER IF EXISTS electricity_staff_login_updates_last_login
  ON public.electricity_staff_login_events;
CREATE TRIGGER electricity_staff_login_updates_last_login
  BEFORE INSERT ON public.electricity_staff_login_events
  FOR EACH ROW EXECUTE FUNCTION public.update_electricity_staff_last_login();

REVOKE ALL ON FUNCTION public.update_electricity_staff_last_login() FROM PUBLIC;

COMMIT;
