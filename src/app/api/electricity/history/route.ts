import { NextResponse, type NextRequest } from 'next/server'
import { canAccessElectricityProperty, getElectricityActor } from '@/lib/electricity/server'
import type { ElectricityHistoryRecord, ElectricityHistoryType } from '@/lib/electricity/history'

export const dynamic = 'force-dynamic'

const historyTypes = new Set<ElectricityHistoryType>(['topups', 'readings', 'main_balances', 'adjustments', 'cutoff', 'audit'])
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const pageSize = 40

function normalizeSearch(value: string | null) {
  return (value || '').normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 100)
}

function normalizeRecord(type: ElectricityHistoryType, source: Record<string, unknown>): ElectricityHistoryRecord {
  const occurredAt = type === 'cutoff'
    ? String(source.performed_at)
    : type === 'audit'
      ? String(source.acted_at)
      : String(source.created_at)
  const actorId = type === 'cutoff'
    ? source.performed_by
    : type === 'audit'
      ? source.acted_by
      : source.recorded_by
  return {
    id: String(source.id),
    type,
    accountId: String(source.account_id),
    occurredAt,
    actorId: typeof actorId === 'string' ? actorId : null,
    actorName: '',
    confirmedAt: type === 'topups' && typeof source.verified_at === 'string' ? source.verified_at : null,
    confirmedByName: null,
    reversedAt: typeof source.reversed_at === 'string' ? source.reversed_at : null,
    reversedByName: null,
    reversalReason: typeof source.reversal_reason === 'string' ? source.reversal_reason : null,
    payload: source,
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to search electricity history.' }, { status: 401 })

    const params = new URL(request.url).searchParams
    const propertyId = params.get('propertyId') || ''
    const typeValue = params.get('type') as ElectricityHistoryType | null
    const type = typeValue && historyTypes.has(typeValue) ? typeValue : 'topups'
    const accountId = params.get('accountId') || ''
    const search = normalizeSearch(params.get('search'))
    const from = params.get('from') || ''
    const to = params.get('to') || ''
    const status = params.get('status') || 'all'
    const requestedPage = Number(params.get('page'))
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1

    if (!propertyId || !canAccessElectricityProperty(actor, propertyId)) {
      return NextResponse.json({ error: 'You do not have access to this property.' }, { status: 403 })
    }
    if ((from && !datePattern.test(from)) || (to && !datePattern.test(to)) || (from && to && from > to)) {
      return NextResponse.json({ error: 'Enter a valid date range.' }, { status: 400 })
    }

    const accountResult = await actor.service.from('electricity_accounts')
      .select('id')
      .eq('owner_user_id', actor.ownerUserId)
      .eq('property_id', propertyId)
    if (accountResult.error) return NextResponse.json({ error: accountResult.error.message }, { status: 500 })
    const accountIds = (accountResult.data || []).map((item) => item.id)
    if (accountId && !accountIds.includes(accountId)) {
      return NextResponse.json({ error: 'This meter is not available in the selected property.' }, { status: 403 })
    }
    if (accountIds.length === 0) return NextResponse.json({ rows: [], total: 0, page, pageSize })

    const scopedAccountIds = accountId ? [accountId] : accountIds
    const rangeFrom = (page - 1) * pageSize
    const rangeTo = rangeFrom + pageSize - 1
    let rawRows: Record<string, unknown>[] = []
    let total = 0
    let queryError: string | null = null

    if (type === 'topups') {
      let query = actor.service.from('electricity_topups').select('*', { count: 'exact' }).in('account_id', scopedAccountIds)
      if (from) query = query.gte('purchase_date', from)
      if (to) query = query.lte('purchase_date', to)
      if (status === 'reported' || status === 'verified') query = query.eq('status', status).is('reversed_at', null)
      else if (status === 'reversed') query = query.not('reversed_at', 'is', null)
      else if (status === 'active') query = query.is('reversed_at', null)
      if (search) query = /^\d+$/.test(search) ? query.ilike('token_code', `%${search}%`) : query.ilike('notes', `%${search}%`)
      const result = await query.order('purchase_date', { ascending: false }).order('created_at', { ascending: false }).range(rangeFrom, rangeTo)
      rawRows = (result.data || []) as unknown as Record<string, unknown>[]
      total = result.count || 0
      queryError = result.error?.message || null
    } else if (type === 'readings') {
      let query = actor.service.from('electricity_readings').select('*', { count: 'exact' }).in('account_id', scopedAccountIds)
      if (from) query = query.gte('reading_date', from)
      if (to) query = query.lte('reading_date', to)
      if (status === 'reversed') query = query.not('reversed_at', 'is', null)
      else if (status === 'active') query = query.is('reversed_at', null)
      if (search) query = query.ilike('notes', `%${search}%`)
      const result = await query.order('reading_date', { ascending: false }).order('created_at', { ascending: false }).range(rangeFrom, rangeTo)
      rawRows = (result.data || []) as unknown as Record<string, unknown>[]
      total = result.count || 0
      queryError = result.error?.message || null
    } else if (type === 'main_balances') {
      let query = actor.service.from('electricity_main_meter_balances').select('*', { count: 'exact' }).in('account_id', scopedAccountIds)
      if (from) query = query.gte('reading_date', from)
      if (to) query = query.lte('reading_date', to)
      if (status === 'reversed') query = query.not('reversed_at', 'is', null)
      else if (status === 'active') query = query.is('reversed_at', null)
      if (search) query = query.ilike('notes', `%${search}%`)
      const result = await query.order('reading_date', { ascending: false }).order('created_at', { ascending: false }).range(rangeFrom, rangeTo)
      rawRows = (result.data || []) as unknown as Record<string, unknown>[]
      total = result.count || 0
      queryError = result.error?.message || null
    } else if (type === 'adjustments') {
      let query = actor.service.from('electricity_balance_adjustments').select('*', { count: 'exact' }).in('account_id', scopedAccountIds)
      if (from) query = query.gte('adjustment_date', from)
      if (to) query = query.lte('adjustment_date', to)
      if (status === 'reversed') query = query.not('reversed_at', 'is', null)
      else if (status === 'active') query = query.is('reversed_at', null)
      if (search) query = query.ilike('reason', `%${search}%`)
      const result = await query.order('adjustment_date', { ascending: false }).order('created_at', { ascending: false }).range(rangeFrom, rangeTo)
      rawRows = (result.data || []) as unknown as Record<string, unknown>[]
      total = result.count || 0
      queryError = result.error?.message || null
    } else if (type === 'cutoff') {
      let query = actor.service.from('electricity_cutoff_events').select('*', { count: 'exact' }).in('account_id', scopedAccountIds)
      if (from) query = query.gte('performed_at', `${from}T00:00:00+03:00`)
      if (to) query = query.lte('performed_at', `${to}T23:59:59.999+03:00`)
      if (status === 'reversed') query = query.not('reversed_at', 'is', null)
      else if (status === 'active') query = query.is('reversed_at', null)
      if (search) query = query.ilike('reason', `%${search}%`)
      const result = await query.order('performed_at', { ascending: false }).range(rangeFrom, rangeTo)
      rawRows = (result.data || []) as unknown as Record<string, unknown>[]
      total = result.count || 0
      queryError = result.error?.message || null
    } else {
      let query = actor.service.from('electricity_entry_audit').select('*', { count: 'exact' }).in('account_id', scopedAccountIds)
      if (from) query = query.gte('acted_at', `${from}T00:00:00+03:00`)
      if (to) query = query.lte('acted_at', `${to}T23:59:59.999+03:00`)
      if (status === 'confirmed' || status === 'edited' || status === 'reversed') query = query.eq('action', status)
      if (search) query = query.ilike('reason', `%${search}%`)
      const result = await query.order('acted_at', { ascending: false }).range(rangeFrom, rangeTo)
      rawRows = (result.data || []) as unknown as Record<string, unknown>[]
      total = result.count || 0
      queryError = result.error?.message || null
    }

    if (queryError) return NextResponse.json({ error: queryError }, { status: 500 })
    const rows = rawRows.map((row) => normalizeRecord(type, row))
    const userIds = Array.from(new Set(rows.flatMap((row) => {
      const confirmedById = row.type === 'topups' ? row.payload.verified_by : null
      const reversedById = row.payload.reversed_by
      return [row.actorId, confirmedById, reversedById].filter((id): id is string => typeof id === 'string')
    })))
    const staffResult = userIds.length > 0
      ? await actor.service.from('electricity_staff').select('auth_user_id, full_name, staff_id').eq('owner_user_id', actor.ownerUserId).in('auth_user_id', userIds)
      : { data: [], error: null }
    if (staffResult.error) return NextResponse.json({ error: staffResult.error.message }, { status: 500 })
    const staffNames = new Map((staffResult.data || []).map((member) => [member.auth_user_id, member.full_name || member.staff_id]))
    const actorName = (userId: unknown) => typeof userId !== 'string'
      ? '—'
      : staffNames.get(userId) || (userId === actor.ownerUserId ? (actor.isOwner ? actor.user.email || 'Owner' : 'Owner') : userId.slice(0, 8))

    return NextResponse.json({
      rows: rows.map((row) => ({
        ...row,
        actorName: actorName(row.actorId),
        confirmedByName: actorName(row.payload.verified_by),
        reversedByName: actorName(row.payload.reversed_by),
      })),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not search electricity history.' }, { status: 500 })
  }
}
