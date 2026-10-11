import { formatCurrency, formatDate } from './currency'

export type InvoiceListPdfItem = {
  invoice_number: string
  tenant_name: string
  unit_name: string
  property_name: string
  billing_period_start: string
  billing_period_end: string
  subtotal: number
  amount_paid: number
  balance: number
  due_date: string
  status: string
}

export type InvoiceListTotals = {
  expected: number
  collected: number
  outstanding: number
  credits: number
}

export function calculateInvoiceListTotals(invoices: InvoiceListPdfItem[]): InvoiceListTotals {
  return invoices.reduce<InvoiceListTotals>((totals, invoice) => ({
    expected: totals.expected + invoice.subtotal,
    collected: totals.collected + invoice.amount_paid,
    outstanding: totals.outstanding + Math.max(invoice.balance, 0),
    credits: totals.credits + Math.max(-invoice.balance, 0),
  }), { expected: 0, collected: 0, outstanding: 0, credits: 0 })
}

export async function createInvoiceListPdf(invoices: InvoiceListPdfItem[], statusLabel: string) {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2
  const title = `${statusLabel} invoices`
  const totals = calculateInvoiceListTotals(invoices)
  let y = 0

  const drawContinuationHeader = () => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(51, 65, 85)
    pdf.text(`${title} - Continued`, margin, 13)
    pdf.setDrawColor(226, 232, 240)
    pdf.line(margin, 17, pageWidth - margin, 17)
    y = 23
  }

  pdf.setFillColor(15, 23, 42)
  pdf.rect(0, 0, pageWidth, 37, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.setTextColor(255, 255, 255)
  pdf.text(title, margin, 17)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(203, 213, 225)
  pdf.text(`${invoices.length} invoices - Generated ${formatDate(new Date())}`, margin, 26)
  y = 46

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - margin - 10) return
    pdf.addPage()
    drawContinuationHeader()
  }

  const wrap = (value: string, width: number, size: number) => {
    pdf.setFontSize(size)
    return pdf.splitTextToSize(value, width) as string[]
  }

  invoices.forEach((invoice) => {
    const tenantLines = wrap(invoice.tenant_name || 'Unknown tenant', contentWidth - 2, 10)
    const locationLines = wrap(`Property: ${invoice.property_name || 'Unknown property'} | Unit: ${invoice.unit_name || 'Unknown unit'}`, contentWidth - 2, 8)
    const periodLines = wrap(`Period: ${formatDate(invoice.billing_period_start)} - ${formatDate(invoice.billing_period_end)} | Due: ${formatDate(invoice.due_date)}`, contentWidth - 2, 8)
    const rowHeight = 29 + (tenantLines.length + locationLines.length + periodLines.length) * 4.5
    ensureSpace(rowHeight)

    pdf.setDrawColor(226, 232, 240)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 5

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(15, 23, 42)
    pdf.text(invoice.invoice_number, margin, y)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(invoice.status === 'overdue' ? 185 : 161, invoice.status === 'overdue' ? 28 : 98, invoice.status === 'overdue' ? 28 : 7)
    pdf.text(invoice.status.replaceAll('_', ' ').toUpperCase(), pageWidth - margin, y, { align: 'right' })
    y += 6

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(17, 24, 39)
    pdf.text(tenantLines, margin, y)
    y += tenantLines.length * 4.5

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(71, 85, 105)
    pdf.text(locationLines, margin, y)
    y += locationLines.length * 4.5
    pdf.text(periodLines, margin, y)
    y += periodLines.length * 4.5 + 2

    const metrics = [
      { label: 'Expected', amount: invoice.subtotal, color: [51, 65, 85] as [number, number, number] },
      { label: 'Collected', amount: invoice.amount_paid, color: [22, 101, 52] as [number, number, number] },
      {
        label: invoice.balance < 0 ? 'Credit available' : 'Outstanding',
        amount: Math.abs(invoice.balance),
        color: invoice.balance < 0 ? [22, 101, 52] as [number, number, number] : [185, 28, 28] as [number, number, number],
      },
    ]
    const columnWidth = contentWidth / metrics.length
    metrics.forEach((metric, index) => {
      const x = margin + index * columnWidth
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(100, 116, 139)
      pdf.text(metric.label, x, y)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(...metric.color)
      pdf.text(formatCurrency(metric.amount), x, y + 5)
    })
    y += 12
  })

  ensureSpace(totals.credits > 0 ? 42 : 34)
  const summaryHeight = totals.credits > 0 ? 38 : 31
  pdf.setFillColor(241, 245, 249)
  pdf.roundedRect(margin, y, contentWidth, summaryHeight, 2, 2, 'F')
  y += 8
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(15, 23, 42)
  pdf.text(`TOTALS - ${invoices.length} invoices`, margin + 4, y)
  y += 7

  const summaryMetrics = [
    { label: 'Expected', amount: totals.expected, color: [51, 65, 85] as [number, number, number] },
    { label: 'Collected', amount: totals.collected, color: [22, 101, 52] as [number, number, number] },
    { label: 'Outstanding', amount: totals.outstanding, color: [185, 28, 28] as [number, number, number] },
  ]
  const summaryColumnWidth = (contentWidth - 8) / summaryMetrics.length
  summaryMetrics.forEach((metric, index) => {
    const x = margin + 4 + index * summaryColumnWidth
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(71, 85, 105)
    pdf.text(metric.label, x, y)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...metric.color)
    pdf.text(formatCurrency(metric.amount), x, y + 5)
  })
  if (totals.credits > 0) {
    y += 12
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(22, 101, 52)
    pdf.text(`Credits available: ${formatCurrency(totals.credits)}`, margin + 4, y)
  }

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(100, 116, 139)
    pdf.text(`KodiFlow - ${title} - Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 7, { align: 'center' })
  }

  const fileDate = new Date().toISOString().slice(0, 10)
  const fileName = `kodiflow-${statusLabel.toLowerCase()}-invoices-${fileDate}.pdf`
  const pdfFile = new File([pdf.output('blob')], fileName, { type: 'application/pdf' })
  return { pdf, pdfFile, fileName }
}
