import { describe, expect, it } from 'vitest'
import { calculateInvoiceMetrics, getEffectiveInvoiceStatus } from './invoice-metrics'

describe('invoice summary figures', () => {
  it('shows money overdue and keeps a credit from hiding another invoice balance', () => {
    const metrics = calculateInvoiceMetrics([
      { status: 'overdue', subtotal: 100, amount_paid: 25, balance: 75 },
      { status: 'paid', subtotal: 50, amount_paid: 50, balance: 0 },
      { status: 'paid', subtotal: 100, amount_paid: 120, balance: -20 },
      { status: 'cancelled', subtotal: 30, amount_paid: 0, balance: 30 },
      { status: 'transferred', subtotal: 40, amount_paid: 40, balance: 0 },
    ])

    expect(metrics).toEqual({ expected: 250, collected: 195, outstanding: 75, overdue: 75, overdueCount: 1 })
  })

  it('derives overdue status from the due date even if the stored status is stale', () => {
    const invoice = { status: 'partially_paid', subtotal: 100, amount_paid: 25, balance: 75, due_date: '2026-09-30' }
    expect(getEffectiveInvoiceStatus(invoice, '2026-10-01')).toBe('overdue')
    expect(getEffectiveInvoiceStatus(invoice, '2026-09-30')).toBe('partially_paid')
  })

  it('preserves cancelled and transferred status regardless of dates and balances', () => {
    const cancelled = { status: 'cancelled', subtotal: 100, amount_paid: 0, balance: 100, due_date: '2026-01-01' }
    const transferred = { ...cancelled, status: 'transferred' }
    expect(getEffectiveInvoiceStatus(cancelled, '2026-10-01')).toBe('cancelled')
    expect(getEffectiveInvoiceStatus(transferred, '2026-10-01')).toBe('transferred')
  })
})
