import { describe, expect, it } from 'vitest'
import { reconcileMainMeters } from './reconciliation'
import type { ElectricityAccountRow, ElectricityReadingRow } from './database.types'

const main = {
  id: 'main-1', property_id: 'property-1', meter_kind: 'floor_main', floor_label: 'FL1',
  initial_meter_reading: 1000, initial_reading_date: '2026-10-01',
} as ElectricityAccountRow
const firstSubmeter = {
  id: 'sub-1', property_id: 'property-1', meter_kind: 'submeter', floor_label: 'First Floor',
  initial_meter_reading: 200, initial_reading_date: '2026-10-01',
} as ElectricityAccountRow
const secondSubmeter = {
  id: 'sub-2', property_id: 'property-1', meter_kind: 'submeter', floor_label: 'First Floor',
  initial_meter_reading: 300, initial_reading_date: '2026-10-01',
} as ElectricityAccountRow

function reading(accountId: string, start: string | null, end: string, current: number, usage: number) {
  return {
    account_id: accountId,
    previous_reading_date: start,
    reading_date: end,
    current_meter_reading: current,
    usage_units: usage,
  } as ElectricityReadingRow
}

function balance(accountId: string, date: string, remaining: number, added = 0) {
  return {
    account_id: accountId,
    reading_date: date,
    units_remaining: remaining,
    units_purchased_since_previous: added,
  }
}

describe('main meter reconciliation', () => {
  it('compares main LUKU depletion plus added units with exact-period submeter usage', () => {
    const result = reconcileMainMeters(
      [main, firstSubmeter, secondSubmeter],
      [reading('sub-1', '2026-10-01', '2026-10-29', 240, 40), reading('sub-2', '2026-10-01', '2026-10-29', 280, 20)],
      [balance('main-1', '2026-10-01', 100), balance('main-1', '2026-10-29', 20, 10)],
    )[0]

    expect(result).toMatchObject({ status: 'shortage', mainUsage: 90, submeterUsage: 60, difference: 30, matchedSubmeterCount: 2 })
  })

  it('does not call the shortfall final when a submeter has a different period', () => {
    const result = reconcileMainMeters(
      [main, firstSubmeter, secondSubmeter],
      [reading('sub-1', '2026-10-01', '2026-10-29', 240, 40), reading('sub-2', '2026-10-02', '2026-10-29', 280, 20)],
      [balance('main-1', '2026-10-01', 100), balance('main-1', '2026-10-29', 10)],
    )[0]

    expect(result.status).toBe('incomplete')
    expect(result.difference).toBeNull()
    expect(result.unmatchedSubmeters).toEqual([secondSubmeter])
  })

  it('identifies when tenant submeters exceed main-meter usage', () => {
    const result = reconcileMainMeters(
      [main, firstSubmeter],
      [reading('sub-1', '2026-10-01', '2026-10-29', 240, 40)],
      [balance('main-1', '2026-10-01', 100), balance('main-1', '2026-10-29', 80)],
    )[0]

    expect(result).toMatchObject({ status: 'excess', difference: -20 })
  })

  it('shows a baseline without inventing use before a second balance snapshot', () => {
    const result = reconcileMainMeters([main, firstSubmeter], [], [balance('main-1', '2026-10-01', 100)])[0]
    expect(result).toMatchObject({ status: 'baseline', mainCurrentBalance: 100, mainUsage: null, difference: null })
  })

  it('does not infer usage from imported snapshots that have no known recharge amount', () => {
    const result = reconcileMainMeters(
      [main, firstSubmeter],
      [reading('sub-1', '2026-10-01', '2026-10-29', 240, 40)],
      [balance('main-1', '2026-10-01', 100), { ...balance('main-1', '2026-10-29', 80), units_purchased_since_previous: null }],
    )[0]

    expect(result).toMatchObject({ status: 'purchase_unknown', mainUsage: null, difference: null })
  })

  it('flags a balance increase that is larger than the entered recharge', () => {
    const result = reconcileMainMeters(
      [main, firstSubmeter],
      [],
      [balance('main-1', '2026-10-01', 20), balance('main-1', '2026-10-02', 45, 0)],
    )[0]

    expect(result).toMatchObject({ status: 'balance_anomaly', mainUsage: null, unexplainedBalanceIncrease: 25 })
  })
})
