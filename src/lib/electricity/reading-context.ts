type MeterReading = {
  reading_date: string
  current_meter_reading: number
  closing_balance_units: number | null
}

type MeterAccount = {
  initial_meter_reading: number
  initial_reading_date: string
  opening_balance_units: number
}

export function getElectricityReadingContext<T extends MeterReading>(
  account: MeterAccount,
  readings: T[],
  readingDate: string,
) {
  const ordered = readings
    .filter((reading) => reading.reading_date >= account.initial_reading_date)
    .sort((left, right) => left.reading_date.localeCompare(right.reading_date))
  const previous = [...ordered].reverse().find((reading) => reading.reading_date < readingDate)
  const next = ordered.find((reading) => reading.reading_date > readingDate)

  return {
    duplicateDate: ordered.some((reading) => reading.reading_date === readingDate),
    previousMeterReading: previous ? Number(previous.current_meter_reading) : Number(account.initial_meter_reading),
    previousReadingDate: previous?.reading_date ?? account.initial_reading_date,
    previousBalance: previous?.closing_balance_units === null || previous?.closing_balance_units === undefined
      ? Number(account.opening_balance_units)
      : Number(previous.closing_balance_units),
    nextMeterReading: next ? Number(next.current_meter_reading) : null,
    nextReadingDate: next?.reading_date ?? null,
    isHistorical: Boolean(next),
    dateAfterBaseline: readingDate > account.initial_reading_date,
  }
}
