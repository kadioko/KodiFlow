'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { DateInput } from '@/components/ui/DateInput'
import { createClient } from '@/lib/supabase/client'
import { BILLING_FREQUENCIES, LEASE_STATUSES, LEASE_TYPES } from '@/utils/constants'
import { formatCurrency } from '@/utils/currency'

type LeaseStatus = 'active' | 'expired' | 'terminated' | 'renewed' | 'pending'
type LeaseType = 'residential' | 'commercial'
type BillingFrequency = 'monthly' | 'quarterly' | 'semi_annually' | 'annually'
type EscalationType = 'none' | 'percentage' | 'fixed_amount'
type EscalationFrequency = 'none' | 'annually' | 'custom'

interface TenantOption {
  id: string
  display_name: string
}

interface UnitOption {
  id: string
  unit_name: string
  unit_identifier: string | null
  property_id: string
  property_name: string
  monthly_rent: number
  usage_type: string
  status: string
}

interface LeaseFormData {
  tenant_id: string
  unit_id: string
  property_id: string
  start_date: string
  end_date: string
  monthly_rent: number
  service_charge: number
  deposit_amount: number
  opening_balance: number
  rent_due_day: number
  lease_type: LeaseType
  billing_frequency: BillingFrequency
  rent_escalation_type: EscalationType
  rent_escalation_value: number | null
  rent_escalation_frequency: EscalationFrequency
  status: LeaseStatus
  notes: string
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

const billingOptions: ReadonlyArray<{ value: BillingFrequency; label: string }> = BILLING_FREQUENCIES

export default function EditLeasePage() {
  const router = useRouter()
  const params = useParams()
  const leaseId = getRouteParam(params.id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [originalUnitId, setOriginalUnitId] = useState('')

  const [formData, setFormData] = useState<LeaseFormData>({
    tenant_id: '',
    unit_id: '',
    property_id: '',
    start_date: '',
    end_date: '',
    monthly_rent: 0,
    service_charge: 0,
    deposit_amount: 0,
    opening_balance: 0,
    rent_due_day: 1,
    lease_type: 'residential',
    billing_frequency: 'monthly',
    rent_escalation_type: 'none',
    rent_escalation_value: null,
    rent_escalation_frequency: 'none',
    status: 'active',
    notes: '',
  })

  useEffect(() => {
    if (!leaseId) {
      setError('Lease not found')
      setLoading(false)
      return
    }

    fetchLeaseData()
  }, [leaseId])

  const fetchLeaseData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const [leaseResult, tenantsResult, unitsResult, serviceChargeResult, openingBalanceResult] = await Promise.all([
      supabase
        .from('leases')
        .select('*')
        .eq('id', leaseId)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('tenants')
        .select('id, full_name, business_name')
        .eq('user_id', user.id)
        .order('full_name'),
      supabase
        .from('units')
        .select('id, unit_name, unit_identifier, property_id, monthly_rent, usage_type, status, properties(name)')
        .eq('user_id', user.id)
        .order('unit_name'),
      supabase
        .from('charges')
        .select('id, amount')
        .eq('lease_id', leaseId)
        .eq('user_id', user.id)
        .eq('charge_type', 'service_charge')
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('charges')
        .select('id, amount')
        .eq('lease_id', leaseId)
        .eq('user_id', user.id)
        .eq('charge_name', 'Opening Balance')
        .eq('frequency', 'one_time')
        .eq('is_active', true)
        .maybeSingle(),
    ])

    if (leaseResult.error || !leaseResult.data) {
      setError('Lease not found')
      setLoading(false)
      return
    }

    const lease = leaseResult.data
    setOriginalUnitId(lease.unit_id)
    setFormData({
      tenant_id: lease.tenant_id,
      unit_id: lease.unit_id,
      property_id: lease.property_id,
      start_date: lease.start_date,
      end_date: lease.end_date,
      monthly_rent: lease.monthly_rent,
      service_charge: serviceChargeResult.data?.amount || 0,
      deposit_amount: lease.deposit_amount || 0,
      opening_balance: openingBalanceResult.data?.amount || 0,
      rent_due_day: lease.rent_due_day || 1,
      lease_type: lease.lease_type,
      billing_frequency: lease.billing_frequency,
      rent_escalation_type: lease.rent_escalation_type || 'none',
      rent_escalation_value: lease.rent_escalation_value,
      rent_escalation_frequency: lease.rent_escalation_frequency || 'none',
      status: lease.status,
      notes: lease.notes || '',
    })

    setTenants((tenantsResult.data || []).map((tenant) => ({
      id: tenant.id,
      display_name: tenant.full_name || tenant.business_name || 'Unnamed tenant',
    })))

    setUnits((unitsResult.data || []).map((unit: any) => ({
      id: unit.id,
      unit_name: unit.unit_name,
      unit_identifier: unit.unit_identifier,
      property_id: unit.property_id,
      property_name: unit.properties?.name || 'Property',
      monthly_rent: unit.monthly_rent,
      usage_type: unit.usage_type,
      status: unit.status,
    })))

    setLoading(false)
  }

  const handleUnitChange = (unitId: string) => {
    const selectedUnit = units.find((unit) => unit.id === unitId)
    if (!selectedUnit) return

    setFormData((current) => ({
      ...current,
      unit_id: selectedUnit.id,
      property_id: selectedUnit.property_id,
      monthly_rent: selectedUnit.monthly_rent,
      lease_type: selectedUnit.usage_type === 'commercial' ? 'commercial' : 'residential',
    }))
  }

  const syncUnitStatuses = async (userId: string) => {
    const supabase = createClient()

    if (formData.status === 'active') {
      await supabase
        .from('units')
        .update({ status: 'occupied', updated_at: new Date().toISOString() })
        .eq('id', formData.unit_id)
        .eq('user_id', userId)
    }

    if (originalUnitId && originalUnitId !== formData.unit_id) {
      const { count } = await supabase
        .from('leases')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', originalUnitId)
        .eq('user_id', userId)
        .eq('status', 'active')

      if (!count) {
        await supabase
          .from('units')
          .update({ status: 'vacant', updated_at: new Date().toISOString() })
          .eq('id', originalUnitId)
          .eq('user_id', userId)
      }
    }

    if (formData.status !== 'active') {
      const { count } = await supabase
        .from('leases')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', formData.unit_id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .neq('id', leaseId)

      if (!count) {
        await supabase
          .from('units')
          .update({ status: 'vacant', updated_at: new Date().toISOString() })
          .eq('id', formData.unit_id)
          .eq('user_id', userId)
      }
    }
  }

  const syncServiceCharge = async (userId: string) => {
    const supabase = createClient()
    const { data: existingCharge } = await supabase
      .from('charges')
      .select('id')
      .eq('lease_id', leaseId)
      .eq('user_id', userId)
      .eq('charge_type', 'service_charge')
      .maybeSingle()

    if (formData.service_charge > 0) {
      if (existingCharge) {
        const { error: updateError } = await supabase
          .from('charges')
          .update({
            charge_name: 'Service Charge',
            amount: formData.service_charge,
            frequency: 'monthly',
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCharge.id)
          .eq('user_id', userId)

        return updateError
      }

      const { error: insertError } = await supabase
        .from('charges')
        .insert({
          user_id: userId,
          lease_id: leaseId!,
          charge_name: 'Service Charge',
          charge_type: 'service_charge',
          amount: formData.service_charge,
          frequency: 'monthly',
          is_active: true,
        })

      return insertError
    }

    if (existingCharge) {
      const { error: deactivateError } = await supabase
        .from('charges')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', existingCharge.id)
        .eq('user_id', userId)

      return deactivateError
    }

    return null
  }

  const syncOpeningBalance = async (userId: string) => {
    const supabase = createClient()
    const { data: existingCharge } = await supabase
      .from('charges')
      .select('id')
      .eq('lease_id', leaseId)
      .eq('user_id', userId)
      .eq('charge_name', 'Opening Balance')
      .eq('frequency', 'one_time')
      .maybeSingle()

    if (formData.opening_balance > 0) {
      if (existingCharge) {
        const { error: updateError } = await supabase
          .from('charges')
          .update({
            charge_type: 'other',
            amount: formData.opening_balance,
            is_active: true,
            notes: 'Previous balance carried into this lease',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCharge.id)
          .eq('user_id', userId)

        return updateError
      }

      const { error: insertError } = await supabase
        .from('charges')
        .insert({
          user_id: userId,
          lease_id: leaseId!,
          charge_name: 'Opening Balance',
          charge_type: 'other',
          amount: formData.opening_balance,
          frequency: 'one_time',
          is_active: true,
          notes: 'Previous balance carried into this lease',
        })

      return insertError
    }

    if (existingCharge) {
      const { error: deactivateError } = await supabase
        .from('charges')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', existingCharge.id)
        .eq('user_id', userId)

      return deactivateError
    }

    return null
  }

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
      .from('leases')
      .update({
        tenant_id: formData.tenant_id,
        unit_id: formData.unit_id,
        property_id: formData.property_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        monthly_rent: formData.monthly_rent,
        deposit_amount: formData.deposit_amount,
        rent_due_day: formData.rent_due_day,
        lease_type: formData.lease_type,
        billing_frequency: formData.billing_frequency,
        rent_escalation_type: formData.rent_escalation_type,
        rent_escalation_value: formData.rent_escalation_value,
        rent_escalation_frequency: formData.rent_escalation_frequency,
        status: formData.status,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    const serviceChargeError = await syncServiceCharge(user.id)
    if (serviceChargeError) {
      setError(serviceChargeError.message)
      setSaving(false)
      return
    }

    const openingBalanceError = await syncOpeningBalance(user.id)
    if (openingBalanceError) {
      setError(openingBalanceError.message)
      setSaving(false)
      return
    }

    await syncUnitStatuses(user.id)
    router.push(`/leases/${leaseId}`)
    router.refresh()
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="page-header">
        <div className="flex items-center">
          <Link href={`/leases/${leaseId}`} className="mr-4 rounded-lg p-2 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Edit Lease</h1>
            <p className="text-gray-500">Update tenant, unit, rent, dates, and status</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="form-group">
            <label htmlFor="tenant_id" className="label">Tenant</label>
            <select id="tenant_id" required className="input" value={formData.tenant_id} onChange={(event) => setFormData({ ...formData, tenant_id: event.target.value })}>
              <option value="">Select tenant</option>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.display_name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="unit_id" className="label">Unit</label>
            <select id="unit_id" required className="input" value={formData.unit_id} onChange={(event) => handleUnitChange(event.target.value)}>
              <option value="">Select unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.property_name} - {unit.unit_identifier ? `${unit.unit_identifier} / ` : ''}{unit.unit_name}{unit.status !== 'vacant' && unit.id !== originalUnitId ? ` (${unit.status})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <DateInput id="start_date" label="Start Date" required value={formData.start_date} onChange={(value) => setFormData({ ...formData, start_date: value })} />
          <DateInput id="end_date" label="End Date" required value={formData.end_date} onChange={(value) => setFormData({ ...formData, end_date: value })} />
          <div className="form-group">
            <label htmlFor="status" className="label">Status</label>
            <select id="status" required className="input" value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value as LeaseStatus })}>
              {LEASE_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <CurrencyInput id="monthly_rent" label="Monthly Rent" required value={formData.monthly_rent} onChange={(value) => setFormData({ ...formData, monthly_rent: value })} />
          <CurrencyInput id="service_charge" label="Service Charge" value={formData.service_charge} onChange={(value) => setFormData({ ...formData, service_charge: value })} />
          <CurrencyInput id="deposit_amount" label="Security Deposit" value={formData.deposit_amount} onChange={(value) => setFormData({ ...formData, deposit_amount: value })} helperText="For the initial lease agreement; not added to rent invoices." />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <CurrencyInput
            id="opening_balance"
            label="Opening Balance (old owed)"
            value={formData.opening_balance}
            onChange={(value) => setFormData({ ...formData, opening_balance: value })}
            helperText="One-time amount added to the next generated invoice."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="form-group">
            <label htmlFor="rent_due_day" className="label">Rent Due Day</label>
            <select id="rent_due_day" required className="input" value={formData.rent_due_day} onChange={(event) => setFormData({ ...formData, rent_due_day: parseInt(event.target.value) })}>
              {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 md:col-span-2">
            <p className="text-sm font-semibold text-slate-500">Monthly Charge Preview</p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Rent</p>
                <p className="font-bold text-slate-900">{formatCurrency(formData.monthly_rent)}</p>
              </div>
              <div>
                <p className="text-slate-500">Service</p>
                <p className="font-bold text-slate-900">{formatCurrency(formData.service_charge)}</p>
              </div>
              <div>
                <p className="text-slate-500">Total</p>
                <p className="font-bold text-primary-700">{formatCurrency(formData.monthly_rent + formData.service_charge)}</p>
              </div>
            </div>
          </div>
        </div>

        {formData.opening_balance > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">First Invoice Preview</p>
            <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-amber-700">Monthly total</p>
                <p className="font-bold text-slate-900">{formatCurrency(formData.monthly_rent + formData.service_charge)}</p>
              </div>
              <div>
                <p className="text-amber-700">Opening balance</p>
                <p className="font-bold text-slate-900">{formatCurrency(formData.opening_balance)}</p>
              </div>
              <div>
                <p className="text-amber-700">First invoice</p>
                <p className="font-bold text-primary-700">{formatCurrency(formData.monthly_rent + formData.service_charge + formData.opening_balance)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="form-group">
            <label htmlFor="lease_type" className="label">Lease Type</label>
            <select id="lease_type" required className="input" value={formData.lease_type} onChange={(event) => setFormData({ ...formData, lease_type: event.target.value as LeaseType })}>
              {LEASE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="billing_frequency" className="label">Billing Frequency</label>
            <select id="billing_frequency" required className="input" value={formData.billing_frequency} onChange={(event) => setFormData({ ...formData, billing_frequency: event.target.value as BillingFrequency })}>
              {billingOptions.map((frequency) => <option key={frequency.value} value={frequency.value}>{frequency.label}</option>)}
            </select>
          </div>
        </div>

        {formData.lease_type === 'commercial' && (
          <div className="grid gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-3">
            <div className="form-group">
              <label className="label">Escalation Type</label>
              <select className="input" value={formData.rent_escalation_type} onChange={(event) => setFormData({ ...formData, rent_escalation_type: event.target.value as EscalationType })}>
                <option value="none">No Escalation</option>
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed Amount</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Escalation Value</label>
              <input type="number" min="0" className="input" value={formData.rent_escalation_value || ''} onChange={(event) => setFormData({ ...formData, rent_escalation_value: event.target.value ? parseFloat(event.target.value) : null })} />
            </div>
            <div className="form-group">
              <label className="label">Frequency</label>
              <select className="input" value={formData.rent_escalation_frequency} onChange={(event) => setFormData({ ...formData, rent_escalation_frequency: event.target.value as EscalationFrequency })}>
                <option value="none">None</option>
                <option value="annually">Annually</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="notes" className="label">Notes</label>
          <textarea id="notes" rows={3} className="input" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} />
        </div>

        <div className="flex justify-end gap-4 pt-2">
          <Link href={`/leases/${leaseId}`} className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="mr-2 h-5 w-5" />
            {saving ? 'Saving...' : 'Save Lease'}
          </button>
        </div>
      </form>
    </div>
  )
}
