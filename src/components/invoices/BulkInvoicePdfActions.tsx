'use client'

import { useState } from 'react'
import { Download, Loader2, Share2 } from 'lucide-react'
import type { InvoiceListPdfItem } from '@/utils/invoice-list-pdf'

type BulkInvoicePdfActionsProps = {
  invoices: InvoiceListPdfItem[]
  statusLabel: 'Overdue' | 'Unpaid'
}

export function BulkInvoicePdfActions({ invoices, statusLabel }: BulkInvoicePdfActionsProps) {
  const [busy, setBusy] = useState<'share' | 'download' | null>(null)
  const [error, setError] = useState('')

  const exportPdf = async (action: 'share' | 'download') => {
    setBusy(action)
    setError('')

    try {
      const { createInvoiceListPdf } = await import('@/utils/invoice-list-pdf')
      const result = await createInvoiceListPdf(invoices, statusLabel)

      if (action === 'share' && navigator.share && navigator.canShare?.({ files: [result.pdfFile] })) {
        await navigator.share({
          title: `${statusLabel} invoices`,
          text: `${invoices.length} ${statusLabel.toLowerCase()} invoices`,
          files: [result.pdfFile],
        })
      } else {
        result.pdf.save(result.fileName)
      }
    } catch (exportError) {
      if (!(exportError instanceof Error && exportError.name === 'AbortError')) {
        setError(exportError instanceof Error ? exportError.message : 'The invoice PDF could not be created.')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Exporting {invoices.length} {statusLabel.toLowerCase()} invoice{invoices.length === 1 ? '' : 's'} in the current view.
        </p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={`${statusLabel} invoice PDF actions`}>
          <button
            type="button"
            onClick={() => exportPdf('share')}
            disabled={busy !== null}
            className="btn-secondary min-h-11 justify-center"
          >
            {busy === 'share' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            {busy === 'share' ? 'Preparing...' : 'Share PDF'}
          </button>
          <button
            type="button"
            onClick={() => exportPdf('download')}
            disabled={busy !== null}
            className="btn-secondary min-h-11 justify-center"
          >
            {busy === 'download' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {busy === 'download' ? 'Preparing...' : 'Download PDF'}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-danger-700" role="alert">{error}</p>}
    </div>
  )
}
