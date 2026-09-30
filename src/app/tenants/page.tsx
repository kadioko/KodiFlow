import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Users, Phone, Building2, User } from 'lucide-react'
import { getLabelByValue, TENANT_TYPES } from '@/utils/constants'
import { formatCurrency } from '@/utils/currency'
import OperationalListFilters from '@/components/ui/OperationalListFilters'

type TenantRow = {
  id: string
  created_at: string
  tenant_type: 'individual' | 'business' | 'organization'
  full_name: string | null
  business_name: string | null
  contact_person_name: string | null
  phone: string
  email: string | null
}

type TenantListItem = TenantRow & {
  total_balance: number
  active_leases_count: number
  display_name: string | null
  assigned_units: {
    lease_id: string
    unit_id: string
    unit_name: string
    property_name: string
  }[]
}

type InvoiceBalance = {
  tenant_id: string
  balance: number | null
}

type ActiveLeaseAssignment = {
  id: string
  tenant_id: string
  unit_id: string
  units: { unit_name: string } | { unit_name: string }[] | null
  properties: { name: string } | { name: string }[] | null
}

async function getTenants(): Promise<TenantListItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tenants:', error)
    return []
  }

  const tenantRows = (tenants || []) as TenantRow[]
  if (tenantRows.length === 0) return []

  const tenantIds = tenantRows.map((tenant) => tenant.id)
  const [invoiceResult, leaseResult] = await Promise.all([
    supabase
      .from('rent_invoices')
      .select('tenant_id, balance')
      .eq('user_id', user.id)
      .in('tenant_id', tenantIds)
      .not('status', 'in', '(cancelled,transferred)'),
    supabase
      .from('leases')
      .select('id, tenant_id, unit_id, units(unit_name), properties(name)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('tenant_id', tenantIds),
  ])

  if (invoiceResult.error) console.error('Error fetching tenant invoice balances:', invoiceResult.error)
  if (leaseResult.error) console.error('Error fetching tenant assignments:', leaseResult.error)

  const balanceByTenant = new Map<string, number>()
  for (const invoice of (invoiceResult.data || []) as InvoiceBalance[]) {
    balanceByTenant.set(invoice.tenant_id, (balanceByTenant.get(invoice.tenant_id) || 0) + Number(invoice.balance || 0))
  }

  const assignmentsByTenant = new Map<string, TenantListItem['assigned_units']>()
  for (const lease of (leaseResult.data || []) as ActiveLeaseAssignment[]) {
    const unit = Array.isArray(lease.units) ? lease.units[0] : lease.units
    const property = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties
    const assignments = assignmentsByTenant.get(lease.tenant_id) || []
    assignments.push({
      lease_id: lease.id,
      unit_id: lease.unit_id,
      unit_name: unit?.unit_name || 'Unknown unit',
      property_name: property?.name || 'Unknown property',
    })
    assignmentsByTenant.set(lease.tenant_id, assignments)
  }

  return tenantRows.map((tenant) => {
    const assignedUnits = assignmentsByTenant.get(tenant.id) || []
    return {
      ...tenant,
      total_balance: balanceByTenant.get(tenant.id) || 0,
      active_leases_count: assignedUnits.length,
      assigned_units: assignedUnits,
      display_name: tenant.tenant_type === 'individual' ? tenant.full_name : tenant.business_name,
    }
  })
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const allTenants = await getTenants()
  const query = (typeof params?.q === 'string' ? params.q : '').trim().toLowerCase()
  const assignment = typeof params?.assignment === 'string' ? params.assignment : 'all'
  const balance = typeof params?.balance === 'string' ? params.balance : 'all'
  const sort = typeof params?.sort === 'string' ? params.sort : 'name_asc'
  const tenants = allTenants
    .filter((tenant) => {
      const searchable = [tenant.display_name, tenant.phone, tenant.email, ...tenant.assigned_units.map((unit) => unit.unit_name)].filter(Boolean).join(' ').toLowerCase()
      return (!query || searchable.includes(query))
        && (assignment === 'all' || (assignment === 'assigned' ? tenant.active_leases_count > 0 : tenant.active_leases_count === 0))
        && (balance === 'all' || (balance === 'due' ? tenant.total_balance > 0 : balance === 'credit' ? tenant.total_balance < 0 : tenant.total_balance === 0))
    })
    .sort((a, b) => {
      if (sort === 'balance_desc') return b.total_balance - a.total_balance
      if (sort === 'balance_asc') return a.total_balance - b.total_balance
      if (sort === 'newest') return b.created_at.localeCompare(a.created_at)
      return (a.display_name || '').localeCompare(b.display_name || '')
    })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tenants</h1>
          <p className="text-gray-500">Manage your residential and commercial tenants</p>
        </div>
        <Link href="/tenants/new" className="btn-primary">
          <Plus className="h-5 w-5 mr-2" />
          Add Tenant
        </Link>
      </div>

      <OperationalListFilters
        searchPlaceholder="Search tenants, contacts, phones, or units"
        filters={[
          { key: 'assignment', label: 'Assignments', options: [{ value: 'assigned', label: 'Assigned' }, { value: 'unassigned', label: 'Unassigned' }] },
          { key: 'balance', label: 'Balances', options: [{ value: 'due', label: 'Amount due' }, { value: 'credit', label: 'Credit available' }, { value: 'settled', label: 'Settled' }] },
        ]}
        sortOptions={[{ value: 'name_asc', label: 'Name A-Z' }, { value: 'balance_desc', label: 'Highest balance' }, { value: 'balance_asc', label: 'Lowest balance' }, { value: 'newest', label: 'Newest tenant' }]}
        savedViews={[{ label: 'All tenants', params: {} }, { label: 'Unassigned tenants', params: { assignment: 'unassigned' } }, { label: 'Amount due', params: { balance: 'due', sort: 'balance_desc' } }, { label: 'Credit available', params: { balance: 'credit' } }]}
      />

      {tenants.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{allTenants.length ? 'No matching tenants' : 'No tenants yet'}</h3>
          <p className="text-gray-500 mb-6">{allTenants.length ? 'Clear or change the filters to see more tenants.' : 'Get started by adding your first tenant'}</p>
          <Link href="/tenants/new" className="btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Add Tenant
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-slate-100 md:hidden">
            {tenants.map((tenant) => (
              <article key={tenant.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-950">{tenant.display_name}</p><p className="mt-0.5 text-sm text-slate-500">{tenant.phone}</p></div><p className={`text-right text-lg font-bold ${tenant.total_balance > 0 ? 'text-danger-600' : tenant.total_balance < 0 ? 'text-success-600' : 'text-slate-700'}`}>{formatCurrency(Math.abs(tenant.total_balance))}<span className="mt-0.5 block text-xs font-semibold uppercase tracking-wide">{tenant.total_balance > 0 ? 'Amount due' : tenant.total_balance < 0 ? 'Credit' : 'Settled'}</span></p></div><div className="mt-3 text-sm">{tenant.assigned_units.length > 0 ? tenant.assigned_units.map((unit) => <Link key={unit.lease_id} href={`/units/${unit.unit_id}`} className="mr-2 text-primary-700">{unit.unit_name}</Link>) : <span className="text-amber-700">No active unit</span>}</div><div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-sm font-semibold"><Link href={`/tenants/${tenant.id}`} className="text-primary-700">View</Link><Link href={`/tenants/${tenant.id}/edit`} className="text-slate-700">Edit</Link></div></article>
            ))}
          </div>
          <div className="hidden md:block table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Name</th>
                  <th className="table-header-cell">Type</th>
                  <th className="table-header-cell">Contact</th>
                  <th className="table-header-cell">Assigned Unit</th>
                  <th className="table-header-cell">Active Leases</th>
                  <th className="table-header-cell">Balance</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          {tenant.tenant_type === 'individual' ? (
                            <User className="h-5 w-5 text-primary-600" />
                          ) : (
                            <Building2 className="h-5 w-5 text-primary-600" />
                          )}
                        </div>
                        <div className="ml-4">
                          <p className="font-medium text-gray-900">{tenant.display_name}</p>
                          {tenant.tenant_type === 'business' && tenant.contact_person_name && (
                            <p className="text-sm text-gray-500">Contact: {tenant.contact_person_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-gray-100 text-gray-800">
                        {getLabelByValue(TENANT_TYPES, tenant.tenant_type)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center text-sm text-gray-500">
                        <Phone className="h-4 w-4 mr-1" />
                        {tenant.phone}
                      </div>
                      {tenant.email && (
                        <p className="text-sm text-gray-500 mt-1">{tenant.email}</p>
                      )}
                    </td>
                    <td className="table-cell">
                      {tenant.assigned_units.length > 0 ? (
                        <div className="space-y-1">
                          {tenant.assigned_units.map((assignedUnit) => (
                            <div key={assignedUnit.lease_id}>
                              <Link href={`/units/${assignedUnit.unit_id}`} className="text-sm font-medium text-primary-600 hover:underline">
                                {assignedUnit.unit_name}
                              </Link>
                              <p className="text-xs text-gray-500">{assignedUnit.property_name}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No active unit</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${tenant.active_leases_count > 0 ? 'bg-success-100 text-success-800' : 'bg-gray-100 text-gray-800'}`}>
                        {tenant.active_leases_count} active
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`font-medium ${tenant.total_balance > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                        {formatCurrency(tenant.total_balance)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                      <Link 
                        href={`/tenants/${tenant.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        View
                      </Link>
                      <Link 
                        href={`/tenants/${tenant.id}/edit`}
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
