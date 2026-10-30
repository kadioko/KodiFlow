import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    const { data: electricityStaff } = await serviceClient
      .from('electricity_staff')
      .select('active')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (electricityStaff) {
      if (!electricityStaff.active) return NextResponse.json({ user: null }, { status: 401 })
      return NextResponse.json({ user, adminRole: 'electricity_staff' })
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('admin_role')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ user, adminRole: (profile as { admin_role?: string } | null)?.admin_role || 'none' })
  } catch {
    return NextResponse.json({ user: null }, { status: 503 })
  }
}
