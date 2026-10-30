import { roundUnits, type ElectricityBalanceStatus } from './balance'

export type MainMeterBalanceSnapshot = {
  reading_date: string
  units_remaining: number | string
  units_purchased_since_previous: number | string | null
}

export function calculateMainMeterUsage(
  previous: MainMeterBalanceSnapshot | null,
  current: MainMeterBalanceSnapshot,
): number | null {
  if (!previous || current.units_purchased_since_previous === null) return null

  return roundUnits(
    Number(previous.units_remaining)
    + Number(current.units_purchased_since_previous)
    - Number(current.units_remaining),
  )
}

export function classifyMainMeterBalance({
  balanceUnits,
  lowThresholdUnits,
  readingDate,
  today = new Date().toISOString().slice(0, 10),
  maxReadingAgeDays = 7,
}: {
  balanceUnits: number | null
  lowThresholdUnits: number
  readingDate: string | null
  today?: string
  maxReadingAgeDays?: number
}): ElectricityBalanceStatus {
  if (balanceUnits !== null && balanceUnits <= 0) return 'exhausted'
  const threshold = Math.max(0, lowThresholdUnits)
  if (balanceUnits !== null && balanceUnits <= threshold) return 'low'
  if (balanceUnits !== null && balanceUnits <= threshold * 2) return 'soon'
  if (!readingDate || daysBetween(readingDate, today) > maxReadingAgeDays) return 'reading_due'
  return 'okay'
}

export function estimateMainMeterDaysRemaining(
  previous: MainMeterBalanceSnapshot | null,
  current: MainMeterBalanceSnapshot,
): number | null {
  const used = calculateMainMeterUsage(previous, current)
  if (used === null || used <= 0 || Number(current.units_remaining) <= 0 || !previous) return null

  const periodDays = daysBetween(previous.reading_date, current.reading_date)
  if (periodDays <= 0) return null

  const dailyUse = used / periodDays
  return Number.isFinite(dailyUse) && dailyUse > 0
    ? Math.ceil(Number(current.units_remaining) / dailyUse)
    : null
}

function daysBetween(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  return Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.floor((endMs - startMs) / 86_400_000)
    : Number.POSITIVE_INFINITY
}
