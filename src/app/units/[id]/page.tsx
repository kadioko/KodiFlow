'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, 
  DoorOpen, 
  Edit2, 
  Trash2, 
  FileText,
  Receipt,
  CreditCard,
  Loader2,
  AlertCircle,
  User,
  CheckCircle,
  XCircle,
  Calendar
} from 'lucide-react'
import { UNIT_TYPES, UNIT_STATUSES, getLabelByValue, getColorByValue } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'

interface Unit {
  id: string
  unit_name: string
  unit_type: string
  usage_type: string
  monthly_rent: number
  size: number | null
  size_unit: string
  status: string
  notes: string | null
  property_id: string
  property_name: string
  section_id: string | null
  section_name: string | null
}

interface Lease {
  id: string
  tenant_id: string
  tenant_name: string
  start_date: string
  end_date: string
  monthly_rent: number
  status: string
}

interface Invoice {
  id: string
  invoice_number: string
  billing_month: number
  billing_year: number
  subtotal: number
  balance: number
  status: string
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  tenant_name: string
}

export default function UnitDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  
  const [unit, setUnit] = useState<Unit | null>(null)
  const [leases, setLeases] = useState<Lease[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [currentLease, setCurrentLease] = useState<Lease | null>(null)

  useEffect(() => {
    fetchUnitData()
  }, [params.id])

  const fetchUnitData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Fetch unit with property and section info
    const { data: unitData } = await supabase
      .from('units')
      .select(`
        *,
        properties(name),
        property_sections(name)
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!unitData) {
      setError('Unit not found')
      setLoading(false)
      return
    }

    setUnit({
      ...unitData,
      property_name: unitData.properties?.name,
      section_name: unitData.property_sections?.name,
    })

    // Fetch leases
    const { data: leasesData } = await supabase
      .from('leases')
      .select(`
        *,
        tenants(full_name, business_name)
      `)
      .eq('unit_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (leasesData) {
      const formattedLeases = leasesData.map((l: any) => ({
        ...l,
        tenant_name: l.tenants?.full_name || l.tenants?.business_name,
      }))
      setLeases(formattedLeases)
      
      // Find current active lease
      const active = formattedLeases.find((l: any) => l.status === 'active')
      setCurrentLease(active || null)
    }

    // Fetch invoices
    const { data: invoicesData } = await supabase
      .from('rent_invoices')
      .select('*')
      .eq('unit_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (invoicesData) {
      setInvoices(invoicesData)
    }

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select(`
        *,
        tenants(full_name, business_name)
      `)
      .eq('unit_id', params.id)
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })

    if (paymentsData) {
      setPayments(paymentsData.map((p: any) => ({
        ...p,
        tenant_name: p.tenants?.full_name || p.tenants?.business_name,
      })))
    }

    setLoading(false)
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Check if unit has leases, invoices, or payments
    const { data: leasesCheck } = await supabase
      .from('leases')
      .select('id', { count: 'exact' })
      .eq('unit_id', params.id)

    const { data: invoicesCheck } = await supabase
      .from('rent_invoices')
      .select('id', { count: 'exact' })
      .eq('unit_id', params.id)

    const { data: paymentsCheck } = await supabase
      .from('payments')
      .select('id', { count: 'exact' })
      .eq('unit_id', params.id)

    if ((leasesCheck && leasesCheck.length > 0) || 
        (invoicesCheck && invoicesCheck.length > 0) ||
        (paymentsCheck && paymentsCheck.length > 0)) {
      setError('Cannot delete unit with existing leases, invoices, or payments.')
      setShowDeleteConfirm(false)
      setDeleteLoading(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('units')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      router.push('/units')
      router.refresh()
    }

    setDeleteLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-danger-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Unit not found</h2>
        <Link href="/units" className="btn-primary mt-4 inline-flex">
          Back to Units
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'leases', label: 'Leases' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'payments', label: 'Payments' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/units" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center mr-4">
              <DoorOpen className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h1 className="page-title">{unit.unit_name}</h1>
              <div className="flex items-center space-x-2">
                <Link href={`/properties/${unit.property_id}`} className="text-gray-500 hover:text-primary-600">
                  {unit.property_name}
                </Link>
                {unit.section_name && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">{unit.section_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <Link href={`/units/${params.id}/edit`} className="btn-secondary">
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Link>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-danger"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Status & Rent */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="stat-label">Status</p>
          <p className="stat-value">
            <span className={`badge ${getColorByValue(UNIT_STATUSES, unit.status)}`}>
              {getLabelByValue(UNIT_STATUSES, unit.status)}
            </span>
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Monthly Rent</p>
          <p className="stat-value">{formatCurrency(unit.monthly_rent)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Size</p>
          <p className="stat-value">
            {unit.size ? `${unit.size} ${unit.size_unit}` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Current Tenant Card (if occupied) */}
      {currentLease && (
        <div className="card border-l-4 border-success-500">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-success-100 flex items-center justify-center mr-4">
                  <User className="h-5 w-5 text-success-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Tenant</p>
                  <p className="text-lg font-semibold">{currentLease.tenant_name}</p>
                  <p className="text-sm text-gray-500">
                    Lease until {formatDate(currentLease.end_date)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Monthly Rent</p>
                <p className="text-xl font-bold text-success-600">
                  {formatCurrency(currentLease.monthly_rent)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vacant - Create Lease CTA */}
      {unit.status === 'vacant' && (
        <div className="card border-l-4 border-warning-500">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-warning-100 flex items-center justify-center mr-4">
                <Calendar className="h-5 w-5 text-warning-600" />
              </div>
              <div>
                <p className="text-lg font-medium">Unit is Vacant</p>
                <p className="text-sm text-gray-500">Create a lease to assign a tenant</p>
              </div>
            </div>
            <Link href={`/leases/new?unit=${params.id}`} className="btn-primary">
              Create Lease
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Unit Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Unit Type</span>
                    <span className="font-medium">{getLabelByValue(UNIT_TYPES, unit.unit_type)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Usage Type</span>
                    <span className="font-medium capitalize">{unit.usage_type}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Monthly Rent</span>
                    <span className="font-medium">{formatCurrency(unit.monthly_rent)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Size</span>
                    <span className="font-medium">
                      {unit.size ? `${unit.size} ${unit.size_unit}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Location</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-500">Property</span>
                    <p className="font-medium">
                      <Link href={`/properties/${unit.property_id}`} className="text-primary-600 hover:underline">
                        {unit.property_name}
                      </Link>
                    </p>
                  </div>
                  {unit.section_name && (
                    <div>
                      <span className="text-gray-500">Section</span>
                      <p className="font-medium">{unit.section_name}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {unit.notes && (
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Notes</h3>
                <p className="text-gray-600">{unit.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leases' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Lease History</h3>
              {unit.status === 'vacant' && (
                <Link href={`/leases/new?unit=${params.id}`} className="btn-primary">
                  Create Lease
                </Link>
              )}
            </div>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Tenant</th>
                    <th className="table-header-cell">Start Date</th>
                    <th className="table-header-cell">End Date</th>
                    <th className="table-header-cell">Rent</th>
                    <th className="table-header-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {leases.map((lease) => (
                    <tr key={lease.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{lease.tenant_name}</td>
                      <td className="table-cell">{formatDate(lease.start_date)}</td>
                      <td className="table-cell">{formatDate(lease.end_date)}</td>
                      <td className="table-cell">{formatCurrency(lease.monthly_rent)}</td>
                      <td className="table-cell">
                        <span className={`badge ${
                          lease.status === 'active' ? 'bg-success-100 text-success-800' :
                          lease.status === 'expired' ? 'bg-danger-100 text-danger-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {lease.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Invoices</h3>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Invoice #</th>
                    <th className="table-header-cell">Period</th>
                    <th className="table-header-cell">Amount</th>
                    <th className="table-header-cell">Balance</th>
                    <th className="table-header-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{invoice.invoice_number}</td>
                      <td className="table-cell">{invoice.billing_month}/{invoice.billing_year}</td>
                      <td className="table-cell">{formatCurrency(invoice.subtotal)}</td>
                      <td className="table-cell">{formatCurrency(invoice.balance)}</td>
                      <td className="table-cell">
                        <span className={`badge ${
                          invoice.status === 'paid' ? 'bg-success-100 text-success-800' :
                          invoice.status === 'overdue' ? 'bg-danger-100 text-danger-800' :
                          invoice.status === 'partially_paid' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Payment History</h3>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Date</th>
                    <th className="table-header-cell">Tenant</th>
                    <th className="table-header-cell">Amount</th>
                    <th className="table-header-cell">Method</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="table-cell">{formatDate(payment.payment_date)}</td>
                      <td className="table-cell">{payment.tenant_name}</td>
                      <td className="table-cell text-success-600 font-medium">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="table-cell">{payment.payment_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-6 w-6 text-danger-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Delete Unit</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete unit <strong>{unit.unit_name}</strong>? This action cannot be undone.
              <br /><br />
              Note: You can only delete units with no leases, invoices, or payments.
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="btn-danger"
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Unit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
