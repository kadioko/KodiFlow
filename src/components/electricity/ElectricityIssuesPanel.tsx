'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, LoaderCircle, MessageSquareText, Send, TicketCheck } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import type { TranslationKey } from '@/utils/i18n'

type Ticket = Database['public']['Tables']['electricity_issue_tickets']['Row']
type Comment = Database['public']['Tables']['electricity_issue_comments']['Row'] & { author_name: string }
type IssueEvent = Database['public']['Tables']['electricity_issue_events']['Row'] & { actor_name: string }
type MeterOption = { id: string; meter_kind: 'submeter' | 'floor_main'; floor_label: string; tenant_name: string; unit_name: string | null }
type IssueStatus = Ticket['status']
type IssuePriority = Ticket['priority']
type TicketView = Ticket & { opened_by_name: string }
type IssueData = { issues: TicketView[]; comments: Comment[]; events: IssueEvent[] }

const statuses: IssueStatus[] = ['open', 'in_progress', 'waiting_on_staff', 'resolved', 'closed']
const priorities: IssuePriority[] = ['low', 'normal', 'high', 'urgent']
const statusLabel: Record<IssueStatus, TranslationKey> = {
  open: 'electricity.issueStatusOpen',
  in_progress: 'electricity.issueStatusInProgress',
  waiting_on_staff: 'electricity.issueStatusWaiting',
  resolved: 'electricity.issueStatusResolved',
  closed: 'electricity.issueStatusClosed',
}
const priorityLabel: Record<IssuePriority, TranslationKey> = {
  low: 'electricity.issuePriorityLow',
  normal: 'electricity.issuePriorityNormal',
  high: 'electricity.issuePriorityHigh',
  urgent: 'electricity.issuePriorityUrgent',
}

const timeLabel = (value: string) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Nairobi',
}).format(new Date(value))

