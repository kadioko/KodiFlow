export type InvoiceBalanceRow = {
  status: string
  subtotal: number
  amount_paid: number
  balance: number
}

export function getEffectiveInvoiceStatus(
  invoice: InvoiceBalanceRow & { due_date: string },
  today: string,
) {
  if (invoice.status === 'cancelled' || invoice.status === 'transferred') return invoice.status
  if (invoice.balance > 0 && invoice.due_date < today) return 'overdue'
  if (invoice.amount_paid >= invoice.subtotal) return 'paid'
  if (invoice.amount_paid > 0) return 'partially_paid'
  return 'unpaid'
}

export function calculateInvoiceMetrics(invoices: InvoiceBalanceRow[]) {
  const financialInvoices = invoices.filter((invoice) => !['cancelled', 'transferred'].includes(invoice.status))
  const overdueInvoices = financialInvoices.filter((invoice) => invoice.status === 'overdue' && invoice.balance > 0)

  return {
    expected: financialInvoices.reduce((total, invoice) => total + invoice.subtotal, 0),
    collected: financialInvoices.reduce((total, invoice) => total + invoice.amount_paid, 0),
    outstanding: financialInvoices.reduce((total, invoice) => total + Math.max(invoice.balance, 0), 0),
    overdue: overdueInvoices.reduce((total, invoice) => total + invoice.balance, 0),
    overdueCount: overdueInvoices.length,
  }
}
