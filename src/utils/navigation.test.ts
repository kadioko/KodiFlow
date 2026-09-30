import { describe, expect, it } from 'vitest'
import { safeLoginDestination } from './navigation'

describe('login destinations', () => {
  const origin = 'https://kodiflow.example'
  it('keeps internal paths and filters', () => {
    expect(safeLoginDestination('/invoices?status=overdue#balance', origin)).toBe('/invoices?status=overdue#balance')
  })
  it.each([null, '', 'https://other.example', '//other.example', '/\\other.example', 'javascript:alert(1)'])('rejects external or invalid destinations: %s', (path) => {
    expect(safeLoginDestination(path, origin)).toBe('/dashboard')
  })
})
