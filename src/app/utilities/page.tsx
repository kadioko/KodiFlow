'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UTILITY_TYPES, getLabelByValue } from '@/utils/constants'
import { formatCurrency, getCurrentMonthYear } from '@/utils/currency'
import { Bolt, Droplets, Gauge, Plus, Trash2 } from 'lucide-react'

type UtilityType = 'water' | 'electricity'
type PropertyOption = { id: string; name: string }
type UnitOption = { id: string; unit_name: string; property_id: string }
type Reading = {
  id: string
  property_id: string
  unit_id: string | null
  utility_type: UtilityType
  previous_reading: number
  current_reading: number
  usage_amount: number
  rate_per_unit: number
  total_amount: number
  reading_date: string
  billing_month: number
  billing_year: number
  notes: string | null
  properties?: { name: string } | { name: string }[] | null
  units?: { unit_name: string } | { unit_name: string }[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toNumber(value: string) {
  return Number.parseFloat(value) || 0
}

export default function UtilitiesPage() {
  const { month, year } = getCurrentMonthYear()
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    property_id: '',
    unit_id: '',
    utility_type: 'water' as UtilityType,
    previous_reading: 0,
    current_reading: 0,
    rate_per_unit: 0,
    reading_date: new Date().toISOString().split('T')[0],
    billing_month: month,
    billing_year: year,
    notes: '',
  })

  const fetchData = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const [propertiesResult, unitsResult, readingsResult] = await Promise.all([
      supabase.from('properties').select('id, name').eq('user_id', user.id).order('name'),
      supabase.from('units').select('id, unit_name, property_id').eq('user_id', user.id).order('unit_name'),
      supabase
        .from('utility_meter_readings')
        .select('*, properties(name), units(unit_name)')
        .eq('user_id', user.id)
        .order('reading_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    if (propertiesResult.error || unitsResult.error || readingsResult.error) {
      setError(propertiesResult.error?.message || unitsResult.error?.message || readingsResult.error?.message || 'Failed to load utility data')
    }

    setProperties(propertiesResult.data || [])
    setUnits(unitsResult.data || [])
    setReadings((readingsResult.data || []) as Reading[])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredUnits = units.filter((unit) => unit.property_id === formData.property_id)
  const projectedUsage = Math.max(0, formData.current_reading - formData.previous_reading)
  const projectedTotal = projectedUsage * formData.rate_per_unit

  const monthlyReadings = useMemo(
    () => readings.filter((reading) => reading.billing_month === formData.billing_month && reading.billing_year === formData.billing_year),
    [formData.billing_month, formData.billing_year, readings]
  )
  const waterTotal = monthlyReadings.filter((reading) => reading.utility_type === 'water').reduce((sum, reading) => sum + Number(reading.total_amount || 0), 0)
  const electricityTotal = monthlyReadings.filter((reading) => reading.utility_type === 'electricity').reduce((sum, reading) => sum + Number(reading.total_amount || 0), 0)
  const monthlyUsage = monthlyReadings.reduce((sum, reading) => sum + Number(reading.usage_amount || 0), 0)

  const updateMeterSelection = (updates: Partial<typeof formData>) => {
    const next = { ...formData, ...updates }
    const previousReading = readings.find((reading) => {
      const sameProperty = reading.property_id === next.property_id
      const sameUnit = (reading.unit_id || '') === (next.unit_id || '')
      const sameUtility = reading.utility_type === next.utility_type
      return sameProperty && sameUnit && sameUtility
    })

    setFormData({
      ...next,
      previous_reading: previousReading?.current_reading ?? next.previous_reading,
    })
  }

  const saveReading = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    if (!formData.property_id) {
      setError('Please select a property')
      setSaving(false)
      return
    }

    if (formData.current_reading < formData.previous_reading) {
      setError('Current reading cannot be lower than the previous reading')
      setSaving(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('utility_meter_readings').insert({
      user_id: user.id,
      property_id: formData.property_id,
      unit_id: formData.unit_id || null,
      utility_type: formData.utility_type,
      previous_reading: formData.previous_reading,
      current_reading: formData.current_reading,
      rate_per_unit: formData.rate_per_unit,
      reading_date: formData.reading_date,
      billing_month: formData.billing_month,
      billing_year: formData.billing_year,
      notes: formData.notes || null,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setFormData((current) => ({
        ...current,
        previous_reading: current.current_reading,
        current_reading: current.current_reading,
        notes: '',
      }))
      await fetchData()
    }

    setSaving(false)
  }

  const deleteReading = async (id: string) => {
    if (!confirm('Delete this utility reading?')) return

    const supabase = createClient()
    const { error: deleteError } = await supabase.from('utility_meter_readings').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    await fetchData()
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Utility Management</h1>
          <p className="text-gray-500">Record water and electricity readings, calculate usage, and track billable amounts.</p>
        </div>
      </div>

      {error && <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="stat-label">Monthly Usage</p>
          <p className="stat-value">{monthlyUsage.toLocaleString()}</p>
          <p className="stat-change">Units recorded for {formData.billing_month}/{formData.billing_year}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label flex items-center"><Droplets className="h-4 w-4 mr-2 text-blue-600" />Water Charges</p>
          <p className="stat-value text-blue-600">{formatCurrency(waterTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label flex items-center"><Bolt className="h-4 w-4 mr-2 text-warning-600" />Electricity Charges</p>
          <p className="stat-value text-warning-600">{formatCurrency(electricityTotal)}</p>
        </div>
      </div>

      <form onSubmit={saveReading} className="card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center"><Gauge className="h-5 w-5 mr-2 text-primary-600" />Add Meter Reading</h2>
          <p className="text-sm text-slate-500">Choose a property, optional unit, and utility type. Previous reading auto-fills from the latest matching reading.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-group">
            <label className="label">Property</label>
            <select required className="input" value={formData.property_id} onChange={(event) => updateMeterSelection({ property_id: event.target.value, unit_id: '' })}>
              <option value="">Select property</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Unit or Whole Property</label>
            <select className="input" value={formData.unit_id} onChange={(event) => updateMeterSelection({ unit_id: event.target.value })} disabled={!formData.property_id}>
              <option value="">Whole property meter</option>
              {filteredUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Utility</label>
            <select className="input" value={formData.utility_type} onChange={(event) => updateMeterSelection({ utility_type: event.target.value as UtilityType })}>
              {UTILITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Previous Reading</label>
            <input className="input" type="number" min="0" step="0.01" value={formData.previous_reading} onChange={(event) => setFormData({ ...formData, previous_reading: toNumber(event.target.value) })} />
          </div>
          <div className="form-group">
            <label className="label">Current Reading</label>
            <input className="input" type="number" min="0" step="0.01" value={formData.current_reading} onChange={(event) => setFormData({ ...formData, current_reading: toNumber(event.target.value) })} />
          </div>
          <div className="form-group">
            <label className="label">Rate per Unit</label>
            <input className="input" type="number" min="0" step="0.01" value={formData.rate_per_unit} onChange={(event) => setFormData({ ...formData, rate_per_unit: toNumber(event.target.value) })} />
          </div>
          <div className="form-group">
            <label className="label">Reading Date</label>
            <input className="input" type="date" value={formData.reading_date} onChange={(event) => setFormData({ ...formData, reading_date: event.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Billing Month</label>
            <input className="input" type="number" min="1" max="12" value={formData.billing_month} onChange={(event) => setFormData({ ...formData, billing_month: parseInt(event.target.value) || month })} />
          </div>
          <div className="form-group">
            <label className="label">Billing Year</label>
            <input className="input" type="number" min="2020" max="2050" value={formData.billing_year} onChange={(event) => setFormData({ ...formData, billing_year: parseInt(event.target.value) || year })} />
          </div>
        </div>

        <input className="input" placeholder="Notes" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} />

        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-900">Calculated charge preview</p>
            <p className="text-sm text-primary-700">Usage: {projectedUsage.toLocaleString()} units × {formatCurrency(formData.rate_per_unit)} per unit</p>
          </div>
          <p className="text-2xl font-black text-primary-700">{formatCurrency(projectedTotal)}</p>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          <Plus className="h-5 w-5 mr-2" />
          {saving ? 'Saving...' : 'Add Reading'}
        </button>
      </form>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center"><Gauge className="h-5 w-5 mr-2" />Meter Readings</h2>
        </div>
        {loading ? (
          <div className="p-6 text-gray-500">Loading readings...</div>
        ) : readings.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No utility readings recorded yet.</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Utility</th>
                  <th className="table-header-cell">Property/Unit</th>
                  <th className="table-header-cell">Billing</th>
                  <th className="table-header-cell">Readings</th>
                  <th className="table-header-cell">Usage</th>
                  <th className="table-header-cell">Amount</th>
                  <th className="table-header-cell">Date</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {readings.map((reading) => {
                  const property = firstRelation(reading.properties)
                  const unit = firstRelation(reading.units)
                  return (
                    <tr key={reading.id} className="hover:bg-slate-50">
                      <td className="table-cell">
                        <span className={`badge ${reading.utility_type === 'water' ? 'bg-blue-100 text-blue-800' : 'bg-warning-100 text-warning-800'}`}>
                          {getLabelByValue(UTILITY_TYPES, reading.utility_type)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <p className="font-medium text-slate-900">{property?.name || 'Unknown property'}</p>
                        <p className="text-sm text-slate-500">{unit?.unit_name || 'Whole property meter'}</p>
                      </td>
                      <td className="table-cell">{reading.billing_month}/{reading.billing_year}</td>
                      <td className="table-cell">{reading.previous_reading.toLocaleString()} → {reading.current_reading.toLocaleString()}</td>
                      <td className="table-cell">{reading.usage_amount.toLocaleString()}</td>
                      <td className="table-cell font-semibold">{formatCurrency(reading.total_amount)}</td>
                      <td className="table-cell">{new Date(reading.reading_date).toLocaleDateString()}</td>
                      <td className="table-cell">
                        <button onClick={() => deleteReading(reading.id)} className="text-danger-600 hover:text-danger-800" aria-label="Delete utility reading">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
