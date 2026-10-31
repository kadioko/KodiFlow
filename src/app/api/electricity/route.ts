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
    const [propertyResult, sectionResult, unitResult, accountResult, staffResult, membershipResult, leaseResult, staffLoginResult] = await Promise.all([
      service.from('properties').select('id, name').eq('user_id', ownerId).in('id', propertyIds).order('name'),
      service.from('property_sections').select('id, name, property_id, section_type').eq('user_id', ownerId).in('property_id', propertyIds).order('name'),
      service.from('units').select('id, unit_name, property_id, section_id, unit_identifier').eq('user_id', ownerId).in('property_id', propertyIds).order('unit_name'),
      service.from('electricity_accounts').select('*', { count: 'exact' }).eq('owner_user_id', ownerId).in('property_id', propertyIds).order('floor_label').order('created_at'),
      actor.isOwner
        ? service.from('electricity_staff').select('id, auth_user_id, staff_id, full_name, active, created_at, last_login_at').eq('owner_user_id', ownerId).order('full_name')
        : Promise.resolve({ data: [], error: null }),
      actor.isOwner
        ? service.from('electricity_staff_properties').select('staff_id, property_id').eq('owner_user_id', ownerId).in('property_id', propertyIds)
        : Promise.resolve({ data: [], error: null }),
      service.from('leases').select('tenant_id').eq('user_id', ownerId).in('property_id', propertyIds),
      actor.isOwner
        ? service.from('electricity_staff_login_events').select('id, staff_id, owner_user_id, logged_in_at').eq('owner_user_id', ownerId).order('logged_in_at', { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null }),
    ])

    const initialErrors = [propertyResult.error, sectionResult.error, unitResult.error, accountResult.error, staffResult.error, membershipResult.error, leaseResult.error, staffLoginResult.error]
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

    const [readingResult, topupResult, cutoffResult, adjustmentResult, mainBalanceResult, entryAuditResult] = accountIds.length > 0
      ? await Promise.all([
          service.from('electricity_readings').select('*', { count: 'exact' }).in('account_id', accountIds).is('reversed_at', null).order('created_at', { ascending: false }).limit(2000),
          service.from('electricity_topups').select('*', { count: 'exact' }).in('account_id', accountIds).is('reversed_at', null).order('created_at', { ascending: false }).limit(1000),
          service.from('electricity_cutoff_events').select('*').in('account_id', accountIds).is('reversed_at', null).order('performed_at', { ascending: false }).limit(1000),
          service.from('electricity_balance_adjustments').select('*', { count: 'exact' }).in('account_id', accountIds).is('reversed_at', null).order('created_at', { ascending: false }).limit(1000),
          service.from('electricity_main_meter_balances').select('*', { count: 'exact' }).in('account_id', accountIds).is('reversed_at', null).order('reading_date', { ascending: false }).limit(1000),
          service.from('electricity_entry_audit').select('*').in('account_id', accountIds).order('acted_at', { ascending: false }).limit(1000),
        ])
      : [
          { data: [], error: null, count: 0 },
          { data: [], error: null, count: 0 },
          { data: [], error: null },
          { data: [], error: null, count: 0 },
          { data: [], error: null, count: 0 },
          { data: [], error: null },
        ]

    const secondaryErrors = [readingResult.error, topupResult.error, cutoffResult.error, adjustmentResult.error, entryAuditResult.error]
    const secondaryError = secondaryErrors.find(Boolean)
    if (secondaryError) return NextResponse.json({ error: secondaryError.message }, { status: 500 })
    if (mainBalanceResult.error && !['42P01', 'PGRST205'].includes(mainBalanceResult.error.code)) {
      return NextResponse.json({ error: mainBalanceResult.error.message }, { status: 500 })
    }

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
      const latest = latestReadingByAccount.get(reading.account_id)
      if (!latest || reading.reading_date > latest.reading_date
        || (reading.reading_date === latest.reading_date && reading.created_at > latest.created_at)) {
        latestReadingByAccount.set(reading.account_id, reading)
      }
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

    const pendingAdjustmentsByAccount = new Map<string, { units: number; count: number }>()
    for (const adjustment of adjustmentResult.data || []) {
      if (adjustment.applied_reading_id) continue
      const current = pendingAdjustmentsByAccount.get(adjustment.account_id) || { units: 0, count: 0 }
      current.units += Number(adjustment.adjustment_units)
      current.count += 1
      pendingAdjustmentsByAccount.set(adjustment.account_id, current)
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
      const pendingAdjustment = pendingAdjustmentsByAccount.get(account.id) || { units: 0, count: 0 }
      const tenant = account.tenant_id ? tenantsById.get(account.tenant_id) : null
      const unit = account.unit_id ? unitsById.get(account.unit_id) : null
      const section = unit?.section_id ? sectionsById.get(unit.section_id) : null
      const balanceBase = latestReading?.closing_balance_units ?? account.opening_balance_units
      return {
        ...account,
        property_name: propertiesById.get(account.property_id)?.name || 'Property',
        unit_name: unit?.unit_name || null,
        tenant_name: account.display_name || account.ledger_tenant_label || tenant?.full_name || tenant?.business_name || 'Unassigned client',
        tenant_phone: tenant?.phone || null,
        section_name: section?.name || null,
        latest_reading: latestReading,
        pending_verified_topup_units: pending.verifiedUnits,
        pending_reported_topup_units: pending.reportedUnits,
        pending_topup_count: pending.count,
        pending_adjustment_units: pendingAdjustment.units,
        pending_adjustment_count: pendingAdjustment.count,
        estimated_balance_units: Number(balanceBase) + pending.verifiedUnits + pendingAdjustment.units,
        last_cutoff_event: latestCutoffByAccount.get(account.id) || null,
      }
    })

    const staffUsers = new Set((staffResult.data || []).map((item) => item.auth_user_id))
    const lastActivityByUser = new Map<string, { occurred_at: string; action: 'reading' | 'topup' | 'topup_verified' | 'adjustment' | 'disconnected' | 'restored'; account_label: string }>()
    const recordStaffActivity = (
      userId: string,
      occurredAt: string,
      action: 'reading' | 'topup' | 'topup_verified' | 'adjustment' | 'disconnected' | 'restored',
      accountId: string,
    ) => {
      if (!staffUsers.has(userId)) return
      const current = lastActivityByUser.get(userId)
      if (current && current.occurred_at >= occurredAt) return
      const account = enrichedAccounts.find((item) => item.id === accountId)
      const accountLabel = account
        ? account.meter_kind === 'floor_main' ? `${account.floor_label} main meter` : `${account.tenant_name} · ${account.unit_name || account.floor_label}`
        : 'Electricity meter'
      lastActivityByUser.set(userId, { occurred_at: occurredAt, action, account_label: accountLabel })
    }

    for (const reading of readingResult.data || []) recordStaffActivity(reading.recorded_by, reading.created_at, 'reading', reading.account_id)
    for (const topup of topupResult.data || []) {
      recordStaffActivity(topup.recorded_by, topup.created_at, 'topup', topup.account_id)
      if (topup.status === 'verified' && topup.verified_at && topup.verified_by) {
        recordStaffActivity(topup.verified_by, topup.verified_at, 'topup_verified', topup.account_id)
      }
    }
    for (const event of cutoffResult.data || []) recordStaffActivity(event.performed_by, event.performed_at, event.action, event.account_id)
    for (const adjustment of adjustmentResult.data || []) recordStaffActivity(adjustment.recorded_by, adjustment.created_at, 'adjustment', adjustment.account_id)

    const staff = (staffResult.data || []).map((item) => ({
      ...item,
      property_ids: staffPropertyIds.get(item.id) || [],
      last_activity: lastActivityByUser.get(item.auth_user_id) || null,
    }))
    const staffById = new Map(staff.map((item) => [item.id, item]))
    const staffNamesByAuthId = new Map(staff.map((item) => [item.auth_user_id, item.full_name || item.staff_id]))
    if (actor.staff) staffNamesByAuthId.set(actor.user.id, actor.staff.full_name || actor.staff.staff_id)
    const actorName = (userId: string) => staffNamesByAuthId.get(userId)
      || (userId === ownerId ? 'Owner' : userId === actor.user.id ? actor.staff?.staff_id || actor.user.email || 'You' : userId.slice(0, 8))
    const staffLoginEvents = (staffLoginResult.data || []).map((event) => ({
      ...event,
      staff_name: staffById.get(event.staff_id)?.full_name || 'Staff',
      staff_code: staffById.get(event.staff_id)?.staff_id || '',
    }))

    return NextResponse.json({
      ownerMode: actor.isOwner,
      currentUserId: actor.user.id,
      currentStaffId: actor.staff?.staff_id || null,
      coverageDataTruncated: accountResult.count === null || accountResult.count > accounts.length
        || [readingResult, topupResult, adjustmentResult, mainBalanceResult]
          .some((result) => Boolean(result.error) || result.count === null || result.count > (result.data?.length || 0)),
      properties,
      sections,
      units,
      tenants,
      accounts: enrichedAccounts,
      readings: readingResult.data || [],
      mainMeterBalances: mainBalanceResult.data || [],
      topups: (topupResult.data || []).map((topup) => ({
        ...topup,
        verified_by_name: topup.verified_by ? actorName(topup.verified_by) : null,
        recorded_by_name: actorName(topup.recorded_by),
      })),
      cutoffEvents: cutoffResult.data || [],
      adjustments: adjustmentResult.data || [],
      entryAudit: (entryAuditResult.data || []).map((event) => ({ ...event, actor_name: actorName(event.acted_by) })),
      staff,
      staffLoginEvents,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load electricity records.' },
      { status: 500 }
    )
  }
}
