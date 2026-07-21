import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient, getCurrentAdmin, isAdminRole, type AdminRole } from '@/lib/supabase/admin'

type ManagedRole = AdminRole

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function normalizeRole(role: unknown): AdminRole {
  const roles: AdminRole[] = ['none', 'viewer', 'property_manager', 'accountant', 'maintenance_manager', 'admin', 'super_admin']
  return roles.includes(role as AdminRole) ? role as AdminRole : 'property_manager'
}

export async function GET() {
  const currentAdmin = await getCurrentAdmin()

  if (!isAdminRole(currentAdmin.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const serviceClient = createServiceClient()
  const { data: profiles, error } = await serviceClient
    .from('profiles')
    .select('id, email, full_name, admin_role, created_at, updated_at')
    .order('admin_role', { ascending: false })
    .order('email', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const visibleProfiles = currentAdmin.role === 'super_admin'
    ? profiles || []
    : (profiles || []).filter((profile) => ['admin', 'super_admin'].includes(profile.admin_role))

  const { data: authUsers } = currentAdmin.role === 'super_admin'
    ? await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    : { data: { users: [] } }

  const usersById = new Map((authUsers?.users || []).map((user) => [user.id, user]))
  const profileById = new Map(visibleProfiles.map((profile) => [profile.id, profile]))
  const ids = new Set([...profileById.keys(), ...usersById.keys()])

  const users = [...ids].map((id) => {
    const profile = profileById.get(id)
    const authUser = usersById.get(id)
    return {
      id,
      email: profile?.email || authUser?.email || null,
      full_name: profile?.full_name || (authUser?.user_metadata?.full_name as string | undefined) || null,
      admin_role: (profile?.admin_role || 'none') as ManagedRole,
      created_at: profile?.created_at || authUser?.created_at,
      updated_at: profile?.updated_at || authUser?.updated_at,
      last_sign_in_at: authUser?.last_sign_in_at || null,
      confirmed_at: authUser?.confirmed_at || null,
    }
  }).sort((a, b) => {
    const roleRank = (role: ManagedRole) => role === 'super_admin' ? 0 : role === 'admin' ? 1 : 2
    return roleRank(a.admin_role) - roleRank(b.admin_role) || (a.email || '').localeCompare(b.email || '')
  })

  return NextResponse.json({
    users,
    admins: users.filter((user) => user.admin_role !== 'none'),
    currentRole: currentAdmin.role,
  })
}

export async function POST(request: NextRequest) {
  const currentAdmin = await getCurrentAdmin()

  if (currentAdmin.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only a super admin can add admins' }, { status: 403 })
  }

  const body = await request.json()
  const email = normalizeEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const adminRole = normalizeRole(body.adminRole)

  if (adminRole === 'none') {
    return NextResponse.json({ error: 'Choose an operational role for a new user' }, { status: 400 })
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      admin_role: adminRole,
    },
  })

  if (createError || !createdUser.user) {
    return NextResponse.json({ error: createError?.message || 'Admin user was not created' }, { status: 400 })
  }

  const { error: profileError } = await serviceClient
    .from('profiles')
    .upsert({
      id: createdUser.user.id,
      email,
      full_name: fullName || null,
      admin_role: adminRole,
      currency_preference: 'TZS',
    })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({
    admin: {
      id: createdUser.user.id,
      email,
      full_name: fullName || null,
      admin_role: adminRole,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const currentAdmin = await getCurrentAdmin()

  if (currentAdmin.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only a super admin can change admin roles' }, { status: 403 })
  }

  const body = await request.json()
  const profileId = typeof body.id === 'string' ? body.id : ''
  const adminRole = normalizeRole(body.adminRole)
  const newPassword = typeof body.password === 'string' ? body.password : ''

  if (!profileId) {
    return NextResponse.json({ error: 'Profile id is required' }, { status: 400 })
  }

  if (profileId === currentAdmin.user?.id && body.adminRole && adminRole !== 'super_admin') {
    return NextResponse.json({ error: 'You cannot remove your own super admin role' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  if (newPassword) {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const { error: passwordError } = await serviceClient.auth.admin.updateUserById(profileId, {
      password: newPassword,
    })

    if (passwordError) {
      return NextResponse.json({ error: passwordError.message }, { status: 500 })
    }
  }

  let data = null
  let error = null

  if (body.adminRole) {
    const result = await serviceClient
      .from('profiles')
      .update({ admin_role: adminRole })
      .eq('id', profileId)
      .select('id, email, full_name, admin_role, updated_at')
      .single()

    data = result.data
    error = result.error
  } else {
    const result = await serviceClient
      .from('profiles')
      .select('id, email, full_name, admin_role, updated_at')
      .eq('id', profileId)
      .single()

    data = result.data
    error = result.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ admin: data, passwordUpdated: Boolean(newPassword) })
}
