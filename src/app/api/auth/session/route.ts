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
      .select('active, language_preference')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (electricityStaff) {
      if (!electricityStaff.active) return NextResponse.json({ user: null }, { status: 401 })
      return NextResponse.json({
        user,
        adminRole: 'electricity_staff',
        languagePreference: electricityStaff.language_preference || 'en',
      })
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('admin_role, language_preference')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      user,
      adminRole: profile?.admin_role || 'none',
      languagePreference: profile?.language_preference || 'en',
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 503 })
  }
}
