import { NextResponse, type NextRequest } from 'next/server'
import { canAccessElectricityProperty, getElectricityActor, isValidStaffId, isValidStaffPin, normalizeStaffId } from '@/lib/electricity/server'

export async function POST(request: NextRequest) {
  let authUserId: string | null = null
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to manage staff.' }, { status: 401 })
    if (!actor.isOwner) return NextResponse.json({ error: 'Only the property owner can create staff access.' }, { status: 403 })

    const body = await request.json()
    const staffId = normalizeStaffId(body.staffId)
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const pin = body.pin
    const hasValidPropertyIds = Array.isArray(body.propertyIds) && body.propertyIds.every((id: unknown) => typeof id === 'string')
    const propertyIds = hasValidPropertyIds ? [...new Set(body.propertyIds as string[])] : []

    if (!isValidStaffId(staffId)) return NextResponse.json({ error: 'Staff ID must be 3–24 letters, numbers, dots, dashes, or underscores.' }, { status: 400 })
    if (!isValidStaffPin(pin)) return NextResponse.json({ error: 'PIN must be 8–12 digits.' }, { status: 400 })
    if (fullName.length < 2 || fullName.length > 100) return NextResponse.json({ error: 'Enter the staff member’s name.' }, { status: 400 })
    if (propertyIds.length === 0 || propertyIds.some((id) => !canAccessElectricityProperty(actor, id))) {
      return NextResponse.json({ error: 'Select at least one property you own for this staff member.' }, { status: 400 })
    }

    const { data: existingStaff, error: duplicateError } = await actor.service
      .from('electricity_staff')
      .select('id')
      .eq('staff_id', staffId)
      .maybeSingle()
    if (duplicateError) return NextResponse.json({ error: duplicateError.message }, { status: 500 })
    if (existingStaff) return NextResponse.json({ error: 'That staff ID is already in use. Choose a unique ID.' }, { status: 409 })

    const loginEmail = `staff-${crypto.randomUUID()}@staff.kodiflow.app`
    const { data: authResult, error: authError } = await actor.service.auth.admin.createUser({
      email: loginEmail,
      password: pin,
      email_confirm: true,
      user_metadata: { full_name: fullName, account_type: 'electricity_staff' },
    })
    if (authError || !authResult.user) {
      return NextResponse.json({ error: authError?.message || 'Could not create the staff login.' }, { status: 400 })
    }
    authUserId = authResult.user.id

    const { error: profileError } = await actor.service.from('profiles').upsert({
      id: authUserId,
      email: null,
      full_name: fullName,
      admin_role: 'none',
      currency_preference: 'TZS',
    })
    if (profileError) throw profileError

    const { data: staff, error: staffError } = await actor.service
      .from('electricity_staff')
      .insert({
        owner_user_id: actor.ownerUserId,
        auth_user_id: authUserId,
        staff_id: staffId,
        login_email: loginEmail,
        full_name: fullName,
        created_by: actor.user.id,
      })
      .select('id, staff_id, full_name, active, created_at')
      .single()
    if (staffError || !staff) throw staffError || new Error('Could not save the staff record.')

    const { error: membershipError } = await actor.client.rpc('set_electricity_staff_properties', {
      p_staff_id: staff.id,
      p_property_ids: propertyIds,
    })
    if (membershipError) throw membershipError

    return NextResponse.json({ staff: { ...staff, property_ids: propertyIds } }, { status: 201 })
  } catch (error) {
    if (authUserId) {
      try {
        const actor = await getElectricityActor()
        await actor?.service.auth.admin.deleteUser(authUserId)
      } catch {
        // Leave cleanup to the provider if the request lost its service connection.
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create the staff login.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to manage staff.' }, { status: 401 })
    if (!actor.isOwner) return NextResponse.json({ error: 'Only the property owner can manage staff access.' }, { status: 403 })

    const body = await request.json()
    const staffRecordId = typeof body.id === 'string' ? body.id : ''
    if (!staffRecordId) return NextResponse.json({ error: 'Staff record is required.' }, { status: 400 })

    const { data: staff, error: staffError } = await actor.service
      .from('electricity_staff')
      .select('id, auth_user_id, active')
      .eq('id', staffRecordId)
      .eq('owner_user_id', actor.ownerUserId)
      .maybeSingle()
    if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 })
    if (!staff) return NextResponse.json({ error: 'Staff login not found.' }, { status: 404 })

    if (body.pin !== undefined) {
      if (!isValidStaffPin(body.pin)) return NextResponse.json({ error: 'PIN must be 8–12 digits.' }, { status: 400 })
      const { error } = await actor.service.auth.admin.updateUserById(staff.auth_user_id, { password: body.pin })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (body.propertyIds !== undefined) {
      if (!Array.isArray(body.propertyIds) || !body.propertyIds.every((id: unknown) => typeof id === 'string')) {
        return NextResponse.json({ error: 'Choose valid properties for this staff member.' }, { status: 400 })
      }
      const propertyIds = [...new Set(body.propertyIds as string[])]
      if (propertyIds.some((id) => !canAccessElectricityProperty(actor, id))) {
        return NextResponse.json({ error: 'Staff can only be assigned to your properties.' }, { status: 400 })
      }
      const { error } = await actor.client.rpc('set_electricity_staff_properties', {
        p_staff_id: staff.id,
        p_property_ids: propertyIds,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    let active = staff.active
    if (typeof body.active === 'boolean') {
      const { error } = await actor.service
        .from('electricity_staff')
        .update({ active: body.active })
        .eq('id', staff.id)
        .eq('owner_user_id', actor.ownerUserId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      active = body.active
    }

    return NextResponse.json({ id: staff.id, active, pinUpdated: body.pin !== undefined })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update staff access.' }, { status: 500 })
  }
}
