import { formatDate } from '@/utils/currency'
import { getFollowUpAction, type FollowUpAction, type FollowUpItem, type FollowUpPriority } from './follow-up-report'

export type FollowUpPdfLabels = {
  title: string
  generated: string
  clients: string
  unitsLeft: string
  unitsOwed: string
  actionLabel: string
  lastReading: string
  unknown: string
  stale: string
  unconfirmed: string
  disclaimer: string
  priority: Record<FollowUpPriority, string>
  action: Record<FollowUpAction, string>
}

export async function createElectricityFollowUpPdf(
  property: string, items: FollowUpItem[], date: string, labels: FollowUpPdfLabels,
) {
  const { default: JsPDF } = await import('jspdf')
  const pdf = new JsPDF('p', 'mm', 'a4')
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const margin = 14
  const number = new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 3 })
  let y = 0
  const heading = (continued = false) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    pdf.setTextColor(15, 23, 42)
    pdf.text(labels.title, margin, 17)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(71, 85, 105)
    const subtitle = `${property} | ${labels.generated}: ${formatDate(date)} | ${items.length} ${labels.clients}${continued ? ' (cont.)' : ''}`
    const subtitleLines = pdf.splitTextToSize(subtitle, width - margin * 2) as string[]
    pdf.text(subtitleLines, margin, 24)
    y = 26 + subtitleLines.length * 4
    pdf.setDrawColor(203, 213, 225)
    pdf.line(margin, y, width - margin, y)
    y += 7
  }
  heading()
  for (const item of items) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    const title = pdf.splitTextToSize(item.client || labels.unknown, width - margin * 2 - 3) as string[]
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const details = [
      item.location || labels.unknown,
      `${item.balance !== null && item.balance < 0 ? labels.unitsOwed : labels.unitsLeft}: ${item.balance === null ? labels.unknown : `${number.format(Math.abs(item.balance))} kWh`} | ${labels.lastReading}: ${item.readingDate ? formatDate(item.readingDate) : labels.unknown}`,
      `${labels.actionLabel}: ${labels.action[getFollowUpAction(item)]}`,
      ...(item.readingNeedsCheck ? [labels.stale] : []),
      ...(item.unconfirmedTopup ? [labels.unconfirmed] : []),
    ].flatMap((line) => pdf.splitTextToSize(line, width - margin * 2 - 3) as string[])
    const rowHeight = 11 + title.length * 4.5 + details.length * 4
    if (y + rowHeight > height - 24) {
      pdf.addPage()
      heading(true)
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    if (item.priority === 'urgent' || item.priority === 'low') pdf.setTextColor(185, 28, 28)
    else pdf.setTextColor(146, 64, 14)
    pdf.text(labels.priority[item.priority], margin, y)
    y += 5
    pdf.setFontSize(10)
    pdf.setTextColor(15, 23, 42)
    pdf.text(title, margin, y)
    y += title.length * 4.5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(71, 85, 105)
    pdf.text(details, margin, y)
    y += details.length * 4 + 3
    pdf.setDrawColor(226, 232, 240)
    pdf.line(margin, y, width - margin, y)
    y += 6
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  const disclaimer = pdf.splitTextToSize(labels.disclaimer, width - margin * 2) as string[]
  if (y + disclaimer.length * 4 > height - 14) {
    pdf.addPage()
    heading(true)
  }
  pdf.setTextColor(71, 85, 105)
  pdf.text(disclaimer, margin, y)
  const fileName = `electricity-follow-up-${date}.pdf`
  return { pdf, file: new File([pdf.output('blob')], fileName, { type: 'application/pdf' }), fileName }
}
