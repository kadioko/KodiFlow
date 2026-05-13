'use client'

import { useEffect } from 'react'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    kodiflowInstallPrompt?: BeforeInstallPromptEvent
  }
}

export function PwaProvider() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      window.kodiflowInstallPrompt = event as BeforeInstallPromptEvent
      window.dispatchEvent(new Event('kodiflow-pwa-install-ready'))
    }

    const handleAppInstalled = () => {
      window.kodiflowInstallPrompt = undefined
      window.dispatchEvent(new Event('kodiflow-pwa-installed'))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  return null
}
