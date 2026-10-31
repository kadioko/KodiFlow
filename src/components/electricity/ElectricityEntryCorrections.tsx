'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Check, LoaderCircle, Pencil, RotateCcw, X } from 'lucide-react'
import type { Database, Json } from '@/lib/supabase/database.types'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import type { TranslationKey } from '@/utils/i18n'

export type ElectricityEntryType = 'reading' | 'topup' | 'main_balance' | 'adjustment' | 'cutoff'
type EntryAuditRow = Database['public']['Tables']['electricity_entry_audit']['Row'] & { actor_name: string }
export type EditorField = {
  name: string
  label: TranslationKey
  type: 'date' | 'number' | 'text' | 'textarea' | 'select'
  value: string | number | null
  min?: string
  max?: string
  step?: string
  options?: { value: string; label: TranslationKey }[]
  required?: boolean
}
export type CorrectableEntry = {
  id: string
  entryType: ElectricityEntryType
  accountId: string
  accountLabel: string
  occurredAt: string
  recordedBy: string
  summary: string
  fields: EditorField[]
}

const typeLabel: Record<ElectricityEntryType, TranslationKey> = {
  reading: 'electricity.entryTypeReading',
  topup: 'electricity.entryTypeTopup',
  main_balance: 'electricity.entryTypeMainBalance',
  adjustment: 'electricity.entryTypeAdjustment',
  cutoff: 'electricity.entryTypeCutoff',
}
const actionLabel: Record<EntryAuditRow['action'], TranslationKey> = {
  confirmed: 'electricity.entryActionConfirmed',
  edited: 'electricity.entryActionEdited',
  reversed: 'electricity.entryActionReversed',
}

const dateTime = (value: string) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Nairobi',
}).format(new Date(value))

function snapshot(value: Json) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json> : {}
}

