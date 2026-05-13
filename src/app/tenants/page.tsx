import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Users, Phone, Building2, User } from 'lucide-react'
import { getLabelByValue, TENANT_TYPES } from '@/utils/constants'
import { formatCurrency } from '@/utils/currency'

async function getTenants() {
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

  // Get balance for each tenant
  const tenantsWithBalance = await Promise.all(
    (tenants || []).map(async (tenant) => {
      const { data: invoices } = await supabase
        .from('rent_invoices')
        .select('balance')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
      
      const totalBalance = invoices?.reduce((sum: number, inv: { balance: number }) => sum + (inv.balance || 0), 0) || 0

      // Get active leases count
      const { count: activeLeases } = await supabase
        .from('leases')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')

      return {
        ...tenant,
        total_balance: totalBalance,
        active_leases_count: activeLeases || 0,
        display_name: tenant.tenant_type === 'individual' 
          ? tenant.full_name 
          : tenant.business_name,
      }
    })
  )

  return tenantsWithBalance
}

export default async function TenantsPage() {
  const tenants = await getTenants()

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

      {tenants.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tenants yet</h3>
          <p className="text-gray-500 mb-6">Get started by adding your first tenant</p>
          <Link href="/tenants/new" className="btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Add Tenant
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Name</th>
                  <th className="table-header-cell">Type</th>
                  <th className="table-header-cell">Contact</th>
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
                      <Link 
                        href={`/tenants/${tenant.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        View
                      </Link>
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

