export function digitsOnlyLukuToken(value: string) {
  return value.replace(/\D/g, '')
}

export function formatLukuToken(digits: string) {
  return digits.match(/.{1,4}/g)?.join(' ') || ''
}

export function parseLukuToken(value: string) {
  if (!/^[\d\s-]+$/.test(value)) return null
  const digits = value.replace(/[\s-]/g, '')
  return /^\d{20}$/.test(digits) ? digits : null
}
