import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/utils/currency'

type StatementEntry = { id: string; date: string; type: 'Invoice' | 'Payment' | 'Payment reversal'; reference: string; debit: number; credit: number; note: string }

export default async function TenantStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const [{ data: tenant }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.from('tenants').select('full_name, business_name').eq('id', tenantId).eq('user_id', user.id).single(),
    supabase.from('rent_invoices').select('id, invoice_number, subtotal, created_at, status').eq('tenant_id', tenantId).eq('user_id', user.id).neq('status', 'cancelled'),
    supabase.from('payments').select('id, amount, payment_date, reference, notes, is_reversal, void_reason').eq('tenant_id', tenantId).eq('user_id', user.id),
  ])
  const entries: StatementEntry[] = [
    ...(invoices || []).map((invoice) => ({ id: `invoice-${invoice.id}`, date: invoice.created_at, type: 'Invoice' as const, reference: invoice.invoice_number || 'Invoice', debit: Number(invoice.subtotal || 0), credit: 0, note: invoice.status === 'transferred' ? 'Transferred from prior lease' : '' })),
    ...(payments || []).map((payment) => ({ id: `payment-${payment.id}`, date: payment.payment_date, type: payment.is_reversal ? 'Payment reversal' as const : 'Payment' as const, reference: payment.reference || 'Payment', debit: payment.amount < 0 ? Math.abs(Number(payment.amount)) : 0, credit: payment.amount > 0 ? Number(payment.amount) : 0, note: payment.void_reason || payment.notes || '' })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let balance = 0
  const rows = entries.map((entry) => { balance += entry.debit - entry.credit; return { ...entry, balance } })
  const name = tenant?.full_name || tenant?.business_name || 'Tenant'
  return <div className="space-y-6"><div className="page-header"><div className="flex items-center gap-3"><Link href={`/tenants/${tenantId}`} className="icon-button"><ArrowLeft className="h-5 w-5" /></Link><div><h1 className="page-title">Tenant statement</h1><p className="text-gray-500">{name} · chronological account ledger</p></div></div></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3"><Stat label="Invoiced" value={formatCurrency(rows.reduce((sum, row) => sum + row.debit, 0))} /><Stat label="Payments" value={formatCurrency(rows.reduce((sum, row) => sum + row.credit, 0))} tone="text-success-700" /><Stat label="Current balance" value={formatCurrency(Math.abs(balance))} tone={balance > 0 ? 'text-danger-700' : balance < 0 ? 'text-success-700' : 'text-slate-900'} /></div><div className="table-container"><table className="table"><thead className="table-header"><tr><th className="table-header-cell">Date</th><th className="table-header-cell">Entry</th><th className="table-header-cell">Debit</th><th className="table-header-cell">Credit</th><th className="table-header-cell">Balance</th></tr></thead><tbody className="table-body">{rows.length === 0 ? <tr><td colSpan={5} className="table-cell text-center text-slate-500">No account activity yet.</td></tr> : rows.map((row) => <tr key={row.id}><td className="table-cell">{formatDate(row.date)}</td><td className="table-cell"><p className="font-medium text-slate-900">{row.type} · {row.reference}</p>{row.note && <p className="mt-1 text-xs text-slate-500">{row.note}</p>}</td><td className="table-cell text-danger-700">{row.debit ? formatCurrency(row.debit) : '-'}</td><td className="table-cell text-success-700">{row.credit ? formatCurrency(row.credit) : '-'}</td><td className={`table-cell font-semibold ${row.balance > 0 ? 'text-danger-700' : row.balance < 0 ? 'text-success-700' : 'text-slate-700'}`}>{formatCurrency(Math.abs(row.balance))}</td></tr>)}</tbody></table></div></div>
}

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) { return <div className="stat-card"><p className="stat-label">{label}</p><p className={`stat-value ${tone}`}>{value}</p></div> }
