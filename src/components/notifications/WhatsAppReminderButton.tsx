'use client'

import { useState } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'

export function WhatsAppReminderButton({ invoiceId, compact = false }: { invoiceId: string; compact?: boolean }) {
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const send = async () => {
    setSending(true); setMessage('')
    const response = await fetch('/api/reminders/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId }) })
    const data = await response.json()
    setMessage(response.ok ? 'Sent' : data.error || 'Not sent')
    setSending(false)
  }
  return <span className="inline-flex items-center gap-1"><button type="button" onClick={send} disabled={sending} className="inline-flex items-center gap-1 text-success-700 hover:text-success-800 disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}{compact ? '' : 'WhatsApp'}</button>{message && <span className={`text-xs ${message === 'Sent' ? 'text-success-700' : 'text-danger-700'}`}>{message}</span>}</span>
}
