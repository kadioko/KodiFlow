import { describe, expect, it } from 'vitest'
import { calculateFloorCreditCoverage, type CreditMeter } from './floor-credit-coverage'

const date = '2026-10-30'
const main: CreditMeter = { id: 'main', property_id: 'p', meter_kind: 'floor_main', floor_label: 'First Floor', tenant_name: '', initial_reading_date: date, low_units_threshold: 50, estimated_balance_units: 0, pending_reported_topup_units: 0, latest_reading: null }
const client = (id: string, balance: number, overrides: Partial<CreditMeter> = {}): CreditMeter => ({
  id, property_id: 'p', meter_kind: 'submeter', floor_label: 'FL1', tenant_name: id, initial_reading_date: date,
  low_units_threshold: 10, estimated_balance_units: balance, pending_reported_topup_units: 0, latest_reading: { reading_date: date }, ...overrides,
})
const snapshot = (remaining: number, readingDate = date) => ({ account_id: 'main', reading_date: readingDate, units_remaining: remaining })
const calculate = (accounts: CreditMeter[], remaining: number, options: { today: string; dataTruncated?: boolean } = { today: date }) =>
  calculateFloorCreditCoverage(accounts, [snapshot(remaining)], options)

describe('floor credit coverage', () => {
  it('shows the credit shortfall and the additional top-up needed to restore the reserve', () => {
    const report = calculate([main, client('a', 200), client('b', 150)], 200).floors[0]
    expect(report).toMatchObject({ clientCredits: 350, mainRemaining: 200, clientShortfall: 150, reserve: 50, suggestedTopup: 200, status: 'shortfall', issues: [] })
  })

  it('does not let a negative client balance cancel another client’s credit', () => {
    expect(calculate([main, client('a', 100), client('b', -80)], 120).floors[0])
      .toMatchObject({ clientCredits: 100, clientShortfall: 0, suggestedTopup: 30, status: 'needs_review', issues: ['negative_clients'] })
  })

  it('shows covered only when there is enough reserve and the readings match and are current', () => {
    expect(calculate([main, client('a', 100)], 160).floors[0])
      .toMatchObject({ clientCredits: 100, suggestedTopup: 0, status: 'covered', issues: [] })
  })

  it('warns when client credits are covered but the safety reserve is too small', () => {
    expect(calculate([main, client('a', 100)], 120).floors[0])
      .toMatchObject({ clientShortfall: 0, suggestedTopup: 30, status: 'reserve_low', issues: [] })
  })

  it('flags readings older than four days even if the two reading dates match', () => {
    const old = '2026-10-25'
    const result = calculateFloorCreditCoverage([main, client('a', 20, { latest_reading: { reading_date: old } })], [snapshot(200, old)], { today: date }).floors[0]
    expect(result).toMatchObject({ status: 'needs_review', issues: ['main_stale', 'client_stale'] })
  })

  it('treats recent readings on different days as provisional', () => {
    const result = calculateFloorCreditCoverage([main, client('a', 20)], [snapshot(200, '2026-10-29')], { today: date }).floors[0]
    expect(result).toMatchObject({ status: 'needs_review', issues: ['dates_differ'] })
  })

  it('flags zero main credit even when other information is missing', () => {
    expect(calculate([main], 0).floors[0]).toMatchObject({ mainRemaining: 0, status: 'empty', issues: ['no_clients'] })
  })

  it('does not call a stale or differently dated estimate covered', () => {
    const oldClient = client('a', 20, { latest_reading: { reading_date: '2026-10-01' } })
    expect(calculate([main, oldClient], 200).floors[0]).toMatchObject({ status: 'needs_review', issues: ['client_stale', 'dates_differ'] })
    expect(calculateFloorCreditCoverage([main, client('a', 20)], [snapshot(200, '2026-10-01')], { today: date }).floors[0])
      .toMatchObject({ status: 'needs_review', issues: ['main_stale', 'dates_differ'] })
  })

  it('keeps a detected shortfall visible while explaining that the estimate needs review', () => {
    const report = calculate([main, client('a', 300, { pending_reported_topup_units: 20 })], 100, { today: date, dataTruncated: true }).floors[0]
    expect(report).toMatchObject({ status: 'shortfall', clientShortfall: 200, suggestedTopup: 250, issues: ['unconfirmed', 'truncated'] })
  })

  it('does not assign a client when the floor has multiple matching main meters', () => {
    const result = calculate([main, { ...main, id: 'second', floor_label: 'FL1' }, client('a', 100)], 200)
    expect(result.unassignedClients.map((item) => item.id)).toEqual(['a'])
    expect(result.floors[0]).toMatchObject({ clientCredits: null, suggestedTopup: null, status: 'needs_review' })
    expect(result.floors[0].issues).toContain('ambiguous_main')
  })

  it('flags unmatched clients and does not mark another floor as covered', () => {
    const result = calculate([main, client('a', 20), client('unknown', 40, { floor_label: 'Unknown' })], 200)
    expect(result.unassignedClients.map((item) => item.id)).toEqual(['unknown'])
    expect(result.floors[0]).toMatchObject({ status: 'needs_review', issues: ['unassigned'] })
  })

  it('does not treat a missing main reading, client balance, or reserve as zero', () => {
    const missingClient = client('a', NaN)
    const result = calculateFloorCreditCoverage([{ ...main, low_units_threshold: 0 }, missingClient], [], { today: date }).floors[0]
    expect(result).toMatchObject({ mainRemaining: null, clientCredits: null, suggestedTopup: null, status: 'needs_review' })
    expect(result.issues).toEqual(expect.arrayContaining(['main_missing', 'client_missing', 'buffer_missing']))
  })
})
