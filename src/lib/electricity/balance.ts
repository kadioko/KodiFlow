export type ElectricityBalanceStatus = 'reading_due' | 'exhausted' | 'low' | 'soon' | 'okay'

export type ElectricityBalanceInput = {
  previousMeterReading: number
  currentMeterReading: number
  openingBalanceUnits: number
  verifiedTopupUnits: number
}

export function calculateElectricityBalance(input: ElectricityBalanceInput) {
  if (input.currentMeterReading < input.previousMeterReading) {
    throw new Error('Current meter reading cannot be below the previous reading.')
  }

  const usageUnits = roundUnits(input.currentMeterReading - input.previousMeterReading)
  const closingBalanceUnits = roundUnits(input.openingBalanceUnits + input.verifiedTopupUnits - usageUnits)

  return { usageUnits, closingBalanceUnits }
}

export function classifyElectricityBalance({
  balanceUnits,
  lowThresholdUnits,
  readingDate,
  today = new Date(),
  maxReadingAgeDays = 30,
}: {
  balanceUnits: number
  lowThresholdUnits: number
  readingDate: string | null
  today?: Date
  maxReadingAgeDays?: number
}): ElectricityBalanceStatus {
  if (!readingDate || daysBetween(new Date(`${readingDate}T00:00:00`), today) > maxReadingAgeDays) {
    return 'reading_due'
  }
  if (balanceUnits <= 0) return 'exhausted'
  if (balanceUnits <= lowThresholdUnits) return 'low'
  if (balanceUnits <= lowThresholdUnits * 2) return 'soon'
  return 'okay'
}

export function roundUnits(value: number) {
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 1000) / 1000
}

function daysBetween(earlier: Date, later: Date) {
  return Math.floor((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86_400_000)
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
