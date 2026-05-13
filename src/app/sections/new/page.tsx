'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SECTION_TYPES } from '@/utils/constants'

type Property = {
  id: string
  name: string
}

function NewSectionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPropertyId = searchParams.get('property') || ''
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    property_id: initialPropertyId,
    name: '',
    section_type: 'floor',
    description: '',
  })

  useEffect(() => {
    const fetchProperties = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name')

      setProperties(data || [])
    }

    fetchProperties()
  }, [router])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('property_sections').insert({
      user_id: user.id,
      property_id: formData.property_id,
      name: formData.name,
      section_type: formData.section_type as typeof SECTION_TYPES[number]['value'],
      description: formData.description || null,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      router.push(formData.property_id ? `/properties/${formData.property_id}?tab=sections` : '/sections')
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/sections" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Add Section</h1>
            <p className="text-gray-500">Create a floor, block, wing, or zone for a property</p>
          </div>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">{error}</div>}

          <div className="form-group">
            <label htmlFor="property_id" className="label">Property <span className="text-danger-500">*</span></label>
            <select
              id="property_id"
              required
              value={formData.property_id}
              onChange={(event) => setFormData({ ...formData, property_id: event.target.value })}
              className="input"
            >
              <option value="">Select a property</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="name" className="label">Section Name <span className="text-danger-500">*</span></label>
            <input
              id="name"
              required
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              className="input"
              placeholder="e.g. Ground Floor, Block A, Market Zone 1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="section_type" className="label">Section Type <span className="text-danger-500">*</span></label>
            <select
              id="section_type"
              required
              value={formData.section_type}
              onChange={(event) => setFormData({ ...formData, section_type: event.target.value })}
              className="input"
            >
              {SECTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="label">Description</label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              className="input"
              placeholder="Optional notes about this section"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Link href="/sections" className="btn-secondary">Cancel</Link>
            <button type="submit" disabled={loading} className="btn-primary">
              <Save className="h-5 w-5 mr-2" />
              {loading ? 'Saving...' : 'Save Section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NewSectionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading section form...</div>}>
      <NewSectionForm />
    </Suspense>
  )
}
