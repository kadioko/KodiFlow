export type MaybeArray<T> = T | T[] | null

export function firstRelation<T>(value: MaybeArray<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export function relationField<T extends Record<string, unknown>, K extends keyof T>(
  value: MaybeArray<T>,
  key: K
) {
  return firstRelation(value)?.[key]
}
