'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SECTION_TYPES } from '@/utils/constants'

type Property = {
  id: string
  name: string
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default function EditSectionPage({ params }: PageProps) {
  const router = useRouter()
  const [sectionId, setSectionId] = useState('')
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    property_id: '',
    name: '',
    section_type: 'floor',
    description: '',
  })

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params
      setSectionId(resolvedParams.id)
    }

    loadParams()
  }, [params])

  useEffect(() => {
    if (!sectionId) return

    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const [{ data: propertiesData }, { data: sectionData, error: sectionError }] = await Promise.all([
        supabase.from('properties').select('id, name').eq('user_id', user.id).order('name'),
        supabase.from('property_sections').select('*').eq('id', sectionId).eq('user_id', user.id).single(),
      ])

      if (sectionError || !sectionData) {
        setError(sectionError?.message || 'Section not found')
      } else {
        setProperties(propertiesData || [])
        setFormData({
          property_id: sectionData.property_id,
          name: sectionData.name,
          section_type: sectionData.section_type,
          description: sectionData.description || '',
        })
      }

      setLoading(false)
    }

    fetchData()
  }, [router, sectionId])

  const handleSubmit = async (event: React.FormEvent) => {
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

    const { error: updateError } = await supabase
      .from('property_sections')
      .update({
        property_id: formData.property_id,
        name: formData.name,
        section_type: formData.section_type as typeof SECTION_TYPES[number]['value'],
        description: formData.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sectionId)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      router.push('/sections')
      router.refresh()
    }

    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this section? Units in this section will need to be moved first if database constraints prevent deletion.')) return

    const supabase = createClient()
    const { error: deleteError } = await supabase.from('property_sections').delete().eq('id', sectionId)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      router.push('/sections')
      router.refresh()
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Loading section...</div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/sections" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Edit Section</h1>
            <p className="text-gray-500">{formData.name || 'Section'}</p>
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
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={handleDelete} className="btn-danger">
              <Trash2 className="h-5 w-5 mr-2" />
              Delete Section
            </button>
            <div className="flex justify-end space-x-3">
              <Link href="/sections" className="btn-secondary">Cancel</Link>
              <button type="submit" disabled={saving} className="btn-primary">
                <Save className="h-5 w-5 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
