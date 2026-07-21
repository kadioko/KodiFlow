import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type AdminRole = 'none' | 'viewer' | 'property_manager' | 'accountant' | 'maintenance_manager' | 'admin' | 'super_admin'

export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service environment variables.')
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function getCurrentAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, role: 'none' as AdminRole }
  }

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, email, full_name, admin_role')
    .eq('id', user.id)
    .single()

  return {
    user,
    profile,
    role: ((profile as { admin_role?: AdminRole } | null)?.admin_role || 'none') as AdminRole,
  }
}

export function isAdminRole(role: AdminRole) {
  return role === 'admin' || role === 'super_admin'
}

export function canManageUserRole(actorRole: AdminRole, targetRole: AdminRole) {
  if (actorRole === 'super_admin') return true
  return actorRole === 'admin' && ['none', 'viewer', 'property_manager', 'accountant', 'maintenance_manager'].includes(targetRole)
}
