import { describe, expect, it } from 'vitest'
import { calculateInvoiceTotal, calculatePaymentBalance, createProfileInsert, getBillingPeriod } from './billing'

describe('billing helpers', () => {
  it('calculates six-month invoice totals from monthly rent and charges', () => {
    expect(calculateInvoiceTotal(200000, [50000, 10000], 'semi_annually')).toBe(1560000)
  })

  it('calculates six-month billing period dates', () => {
    const period = getBillingPeriod(2026, 1, 'semi_annually')

    expect(period.months).toBe(6)
    expect(period.periodStart.toISOString().split('T')[0]).toBe('2026-01-01')
    expect(period.periodEnd.toISOString().split('T')[0]).toBe('2026-06-30')
  })

  it('calculates payment balance after recording payment', () => {
    expect(calculatePaymentBalance(500000, 100000, 250000)).toBe(150000)
  })

  it('creates the registration profile payload', () => {
    expect(createProfileInsert('user-id', 'Dora Tower')).toEqual({
      id: 'user-id',
      full_name: 'Dora Tower',
      currency_preference: 'TZS',
    })
  })
})
