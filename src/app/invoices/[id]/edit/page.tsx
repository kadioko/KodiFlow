'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'
import { createClient } from '@/lib/supabase/client'
import { INVOICE_STATUSES } from '@/utils/constants'
import { formatCurrency } from '@/utils/currency'

type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
type InvoiceItemType = 'rent' | 'service_charge' | 'security' | 'water' | 'electricity' | 'garbage' | 'maintenance' | 'parking' | 'tax' | 'penalty' | 'other'

type InvoiceItem = {
  id: string
  item_name: string
  item_type: InvoiceItemType
  amount: number
  notes: string
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = getRouteParam(params.id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [amountPaid, setAmountPaid] = useState(0)
  const [formData, setFormData] = useState({
    due_date: '',
    status: 'unpaid' as InvoiceStatus,
    notes: '',
  })
  const [items, setItems] = useState<InvoiceItem[]>([])

  useEffect(() => {
    if (!invoiceId) {
      setError('Invoice not found')
      setLoading(false)
      return
    }

    fetchInvoice()
  }, [invoiceId])

  const fetchInvoice = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const [invoiceResult, itemsResult] = await Promise.all([
      supabase
        .from('rent_invoices')
        .select('invoice_number, due_date, status, notes, amount_paid')
        .eq('id', invoiceId)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('invoice_items')
        .select('id, item_name, item_type, amount, notes')
        .eq('invoice_id', invoiceId)
        .eq('user_id', user.id)
        .order('created_at'),
    ])

    if (invoiceResult.error || !invoiceResult.data) {
      setError('Invoice not found')
      setLoading(false)
      return
    }

    setInvoiceNumber(invoiceResult.data.invoice_number)
    setAmountPaid(invoiceResult.data.amount_paid || 0)
    setFormData({
      due_date: invoiceResult.data.due_date,
      status: invoiceResult.data.status,
      notes: invoiceResult.data.notes || '',
    })
    const invoiceItems = (itemsResult.data || []) as InvoiceItem[]
    setItems(invoiceItems.map((item) => ({
      id: item.id,
      item_name: item.item_name,
      item_type: item.item_type,
      amount: item.amount,
      notes: item.notes || '',
    })))
    setLoading(false)
  }

  const invoiceSubtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0)
  const balance = invoiceSubtotal - amountPaid

  const updateItem = (itemId: string, nextItem: Partial<InvoiceItem>) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...nextItem } : item))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setSaving(false)
      return
    }

    const { error: invoiceError } = await supabase
      .from('rent_invoices')
      .update({
        due_date: formData.due_date,
        status: formData.status,
        notes: formData.notes || null,
        subtotal: invoiceSubtotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('user_id', user.id)

    if (invoiceError) {
      setError(invoiceError.message)
      setSaving(false)
      return
    }

    for (const item of items) {
      const { error: itemError } = await supabase
        .from('invoice_items')
        .update({
          item_name: item.item_name,
          item_type: item.item_type,
          amount: item.amount,
          notes: item.notes || null,
        })
        .eq('id', item.id)
        .eq('user_id', user.id)

      if (itemError) {
        setError(itemError.message)
        setSaving(false)
        return
      }
    }

    router.push(`/invoices/${invoiceId}`)
    router.refresh()
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

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="page-header">
        <div className="flex items-center">
          <Link href={`/invoices/${invoiceId}`} className="mr-4 rounded-lg p-2 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Edit Invoice</h1>
            <p className="text-gray-500">{invoiceNumber}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-3">
          <DateInput id="due_date" label="Due Date" required value={formData.due_date} onChange={(value) => setFormData({ ...formData, due_date: value })} />
          <div className="form-group">
            <label htmlFor="status" className="label">Status</label>
            <select id="status" required className="input" value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value as InvoiceStatus })}>
              {INVOICE_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm text-slate-500">Balance Preview</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(balance)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Invoice Lines</h2>
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="label">Description</label>
                <input className="input" value={item.item_name} onChange={(event) => updateItem(item.id, { item_name: event.target.value })} />
              </div>
              <div className="md:col-span-3">
                <label className="label">Type</label>
                <select className="input" value={item.item_type} onChange={(event) => updateItem(item.id, { item_type: event.target.value as InvoiceItemType })}>
                  {['rent', 'service_charge', 'security', 'water', 'electricity', 'garbage', 'maintenance', 'parking', 'tax', 'penalty', 'other'].map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Amount</label>
                <input type="number" className="input" value={item.amount} onChange={(event) => updateItem(item.id, { amount: parseFloat(event.target.value) || 0 })} />
              </div>
              <div className="md:col-span-3">
                <label className="label">Notes</label>
                <input className="input" value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} />
              </div>
            </div>
          ))}
        </div>

        <div className="form-group">
          <label htmlFor="notes" className="label">Invoice Notes</label>
          <textarea id="notes" rows={3} className="input" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} />
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm md:grid-cols-3">
          <div><p className="text-slate-500">Subtotal</p><p className="font-bold text-slate-900">{formatCurrency(invoiceSubtotal)}</p></div>
          <div><p className="text-slate-500">Paid</p><p className="font-bold text-success-700">{formatCurrency(amountPaid)}</p></div>
          <div><p className="text-slate-500">Balance</p><p className="font-bold text-primary-700">{formatCurrency(balance)}</p></div>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={deleteInvoice} disabled={deleting || saving} className="btn-danger">
            <Trash2 className="mr-2 h-5 w-5" />
            {deleting ? 'Deleting...' : 'Delete Invoice'}
          </button>
          <div className="flex justify-end gap-3">
            <Link href={`/invoices/${invoiceId}`} className="btn-secondary">Cancel</Link>
            <button type="submit" disabled={saving || deleting} className="btn-primary">
              <Save className="mr-2 h-5 w-5" />
              {saving ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
