import { NextResponse, type NextRequest } from 'next/server'
import { canAccessElectricityProperty, getElectricityActor } from '@/lib/electricity/server'

export async function POST(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })
    if (!actor.isOwner) return NextResponse.json({ error: 'Only the property owner can set up meters.' }, { status: 403 })

    const body = await request.json()
    const propertyId = typeof body.propertyId === 'string' ? body.propertyId : ''
    const meterKind = body.meterKind === 'floor_main' ? 'floor_main' : 'submeter'
    const floorLabel = typeof body.floorLabel === 'string' ? body.floorLabel.trim() : ''
    const meterNumber = typeof body.meterNumber === 'string' ? body.meterNumber.trim() : ''
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
    const initialReadingDate = meterKind === 'floor_main'
      ? today
      : typeof body.initialReadingDate === 'string' ? body.initialReadingDate : ''
    const hasInitialMeterReading = typeof body.initialMeterReading === 'number'
      || (typeof body.initialMeterReading === 'string' && body.initialMeterReading.trim() !== '')
    const initialMeterReading = meterKind === 'floor_main' ? 0 : hasInitialMeterReading ? Number(body.initialMeterReading) : Number.NaN
    const openingBalanceUnits = Number(body.openingBalanceUnits ?? 0)
    const lowUnitsThreshold = Number(body.lowUnitsThreshold ?? (meterKind === 'floor_main' ? 50 : 10))
    const unitId = typeof body.unitId === 'string' ? body.unitId : ''
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : ''

    if (!propertyId || !canAccessElectricityProperty(actor, propertyId)) {
      return NextResponse.json({ error: 'Choose one of your properties.' }, { status: 400 })
    }
    if (!floorLabel || floorLabel.length > 80) {
      return NextResponse.json({ error: 'Enter a floor or shared-area label.' }, { status: 400 })
    }
    if (!Number.isFinite(initialMeterReading) || initialMeterReading < 0) {
      return NextResponse.json({ error: 'Enter a valid initial meter reading.' }, { status: 400 })
    }
    const parsedInitialDate = new Date(`${initialReadingDate}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(initialReadingDate)
      || Number.isNaN(parsedInitialDate.getTime())
      || parsedInitialDate.toISOString().slice(0, 10) !== initialReadingDate
      || initialReadingDate > today) {
      return NextResponse.json({ error: 'Enter a valid initial reading date that is today or earlier.' }, { status: 400 })
    }
    if (meterKind === 'submeter' && (!unitId || !tenantId)) {
      return NextResponse.json({ error: 'Choose both a unit and its client for a submeter.' }, { status: 400 })
    }
    if (meterKind === 'floor_main' && (unitId || tenantId)) {
      return NextResponse.json({ error: 'A floor main meter cannot be assigned to a client unit.' }, { status: 400 })
    }
    if (!Number.isFinite(openingBalanceUnits) || !Number.isFinite(lowUnitsThreshold) || lowUnitsThreshold < 0
      || (meterKind === 'floor_main' && lowUnitsThreshold === 0)) {
      return NextResponse.json({ error: 'Opening units and low-unit threshold must be valid numbers.' }, { status: 400 })
    }

    if (meterKind === 'submeter') {
      const [unitResult, tenantResult] = await Promise.all([
        actor.service.from('units').select('id').eq('id', unitId).eq('property_id', propertyId).eq('user_id', actor.ownerUserId).maybeSingle(),
        actor.service.from('tenants').select('id').eq('id', tenantId).eq('user_id', actor.ownerUserId).maybeSingle(),
      ])
      if (unitResult.error || tenantResult.error) {
        return NextResponse.json({ error: unitResult.error?.message || tenantResult.error?.message }, { status: 500 })
      }
      if (!unitResult.data || !tenantResult.data) {
        return NextResponse.json({ error: 'The selected client and unit must belong to this property account.' }, { status: 400 })
      }

    }

    const { data, error } = await actor.service
      .from('electricity_accounts')
      .insert({
        owner_user_id: actor.ownerUserId,
        property_id: propertyId,
        meter_kind: meterKind,
        unit_id: meterKind === 'submeter' ? unitId : null,
        tenant_id: meterKind === 'submeter' ? tenantId : null,
        floor_label: floorLabel,
        meter_number: meterNumber || null,
        initial_meter_reading: initialMeterReading,
        initial_reading_date: initialReadingDate,
        opening_balance_units: meterKind === 'submeter' ? openingBalanceUnits : 0,
        low_units_threshold: lowUnitsThreshold,
        created_by: actor.user.id,
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ account: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create the meter.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to manage meters.' }, { status: 401 })
    if (!actor.isOwner) return NextResponse.json({ error: 'Only the property owner can change meter settings.' }, { status: 403 })

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Meter is required.' }, { status: 400 })

    if (body.replaceTenantId !== undefined) {
      const tenantId = typeof body.replaceTenantId === 'string' ? body.replaceTenantId : ''
      const currentMeterReading = Number(body.currentMeterReading)
      const openingBalanceUnits = Number(body.openingBalanceUnits)
      const readingDate = typeof body.readingDate === 'string' ? body.readingDate : ''
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
      if (!tenantId || !/^\d{4}-\d{2}-\d{2}$/.test(readingDate)
        || !Number.isFinite(currentMeterReading) || !Number.isFinite(openingBalanceUnits)
        || displayName.length > 100) {
        return NextResponse.json({ error: 'Enter a new tenant, valid handoff reading/date, opening balance, and display name.' }, { status: 400 })
      }
      const { data, error } = await actor.client.rpc('replace_electricity_submeter', {
        p_account_id: id,
        p_tenant_id: tenantId,
        p_current_meter_reading: currentMeterReading,
        p_reading_date: readingDate,
        p_opening_balance_units: openingBalanceUnits,
        p_display_name: displayName || null,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ account: data })
    }

    const update: { active?: boolean; low_units_threshold?: number; display_name?: string; updated_at?: string } = {}
    if (typeof body.active === 'boolean') update.active = body.active
    if (body.lowUnitsThreshold !== undefined) {
      const threshold = Number(body.lowUnitsThreshold)
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100000) {
        return NextResponse.json({ error: 'Enter a low-unit threshold between 0 and 100,000.' }, { status: 400 })
      }
      update.low_units_threshold = threshold
    }
    if (body.displayName !== undefined) {
      if (typeof body.displayName !== 'string') return NextResponse.json({ error: 'Enter a valid submeter name.' }, { status: 400 })
      const displayName = body.displayName.trim()
      if (!displayName || displayName.length > 100) {
        return NextResponse.json({ error: 'Submeter name must be between 1 and 100 characters.' }, { status: 400 })
      }
      const { data: account, error: accountError } = await actor.service
        .from('electricity_accounts')
        .select('meter_kind')
        .eq('id', id)
        .eq('owner_user_id', actor.ownerUserId)
        .maybeSingle()
      if (accountError) return NextResponse.json({ error: accountError.message }, { status: 400 })
      if (!account) return NextResponse.json({ error: 'Meter not found.' }, { status: 404 })
      if (account.meter_kind !== 'submeter') return NextResponse.json({ error: 'Only client submeters can have a tenant display name.' }, { status: 400 })
      update.display_name = displayName
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No meter changes were provided.' }, { status: 400 })
    update.updated_at = new Date().toISOString()

    const { data, error } = await actor.service
      .from('electricity_accounts')
      .update(update)
      .eq('id', id)
      .eq('owner_user_id', actor.ownerUserId)
      .select('id, active, low_units_threshold, display_name')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Meter not found.' }, { status: 404 })
    return NextResponse.json({ account: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update meter settings.' }, { status: 500 })
  }
}
