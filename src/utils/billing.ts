export const billingFrequencyMonths: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annually: 6,
  annually: 12,
}

export function getBillingPeriod(billingYear: number, billingMonth: number, billingFrequency: string) {
  const months = billingFrequencyMonths[billingFrequency] || 1
  const periodStart = new Date(Date.UTC(billingYear, billingMonth - 1, 1))
  const periodEnd = new Date(Date.UTC(billingYear, billingMonth - 1 + months, 0))

  return { months, periodStart, periodEnd }
}

export function calculateInvoiceTotal(monthlyRent: number, monthlyCharges: number[], billingFrequency: string) {
  const months = billingFrequencyMonths[billingFrequency] || 1
  return (monthlyRent + monthlyCharges.reduce((sum, amount) => sum + amount, 0)) * months
}

export function calculatePaymentBalance(subtotal: number, amountPaid: number, paymentAmount: number) {
  return subtotal - amountPaid - paymentAmount
}

export function createProfileInsert(id: string, fullName: string) {
  return {
    id,
    full_name: fullName,
    currency_preference: 'TZS',
  }
}
