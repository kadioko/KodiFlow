export type FollowUpAccount = {
  id: string
  property_id: string
  active: boolean
  meter_kind: 'submeter' | 'floor_main'
  tenant_name: string
  unit_name: string | null
  floor_label: string
  low_units_threshold: number
  estimated_balance_units: number
  pending_reported_topup_units: number
  latest_reading: { reading_date: string } | null
}

export type FollowUpPriority = 'urgent' | 'low' | 'soon' | 'review'
export type FollowUpAction = 'check' | 'top_up' | 'remind_soon'
export type FollowUpItem = {
  id: string
  client: string
  location: string
  balance: number | null
  readingDate: string | null
  priority: FollowUpPriority
  readingNeedsCheck: boolean
  unconfirmedTopup: boolean
}

export function getFollowUpAction(item: FollowUpItem): FollowUpAction {
  if (item.readingNeedsCheck || item.unconfirmedTopup || item.priority === 'review') return 'check'
  return item.priority === 'soon' ? 'remind_soon' : 'top_up'
}

export function totalNegativeClientBalances(items: FollowUpItem[]): number {
  return items.reduce((total, item) => total + (item.balance !== null && item.balance < 0 ? Math.round(-item.balance * 1000) : 0), 0) / 1000
}

function daysSince(date: string | null, today: string): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null
  const start = Date.parse(`${date}T00:00:00Z`)
  const end = Date.parse(`${today}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null
  return Math.floor((end - start) / 86400000)
}

export function buildElectricityFollowUp(accounts: FollowUpAccount[], today: string): FollowUpItem[] {
  const rank: Record<FollowUpPriority, number> = { urgent: 0, low: 1, soon: 2, review: 3 }
  return accounts.flatMap((account): FollowUpItem[] => {
    if (!account.active || account.meter_kind !== 'submeter') return []
    const readingDate = account.latest_reading?.reading_date || null
    const age = daysSince(readingDate, today)
    const readingNeedsCheck = age === null || age > 4
    const balance = account.estimated_balance_units != null && Number.isFinite(Number(account.estimated_balance_units))
      ? Number(account.estimated_balance_units) : null
    const unconfirmedTopup = Number(account.pending_reported_topup_units) > 0
    const threshold = Math.max(0, Number(account.low_units_threshold) || 0)
    const priority: FollowUpPriority = balance === null ? 'review'
      : balance <= 0 ? 'urgent'
        : balance <= threshold ? 'low'
          : balance <= threshold * 2 ? 'soon' : 'review'
    if (priority === 'review' && !readingNeedsCheck && !unconfirmedTopup) return []
    return [{
      id: account.id,
      client: account.tenant_name,
      location: [account.unit_name, account.floor_label].filter(Boolean).join(' / '),
      balance,
      readingDate,
      priority,
      readingNeedsCheck,
      unconfirmedTopup,
    }]
  }).sort((a, b) => rank[a.priority] - rank[b.priority]
    || (a.balance ?? Infinity) - (b.balance ?? Infinity)
    || a.client.localeCompare(b.client))
}
