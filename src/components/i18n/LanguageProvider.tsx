'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { normalizeLanguage, translate, type LanguageCode, type TranslationKey } from '@/utils/i18n'

type LanguageContextValue = {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
  saveLanguage: (language: LanguageCode) => Promise<void>
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ initialLanguage, children }: { initialLanguage: LanguageCode; children: React.ReactNode }) {
  const [language, setLanguage] = useState(normalizeLanguage(initialLanguage))

  useEffect(() => {
    setLanguage(normalizeLanguage(initialLanguage))
  }, [initialLanguage])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const saveLanguage = useCallback(async (nextLanguage: LanguageCode) => {
    const response = await fetch('/api/auth/language', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: nextLanguage }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || translate('language.saveError', nextLanguage))
    setLanguage(nextLanguage)
  }, [])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    saveLanguage,
    t: (key, values) => translate(key, language, values),
  }), [language, saveLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
