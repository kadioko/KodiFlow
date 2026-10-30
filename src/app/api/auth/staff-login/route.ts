import { NextResponse, type NextRequest } from 'next/server'
import { asElectricityClient } from '@/lib/electricity/database.types'
import { isValidStaffId, isValidStaffPin, normalizeStaffId } from '@/lib/electricity/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const staffId = normalizeStaffId(body.staffId)
    const pin = body.pin
    if (!isValidStaffId(staffId) || !isValidStaffPin(pin)) {
      return NextResponse.json({ error: 'Enter your staff ID and 8–12 digit PIN.' }, { status: 400 })
    }

    const service = asElectricityClient(createServiceClient())
    const { data: staff, error } = await service
      .from('electricity_staff')
      .select('id, login_email, active')
      .eq('staff_id', staffId)
      .maybeSingle()

    if (error || !staff || !staff.active) {
      return NextResponse.json({ error: 'Staff ID or PIN is incorrect, or the account is inactive.' }, { status: 401 })
    }

    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: staff.login_email, password: pin })
    if (signInError) {
      return NextResponse.json({ error: 'Staff ID or PIN is incorrect, or the account is inactive.' }, { status: 401 })
    }

    return NextResponse.json({ ok: true, destination: '/electricity' })
  } catch {
    return NextResponse.json({ error: 'Could not reach staff sign-in. Check the connection and try again.' }, { status: 503 })
  }
}
