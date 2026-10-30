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

describe('main meter reconciliation', () => {
  it('reports exact unaccounted units only when all submeters cover the same period', () => {
    const result = reconcileMainMeters(
      [main, firstSubmeter, secondSubmeter],
      [reading('main-1', '2026-10-01', '2026-10-29', 1090, 90), reading('sub-1', '2026-10-01', '2026-10-29', 240, 40), reading('sub-2', '2026-10-01', '2026-10-29', 280, 20)],
    )[0]

    expect(result).toMatchObject({ status: 'shortage', mainUsage: 90, submeterUsage: 60, difference: 30, matchedSubmeterCount: 2 })
  })

  it('does not call the shortfall final when a submeter has a different period', () => {
    const result = reconcileMainMeters(
      [main, firstSubmeter, secondSubmeter],
      [reading('main-1', '2026-10-01', '2026-10-29', 1090, 90), reading('sub-1', '2026-10-01', '2026-10-29', 240, 40), reading('sub-2', '2026-10-02', '2026-10-29', 280, 20)],
    )[0]

    expect(result.status).toBe('incomplete')
    expect(result.difference).toBeNull()
    expect(result.unmatchedSubmeters).toEqual([secondSubmeter])
  })

  it('identifies when tenant submeters exceed main-meter usage', () => {
    const result = reconcileMainMeters(
      [main, firstSubmeter],
      [reading('main-1', '2026-10-01', '2026-10-29', 1020, 20), reading('sub-1', '2026-10-01', '2026-10-29', 240, 40)],
    )[0]

    expect(result).toMatchObject({ status: 'excess', difference: -20 })
  })

  it('shows a dated baseline without inventing usage when the main has no reading history', () => {
    const result = reconcileMainMeters([main, firstSubmeter], [])[0]
    expect(result).toMatchObject({ status: 'baseline', mainCurrentReading: 1000, mainUsage: null, difference: null })
  })
})
