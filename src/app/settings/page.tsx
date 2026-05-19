'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SUPPORTED_CURRENCIES } from '@/utils/finance'
import { LANGUAGE_OPTIONS } from '@/utils/constants'
import { applyTheme, getStoredTheme, THEME_STORAGE_KEY, type AppTheme } from '@/components/theme/ThemeProvider'
import type { BeforeInstallPromptEvent } from '@/components/pwa/PwaProvider'
import { Check, Download, MonitorSmartphone, Moon, Save, Smartphone, Sun } from 'lucide-react'

export default function SettingsPage() {
  const [currency, setCurrency] = useState('TZS')
  const [language, setLanguage] = useState('en')
  const [lateFeeRate, setLateFeeRate] = useState(0)
  const [invoicePaymentInstructions, setInvoicePaymentInstructions] = useState('Please pay at CRDB Bank, Ac: 01J2026378300 (Godfrey Daniel Mariki)')
  const [invoiceFooterNote, setInvoiceFooterNote] = useState('E.&.O.E.')
  const [theme, setTheme] = useState<AppTheme>('light')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [installMessage, setInstallMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSettings = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('currency_preference, language_preference, late_fee_rate, invoice_payment_instructions, invoice_footer_note')
        .eq('id', user.id)
        .single()

      if (data) {
        setCurrency(data.currency_preference || 'TZS')
        setLanguage(data.language_preference || 'en')
        setLateFeeRate(Number(data.late_fee_rate || 0))
        setInvoicePaymentInstructions(data.invoice_payment_instructions || 'Please pay at CRDB Bank, Ac: 01J2026378300 (Godfrey Daniel Mariki)')
        setInvoiceFooterNote(data.invoice_footer_note || 'E.&.O.E.')
      }
      setLoading(false)
    }

    fetchSettings()
  }, [])

  useEffect(() => {
    setTheme(getStoredTheme())
    setInstallPrompt(window.kodiflowInstallPrompt ?? null)
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && Boolean(navigator.standalone))
    )

    const handleInstallReady = () => setInstallPrompt(window.kodiflowInstallPrompt ?? null)
    const handleInstalled = () => {
      setInstallPrompt(null)
      setIsStandalone(true)
      setInstallMessage('KodiFlow is installed on this device.')
    }

    window.addEventListener('kodiflow-pwa-install-ready', handleInstallReady)
    window.addEventListener('kodiflow-pwa-installed', handleInstalled)

    return () => {
      window.removeEventListener('kodiflow-pwa-install-ready', handleInstallReady)
      window.removeEventListener('kodiflow-pwa-installed', handleInstalled)
    }
  }, [])

  const updateTheme = (nextTheme: AppTheme) => {
    setTheme(nextTheme)
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    applyTheme(nextTheme)
  }

  const installApp = async () => {
    if (!installPrompt) {
      setInstallMessage('Open your browser menu and choose Add to Home screen or Install app.')
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    window.kodiflowInstallPrompt = undefined
    setInstallPrompt(null)
    setInstallMessage(
      choice.outcome === 'accepted'
        ? 'KodiFlow is being added to your app screen.'
        : 'Install dismissed. You can try again from this screen later.'
    )
  }

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        currency_preference: currency,
        language_preference: language,
        late_fee_rate: lateFeeRate,
        invoice_payment_instructions: invoicePaymentInstructions,
        invoice_footer_note: invoiceFooterNote,
      })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
    } else {
      setMessage('Settings saved')
    }
    setSaving(false)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-gray-500">Configure financial preferences and automation defaults</p>
        </div>
      </div>

      {message && <div className="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-lg">{message}</div>}
      {error && <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">{error}</div>}

      <section className="card p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <MonitorSmartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-950">App Experience</h2>
            <p className="mt-1 text-sm text-slate-500">Install KodiFlow on your phone and choose how the app looks.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 text-primary-600" />
              <div>
                <h3 className="font-semibold text-slate-900">Add to app screen</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {isStandalone
                    ? 'KodiFlow is already running like an installed app.'
                    : 'Create a full-screen mobile shortcut from your browser.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={installApp}
              disabled={isStandalone}
              className="btn-primary mt-4 w-full"
            >
              {isStandalone ? <Check className="mr-2 h-5 w-5" /> : <Download className="mr-2 h-5 w-5" />}
              {isStandalone ? 'Installed' : installPrompt ? 'Install KodiFlow' : 'Show Install Help'}
            </button>
            {installMessage && <p className="mt-3 text-sm text-slate-500">{installMessage}</p>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <h3 className="font-semibold text-slate-900">Appearance</h3>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 shadow-inner ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => updateTheme('light')}
                className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  theme === 'light' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </button>
              <button
                type="button"
                onClick={() => updateTheme('dark')}
                className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  theme === 'dark' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-500">Your choice is saved on this device.</p>
          </div>
        </div>
      </section>

      <form onSubmit={saveSettings} className="card p-6 space-y-6">
        {loading && <div className="text-sm text-slate-500">Loading financial settings...</div>}

        <div className="form-group">
          <label className="label" htmlFor="currency">Default Currency</label>
          <select id="currency" className="input" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {SUPPORTED_CURRENCIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label" htmlFor="language">Language</label>
          <select id="language" className="input" value={language} onChange={(event) => setLanguage(event.target.value)}>
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-1">Stores your preferred language for English/Swahili UI support.</p>
        </div>

        <div className="form-group">
          <label className="label" htmlFor="late_fee_rate">Late Fee Rate (%)</label>
          <input
            id="late_fee_rate"
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={lateFeeRate}
            onChange={(event) => setLateFeeRate(parseFloat(event.target.value) || 0)}
          />
          <p className="text-sm text-gray-500 mt-1">Used to estimate penalty amounts for overdue invoices in reports.</p>
        </div>

        <div className="form-group">
          <label className="label" htmlFor="invoice_payment_instructions">Invoice Payment Instructions</label>
          <textarea
            id="invoice_payment_instructions"
            className="input min-h-24"
            value={invoicePaymentInstructions}
            onChange={(event) => setInvoicePaymentInstructions(event.target.value)}
          />
          <p className="text-sm text-gray-500 mt-1">Shown on invoice pages and PDF downloads.</p>
        </div>

        <div className="form-group">
          <label className="label" htmlFor="invoice_footer_note">Invoice Footer Note</label>
          <input
            id="invoice_footer_note"
            className="input"
            value={invoiceFooterNote}
            onChange={(event) => setInvoiceFooterNote(event.target.value)}
          />
          <p className="text-sm text-gray-500 mt-1">Use this for short notes such as E.&amp;.O.E.</p>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          <Save className="h-5 w-5 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
