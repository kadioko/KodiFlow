'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, Loader2 } from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'
import { createClient } from '@/lib/supabase/client'
import { PAYMENT_METHODS } from '@/utils/constants'
import { formatCurrency, parseCurrencyInput } from '@/utils/currency'

type PaymentMethod = 'cash' | 'bank' | 'mobile_money' | 'cheque' | 'card' | 'other'

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatAmountInput(amount: number) {
  if (!amount) return ''
  return amount.toLocaleString('en-TZ', { maximumFractionDigits: 0 })
}

export default function EditPaymentPage() {
  const router = useRouter()
  const params = useParams()
  const paymentId = getRouteParam(params.id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceSubtotal, setInvoiceSubtotal] = useState(0)
  const [otherPaid, setOtherPaid] = useState(0)
  const [amountInput, setAmountInput] = useState('')
  const [formData, setFormData] = useState({
    invoice_id: '',
    amount: 0,
    payment_date: '',
    payment_method: 'cash' as PaymentMethod,
    reference: '',
    notes: '',
  })

  useEffect(() => {
    if (!paymentId) {
      setError('Payment not found')
      setLoading(false)
      return
    }

    fetchPayment()
  }, [paymentId])

  const fetchPayment = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, rent_invoices(invoice_number, subtotal)')
      .eq('id', paymentId)
      .eq('user_id', user.id)
      .single()

    if (paymentError || !payment) {
      setError('Payment not found')
      setLoading(false)
      return
    }

    const { data: otherPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('invoice_id', payment.invoice_id)
      .eq('user_id', user.id)
      .neq('id', payment.id)

    setOtherPaid((otherPayments || []).reduce((sum, item) => sum + (item.amount || 0), 0))
    setInvoiceNumber(payment.rent_invoices?.invoice_number || '')
    setInvoiceSubtotal(payment.rent_invoices?.subtotal || 0)
    setFormData({
      invoice_id: payment.invoice_id,
      amount: payment.amount,
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      reference: payment.reference || '',
      notes: payment.notes || '',
    })
    setAmountInput(formatAmountInput(payment.amount))
    setLoading(false)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const maxAllowed = invoiceSubtotal - otherPaid
    if (formData.amount <= 0) {
      setError('Payment amount must be greater than 0')
      setSaving(false)
      return
    }

    if (formData.amount > maxAllowed) {
      setError(`Payment cannot exceed remaining invoice amount of ${formatCurrency(maxAllowed)}`)
      setSaving(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        amount: formData.amount,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        reference: formData.reference || null,
        notes: formData.notes || null,
      })
      .eq('id', paymentId)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    router.push(`/payments/${paymentId}`)
    router.refresh()
  }

  const deletePayment = async () => {
    if (!confirm('Delete this payment? The invoice balance will be recalculated.')) return

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
      .from('payments')
      .delete()
      .eq('id', paymentId)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    router.push('/payments')
    router.refresh()
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="page-header">
        <div className="flex items-center">
          <Link href={`/payments/${paymentId}`} className="mr-4 rounded-lg p-2 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Edit Payment</h1>
            <p className="text-gray-500">{invoiceNumber || 'Payment record'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700">{error}</div>}

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div><p className="text-slate-500">Invoice</p><p className="font-semibold text-slate-900">{invoiceNumber}</p></div>
            <div><p className="text-slate-500">Other Paid</p><p className="font-semibold text-slate-900">{formatCurrency(otherPaid)}</p></div>
            <div><p className="text-slate-500">Max Payment</p><p className="font-semibold text-primary-700">{formatCurrency(invoiceSubtotal - otherPaid)}</p></div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="amount" className="label">Amount</label>
          <input
            id="amount"
            required
            type="text"
            inputMode="numeric"
            className="input"
            value={amountInput}
            onChange={(event) => {
              const amount = parseCurrencyInput(event.target.value)
              setAmountInput(event.target.value ? amount.toLocaleString('en-TZ', { maximumFractionDigits: 0 }) : '')
              setFormData({ ...formData, amount })
            }}
            placeholder="Enter amount"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DateInput id="payment_date" label="Payment Date" required value={formData.payment_date} onChange={(value) => setFormData({ ...formData, payment_date: value })} />
          <div className="form-group">
            <label htmlFor="payment_method" className="label">Payment Method</label>
            <select id="payment_method" required className="input" value={formData.payment_method} onChange={(event) => setFormData({ ...formData, payment_method: event.target.value as PaymentMethod })}>
              {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="reference" className="label">Reference</label>
          <input id="reference" className="input" value={formData.reference} onChange={(event) => setFormData({ ...formData, reference: event.target.value })} />
        </div>

        <div className="form-group">
          <label htmlFor="notes" className="label">Notes</label>
          <textarea id="notes" rows={3} className="input" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} />
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={deletePayment} disabled={deleting || saving} className="btn-danger">
            <Trash2 className="mr-2 h-5 w-5" />
            {deleting ? 'Deleting...' : 'Delete Payment'}
          </button>
          <div className="flex justify-end gap-3">
            <Link href={`/payments/${paymentId}`} className="btn-secondary">Cancel</Link>
            <button type="submit" disabled={saving || deleting} className="btn-primary">
              <Save className="mr-2 h-5 w-5" />
              {saving ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
