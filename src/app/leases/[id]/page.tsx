'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
  CreditCard
} from 'lucide-react'
import { LEASE_TYPES, LEASE_STATUSES, BILLING_FREQUENCIES, getLabelByValue } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'

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

export default function LeaseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false)
  const [showRenewModal, setShowRenewModal] = useState(false)
  
  const [lease, setLease] = useState<Lease | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [renewData, setRenewData] = useState({
    new_end_date: '',
    new_rent: 0,
  })

  useEffect(() => {
    fetchLeaseData()
  }, [params.id])

  const fetchLeaseData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Fetch lease with tenant, unit, property info
    const { data: leaseData } = await supabase
      .from('leases')
      .select(`
        *,
        tenants(id, full_name, business_name, tenant_type),
        units(unit_name),
        properties(name)
      `)
      .eq('id', params.id)
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
    const currentEnd = new Date(leaseData.end_date)
    const newEnd = new Date(currentEnd)
    newEnd.setFullYear(newEnd.getFullYear() + 1)
    setRenewData({
      new_end_date: newEnd.toISOString().split('T')[0],
      new_rent: leaseData.monthly_rent,
    })

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select(`
        *,
        rent_invoices(invoice_number)
      `)
      .eq('lease_id', params.id)
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })

    if (paymentsData) {
      setPayments(paymentsData.map((p: any) => ({
        ...p,
        invoice_number: p.rent_invoices?.invoice_number,
      })))
    }

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
      .eq('id', params.id)
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

    // Mark current lease as renewed
    const { error: updateError } = await supabase
      .from('leases')
      .update({
        status: 'renewed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
      setActionLoading(false)
      return
    }

    // Create new lease
    const { data: newLease, error: createError } = await supabase
      .from('leases')
      .insert({
        user_id: user.id,
        tenant_id: lease.tenant_id,
        unit_id: lease.unit_id,
        property_id: lease.property_id,
        start_date: lease.end_date, // Start from old end date
        end_date: renewData.new_end_date,
        monthly_rent: renewData.new_rent,
        deposit_amount: lease.deposit_amount,
        rent_due_day: lease.rent_due_day,
        lease_type: lease.lease_type,
        billing_frequency: lease.billing_frequency,
        status: 'active',
        notes: `Renewed from lease ${params.id}`,
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
    } else {
      setSuccess('Lease renewed successfully')
      setShowRenewModal(false)
      router.push(`/leases/${newLease.id}`)
    }

    setActionLoading(false)
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
  const daysUntilExpiry = Math.ceil((new Date(lease.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

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
          {isActive && (
            <>
              <button 
                onClick={() => setShowRenewModal(true)}
                className="btn-primary"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Renew
              </button>
              <button 
                onClick={() => setShowTerminateConfirm(true)}
                className="btn-danger"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Terminate
              </button>
            </>
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
                <span className="text-gray-500">Deposit</span>
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
            
            <div className="space-y-4 mb-6">
              <div className="form-group">
                <label className="label">New End Date</label>
                <input
                  type="date"
                  value={renewData.new_end_date}
                  onChange={(e) => setRenewData({ ...renewData, new_end_date: e.target.value })}
                  className="input"
                  min={lease.end_date}
                />
              </div>
              
              <div className="form-group">
                <label className="label">New Monthly Rent (TZS)</label>
                <input
                  type="number"
                  value={renewData.new_rent}
                  onChange={(e) => setRenewData({ ...renewData, new_rent: parseFloat(e.target.value) || 0 })}
                  className="input"
                  min="0"
                />
              </div>
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
