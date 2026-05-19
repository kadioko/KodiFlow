'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DateInput } from '@/components/ui/DateInput'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { 
  ArrowLeft, 
  FileText, 
  XCircle, 
  RefreshCw,
  CheckCircle,
  Loader2,
  AlertCircle,
  User,
  Home,
  Building2,
  Calendar,
  DollarSign,
  CreditCard,
  Edit2,
  Trash2
} from 'lucide-react'
import { LEASE_TYPES, LEASE_STATUSES, BILLING_FREQUENCIES, getLabelByValue } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'
import { calculateChargeAmountForPeriod, getRenewalTerm } from '@/utils/billing'

interface Lease {
  id: string
  tenant_id: string
  tenant_name: string
  tenant_type: string
  unit_id: string
  unit_name: string
  property_id: string
  property_name: string
  start_date: string
  end_date: string
  monthly_rent: number
  deposit_amount: number
  rent_due_day: number
  lease_type: string
  billing_frequency: string
  status: string
  notes: string | null
  created_at: string
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  invoice_number: string
}

type LeaseInvoiceBalance = {
  balance: number | null
  status: string
}

type RecurringCharge = {
  id: string
  charge_name: string
  amount: number
  frequency: string
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function LeaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const leaseId = getRouteParam(params.id)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false)
  const [showRenewModal, setShowRenewModal] = useState(false)
  
  const [lease, setLease] = useState<Lease | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [recurringCharges, setRecurringCharges] = useState<RecurringCharge[]>([])
  const [renewData, setRenewData] = useState({
    new_end_date: '',
    new_rent: 0,
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

    await supabase.rpc('expire_stale_leases')
    await supabase.rpc('refresh_overdue_invoices')

    // Fetch lease with tenant, unit, property info
    const { data: leaseData } = await supabase
      .from('leases')
      .select(`
        *,
        tenants(id, full_name, business_name, tenant_type),
        units(unit_name),
        properties(name)
      `)
      .eq('id', leaseId)
      .eq('user_id', user.id)
      .single()

    if (!leaseData) {
      setError('Lease not found')
      setLoading(false)
      return
    }

    setLease({
      ...leaseData,
      tenant_name: leaseData.tenants?.full_name || leaseData.tenants?.business_name,
      tenant_type: leaseData.tenants?.tenant_type,
      unit_name: leaseData.units?.unit_name,
      property_name: leaseData.properties?.name,
    })

    // Set default renew data
    const renewalTerm = getRenewalTerm(leaseData.end_date, leaseData.billing_frequency)
    setRenewData({
      new_end_date: renewalTerm.endDate,
      new_rent: leaseData.monthly_rent,
    })

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select(`
        *,
        rent_invoices(invoice_number)
      `)
      .eq('lease_id', leaseId)
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })

    if (paymentsData) {
      setPayments(paymentsData.map((p: any) => ({
        ...p,
        invoice_number: p.rent_invoices?.invoice_number,
      })))
    }

    const { data: invoiceBalances } = await supabase
      .from('rent_invoices')
      .select('balance, status')
      .eq('lease_id', leaseId)
      .eq('user_id', user.id)
      .neq('status', 'cancelled')

    const oldBalance = ((invoiceBalances || []) as LeaseInvoiceBalance[]).reduce((sum, invoice) => sum + (invoice.balance || 0), 0)
    setOutstandingBalance(oldBalance)

    const { data: chargeData } = await supabase
      .from('charges')
      .select('id, charge_name, amount, frequency')
      .eq('lease_id', leaseId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .neq('frequency', 'one_time')

    setRecurringCharges((chargeData || []) as RecurringCharge[])

    setLoading(false)
  }

  const handleTerminate = async () => {
    setActionLoading(true)
    setError('')
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    const { error: updateError } = await supabase
      .from('leases')
      .update({
        status: 'terminated',
        end_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      // Update unit status to vacant
      if (lease) {
        await supabase
          .from('units')
          .update({ status: 'vacant' })
          .eq('id', lease.unit_id)
      }
      
      setSuccess('Lease terminated successfully')
      setShowTerminateConfirm(false)
      fetchLeaseData()
    }

    setActionLoading(false)
  }

  const handleRenew = async () => {
    setActionLoading(true)
    setError('')
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || !lease) return

    const { data: renewalResult, error: renewError } = await supabase.rpc('renew_lease', {
      p_lease_id: lease.id,
      p_new_end_date: renewData.new_end_date,
      p_new_rent: renewData.new_rent,
    })

    if (renewError || !renewalResult?.[0]) {
      setError(renewError?.message || 'Lease was not renewed')
    } else {
      setSuccess('Lease renewed successfully')
      setShowRenewModal(false)
      router.push(`/leases/${renewalResult[0].new_lease_id}`)
    }

    setActionLoading(false)
  }

  const deleteLease = async () => {
    if (!lease) return
    if (!confirm('Delete this lease? Related invoices and payments may also be deleted by the database. This cannot be undone.')) return

    setActionLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setActionLoading(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('leases')
      .delete()
      .eq('id', leaseId)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
      setActionLoading(false)
      return
    }

    await supabase
      .from('units')
      .update({ status: 'vacant', updated_at: new Date().toISOString() })
      .eq('id', lease.unit_id)
      .eq('user_id', user.id)

    router.push('/leases')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!lease) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-danger-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Lease not found</h2>
        <Link href="/leases" className="btn-primary mt-4 inline-flex">
          Back to Leases
        </Link>
      </div>
    )
  }

  const isActive = lease.status === 'active'
  const isExpired = new Date(lease.end_date) < new Date()
  const canRenew = lease.status === 'active' || lease.status === 'expired'
  const daysUntilExpiry = Math.ceil((new Date(lease.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  const renewalTerm = getRenewalTerm(lease.end_date, lease.billing_frequency)
  const renewalRecurringCharges = recurringCharges.reduce(
    (sum, charge) => sum + calculateChargeAmountForPeriod(charge.amount, charge.frequency, lease.billing_frequency),
    0
  )
  const renewalBaseInvoiceTotal = renewData.new_rent * renewalTerm.months + renewalRecurringCharges
  const renewalFirstInvoiceTotal = Math.max(renewalBaseInvoiceTotal + outstandingBalance, 0)
  const carryForwardType = outstandingBalance > 0 ? 'Opening Balance' : outstandingBalance < 0 ? 'Opening Credit' : 'No Carry Forward'
  const carryForwardDescription = outstandingBalance > 0
    ? 'Unpaid invoice balances from this lease will be added to the renewed lease.'
    : outstandingBalance < 0
      ? 'Overpaid invoice credit from this lease will reduce the renewed lease.'
      : 'This lease is settled, so renewal will start clean.'
  const carryForwardTone = outstandingBalance > 0
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : outstandingBalance < 0
      ? 'border-success-200 bg-success-50 text-success-800'
      : 'border-slate-200 bg-slate-50 text-slate-700'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/leases" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center mr-4">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="page-title">Lease Agreement</h1>
                <span className={`badge ${
                  lease.status === 'active' ? 'bg-success-100 text-success-800' :
                  lease.status === 'expired' ? 'bg-danger-100 text-danger-800' :
                  lease.status === 'terminated' ? 'bg-gray-100 text-gray-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {lease.status}
                </span>
              </div>
              <p className="text-gray-500">
                {lease.property_name} • {lease.unit_name}
              </p>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <Link href={`/leases/${leaseId}/edit`} className="btn-secondary">
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Link>
          <button onClick={deleteLease} disabled={actionLoading} className="btn-danger">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
          {canRenew && (
            <>
              <button 
                onClick={() => setShowRenewModal(true)}
                className="btn-primary"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Renew
              </button>
              {isActive && (
              <button 
                onClick={() => setShowTerminateConfirm(true)}
                className="btn-danger"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Terminate
              </button>
              )}
            </>
          )}
          {!canRenew && (
            <Link href={`/leases/new?tenant=${lease.tenant_id}&unit=${lease.unit_id}`} className="btn-primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Renew / New Lease
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Expiry Warning */}
      {isActive && daysUntilExpiry <= 90 && daysUntilExpiry > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-warning-600 mr-3" />
          <div>
            <p className="font-medium text-warning-800">
              Lease expires in {daysUntilExpiry} days
            </p>
            <p className="text-sm text-warning-600">
              Consider renewing the lease or preparing for tenant change.
            </p>
          </div>
        </div>
      )}

      {canRenew && (
        <div className={`rounded-xl border p-4 ${carryForwardTone}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">Renewal Carry-Forward Status</p>
              <p className="mt-1 text-sm">{carryForwardDescription}</p>
            </div>
            <div className="rounded-lg bg-white/70 px-4 py-3 text-right shadow-sm ring-1 ring-black/5">
              <p className="text-xs font-semibold uppercase tracking-wide">{carryForwardType}</p>
              <p className="text-lg font-bold">
                {outstandingBalance === 0 ? formatCurrency(0) : formatCurrency(Math.abs(outstandingBalance))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tenant Card */}
        <div className="card">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                <User className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Tenant</p>
                <p className="font-semibold">{lease.tenant_name}</p>
              </div>
            </div>
            <Link 
              href={`/tenants/${lease.tenant_id}`}
              className="text-primary-600 hover:underline text-sm"
            >
              View Tenant →
            </Link>
          </div>
        </div>

        {/* Property Card */}
        <div className="card">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 rounded-lg bg-success-100 flex items-center justify-center mr-3">
                <Building2 className="h-5 w-5 text-success-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Property</p>
                <p className="font-semibold">{lease.property_name}</p>
                <p className="text-sm text-gray-500">Unit: {lease.unit_name}</p>
              </div>
            </div>
            <Link 
              href={`/properties/${lease.property_id}`}
              className="text-primary-600 hover:underline text-sm"
            >
              View Property →
            </Link>
            <Link 
              href={`/units/${lease.unit_id}`}
              className="ml-4 text-primary-600 hover:underline text-sm"
            >
              View Unit →
            </Link>
          </div>
        </div>

        {/* Rent Card */}
        <div className="card">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 rounded-lg bg-warning-100 flex items-center justify-center mr-3">
                <DollarSign className="h-5 w-5 text-warning-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Monthly Rent</p>
                <p className="text-xl font-bold">{formatCurrency(lease.monthly_rent)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Due on day {lease.rent_due_day} of each month
            </p>
          </div>
        </div>
      </div>

      {/* Lease Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Lease Details</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Lease Type</span>
                <span className="font-medium">{getLabelByValue(LEASE_TYPES, lease.lease_type)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Billing Frequency</span>
                <span className="font-medium">{getLabelByValue(BILLING_FREQUENCIES, lease.billing_frequency)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Start Date</span>
                <span className="font-medium">{formatDate(lease.start_date)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">End Date</span>
                <span className={`font-medium ${isExpired ? 'text-danger-600' : ''}`}>
                  {formatDate(lease.end_date)}
                  {isExpired && ' (Expired)'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Security Deposit</span>
                <span className="font-medium">{formatCurrency(lease.deposit_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Payment History</h3>
          </div>
          <div className="card-body">
            {payments.length > 0 ? (
              <div className="space-y-3">
                {payments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-sm">{formatDate(payment.payment_date)}</p>
                      <p className="text-xs text-gray-500">{payment.invoice_number}</p>
                    </div>
                    <span className="text-success-600 font-medium">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No payments recorded</p>
            )}
          </div>
        </div>
      </div>

      {lease.notes && (
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-2">Notes</h3>
            <p className="text-gray-600">{lease.notes}</p>
          </div>
        </div>
      )}

      {/* Terminate Confirmation Modal */}
      {showTerminateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-6 w-6 text-danger-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Terminate Lease</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to terminate this lease for <strong>{lease.tenant_name}</strong>?
              <br /><br />
              The lease will end today ({formatDate(new Date().toISOString())}) and the unit will be marked as vacant.
              <br /><br />
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowTerminateConfirm(false)}
                className="btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleTerminate}
                className="btn-danger"
                disabled={actionLoading}
              >
                {actionLoading ? 'Terminating...' : 'Terminate Lease'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <RefreshCw className="h-6 w-6 text-primary-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Renew Lease</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Renew lease for <strong>{lease.tenant_name}</strong> at {lease.property_name} - {lease.unit_name}
            </p>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500">New start</p>
                  <p className="font-semibold text-slate-900">{formatDate(renewalTerm.startDate)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Billing</p>
                  <p className="font-semibold text-slate-900">{getLabelByValue(BILLING_FREQUENCIES, lease.billing_frequency)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Recurring charges</p>
                  <p className="font-semibold text-slate-900">{formatCurrency(renewalRecurringCharges)}</p>
                </div>
                <div>
                  <p className="text-slate-500">First invoice preview</p>
                  <p className="font-semibold text-primary-700">{formatCurrency(renewalFirstInvoiceTotal)}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-white p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                <div className="flex justify-between py-1">
                  <span>New lease charges before carry-forward</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(renewalBaseInvoiceTotal)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>{carryForwardType}</span>
                  <span className={`font-semibold ${outstandingBalance > 0 ? 'text-amber-700' : outstandingBalance < 0 ? 'text-success-700' : 'text-slate-700'}`}>
                    {outstandingBalance > 0 ? '+' : outstandingBalance < 0 ? '-' : ''}
                    {formatCurrency(Math.abs(outstandingBalance))}
                  </span>
                </div>
                <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 font-semibold">
                  <span>Expected first invoice after renewal</span>
                  <span className="text-primary-700">{formatCurrency(renewalFirstInvoiceTotal)}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="form-group">
                <DateInput
                  id="renew_end_date"
                  label="New End Date"
                  value={renewData.new_end_date}
                  min={lease.end_date}
                  onChange={(value) => setRenewData({ ...renewData, new_end_date: value })}
                />
              </div>
              
              <CurrencyInput id="renew_new_rent" label="New Monthly Rent (TZS)" value={renewData.new_rent} onChange={(value) => setRenewData({ ...renewData, new_rent: value })} />

              {outstandingBalance !== 0 && (
                <div className={`rounded-xl border p-4 ${outstandingBalance > 0 ? 'border-amber-200 bg-amber-50' : 'border-success-200 bg-success-50'}`}>
                  <p className={`text-sm font-semibold ${outstandingBalance > 0 ? 'text-amber-800' : 'text-success-800'}`}>
                    {outstandingBalance > 0 ? 'Opening Balance' : 'Opening Credit'}
                  </p>
                  <p className={`mt-1 text-sm ${outstandingBalance > 0 ? 'text-amber-700' : 'text-success-700'}`}>
                    {outstandingBalance > 0
                      ? `${formatCurrency(outstandingBalance)} unpaid from this lease will be carried to the renewed lease.`
                      : `${formatCurrency(Math.abs(outstandingBalance))} overpaid on this lease will be credited to the renewed lease.`}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowRenewModal(false)}
                className="btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleRenew}
                className="btn-primary"
                disabled={actionLoading}
              >
                {actionLoading ? 'Renewing...' : 'Renew Lease'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
