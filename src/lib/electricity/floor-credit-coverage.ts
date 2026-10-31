import { roundUnits } from './balance'
import { normalizeElectricityFloor } from './reconciliation'

export type CreditMeter = {
  id: string
  property_id: string
  meter_kind: 'floor_main' | 'submeter'
  floor_label: string
  tenant_name?: string
  unit_name?: string | null
  initial_reading_date: string
  low_units_threshold: number
  estimated_balance_units: number
  pending_reported_topup_units: number
  latest_reading: { reading_date: string } | null
}

export type MainCreditSnapshot = { account_id: string; reading_date: string; units_remaining: number | string }
export type CoverageIssue = 'main_missing' | 'main_stale' | 'no_clients' | 'ambiguous_main' | 'unassigned' | 'client_missing' | 'client_stale' | 'dates_differ' | 'unconfirmed' | 'negative_clients' | 'truncated' | 'buffer_missing'
export type FloorCreditCoverage = {
  main: CreditMeter
  clients: CreditMeter[]
  mainSnapshot: MainCreditSnapshot | null
  mainRemaining: number | null
  clientCredits: number | null
  clientShortfall: number | null
  reserve: number | null
  suggestedTopup: number | null
  issues: CoverageIssue[]
  staleClients: CreditMeter[]
  unconfirmedClients: CreditMeter[]
  status: 'empty' | 'shortfall' | 'needs_review' | 'reserve_low' | 'covered'
}

function isCurrentDate(value: string | null | undefined, today: string, maxAgeDays: number) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = Date.parse(`${value}T00:00:00Z`)
  const current = Date.parse(`${today}T00:00:00Z`)
  const age = (current - date) / 86_400_000
  return Number.isFinite(age) && age >= 0 && age <= maxAgeDays
}

export function calculateFloorCreditCoverage(
  accounts: CreditMeter[],
  snapshots: MainCreditSnapshot[],
  options: { today: string; maxAgeDays?: number; dataTruncated?: boolean },
) {
  const mains = accounts.filter((account) => account.meter_kind === 'floor_main')
  const clients = accounts.filter((account) => account.meter_kind === 'submeter')
  const floorMatches = (left: CreditMeter, right: CreditMeter) => {
    const floor = normalizeElectricityFloor(left.floor_label)
    return Boolean(floor) && left.property_id === right.property_id && floor === normalizeElectricityFloor(right.floor_label)
  }
  const matchingMains = (client: CreditMeter) => mains.filter((main) => floorMatches(main, client))
  const unassignedClients = clients.filter((client) => matchingMains(client).length !== 1)
  const maxAgeDays = options.maxAgeDays ?? 4

  const floors: FloorCreditCoverage[] = mains.map((main) => {
    const sameFloorMains = mains.filter((candidate) => floorMatches(main, candidate))
    const associated = clients.filter((client) => floorMatches(main, client) && matchingMains(client).length === 1)
    const latest = snapshots.filter((snapshot) => snapshot.account_id === main.id)
      .sort((left, right) => right.reading_date.localeCompare(left.reading_date))[0] || null
    const parsedMain = latest && latest.units_remaining !== null ? Number(latest.units_remaining) : NaN
    const mainRemaining = Number.isFinite(parsedMain) && parsedMain >= 0 ? parsedMain : null
    const parsedReserve = Number(main.low_units_threshold)
    const reserve = Number.isFinite(parsedReserve) && parsedReserve > 0 ? parsedReserve : null
    const knownClients = associated.filter((client) => client.estimated_balance_units !== null && client.estimated_balance_units !== undefined && Number.isFinite(Number(client.estimated_balance_units)))
    const clientCredits = associated.length > 0 && knownClients.length > 0
      ? roundUnits(knownClients.reduce((sum, client) => sum + Math.max(0, Number(client.estimated_balance_units)), 0))
      : null
    const clientShortfall = mainRemaining !== null && clientCredits !== null ? roundUnits(Math.max(0, clientCredits - mainRemaining)) : null
    const suggestedTopup = mainRemaining !== null && clientCredits !== null && reserve !== null
      ? roundUnits(Math.max(0, clientCredits + reserve - mainRemaining)) : null
    const staleClients = associated.filter((client) => !isCurrentDate(client.latest_reading?.reading_date || client.initial_reading_date, options.today, maxAgeDays))
    const unconfirmedClients = associated.filter((client) => Number(client.pending_reported_topup_units) > 0)
    const issues: CoverageIssue[] = []
    if (!latest || mainRemaining === null) issues.push('main_missing')
    else if (!isCurrentDate(latest.reading_date, options.today, maxAgeDays)) issues.push('main_stale')
    if (sameFloorMains.length !== 1) issues.push('ambiguous_main')
    if (associated.length === 0) issues.push('no_clients')
    if (unassignedClients.some((client) => client.property_id === main.property_id)) issues.push('unassigned')
    if (knownClients.length !== associated.length) issues.push('client_missing')
    if (staleClients.length) issues.push('client_stale')
    if (latest && associated.some((client) => (client.latest_reading?.reading_date || client.initial_reading_date) !== latest.reading_date)) issues.push('dates_differ')
    if (unconfirmedClients.length) issues.push('unconfirmed')
    if (knownClients.some((client) => Number(client.estimated_balance_units) < 0)) issues.push('negative_clients')
    if (options.dataTruncated) issues.push('truncated')
    if (reserve === null) issues.push('buffer_missing')

    const status = mainRemaining === 0 ? 'empty'
      : clientShortfall !== null && clientShortfall > 0 ? 'shortfall'
        : issues.length > 0 ? 'needs_review'
          : suggestedTopup !== null && suggestedTopup > 0 ? 'reserve_low' : 'covered'
    return { main, clients: associated, mainSnapshot: latest, mainRemaining, clientCredits, clientShortfall, reserve, suggestedTopup, issues, staleClients, unconfirmedClients, status }
  })
  return { floors, unassignedClients }
}
