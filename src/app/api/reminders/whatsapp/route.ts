import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentReminderMessage } from '@/utils/reminders'

function normalizePhone(value: string | null) {
  if (!value) return ''
  return value.replace(/[^0-9]/g, '').replace(/^0/, '255')
}

export async function POST(request: Request) {
  const endpoint = process.env.WHATSAPP_API_URL
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!endpoint || !accessToken) return NextResponse.json({ error: 'WhatsApp delivery is not configured yet.' }, { status: 503 })

  const body = await request.json()
  const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : ''
  if (!invoiceId) return NextResponse.json({ error: 'Invoice is required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { data: invoice, error } = await supabase
    .from('rent_invoices')
    .select('invoice_number, balance, due_date, tenants(full_name, business_name, phone)')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()
  if (error || !invoice || invoice.balance <= 0) return NextResponse.json({ error: 'An open invoice is required' }, { status: 400 })

  const tenant = Array.isArray(invoice.tenants) ? invoice.tenants[0] : invoice.tenants
  const phone = normalizePhone(tenant?.phone || null)
  if (!phone) return NextResponse.json({ error: 'This tenant does not have a valid phone number' }, { status: 400 })
  const message = createPaymentReminderMessage({ tenantName: tenant?.full_name || tenant?.business_name || 'Tenant', invoiceNumber: invoice.invoice_number, balance: invoice.balance, dueDate: invoice.due_date })
  const delivery = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } }) })
  if (!delivery.ok) return NextResponse.json({ error: 'WhatsApp did not accept the reminder. Check the sender and approved template settings.' }, { status: 502 })
  return NextResponse.json({ sent: true })
}
