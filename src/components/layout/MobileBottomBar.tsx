'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Bolt, CreditCard, FilePlus2, FileText, Gauge, LayoutDashboard, Menu, Plus, Receipt, Search, UserPlus, X, type LucideIcon } from 'lucide-react'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import type { TranslationKey } from '@/utils/i18n'

const primaryNavigation = [
  { labelKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { labelKey: 'nav.invoices', href: '/invoices', icon: Receipt },
  { labelKey: 'nav.payments', href: '/payments', icon: CreditCard },
  { labelKey: 'nav.leases', href: '/leases', icon: FileText },
] as const

const quickActions = [
  { labelKey: 'mobile.recordPayment', detailKey: 'mobile.applyPayment', href: '/payments/new', icon: CreditCard, tone: 'bg-success-100 text-success-700' },
  { labelKey: 'mobile.generateInvoices', detailKey: 'mobile.createRentInvoices', href: '/invoices/generate', icon: FilePlus2, tone: 'bg-primary-100 text-primary-700' },
  { labelKey: 'mobile.addTenant', detailKey: 'mobile.createTenant', href: '/tenants/new', icon: UserPlus, tone: 'bg-violet-100 text-violet-700' },
  { labelKey: 'mobile.createLease', detailKey: 'mobile.assignTenant', href: '/leases/new', icon: FileText, tone: 'bg-amber-100 text-amber-700' },
] as const

export function MobileBottomBar({ onOpenMenu, electricityStaff = false }: { onOpenMenu: () => void; electricityStaff?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
  const searchRef = useRef<HTMLInputElement>(null)
  const [showActions, setShowActions] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (showSearch) window.setTimeout(() => searchRef.current?.focus(), 50)
  }, [showSearch])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const term = query.trim()
    if (!term) return
    setShowSearch(false)
    router.push(`/search?q=${encodeURIComponent(term)}`)
  }

  if (electricityStaff) {
    const staffLinks = [
      { labelKey: 'mobile.overview', href: '/electricity', icon: Gauge },
      { labelKey: 'mobile.alerts', href: '/electricity#attention', icon: Bolt },
      { labelKey: 'mobile.meters', href: '/electricity#meters', icon: Receipt },
    ] as const
    return (
      <nav aria-label="Electricity staff mobile navigation" className="mobile-bottom-navigation fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
          <MobileLink item={staffLinks[0]} active={pathname === '/electricity'} />
          <MobileLink item={staffLinks[1]} active={false} />
          <Link href="/electricity#record" className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-slate-600">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white"><Plus className="h-6 w-6" /></span>
            {t('mobile.read')}
          </Link>
          <MobileLink item={staffLinks[2]} active={false} />
          <button type="button" onClick={onOpenMenu} className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold text-slate-500" aria-label={t('header.openMenu')}>
            <Menu className="h-5 w-5" /><span>{t('mobile.more')}</span>
          </button>
        </div>
      </nav>
    )
  }

  return (
    <>
      <nav aria-label="Mobile navigation" className="mobile-bottom-navigation fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
          {primaryNavigation.slice(0, 2).map((item) => <MobileLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />)}
          <button type="button" onClick={() => setShowActions(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-slate-600" aria-label={t('mobile.quickActions')}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white"><Plus className="h-6 w-6" /></span>
            {t('mobile.add')}
          </button>
          {primaryNavigation.slice(2).map((item) => <MobileLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />)}
        </div>
      </nav>

      {showActions && (
        <div className="safe-area-top safe-area-bottom fixed inset-0 z-50 flex items-end overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t('mobile.quickActions')}>
          <button className="absolute inset-0" aria-label={t('mobile.closeQuickActions')} onClick={() => setShowActions(false)} />
          <div className="relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-lg bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-bold text-slate-950">{t('mobile.quickActions')}</h2><button onClick={() => setShowActions(false)} className="icon-button" aria-label={t('mobile.closeQuickActions')}><X className="h-5 w-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => <Link key={action.href} href={action.href} onClick={() => setShowActions(false)} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:border-primary-300 hover:bg-primary-50"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.tone}`}><action.icon className="h-5 w-5" /></span><span><span className="block text-sm font-semibold text-slate-900">{t(action.labelKey)}</span><span className="mt-0.5 block text-xs text-slate-500">{t(action.detailKey)}</span></span></Link>)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3"><button onClick={() => { setShowActions(false); setShowSearch(true) }} className="btn-secondary"><Search className="mr-2 h-4 w-4" />{t('mobile.search')}</button><button onClick={() => { setShowActions(false); onOpenMenu() }} className="btn-secondary"><Menu className="mr-2 h-4 w-4" />{t('mobile.allSections')}</button></div>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 p-4 safe-area-bottom safe-area-top" role="dialog" aria-modal="true" aria-label={t('mobile.searchKodiFlow')}>
          <div className="mx-auto max-w-lg"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">KodiFlow</p><h2 className="text-xl font-bold text-slate-950">{t('mobile.search')}</h2></div><button onClick={() => setShowSearch(false)} className="icon-button" aria-label={t('mobile.closeQuickActions')}><X className="h-5 w-5" /></button></div>
            <form onSubmit={submitSearch}><label htmlFor="mobile-global-search" className="sr-only">{t('mobile.searchHelp')}</label><div className="relative"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input ref={searchRef} id="mobile-global-search" value={query} onChange={(event) => setQuery(event.target.value)} className="input pl-10" placeholder={t('mobile.searchPlaceholder')} type="search" /><button className="btn-primary mt-3 w-full" type="submit">{t('mobile.searchKodiFlow')}</button></div></form>
            <p className="mt-5 text-sm text-slate-500">{t('mobile.searchHelp')}</p>
          </div>
        </div>
      )}
    </>
  )
}

function MobileLink({ item, active }: { item: { labelKey: TranslationKey; href: string; icon: LucideIcon }; active: boolean }) {
  const { t } = useLanguage()
  const Icon = item.icon
  return <Link href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? 'text-primary-700' : 'text-slate-500'}`}><Icon className="h-5 w-5" /><span>{t(item.labelKey)}</span></Link>
}
