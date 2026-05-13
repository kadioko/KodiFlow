export type LanguageCode = 'en' | 'sw'

const translations = {
  en: {
    dashboard: 'Dashboard',
    properties: 'Properties',
    tenants: 'Tenants',
    utilities: 'Utilities',
    reports: 'Reports',
    settings: 'Settings',
  },
  sw: {
    dashboard: 'Dashibodi',
    properties: 'Majengo',
    tenants: 'Wapangaji',
    utilities: 'Huduma',
    reports: 'Ripoti',
    settings: 'Mipangilio',
  },
} as const

export function translate(key: keyof typeof translations.en, language: LanguageCode = 'en') {
  return translations[language]?.[key] || translations.en[key]
}
