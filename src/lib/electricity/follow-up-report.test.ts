import { describe, expect, it } from 'vitest'
import { buildElectricityFollowUp, getFollowUpAction, type FollowUpAccount } from './follow-up-report'

const account: FollowUpAccount = {
  id: 'a', property_id: 'p', active: true, meter_kind: 'submeter', tenant_name: 'Client', unit_name: '12', floor_label: 'First',
  low_units_threshold: 10, estimated_balance_units: 30, pending_reported_topup_units: 0,
  latest_reading: { reading_date: '2026-11-02' },
}
const today = '2026-11-04'

describe('electricity follow-up report', () => {
  it('ranks exhausted, low and soon balances and excludes healthy clients and main meters', () => {
    const result = buildElectricityFollowUp([
      account,
      { ...account, id: 'soon', estimated_balance_units: 20 },
      { ...account, id: 'low', estimated_balance_units: 10 },
      { ...account, id: 'urgent', estimated_balance_units: -2 },
      { ...account, id: 'main', meter_kind: 'floor_main', estimated_balance_units: 0 },
      { ...account, id: 'archived', active: false, estimated_balance_units: 0 },
    ], today)
    expect(result.map((item) => [item.id, item.priority])).toEqual([['urgent', 'urgent'], ['low', 'low'], ['soon', 'soon']])
  })

  it('flags stale readings without hiding urgent balances and requests review for missing readings', () => {
    const result = buildElectricityFollowUp([
      { ...account, id: 'stale', estimated_balance_units: -4, latest_reading: { reading_date: '2026-10-29' } },
      { ...account, id: 'missing', latest_reading: null },
      { ...account, id: 'old-healthy', latest_reading: { reading_date: '2026-10-29' } },
    ], today)
    expect(result.find((item) => item.id === 'stale')).toMatchObject({ priority: 'urgent', readingNeedsCheck: true })
    expect(getFollowUpAction(result.find((item) => item.id === 'stale')!)).toBe('check')
    expect(result.find((item) => item.id === 'missing')).toMatchObject({ priority: 'review', balance: null, readingNeedsCheck: true })
    expect(result.find((item) => item.id === 'old-healthy')).toMatchObject({ priority: 'review', readingNeedsCheck: true })
  })

  it('flags unconfirmed purchases and treats a future reading as needing review', () => {
    const result = buildElectricityFollowUp([
      { ...account, id: 'reported', pending_reported_topup_units: 20 },
      { ...account, id: 'future', latest_reading: { reading_date: '2026-11-05' } },
    ], today)
    expect(result.find((item) => item.id === 'reported')).toMatchObject({ priority: 'review', unconfirmedTopup: true })
    expect(getFollowUpAction(result.find((item) => item.id === 'reported')!)).toBe('check')
    expect(result.find((item) => item.id === 'future')).toMatchObject({ priority: 'review', readingNeedsCheck: true })
  })
})
