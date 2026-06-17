-- Add first-class application admin roles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS admin_role TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_admin_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_admin_role_check
  CHECK (admin_role IN ('none', 'admin', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_admin_role ON public.profiles(admin_role);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_lower_idx
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

DROP POLICY IF EXISTS "Admins can view admin profiles" ON public.profiles;
CREATE POLICY "Admins can view admin profiles" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles requester
      WHERE requester.id = auth.uid()
        AND requester.admin_role IN ('admin', 'super_admin')
        AND profiles.admin_role IN ('admin', 'super_admin')
    )
  );
