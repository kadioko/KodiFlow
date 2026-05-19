import { createClient } from '@/lib/supabase/server'
import { Calendar, FileText, Home, Receipt } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/currency'
import { relationField } from '@/utils/supabase-relations'
import TenantInvoiceActions from './TenantInvoiceActions'

type PortalLease = {
  id: string
  start_date: string
  end_date: string
  monthly_rent: number
  status: string
  units: { unit_name: string } | { unit_name: string }[] | null
  properties: { name: string } | { name: string }[] | null
}

type PortalInvoice = {
  id: string
  invoice_number: string
  subtotal: number
  amount_paid: number
  balance: number
  due_date: string
  status: string
  billing_month: number
  billing_year: number
  billing_period_start: string
  billing_period_end: string
  created_at: string
  user_id: string
  properties: { name: string } | { name: string }[] | null
  units: { unit_name: string } | { unit_name: string }[] | null
}

type InvoiceProfile = {
  id: string
  invoice_payment_instructions: string | null
  invoice_footer_note: string | null
}

export default async function TenantPortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return <div>Loading...</div>
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, full_name, business_name, email, phone, tenant_type')
    .ilike('email', user.email)
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
      .select('id, user_id, invoice_number, subtotal, amount_paid, balance, due_date, status, billing_month, billing_year, billing_period_start, billing_period_end, created_at, properties(name), units(unit_name)')
      .eq('tenant_id', tenant.id)
      .order('due_date', { ascending: false }),
  ])

  const portalLeases = (leases || []) as PortalLease[]
  const portalInvoices = ((invoices || []) as PortalInvoice[]).map((invoice) => ({
    ...invoice,
    status: invoice.status !== 'cancelled' && invoice.status !== 'paid' && invoice.balance > 0 && invoice.due_date < new Date().toISOString().split('T')[0]
      ? 'overdue'
      : invoice.status,
  }))
  const ownerIds = Array.from(new Set(portalInvoices.map((invoice) => invoice.user_id)))
  const { data: profileRows } = ownerIds.length > 0
    ? await supabase
      .from('profiles')
      .select('id, invoice_payment_instructions, invoice_footer_note')
      .in('id', ownerIds)
    : { data: [] }
  const settingsByOwner = new Map(
    ((profileRows || []) as InvoiceProfile[]).map((profile) => [
      profile.id,
      {
        paymentInstructions: profile.invoice_payment_instructions,
        footerNote: profile.invoice_footer_note,
      },
    ])
  )
  const outstanding = portalInvoices.reduce((sum, invoice) => sum + (invoice.balance || 0), 0)
  const activeLease = portalLeases.find((lease) => lease.status === 'active')

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
          <p className="stat-value text-lg">{activeLease ? relationField(activeLease.units, 'unit_name') || 'None' : 'None'}</p>
        </div>
        <div className="stat-card">
          <Receipt className="h-6 w-6 text-warning-600" />
          <p className="stat-label mt-4">Outstanding Balance</p>
          <p className="stat-value text-danger-600">{formatCurrency(outstanding)}</p>
        </div>
        <div className="stat-card">
          <FileText className="h-6 w-6 text-success-600" />
          <p className="stat-label mt-4">Active Leases</p>
          <p className="stat-value">{portalLeases.filter((lease) => lease.status === 'active').length}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">My Invoices</h2>
          <p className="text-sm text-gray-500">Only invoices linked to your tenant profile are shown here.</p>
        </div>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Invoice</th>
                <th className="table-header-cell">Property/Unit</th>
                <th className="table-header-cell">Billing</th>
                <th className="table-header-cell">Due Date</th>
                <th className="table-header-cell">Paid</th>
                <th className="table-header-cell">Balance</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell">Download</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {portalInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="table-cell font-medium">{invoice.invoice_number}</td>
                  <td className="table-cell">{relationField(invoice.properties, 'name')} / {relationField(invoice.units, 'unit_name')}</td>
                  <td className="table-cell">{invoice.billing_month}/{invoice.billing_year}</td>
                  <td className="table-cell">{formatDate(invoice.due_date)}</td>
                  <td className="table-cell text-success-600">{formatCurrency(invoice.amount_paid)}</td>
                  <td className="table-cell font-medium">{formatCurrency(invoice.balance)}</td>
                  <td className="table-cell capitalize">{invoice.status.replace('_', ' ')}</td>
                  <td className="table-cell">
                    <TenantInvoiceActions
                      invoiceId={invoice.id}
                      invoice={{
                        invoice_number: invoice.invoice_number,
                        status: invoice.status,
                        created_at: invoice.created_at,
                        due_date: invoice.due_date,
                        billing_period_start: invoice.billing_period_start,
                        billing_period_end: invoice.billing_period_end,
                        subtotal: invoice.subtotal,
                        amount_paid: invoice.amount_paid,
                        balance: invoice.balance,
                        tenant_name: tenant.full_name || tenant.business_name || 'Tenant',
                        property_name: relationField(invoice.properties, 'name') || 'Property',
                        unit_name: relationField(invoice.units, 'unit_name') || 'Unit',
                      }}
                      settings={settingsByOwner.get(invoice.user_id) || {}}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">My Leases</h2>
          <p className="text-sm text-gray-500">Lease information relevant to your occupied units.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {portalLeases.map((lease) => (
            <div key={lease.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-gray-900">{relationField(lease.properties, 'name')} / {relationField(lease.units, 'unit_name')}</p>
                <p className="text-sm text-gray-500 flex items-center mt-1">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(lease.start_date)} - {formatDate(lease.end_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(lease.monthly_rent)}</p>
                <p className="text-sm capitalize text-gray-500">{lease.status}</p>
              </div>
            </div>
          ))}
          {portalLeases.length === 0 && <div className="p-6 text-gray-500">No leases are linked to your tenant profile.</div>}
        </div>
      </div>
    </div>
  )
}