export function ElectricityIssuesPanel({ propertyId, meters, ownerMode }: { propertyId: string; meters: MeterOption[]; ownerMode: boolean }) {
  const { t } = useLanguage()
  const [data, setData] = useState<IssueData>({ issues: [], comments: [], events: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [accountId, setAccountId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<IssuePriority>('normal')
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [statusDrafts, setStatusDrafts] = useState<Record<string, IssueStatus>>({})
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({})

  const loadIssues = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/electricity/issues?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || t('electricity.issueLoadFailed'))
      setData(result as IssueData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('electricity.issueLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [propertyId, t])

  useEffect(() => { void loadIssues() }, [loadIssues])
  useEffect(() => { setAccountId('') }, [propertyId])

  const submitJson = async (path: string, method: 'POST' | 'PATCH', body: unknown) => {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || t('electricity.issueSaveFailed'))
    return result
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await submitJson('/api/electricity/issues', 'POST', { accountId, title, description, priority })
      setTitle('')
      setDescription('')
      setPriority('normal')
      setNotice(t('electricity.issueCreated'))
      await loadIssues()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('electricity.issueSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleComment = async (event: FormEvent, ticketId: string) => {
    event.preventDefault()
    const comment = commentDrafts[ticketId]?.trim() || ''
    if (!comment) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await submitJson('/api/electricity/issues/comments', 'POST', { ticketId, comment })
      setCommentDrafts((current) => ({ ...current, [ticketId]: '' }))
      setNotice(t('electricity.issueCommentAdded'))
      await loadIssues()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('electricity.issueCommentFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async (event: FormEvent, ticket: TicketView) => {
    event.preventDefault()
    const status = statusDrafts[ticket.id] || ticket.status
    const resolution = resolutionDrafts[ticket.id] ?? ticket.resolution ?? ''
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await submitJson('/api/electricity/issues', 'PATCH', { ticketId: ticket.id, status, resolution })
      setStatusDrafts((current) => { const next = { ...current }; delete next[ticket.id]; return next })
      setResolutionDrafts((current) => { const next = { ...current }; delete next[ticket.id]; return next })
      setNotice(t('electricity.issueStatusUpdated'))
      await loadIssues()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('electricity.issueSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const meterLabel = (meterId: string) => {
    const meter = meters.find((item) => item.id === meterId)
    if (!meter) return t('electricity.meters')
    return meter.meter_kind === 'floor_main' ? meter.floor_label : `${meter.tenant_name} · ${meter.unit_name || meter.floor_label}`
  }

  const fieldClass = 'input min-h-12 w-full'
  return <section className="space-y-5" aria-labelledby="issues-heading">
    <header className="border-b border-slate-200 pb-3">
      <h2 id="issues-heading" className="text-lg font-semibold text-slate-950">{t('electricity.issuesTitle')}</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">{t('electricity.issuesIntro')}</p>
    </header>

    <form onSubmit={handleCreate} className="space-y-4 border border-slate-200 bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-slate-950">{t('electricity.openIssue')}</h3>
      <label className="block text-sm font-medium text-slate-700">{t('electricity.issueMeter')}
        <select required className={`${fieldClass} mt-1`} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">{t('electricity.selectMeter')}</option>
          {meters.map((meter) => <option key={meter.id} value={meter.id}>{meterLabel(meter.id)}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="block text-sm font-medium text-slate-700">{t('electricity.issueTitle')}
          <input required minLength={3} maxLength={160} className={`${fieldClass} mt-1`} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="block text-sm font-medium text-slate-700">{t('electricity.issuePriority')}
          <select className={`${fieldClass} mt-1`} value={priority} onChange={(event) => setPriority(event.target.value as IssuePriority)}>
            {priorities.map((item) => <option key={item} value={item}>{t(priorityLabel[item])}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">{t('electricity.issueDescription')}
        <textarea required minLength={3} maxLength={3000} rows={3} className={`${fieldClass} mt-1`} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <button type="submit" className="btn-primary min-h-12 w-full sm:w-auto" disabled={saving || meters.length === 0 || !accountId || title.trim().length < 3 || description.trim().length < 3}>
        {saving ? <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" /> : <Send className="mr-2 inline h-4 w-4" />}{t('electricity.issueSubmit')}
      </button>
    </form>

    {(error || notice) && <div role={error ? 'alert' : 'status'} className={`border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</div>}

    <section className="space-y-3" aria-label={t('electricity.issuesTitle')}>
      {loading ? <p className="flex items-center gap-2 py-6 text-sm text-slate-600"><LoaderCircle className="h-4 w-4 animate-spin" />{t('electricity.loading')}</p>
        : data.issues.length === 0 ? <p className="border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">{t('electricity.issueNoTickets')}</p>
          : data.issues.map((issue) => {
            const comments = data.comments.filter((item) => item.ticket_id === issue.id)
            const events = data.events.filter((item) => item.ticket_id === issue.id)
            const status = statusDrafts[issue.id] || issue.status
            const needsResolution = status === 'resolved' || status === 'closed'
            const availableStatuses = statuses.filter((item) => item !== 'closed' || issue.status === 'resolved' || issue.status === 'closed')
            return <article key={issue.id} className="border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{issue.title}</h3>
                    <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">{t(statusLabel[issue.status])}</span>
                    <span className={`border px-2 py-1 text-xs font-semibold ${issue.priority === 'urgent' || issue.priority === 'high' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{t(priorityLabel[issue.priority])}</span>
                  </div>
                  <p className="mt-1 break-words text-sm text-slate-600">{meterLabel(issue.account_id)}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('electricity.issueOpenedBy')} {issue.opened_by_name} · {timeLabel(issue.created_at)}</p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-800">{issue.description}</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-sky-50 text-sky-800"><TicketCheck className="h-5 w-5" /></span>
              </div>

              {events.length > 0 && <ol className="mt-4 space-y-2 border-l-2 border-slate-200 pl-4">
                {events.map((event) => <li key={event.id} className="text-xs text-slate-600">
                  <strong className="text-slate-800">{event.actor_name}</strong> · {event.new_status ? t(statusLabel[event.new_status as IssueStatus]) : t('electricity.openIssue')} · {timeLabel(event.performed_at)}
                  {event.details && <p className="mt-1 whitespace-pre-wrap break-words">{event.details}</p>}
                </li>)}
              </ol>}

              {issue.resolution && <div className="mt-3 border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"><strong>{t('electricity.issueResolution')}:</strong> {issue.resolution}</div>}

              <section className="mt-4 border-t border-slate-200 pt-3" aria-label={t('electricity.issueComments')}>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><MessageSquareText className="h-4 w-4" />{t('electricity.issueComments')}</h4>
                {comments.length === 0 ? <p className="pb-2 text-xs text-slate-500">{t('electricity.issueNoComments')}</p> : <ol className="mb-3 space-y-2">
                  {comments.map((comment) => <li key={comment.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                    <p className="flex flex-wrap justify-between gap-1 text-xs text-slate-500"><strong className="text-slate-800">{comment.author_name}</strong><time>{timeLabel(comment.created_at)}</time></p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">{comment.body}</p>
                  </li>)}
                </ol>}
                <form onSubmit={(event) => void handleComment(event, issue.id)} className="space-y-2">
                  <label className="sr-only" htmlFor={`issue-comment-${issue.id}`}>{t('electricity.issueComment')}</label>
                  <textarea id={`issue-comment-${issue.id}`} maxLength={2000} rows={2} className={fieldClass} placeholder={t('electricity.issueComment')} value={commentDrafts[issue.id] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [issue.id]: event.target.value }))} />
                  <button type="submit" className="btn-secondary min-h-12 w-full sm:w-auto" disabled={saving || !(commentDrafts[issue.id] || '').trim()}><MessageSquareText className="mr-2 inline h-4 w-4" />{t('electricity.issueSendComment')}</button>
                </form>
              </section>

              {ownerMode ? <form onSubmit={(event) => void handleStatus(event, issue)} className="mt-4 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-[minmax(12rem,0.5fr)_minmax(0,1fr)_auto] sm:items-end">
                <label className="block text-sm font-medium text-slate-700">{t('electricity.issueStatus')}
                  <select className={fieldClass} value={status} onChange={(event) => setStatusDrafts((current) => ({ ...current, [issue.id]: event.target.value as IssueStatus }))}>
                    {availableStatuses.map((item) => <option key={item} value={item}>{t(statusLabel[item])}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">{t('electricity.issueResolution')}
                  <textarea rows={2} maxLength={3000} className={fieldClass} required={needsResolution} value={resolutionDrafts[issue.id] ?? issue.resolution ?? ''} onChange={(event) => setResolutionDrafts((current) => ({ ...current, [issue.id]: event.target.value }))} />
                </label>
                <button type="submit" className="btn-primary min-h-12 w-full sm:w-auto" disabled={saving || (needsResolution && (resolutionDrafts[issue.id] ?? issue.resolution ?? '').trim().length < 3)}><Check className="mr-2 inline h-4 w-4" />{t('electricity.issueSaveStatus')}</button>
              </form> : <p className="mt-3 text-xs text-slate-500">{t('electricity.issueOwnerOnly')}</p>}
            </article>
          })}
    </section>
  </section>
}
