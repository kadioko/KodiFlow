import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, CreditCard, FileText } from 'lucide-react'
import { getLabelByValue, PAYMENT_METHODS } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function PaymentDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="card p-6 text-gray-600">Please log in to view this payment.</div>
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .select(`
      *,
      tenants(full_name, business_name, phone, email),
      properties(name),
      units(unit_name),
      rent_invoices(id, invoice_number, due_date, status, balance)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !payment) {
    return (
      <div className="space-y-6">
        <Link href="/payments" className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to payments
        </Link>
        <div className="card p-8 text-gray-600">Payment not found or you do not have access to it.</div>
      </div>
    )
  }

  const tenant = firstRelation(payment.tenants)
  const property = firstRelation(payment.properties)
  const unit = firstRelation(payment.units)
  const invoice = firstRelation(payment.rent_invoices)
  const tenantName = tenant?.full_name || tenant?.business_name || 'Unknown tenant'

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/payments" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Payment Details</h1>
            <p className="text-gray-500">{tenantName} • {formatDate(payment.payment_date)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <CreditCard className="h-6 w-6 text-success-600" />
          <p className="stat-label mt-4">Amount Paid</p>
          <p className="stat-value text-success-600">{formatCurrency(payment.amount)}</p>
        </div>
        <div className="stat-card">
          <FileText className="h-6 w-6 text-primary-600" />
          <p className="stat-label mt-4">Invoice</p>
          <p className="stat-value text-lg">{invoice?.invoice_number || 'N/A'}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Method</p>
          <p className="stat-value text-lg">{getLabelByValue(PAYMENT_METHODS, payment.payment_method)}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Payment Information</h2>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-gray-500">Tenant</p>
            <p className="font-semibold text-gray-900">{tenantName}</p>
            <p className="text-gray-500">{tenant?.phone || tenant?.email || ''}</p>
          </div>
          <div>
            <p className="text-gray-500">Property / Unit</p>
            <p className="font-semibold text-gray-900">{property?.name || '-'}</p>
            <p className="text-gray-500">{unit?.unit_name || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500">Reference</p>
            <p className="font-semibold text-gray-900">{payment.reference || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500">Notes</p>
            <p className="font-semibold text-gray-900">{payment.notes || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
