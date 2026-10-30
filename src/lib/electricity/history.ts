export type ElectricityHistoryType = 'topups' | 'readings' | 'main_balances' | 'adjustments' | 'cutoff' | 'audit'

export type ElectricityHistoryRecord = {
  id: string
  type: ElectricityHistoryType
  accountId: string
  occurredAt: string
  actorId: string | null
  actorName: string
  confirmedAt: string | null
  confirmedByName: string | null
  reversedAt: string | null
  reversedByName: string | null
  reversalReason: string | null
  payload: Record<string, unknown>
}
