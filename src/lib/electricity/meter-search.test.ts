import { describe, expect, it } from 'vitest'
import { matchesElectricityMeter } from './meter-search'

const meter = {
  tenant_name: 'Perfect Property', unit_name: 'Office', floor_label: 'Fourth Floor',
  meter_number: '37233109000', display_name: null, ledger_tenant_label: null,
}

describe('electricity meter search', () => {
  it('finds client, unit identifier, floor and meter number without case sensitivity', () => {
    for (const query of ['PERFECT', '43', 'floor fourth', '109000', 'property 43']) {
      expect(matchesElectricityMeter(meter, '43', query)).toBe(true)
    }
  })

  it('shows all for an empty query and rejects nonmatches', () => {
    expect(matchesElectricityMeter(meter, '43', '  ')).toBe(true)
    expect(matchesElectricityMeter(meter, '43', 'Twilight')).toBe(false)
  })
})
