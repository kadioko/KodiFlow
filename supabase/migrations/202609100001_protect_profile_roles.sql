BEGIN;

-- RLS controls rows, not which columns a user can change in their profile.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $protect_profile_admin_role$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.admin_role IS DISTINCT FROM 'none' THEN
        RAISE EXCEPTION 'Only the administration service can assign account roles'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.admin_role IS DISTINCT FROM OLD.admin_role THEN
      RAISE EXCEPTION 'Only the administration service can change account roles'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$protect_profile_admin_role$;

DROP TRIGGER IF EXISTS protect_profile_admin_role ON public.profiles;
CREATE TRIGGER protect_profile_admin_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_role();

-- Admin profile listing already uses the authorized server-side service client.
-- A policy querying profiles from profiles recursively evaluates itself.
DROP POLICY IF EXISTS "Admins can view admin profiles" ON public.profiles;

COMMIT;
