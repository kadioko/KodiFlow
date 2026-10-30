import { describe, expect, it } from 'vitest'
import { normalizeLanguage, translate, translations, type TranslationKey } from './i18n'

describe('account language translations', () => {
  it('provides a Kiswahili translation for every English interface key', () => {
    expect(Object.keys(translations.sw).sort()).toEqual(Object.keys(translations.en).sort())
  })

  it('interpolates message values and defaults unknown preferences to English', () => {
    expect(translate('electricity.noPhone', 'sw', { tenant: 'Asha' })).toContain('Asha')
    expect(normalizeLanguage('sw')).toBe('sw')
    expect(normalizeLanguage('fr')).toBe('en')
  })

  it('keeps the supported language set intentionally small', () => {
    const languages = Object.keys(translations)
    expect(languages).toEqual(['en', 'sw'])
    const key: TranslationKey = 'settings.language'
    expect(translate(key, 'sw')).toBe('Lugha')
  })
})
