import { describe, expect, it } from 'vitest'
import {
  calculateChargeAmountForPeriod,
  calculateInvoiceTotal,
  calculatePaymentBalance,
  createProfileInsert,
  getBillingPeriod,
  getLeaseBillingPeriod,
  getRenewalTerm,
  isBillingPeriodOnCadence,
  isBillingPeriodWithinLease,
} from './billing'
import { calculateLateFee, calculateNetIncome } from './finance'

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

  it.each([
    ['monthly', '2026-01-31', '2026-02-01', '2026-02-28'],
    ['quarterly', '2026-03-31', '2026-04-01', '2026-06-30'],
    ['semi_annually', '2026-06-30', '2026-07-01', '2026-12-31'],
    ['annually', '2026-12-31', '2027-01-01', '2027-12-31'],
  ])('calculates %s renewal terms from the previous lease end date', (frequency, previousEndDate, expectedStart, expectedEnd) => {
    expect(getRenewalTerm(previousEndDate, frequency)).toMatchObject({
      startDate: expectedStart,
      endDate: expectedEnd,
    })
  })

  it('calculates non-monthly charge amounts without treating them as monthly', () => {
    expect(calculateChargeAmountForPeriod(100000, 'monthly', 'quarterly')).toBe(300000)
    expect(calculateChargeAmountForPeriod(100000, 'quarterly', 'quarterly')).toBe(100000)
    expect(calculateChargeAmountForPeriod(100000, 'quarterly', 'monthly')).toBe(0)
    expect(calculateChargeAmountForPeriod(100000, 'annually', 'annually')).toBe(100000)
    expect(calculateChargeAmountForPeriod(100000, 'one_time', 'annually')).toBe(100000)
  })

  it('allows invoice billing to start from any selected month on or after the lease start month', () => {
    expect(isBillingPeriodOnCadence('2026-01-01', 2026, 1, 'quarterly')).toBe(true)
    expect(isBillingPeriodOnCadence('2026-01-01', 2026, 2, 'quarterly')).toBe(true)
    expect(isBillingPeriodWithinLease('2026-01-01', '2026-03-31', 2026, 1, 'quarterly')).toBe(true)
    expect(isBillingPeriodWithinLease('2026-01-01', '2026-03-31', 2026, 2, 'quarterly')).toBe(true)
    expect(isBillingPeriodWithinLease('2026-01-01', '2026-03-31', 2026, 4, 'quarterly')).toBe(false)
  })

  it('allows the last invoice period to be clipped to the lease end date', () => {
    expect(isBillingPeriodWithinLease('2025-12-01', '2026-05-30', 2025, 12, 'semi_annually')).toBe(true)
  })

  it('anchors invoice billing periods to the original lease start day', () => {
    const quarterlyPeriod = getLeaseBillingPeriod('2026-05-15', 2026, 8, 'quarterly')

    expect(quarterlyPeriod?.periodStart.toISOString().split('T')[0]).toBe('2026-08-15')
    expect(quarterlyPeriod?.periodEnd.toISOString().split('T')[0]).toBe('2026-11-14')
    expect(isBillingPeriodWithinLease('2026-05-15', '2026-11-14', 2026, 8, 'quarterly')).toBe(true)
  })

  it('handles end-of-month lease anchors without skipping short months', () => {
    const monthlyPeriod = getLeaseBillingPeriod('2026-01-31', 2026, 2, 'monthly')

    expect(monthlyPeriod?.periodStart.toISOString().split('T')[0]).toBe('2026-02-28')
    expect(monthlyPeriod?.periodEnd.toISOString().split('T')[0]).toBe('2026-03-27')
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

  it('calculates late fees for overdue invoice balances', () => {
    expect(calculateLateFee(100000, '2026-01-01', 5, new Date('2026-01-15'))).toBe(5000)
  })

  it('calculates net income after expenses', () => {
    expect(calculateNetIncome(900000, 250000)).toBe(650000)
  })
})
