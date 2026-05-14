'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, 
  User, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Edit2, 
  Trash2, 
  FileText,
  Receipt,
  CreditCard,
  Loader2,
  AlertCircle,
  Home
} from 'lucide-react'
import { TENANT_TYPES } from '@/utils/constants'
import { formatCurrency, formatDate, getMonthName } from '@/utils/currency'

interface Tenant {
  id: string
  tenant_type: 'individual' | 'business' | 'organization'
  full_name: string | null
  business_name: string | null
  contact_person_name: string | null
  phone: string
  email: string | null
  id_number: string | null
  tin_number: string | null
  business_license_number: string | null
  rent_withholding_tax_enabled: boolean
  service_charge_withholding_tax_enabled: boolean
  rent_withholding_tax_rate: number
  service_charge_withholding_tax_rate: number
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

interface Lease {
  id: string
  unit_id: string
  unit_name: string
  property_name: string
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
  unit_name: string
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  invoice_number: string
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function TenantDetailPage() {
  const router = useRouter()
  const params = useParams()
  const tenantId = getRouteParam(params.id)
  const [loading, setLoading] = useState(true)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [leases, setLeases] = useState<Lease[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState({
    totalLeases: 0,
    activeLeases: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalBalance: 0,
  })

  useEffect(() => {
    if (!tenantId) {
      setError('Tenant not found')
      setLoading(false)
      return
    }

    fetchTenantData()
  }, [tenantId])

  const fetchTenantData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Fetch tenant
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('user_id', user.id)
      .single()

    if (!tenantData) {
      setError('Tenant not found')
      setLoading(false)
      return
    }

    setTenant(tenantData)

    // Fetch leases
    const { data: leasesData } = await supabase
      .from('leases')
      .select(`
        *,
        units(unit_name),
        properties(name)
      `)
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (leasesData) {
      const formattedLeases = leasesData.map((l: any) => ({
        ...l,
        unit_name: l.units?.unit_name,
        property_name: l.properties?.name,
      }))
      setLeases(formattedLeases)
      
      setStats(prev => ({
        ...prev,
        totalLeases: formattedLeases.length,
        activeLeases: formattedLeases.filter((l: any) => l.status === 'active').length,
      }))
    }

    // Fetch invoices
    const { data: invoicesData } = await supabase
      .from('rent_invoices')
      .select(`
        *,
        units(unit_name)
      `)
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (invoicesData) {
      const formattedInvoices = invoicesData.map((inv: any) => ({
        ...inv,
        unit_name: inv.units?.unit_name,
      }))
      setInvoices(formattedInvoices)

      const totalInv = formattedInvoices.reduce((sum: number, inv: any) => sum + inv.subtotal, 0)
      const totalPaid = formattedInvoices.reduce((sum: number, inv: any) => sum + inv.amount_paid, 0)
      
      setStats(prev => ({
        ...prev,
        totalInvoiced: totalInv,
        totalPaid: totalPaid,
        totalBalance: totalInv - totalPaid,
      }))
    }

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select(`
        *,
        rent_invoices(invoice_number)
      `)
      .eq('tenant_id', tenantId)
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

  const handleDelete = async () => {
    setDeleteLoading(true)
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Check if tenant has leases, invoices, or payments
    const { data: leasesCheck } = await supabase
      .from('leases')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)

    const { data: invoicesCheck } = await supabase
      .from('rent_invoices')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)

    const { data: paymentsCheck } = await supabase
      .from('payments')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)

    if ((leasesCheck && leasesCheck.length > 0) || 
        (invoicesCheck && invoicesCheck.length > 0) ||
        (paymentsCheck && paymentsCheck.length > 0)) {
      setError('Cannot delete tenant with existing leases, invoices, or payments.')
      setShowDeleteConfirm(false)
      setDeleteLoading(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      router.push('/tenants')
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

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-danger-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Tenant not found</h2>
        <Link href="/tenants" className="btn-primary mt-4 inline-flex">
          Back to Tenants
        </Link>
      </div>
    )
  }

