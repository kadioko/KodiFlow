import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, CreditCard, Calendar, User, Building } from 'lucide-react'
import { getLabelByValue, PAYMENT_METHODS } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function getPayments() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  await supabase.rpc('refresh_overdue_invoices')

  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      *,
      tenants(full_name, business_name),
      units(unit_name),
      properties(name),
      rent_invoices(invoice_number)
    `)
    .eq('user_id', user.id)
    .order('payment_date', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching payments:', error)
    return []
  }

  return (payments || []).map((payment: any) => {
    const tenant = firstRelation(payment.tenants)
    const unit = firstRelation(payment.units)
    const property = firstRelation(payment.properties)
    const invoice = firstRelation(payment.rent_invoices)

    return {
      ...payment,
      tenant_name: tenant?.full_name || tenant?.business_name,
      unit_name: unit?.unit_name,
      property_name: property?.name,
      invoice_number: invoice?.invoice_number,
    }
  })
}

export default async function PaymentsPage() {
  const payments = await getPayments()

  const totalPayments = payments.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="text-gray-500">Record and track rent payments</p>
        </div>
        <Link href="/payments/new" className="btn-success">
          <Plus className="h-5 w-5 mr-2" />
          Record Payment
        </Link>
      </div>

      {/* Summary Card */}
      <div className="stat-card max-w-sm">
        <div className="flex items-center">
          <div className="p-3 rounded-lg bg-success-100">
            <CreditCard className="h-6 w-6 text-success-600" />
          </div>
        </div>
        <p className="stat-label mt-4">Total Payments (Last 50)</p>
        <p className="stat-value text-success-600">{formatCurrency(totalPayments)}</p>
      </div>

      {payments.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No payments recorded</h3>
          <p className="text-gray-500 mb-6">Record your first rent payment</p>
          <Link href="/payments/new" className="btn-success">
            <Plus className="h-5 w-5 mr-2" />
            Record Payment
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-slate-100 md:hidden">
            {payments.map((payment: any) => (
              <article key={payment.id} className="p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-950">{payment.tenant_name || 'Tenant'}</p><p className="mt-0.5 truncate text-sm text-slate-500">{payment.invoice_number || 'Unlinked payment'} · {payment.unit_name || 'Unit'}</p></div><p className="shrink-0 text-lg font-bold text-success-700">{formatCurrency(payment.amount)}</p></div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-500"><span>{formatDate(payment.payment_date)}</span><span className="badge bg-slate-100 text-slate-700">{getLabelByValue(PAYMENT_METHODS, payment.payment_method)}</span></div>
                <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-sm font-semibold"><Link href={`/payments/${payment.id}`} className="text-primary-700">View</Link><Link href={`/payments/${payment.id}/edit`} className="text-slate-700">Edit</Link></div>
              </article>
            ))}
          </div>
          <div className="hidden md:block table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Invoice</th>
                  <th className="table-header-cell">Tenant</th>
                  <th className="table-header-cell">Property/Unit</th>
                  <th className="table-header-cell">Amount</th>
                  <th className="table-header-cell">Payment Date</th>
                  <th className="table-header-cell">Method</th>
                  <th className="table-header-cell">Reference</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {payments.map((payment: any) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{payment.invoice_number || 'N/A'}</td>
                    <td className="table-cell">{payment.tenant_name}</td>
                    <td className="table-cell">
                      <p className="text-sm text-gray-900">{payment.property_name}</p>
                      <p className="text-xs text-gray-500">{payment.unit_name}</p>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold text-success-600">
                        {formatCurrency(payment.amount)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(payment.payment_date)}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-gray-100 text-gray-800">
                        {getLabelByValue(PAYMENT_METHODS, payment.payment_method)}
                      </span>
                    </td>
                    <td className="table-cell text-sm text-gray-500">
                      {payment.reference || '-'}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                      <Link 
                        href={`/payments/${payment.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        View
                      </Link>
                      <Link 
                        href={`/payments/${payment.id}/edit`}
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
