export const SUPPORTED_CURRENCIES = [
  { value: 'TZS', label: 'TZS - Tanzanian Shilling' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
] as const

export function calculateLateFee(balance: number, dueDate: string, ratePercent: number, asOf: Date = new Date()) {
  if (balance <= 0 || ratePercent <= 0) return 0

  const due = new Date(dueDate)
  if (due >= asOf) return 0

  return Math.round(balance * (ratePercent / 100))
}

export function calculateNetIncome(collected: number, expenses: number) {
  return collected - expenses
}
