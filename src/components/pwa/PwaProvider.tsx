'use client'

import { useEffect, useState } from 'react'

export function PwaProvider() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  if (!deferredPrompt) return null

  return (
    <button
      onClick={async () => {
        await deferredPrompt.prompt()
        setDeferredPrompt(null)
      }}
      className="fixed bottom-4 right-4 z-50 btn-primary shadow-lg"
    >
      Install KodiFlow
    </button>
  )
}
