'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, 
  Receipt, 
  Printer,
  Share2,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Home,
  Building2,
  CreditCard
} from 'lucide-react'
import { formatCurrency, formatDate, getMonthName } from '@/utils/currency'

interface InvoiceItem {
  id: string
  item_name: string
  item_type: string
  amount: number
  notes: string | null
}

interface Invoice {
  id: string
  invoice_number: string
  billing_period_start: string
  billing_period_end: string
  billing_month: number
  billing_year: number
  subtotal: number
  amount_paid: number
  balance: number
  due_date: string
  status: string
  created_at: string
  tenant_id: string
  tenant_name: string
  unit_id: string
  unit_name: string
  property_id: string
  property_name: string
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  reference: string | null
}

type ItemFilter = 'all' | 'rent' | 'service_charge'

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = getRouteParam(params.id)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [sharingPdf, setSharingPdf] = useState(false)
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all')
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    if (!invoiceId) {
      setError('Invoice not found')
      setLoading(false)
      return
    }

    fetchInvoiceData()
  }, [invoiceId])

  const fetchInvoiceData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Fetch invoice
    const { data: invoiceData } = await supabase
      .from('rent_invoices')
      .select(`
        *,
        tenants(id, full_name, business_name),
        units(unit_name),
        properties(name)
      `)
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single()

    if (!invoiceData) {
      setError('Invoice not found')
      setLoading(false)
      return
    }

    setInvoice({
      ...invoiceData,
      tenant_name: invoiceData.tenants?.full_name || invoiceData.tenants?.business_name,
      unit_name: invoiceData.units?.unit_name,
      property_name: invoiceData.properties?.name,
    })

    // Fetch invoice items
    const { data: itemsData } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('user_id', user.id)
      .order('created_at')

    if (itemsData) {
      setItems(itemsData)
    }

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })

    if (paymentsData) {
      setPayments(paymentsData)
    }

    setLoading(false)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSharePdf = async () => {
    if (!invoice) return

    setSharingPdf(true)
    setError('')

    try {
      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 16
      const contentWidth = pageWidth - margin * 2
      let y = 18

      const ensureSpace = (needed: number) => {
        if (y + needed <= pageHeight - margin) return
        pdf.addPage()
        y = margin
      }

      const text = (value: string, x: number, options?: { size?: number; style?: 'normal' | 'bold'; color?: [number, number, number]; align?: 'left' | 'right' | 'center' }) => {
        pdf.setFont('helvetica', options?.style || 'normal')
        pdf.setFontSize(options?.size || 10)
        const color = options?.color || [17, 24, 39]
        pdf.setTextColor(color[0], color[1], color[2])
        pdf.text(value, x, y, { align: options?.align || 'left' })
      }

      pdf.setFillColor(15, 23, 42)
      pdf.rect(0, 0, pageWidth, 38, 'F')
      y = 18
      text('RENT INVOICE', margin, { size: 18, style: 'bold', color: [255, 255, 255] })
      y += 8
      text(invoice.invoice_number, margin, { size: 10, color: [203, 213, 225] })
      y = 18
      text(invoice.status.replace('_', ' ').toUpperCase(), pageWidth - margin, { size: 10, style: 'bold', color: [255, 255, 255], align: 'right' })
      y = 50

      text('Invoice Date', margin, { size: 9, color: [100, 116, 139] })
      text('Due Date', pageWidth / 2, { size: 9, color: [100, 116, 139] })
      y += 6
      text(formatDate(invoice.created_at), margin, { style: 'bold' })
      text(formatDate(invoice.due_date), pageWidth / 2, { style: 'bold', color: invoice.status === 'overdue' ? [220, 38, 38] : [17, 24, 39] })
      y += 16

      pdf.setDrawColor(226, 232, 240)
      pdf.line(margin, y, pageWidth - margin, y)
      y += 10

      text('BILL TO', margin, { size: 9, style: 'bold', color: [100, 116, 139] })
      text('PROPERTY', pageWidth / 2, { size: 9, style: 'bold', color: [100, 116, 139] })
      y += 6
      text(invoice.tenant_name || 'Unknown tenant', margin, { style: 'bold' })
      text(invoice.property_name || 'Unknown property', pageWidth / 2, { style: 'bold' })
      y += 6
      text(`Unit: ${invoice.unit_name || 'Unknown unit'}`, pageWidth / 2, { color: [71, 85, 105] })
      y += 14

      pdf.setFillColor(248, 250, 252)
      pdf.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F')
      y += 8
      text(`Period: ${formatDate(invoice.billing_period_start)} to ${formatDate(invoice.billing_period_end)}`, margin + 4, { style: 'bold' })
      text(`Balance Due: ${formatCurrency(invoice.balance)}`, pageWidth - margin - 4, { style: 'bold', color: invoice.balance > 0 ? [220, 38, 38] : [22, 163, 74], align: 'right' })
      y += 24

      text('Description', margin, { size: 9, style: 'bold', color: [100, 116, 139] })
      text('Amount', pageWidth - margin, { size: 9, style: 'bold', color: [100, 116, 139], align: 'right' })
      y += 4
      pdf.line(margin, y, pageWidth - margin, y)
      y += 8

      items.forEach((item) => {
        const lines = pdf.splitTextToSize(item.item_name, contentWidth - 42)
        ensureSpace(8 + lines.length * 5 + (item.notes ? 6 : 0))
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.setTextColor(17, 24, 39)
        pdf.text(lines, margin, y)
        text(formatCurrency(item.amount), pageWidth - margin, { align: 'right' })
        y += lines.length * 5
        if (item.notes) {
          const noteLines = pdf.splitTextToSize(item.notes, contentWidth - 42)
          pdf.setFontSize(8)
          pdf.setTextColor(100, 116, 139)
          pdf.text(noteLines, margin, y)
          y += noteLines.length * 4
        }
        y += 4
        pdf.setDrawColor(241, 245, 249)
        pdf.line(margin, y, pageWidth - margin, y)
        y += 5
      })

      ensureSpace(34)
      const totalsX = pageWidth - margin
      text('Subtotal', totalsX - 42, { align: 'right', style: 'bold' })
      text(formatCurrency(invoice.subtotal), totalsX, { align: 'right', style: 'bold' })
      y += 7

      if (invoice.amount_paid > 0) {
        text('Amount Paid', totalsX - 42, { align: 'right', style: 'bold', color: [22, 163, 74] })
        text(`-${formatCurrency(invoice.amount_paid)}`, totalsX, { align: 'right', style: 'bold', color: [22, 163, 74] })
        y += 7
      }

      text('Balance Due', totalsX - 42, { align: 'right', size: 12, style: 'bold' })
      text(formatCurrency(invoice.balance), totalsX, { align: 'right', size: 12, style: 'bold', color: invoice.balance > 0 ? [220, 38, 38] : [22, 163, 74] })
      y += 12

      if (payments.length > 0) {
        ensureSpace(20)
        text('Payment History', margin, { size: 12, style: 'bold' })
        y += 8
        payments.forEach((payment) => {
          ensureSpace(10)
          text(`${formatDate(payment.payment_date)} - ${payment.payment_method}${payment.reference ? ` - Ref: ${payment.reference}` : ''}`, margin, { color: [71, 85, 105] })
          text(formatCurrency(payment.amount), pageWidth - margin, { align: 'right', style: 'bold', color: [22, 163, 74] })
          y += 7
        })
      }

      ensureSpace(18)
      pdf.setDrawColor(226, 232, 240)
      pdf.line(margin, y, pageWidth - margin, y)
      y += 8
      text('Thank you for your business.', pageWidth / 2, { align: 'center', color: [100, 116, 139] })
      y += 5
      text('For questions about this invoice, please contact your property manager.', pageWidth / 2, { align: 'center', size: 8, color: [100, 116, 139] })

      const fileName = `${invoice.invoice_number}.pdf`
      const pdfBlob = pdf.output('blob')
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })

      if (navigator.canShare?.({ files: [pdfFile] })) {
        await navigator.share({
          title: invoice.invoice_number,
          text: `Invoice ${invoice.invoice_number}`,
          files: [pdfFile],
        })
      } else {
        pdf.save(fileName)
      }
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name !== 'AbortError') {
        setError(shareError.message)
      }
    } finally {
      setSharingPdf(false)
    }
  }

  const deleteInvoice = async () => {
    if (!confirm('Delete this invoice and all related invoice items and payments? This cannot be undone.')) return

    setDeleting(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setDeleting(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('rent_invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    router.push('/invoices')
    router.refresh()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-success-100 text-success-800'
      case 'overdue': return 'bg-danger-100 text-danger-800'
      case 'partially_paid': return 'bg-blue-100 text-blue-800'
      default: return 'bg-warning-100 text-warning-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-danger-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Invoice not found</h2>
        <Link href="/invoices" className="btn-primary mt-4 inline-flex">
          Back to Invoices
        </Link>
      </div>
    )
  }

  const rentItems = items.filter((item) => item.item_type === 'rent' || (item.item_type === 'tax' && item.item_name.toLowerCase().includes('rent')))
  const serviceItems = items.filter((item) => item.item_type === 'service_charge' || (item.item_type === 'tax' && item.item_name.toLowerCase().includes('service')))
  const displayedItems = itemFilter === 'rent' ? rentItems : itemFilter === 'service_charge' ? serviceItems : items
  const rentTotal = rentItems.reduce((sum, item) => sum + item.amount, 0)
  const serviceTotal = serviceItems.reduce((sum, item) => sum + item.amount, 0)
  const otherTotal = items.reduce((sum, item) => sum + item.amount, 0) - rentTotal - serviceTotal

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/invoices" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center mr-4">
              <Receipt className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="page-title">{invoice.invoice_number}</h1>
                <span className={`badge ${getStatusColor(invoice.status)}`}>
                  {invoice.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-gray-500">
                {getMonthName(invoice.billing_month)} {invoice.billing_year}
              </p>
            </div>
          </div>
        </div>
        <div className="flex space-x-3 print:hidden">
          <Link href={`/invoices/${invoiceId}/edit`} className="btn-secondary">
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Link>
          <button onClick={handlePrint} className="btn-secondary">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </button>
          <button onClick={handleSharePdf} disabled={sharingPdf} className="btn-secondary">
            {sharingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
            {sharingPdf ? 'Preparing...' : 'Share PDF'}
          </button>
          <button onClick={deleteInvoice} disabled={deleting} className="btn-danger">
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
          <Link 
            href={`/payments/new?invoice=${invoiceId}`}
            className={`btn-success ${invoice.balance <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => invoice.balance <= 0 && e.preventDefault()}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Record Payment
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg print:hidden">
          {error}
        </div>
      )}

      {/* Invoice Display */}
      <div className="card print:shadow-none">
        <div className="p-8">
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">RENT INVOICE</h2>
              <p className="text-gray-500 mt-1">{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Invoice Date</p>
              <p className="font-medium">{formatDate(invoice.created_at)}</p>
              <p className="text-sm text-gray-500 mt-2">Due Date</p>
              <p className={`font-medium ${invoice.status === 'overdue' ? 'text-danger-600' : ''}`}>
                {formatDate(invoice.due_date)}
              </p>
            </div>
          </div>

          {/* Billing Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Bill To</h3>
              <div className="flex items-start">
                <User className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium">{invoice.tenant_name}</p>
                  <Link 
                    href={`/tenants/${invoice.tenant_id}`}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    View Tenant →
                  </Link>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Property</h3>
              <div className="space-y-1">
                <div className="flex items-center">
                  <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                  <Link 
                    href={`/properties/${invoice.property_id}`}
                    className="font-medium hover:text-primary-600"
                  >
                    {invoice.property_name}
                  </Link>
                </div>
                <div className="flex items-center ml-7">
                  <Home className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Unit: {invoice.unit_name}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 print:hidden">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-900">Owed Breakdown</h3>
              <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'rent', label: 'Rent' },
                  { value: 'service_charge', label: 'Service' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setItemFilter(option.value as ItemFilter)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${itemFilter === option.value ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-4">
              <div><p className="text-slate-500">Rent</p><p className="font-bold text-slate-900">{formatCurrency(rentTotal)}</p></div>
              <div><p className="text-slate-500">Service Charge</p><p className="font-bold text-slate-900">{formatCurrency(serviceTotal)}</p></div>
              <div><p className="text-slate-500">Other / Tax</p><p className="font-bold text-slate-900">{formatCurrency(otherTotal)}</p></div>
              <div><p className="text-slate-500">Balance Due</p><p className="font-bold text-primary-700">{formatCurrency(invoice.balance)}</p></div>
            </div>
          </div>

          {/* Invoice Items */}
          <table className="w-full mb-8">
            <thead className="border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-3 font-medium text-gray-500">Description</th>
                <th className="text-right py-3 font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-3">
                    <p className="font-medium">{item.item_name}</p>
                    {item.notes && (
                      <p className="text-sm text-gray-500">{item.notes}</p>
                    )}
                  </td>
                  <td className="py-3 text-right font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200">
              <tr>
                <td className="py-3 text-right font-medium">Subtotal</td>
                <td className="py-3 text-right font-medium">{formatCurrency(invoice.subtotal)}</td>
              </tr>
              {invoice.amount_paid > 0 && (
              <tr className="text-success-600">
                <td className="py-3 text-right font-medium">Amount Paid</td>
                <td className="py-3 text-right font-medium">-{formatCurrency(invoice.amount_paid)}</td>
              </tr>
              )}
              <tr className="text-lg font-bold">
                <td className="py-3 text-right">Balance Due</td>
                <td className={`py-3 text-right ${invoice.balance > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                  {formatCurrency(invoice.balance)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-medium mb-4">Payment History</h3>
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-success-500 mr-2" />
                      <div>
                        <p className="font-medium">{formatDate(payment.payment_date)}</p>
                        <p className="text-sm text-gray-500">
                          {payment.payment_method}
                          {payment.reference && ` • Ref: ${payment.reference}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-success-600 font-bold">
                      {formatCurrency(payment.amount)}
                    </span>
                    <Link href={`/payments/${payment.id}/edit`} className="ml-4 text-sm font-medium text-slate-600 hover:text-slate-900 print:hidden">
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
            <p>Thank you for your business!</p>
            <p className="mt-1">For questions about this invoice, please contact your property manager.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
