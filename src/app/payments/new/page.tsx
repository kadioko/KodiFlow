'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, CreditCard, CheckCircle } from 'lucide-react'
import { PAYMENT_METHODS } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'

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

export default function NewPaymentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedInvoiceId = searchParams.get('invoice')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const [formData, setFormData] = useState<{
    invoice_id: string
    amount: number
    payment_date: string
    payment_method: 'cash' | 'bank' | 'mobile_money' | 'cheque' | 'card' | 'other'
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

  // Fetch unpaid/partially paid invoices
  useEffect(() => {
    const fetchInvoices = async () => {
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
          const formattedInvoices = data.map((inv: any) => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            tenant_name: inv.tenants?.full_name || inv.tenants?.business_name,
            unit_name: inv.units?.unit_name,
            property_name: inv.properties?.name,
            balance: inv.balance,
            subtotal: inv.subtotal,
            amount_paid: inv.amount_paid,
            due_date: inv.due_date,
          }))
          setInvoices(formattedInvoices)

          // If invoice is preselected, set it
          if (preselectedInvoiceId) {
            const selected = formattedInvoices.find(i => i.id === preselectedInvoiceId)
            if (selected) {
              setSelectedInvoice(selected)
              setFormData(prev => ({
                ...prev,
                amount: selected.balance,
              }))
            }
          }
        }
      }
    }
    fetchInvoices()
  }, [preselectedInvoiceId])

  const handleInvoiceChange = (invoiceId: string) => {
    const selected = invoices.find(i => i.id === invoiceId)
    if (selected) {
      setSelectedInvoice(selected)
      setFormData(prev => ({
        ...prev,
        invoice_id: invoiceId,
        amount: selected.balance,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!selectedInvoice) {
      setError('Please select an invoice')
      setLoading(false)
      return
    }

    if (formData.amount <= 0) {
      setError('Payment amount must be greater than 0')
      setLoading(false)
      return
    }

    if (formData.amount > selectedInvoice.balance) {
      setError('Payment amount cannot exceed the invoice balance')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    // Get lease and other related IDs
    const { data: invoiceData } = await supabase
      .from('rent_invoices')
      .select('tenant_id, lease_id, property_id, unit_id')
      .eq('id', formData.invoice_id)
      .single()

    if (!invoiceData) {
      setError('Invoice not found')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        invoice_id: formData.invoice_id,
        tenant_id: invoiceData.tenant_id,
        lease_id: invoiceData.lease_id,
        property_id: invoiceData.property_id,
        unit_id: invoiceData.unit_id,
        amount: formData.amount,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        reference: formData.reference || null,
        notes: formData.notes || null,
      })

    if (insertError) {
      setError(insertError.message)
    } else {
      router.push('/payments')
      router.refresh()
    }

    setLoading(false)
  }

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

      <div className="card">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

          <div className="flex items-center justify-end space-x-4 pt-4">
            <Link href="/payments" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={loading || !selectedInvoice} className="btn-success">
              <CheckCircle className="h-5 w-5 mr-2" />
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
