import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Receipt, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react'
import { getLabelByValue, getColorByValue, INVOICE_STATUSES } from '@/utils/constants'
import { formatCurrency, formatDate, getMonthName } from '@/utils/currency'
import { createPaymentReminderMessage } from '@/utils/reminders'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function getInvoices() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  await supabase.rpc('refresh_overdue_invoices')

  const { data: invoices, error } = await supabase
    .from('rent_invoices')
    .select(`
      *,
      tenants(full_name, business_name),
      units(unit_name),
      properties(name)
    `)
    .eq('user_id', user.id)
    .order('billing_year', { ascending: false })
    .order('billing_month', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching invoices:', error)
    return []
  }

  return (invoices || []).map((invoice: any) => {
    const tenant = firstRelation(invoice.tenants)
    const unit = firstRelation(invoice.units)
    const property = firstRelation(invoice.properties)

    return {
      ...invoice,
      tenant_name: tenant?.full_name || tenant?.business_name,
      unit_name: unit?.unit_name,
      property_name: property?.name,
    }
  })
}

export default async function InvoicesPage() {
  const invoices = await getInvoices()

  const totalExpected = invoices.reduce((sum: number, inv: { subtotal: number }) => sum + (inv.subtotal || 0), 0)
  const totalPaid = invoices.reduce((sum: number, inv: { amount_paid: number }) => sum + (inv.amount_paid || 0), 0)
  const totalBalance = invoices.reduce((sum: number, inv: { balance: number }) => sum + (inv.balance || 0), 0)
  const overdueCount = invoices.filter((inv: { status: string }) => inv.status === 'overdue').length
  const paidCount = invoices.filter((inv: { status: string }) => inv.status === 'paid').length

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="text-gray-500">All rent invoices across billing periods</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/invoices/generate" className="btn-success">
            <Plus className="h-5 w-5 mr-2" />
            Generate Invoices
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-primary-100">
              <DollarSign className="h-5 w-5 text-primary-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Expected</p>
          <p className="stat-value">{formatCurrency(totalExpected)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-success-100">
              <CheckCircle className="h-5 w-5 text-success-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Collected</p>
          <p className="stat-value">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-warning-100">
              <Clock className="h-5 w-5 text-warning-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Outstanding</p>
          <p className="stat-value">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-danger-100">
              <AlertCircle className="h-5 w-5 text-danger-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Overdue</p>
          <p className="stat-value text-danger-600">{overdueCount}</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="card p-12 text-center">
          <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
          <p className="text-gray-500 mb-6">Generate invoices for your active leases</p>
          <Link href="/invoices/generate" className="btn-success">
            <Plus className="h-5 w-5 mr-2" />
            Generate Invoices
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Invoice #</th>
                  <th className="table-header-cell">Tenant</th>
                  <th className="table-header-cell">Property/Unit</th>
                  <th className="table-header-cell">Period</th>
                  <th className="table-header-cell">Amount</th>
                  <th className="table-header-cell">Paid</th>
                  <th className="table-header-cell">Balance</th>
                  <th className="table-header-cell">Due Date</th>
                  <th className="table-header-cell">Status</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {invoices.map((invoice: any) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{invoice.invoice_number}</td>
                    <td className="table-cell">{invoice.tenant_name}</td>
                    <td className="table-cell">
                      <p className="text-sm text-gray-900">{invoice.property_name}</p>
                      <p className="text-xs text-gray-500">{invoice.unit_name}</p>
                    </td>
                    <td className="table-cell">{getMonthName(invoice.billing_month)} {invoice.billing_year}</td>
                    <td className="table-cell">{formatCurrency(invoice.subtotal)}</td>
                    <td className="table-cell text-success-600">{formatCurrency(invoice.amount_paid)}</td>
                    <td className={`table-cell font-medium ${invoice.balance > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                      {formatCurrency(invoice.balance)}
                    </td>
                    <td className="table-cell">{formatDate(invoice.due_date)}</td>
                    <td className="table-cell">
                      <span className={`badge ${getColorByValue(INVOICE_STATUSES, invoice.status)}`}>
                        {getLabelByValue(INVOICE_STATUSES, invoice.status)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                      <Link 
                        href={`/invoices/${invoice.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        View
                      </Link>
                      {invoice.balance > 0 && (
                        <>
                          <a
                            href={`sms:?&body=${encodeURIComponent(createPaymentReminderMessage({
                              tenantName: invoice.tenant_name || 'Tenant',
                              invoiceNumber: invoice.invoice_number || 'invoice',
                              balance: invoice.balance,
                              dueDate: invoice.due_date,
                            }))}`}
                            className="text-warning-600 hover:text-warning-800 font-medium"
                          >
                            Remind
                          </a>
                          <Link href={`/payments/new?invoice=${invoice.id}`} className="text-success-600 hover:text-success-800 font-medium">
                            Pay
                          </Link>
                        </>
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
    </div>
  )
}
