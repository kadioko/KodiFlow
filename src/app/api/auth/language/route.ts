import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/admin'

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

    const body = await request.json()
    if (body.language !== 'en' && body.language !== 'sw') {
      return NextResponse.json({ error: 'Choose English or Kiswahili.' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data: staff, error: staffError } = await service
      .from('electricity_staff')
      .select('id, active')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (staffError) return NextResponse.json({ error: 'Could not load your account.' }, { status: 500 })
    if (staff) {
      if (!staff.active) return NextResponse.json({ error: 'This staff account is inactive.' }, { status: 403 })
      const { error } = await service.from('electricity_staff').update({ language_preference: body.language }).eq('id', staff.id)
      if (error) return NextResponse.json({ error: 'Could not save your language preference.' }, { status: 500 })
    } else {
      const { error } = await service.from('profiles').upsert(
        { id: user.id, language_preference: body.language },
        { onConflict: 'id' }
      )
      if (error) return NextResponse.json({ error: 'Could not save your language preference.' }, { status: 500 })
    }

    return NextResponse.json({ languagePreference: body.language })
  } catch {
    return NextResponse.json({ error: 'Could not save your language preference.' }, { status: 500 })
  }
}
