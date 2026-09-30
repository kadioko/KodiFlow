export function safeLoginDestination(nextPath: string | null, origin: string): string {
  if (!nextPath?.startsWith('/')) return '/dashboard'
  try {
    const destination = new URL(nextPath, origin)
    return destination.origin === origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : '/dashboard'
  } catch {
    return '/dashboard'
  }
}
