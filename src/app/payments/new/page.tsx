'use client'

import { Suspense, useRef, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'
import { PAYMENT_METHODS } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'
import { firstRelation } from '@/utils/supabase-relations'
import type { Database } from '@/lib/supabase/database.types'

interface Invoice {
  id: string
  invoice_number: string
  tenant_name: string
  unit_name: string
  property_name: string
  balance: number
  subtotal: number
  amount_paid: number
  due_date: string
}

interface InvoiceItem {
  id: string
  item_name: string
  item_type: string
  amount: number
}

type PaymentMethod = Database['public']['Tables']['payments']['Row']['payment_method']

type InvoiceListRow = {
  id: string
  invoice_number: string
  balance: number
  subtotal: number
  amount_paid: number
  due_date: string
  tenants: { full_name: string | null; business_name: string | null } | { full_name: string | null; business_name: string | null }[] | null
  units: { unit_name: string } | { unit_name: string }[] | null
  properties: { name: string } | { name: string }[] | null
}

function createClientRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ Math.floor(Math.random() * 16) >> Number(char) / 4).toString(16)
  )
}

function NewPaymentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedInvoiceId = searchParams.get('invoice')
  
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const submitLockedRef = useRef(false)
  const clientRequestIdRef = useRef(createClientRequestId())
  const [error, setError] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])

  const [formData, setFormData] = useState<{
    invoice_id: string
    amount: number
    payment_date: string
    payment_method: PaymentMethod
    reference: string
    notes: string
  }>({
    invoice_id: preselectedInvoiceId || '',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference: '',
    notes: '',
  })

  const fetchInvoiceItems = async (invoiceId: string, userId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('invoice_items')
      .select('id, item_name, item_type, amount')
      .eq('invoice_id', invoiceId)
      .eq('user_id', userId)
      .order('created_at')

    setInvoiceItems(data || [])
  }

  // Fetch unpaid/partially paid invoices
  useEffect(() => {
    const fetchInvoices = async () => {
      setFetching(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data } = await supabase
          .from('rent_invoices')
          .select(`
            id,
            invoice_number,
            balance,
            subtotal,
            amount_paid,
            due_date,
            tenants(full_name, business_name),
            units(unit_name),
            properties(name)
          `)
          .eq('user_id', user.id)
          .in('status', ['unpaid', 'partially_paid', 'overdue'])
          .order('due_date')
        
        if (data) {
          const formattedInvoices = (data as InvoiceListRow[]).map((inv) => {
            const tenant = firstRelation(inv.tenants)
            const unit = firstRelation(inv.units)
            const property = firstRelation(inv.properties)

            return {
              id: inv.id,
              invoice_number: inv.invoice_number,
              tenant_name: tenant?.full_name || tenant?.business_name || 'Unknown tenant',
              unit_name: unit?.unit_name || 'Unknown unit',
              property_name: property?.name || 'Unknown property',
              balance: inv.balance,
              subtotal: inv.subtotal,
              amount_paid: inv.amount_paid,
              due_date: inv.due_date,
            }
          })
          setInvoices(formattedInvoices)

          // If invoice is preselected, set it
          if (preselectedInvoiceId) {
            const selected = formattedInvoices.find(i => i.id === preselectedInvoiceId)
            if (selected) {
              setSelectedInvoice(selected)
              await fetchInvoiceItems(selected.id, user.id)
              setFormData(prev => ({
                ...prev,
                amount: selected.balance,
              }))
            }
          }
        }
      }
      setFetching(false)
    }
    fetchInvoices()
  }, [preselectedInvoiceId])

  const handleInvoiceChange = async (invoiceId: string) => {
    const selected = invoices.find(i => i.id === invoiceId)
    if (selected) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      setSelectedInvoice(selected)
      if (user) {
        await fetchInvoiceItems(invoiceId, user.id)
      }
      setFormData(prev => ({
        ...prev,
        invoice_id: invoiceId,
        amount: selected.balance,
      }))
    } else {
      setSelectedInvoice(null)
      setInvoiceItems([])
      setFormData(prev => ({
        ...prev,
        invoice_id: '',
        amount: 0,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitLockedRef.current) return
    submitLockedRef.current = true
    setLoading(true)
    setError('')

    if (!selectedInvoice) {
      setError('Please select an invoice')
      setLoading(false)
      submitLockedRef.current = false
      return
    }

    if (formData.amount <= 0) {
      setError('Payment amount must be greater than 0')
      setLoading(false)
      submitLockedRef.current = false
      return
    }

    if (formData.amount > selectedInvoice.balance) {
      setError('Payment amount cannot exceed the invoice balance')
      setLoading(false)
      submitLockedRef.current = false
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      submitLockedRef.current = false
      return
    }

    const { error: insertError } = await supabase.rpc('record_invoice_payment', {
      p_invoice_id: formData.invoice_id,
      p_amount: formData.amount,
      p_payment_date: formData.payment_date,
      p_payment_method: formData.payment_method,
      p_reference: formData.reference || null,
      p_notes: formData.notes || null,
      p_client_request_id: clientRequestIdRef.current,
    })

    if (insertError) {
      setError(insertError.message)
      submitLockedRef.current = false
      setLoading(false)
    } else {
      router.push('/payments')
      router.refresh()
    }
  }

  const formDisabled = loading || fetching

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/payments" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Record Payment</h1>
            <p className="text-gray-500">Record a rent payment</p>
          </div>
        </div>
      </div>

      <div className="card relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="rounded-xl border border-success-100 bg-white px-5 py-4 text-center shadow-lg">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-success-600" />
              <p className="text-sm font-semibold text-slate-900">Recording payment</p>
              <p className="mt-1 text-xs text-slate-500">Please wait. This prevents duplicate transactions.</p>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="p-6 space-y-6" aria-busy={formDisabled}>
          <fieldset disabled={formDisabled} className="space-y-6 disabled:opacity-75">
          {fetching && (
            <div className="flex items-center rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-700">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading open invoices...
            </div>
          )}

          {loading && (
            <div className="flex items-center rounded-lg border border-success-100 bg-success-50 px-4 py-3 text-sm font-medium text-success-700">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Recording this payment. Do not close this page or submit again.
            </div>
          )}

          {error && (
            <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Invoice Selection */}
          <div className="form-group">
            <label htmlFor="invoice_id" className="label">
              Invoice <span className="text-danger-500">*</span>
            </label>
            <select
              id="invoice_id"
              required
              value={formData.invoice_id}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              className="input"
            >
              <option value="">Select an invoice</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} - {invoice.tenant_name} - Balance: {formatCurrency(invoice.balance)}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Invoice Details */}
          {selectedInvoice && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Invoice Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Tenant:</span>
                  <p className="font-medium">{selectedInvoice.tenant_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Property/Unit:</span>
                  <p className="font-medium">{selectedInvoice.property_name} - {selectedInvoice.unit_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Total Amount:</span>
                  <p className="font-medium">{formatCurrency(selectedInvoice.subtotal)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Already Paid:</span>
                  <p className="font-medium text-success-600">{formatCurrency(selectedInvoice.amount_paid)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Balance Due:</span>
                  <p className="font-medium text-danger-600">{formatCurrency(selectedInvoice.balance)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Due Date:</span>
                  <p className="font-medium">{formatDate(selectedInvoice.due_date)}</p>
                </div>
              </div>

              {invoiceItems.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <h4 className="mb-2 text-sm font-semibold text-gray-900">Charge Breakdown</h4>
                  <div className="space-y-2">
                    {invoiceItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{item.item_name}</p>
                          <p className="capitalize text-gray-500">{item.item_type.replace('_', ' ')}</p>
                        </div>
                        <p className="font-semibold text-gray-900">{formatCurrency(item.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Amount */}
          <div className="form-group">
            <label htmlFor="amount" className="label">
              Payment Amount (TZS) <span className="text-danger-500">*</span>
            </label>
            <input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="input"
              placeholder="0.00"
            />
            {selectedInvoice && (
              <div className="flex space-x-2 mt-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, amount: selectedInvoice.balance })}
                  className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200"
                >
                  Full Balance
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, amount: selectedInvoice.balance / 2 })}
                  className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                >
                  50%
                </button>
              </div>
            )}
          </div>

          {/* Payment Date & Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="payment_date" className="label">
                Payment Date <span className="text-danger-500">*</span>
              </label>
              <input
                id="payment_date"
                type="date"
                required
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="payment_method" className="label">
                Payment Method <span className="text-danger-500">*</span>
              </label>
              <select
                id="payment_method"
                required
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as typeof formData.payment_method })}
                className="input"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference */}
          <div className="form-group">
            <label htmlFor="reference" className="label">
              Reference Number
            </label>
            <input
              id="reference"
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="input"
              placeholder="Receipt number, transaction ID, etc."
            />
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="notes" className="label">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
              placeholder="Additional notes about this payment..."
            />
          </div>
          </fieldset>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <Link href="/payments" className={`btn-secondary ${formDisabled ? 'pointer-events-none opacity-50' : ''}`}>
              Cancel
            </Link>
            <button type="submit" disabled={formDisabled || !selectedInvoice} className="btn-success min-w-40">
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NewPaymentPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary-600" />
        <span className="text-sm font-medium text-slate-600">Loading payment form...</span>
      </div>
    }>
      <NewPaymentPageContent />
    </Suspense>
  )
}
