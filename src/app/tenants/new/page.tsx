'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, User, Building2 } from 'lucide-react'
import { TENANT_TYPES } from '@/utils/constants'

export default function NewTenantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tenantType, setTenantType] = useState<'individual' | 'business' | 'organization'>('individual')

  const [formData, setFormData] = useState<{
    tenant_type: 'individual' | 'business' | 'organization'
    full_name: string
    business_name: string
    contact_person_name: string
    phone: string
    email: string
    id_number: string
    tin_number: string
    business_license_number: string
    emergency_contact_name: string
    emergency_contact_phone: string
    address: string
    notes: string
  }>({
    tenant_type: 'individual',
    full_name: '',
    business_name: '',
    contact_person_name: '',
    phone: '',
    email: '',
    id_number: '',
    tin_number: '',
    business_license_number: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    address: '',
    notes: '',
  })

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
      .from('tenants')
      .insert({
        user_id: user.id,
        tenant_type: formData.tenant_type,
        full_name: formData.full_name || null,
        business_name: formData.business_name || null,
        contact_person_name: formData.contact_person_name || null,
        phone: formData.phone,
        email: formData.email || null,
        id_number: formData.id_number || null,
        tin_number: formData.tin_number || null,
        business_license_number: formData.business_license_number || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        address: formData.address || null,
        notes: formData.notes || null,
      })

    if (insertError) {
      setError(insertError.message)
    } else {
      router.push('/tenants')
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/tenants" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Add New Tenant</h1>
            <p className="text-gray-500">Create a new residential or commercial tenant</p>
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

          {/* Tenant Type Selection */}
          <div className="form-group">
            <label className="label">Tenant Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setTenantType('individual')
                  setFormData({ ...formData, tenant_type: 'individual' as const })
                }}
                className={`flex items-center justify-center p-4 border-2 rounded-lg transition-colors ${
                  tenantType === 'individual'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className="h-5 w-5 mr-2" />
                Individual
              </button>
              <button
                type="button"
                onClick={() => {
                  setTenantType('business')
                  setFormData({ ...formData, tenant_type: 'business' as const })
                }}
                className={`flex items-center justify-center p-4 border-2 rounded-lg transition-colors ${
                  tenantType === 'business'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Building2 className="h-5 w-5 mr-2" />
                Business
              </button>
            </div>
          </div>

          {tenantType === 'individual' ? (
            <>
              <div className="form-group">
                <label htmlFor="full_name" className="label">
                  Full Name <span className="text-danger-500">*</span>
                </label>
                <input
                  id="full_name"
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="input"
                  placeholder="e.g., John Mwakalinga"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="id_number" className="label">
                    ID Number
                  </label>
                  <input
                    id="id_number"
                    type="text"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                    className="input"
                    placeholder="National ID or Passport"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone" className="label">
                    Phone <span className="text-danger-500">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                    placeholder="+255..."
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="email@example.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="emergency_contact_name" className="label">
                    Emergency Contact Name
                  </label>
                  <input
                    id="emergency_contact_name"
                    type="text"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    className="input"
                    placeholder="Emergency contact person"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="emergency_contact_phone" className="label">
                    Emergency Contact Phone
                  </label>
                  <input
                    id="emergency_contact_phone"
                    type="tel"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    className="input"
                    placeholder="+255..."
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="business_name" className="label">
                  Business Name <span className="text-danger-500">*</span>
                </label>
                <input
                  id="business_name"
                  type="text"
                  required
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="input"
                  placeholder="e.g., ABC Enterprises Ltd"
                />
              </div>

              <div className="form-group">
                <label htmlFor="contact_person_name" className="label">
                  Contact Person Name
                </label>
                <input
                  id="contact_person_name"
                  type="text"
                  value={formData.contact_person_name}
                  onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                  className="input"
                  placeholder="Primary contact person"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="tin_number" className="label">
                    TIN Number
                  </label>
                  <input
                    id="tin_number"
                    type="text"
                    value={formData.tin_number}
                    onChange={(e) => setFormData({ ...formData, tin_number: e.target.value })}
                    className="input"
                    placeholder="Tax ID Number"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="business_license_number" className="label">
                    Business License
                  </label>
                  <input
                    id="business_license_number"
                    type="text"
                    value={formData.business_license_number}
                    onChange={(e) => setFormData({ ...formData, business_license_number: e.target.value })}
                    className="input"
                    placeholder="License number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="phone" className="label">
                    Phone <span className="text-danger-500">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                    placeholder="+255..."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email" className="label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    placeholder="business@email.com"
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="address" className="label">
              Address
            </label>
            <textarea
              id="address"
              rows={3}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input"
              placeholder="Physical address..."
            />
          </div>

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
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <Link href="/tenants" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Creating...' : 'Create Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
