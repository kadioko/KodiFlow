import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Receipt, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react'
import { getLabelByValue, getColorByValue, INVOICE_STATUSES } from '@/utils/constants'
import { formatCurrency, formatDate, getMonthName } from '@/utils/currency'
import { createPaymentReminderMessage } from '@/utils/reminders'

type InvoiceStatusFilter = 'all' | 'unpaid' | 'overdue' | 'partially_paid' | 'paid' | 'transferred'
type InvoiceSort = 'status' | 'balance_desc' | 'amount_desc' | 'paid_desc' | 'due_asc' | 'newest'

type InvoiceListItem = {
  id: string
  invoice_number: string
  tenant_name: string
  unit_name: string
  property_name: string
  billing_period_start: string
  billing_period_end: string
  billing_month: number
  billing_year: number
  subtotal: number
  amount_paid: number
  balance: number
  due_date: string
  status: string
}

type InvoiceRow = Omit<InvoiceListItem, 'tenant_name' | 'unit_name' | 'property_name'> & {
  tenants: { full_name: string | null; business_name: string | null } | { full_name: string | null; business_name: string | null }[] | null
  units: { unit_name: string | null } | { unit_name: string | null }[] | null
  properties: { name: string | null } | { name: string | null }[] | null
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function getPeriodDurationLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const endExclusive = new Date(`${endDate}T00:00:00Z`)
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)

  let months = 0
  let cursor = new Date(start)

  while (months < 120 && addMonths(cursor, 1) <= endExclusive) {
    months += 1
    cursor = addMonths(start, months)
  }

  if (months >= 12 && months % 12 === 0) {
    const years = months / 12
    return years === 1 ? 'Annual' : `${years} years`
  }

  if (months === 6) return '6 months'
  if (months === 3) return '3 months'
  if (months === 1) return '1 month'
  if (months > 1) return `${months} months`

  const days = Math.max(1, Math.round((endExclusive.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  return `${days} day${days === 1 ? '' : 's'}`
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getQueryValue(value: string | string[] | undefined, fallback: string) {
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

function getStatusFilter(value: string | string[] | undefined): InvoiceStatusFilter {
  const status = getQueryValue(value, 'all')
  return ['all', 'unpaid', 'overdue', 'partially_paid', 'paid', 'transferred'].includes(status) ? status as InvoiceStatusFilter : 'all'
}

function getSort(value: string | string[] | undefined): InvoiceSort {
  const sort = getQueryValue(value, 'status')
  return ['status', 'balance_desc', 'amount_desc', 'paid_desc', 'due_asc', 'newest'].includes(sort) ? sort as InvoiceSort : 'status'
}

function createInvoiceHref(status: InvoiceStatusFilter, sort: InvoiceSort) {
  const params = new URLSearchParams()
  if (status !== 'all') params.set('status', status)
  if (sort !== 'status') params.set('sort', sort)
  const query = params.toString()
  return query ? `/invoices?${query}` : '/invoices'
}

function statusRank(status: string) {
  switch (status) {
    case 'overdue': return 0
    case 'unpaid': return 1
    case 'partially_paid': return 2
    case 'paid': return 3
    case 'transferred': return 4
    default: return 5
  }
}

function sortInvoices(invoices: InvoiceListItem[], sort: InvoiceSort) {
  return [...invoices].sort((a, b) => {
    switch (sort) {
      case 'balance_desc':
        return (b.balance || 0) - (a.balance || 0)
      case 'amount_desc':
        return (b.subtotal || 0) - (a.subtotal || 0)
      case 'paid_desc':
        return (b.amount_paid || 0) - (a.amount_paid || 0)
      case 'due_asc':
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      case 'newest':
        return (b.billing_year - a.billing_year) || (b.billing_month - a.billing_month)
      case 'status':
      default:
        return statusRank(a.status) - statusRank(b.status)
          || (b.balance || 0) - (a.balance || 0)
          || (b.billing_year - a.billing_year)
          || (b.billing_month - a.billing_month)
    }
  })
}

async function getInvoices(): Promise<InvoiceListItem[]> {
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

  return ((invoices || []) as InvoiceRow[]).map((invoice) => {
    const tenant = firstRelation(invoice.tenants)
    const unit = firstRelation(invoice.units)
    const property = firstRelation(invoice.properties)

    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      tenant_name: tenant?.full_name || tenant?.business_name || 'Unknown tenant',
      unit_name: unit?.unit_name || 'Unknown unit',
      property_name: property?.name || 'Unknown property',
      billing_period_start: invoice.billing_period_start,
      billing_period_end: invoice.billing_period_end,
      billing_month: invoice.billing_month,
      billing_year: invoice.billing_year,
      subtotal: invoice.subtotal || 0,
      amount_paid: invoice.amount_paid || 0,
      balance: invoice.balance || 0,
      due_date: invoice.due_date,
      status: invoice.status,
    }
  })
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const statusFilter = getStatusFilter(params?.status)
  const sort = getSort(params?.sort)
  const allInvoices = await getInvoices()
  const filteredInvoices = statusFilter === 'all'
    ? allInvoices
    : allInvoices.filter((invoice) => invoice.status === statusFilter)
  const invoices = sortInvoices(filteredInvoices, sort)

  const financialInvoices = allInvoices.filter((inv) => !['cancelled', 'transferred'].includes(inv.status))
  const totalExpected = financialInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0)
  const totalPaid = financialInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0)
  const totalBalance = financialInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0)
  const overdueCount = allInvoices.filter((inv) => inv.status === 'overdue').length
  const paidCount = allInvoices.filter((inv) => inv.status === 'paid').length
  const unpaidCount = allInvoices.filter((inv) => inv.status === 'unpaid').length
  const partialCount = allInvoices.filter((inv) => inv.status === 'partially_paid').length
  const transferredCount = allInvoices.filter((inv) => inv.status === 'transferred').length
  const statusOptions: { value: InvoiceStatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: allInvoices.length },
    { value: 'unpaid', label: 'Unpaid', count: unpaidCount },
    { value: 'overdue', label: 'Overdue', count: overdueCount },
    { value: 'partially_paid', label: 'Partial', count: partialCount },
    { value: 'paid', label: 'Paid', count: paidCount },
    { value: 'transferred', label: 'Transferred', count: transferredCount },
  ]
  const sortOptions: { value: InvoiceSort; label: string }[] = [
    { value: 'status', label: 'Unpaid first' },
    { value: 'balance_desc', label: 'Highest balance' },
    { value: 'amount_desc', label: 'Highest amount' },
    { value: 'paid_desc', label: 'Highest paid' },
    { value: 'due_asc', label: 'Due soonest' },
    { value: 'newest', label: 'Newest period' },
  ]

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

      <div className="card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Invoice View</h2>
            <p className="text-sm text-gray-500">
              Showing {invoices.length} of {allInvoices.length} invoice{allInvoices.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <Link
                  key={option.value}
                  href={createInvoiceHref(option.value, sort)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    statusFilter === option.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {option.label} ({option.count})
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="invoice_sort_links" className="text-sm font-medium text-gray-500">Sort</label>
              <div id="invoice_sort_links" className="flex flex-wrap gap-2">
                {sortOptions.map((option) => (
                  <Link
                    key={option.value}
                    href={createInvoiceHref(statusFilter, option.value)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      sort === option.value
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
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
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{invoice.invoice_number}</td>
                    <td className="table-cell">{invoice.tenant_name}</td>
                    <td className="table-cell">
                      <p className="text-sm text-gray-900">{invoice.property_name}</p>
                      <p className="text-xs text-gray-500">{invoice.unit_name}</p>
                    </td>
                    <td className="table-cell">
                      <p className="font-medium text-gray-900">{getPeriodDurationLabel(invoice.billing_period_start, invoice.billing_period_end)}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(invoice.billing_period_start)} to {formatDate(invoice.billing_period_end)}
                      </p>
                      <p className="text-xs text-gray-400">{getMonthName(invoice.billing_month)} {invoice.billing_year}</p>
                    </td>
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
