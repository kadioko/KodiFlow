'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SUPPORTED_CURRENCIES } from '@/utils/finance'
import { Save } from 'lucide-react'

export default function SettingsPage() {
  const [currency, setCurrency] = useState('TZS')
  const [lateFeeRate, setLateFeeRate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSettings = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('currency_preference, late_fee_rate')
        .eq('id', user.id)
        .single()

      if (data) {
        setCurrency(data.currency_preference || 'TZS')
        setLateFeeRate(Number(data.late_fee_rate || 0))
      }
      setLoading(false)
    }

    fetchSettings()
  }, [])

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
      .update({ currency_preference: currency, late_fee_rate: lateFeeRate })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
    } else {
      setMessage('Settings saved')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="text-gray-500">Loading settings...</div>
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

      <form onSubmit={saveSettings} className="card p-6 space-y-6">
        <div className="form-group">
          <label className="label" htmlFor="currency">Default Currency</label>
          <select id="currency" className="input" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {SUPPORTED_CURRENCIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
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

        <button type="submit" disabled={saving} className="btn-primary">
          <Save className="h-5 w-5 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
