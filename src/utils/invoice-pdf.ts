import { formatCurrency, formatDate } from '@/utils/currency'

export type PdfInvoice = {
  invoice_number: string
  status: string
  created_at: string
  due_date: string
  billing_period_start: string
  billing_period_end: string
  subtotal: number
  amount_paid: number
  balance: number
  tenant_name: string
  unit_name: string
  property_name: string
}

export type PdfInvoiceItem = {
  item_name: string
  amount: number
  notes: string | null
}

export type PdfPayment = {
  amount: number
  payment_date: string
  payment_method: string
  reference: string | null
}

export type InvoicePdfSettings = {
  paymentInstructions?: string | null
  footerNote?: string | null
}

export async function createInvoicePdf(
  invoice: PdfInvoice,
  items: PdfInvoiceItem[],
  payments: PdfPayment[],
  settings: InvoicePdfSettings = {}
) {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  const paymentInstructions = settings.paymentInstructions?.trim()
  const footerNote = settings.footerNote?.trim() || 'E.&.O.E.'
  const balanceLabel = invoice.balance < 0 ? 'Credit Balance' : invoice.balance === 0 ? 'Settled Balance' : 'Balance Due'
  let y = 18

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - margin) return
    pdf.addPage()
    y = margin
  }

  const text = (
    value: string,
    x: number,
    options?: { size?: number; style?: 'normal' | 'bold'; color?: [number, number, number]; align?: 'left' | 'right' | 'center' }
  ) => {
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
  text(`${balanceLabel}: ${formatCurrency(Math.abs(invoice.balance))}`, pageWidth - margin - 4, { style: 'bold', color: invoice.balance > 0 ? [220, 38, 38] : [22, 163, 74], align: 'right' })
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

  text(balanceLabel, totalsX - 42, { align: 'right', size: 12, style: 'bold' })
  text(formatCurrency(Math.abs(invoice.balance)), totalsX, { align: 'right', size: 12, style: 'bold', color: invoice.balance > 0 ? [220, 38, 38] : [22, 163, 74] })
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

  if (paymentInstructions) {
    ensureSpace(22)
    pdf.setFillColor(239, 246, 255)
    pdf.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F')
    y += 7
    text('Payment Instructions', margin + 4, { size: 9, style: 'bold', color: [30, 64, 175] })
    y += 5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(30, 64, 175)
    pdf.text(pdf.splitTextToSize(paymentInstructions, contentWidth - 8), margin + 4, y)
    y += 10
  }

  ensureSpace(20)
  pdf.setDrawColor(226, 232, 240)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 8
  text(footerNote, pageWidth / 2, { align: 'center', style: 'bold', color: [100, 116, 139] })
  y += 5
  text('Thank you for your business.', pageWidth / 2, { align: 'center', color: [100, 116, 139] })
  y += 5
  text('For questions about this invoice, please contact your property manager.', pageWidth / 2, { align: 'center', size: 8, color: [100, 116, 139] })

  const fileName = `${invoice.invoice_number}.pdf`
  const pdfBlob = pdf.output('blob')
  const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })

  return { pdf, fileName, pdfFile }
}
