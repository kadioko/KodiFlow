import { describe, expect, it } from 'vitest'
import { firstRelation, tenantName } from './query-results'

describe('joined query results', () => {
  it('handles object, array, and missing relations', () => {
    const row = { name: 'Unit 51' }
    expect(firstRelation(row)).toBe(row)
    expect(firstRelation([row])).toBe(row)
    expect(firstRelation([])).toBeUndefined()
    expect(firstRelation(null)).toBeUndefined()
    expect(firstRelation(undefined)).toBeUndefined()
  })

  it('preserves individual and business tenant names', () => {
    expect(tenantName({ full_name: 'Tenant', business_name: null })).toBe('Tenant')
    expect(tenantName([{ full_name: null, business_name: 'Twilight' }])).toBe('Twilight')
    expect(tenantName(null)).toBe('Unnamed tenant')
  })
})
