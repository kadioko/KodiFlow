import type { LanguageCode } from '@/utils/i18n'

const languageStorageKey = 'kodiflow-language'

export function getLanguagePreference(): LanguageCode | null {
  if (typeof window === 'undefined') return null

  const queryLanguage = new URLSearchParams(window.location.search).get('lang')
  if (queryLanguage === 'en' || queryLanguage === 'sw') return queryLanguage

  try {
    const storedLanguage = window.localStorage.getItem(languageStorageKey)
    return storedLanguage === 'en' || storedLanguage === 'sw' ? storedLanguage : null
  } catch {
    return null
  }
}

export function storeLanguagePreference(language: LanguageCode) {
  try {
    window.localStorage.setItem(languageStorageKey, language)
  } catch {
    // Language selection still applies for the current page when storage is unavailable.
  }
}
