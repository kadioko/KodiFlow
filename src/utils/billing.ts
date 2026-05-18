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
  const targetYear = date.getUTCFullYear()
  const targetMonth = date.getUTCMonth() + months
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(date.getUTCDate(), lastDayOfTargetMonth)

  return new Date(Date.UTC(targetYear, targetMonth, targetDay))
}

export function getBillingPeriod(billingYear: number, billingMonth: number, billingFrequency: string) {
  const months = billingFrequencyMonths[billingFrequency] || 1
  const periodStart = new Date(Date.UTC(billingYear, billingMonth - 1, 1))
  const periodEnd = new Date(Date.UTC(billingYear, billingMonth - 1 + months, 0))

  return { months, periodStart, periodEnd }
}

export function isBillingPeriodOnCadence(leaseStartDate: string, billingYear: number, billingMonth: number, _billingFrequency: string) {
  const leaseStart = new Date(`${leaseStartDate}T00:00:00Z`)
  const leaseStartIndex = leaseStart.getUTCFullYear() * 12 + leaseStart.getUTCMonth()
  const billingIndex = billingYear * 12 + (billingMonth - 1)

  return billingIndex >= leaseStartIndex
}

export function getLeaseBillingPeriod(leaseStartDate: string, billingYear: number, billingMonth: number, billingFrequency: string) {
  if (!isBillingPeriodOnCadence(leaseStartDate, billingYear, billingMonth, billingFrequency)) {
    return null
  }

  const months = billingFrequencyMonths[billingFrequency] || 1
  const leaseStart = new Date(`${leaseStartDate}T00:00:00Z`)
  const leaseStartIndex = leaseStart.getUTCFullYear() * 12 + leaseStart.getUTCMonth()
  const billingIndex = billingYear * 12 + (billingMonth - 1)
  const monthsSinceStart = billingIndex - leaseStartIndex
  const periodStart = addUtcMonths(leaseStart, monthsSinceStart)
  const periodEnd = addUtcMonths(periodStart, months)
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1)

  return { months, periodStart, periodEnd }
}

export function isBillingPeriodWithinLease(leaseStartDate: string, leaseEndDate: string, billingYear: number, billingMonth: number, billingFrequency: string) {
  const period = getLeaseBillingPeriod(leaseStartDate, billingYear, billingMonth, billingFrequency)
  if (!period) return false

  const leaseEnd = new Date(`${leaseEndDate}T00:00:00Z`)

  return period.periodStart <= leaseEnd
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
