import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FileText, User, AlertCircle } from 'lucide-react'
import { getLabelByValue, getColorByValue, LEASE_TYPES, LEASE_STATUSES } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'

async function getLeases() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  await supabase.rpc('expire_stale_leases')

  const { data: leases, error } = await supabase
    .from('leases')
    .select(`
      *,
      tenants(full_name, business_name),
      units(unit_name),
      properties(name)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching leases:', error)
    return []
  }

  const leaseIds = (leases || []).map((lease) => lease.id)
  const { data: invoiceBalances } = leaseIds.length > 0
    ? await supabase
      .from('rent_invoices')
      .select('lease_id, balance, status')
      .eq('user_id', user.id)
      .in('lease_id', leaseIds)
      .neq('status', 'cancelled')
    : { data: [] }

  const balanceByLease = (invoiceBalances || []).reduce<Record<string, number>>((acc, invoice: any) => {
    acc[invoice.lease_id] = (acc[invoice.lease_id] || 0) + (invoice.balance || 0)
    return acc
  }, {})

  const today = new Date()
  const warningDate = new Date()
  warningDate.setDate(today.getDate() + 90)

  return (leases || []).map((lease: any) => {
    const endDate = new Date(lease.end_date)
    const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    return {
      ...lease,
      tenant_name: lease.tenants?.full_name || lease.tenants?.business_name,
      unit_name: lease.units?.unit_name,
      property_name: lease.properties?.name,
      current_balance: balanceByLease[lease.id] || 0,
      days_until_expiry: daysUntilExpiry,
      is_expiring_soon: daysUntilExpiry > 0 && daysUntilExpiry <= 90 && lease.status === 'active',
    }
  })
}

export default async function LeasesPage() {
  const leases = await getLeases()

  const activeCount = leases.filter((l: { status: string }) => l.status === 'active').length
  const expiringSoonCount = leases.filter((l: { is_expiring_soon: boolean }) => l.is_expiring_soon).length
  const totalLeaseBalance = leases.reduce((sum: number, lease: { current_balance: number }) => sum + lease.current_balance, 0)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leases</h1>
          <p className="text-gray-500">Manage rental agreements and track lease terms</p>
        </div>
        <Link href="/leases/new" className="btn-primary">
          <Plus className="h-5 w-5 mr-2" />
          Create Lease
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="stat-label">Total Leases</p>
          <p className="stat-value">{leases.length}</p>
        </div>
        <div className="stat-card border-l-4 border-success-500">
          <p className="stat-label">Active</p>
          <p className="stat-value text-success-600">{activeCount}</p>
        </div>
        <div className="stat-card border-l-4 border-warning-500">
          <p className="stat-label">Expiring Soon</p>
          <p className="stat-value text-warning-600">{expiringSoonCount}</p>
        </div>
        <div className="stat-card border-l-4 border-primary-500">
          <p className="stat-label">Current Balance</p>
          <p className={`stat-value ${totalLeaseBalance > 0 ? 'text-danger-600' : totalLeaseBalance < 0 ? 'text-success-600' : 'text-gray-900'}`}>
            {formatCurrency(Math.abs(totalLeaseBalance))}
          </p>
        </div>
      </div>

      {leases.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No leases yet</h3>
          <p className="text-gray-500 mb-6">Create your first lease agreement</p>
          <Link href="/leases/new" className="btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Create Lease
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-slate-100 md:hidden">
            {leases.map((lease: any) => (
              <article key={lease.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{lease.tenant_name}</p><p className="mt-0.5 text-sm text-slate-500">{lease.property_name} · {lease.unit_name}</p></div><span className={`badge ${getColorByValue(LEASE_STATUSES, lease.status)}`}>{getLabelByValue(LEASE_STATUSES, lease.status)}</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lease period</p><p className="mt-1 font-medium text-slate-900">{formatDate(lease.start_date)} to {formatDate(lease.end_date)}</p>{lease.is_expiring_soon && <p className="mt-1 text-xs font-semibold text-amber-700">{lease.days_until_expiry} days remaining</p>}</div><div className="text-right"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lease.current_balance > 0 ? 'Amount due' : lease.current_balance < 0 ? 'Credit available' : 'Settled'}</p><p className={`mt-1 text-lg font-bold ${lease.current_balance > 0 ? 'text-danger-600' : lease.current_balance < 0 ? 'text-success-600' : 'text-slate-700'}`}>{formatCurrency(Math.abs(lease.current_balance))}</p><p className="mt-1 text-xs text-slate-500">{formatCurrency(lease.monthly_rent)} monthly</p></div></div><div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-sm font-semibold"><Link href={`/leases/${lease.id}`} className="text-primary-700">View</Link><Link href={`/leases/${lease.id}/edit`} className="text-slate-700">Edit</Link></div></article>
            ))}
          </div>
          <div className="hidden md:block table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Tenant</th>
                  <th className="table-header-cell">Property/Unit</th>
                  <th className="table-header-cell">Type</th>
                  <th className="table-header-cell">Start Date</th>
                  <th className="table-header-cell">End Date</th>
                  <th className="table-header-cell">Monthly Rent</th>
                  <th className="table-header-cell">Current Balance</th>
                  <th className="table-header-cell">Status</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {leases.map((lease: any) => (
                  <tr key={lease.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-600" />
                        </div>
                        <span className="ml-2 font-medium">{lease.tenant_name}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm text-gray-900">{lease.property_name}</p>
                      <p className="text-xs text-gray-500">{lease.unit_name}</p>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-gray-100 text-gray-800">
                        {getLabelByValue(LEASE_TYPES, lease.lease_type)}
                      </span>
                    </td>
                    <td className="table-cell">{formatDate(lease.start_date)}</td>
                    <td className="table-cell">
                      <div className="flex items-center">
                        {formatDate(lease.end_date)}
                        {lease.is_expiring_soon && (
                          <span className="ml-2" title="Expiring soon">
                            <AlertCircle className="h-4 w-4 text-warning-500" />
                          </span>
                        )}
                      </div>
                      {lease.days_until_expiry <= 90 && lease.days_until_expiry > 0 && (
                        <p className="text-xs text-warning-600">
                          {lease.days_until_expiry} days remaining
                        </p>
                      )}
                    </td>
                    <td className="table-cell font-medium">
                      {formatCurrency(lease.monthly_rent)}
                    </td>
                    <td className="table-cell">
                      <div className={`font-semibold ${lease.current_balance > 0 ? 'text-danger-600' : lease.current_balance < 0 ? 'text-success-600' : 'text-gray-700'}`}>
                        {formatCurrency(Math.abs(lease.current_balance))}
                      </div>
                      <p className="text-xs text-gray-500">
                        {lease.current_balance > 0 ? 'Owed' : lease.current_balance < 0 ? 'Credit' : 'Settled'}
                      </p>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getColorByValue(LEASE_STATUSES, lease.status)}`}>
                        {getLabelByValue(LEASE_STATUSES, lease.status)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <Link 
                          href={`/leases/${lease.id}`}
                          className="text-primary-600 hover:text-primary-900 font-medium"
                        >
                          View
                        </Link>
                        <Link 
                          href={`/leases/${lease.id}/edit`}
                          className="text-slate-600 hover:text-slate-900 font-medium"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
