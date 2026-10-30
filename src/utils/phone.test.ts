import { describe, expect, it } from 'vitest'
import { normalizeWhatsAppPhone } from './phone'

describe('WhatsApp phone normalization', () => {
  it('formats Tanzanian local numbers as international numbers', () => {
    expect(normalizeWhatsAppPhone('0754 123 456')).toBe('255754123456')
    expect(normalizeWhatsAppPhone('754123456')).toBe('255754123456')
  })

  it('preserves international numbers and handles an international dial prefix', () => {
    expect(normalizeWhatsAppPhone('+255 754 123 456')).toBe('255754123456')
    expect(normalizeWhatsAppPhone('001 202 555 0123')).toBe('12025550123')
  })

  it('returns an empty string for missing input', () => {
    expect(normalizeWhatsAppPhone(null)).toBe('')
  })
})
