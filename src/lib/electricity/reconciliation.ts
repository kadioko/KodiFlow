import type { ElectricityAccountRow, ElectricityReadingRow } from '@/lib/electricity/database.types'

type MeterAccount = Pick<
  ElectricityAccountRow,
  'id' | 'property_id' | 'meter_kind' | 'floor_label' | 'initial_meter_reading' | 'initial_reading_date'
> & { tenant_name?: string }

type MeterReading = Pick<
  ElectricityReadingRow,
  'account_id' | 'previous_reading_date' | 'reading_date' | 'current_meter_reading' | 'usage_units'
>

export type MainMeterReconciliation = {
  mainAccount: MeterAccount
  mainReading: MeterReading | null
  submeterAccounts: MeterAccount[]
  matchedSubmeterCount: number
  unmatchedSubmeters: MeterAccount[]
  periodStart: string | null
  periodEnd: string | null
  mainCurrentReading: number
  mainUsage: number | null
  submeterUsage: number | null
  difference: number | null
  status: 'baseline' | 'unassigned' | 'incomplete' | 'balanced' | 'shortage' | 'excess'
}

const floorAliases: Record<string, string> = {
  base: 'basement',
  baseluku: 'basement',
  g: 'groundfloor',
  ground: 'groundfloor',
  fl1: 'firstfloor',
  first: 'firstfloor',
  firstfloor: 'firstfloor',
  floor1: 'firstfloor',
  fl2: 'secondfloor',
  second: 'secondfloor',
  secondfloor: 'secondfloor',
  floor2: 'secondfloor',
  fl3: 'thirdfloor',
  third: 'thirdfloor',
  thirdfloor: 'thirdfloor',
  floor3: 'thirdfloor',
  fl4: 'fourthfloor',
  fourth: 'fourthfloor',
  fourthfloor: 'fourthfloor',
  floor4: 'fourthfloor',
  fl5: 'fifthfloor',
  fifth: 'fifthfloor',
  fifthfloor: 'fifthfloor',
  floor5: 'fifthfloor',
}

export function normalizeElectricityFloor(label: string) {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]/g, '')
  return floorAliases[normalized] || normalized
}

function latestReading(accountId: string, readings: MeterReading[]) {
  return readings
    .filter((reading) => reading.account_id === accountId)
    .sort((left, right) => right.reading_date.localeCompare(left.reading_date))[0] || null
}

export function reconcileMainMeters(
  accounts: MeterAccount[],
  readings: MeterReading[],
): MainMeterReconciliation[] {
  const activeMainMeters = accounts.filter((account) => account.meter_kind === 'floor_main')

  return activeMainMeters.map((mainAccount) => {
    const mainReading = latestReading(mainAccount.id, readings)
    const submeterAccounts = accounts.filter((account) =>
      account.meter_kind === 'submeter'
      && account.property_id === mainAccount.property_id
      && normalizeElectricityFloor(account.floor_label) === normalizeElectricityFloor(mainAccount.floor_label),
    )
    const periodStart = mainReading?.previous_reading_date ?? null
    const periodEnd = mainReading?.reading_date ?? null
    const matchedReadings = periodStart && periodEnd
      ? submeterAccounts.flatMap((account) => {
          const match = readings.find((reading) =>
            reading.account_id === account.id
            && reading.previous_reading_date === periodStart
            && reading.reading_date === periodEnd,
          )
          return match ? [{ account, reading: match }] : []
        })
      : []
    const matchedIds = new Set(matchedReadings.map(({ account }) => account.id))
    const unmatchedSubmeters = submeterAccounts.filter((account) => !matchedIds.has(account.id))
    const mainUsage = mainReading && periodStart ? Number(mainReading.usage_units) : null
    const submeterUsage = matchedReadings.length > 0
      ? matchedReadings.reduce((total, { reading }) => total + Number(reading.usage_units), 0)
      : submeterAccounts.length === 0 ? 0 : null
    const difference = mainUsage !== null && submeterUsage !== null && unmatchedSubmeters.length === 0
      ? mainUsage - submeterUsage
      : null

    let status: MainMeterReconciliation['status']
    if (!mainReading || !periodStart) status = 'baseline'
    else if (submeterAccounts.length === 0) status = 'unassigned'
    else if (unmatchedSubmeters.length > 0) status = 'incomplete'
    else if (Math.abs(difference || 0) <= 0.001) status = 'balanced'
    else if ((difference || 0) > 0) status = 'shortage'
    else status = 'excess'

    return {
      mainAccount,
      mainReading,
      submeterAccounts,
      matchedSubmeterCount: matchedReadings.length,
      unmatchedSubmeters,
      periodStart,
      periodEnd,
      mainCurrentReading: Number(mainReading?.current_meter_reading ?? mainAccount.initial_meter_reading),
      mainUsage,
      submeterUsage,
      difference,
      status,
    }
  })
}
