'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UTILITY_TYPES, getLabelByValue } from '@/utils/constants'
import { formatCurrency, getCurrentMonthYear } from '@/utils/currency'
import { Gauge, Plus, Trash2 } from 'lucide-react'

type PropertyOption = { id: string; name: string }
type UnitOption = { id: string; unit_name: string; property_id: string }
type Reading = {
  id: string
  property_id: string
  unit_id: string | null
  utility_type: string
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
    utility_type: 'water',
    previous_reading: 0,
    current_reading: 0,
    rate_per_unit: 0,
    reading_date: new Date().toISOString().split('T')[0],
    billing_month: month,
    billing_year: year,
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [propertiesResult, unitsResult, readingsResult] = await Promise.all([
      supabase.from('properties').select('id, name').eq('user_id', user.id).order('name'),
      supabase.from('units').select('id, unit_name, property_id').eq('user_id', user.id).order('unit_name'),
      supabase
        .from('utility_meter_readings')
        .select('*, properties(name), units(unit_name)')
        .eq('user_id', user.id)
        .order('reading_date', { ascending: false }),
    ])

    setProperties(propertiesResult.data || [])
    setUnits(unitsResult.data || [])
    setReadings((readingsResult.data || []) as Reading[])
    setLoading(false)
  }

  const saveReading = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('utility_meter_readings').insert({
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

    if (error) {
      setError(error.message)
    } else {
      setFormData((current) => ({ ...current, previous_reading: 0, current_reading: 0, rate_per_unit: 0, notes: '' }))
      await fetchData()
    }
    setSaving(false)
  }

  const deleteReading = async (id: string) => {
    if (!confirm('Delete this utility reading?')) return
    const supabase = createClient()
    await supabase.from('utility_meter_readings').delete().eq('id', id)
    await fetchData()
  }

  const filteredUnits = units.filter((unit) => unit.property_id === formData.property_id)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Utility Management</h1>
          <p className="text-gray-500">Track water and electricity meter readings by property and unit</p>
        </div>
      </div>

      {error && <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">{error}</div>}

      <form onSubmit={saveReading} className="card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select required className="input" value={formData.property_id} onChange={(event) => setFormData({ ...formData, property_id: event.target.value, unit_id: '' })}>
            <option value="">Select property</option>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
          <select className="input" value={formData.unit_id} onChange={(event) => setFormData({ ...formData, unit_id: event.target.value })}>
            <option value="">Whole property</option>
            {filteredUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_name}</option>)}
          </select>
          <select className="input" value={formData.utility_type} onChange={(event) => setFormData({ ...formData, utility_type: event.target.value })}>
            {UTILITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <input className="input" type="number" min="0" step="0.01" placeholder="Previous reading" value={formData.previous_reading} onChange={(event) => setFormData({ ...formData, previous_reading: parseFloat(event.target.value) || 0 })} />
          <input className="input" type="number" min="0" step="0.01" placeholder="Current reading" value={formData.current_reading} onChange={(event) => setFormData({ ...formData, current_reading: parseFloat(event.target.value) || 0 })} />
          <input className="input" type="number" min="0" step="0.01" placeholder="Rate per unit" value={formData.rate_per_unit} onChange={(event) => setFormData({ ...formData, rate_per_unit: parseFloat(event.target.value) || 0 })} />
          <input className="input" type="date" value={formData.reading_date} onChange={(event) => setFormData({ ...formData, reading_date: event.target.value })} />
          <input className="input" type="number" min="1" max="12" value={formData.billing_month} onChange={(event) => setFormData({ ...formData, billing_month: parseInt(event.target.value) || month })} />
          <input className="input" type="number" min="2020" max="2050" value={formData.billing_year} onChange={(event) => setFormData({ ...formData, billing_year: parseInt(event.target.value) || year })} />
        </div>
        <input className="input" placeholder="Notes" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} />
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
                    <tr key={reading.id}>
                      <td className="table-cell">{getLabelByValue(UTILITY_TYPES, reading.utility_type)}</td>
                      <td className="table-cell">{property?.name}{unit?.unit_name ? ` / ${unit.unit_name}` : ''}</td>
                      <td className="table-cell">{reading.previous_reading} → {reading.current_reading}</td>
                      <td className="table-cell">{reading.usage_amount}</td>
                      <td className="table-cell font-medium">{formatCurrency(reading.total_amount)}</td>
                      <td className="table-cell">{reading.reading_date}</td>
                      <td className="table-cell">
                        <button onClick={() => deleteReading(reading.id)} className="text-danger-600 hover:text-danger-800">
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
