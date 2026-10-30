import { NextResponse } from 'next/server'
import { getElectricityActor } from '@/lib/electricity/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in with an active account.' }, { status: 401 })
    if (actor.propertyIds.length === 0) {
      return NextResponse.json({ error: 'No property access is assigned to this account.' }, { status: 403 })
    }

    const service = actor.service
    const ownerId = actor.ownerUserId
    const propertyIds = actor.propertyIds
    const [propertyResult, sectionResult, unitResult, accountResult, staffResult, membershipResult, leaseResult] = await Promise.all([
      service.from('properties').select('id, name').eq('user_id', ownerId).in('id', propertyIds).order('name'),
      service.from('property_sections').select('id, name, property_id, section_type').eq('user_id', ownerId).in('property_id', propertyIds).order('name'),
      service.from('units').select('id, unit_name, property_id, section_id, unit_identifier').eq('user_id', ownerId).in('property_id', propertyIds).order('unit_name'),
      service.from('electricity_accounts').select('*').eq('owner_user_id', ownerId).in('property_id', propertyIds).order('floor_label').order('created_at'),
      actor.isOwner
        ? service.from('electricity_staff').select('id, staff_id, full_name, active, created_at').eq('owner_user_id', ownerId).order('full_name')
        : Promise.resolve({ data: [], error: null }),
      actor.isOwner
        ? service.from('electricity_staff_properties').select('staff_id, property_id').eq('owner_user_id', ownerId).in('property_id', propertyIds)
        : Promise.resolve({ data: [], error: null }),
      service.from('leases').select('tenant_id').eq('user_id', ownerId).in('property_id', propertyIds),
    ])

    const initialErrors = [propertyResult.error, sectionResult.error, unitResult.error, accountResult.error, staffResult.error, membershipResult.error, leaseResult.error]
    const initialError = initialErrors.find(Boolean)
    if (initialError) return NextResponse.json({ error: initialError.message }, { status: 500 })

    const accounts = accountResult.data || []
    const accountIds = accounts.map((account) => account.id)
    const scopedTenantIds = Array.from(new Set([
      ...(leaseResult.data || []).map((lease) => lease.tenant_id),
      ...accounts.flatMap((account) => account.tenant_id ? [account.tenant_id] : []),
    ]))
    const tenantResult = actor.isOwner
      ? await service.from('tenants').select('id, full_name, business_name, phone, user_id').eq('user_id', ownerId).order('full_name')
      : scopedTenantIds.length > 0
        ? await service.from('tenants').select('id, full_name, business_name, phone, user_id').eq('user_id', ownerId).in('id', scopedTenantIds).order('full_name')
      : { data: [], error: null }
    if (tenantResult.error) return NextResponse.json({ error: tenantResult.error.message }, { status: 500 })

    const [readingResult, topupResult, cutoffResult] = accountIds.length > 0
      ? await Promise.all([
          service.from('electricity_readings').select('*').in('account_id', accountIds).order('reading_date', { ascending: false }).order('created_at', { ascending: false }).limit(2000),
          service.from('electricity_topups').select('*').in('account_id', accountIds).order('purchase_date', { ascending: false }).limit(1000),
          service.from('electricity_cutoff_events').select('*').in('account_id', accountIds).order('performed_at', { ascending: false }).limit(1000),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ]

    const secondaryErrors = [readingResult.error, topupResult.error, cutoffResult.error]
    const secondaryError = secondaryErrors.find(Boolean)
    if (secondaryError) return NextResponse.json({ error: secondaryError.message }, { status: 500 })

    const properties = propertyResult.data || []
    const sections = sectionResult.data || []
    const units = unitResult.data || []
    const tenants = tenantResult.data || []
    const tenantsById = new Map((tenantResult.data || []).map((tenant) => [tenant.id, tenant]))
    const unitsById = new Map(units.map((unit) => [unit.id, unit]))
    const sectionsById = new Map(sections.map((section) => [section.id, section]))
    const propertiesById = new Map(properties.map((property) => [property.id, property]))
    const latestReadingByAccount = new Map<string, NonNullable<typeof readingResult.data>[number]>()
    for (const reading of readingResult.data || []) {
      if (!latestReadingByAccount.has(reading.account_id)) latestReadingByAccount.set(reading.account_id, reading)
    }

    const pendingTopupsByAccount = new Map<string, { verifiedUnits: number; reportedUnits: number; count: number }>()
    for (const topup of topupResult.data || []) {
      if (topup.applied_reading_id) continue
      const current = pendingTopupsByAccount.get(topup.account_id) || { verifiedUnits: 0, reportedUnits: 0, count: 0 }
      if (topup.status === 'verified') current.verifiedUnits += Number(topup.units)
      else current.reportedUnits += Number(topup.units)
      current.count += 1
      pendingTopupsByAccount.set(topup.account_id, current)
    }

    const latestCutoffByAccount = new Map<string, NonNullable<typeof cutoffResult.data>[number]>()
    for (const event of cutoffResult.data || []) {
      if (!latestCutoffByAccount.has(event.account_id)) latestCutoffByAccount.set(event.account_id, event)
    }

    const staffPropertyIds = new Map<string, string[]>()
    for (const membership of membershipResult.data || []) {
      const assigned = staffPropertyIds.get(membership.staff_id) || []
      assigned.push(membership.property_id)
      staffPropertyIds.set(membership.staff_id, assigned)
    }

    const enrichedAccounts = accounts.map((account) => {
      const latestReading = latestReadingByAccount.get(account.id) || null
      const pending = pendingTopupsByAccount.get(account.id) || { verifiedUnits: 0, reportedUnits: 0, count: 0 }
      const tenant = account.tenant_id ? tenantsById.get(account.tenant_id) : null
      const unit = account.unit_id ? unitsById.get(account.unit_id) : null
      const section = unit?.section_id ? sectionsById.get(unit.section_id) : null
      const balanceBase = latestReading?.closing_balance_units ?? account.opening_balance_units
      return {
        ...account,
        property_name: propertiesById.get(account.property_id)?.name || 'Property',
        unit_name: unit?.unit_name || null,
        tenant_name: tenant?.full_name || tenant?.business_name || 'Unassigned client',
        tenant_phone: tenant?.phone || null,
        section_name: section?.name || null,
        latest_reading: latestReading,
        pending_verified_topup_units: pending.verifiedUnits,
        pending_reported_topup_units: pending.reportedUnits,
        pending_topup_count: pending.count,
        estimated_balance_units: Number(balanceBase) + pending.verifiedUnits,
        last_cutoff_event: latestCutoffByAccount.get(account.id) || null,
      }
    })

    const staff = (staffResult.data || []).map((item) => ({
      ...item,
      property_ids: staffPropertyIds.get(item.id) || [],
    }))

    return NextResponse.json({
      ownerMode: actor.isOwner,
      currentStaffId: actor.staff?.staff_id || null,
      properties,
      sections,
      units,
      tenants,
      accounts: enrichedAccounts,
      readings: readingResult.data || [],
      topups: topupResult.data || [],
      cutoffEvents: cutoffResult.data || [],
      staff,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load electricity records.' },
      { status: 500 }
    )
  }
}