  const displayName = tenant.tenant_type === 'individual' 
    ? tenant.full_name 
    : tenant.business_name

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
          <Link href="/tenants" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center mr-4">
              {tenant.tenant_type === 'individual' ? (
                <User className="h-6 w-6 text-primary-600" />
              ) : (
                <Building2 className="h-6 w-6 text-primary-600" />
              )}
            </div>
            <div>
              <h1 className="page-title">{displayName}</h1>
              <span className="badge bg-gray-100 text-gray-800">
                {TENANT_TYPES.find(t => t.value === tenant.tenant_type)?.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <Link href={`/tenants/${tenantId}/edit`} className="btn-secondary">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="stat-label">Active Leases</p>
          <p className="stat-value">{stats.activeLeases}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Invoiced</p>
          <p className="stat-value">{formatCurrency(stats.totalInvoiced)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Paid</p>
          <p className="stat-value text-success-600">{formatCurrency(stats.totalPaid)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Balance</p>
          <p className={`stat-value ${stats.totalBalance > 0 ? 'text-danger-600' : 'text-success-600'}`}>
            {formatCurrency(stats.totalBalance)}
          </p>
        </div>
      </div>

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
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <Phone className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">{tenant.phone}</p>
                    </div>
                  </div>
                  
                  {tenant.email && (
                    <div className="flex items-start">
                      <Mail className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{tenant.email}</p>
                      </div>
                    </div>
                  )}

                  {tenant.address && (
                    <div className="flex items-start">
                      <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Address</p>
                        <p className="font-medium">{tenant.address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {tenant.tenant_type === 'individual' ? 'Personal Information' : 'Business Information'}
                </h3>
                <div className="space-y-3">
                  {tenant.tenant_type === 'individual' ? (
                    <>
                      {tenant.id_number && (
                        <div>
                          <p className="text-sm text-gray-500">ID Number</p>
                          <p className="font-medium">{tenant.id_number}</p>
                        </div>
                      )}
                      {tenant.emergency_contact_name && (
                        <div>
                          <p className="text-sm text-gray-500">Emergency Contact</p>
                          <p className="font-medium">{tenant.emergency_contact_name}</p>
                          {tenant.emergency_contact_phone && (
                            <p className="text-sm text-gray-600">{tenant.emergency_contact_phone}</p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {tenant.contact_person_name && (
                        <div>
                          <p className="text-sm text-gray-500">Contact Person</p>
                          <p className="font-medium">{tenant.contact_person_name}</p>
                        </div>
                      )}
                      {tenant.tin_number && (
                        <div>
                          <p className="text-sm text-gray-500">TIN Number</p>
                          <p className="font-medium">{tenant.tin_number}</p>
                        </div>
                      )}
                      {tenant.business_license_number && (
                        <div>
                          <p className="text-sm text-gray-500">Business License</p>
                          <p className="font-medium">{tenant.business_license_number}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-lg font-medium text-gray-900">Withholding Tax</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-sm text-gray-500">Rent WHT</p>
                  <p className={`font-semibold ${tenant.rent_withholding_tax_enabled ? 'text-success-700' : 'text-gray-500'}`}>
                    {tenant.rent_withholding_tax_enabled ? `${tenant.rent_withholding_tax_rate}% deduction enabled` : 'Not applied'}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-sm text-gray-500">Service Charge WHT</p>
                  <p className={`font-semibold ${tenant.service_charge_withholding_tax_enabled ? 'text-success-700' : 'text-gray-500'}`}>
                    {tenant.service_charge_withholding_tax_enabled ? `${tenant.service_charge_withholding_tax_rate}% deduction enabled` : 'Not applied'}
                  </p>
                </div>
              </div>
            </div>

            {tenant.notes && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Notes</h3>
                <p className="text-gray-600">{tenant.notes}</p>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Tenant since {formatDate(tenant.created_at)}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'leases' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Lease History</h3>
              <Link href={`/leases/new?tenant=${tenantId}`} className="btn-primary">
                Create Lease
              </Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Property</th>
                    <th className="table-header-cell">Unit</th>
                    <th className="table-header-cell">Start Date</th>
                    <th className="table-header-cell">End Date</th>
                    <th className="table-header-cell">Rent</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {leases.map((lease) => (
                    <tr key={lease.id} className="hover:bg-gray-50">
                      <td className="table-cell">{lease.property_name}</td>
                      <td className="table-cell">{lease.unit_name}</td>
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
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <Link href={`/leases/${lease.id}`} className="text-primary-600 hover:text-primary-900 font-medium">
                            View
                          </Link>
                          <Link href={`/leases/${lease.id}/edit`} className="text-slate-600 hover:text-slate-900 font-medium">
                            Edit
                          </Link>
                          {lease.status !== 'active' && (
                            <Link href={`/leases/new?tenant=${tenantId}&unit=${lease.unit_id}`} className="text-success-600 hover:text-success-800 font-medium">
                              Renew
                            </Link>
                          )}
                        </div>
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
                    <th className="table-header-cell">Unit</th>
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
                      <td className="table-cell">{invoice.unit_name}</td>
                      <td className="table-cell">{getMonthName(invoice.billing_month)} {invoice.billing_year}</td>
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
                    <th className="table-header-cell">Invoice</th>
                    <th className="table-header-cell">Amount</th>
                    <th className="table-header-cell">Method</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="table-cell">{formatDate(payment.payment_date)}</td>
                      <td className="table-cell">{payment.invoice_number}</td>
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
              <h3 className="text-lg font-medium text-gray-900">Delete Tenant</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{displayName}</strong>? This action cannot be undone.
              <br /><br />
              Note: You can only delete tenants with no leases, invoices, or payments.
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
                {deleteLoading ? 'Deleting...' : 'Delete Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
