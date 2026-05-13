'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, 
  Receipt, 
  Printer,
  Mail,
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

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    fetchInvoiceData()
  }, [params.id])

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
      .eq('id', params.id)
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
      .eq('invoice_id', params.id)
      .eq('user_id', user.id)
      .order('created_at')

    if (itemsData) {
      setItems(itemsData)
    }

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', params.id)
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
          <button onClick={handlePrint} className="btn-secondary">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </button>
          <Link 
            href={`/payments/new?invoice=${params.id}`}
            className={`btn-success ${invoice.balance <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => invoice.balance <= 0 && e.preventDefault()}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Record Payment
          </Link>
        </div>
      </div>

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

          {/* Invoice Items */}
          <table className="w-full mb-8">
            <thead className="border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-3 font-medium text-gray-500">Description</th>
                <th className="text-right py-3 font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
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
              <tr className="text-success-600">
                <td className="py-3 text-right font-medium">Amount Paid</td>
                <td className="py-3 text-right font-medium">-{formatCurrency(invoice.amount_paid)}</td>
              </tr>
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
