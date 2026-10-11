import { describe, expect, it } from 'vitest'
import { calculateInvoiceListTotals, createInvoiceListPdf, type InvoiceListPdfItem } from './invoice-list-pdf'

const invoice = (index: number): InvoiceListPdfItem => ({
  invoice_number: `INV-${index}`,
  tenant_name: `Tenant ${index}`,
  unit_name: `Unit ${index}`,
  property_name: 'Test Property',
  billing_period_start: '2026-01-01',
  billing_period_end: '2026-01-31',
  subtotal: 100,
  amount_paid: 25,
  balance: 75,
  due_date: '2026-01-05',
  status: 'overdue',
})

describe('invoice list PDF totals', () => {
  it('adds expected, collected, due balances, and credits without netting credits against arrears', () => {
    const totals = calculateInvoiceListTotals([
      invoice(1),
      {
        invoice_number: 'INV-2', tenant_name: 'Tenant B', unit_name: 'Unit 2', property_name: 'Property B',
        billing_period_start: '2026-02-01', billing_period_end: '2026-02-28', subtotal: 200, amount_paid: 220,
        balance: -20, due_date: '2026-02-05', status: 'unpaid',
      },
    ])

    expect(totals).toEqual({ expected: 300, collected: 245, outstanding: 75, credits: 20 })
  })

  it('creates a valid multi-page shareable PDF with a dated filename', async () => {
    const result = await createInvoiceListPdf(Array.from({ length: 30 }, (_, index) => invoice(index + 1)), 'Overdue')
    const bytes = new Uint8Array(result.pdf.output('arraybuffer') as ArrayBuffer)

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(result.pdf.getNumberOfPages()).toBeGreaterThan(1)
    expect(result.pdfFile.type).toBe('application/pdf')
    expect(result.fileName).toMatch(/^kodiflow-overdue-invoices-\d{4}-\d{2}-\d{2}\.pdf$/)
  })
})
