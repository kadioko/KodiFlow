'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Edit2, 
  Trash2, 
  Plus,
  LayoutDashboard,
  Layers,
  DoorOpen,
  Users,
  FileText,
  Receipt,
  CreditCard,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import { getLabelByValue, getColorByValue, PROPERTY_TYPES, UNIT_STATUSES } from '@/utils/constants'
import { formatCurrency, formatDate, getMonthName } from '@/utils/currency'

interface Property {
  id: string
  name: string
  property_type: 'residential' | 'commercial' | 'mixed_use'
  location: string | null
  description: string | null
}

interface Section {
  id: string
  name: string
  section_type: string
  units_count: number
}

interface Unit {
  id: string
  unit_name: string
  unit_type: string
  usage_type: string
  monthly_rent: number
  status: string
  section_name: string | null
  current_tenant_name: string | null
}

interface Lease {
  id: string
  tenant_id: string
  unit_id: string
  tenant_name: string
  unit_name: string
  start_date: string
  end_date: string
  monthly_rent: number
  status: string
}

interface Invoice {
  id: string
  invoice_number: string
  tenant_name: string
  unit_name: string
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
  invoice_number: string
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const propertyId = getRouteParam(params.id)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const [property, setProperty] = useState<Property | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [leases, setLeases] = useState<Lease[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState({
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    totalLeases: 0,
    activeLeases: 0,
    totalRevenue: 0,
    collectedRevenue: 0,
    outstandingRevenue: 0,
  })

  useEffect(() => {
    if (!propertyId) {
      setError('Property not found')
      setLoading(false)
      return
    }

    fetchPropertyData()
  }, [propertyId])

  const fetchPropertyData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Fetch property
    const { data: propertyData } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .single()

    if (!propertyData) {
      setError('Property not found')
      setLoading(false)
      return
    }

    setProperty(propertyData)

    // Fetch sections
    const { data: sectionsData } = await supabase
      .from('property_sections')
      .select('*, units(count)')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)

    if (sectionsData) {
      setSections(sectionsData.map((s: any) => ({
        ...s,
        units_count: s.units?.[0]?.count || 0,
      })))
    }

    // Fetch units with tenant info
    const { data: unitsData } = await supabase
      .from('units')
      .select(`
        *,
        property_sections(name),
        leases(tenant_id, status, tenants(full_name, business_name))
      `)
      .eq('property_id', propertyId)
      .eq('user_id', user.id)

    if (unitsData) {
      const formattedUnits = unitsData.map((u: any) => {
        const activeLease = u.leases?.find((l: any) => l.status === 'active')
        return {
          ...u,
          section_name: u.property_sections?.name,
          current_tenant_name: activeLease?.tenants?.full_name || activeLease?.tenants?.business_name || null,
        }
      })
      setUnits(formattedUnits)

      // Calculate stats
      const occupied = formattedUnits.filter((u: any) => u.status === 'occupied').length
      const vacant = formattedUnits.filter((u: any) => u.status === 'vacant').length
      
      setStats(prev => ({
        ...prev,
        totalUnits: formattedUnits.length,
        occupiedUnits: occupied,
        vacantUnits: vacant,
      }))
    }

