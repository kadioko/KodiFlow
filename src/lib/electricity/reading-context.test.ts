import { describe, expect, it } from 'vitest'
import { getElectricityReadingContext } from './reading-context'

const account = {
  initial_meter_reading: 100,
  initial_reading_date: '2026-10-01',
  opening_balance_units: 30,
}

const readings = [
  { reading_date: '2026-10-10', current_meter_reading: 120, closing_balance_units: 15 },
  { reading_date: '2026-10-30', current_meter_reading: 160, closing_balance_units: -5 },
]

describe('electricity reading session context', () => {
  it('uses surrounding readings when a session is entered between existing dates', () => {
    expect(getElectricityReadingContext(account, readings, '2026-10-20')).toMatchObject({
      previousMeterReading: 120,
      previousReadingDate: '2026-10-10',
      previousBalance: 15,
      nextMeterReading: 160,
      nextReadingDate: '2026-10-30',
      isHistorical: true,
      dateAfterBaseline: true,
    })
  })

  it('flags duplicate dates and rejects dates on or before the baseline', () => {
    expect(getElectricityReadingContext(account, readings, '2026-10-10').duplicateDate).toBe(true)
    expect(getElectricityReadingContext(account, readings, '2026-10-01').dateAfterBaseline).toBe(false)
  })

  it('uses the opening meter and balance values before the first saved session', () => {
    expect(getElectricityReadingContext(account, [], '2026-10-05')).toMatchObject({
      previousMeterReading: 100,
      previousReadingDate: '2026-10-01',
      previousBalance: 30,
      nextMeterReading: null,
      isHistorical: false,
    })
  })
})
