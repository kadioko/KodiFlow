export function normalizeWhatsAppPhone(value: string | null | undefined) {
  let digits = value?.replace(/\D/g, '') || ''
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('255')) return digits
  if (digits.startsWith('0')) return `255${digits.slice(1)}`
  if (digits.length === 9) return `255${digits}`
  return digits
}
