'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createInvoicePdf, type InvoicePdfSettings, type PdfInvoice } from '@/utils/invoice-pdf'

type TenantInvoiceActionsProps = {
  invoiceId: string
  invoice: PdfInvoice
  settings: InvoicePdfSettings
}

type InvoiceItemRow = {
  item_name: string
  amount: number
  notes: string | null
}

type PaymentRow = {
  amount: number
  payment_date: string
  payment_method: string
  reference: string | null
}

export default function TenantInvoiceActions({ invoiceId, invoice, settings }: TenantInvoiceActionsProps) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const downloadPdf = async () => {
    setDownloading(true)
    setError('')

    try {
      const supabase = createClient()
      const [{ data: itemData, error: itemError }, { data: paymentData, error: paymentError }] = await Promise.all([
        supabase
          .from('invoice_items')
          .select('item_name, amount, notes')
          .eq('invoice_id', invoiceId)
          .order('created_at'),
        supabase
          .from('payments')
          .select('amount, payment_date, payment_method, reference')
          .eq('invoice_id', invoiceId)
          .order('payment_date', { ascending: false }),
      ])

      if (itemError) throw itemError
      if (paymentError) throw paymentError

      const pdfResult = await createInvoicePdf(
        invoice,
        (itemData || []) as InvoiceItemRow[],
        (paymentData || []) as PaymentRow[],
        settings
      )
      pdfResult.pdf.save(pdfResult.fileName)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download invoice')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-1">
      <button type="button" onClick={downloadPdf} disabled={downloading} className="btn-secondary px-3 py-1.5 text-xs">
        {downloading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
        PDF
      </button>
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  )
}
