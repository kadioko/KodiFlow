import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient, getCurrentAdmin, isAdminRole } from '@/lib/supabase/admin'

type AdminRole = 'admin' | 'super_admin'

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function normalizeRole(role: unknown): AdminRole {
  return role === 'super_admin' ? 'super_admin' : 'admin'
}

export async function GET() {
  const currentAdmin = await getCurrentAdmin()

  if (!isAdminRole(currentAdmin.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('profiles')
    .select('id, email, full_name, admin_role, created_at, updated_at')
    .in('admin_role', ['admin', 'super_admin'])
    .order('admin_role', { ascending: false })
    .order('email', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ admins: data || [], currentRole: currentAdmin.role })
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
  const adminRole = body.adminRole === 'none' ? 'none' : normalizeRole(body.adminRole)

  if (!profileId) {
    return NextResponse.json({ error: 'Profile id is required' }, { status: 400 })
  }

  if (profileId === currentAdmin.user?.id && adminRole !== 'super_admin') {
    return NextResponse.json({ error: 'You cannot remove your own super admin role' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('profiles')
    .update({ admin_role: adminRole })
    .eq('id', profileId)
    .select('id, email, full_name, admin_role, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ admin: data })
}
