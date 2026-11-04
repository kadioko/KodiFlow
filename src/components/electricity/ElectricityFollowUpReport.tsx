'use client'

import { useMemo, useState } from 'react'
import { Download, RefreshCw, Share2 } from 'lucide-react'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import { buildElectricityFollowUp, getFollowUpAction, totalNegativeClientBalances, type FollowUpAccount, type FollowUpAction, type FollowUpPriority } from '@/lib/electricity/follow-up-report'
import { formatDate } from '@/utils/currency'
import type { TranslationKey } from '@/utils/i18n'

const todayInNairobi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())

const unitsFormatter = new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 3 })
const priorityKeys: Record<FollowUpPriority, TranslationKey> = {
  urgent: 'electricity.followUpUrgent', low: 'electricity.followUpLow',
  soon: 'electricity.followUpSoon', review: 'electricity.followUpReview',
}
const actionKeys: Record<FollowUpAction, TranslationKey> = {
  check: 'electricity.followUpCheckFirst', top_up: 'electricity.followUpAskTopup',
  remind_soon: 'electricity.followUpRemindSoon',
}

export function ElectricityFollowUpReport({ accounts, property, propertyId, incomplete, onRefresh }: {
  accounts: FollowUpAccount[]
  property: string
  propertyId: string
  incomplete: boolean
  onRefresh: () => Promise<void>
}) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [visibleCount, setVisibleCount] = useState(8)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const today = todayInNairobi()
  const items = useMemo(() => buildElectricityFollowUp(accounts, today), [accounts, today])
  const totalNegativeUnits = useMemo(() => totalNegativeClientBalances(items), [items])

  const generate = async (share: boolean) => {
    if (busy || incomplete) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/electricity', { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not refresh electricity data')
      const fresh = await response.json() as { accounts: FollowUpAccount[]; coverageDataTruncated: boolean; properties: { id: string }[] }
      if (fresh.coverageDataTruncated) {
        setMessage({ error: true, text: t('electricity.followUpIncomplete') })
        return
      }
      if (!fresh.properties.some((item) => item.id === propertyId)) throw new Error('Property is no longer available')
      const currentDate = todayInNairobi()
      const currentItems = buildElectricityFollowUp(fresh.accounts.filter((account) => account.property_id === propertyId), currentDate)
      if (!currentItems.length) {
        setMessage({ error: false, text: t('electricity.followUpEmpty') })
        return
      }
      const { createElectricityFollowUpPdf } = await import('@/lib/electricity/follow-up-pdf')
      const result = await createElectricityFollowUpPdf(property, currentItems, currentDate, {
        title: t('electricity.followUpTitle'),
        generated: t('electricity.followUpGenerated'),
        clients: t('electricity.followUpClients'),
        unitsLeft: t('electricity.followUpUnitsLeft'),
        unitsOwed: t('electricity.followUpOwes'),
        totalNegativeUnits: t('electricity.totalNegativeUnits'),
        totalNegativeUnitsHelp: t('electricity.totalNegativeUnitsHelp'),
        totalNegativeUnitsPartial: t('electricity.totalNegativeUnitsPartial'),
        actionLabel: t('electricity.followUpAction'),
        lastReading: t('electricity.followUpLastReading'),
        unknown: t('electricity.followUpUnknown'),
        stale: t('electricity.followUpStale'),
        unconfirmed: t('electricity.followUpUnconfirmed'),
        disclaimer: t('electricity.followUpDisclaimer'),
        priority: {
          urgent: t('electricity.followUpUrgent'),
          low: t('electricity.followUpLow'),
          soon: t('electricity.followUpSoon'),
          review: t('electricity.followUpReview'),
        },
        action: {
          check: t('electricity.followUpCheckFirst'),
          top_up: t('electricity.followUpAskTopup'),
          remind_soon: t('electricity.followUpRemindSoon'),
        },
      })
      if (share && navigator.share && navigator.canShare?.({ files: [result.file] })) {
        try {
          await navigator.share({ title: t('electricity.followUpTitle'), files: [result.file] })
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (!(error instanceof DOMException && error.name === 'NotAllowedError') && !(error instanceof TypeError)) throw error
          result.pdf.save(result.fileName)
          setMessage({ error: false, text: t('electricity.followUpShareFallback') })
        }
      } else {
        result.pdf.save(result.fileName)
        setMessage({ error: false, text: t(share ? 'electricity.followUpShareFallback' : 'electricity.followUpDownloaded') })
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessage({ error: true, text: t('electricity.followUpError') })
      }
    } finally {
      setBusy(false)
    }
  }

  return <section aria-labelledby="electricity-follow-up-heading" className="border-y border-slate-200 bg-white px-4 py-4 sm:px-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 id="electricity-follow-up-heading" className="font-semibold text-slate-950">{t('electricity.followUpTitle')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('electricity.followUpHelp')} {items.length} {t('electricity.followUpClients')}.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-secondary min-h-11" disabled={busy || refreshing} onClick={() => {
          setRefreshing(true)
          void onRefresh().finally(() => setRefreshing(false))
        }}><RefreshCw className="mr-2 h-4 w-4" />{t(refreshing ? 'electricity.followUpRefreshing' : 'electricity.followUpRefresh')}</button>
        <button type="button" className="btn-primary min-h-11" disabled={busy || incomplete} onClick={() => void generate(true)}><Share2 className="mr-2 h-4 w-4" />{busy ? t('electricity.followUpPreparing') : t('electricity.followUpShare')}</button>
        <button type="button" className="btn-secondary min-h-11" disabled={busy || incomplete} onClick={() => void generate(false)}><Download className="mr-2 h-4 w-4" />{t('electricity.followUpDownload')}</button>
      </div>
    </div>
    {incomplete && <p role="alert" className="mt-3 text-sm font-medium text-rose-800">{t('electricity.followUpIncomplete')}</p>}
    {!incomplete && !items.length && <p className="mt-3 text-sm text-slate-600">{t('electricity.followUpEmpty')}</p>}
    {items.length > 0 && <>
      <p className="mt-4 text-xs text-slate-600">{t('electricity.followUpListNote')}</p>
      <ol className="mt-2 divide-y divide-slate-200 border-y border-slate-200">
        {items.slice(0, visibleCount).map((item) => <li key={item.id} className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-semibold text-slate-950">{item.client || t('electricity.followUpUnknown')}</h3>
            <span className={`border px-2 py-1 text-xs font-semibold ${item.priority === 'urgent' || item.priority === 'low' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{t(priorityKeys[item.priority])}</span>
          </div>
          <p className="mt-1 break-words text-sm text-slate-600">{item.location}</p>
          <div className="mt-2"><p className="text-xs font-semibold text-slate-600">{t(item.balance !== null && item.balance < 0 ? 'electricity.followUpOwes' : 'electricity.followUpUnitsLeft')}</p><p className={`mt-1 break-all tabular-nums ${item.balance !== null && item.balance < 0 ? 'text-3xl font-extrabold text-rose-700' : 'text-lg font-bold text-slate-900'}`}>{item.balance === null ? t('electricity.followUpUnknown') : `${unitsFormatter.format(item.balance)} kWh`}</p><p className="mt-1 text-xs text-slate-600">{t('electricity.followUpLastReading')}: {item.readingDate ? formatDate(item.readingDate) : t('electricity.followUpUnknown')}</p></div>
          <p className="mt-1 text-sm font-medium text-slate-900">{t('electricity.followUpAction')}: {t(actionKeys[getFollowUpAction(item)])}</p>
          {item.readingNeedsCheck && <p className="mt-1 text-xs text-amber-800">{t('electricity.followUpStale')}</p>}
          {item.unconfirmedTopup && <p className="mt-1 text-xs text-amber-800">{t('electricity.followUpUnconfirmed')}</p>}
        </li>)}
      </ol>
      {visibleCount < items.length && <button type="button" className="btn-secondary mt-3 min-h-11" onClick={() => setVisibleCount((count) => count + 8)}>{t('electricity.followUpShowMore')}</button>}
    </>}
    <div className="mt-4 border-l-4 border-rose-600 bg-rose-50 px-3 py-3" aria-label={t('electricity.totalNegativeUnits')}>
      <p className="text-sm font-semibold text-rose-950">{t('electricity.totalNegativeUnits')}</p>
      <p className="mt-1 break-all text-3xl font-extrabold tabular-nums text-rose-700">{unitsFormatter.format(totalNegativeUnits)} kWh</p>
      <p className="mt-1 text-xs text-rose-900">{t('electricity.totalNegativeUnitsHelp')}</p>
      {(incomplete || items.some((item) => item.balance === null)) && <p className="mt-1 text-xs font-bold text-rose-900">{t('electricity.totalNegativeUnitsPartial')}</p>}
    </div>
    {message && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-sm ${message.error ? 'text-rose-800' : 'text-emerald-800'}`}>{message.text}</p>}
  </section>
}
