import { describe, expect, it } from 'vitest'
import { calculateMainMeterUsage, classifyMainMeterBalance, estimateMainMeterDaysRemaining } from './main-meter-balance'

const snapshot = (date: string, remaining: number, added: number | null = 0) => ({
  reading_date: date,
  units_remaining: remaining,
  units_purchased_since_previous: added,
})

describe('TANESCO main LUKU balance tracking', () => {
  it('calculates use from previous credit, recharge units, and current credit', () => {
    expect(calculateMainMeterUsage(snapshot('2026-10-01', 100), snapshot('2026-10-03', 40, 20))).toBe(80)
  })

  it('does not invent consumption when older imported records lack recharge data', () => {
    expect(calculateMainMeterUsage(snapshot('2026-10-01', 100), snapshot('2026-10-03', 40, null))).toBeNull()
  })

  it('estimates time to empty only when recent use can be calculated', () => {
    expect(estimateMainMeterDaysRemaining(snapshot('2026-10-01', 100), snapshot('2026-10-03', 60, 0))).toBe(3)
    expect(estimateMainMeterDaysRemaining(snapshot('2026-10-01', 100), snapshot('2026-10-03', 120, null))).toBeNull()
  })

  it('treats zero as exhausted even when the balance reading is old', () => {
    expect(classifyMainMeterBalance({
      balanceUnits: 0,
      lowThresholdUnits: 50,
      readingDate: '2026-10-01',
      today: '2026-10-30',
    })).toBe('exhausted')
  })

  it('warns at the low threshold and at twice the threshold', () => {
    const shared = { lowThresholdUnits: 50, readingDate: '2026-10-29', today: '2026-10-30' }
    expect(classifyMainMeterBalance({ ...shared, balanceUnits: 40 })).toBe('low')
    expect(classifyMainMeterBalance({ ...shared, balanceUnits: 90 })).toBe('soon')
    expect(classifyMainMeterBalance({ ...shared, balanceUnits: 150 })).toBe('okay')
  })

  it('requires a fresh snapshot when there is no balance or it is older than a week', () => {
    expect(classifyMainMeterBalance({
      balanceUnits: null,
      lowThresholdUnits: 50,
      readingDate: null,
      today: '2026-10-30',
    })).toBe('reading_due')
    expect(classifyMainMeterBalance({
      balanceUnits: 200,
      lowThresholdUnits: 50,
      readingDate: '2026-10-22',
      today: '2026-10-30',
    })).toBe('reading_due')
  })
})
