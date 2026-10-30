import type { ElectricityAccountRow, ElectricityReadingRow } from '@/lib/electricity/database.types'
import { calculateMainMeterUsage, type MainMeterBalanceSnapshot } from './main-meter-balance'

type MeterAccount = Pick<
  ElectricityAccountRow,
  'id' | 'property_id' | 'meter_kind' | 'floor_label' | 'initial_meter_reading' | 'initial_reading_date'
> & { tenant_name?: string }

type MeterReading = Pick<
  ElectricityReadingRow,
  'account_id' | 'previous_reading_date' | 'reading_date' | 'current_meter_reading' | 'usage_units'
>

type MainMeterBalance = MainMeterBalanceSnapshot & { account_id: string }

export type MainMeterReconciliation = {
  mainAccount: MeterAccount
  currentBalance: MainMeterBalance | null
  previousBalance: MainMeterBalance | null
  submeterAccounts: MeterAccount[]
  matchedSubmeterCount: number
  unmatchedSubmeters: MeterAccount[]
  periodStart: string | null
  periodEnd: string | null
  mainCurrentBalance: number | null
  mainUsage: number | null
  unexplainedBalanceIncrease: number | null
  submeterUsage: number | null
  difference: number | null
  status: 'baseline' | 'purchase_unknown' | 'balance_anomaly' | 'unassigned' | 'incomplete' | 'balanced' | 'shortage' | 'excess'
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

function latestBalances(accountId: string, balances: MainMeterBalance[]) {
  return balances
    .filter((reading) => reading.account_id === accountId)
    .sort((left, right) => left.reading_date.localeCompare(right.reading_date))
}

export function reconcileMainMeters(
  accounts: MeterAccount[],
  readings: MeterReading[],
  balances: MainMeterBalance[],
): MainMeterReconciliation[] {
  const activeMainMeters = accounts.filter((account) => account.meter_kind === 'floor_main')

  return activeMainMeters.map((mainAccount) => {
    const meterBalances = latestBalances(mainAccount.id, balances)
    const currentBalance = meterBalances.at(-1) || null
    const previousBalance = meterBalances.at(-2) || null
    const submeterAccounts = accounts.filter((account) =>
      account.meter_kind === 'submeter'
      && account.property_id === mainAccount.property_id
      && normalizeElectricityFloor(account.floor_label) === normalizeElectricityFloor(mainAccount.floor_label),
    )
    const periodStart = previousBalance?.reading_date ?? null
    const periodEnd = currentBalance?.reading_date ?? null
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
    const calculatedUsage = currentBalance && previousBalance
      ? calculateMainMeterUsage(previousBalance, currentBalance)
      : null
    const mainUsage = calculatedUsage !== null && calculatedUsage >= -0.001
      ? Math.max(0, calculatedUsage)
      : null
    const unexplainedBalanceIncrease = calculatedUsage !== null && calculatedUsage < -0.001
      ? Math.abs(calculatedUsage)
      : null
    const submeterUsage = matchedReadings.length > 0
      ? matchedReadings.reduce((total, { reading }) => total + Number(reading.usage_units), 0)
      : submeterAccounts.length === 0 ? 0 : null
    const difference = mainUsage !== null && submeterUsage !== null && unmatchedSubmeters.length === 0
      ? mainUsage - submeterUsage
      : null

    let status: MainMeterReconciliation['status']
    if (!currentBalance || !previousBalance) status = 'baseline'
    else if (currentBalance.units_purchased_since_previous === null) status = 'purchase_unknown'
    else if (unexplainedBalanceIncrease !== null) status = 'balance_anomaly'
    else if (submeterAccounts.length === 0) status = 'unassigned'
    else if (unmatchedSubmeters.length > 0) status = 'incomplete'
    else if (Math.abs(difference || 0) <= 0.001) status = 'balanced'
    else if ((difference || 0) > 0) status = 'shortage'
    else status = 'excess'

    return {
      mainAccount,
      currentBalance,
      previousBalance,
      submeterAccounts,
      matchedSubmeterCount: matchedReadings.length,
      unmatchedSubmeters,
      periodStart,
      periodEnd,
      mainCurrentBalance: currentBalance ? Number(currentBalance.units_remaining) : null,
      mainUsage,
      unexplainedBalanceIncrease,
      submeterUsage,
      difference,
      status,
    }
  })
}