    // Fetch leases
    const { data: leasesData } = await supabase
      .from('leases')
      .select(`
        *,
        tenants(full_name, business_name),
        units(unit_name)
      `)
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (leasesData) {
      const formattedLeases = leasesData.map((l: any) => ({
        ...l,
        tenant_name: l.tenants?.full_name || l.tenants?.business_name,
        unit_name: l.units?.unit_name,
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
        tenants(full_name, business_name),
        units(unit_name)
      `)
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (invoicesData) {
      const formattedInvoices = invoicesData.map((inv: any) => ({
        ...inv,
        tenant_name: inv.tenants?.full_name || inv.tenants?.business_name,
        unit_name: inv.units?.unit_name,
      }))
      setInvoices(formattedInvoices)

      const totalRev = formattedInvoices.reduce((sum: number, inv: any) => sum + inv.subtotal, 0)
      const collectedRev = formattedInvoices.reduce((sum: number, inv: any) => sum + inv.amount_paid, 0)
      
      setStats(prev => ({
        ...prev,
        totalRevenue: totalRev,
        collectedRevenue: collectedRev,
        outstandingRevenue: totalRev - collectedRev,
      }))
    }

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select(`
        *,
        tenants(full_name, business_name),
        rent_invoices(invoice_number)
      `)
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })
      .limit(20)

    if (paymentsData) {
      setPayments(paymentsData.map((p: any) => ({
        ...p,
        tenant_name: p.tenants?.full_name || p.tenants?.business_name,
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

    // Check if property has units, leases, invoices, or payments
    const { data: unitsCheck } = await supabase
      .from('units')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId)

    const { data: leasesCheck } = await supabase
      .from('leases')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId)

    const { data: invoicesCheck } = await supabase
      .from('rent_invoices')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId)

    const { data: paymentsCheck } = await supabase
      .from('payments')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId)

    if ((unitsCheck && unitsCheck.length > 0) || 
        (leasesCheck && leasesCheck.length > 0) ||
        (invoicesCheck && invoicesCheck.length > 0) ||
        (paymentsCheck && paymentsCheck.length > 0)) {
      setError('Cannot delete property with existing units, leases, invoices, or payments.')
      setShowDeleteConfirm(false)
      setDeleteLoading(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      router.push('/properties')
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

  if (!property) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-danger-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Property not found</h2>
        <Link href="/properties" className="btn-primary mt-4 inline-flex">
          Back to Properties
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'sections', label: 'Sections', icon: Layers },
    { id: 'units', label: 'Units', icon: DoorOpen },
    { id: 'leases', label: 'Leases', icon: FileText },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/properties" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="page-title">{property.name}</h1>
              <span className={`badge ${getColorByValue(PROPERTY_TYPES, property.property_type)}`}>
                {getLabelByValue(PROPERTY_TYPES, property.property_type)}
              </span>
            </div>
            {property.location && (
              <p className="text-gray-500 flex items-center mt-1">
                <MapPin className="h-4 w-4 mr-1" />
                {property.location}
              </p>
            )}
          </div>
        </div>
        <div className="flex space-x-3">
          <Link href={`/properties/${propertyId}/edit`} className="btn-secondary">
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
          <p className="stat-label">Total Units</p>
          <p className="stat-value">{stats.totalUnits}</p>
          <p className="text-sm text-gray-500">
            {stats.occupiedUnits} occupied, {stats.vacantUnits} vacant
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Active Leases</p>
          <p className="stat-value">{stats.activeLeases}</p>
          <p className="text-sm text-gray-500">
            of {stats.totalLeases} total
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Monthly Revenue</p>
          <p className="stat-value">{formatCurrency(stats.totalRevenue)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Outstanding</p>
          <p className="stat-value text-danger-600">{formatCurrency(stats.outstandingRevenue)}</p>
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
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className={`
                -ml-0.5 mr-2 h-5 w-5
                ${activeTab === tab.id ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}
              `} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {property.description && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{property.description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Quick Stats</h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Sections</span>
                    <span className="font-medium">{sections.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Total Units</span>
                    <span className="font-medium">{stats.totalUnits}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Occupancy Rate</span>
                    <span className="font-medium">
                      {stats.totalUnits > 0 ? Math.round((stats.occupiedUnits / stats.totalUnits) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Active Leases</span>
                    <span className="font-medium">{stats.activeLeases}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Activity</h3>
                <div className="space-y-3">
                  {payments.slice(0, 5).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-sm">{payment.tenant_name}</p>
                        <p className="text-xs text-gray-500">{formatDate(payment.payment_date)}</p>
                      </div>
                      <span className="text-success-600 font-medium">
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                  ))}
                  {payments.length === 0 && (
                    <p className="text-gray-400 text-sm">No recent payments</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Sections</h3>
              <Link href={`/sections/new?property=${propertyId}`} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Name</th>
                    <th className="table-header-cell">Type</th>
                    <th className="table-header-cell">Units</th>
                    <th className="table-header-cell">Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {sections.map((section) => (
                    <tr key={section.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{section.name}</td>
                      <td className="table-cell">{section.section_type}</td>
                      <td className="table-cell">{section.units_count}</td>
                      <td className="table-cell">
                        <Link href={`/sections/${section.id}/edit`} className="text-primary-600 hover:underline">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'units' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Units</h3>
              <Link href={`/units/new?property=${propertyId}`} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Add Unit
              </Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Unit</th>
                    <th className="table-header-cell">Section</th>
                    <th className="table-header-cell">Type</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Rent</th>
                    <th className="table-header-cell">Tenant</th>
                    <th className="table-header-cell">Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">
                        <Link href={`/units/${unit.id}`} className="text-primary-600 hover:underline">
                          {unit.unit_name}
                        </Link>
                      </td>
                      <td className="table-cell">{unit.section_name || '-'}</td>
                      <td className="table-cell">{unit.unit_type}</td>
                      <td className="table-cell">
                        <span className={`badge ${getColorByValue(UNIT_STATUSES, unit.status)}`}>
                          {unit.status}
                        </span>
                      </td>
                      <td className="table-cell">{formatCurrency(unit.monthly_rent)}</td>
                      <td className="table-cell">{unit.current_tenant_name || '-'}</td>
                      <td className="table-cell">
                        <Link href={`/units/${unit.id}/edit`} className="text-primary-600 hover:underline mr-3">
                          Edit
                        </Link>
                        {unit.status === 'vacant' && (
                          <Link href={`/leases/new?unit=${unit.id}`} className="text-success-600 hover:underline">
                            Lease
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'leases' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Leases</h3>
              <Link href={`/leases/new`} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Create Lease
              </Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Tenant</th>
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
                      <td className="table-cell font-medium">
                        <Link href={`/tenants/${lease.tenant_id}`} className="text-primary-600 hover:underline">
                          {lease.tenant_name}
                        </Link>
                      </td>
                      <td className="table-cell">
                        <Link href={`/units/${lease.unit_id}`} className="text-primary-600 hover:underline">
                          {lease.unit_name}
                        </Link>
                      </td>
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
                            <Link href={`/leases/new?tenant=${lease.tenant_id}&unit=${lease.unit_id}`} className="text-success-600 hover:text-success-800 font-medium">
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Recent Invoices</h3>
              <Link href="/invoices/generate" className="btn-success">
                <Plus className="h-4 w-4 mr-2" />
                Generate Invoices
              </Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Invoice #</th>
                    <th className="table-header-cell">Tenant</th>
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
                      <td className="table-cell">{invoice.tenant_name}</td>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Recent Payments</h3>
              <Link href="/payments/new" className="btn-success">
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Date</th>
                    <th className="table-header-cell">Tenant</th>
                    <th className="table-header-cell">Invoice</th>
                    <th className="table-header-cell">Amount</th>
                    <th className="table-header-cell">Method</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="table-cell">{formatDate(payment.payment_date)}</td>
                      <td className="table-cell">{payment.tenant_name}</td>
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
              <h3 className="text-lg font-medium text-gray-900">Delete Property</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{property.name}</strong>? This action cannot be undone.
              <br /><br />
              Note: You can only delete properties with no units, leases, invoices, or payments.
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
                {deleteLoading ? 'Deleting...' : 'Delete Property'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
