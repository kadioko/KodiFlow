import { formatCurrency, formatDate } from './currency'

export function createPaymentReminderMessage(input: {
  tenantName: string
  invoiceNumber: string
  balance: number
  dueDate: string
}) {
  return `Hello ${input.tenantName}, this is a reminder that invoice ${input.invoiceNumber} has an outstanding balance of ${formatCurrency(input.balance)} due on ${formatDate(input.dueDate)}. Please arrange payment at your earliest convenience.`
}
