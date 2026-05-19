'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { DateInput } from '@/components/ui/DateInput'
import { LEASE_TYPES, BILLING_FREQUENCIES } from '@/utils/constants'
import { formatCurrency } from '@/utils/currency'

interface Tenant {
  id: string
  display_name: string
  tenant_type: string
}

interface Unit {
  id: string
  unit_name: string
  unit_identifier: string | null
  property_id: string
  property_name: string
  monthly_rent: number
  usage_type: string
  status: string
}

function NewLeasePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedUnitId = searchParams.get('unit')
  const preselectedTenantId = searchParams.get('tenant')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [units, setUnits] = useState<Unit[]>([])

  const [formData, setFormData] = useState<{
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
    lease_type: 'residential' | 'commercial'
    billing_frequency: 'monthly' | 'quarterly' | 'semi_annually' | 'annually'
    rent_escalation_type: 'none' | 'percentage' | 'fixed_amount'
    rent_escalation_value: number | null
    rent_escalation_frequency: 'none' | 'annually' | 'custom'
    notes: string
  }>({
    tenant_id: preselectedTenantId || '',
    unit_id: preselectedUnitId || '',
    property_id: '',
    start_date: new Date().toISOString().split('T')[0],
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
    notes: '',
  })

  // Fetch tenants and units on load
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Fetch tenants
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('id, full_name, business_name, tenant_type')
          .eq('user_id', user.id)
          .order('full_name')
        
        if (tenantsData) {
          setTenants(tenantsData.map(t => ({
            id: t.id,
            display_name: t.full_name || t.business_name || 'Unknown',
            tenant_type: t.tenant_type,
          })))
        }

        // Fetch vacant units, plus a preselected unit when renewing from history.
        const { data: unitsData } = await supabase
          .from('units')
          .select(`
            id,
            unit_name,
            unit_identifier,
            property_id,
            monthly_rent,
            usage_type,
            status,
            properties(name)
          `)
          .eq('user_id', user.id)
          .order('unit_name')
        
        if (unitsData) {
          const formattedUnits = unitsData
            .filter((u: any) => u.status === 'vacant' || u.id === preselectedUnitId)
            .map((u: any) => ({
            id: u.id,
            unit_name: u.unit_name,
            unit_identifier: u.unit_identifier,
            property_id: u.property_id,
            property_name: u.properties?.name,
            monthly_rent: u.monthly_rent,
            usage_type: u.usage_type,
            status: u.status,
          }))
          setUnits(formattedUnits)
          
          // If unit is preselected, set the property_id and lease_type
          if (preselectedUnitId) {
            const selectedUnit = formattedUnits.find(u => u.id === preselectedUnitId)
            if (selectedUnit) {
              setFormData(prev => ({
                ...prev,
                property_id: selectedUnit.property_id,
                monthly_rent: selectedUnit.monthly_rent,
                lease_type: selectedUnit.usage_type === 'commercial' ? 'commercial' : 'residential',
              }))
            }
          }
        }
      }
    }
    fetchData()
  }, [preselectedUnitId, preselectedTenantId])

  const handleUnitChange = (unitId: string) => {
    const selectedUnit = units.find(u => u.id === unitId)
    if (selectedUnit) {
      setFormData(prev => ({
        ...prev,
        unit_id: unitId,
        property_id: selectedUnit.property_id,
        monthly_rent: selectedUnit.monthly_rent,
        lease_type: selectedUnit.usage_type === 'commercial' ? 'commercial' : 'residential',
      }))
    }
  }

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

    const { data: createdLease, error: insertError } = await supabase
      .from('leases')
      .insert({
        user_id: user.id,
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
        status: 'active',
        notes: formData.notes || null,
      })
      .select('id')
      .single()

    if (insertError || !createdLease) {
      setError(insertError?.message || 'Lease was not created')
    } else {
      if (formData.service_charge > 0) {
        const { error: chargeError } = await supabase
          .from('charges')
          .insert({
            user_id: user.id,
            lease_id: createdLease.id,
            charge_name: 'Service Charge',
            charge_type: 'service_charge',
            amount: formData.service_charge,
            frequency: 'monthly',
            is_active: true,
          })

        if (chargeError) {
          setError(chargeError.message)
          setLoading(false)
          return
        }
      }

      if (formData.opening_balance > 0) {
        const { error: openingBalanceError } = await supabase
          .from('charges')
          .insert({
            user_id: user.id,
            lease_id: createdLease.id,
            charge_name: 'Opening Balance',
            charge_type: 'other',
            amount: formData.opening_balance,
            frequency: 'one_time',
            is_active: true,
            notes: 'Previous balance carried into this lease',
          })

        if (openingBalanceError) {
          setError(openingBalanceError.message)
          setLoading(false)
          return
        }
      }

      await supabase
        .from('units')
        .update({ status: 'occupied', updated_at: new Date().toISOString() })
        .eq('id', formData.unit_id)
        .eq('user_id', user.id)

      router.push('/leases')
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/leases" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Create New Lease</h1>
            <p className="text-gray-500">Assign a tenant to a unit</p>
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

          {/* Tenant Selection */}
          <div className="form-group">
            <label htmlFor="tenant_id" className="label">
              Tenant <span className="text-danger-500">*</span>
            </label>
            <select
              id="tenant_id"
              required
              value={formData.tenant_id}
              onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
              className="input"
            >
              <option value="">Select a tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.display_name} ({tenant.tenant_type})
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              <Link href="/tenants/new" className="text-primary-600 hover:underline">
                + Add new tenant
              </Link>
            </p>
          </div>

          {/* Unit Selection */}
          <div className="form-group">
            <label htmlFor="unit_id" className="label">
              Unit <span className="text-danger-500">*</span>
            </label>
            <select
              id="unit_id"
              required
              value={formData.unit_id}
              onChange={(e) => handleUnitChange(e.target.value)}
              className="input"
            >
              <option value="">Select a vacant unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.property_name} - {unit.unit_identifier ? `${unit.unit_identifier} / ` : ''}{unit.unit_name} ({unit.usage_type}, {unit.status}, TZS {unit.monthly_rent.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Lease Type & Billing Frequency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="lease_type" className="label">
                Lease Type <span className="text-danger-500">*</span>
              </label>
              <select
                id="lease_type"
                required
                value={formData.lease_type}
                onChange={(e) => setFormData({ ...formData, lease_type: e.target.value as typeof formData.lease_type })}
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
              <label htmlFor="billing_frequency" className="label">
                Billing Frequency <span className="text-danger-500">*</span>
              </label>
              <select
                id="billing_frequency"
                required
                value={formData.billing_frequency}
                onChange={(e) => setFormData({ ...formData, billing_frequency: e.target.value as typeof formData.billing_frequency })}
                className="input"
              >
                {BILLING_FREQUENCIES.map((freq) => (
                  <option key={freq.value} value={freq.value}>
                    {freq.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DateInput id="start_date" label="Start Date" required value={formData.start_date} onChange={(value) => setFormData({ ...formData, start_date: value })} />
            <DateInput id="end_date" label="End Date" required value={formData.end_date} onChange={(value) => setFormData({ ...formData, end_date: value })} />
          </div>

          {/* Rent, Service Charge & Security Deposit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CurrencyInput id="monthly_rent" label="Monthly Rent (TZS)" required value={formData.monthly_rent} onChange={(value) => setFormData({ ...formData, monthly_rent: value })} />
            <CurrencyInput id="service_charge" label="Service Charge (TZS)" value={formData.service_charge} onChange={(value) => setFormData({ ...formData, service_charge: value })} />
            <CurrencyInput id="deposit_amount" label="Security Deposit (TZS)" value={formData.deposit_amount} onChange={(value) => setFormData({ ...formData, deposit_amount: value })} helperText="For the initial lease agreement; not added to rent invoices." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CurrencyInput
              id="opening_balance"
              label="Opening Balance (old owed)"
              value={formData.opening_balance}
              onChange={(value) => setFormData({ ...formData, opening_balance: value })}
              helperText="One-time amount added to the next generated invoice."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label htmlFor="rent_due_day" className="label">
                Rent Due Day <span className="text-danger-500">*</span>
              </label>
              <select
                id="rent_due_day"
                required
                value={formData.rent_due_day}
                onChange={(e) => setFormData({ ...formData, rent_due_day: parseInt(e.target.value) })}
                className="input"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}th of each month
                  </option>
                ))}
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

          {/* Rent Escalation (Commercial) */}
          {formData.lease_type === 'commercial' && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h3 className="font-medium text-gray-900">Rent Escalation (Optional)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="label">Escalation Type</label>
                  <select
                    value={formData.rent_escalation_type}
                    onChange={(e) => setFormData({ ...formData, rent_escalation_type: e.target.value as typeof formData.rent_escalation_type })}
                    className="input"
                  >
                    <option value="none">No Escalation</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount</option>
                  </select>
                </div>

                {formData.rent_escalation_type !== 'none' && (
                  <>
                    <div className="form-group">
                      <label className="label">
                        {formData.rent_escalation_type === 'percentage' ? 'Percentage (%)' : 'Amount (TZS)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.rent_escalation_value || ''}
                        onChange={(e) => setFormData({ ...formData, rent_escalation_value: e.target.value ? parseFloat(e.target.value) : null })}
                        className="input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label">Frequency</label>
                      <select
                        value={formData.rent_escalation_frequency}
                        onChange={(e) => setFormData({ ...formData, rent_escalation_frequency: e.target.value as typeof formData.rent_escalation_frequency })}
                        className="input"
                      >
                        <option value="none">Select...</option>
                        <option value="annually">Annually</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

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
              placeholder="Additional lease terms or notes..."
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <Link href="/leases" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Creating...' : 'Create Lease'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NewLeasePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewLeasePageContent />
    </Suspense>
  )
}
