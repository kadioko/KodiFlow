'use client'

import { useEffect } from 'react'

export const THEME_STORAGE_KEY = 'kodiflow-theme'
export type AppTheme = 'light' | 'dark'

export function applyTheme(theme: AppTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#020617' : '#0f766e')
}

export function getStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light'

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider() {
  useEffect(() => {
    applyTheme(getStoredTheme())
  }, [])

  return null
}
