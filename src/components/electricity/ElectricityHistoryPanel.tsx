'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Search, X } from 'lucide-react'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import type { ElectricityHistoryRecord, ElectricityHistoryType } from '@/lib/electricity/history'
import { formatCurrency, formatDate } from '@/utils/currency'
import type { TranslationKey } from '@/utils/i18n'

type MeterOption = {
  id: string
  meter_kind: 'submeter' | 'floor_main'
  floor_label: string
  tenant_name: string
  unit_name: string | null
}
type HistoryResponse = { rows: ElectricityHistoryRecord[]; total: number; page: number; pageSize: number }

const historyTypeLabels: Record<ElectricityHistoryType, TranslationKey> = {
  topups: 'electricity.historyLukuPurchases',
  readings: 'electricity.historySubmeterReadings',
  main_balances: 'electricity.historyMainBalances',
  adjustments: 'electricity.historyAdjustments',
  cutoff: 'electricity.historyCutoff',
  audit: 'electricity.historyCorrections',
}

const timestamp = (value: string) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Nairobi',
}).format(new Date(value))

const display = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value)
const units = (value: unknown) => value === null || value === undefined ? '—' : `${Number(value).toLocaleString('en-TZ', { maximumFractionDigits: 3 })} kWh`

export function ElectricityHistoryPanel({ propertyId, meters }: { propertyId: string; meters: MeterOption[] }) {
  const { t } = useLanguage()
  const [type, setType] = useState<ElectricityHistoryType>('topups')
  const [accountId, setAccountId] = useState('')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<HistoryResponse>({ rows: [], total: 0, page: 1, pageSize: 40 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(() => new Set())
  const [copiedToken, setCopiedToken] = useState('')

  const loadHistory = useCallback(async (signal: AbortSignal) => {
    if (!propertyId) return
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ propertyId, type, page: String(page), status })
    if (meters.some((meter) => meter.id === accountId)) params.set('accountId', accountId)
    if (search.trim()) params.set('search', search.trim())
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    try {
      const response = await fetch(`/api/electricity/history?${params}`, { cache: 'no-store', signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || t('electricity.historyLoadFailed'))
      if (!signal.aborted) setData(result as HistoryResponse)
    } catch (caught) {
      if (!signal.aborted) setError(caught instanceof Error ? caught.message : t('electricity.historyLoadFailed'))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [accountId, fromDate, meters, page, propertyId, search, status, t, toDate, type])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => { void loadHistory(controller.signal) }, search.trim() ? 250 : 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [loadHistory, search])

  useEffect(() => {
    setAccountId('')
    setPage(1)
  }, [propertyId])

  const statusOptions = useMemo(() => {
    if (type === 'topups') return [
      ['all', 'electricity.historyAnyStatus'],
      ['reported', 'electricity.reported'],
      ['verified', 'electricity.verified'],
      ['reversed', 'electricity.historyReversed'],
    ] as const
    if (type === 'audit') return [
      ['all', 'electricity.historyAnyStatus'],
      ['confirmed', 'electricity.entryActionConfirmed'],
      ['edited', 'electricity.entryActionEdited'],
      ['reversed', 'electricity.entryActionReversed'],
    ] as const
    return [
      ['all', 'electricity.historyAnyStatus'],
      ['active', 'electricity.historyActive'],
      ['reversed', 'electricity.historyReversed'],
    ] as const
  }, [type])

  const clearFilters = () => {
    setAccountId('')
    setSearch('')
    setFromDate('')
    setToDate('')
    setStatus('all')
    setPage(1)
  }

  const accountLabel = (id: string) => {
    const meter = meters.find((item) => item.id === id)
    if (!meter) return t('electricity.meters')
    return meter.meter_kind === 'floor_main'
      ? `${meter.floor_label} · ${t('electricity.mainMeter')}`
      : `${meter.tenant_name} · ${meter.unit_name || meter.floor_label}`
  }

  const toggleToken = (id: string) => setVisibleTokens((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const copyToken = async (id: string, token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      setCopiedToken(id)
      window.setTimeout(() => setCopiedToken(''), 1800)
    } catch {
      setError(t('electricity.historyCopyFailed'))
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const inputClass = 'input min-h-12 w-full'

  return <section className="space-y-5" aria-labelledby="electricity-history-heading">
    <header className="border-b border-slate-200 pb-3">
      <h2 id="electricity-history-heading" className="text-lg font-semibold text-slate-950">{t('electricity.historyTitle')}</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">{t('electricity.historyIntro')}</p>
    </header>

    <section className="space-y-3 border-y border-slate-200 bg-white p-4 sm:p-5" aria-label={t('electricity.historyFilters')}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700">{t('electricity.historyType')}
          <select className={`${inputClass} mt-1`} value={type} onChange={(event) => { setType(event.target.value as ElectricityHistoryType); setStatus('all'); setPage(1) }}>
            {(Object.keys(historyTypeLabels) as ElectricityHistoryType[]).map((item) => <option key={item} value={item}>{t(historyTypeLabels[item])}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">{t('electricity.historyMeter')}
          <select className={`${inputClass} mt-1`} value={accountId} onChange={(event) => { setAccountId(event.target.value); setPage(1) }}>
            <option value="">{t('electricity.historyAllMeters')}</option>
            {meters.map((meter) => <option key={meter.id} value={meter.id}>{accountLabel(meter.id)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">{t('electricity.historyStatus')}
          <select className={`${inputClass} mt-1`} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">{t('electricity.historySearch')}
          <span className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" className={`${inputClass} pl-10`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={t(type === 'topups' ? 'electricity.historySearchLuku' : 'electricity.historySearchNote')} /></span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-700">{t('electricity.fromDate')}<input className={`${inputClass} mt-1`} type="date" value={fromDate} max={toDate || undefined} onChange={(event) => { setFromDate(event.target.value); setPage(1) }} /></label>
          <label className="block text-sm font-medium text-slate-700">{t('electricity.toDate')}<input className={`${inputClass} mt-1`} type="date" value={toDate} min={fromDate || undefined} onChange={(event) => { setToDate(event.target.value); setPage(1) }} /></label>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">{t('electricity.historySearchHelp')}</p>
        <button type="button" className="btn-secondary min-h-12 w-full sm:w-auto" onClick={clearFilters}><X className="mr-2 inline h-4 w-4" />{t('electricity.historyClearFilters')}</button>
      </div>
    </section>

    {error && <p role="alert" className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <h3 className="font-semibold text-slate-900">{t(historyTypeLabels[type])}</h3>
      <span aria-live="polite" className="text-slate-600">{loading ? t('electricity.loading') : `${data.total.toLocaleString()} ${t('electricity.historyRecords')}`}</span>
    </div>

    {loading ? <p className="py-8 text-center text-sm text-slate-600">{t('electricity.loading')}</p>
      : data.rows.length === 0 ? <p className="border-y border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">{t('electricity.historyNoResults')}</p>
        : <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {data.rows.map((record) => {
            const row = record.payload
            const isTopup = record.type === 'topups'
            const isReading = record.type === 'readings'
            const isMainBalance = record.type === 'main_balances'
            const isAdjustment = record.type === 'adjustments'
            const isCutoff = record.type === 'cutoff'
            const isAudit = record.type === 'audit'
            const token = isTopup && typeof row.token_code === 'string' ? row.token_code : ''
            const tokenVisible = visibleTokens.has(record.id)
            const topupStatus = record.reversedAt ? 'reversed' : row.status === 'verified' ? 'verified' : 'reported'
            const auditAction = row.action === 'confirmed' ? 'electricity.entryActionConfirmed' : row.action === 'edited' ? 'electricity.entryActionEdited' : 'electricity.entryActionReversed'
            const auditType = row.entry_type === 'topup' ? 'electricity.entryTypeTopup'
              : row.entry_type === 'reading' ? 'electricity.entryTypeReading'
                : row.entry_type === 'main_balance' ? 'electricity.entryTypeMainBalance'
                  : row.entry_type === 'adjustment' ? 'electricity.entryTypeAdjustment' : 'electricity.entryTypeCutoff'
            const auditNewValues = row.new_values && typeof row.new_values === 'object' && !Array.isArray(row.new_values)
              ? row.new_values as Record<string, unknown>
              : null
            const auditPreviousValues = row.previous_values && typeof row.previous_values === 'object' && !Array.isArray(row.previous_values)
              ? row.previous_values as Record<string, unknown>
              : null
            const auditChangedKeys = Array.from(new Set([
              ...Object.keys(auditPreviousValues || {}),
              ...Object.keys(auditNewValues || {}),
            ])).filter((key) => !['id', 'owner_user_id', 'account_id', 'recorded_by', 'created_at', 'applied_reading_id', 'token_code'].includes(key)
              && JSON.stringify(auditPreviousValues?.[key]) !== JSON.stringify(auditNewValues?.[key]))
            return <article key={`${record.type}-${record.id}`} className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-slate-950">{accountLabel(record.accountId)}</h4>
                    {isAudit && <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">{t(auditAction)} · {t(auditType)}</span>}
                    {isTopup && <span className={`border px-2 py-1 text-xs font-semibold ${topupStatus === 'verified' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : topupStatus === 'reversed' ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{t(topupStatus === 'verified' ? 'electricity.verified' : topupStatus === 'reversed' ? 'electricity.historyReversed' : 'electricity.reported')}</span>}
                    {!isTopup && !isAudit && record.reversedAt && <span className="border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{t('electricity.historyReversed')}</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t('electricity.historyRecordedBy')} {record.actorName} · {timestamp(record.occurredAt)}</p>
                </div>
              </div>

              {isTopup && <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p><span className="text-slate-500">{t('electricity.purchaseDate')}: </span><strong>{formatDate(display(row.purchase_date))}</strong></p>
                <p><span className="text-slate-500">{t('electricity.unitsPurchased')}: </span><strong>{units(row.units)}</strong></p>
                <p><span className="text-slate-500">{t('electricity.purchaseValueTzs')}: </span><strong>{row.purchase_amount_tzs === null ? '—' : formatCurrency(Number(row.purchase_amount_tzs), 'TZS')}</strong></p>
                {record.confirmedAt && <p className="text-emerald-800"><span>{t('electricity.entryConfirmedBy')} </span><strong>{record.confirmedByName}</strong><span> · {timestamp(record.confirmedAt)}</span></p>}
              </div>}

              {isTopup && token && <div className="flex flex-wrap items-center gap-2">
                <code className="break-all bg-slate-50 px-2 py-1 font-mono text-sm text-slate-900">{tokenVisible ? token : `•••• •••• •••• ${token.slice(-4)}`}</code>
                <button type="button" className="btn-secondary min-h-11" aria-expanded={tokenVisible} onClick={() => toggleToken(record.id)}>{tokenVisible ? <EyeOff className="mr-2 inline h-4 w-4" /> : <Eye className="mr-2 inline h-4 w-4" />}{t(tokenVisible ? 'electricity.hideFullToken' : 'electricity.showFullToken')}</button>
                {tokenVisible && <button type="button" className="icon-button min-h-11 min-w-11" aria-label={t('electricity.copyFullToken')} title={t(copiedToken === record.id ? 'electricity.copied' : 'electricity.copyFullToken')} onClick={() => void copyToken(record.id, token)}><Copy className="h-4 w-4" /></button>}
              </div>}

              {isReading && <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p><span className="text-slate-500">{t('electricity.readingDate')}: </span><strong>{formatDate(display(row.reading_date))}</strong></p>
                <p><span className="text-slate-500">{t('electricity.previousReading')}: </span><strong>{units(row.previous_meter_reading)}</strong></p>
                <p><span className="text-slate-500">{t('electricity.currentReading')}: </span><strong>{units(row.current_meter_reading)}</strong></p>
                <p><span className="text-slate-500">{t('electricity.unitsConsumed')}: </span><strong>{units(row.usage_units)}</strong></p>
                <p><span className="text-slate-500">{t('electricity.carriedForward')}: </span><strong>{units(row.closing_balance_units)}</strong></p>
                {typeof row.notes === 'string' && row.notes && <p className="whitespace-pre-wrap break-words sm:col-span-2 lg:col-span-3"><span className="text-slate-500">{t('electricity.noteOptional')}: </span>{row.notes}</p>}
              </div>}

              {isMainBalance && <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p><span className="text-slate-500">{t('electricity.readingDate')}: </span><strong>{formatDate(display(row.reading_date))}</strong></p>
                <p><span className="text-slate-500">{t('electricity.unitsRemainingOnMain')}: </span><strong>{units(row.units_remaining)}</strong></p>
                <p><span className="text-slate-500">{t('electricity.unitsAddedSincePrevious')}: </span><strong>{units(row.units_purchased_since_previous)}</strong></p>
                {typeof row.notes === 'string' && row.notes && <p className="whitespace-pre-wrap break-words"><span className="text-slate-500">{t('electricity.noteOptional')}: </span>{row.notes}</p>}
              </div>}

              {isAdjustment && <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <p><span className="text-slate-500">{t('electricity.adjustmentDate')}: </span><strong>{formatDate(display(row.adjustment_date))}</strong></p>
                <p><span className="text-slate-500">{t('electricity.adjustmentAmount')}: </span><strong>{Number(row.adjustment_units) > 0 ? '+' : ''}{units(row.adjustment_units)}</strong></p>
                <p><span className="text-slate-500">{t('electricity.adjustmentStatus')}: </span>{row.applied_reading_id ? t('electricity.adjustmentApplied') : t('electricity.adjustmentPending')}</p>
                <p className="whitespace-pre-wrap break-words sm:col-span-2 lg:col-span-3">{display(row.reason)}</p>
              </div>}

              {isCutoff && <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <p><span className="text-slate-500">{t('electricity.manualAction')}: </span><strong>{t(row.action === 'disconnected' ? 'electricity.disconnected' : 'electricity.powerRestoration')}</strong></p>
                <p><span className="text-slate-500">{t('electricity.readingOptional')}: </span><strong>{row.meter_reading === null ? '—' : units(row.meter_reading)}</strong></p>
                <p className="whitespace-pre-wrap break-words">{display(row.reason)}</p>
              </div>}

              {isAudit && <div className="space-y-2 text-sm">
                {typeof row.reason === 'string' && <p className="whitespace-pre-wrap break-words">{row.reason}</p>}
                {row.action === 'confirmed' && typeof auditNewValues?.verified_at === 'string' && <p className="text-emerald-800">{t('electricity.entryConfirmedBy')} {record.actorName} · {timestamp(auditNewValues.verified_at)}</p>}
                {auditChangedKeys.length > 0 && <details className="text-xs text-slate-700"><summary className="min-h-11 cursor-pointer py-2 font-medium">{t('electricity.entryValuesChanged')}</summary><dl className="space-y-2 pl-2">
                  {auditChangedKeys.map((key) => <div key={key} className="grid gap-1 border-l-2 border-slate-200 pl-3 sm:grid-cols-[minmax(8rem,0.4fr)_1fr_1fr]">
                    <dt className="font-semibold">{key.replaceAll('_', ' ')}</dt>
                    <dd className="break-all"><span className="text-slate-500">{t('electricity.before')}: </span>{display(auditPreviousValues?.[key])}</dd>
                    <dd className="break-all"><span className="text-slate-500">{t('electricity.after')}: </span>{display(auditNewValues?.[key])}</dd>
                  </div>)}
                </dl></details>}
              </div>}

              {record.reversedAt && <p className="border-l-2 border-slate-400 bg-slate-50 px-3 py-2 text-sm text-slate-700">{t('electricity.historyReversedBy')} {record.reversedByName} · {timestamp(record.reversedAt)}{record.reversalReason ? ` · ${record.reversalReason}` : ''}</p>}
            </article>
          })}
        </div>}

    <footer className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">{data.total === 0 ? t('electricity.historyNoResults') : `${(page - 1) * data.pageSize + 1}-${Math.min(page * data.pageSize, data.total)} / ${data.total.toLocaleString()}`}</p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <button type="button" className="btn-secondary min-h-12" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="mr-2 inline h-4 w-4" />{t('electricity.historyPrevious')}</button>
        <button type="button" className="btn-secondary min-h-12" disabled={loading || page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{t('electricity.historyNext')}<ChevronRight className="ml-2 inline h-4 w-4" /></button>
      </div>
    </footer>
  </section>
}
