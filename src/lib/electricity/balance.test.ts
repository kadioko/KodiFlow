import { describe, expect, it } from 'vitest'
import { calculateElectricityBalance, classifyElectricityBalance, roundUnits } from './balance'

describe('electricity unit balance', () => {
  it('carries opening units and verified tenant top-ups against measured usage', () => {
    expect(calculateElectricityBalance({
      previousMeterReading: 120.25,
      currentMeterReading: 145.5,
      openingBalanceUnits: 18,
      verifiedTopupUnits: 50,
    })).toEqual({ usageUnits: 25.25, closingBalanceUnits: 42.75 })
  })

  it('allows a negative estimate so missing top-ups are visible instead of hidden', () => {
    expect(calculateElectricityBalance({
      previousMeterReading: 20,
      currentMeterReading: 35,
      openingBalanceUnits: 5,
      verifiedTopupUnits: 0,
    }).closingBalanceUnits).toBe(-10)
  })

  it('rounds negative half-thousandth values away from zero like PostgreSQL numeric', () => {
    expect(roundUnits(-1.2345)).toBe(-1.235)
    expect(roundUnits(1.2345)).toBe(1.235)
  })

  it('rejects a backwards meter reading', () => {
    expect(() => calculateElectricityBalance({
      previousMeterReading: 50,
      currentMeterReading: 49,
      openingBalanceUnits: 10,
      verifiedTopupUnits: 0,
    })).toThrow('Current meter reading cannot be below the previous reading.')
  })

  it('includes an audited owner correction in the estimated carried balance', () => {
    expect(calculateElectricityBalance({
      previousMeterReading: 100,
      currentMeterReading: 110,
      openingBalanceUnits: 20,
      verifiedTopupUnits: 0,
      adjustmentUnits: 5,
    })).toEqual({ usageUnits: 10, closingBalanceUnits: 15 })
  })

  it('marks estimates from an old reading as needing a fresh check', () => {
    expect(classifyElectricityBalance({
      balanceUnits: 0,
      lowThresholdUnits: 10,
      readingDate: '2026-09-01',
      today: new Date('2026-10-30T12:00:00'),
    })).toBe('reading_due')
  })

  it('separates exhausted, low, soon, and healthy balances', () => {
    const base = { lowThresholdUnits: 10, readingDate: '2026-10-29', today: new Date('2026-10-30T12:00:00') }
    expect(classifyElectricityBalance({ ...base, balanceUnits: 0 })).toBe('exhausted')
    expect(classifyElectricityBalance({ ...base, balanceUnits: 8 })).toBe('low')
    expect(classifyElectricityBalance({ ...base, balanceUnits: 18 })).toBe('soon')
    expect(classifyElectricityBalance({ ...base, balanceUnits: 25 })).toBe('okay')
  })
})
