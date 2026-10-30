import { describe, expect, it } from 'vitest'
import { digitsOnlyLukuToken, formatLukuToken, parseLukuToken } from './luku-token'

describe('LUKU token entry', () => {
  it('formats 20 digits into five groups of four', () => {
    expect(formatLukuToken('12345678901234567890')).toBe('1234 5678 9012 3456 7890')
  })

  it('accepts grouped or pasted 20-digit codes and normalizes them', () => {
    expect(parseLukuToken('1234 5678 9012 3456 7890')).toBe('12345678901234567890')
    expect(parseLukuToken('12345678901234567890')).toBe('12345678901234567890')
    expect(parseLukuToken('1234-5678-9012-3456-7890')).toBe('12345678901234567890')
  })

  it('rejects incorrect lengths and non-numeric token characters', () => {
    expect(parseLukuToken('1234 5678')).toBeNull()
    expect(parseLukuToken('1234 5678 9012 3456 789X')).toBeNull()
  })

  it('preserves excess digits so invalid codes are not silently truncated', () => {
    expect(digitsOnlyLukuToken('1234 5678 9012 3456 789012')).toBe('1234567890123456789012')
    expect(parseLukuToken(digitsOnlyLukuToken('1234 5678 9012 3456 789012'))).toBeNull()
  })
})
