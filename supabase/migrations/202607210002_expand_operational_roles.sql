-- Operational roles sit alongside the existing platform administrator model.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_admin_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_admin_role_check
  CHECK (admin_role IN ('none', 'viewer', 'property_manager', 'accountant', 'maintenance_manager', 'admin', 'super_admin'));

-- Preserve the requested platform owner as the top-level recovery account.
UPDATE public.profiles
SET admin_role = 'super_admin'
WHERE lower(email) = 'godfreymariki@gmail.com';
