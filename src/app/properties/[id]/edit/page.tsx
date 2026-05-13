'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Building2, Loader2 } from 'lucide-react'
import { PROPERTY_TYPES } from '@/utils/constants'

export default function EditPropertyPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    property_type: 'residential' as const,
    location: '',
    description: '',
  })

  useEffect(() => {
    fetchProperty()
  }, [params.id])

  const fetchProperty = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data, error: fetchError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !data) {
      setError('Property not found')
      setLoading(false)
      return
    }

    setFormData({
      name: data.name,
      property_type: data.property_type,
      location: data.location || '',
      description: data.description || '',
    })
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('properties')
      .update({
        name: formData.name,
        property_type: formData.property_type,
        location: formData.location || null,
        description: formData.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      router.push(`/properties/${params.id}`)
      router.refresh()
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <div className="flex items-center">
          <Link href={`/properties/${params.id}`} className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Edit Property</h1>
            <p className="text-gray-500">Update property details</p>
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

          <div className="form-group">
            <label htmlFor="name" className="label">
              Property Name <span className="text-danger-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="e.g., Mbezi Apartments"
            />
          </div>

          <div className="form-group">
            <label htmlFor="property_type" className="label">
              Property Type <span className="text-danger-500">*</span>
            </label>
            <select
              id="property_type"
              required
              value={formData.property_type}
              onChange={(e) => setFormData({ ...formData, property_type: e.target.value as typeof formData.property_type })}
              className="input"
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="location" className="label">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input"
              placeholder="e.g., Dar es Salaam, Tanzania"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              placeholder="Describe the property..."
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <Link href={`/properties/${params.id}`} className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
