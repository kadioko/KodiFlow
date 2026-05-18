export const billingFrequencyMonths: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annually: 6,
  annually: 12,
}

export type BillingFrequency = keyof typeof billingFrequencyMonths

function toIsoDate(date: Date) {
  return date.toISOString().split('T')[0]
}

export function addUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()))
}

export function getBillingPeriod(billingYear: number, billingMonth: number, billingFrequency: string) {
  const months = billingFrequencyMonths[billingFrequency] || 1
  const periodStart = new Date(Date.UTC(billingYear, billingMonth - 1, 1))
  const periodEnd = new Date(Date.UTC(billingYear, billingMonth - 1 + months, 0))

  return { months, periodStart, periodEnd }
}

export function isBillingPeriodOnCadence(leaseStartDate: string, billingYear: number, billingMonth: number, billingFrequency: string) {
  const months = billingFrequencyMonths[billingFrequency] || 1
  const leaseStart = new Date(`${leaseStartDate}T00:00:00Z`)
  const leaseStartIndex = leaseStart.getUTCFullYear() * 12 + leaseStart.getUTCMonth()
  const billingIndex = billingYear * 12 + (billingMonth - 1)

  return (billingIndex - leaseStartIndex) % months === 0
}

export function isBillingPeriodWithinLease(leaseStartDate: string, leaseEndDate: string, billingYear: number, billingMonth: number, billingFrequency: string) {
  const { periodStart, periodEnd } = getBillingPeriod(billingYear, billingMonth, billingFrequency)
  const leaseStart = new Date(`${leaseStartDate}T00:00:00Z`)
  const leaseEnd = new Date(`${leaseEndDate}T00:00:00Z`)

  return periodStart >= leaseStart && periodEnd <= leaseEnd
}

export function getRenewalTerm(previousEndDate: string, billingFrequency: string) {
  const months = billingFrequencyMonths[billingFrequency] || 1
  const startDate = new Date(`${previousEndDate}T00:00:00Z`)
  startDate.setUTCDate(startDate.getUTCDate() + 1)

  const endDate = addUtcMonths(startDate, months)
  endDate.setUTCDate(endDate.getUTCDate() - 1)

  return {
    months,
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
  }
}

export function calculateChargeAmountForPeriod(amount: number, chargeFrequency: string | null | undefined, billingFrequency: string) {
  const months = billingFrequencyMonths[billingFrequency] || 1

  switch (chargeFrequency) {
    case 'one_time':
    case 'custom':
      return amount
    case 'quarterly':
      return months >= 3 ? amount * Math.floor(months / 3) : 0
    case 'annually':
      return months >= 12 ? amount * Math.floor(months / 12) : 0
    case 'monthly':
    default:
      return amount * months
  }
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
