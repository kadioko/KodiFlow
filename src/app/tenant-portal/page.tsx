import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, Home, Receipt } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/currency'

function relationName(value: any, key: string) {
  const item = Array.isArray(value) ? value[0] : value
  return item?.[key] || ''
}

export default async function TenantPortalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return <div>Loading...</div>
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, full_name, business_name, email, phone')
    .eq('email', user.email)
    .maybeSingle()

  if (!tenant) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Tenant Portal</h1>
            <p className="text-gray-500">No tenant profile is linked to {user.email}</p>
          </div>
        </div>
        <div className="card p-8 text-gray-600">
          Ask your property manager to add this email address to your tenant profile.
        </div>
      </div>
    )
  }

  const [{ data: leases }, { data: invoices }] = await Promise.all([
    supabase
      .from('leases')
      .select('id, start_date, end_date, monthly_rent, status, units(unit_name), properties(name)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('rent_invoices')
      .select('id, invoice_number, subtotal, amount_paid, balance, due_date, status, properties(name), units(unit_name)')
      .eq('tenant_id', tenant.id)
      .order('due_date', { ascending: false }),
  ])

  const outstanding = (invoices || []).reduce((sum: number, invoice: any) => sum + (invoice.balance || 0), 0)
  const activeLease = (leases || []).find((lease: any) => lease.status === 'active')

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tenant Portal</h1>
          <p className="text-gray-500">Welcome, {tenant.full_name || tenant.business_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <Home className="h-6 w-6 text-primary-600" />
          <p className="stat-label mt-4">Current Unit</p>
          <p className="stat-value text-lg">{activeLease ? relationName(activeLease.units, 'unit_name') : 'None'}</p>
        </div>
        <div className="stat-card">
          <Receipt className="h-6 w-6 text-warning-600" />
          <p className="stat-label mt-4">Outstanding Balance</p>
          <p className="stat-value text-danger-600">{formatCurrency(outstanding)}</p>
        </div>
        <div className="stat-card">
          <FileText className="h-6 w-6 text-success-600" />
          <p className="stat-label mt-4">Active Leases</p>
          <p className="stat-value">{(leases || []).filter((lease: any) => lease.status === 'active').length}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">My Invoices</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Invoice</th>
                <th className="table-header-cell">Property/Unit</th>
                <th className="table-header-cell">Due Date</th>
                <th className="table-header-cell">Balance</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell">Action</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {(invoices || []).map((invoice: any) => (
                <tr key={invoice.id}>
                  <td className="table-cell font-medium">{invoice.invoice_number}</td>
                  <td className="table-cell">{relationName(invoice.properties, 'name')} / {relationName(invoice.units, 'unit_name')}</td>
                  <td className="table-cell">{formatDate(invoice.due_date)}</td>
                  <td className="table-cell font-medium">{formatCurrency(invoice.balance)}</td>
                  <td className="table-cell capitalize">{invoice.status.replace('_', ' ')}</td>
                  <td className="table-cell">
                    <Link href={`/invoices/${invoice.id}`} className="text-primary-600 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
