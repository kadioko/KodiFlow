'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, DoorOpen, Building2 } from 'lucide-react'
import { UNIT_TYPES, USAGE_TYPES } from '@/utils/constants'

interface Property {
  id: string
  name: string
}

interface Section {
  id: string
  name: string
  property_id: string
}

export default function NewUnitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [properties, setProperties] = useState<Property[]>([])
  const [sections, setSections] = useState<Section[]>([])

  const [formData, setFormData] = useState<{
    property_id: string
    section_id: string
    unit_name: string
    unit_type: 'apartment' | 'room' | 'house' | 'shop' | 'office' | 'stall' | 'kiosk' | 'warehouse' | 'godown' | 'parking_slot' | 'land_space' | 'other'
    usage_type: 'residential' | 'commercial' | 'mixed'
    monthly_rent: number
    size: number | null
    size_unit: string
    notes: string
  }>({
    property_id: '',
    section_id: '',
    unit_name: '',
    unit_type: 'apartment',
    usage_type: 'residential',
    monthly_rent: 0,
    size: null,
    size_unit: 'sqm',
    notes: '',
  })

  // Fetch properties on load
  useEffect(() => {
    const fetchProperties = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data } = await supabase
          .from('properties')
          .select('id, name')
          .eq('user_id', user.id)
          .order('name')
        
        if (data) {
          setProperties(data)
        }
      }
    }
    fetchProperties()
  }, [])

  // Fetch sections when property changes
  useEffect(() => {
    const fetchSections = async () => {
      if (!formData.property_id) {
        setSections([])
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data } = await supabase
          .from('property_sections')
          .select('id, name, property_id')
          .eq('property_id', formData.property_id)
          .eq('user_id', user.id)
          .order('name')
        
        if (data) {
          setSections(data)
        }
      }
    }
    fetchSections()
  }, [formData.property_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('units')
      .insert({
        user_id: user.id,
        property_id: formData.property_id,
        section_id: formData.section_id || null,
        unit_name: formData.unit_name,
        unit_type: formData.unit_type,
        usage_type: formData.usage_type,
        monthly_rent: formData.monthly_rent,
        size: formData.size,
        size_unit: formData.size_unit,
        notes: formData.notes || null,
        status: 'vacant',
      })

    if (insertError) {
      setError(insertError.message)
    } else {
      router.push('/units')
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/units" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Add New Unit</h1>
            <p className="text-gray-500">Create a new unit or space</p>
          </div>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Property Selection */}
          <div className="form-group">
            <label htmlFor="property_id" className="label">
              Property <span className="text-danger-500">*</span>
            </label>
            <select
              id="property_id"
              required
              value={formData.property_id}
              onChange={(e) => setFormData({ ...formData, property_id: e.target.value, section_id: '' })}
              className="input"
            >
              <option value="">Select a property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section Selection */}
          <div className="form-group">
            <label htmlFor="section_id" className="label">
              Section (Optional)
            </label>
            <select
              id="section_id"
              value={formData.section_id}
              onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
              className="input"
              disabled={!formData.property_id || sections.length === 0}
            >
              <option value="">
                {sections.length === 0 ? 'No sections available' : 'Select a section (optional)'}
              </option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Name */}
          <div className="form-group">
            <label htmlFor="unit_name" className="label">
              Unit Name <span className="text-danger-500">*</span>
            </label>
            <input
              id="unit_name"
              type="text"
              required
              value={formData.unit_name}
              onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
              className="input"
              placeholder="e.g., A1, Shop G01, Office 101"
            />
          </div>

          {/* Unit Type & Usage Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="unit_type" className="label">
                Unit Type <span className="text-danger-500">*</span>
              </label>
              <select
                id="unit_type"
                required
                value={formData.unit_type}
                onChange={(e) => setFormData({ ...formData, unit_type: e.target.value as typeof formData.unit_type })}
                className="input"
              >
                {UNIT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="usage_type" className="label">
                Usage Type <span className="text-danger-500">*</span>
              </label>
              <select
                id="usage_type"
                required
                value={formData.usage_type}
                onChange={(e) => setFormData({ ...formData, usage_type: e.target.value as typeof formData.usage_type })}
                className="input"
              >
                {USAGE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Monthly Rent & Size */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="monthly_rent" className="label">
                Monthly Rent (TZS) <span className="text-danger-500">*</span>
              </label>
              <input
                id="monthly_rent"
                type="number"
                min="0"
                required
                value={formData.monthly_rent}
                onChange={(e) => setFormData({ ...formData, monthly_rent: parseFloat(e.target.value) || 0 })}
                className="input"
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="size" className="label">
                Size
              </label>
              <div className="flex space-x-2">
                <input
                  id="size"
                  type="number"
                  min="0"
                  value={formData.size || ''}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value ? parseFloat(e.target.value) : null })}
                  className="input flex-1"
                  placeholder="Size"
                />
                <select
                  value={formData.size_unit}
                  onChange={(e) => setFormData({ ...formData, size_unit: e.target.value })}
                  className="input w-24"
                >
                  <option value="sqm">sqm</option>
                  <option value="sqft">sqft</option>
                  <option value="acres">acres</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="notes" className="label">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
              placeholder="Additional notes about the unit..."
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <Link href="/units" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Creating...' : 'Create Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
