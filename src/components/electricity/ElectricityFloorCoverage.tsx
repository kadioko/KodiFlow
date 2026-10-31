'use client'

import { CircleAlert, Gauge, Users } from 'lucide-react'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import type { calculateFloorCreditCoverage, CoverageIssue } from '@/lib/electricity/floor-credit-coverage'
import { formatDate } from '@/utils/currency'
import type { TranslationKey } from '@/utils/i18n'

const issueLabels: Record<CoverageIssue, TranslationKey> = {
  main_missing: 'electricity.coverageMainMissing',
  main_stale: 'electricity.coverageMainStale',
  no_clients: 'electricity.coverageNoClients',
  ambiguous_main: 'electricity.coverageAmbiguous',
  unassigned: 'electricity.coverageUnassignedWarning',
  client_missing: 'electricity.coverageClientMissing',
  client_stale: 'electricity.coverageClientStale',
  dates_differ: 'electricity.coverageDatesDiffer',
  unconfirmed: 'electricity.coverageUnconfirmed',
  negative_clients: 'electricity.coverageNegativeClients',
  truncated: 'electricity.coverageTruncated',
  buffer_missing: 'electricity.coverageBufferMissing',
}
const statusLabels: Record<ReturnType<typeof calculateFloorCreditCoverage>['floors'][number]['status'], TranslationKey> = {
  empty: 'electricity.coverageEmpty',
  shortfall: 'electricity.coverageShortfallStatus',
  needs_review: 'electricity.coverageReview',
  reserve_low: 'electricity.coverageReserveLow',
  covered: 'electricity.coverageCovered',
}
const amount = (value: number | null) => value === null ? '—' : `${value.toLocaleString('en-TZ', { maximumFractionDigits: 3 })} kWh`

export function ElectricityFloorCoverage({ coverage }: { coverage: ReturnType<typeof calculateFloorCreditCoverage> }) {
  const { t } = useLanguage()
  return <section className="border-y border-slate-200 bg-white" aria-labelledby="floor-credit-coverage-heading">
    <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
      <h2 id="floor-credit-coverage-heading" className="text-lg font-semibold text-slate-950">{t('electricity.coverageTitle')}</h2>
      <p className="mt-1 max-w-4xl text-sm text-slate-600">{t('electricity.coverageIntro')}</p>
      <p className="mt-2 max-w-4xl text-xs text-slate-600">{t('electricity.coverageAssignmentNote')}</p>
    </header>
    {coverage.unassignedClients.length > 0 && <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
      <p className="font-semibold">{t('electricity.coverageUnassignedTitle')}</p>
      <p className="mt-1 break-words">{coverage.unassignedClients.map((client) => `${client.tenant_name || client.id.slice(0, 8)} (${client.unit_name || client.floor_label || '—'})`).join(', ')}</p>
      <p className="mt-1 text-xs">{t('electricity.coverageAssignmentNote')}</p>
    </div>}
    {coverage.floors.length === 0 ? <p className="px-4 py-6 text-sm text-slate-600">{t('electricity.addMainMeter')}</p> : <div className="divide-y divide-slate-200">
      {coverage.floors.map((floor) => {
        const urgent = floor.status === 'empty' || floor.status === 'shortfall'
        const statusClass = urgent ? 'border-rose-300 bg-rose-50 text-rose-900'
          : floor.status === 'covered' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'
        const oldestClientDate = floor.clients.map((client) => client.latest_reading?.reading_date || client.initial_reading_date).filter(Boolean).sort()[0]
        return <article key={floor.main.id} className="space-y-3 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><h3 className="break-words font-semibold text-slate-950">{floor.main.floor_label}</h3><p className="mt-1 text-xs text-slate-600">{t('electricity.coverageClientsCount', { count: floor.clients.length })}</p></div>
            <span className={`self-start border px-2 py-1 text-xs font-semibold ${statusClass}`}>{urgent && <CircleAlert className="mr-1 inline h-4 w-4" />}{t(statusLabels[floor.status])}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm lg:grid-cols-5">
            <div><dt className="flex items-center gap-1 text-xs text-sky-800"><Gauge className="h-4 w-4" />{t('electricity.coverageMainCredit')}</dt><dd className="mt-1 text-lg font-bold tabular-nums text-sky-950">{amount(floor.mainRemaining)}</dd><dd className="text-xs text-slate-500">{floor.mainSnapshot ? `${t('electricity.read')} ${formatDate(floor.mainSnapshot.reading_date)}` : t('electricity.noMainBalances')}</dd></div>
            <div><dt className="flex items-center gap-1 text-xs text-emerald-800"><Users className="h-4 w-4" />{t('electricity.coverageClientCredit')}</dt><dd className="mt-1 text-lg font-bold tabular-nums text-emerald-950">{amount(floor.clientCredits)}</dd><dd className="text-xs text-slate-500">{oldestClientDate ? `${t('electricity.coverageOldestClient')} ${formatDate(oldestClientDate)}` : t('electricity.coverageNoClients')}</dd></div>
            <div><dt className="text-xs text-slate-600">{t('electricity.coverageClientShortfall')}</dt><dd className={`mt-1 text-lg font-bold tabular-nums ${floor.clientShortfall && floor.clientShortfall > 0 ? 'text-rose-800' : 'text-slate-900'}`}>{amount(floor.clientShortfall)}</dd></div>
            <div><dt className="text-xs text-slate-600">{t('electricity.coverageReserve')}</dt><dd className="mt-1 text-lg font-bold tabular-nums text-slate-900">{amount(floor.reserve)}</dd></div>
            <div><dt className="text-xs text-slate-600">{t('electricity.coverageTopup')}</dt><dd className={`mt-1 text-lg font-bold tabular-nums ${floor.suggestedTopup && floor.suggestedTopup > 0 ? 'text-rose-800' : 'text-slate-900'}`}>{amount(floor.suggestedTopup)}</dd></div>
          </dl>
          {floor.issues.length > 0 && <div className="border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="font-semibold">{t('electricity.coverageProvisional')}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">{floor.issues.map((issue) => <li key={issue}>{t(issueLabels[issue])}</li>)}</ul>
          </div>}
          {floor.clients.length > 0 && <details className="border-t border-slate-100 pt-2 text-sm">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-slate-700">{t('electricity.coverageViewClients')}</summary>
            <ul className="divide-y divide-slate-100">{floor.clients.map((client) => {
              const date = client.latest_reading?.reading_date || client.initial_reading_date
              return <li key={client.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between"><span className="break-words">{client.tenant_name || client.id.slice(0, 8)} · {client.unit_name || client.floor_label}</span><span className="font-semibold tabular-nums">{client.estimated_balance_units !== null && client.estimated_balance_units !== undefined && Number.isFinite(Number(client.estimated_balance_units)) ? amount(Number(client.estimated_balance_units)) : '—'} <span className="font-normal text-slate-500">· {date ? formatDate(date) : '—'}</span></span></li>
            })}</ul>
          </details>}
        </article>
      })}
    </div>}
    <footer className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600 sm:px-5">{t('electricity.coverageFootnote')}</footer>
  </section>
}