function friendlyValue(value: Json | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function ElectricityEntryCorrections({ entries, audit, ownerMode, onChanged }: {
  entries: CorrectableEntry[]
  audit: EntryAuditRow[]
  ownerMode: boolean
  onChanged: () => void
}) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState<CorrectableEntry | null>(null)
  const [reverseMode, setReverseMode] = useState(false)
  const [changes, setChanges] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | ElectricityEntryType>('all')
  const filteredEntries = useMemo(() => entries
    .filter((entry) => typeFilter === 'all' || entry.entryType === typeFilter)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)), [entries, typeFilter])

  const openEditor = (entry: CorrectableEntry, reverse = false) => {
    setSelected(entry)
    setReverseMode(reverse)
    setReason('')
    setError('')
    setChanges(Object.fromEntries(entry.fields.map((field) => [field.name, field.value === null ? '' : String(field.value)])))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/electricity/entries', {
        method: reverseMode ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryType: selected.entryType,
          entryId: selected.id,
          action: reverseMode ? 'reverse' : 'edit',
          changes: reverseMode ? {} : changes,
          reason,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || t('electricity.requestFailed'))
      setNotice(t(reverseMode ? 'electricity.entryReversed' : 'electricity.entryCorrected'))
      setSelected(null)
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('electricity.requestFailed'))
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'input min-h-12 w-full'
  return <section className="space-y-5" aria-labelledby="entry-history-heading">
    <header className="border-b border-slate-200 pb-3">
      <h2 id="entry-history-heading" className="text-lg font-semibold text-slate-950">{t('electricity.entryHistoryTitle')}</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">{t('electricity.entryHistoryHelp')}</p>
    </header>

    {notice && <p role="status" className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
    {error && !selected && <p role="alert" className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}

    <section className="space-y-3" aria-label={t('electricity.entryHistoryTitle')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold text-slate-900">{t('electricity.editEntry')}</h3>
        <label className="text-sm font-medium text-slate-700">{t('electricity.entryType')}
          <select className="input ml-2 min-h-12 max-w-full sm:min-w-48" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
            <option value="all">{t('electricity.allEntries')}</option>
            {(Object.keys(typeLabel) as ElectricityEntryType[]).map((item) => <option key={item} value={item}>{t(typeLabel[item])}</option>)}
          </select>
        </label>
      </div>
      {filteredEntries.length === 0 ? <p className="border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">{t('electricity.noEditableEntries')}</p> : <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
        {filteredEntries.slice(0, 100).map((entry) => <article key={`${entry.entryType}-${entry.id}`} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">{t(typeLabel[entry.entryType])}</span><time className="text-xs text-slate-500">{dateTime(entry.occurredAt)}</time></div>
            <p className="mt-1 break-words font-medium text-slate-900">{entry.summary}</p>
            <p className="mt-1 break-words text-xs text-slate-600">{entry.accountLabel} · {t('electricity.entryCreatedBy')} {entry.recordedBy}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(ownerMode || entry.entryType !== 'adjustment') && <button type="button" className="btn-secondary min-h-12 w-full sm:w-auto" onClick={() => openEditor(entry)}><Pencil className="mr-2 inline h-4 w-4" />{t('electricity.editEntry')}</button>}
            {ownerMode && <button type="button" className="btn-danger min-h-12 w-full sm:w-auto" onClick={() => openEditor(entry, true)}><RotateCcw className="mr-2 inline h-4 w-4" />{t('electricity.reverseEntry')}</button>}
          </div>
        </article>)}
      </div>}
    </section>

    <section className="space-y-3" aria-labelledby="entry-audit-heading">
      <h3 id="entry-audit-heading" className="font-semibold text-slate-900">{t('electricity.activityTimeline')}</h3>
      {audit.length === 0 ? <p className="border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">{t('electricity.noEntryHistory')}</p> : <ol className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
        {audit.slice(0, 100).map((item) => {
          const previous = snapshot(item.previous_values)
          const next = snapshot(item.new_values)
          const changedKeys = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]))
            .filter((key) => !['id', 'owner_user_id', 'account_id', 'recorded_by', 'created_at', 'applied_reading_id'].includes(key) && JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
          return <li key={item.id} className="px-4 py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><p className="font-medium text-slate-900">{t(actionLabel[item.action])} · {t(typeLabel[item.entry_type])}</p><time className="text-xs text-slate-500">{dateTime(item.acted_at)}</time></div>
            <p className="mt-1 break-words text-sm text-slate-700">{item.actor_name} · {entries.find((entry) => entry.accountId === item.account_id)?.accountLabel || item.account_id}</p>
            {item.reason && <p className="mt-1 break-words text-sm text-slate-600">{item.reason}</p>}
            {changedKeys.length > 0 && <details className="mt-2 text-xs text-slate-700"><summary className="min-h-10 cursor-pointer py-2 font-medium">{t('electricity.entryValuesChanged')}</summary><dl className="space-y-2 pl-2">
              {changedKeys.map((key) => <div key={key} className="grid gap-1 border-l-2 border-slate-200 pl-3 sm:grid-cols-[minmax(9rem,0.4fr)_1fr_1fr]">
                <dt className="font-semibold">{key.replaceAll('_', ' ')}</dt><dd className="break-all"><span className="text-slate-500">{t('electricity.before')}: </span>{friendlyValue(previous[key])}</dd><dd className="break-all"><span className="text-slate-500">{t('electricity.after')}: </span>{friendlyValue(next[key])}</dd>
              </div>)}
            </dl></details>}
          </li>
        })}
      </ol>}
    </section>

    {selected && <div className="mobile-dialog-overlay fixed inset-0 z-50 bg-slate-950/50" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelected(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="entry-dialog-heading" className="mobile-dialog-panel w-full max-w-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div><h3 id="entry-dialog-heading" className="font-semibold text-slate-950">{t(reverseMode ? 'electricity.reverseEntry' : 'electricity.editEntry')} · {t(typeLabel[selected.entryType])}</h3><p className="mt-1 text-sm text-slate-600">{selected.accountLabel} · {selected.summary}</p></div>
          <button type="button" className="icon-button" aria-label={t('electricity.cancel')} onClick={() => setSelected(null)} disabled={saving}><X className="h-4 w-4" /></button>
        </header>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {!reverseMode && <div className="grid gap-3 sm:grid-cols-2">
            {selected.fields.map((field) => <label key={field.name} className="block text-sm font-medium text-slate-700">{t(field.label)}
              {field.type === 'textarea' ? <textarea rows={3} maxLength={500} className={`${inputClass} mt-1`} value={changes[field.name] ?? ''} onChange={(event) => setChanges((current) => ({ ...current, [field.name]: event.target.value }))} />
                : field.type === 'select' ? <select className={`${inputClass} mt-1`} value={changes[field.name] ?? ''} onChange={(event) => setChanges((current) => ({ ...current, [field.name]: event.target.value }))}>{field.options?.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select>
                  : <input required={field.required ?? field.type !== 'text'} type={field.type} inputMode={field.type === 'number' ? 'decimal' : undefined} min={field.min} max={field.max} step={field.step} maxLength={field.type === 'text' ? 20 : undefined} className={`${inputClass} mt-1`} value={changes[field.name] ?? ''} onChange={(event) => setChanges((current) => ({ ...current, [field.name]: event.target.value }))} />}
            </label>)}
          </div>}
          {reverseMode && <p className="border-l-4 border-rose-500 bg-rose-50 px-3 py-2 text-sm text-rose-900">{t('electricity.reverseEntryWarning')}</p>}
          <label className="block text-sm font-medium text-slate-700">{t('electricity.correctionReason')}
            <textarea required minLength={3} maxLength={500} rows={3} className={`${inputClass} mt-1`} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          {error && <p role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <footer className="grid gap-2 sm:flex sm:justify-end">
            {!reverseMode && ownerMode && <button type="button" className="btn-danger min-h-12 w-full sm:mr-auto sm:w-auto" onClick={() => { setReverseMode(true); setReason(''); setError('') }}><RotateCcw className="mr-2 inline h-4 w-4" />{t('electricity.reverseEntry')}</button>}
            <button type="button" className="btn-secondary min-h-12 w-full sm:w-auto" onClick={() => setSelected(null)} disabled={saving}>{t('electricity.cancel')}</button>
            <button type="submit" className={reverseMode ? 'btn-danger min-h-12 w-full sm:w-auto' : 'btn-primary min-h-12 w-full sm:w-auto'} disabled={saving || reason.trim().length < 3}>
              {saving ? <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" /> : reverseMode ? <RotateCcw className="mr-2 inline h-4 w-4" /> : <Check className="mr-2 inline h-4 w-4" />}
              {t(reverseMode ? 'electricity.confirmReverse' : 'electricity.saveCorrection')}
            </button>
          </footer>
        </form>
      </section>
    </div>}
  </section>
}
