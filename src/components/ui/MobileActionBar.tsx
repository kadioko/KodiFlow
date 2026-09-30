'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export function MobileActionBar({ children, error, message }: { children: ReactNode; error?: string; message?: string }) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    const main = bar?.closest('main')
    if (!bar || !main) return
    const observer = new ResizeObserver(() => {
      main.style.setProperty('--mobile-submit-bar-height', `${bar.getBoundingClientRect().height}px`)
    })
    observer.observe(bar)
    return () => {
      observer.disconnect()
      main.style.removeProperty('--mobile-submit-bar-height')
    }
  }, [])

  return (
    <div ref={barRef} className="mobile-form-submit-bar fixed inset-x-0 z-40 border-t border-slate-200 bg-white lg:hidden" role="region" aria-label="Form actions">
      <div className="mx-auto w-full max-w-3xl">
        {error && <p role="alert" className="mb-2 max-h-20 overflow-y-auto break-words text-sm text-danger-700">{error}</p>}
        {!error && message && <p role="status" className="mb-2 text-sm text-success-700">{message}</p>}
        {children}
      </div>
    </div>
  )
}
