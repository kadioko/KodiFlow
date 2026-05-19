'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, User, Building2, Loader2, Home, CalendarDays } from 'lucide-react'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { DateInput } from '@/components/ui/DateInput'
import { BILLING_FREQUENCIES, LEASE_TYPES } from '@/utils/constants'
import { addUtcMonths, billingFrequencyMonths } from '@/utils/billing'
import { formatCurrency } from '@/utils/currency'

type AssignmentUnit = {
  id: string
  unit_name: string
  unit_identifier: string | null
  property_id: string
  property_name: string
  monthly_rent: number
  usage_type: string
}

type VacantUnitRow = Omit<AssignmentUnit, 'property_name'> & {
  properties: { name: string | null } | { name: string | null }[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

type BillingFrequency = 'monthly' | 'quarterly' | 'semi_annually' | 'annually'
type LeaseType = 'residential' | 'commercial'

function toIsoDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function getDefaultEndDate(startDate: string, billingFrequency: BillingFrequency) {
  const months = billingFrequencyMonths[billingFrequency] || 1
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = addUtcMonths(start, months)
  end.setUTCDate(end.getUTCDate() - 1)
  return toIsoDate(end)
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function EditTenantPage() {
  const router = useRouter()
  const params = useParams()
  const tenantId = getRouteParam(params.id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tenantType, setTenantType] = useState<'individual' | 'business' | 'organization'>('individual')
  const [hasActiveLease, setHasActiveLease] = useState(false)
  const [vacantUnits, setVacantUnits] = useState<AssignmentUnit[]>([])
  const [assignUnit, setAssignUnit] = useState(false)

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
    rent_withholding_tax_enabled: boolean
    service_charge_withholding_tax_enabled: boolean
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
    rent_withholding_tax_enabled: false,
    service_charge_withholding_tax_enabled: false,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    address: '',
    notes: '',
  })
  const [assignmentData, setAssignmentData] = useState<{
    unit_id: string
    property_id: string
    start_date: string
    end_date: string
    monthly_rent: number
    service_charge: number
    deposit_amount: number
    rent_due_day: number
    lease_type: LeaseType
    billing_frequency: BillingFrequency
  }>(() => {
    const startDate = new Date().toISOString().split('T')[0]
    return {
      unit_id: '',
      property_id: '',
      start_date: startDate,
      end_date: getDefaultEndDate(startDate, 'monthly'),
      monthly_rent: 0,
      service_charge: 0,
      deposit_amount: 0,
      rent_due_day: 1,
      lease_type: 'residential',
      billing_frequency: 'monthly',
    }
  })

  useEffect(() => {
    if (!tenantId) {
      setError('Tenant not found')
      setLoading(false)
      return
    }

    fetchTenant()
  }, [tenantId])

  const fetchTenant = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data, error: fetchError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !data) {
      setError('Tenant not found')
      setLoading(false)
      return
    }

    setTenantType(data.tenant_type)
    setFormData({
      tenant_type: data.tenant_type,
      full_name: data.full_name || '',
      business_name: data.business_name || '',
      contact_person_name: data.contact_person_name || '',
      phone: data.phone,
      email: data.email || '',
      id_number: data.id_number || '',
      tin_number: data.tin_number || '',
      business_license_number: data.business_license_number || '',
      rent_withholding_tax_enabled: data.rent_withholding_tax_enabled || false,
      service_charge_withholding_tax_enabled: data.service_charge_withholding_tax_enabled || false,
      emergency_contact_name: data.emergency_contact_name || '',
      emergency_contact_phone: data.emergency_contact_phone || '',
      address: data.address || '',
      notes: data.notes || '',
    })

    const { data: activeLease } = await supabase
      .from('leases')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    setHasActiveLease(Boolean(activeLease))

    if (!activeLease) {
      const { data: unitsData } = await supabase
        .from('units')
        .select(`
          id,
          unit_name,
          unit_identifier,
          property_id,
          monthly_rent,
          usage_type,
          properties(name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'vacant')
        .order('unit_name')

      const units = ((unitsData || []) as VacantUnitRow[]).map((unit) => ({
        id: unit.id,
        unit_name: unit.unit_name,
        unit_identifier: unit.unit_identifier,
        property_id: unit.property_id,
        property_name: firstRelation(unit.properties)?.name || 'Unknown property',
        monthly_rent: unit.monthly_rent || 0,
        usage_type: unit.usage_type,
      }))

      setVacantUnits(units)
    }

    setLoading(false)
  }

  const handleAssignmentUnitChange = (unitId: string) => {
    const selectedUnit = vacantUnits.find((unit) => unit.id === unitId)
    if (!selectedUnit) {
      setAssignmentData((previous) => ({
        ...previous,
        unit_id: '',
        property_id: '',
        monthly_rent: 0,
      }))
      return
    }

    setAssignmentData((previous) => ({
      ...previous,
      unit_id: selectedUnit.id,
      property_id: selectedUnit.property_id,
      monthly_rent: selectedUnit.monthly_rent,
      lease_type: selectedUnit.usage_type === 'commercial' ? 'commercial' : 'residential',
    }))
  }

  const handleAssignmentStartDateChange = (startDate: string) => {
    setAssignmentData((previous) => ({
      ...previous,
      start_date: startDate,
      end_date: getDefaultEndDate(startDate, previous.billing_frequency),
    }))
  }

  const handleAssignmentBillingFrequencyChange = (billingFrequency: BillingFrequency) => {
    setAssignmentData((previous) => ({
      ...previous,
      billing_frequency: billingFrequency,
      end_date: getDefaultEndDate(previous.start_date, billingFrequency),
    }))
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
      .from('tenants')
      .update({
        tenant_type: formData.tenant_type,
        full_name: formData.full_name || null,
        business_name: formData.business_name || null,
        contact_person_name: formData.contact_person_name || null,
        phone: formData.phone,
        email: formData.email || null,
        id_number: formData.id_number || null,
        tin_number: formData.tin_number || null,
        business_license_number: formData.business_license_number || null,
        rent_withholding_tax_enabled: formData.rent_withholding_tax_enabled,
        service_charge_withholding_tax_enabled: formData.service_charge_withholding_tax_enabled,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        address: formData.address || null,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    if (assignUnit && !hasActiveLease) {
      if (!assignmentData.unit_id || !assignmentData.property_id || !assignmentData.start_date || !assignmentData.end_date) {
        setError('Choose a unit and lease dates before assigning this tenant.')
        setSaving(false)
        return
      }

      if (new Date(`${assignmentData.end_date}T00:00:00Z`) < new Date(`${assignmentData.start_date}T00:00:00Z`)) {
        setError('Lease end date must be after the start date.')
        setSaving(false)
        return
      }

      const { data: existingLease } = await supabase
        .from('leases')
        .select('id')
        .eq('unit_id', assignmentData.unit_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (existingLease) {
        setError('That unit already has an active lease. Refresh and choose another vacant unit.')
        setSaving(false)
        return
      }

      const { data: createdLease, error: leaseError } = await supabase
        .from('leases')
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          unit_id: assignmentData.unit_id,
          property_id: assignmentData.property_id,
          start_date: assignmentData.start_date,
          end_date: assignmentData.end_date,
          monthly_rent: assignmentData.monthly_rent,
          deposit_amount: assignmentData.deposit_amount,
          rent_due_day: assignmentData.rent_due_day,
          lease_type: assignmentData.lease_type,
          billing_frequency: assignmentData.billing_frequency,
          status: 'active',
        })
        .select('id')
        .single()

      if (leaseError || !createdLease) {
        setError(leaseError?.message || 'Tenant was saved, but the unit assignment could not be created.')
        setSaving(false)
        return
      }

      if (assignmentData.service_charge > 0) {
        const { error: chargeError } = await supabase
          .from('charges')
          .insert({
            user_id: user.id,
            lease_id: createdLease.id,
            charge_name: 'Service Charge',
            charge_type: 'service_charge',
            amount: assignmentData.service_charge,
            frequency: 'monthly',
            is_active: true,
          })

        if (chargeError) {
          setError(chargeError.message)
          setSaving(false)
          return
        }
      }

      await supabase
        .from('units')
        .update({ status: 'occupied', updated_at: new Date().toISOString() })
        .eq('id', assignmentData.unit_id)
        .eq('user_id', user.id)
    }

    {
      router.push(`/tenants/${tenantId}`)
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

  const displayName = tenantType === 'individual' ? formData.full_name : formData.business_name

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center">
          <Link href={`/tenants/${tenantId}`} className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Edit Tenant</h1>
            <p className="text-gray-500">{displayName || 'Tenant'}</p>
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
                  setFormData({ ...formData, tenant_type: 'individual' })
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
                  setFormData({ ...formData, tenant_type: 'business' })
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
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="id_number" className="label">ID Number</label>
                  <input
                    id="id_number"
                    type="text"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                    className="input"
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
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="emergency_contact_name" className="label">Emergency Contact</label>
                  <input
                    id="emergency_contact_name"
                    type="text"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="emergency_contact_phone" className="label">Emergency Phone</label>
                  <input
                    id="emergency_contact_phone"
                    type="tel"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    className="input"
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
                />
              </div>

              <div className="form-group">
                <label htmlFor="contact_person_name" className="label">Contact Person</label>
                <input
                  id="contact_person_name"
                  type="text"
                  value={formData.contact_person_name}
                  onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="tin_number" className="label">TIN Number</label>
                  <input
                    id="tin_number"
                    type="text"
                    value={formData.tin_number}
                    onChange={(e) => setFormData({ ...formData, tin_number: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="business_license_number" className="label">Business License</label>
                  <input
                    id="business_license_number"
                    type="text"
                    value={formData.business_license_number}
                    onChange={(e) => setFormData({ ...formData, business_license_number: e.target.value })}
                    className="input"
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
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            </>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Withholding Tax</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg bg-white p-3">
                <input
                  type="checkbox"
                  checked={formData.rent_withholding_tax_enabled}
                  onChange={(e) => setFormData({ ...formData, rent_withholding_tax_enabled: e.target.checked })}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Deduct 10% rent WHT</span>
                  <span className="block text-xs text-slate-500">Applies as a deduction on rent invoice lines.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg bg-white p-3">
                <input
                  type="checkbox"
                  checked={formData.service_charge_withholding_tax_enabled}
                  onChange={(e) => setFormData({ ...formData, service_charge_withholding_tax_enabled: e.target.checked })}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Deduct 5% service WHT</span>
                  <span className="block text-xs text-slate-500">Applies as a deduction on service charge invoice lines.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address" className="label">Address</label>
            <textarea
              id="address"
              rows={3}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes" className="label">Notes</label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
            />
          </div>

          {!hasActiveLease && (
            <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600">
                    <Home className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Assign this tenant to a vacant unit</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Create the active lease while saving tenant changes.
                    </p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={assignUnit}
                    onChange={(event) => setAssignUnit(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  Assign now
                </label>
              </div>

              {assignUnit && (
                <div className="mt-4 space-y-4 rounded-lg bg-white p-4">
                  {vacantUnits.length === 0 ? (
                    <p className="text-sm text-gray-500">No vacant units are available right now.</p>
                  ) : (
                    <>
                      <div className="form-group">
                        <label htmlFor="assignment_unit_id" className="label">
                          Vacant Unit <span className="text-danger-500">*</span>
                        </label>
                        <select
                          id="assignment_unit_id"
                          required={assignUnit}
                          value={assignmentData.unit_id}
                          onChange={(event) => handleAssignmentUnitChange(event.target.value)}
                          className="input"
                        >
                          <option value="">Select a vacant unit</option>
                          {vacantUnits.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.property_name} - {unit.unit_identifier ? `${unit.unit_identifier} / ` : ''}{unit.unit_name} ({formatCurrency(unit.monthly_rent)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="form-group">
                          <label htmlFor="assignment_lease_type" className="label">Lease Type</label>
                          <select
                            id="assignment_lease_type"
                            value={assignmentData.lease_type}
                            onChange={(event) => setAssignmentData({ ...assignmentData, lease_type: event.target.value as LeaseType })}
                            className="input"
                          >
                            {LEASE_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label htmlFor="assignment_billing_frequency" className="label">Billing Frequency</label>
                          <select
                            id="assignment_billing_frequency"
                            value={assignmentData.billing_frequency}
                            onChange={(event) => handleAssignmentBillingFrequencyChange(event.target.value as BillingFrequency)}
                            className="input"
                          >
                            {BILLING_FREQUENCIES.map((frequency) => (
                              <option key={frequency.value} value={frequency.value}>
                                {frequency.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <DateInput id="assignment_start_date" label="Start Date" required value={assignmentData.start_date} onChange={handleAssignmentStartDateChange} />
                        <DateInput id="assignment_end_date" label="End Date" required value={assignmentData.end_date} onChange={(value) => setAssignmentData({ ...assignmentData, end_date: value })} />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <CurrencyInput id="assignment_monthly_rent" label="Monthly Rent" required value={assignmentData.monthly_rent} onChange={(value) => setAssignmentData({ ...assignmentData, monthly_rent: value })} />
                        <CurrencyInput id="assignment_service_charge" label="Service Charge" value={assignmentData.service_charge} onChange={(value) => setAssignmentData({ ...assignmentData, service_charge: value })} />
                        <CurrencyInput id="assignment_deposit" label="Security Deposit" value={assignmentData.deposit_amount} onChange={(value) => setAssignmentData({ ...assignmentData, deposit_amount: value })} />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="form-group">
                          <label htmlFor="assignment_rent_due_day" className="label">Rent Due Day</label>
                          <select
                            id="assignment_rent_due_day"
                            value={assignmentData.rent_due_day}
                            onChange={(event) => setAssignmentData({ ...assignmentData, rent_due_day: parseInt(event.target.value) })}
                            className="input"
                          >
                            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                              <option key={day} value={day}>
                                {day}th
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <CalendarDays className="h-4 w-4" />
                            Assignment Preview
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-slate-500">Rent</p>
                              <p className="font-bold text-slate-900">{formatCurrency(assignmentData.monthly_rent)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Service</p>
                              <p className="font-bold text-slate-900">{formatCurrency(assignmentData.service_charge)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Monthly Total</p>
                              <p className="font-bold text-primary-700">{formatCurrency(assignmentData.monthly_rent + assignmentData.service_charge)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end space-x-4 pt-4">
            <Link href={`/tenants/${tenantId}`} className="btn-secondary">
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
