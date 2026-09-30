import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, CreditCard, Calendar } from 'lucide-react'
import { getLabelByValue, PAYMENT_METHODS } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'
import OperationalListFilters from '@/components/ui/OperationalListFilters'
import type { Database } from '@/lib/supabase/database.types'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

type Payment = Database['public']['Tables']['payments']['Row']
type PaymentListItem = Payment & {
  tenants: { full_name: string | null; business_name: string | null } | { full_name: string | null; business_name: string | null }[] | null
  units: { unit_name: string } | { unit_name: string }[] | null
  properties: { name: string } | { name: string }[] | null
  rent_invoices: { invoice_number: string | null } | { invoice_number: string | null }[] | null
  tenant_name?: string | null
  unit_name?: string | null
  property_name?: string | null
  invoice_number?: string | null
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

  return ((payments || []) as PaymentListItem[]).map((payment) => {
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

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const payments = await getPayments()
  const query = (typeof params?.q === 'string' ? params.q : '').trim().toLowerCase()
  const method = typeof params?.method === 'string' ? params.method : 'all'
  const state = typeof params?.state === 'string' ? params.state : 'all'
  const sort = typeof params?.sort === 'string' ? params.sort : 'date_desc'
  const paymentItems = (payments as PaymentListItem[])
    .filter((payment) => {
      const searchable = [payment.tenant_name, payment.invoice_number, payment.unit_name, payment.property_name, payment.reference].filter(Boolean).join(' ').toLowerCase()
      return (!query || searchable.includes(query))
        && (method === 'all' || payment.payment_method === method)
        && (state === 'all' || (state === 'reversal' ? payment.is_reversal : !payment.is_reversal))
    })
    .sort((a, b) => {
      if (sort === 'amount_desc') return (b.amount || 0) - (a.amount || 0)
      if (sort === 'amount_asc') return (a.amount || 0) - (b.amount || 0)
      const direction = sort === 'date_asc' ? 1 : -1
      return direction * (new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
    })

  const totalPayments = paymentItems.reduce((sum, payment) => sum + (payment.amount || 0), 0)

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
        <p className="stat-label mt-4">Matching payments (last 50)</p>
        <p className="stat-value text-success-600">{formatCurrency(totalPayments)}</p>
      </div>

      <OperationalListFilters
        searchPlaceholder="Search tenant, invoice, unit, or reference"
        filters={[
          { key: 'method', label: 'Methods', options: PAYMENT_METHODS },
          { key: 'state', label: 'States', options: [{ value: 'normal', label: 'Recorded payments' }, { value: 'reversal', label: 'Reversals' }] },
        ]}
        sortOptions={[
          { value: 'date_desc', label: 'Newest payment' },
          { value: 'date_asc', label: 'Oldest payment' },
          { value: 'amount_desc', label: 'Highest amount' },
          { value: 'amount_asc', label: 'Lowest amount' },
        ]}
        savedViews={[
          { label: 'All payments', params: {} },
          { label: 'Reversals', params: { state: 'reversal' } },
          { label: 'Cash payments', params: { method: 'cash' } },
        ]}
      />

      {paymentItems.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{payments.length ? 'No matching payments' : 'No payments recorded'}</h3>
          <p className="text-gray-500 mb-6">{payments.length ? 'Clear or change the filters to see more payments.' : 'Record your first rent payment'}</p>
          <Link href="/payments/new" className="btn-success">
            <Plus className="h-5 w-5 mr-2" />
            Record Payment
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-slate-100 md:hidden">
            {paymentItems.map((payment) => (
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
                {paymentItems.map((payment) => (
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
