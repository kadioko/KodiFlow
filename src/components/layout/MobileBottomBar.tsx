'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CreditCard, FilePlus2, FileText, LayoutDashboard, Menu, Plus, Receipt, Search, UserPlus, X } from 'lucide-react'

const primaryNavigation = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Invoices', href: '/invoices', icon: Receipt },
  { label: 'Payments', href: '/payments', icon: CreditCard },
  { label: 'Leases', href: '/leases', icon: FileText },
]

const quickActions = [
  { label: 'Record payment', detail: 'Apply a tenant payment', href: '/payments/new', icon: CreditCard, tone: 'bg-success-100 text-success-700' },
  { label: 'Generate invoices', detail: 'Create rent invoices', href: '/invoices/generate', icon: FilePlus2, tone: 'bg-primary-100 text-primary-700' },
  { label: 'Add tenant', detail: 'Create a tenant profile', href: '/tenants/new', icon: UserPlus, tone: 'bg-violet-100 text-violet-700' },
  { label: 'Create lease', detail: 'Assign a tenant to a unit', href: '/leases/new', icon: FileText, tone: 'bg-amber-100 text-amber-700' },
]

export function MobileBottomBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
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

  return (
    <>
      <nav aria-label="Mobile navigation" className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
          {primaryNavigation.slice(0, 2).map((item) => <MobileLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />)}
          <button type="button" onClick={() => setShowActions(true)} className="-mt-8 flex min-h-16 flex-col items-center justify-end gap-1 text-xs font-semibold text-slate-600" aria-label="Open quick actions">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 ring-4 ring-slate-50"><Plus className="h-7 w-7" /></span>
            Add
          </button>
          {primaryNavigation.slice(2).map((item) => <MobileLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />)}
        </div>
      </nav>

      {showActions && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Quick actions">
          <button className="absolute inset-0" aria-label="Close quick actions" onClick={() => setShowActions(false)} />
          <div className="safe-area-bottom relative w-full rounded-lg bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-bold text-slate-950">Quick actions</h2><button onClick={() => setShowActions(false)} className="icon-button" aria-label="Close quick actions"><X className="h-5 w-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => <Link key={action.href} href={action.href} onClick={() => setShowActions(false)} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:border-primary-300 hover:bg-primary-50"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.tone}`}><action.icon className="h-5 w-5" /></span><span><span className="block text-sm font-semibold text-slate-900">{action.label}</span><span className="mt-0.5 block text-xs text-slate-500">{action.detail}</span></span></Link>)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3"><button onClick={() => { setShowActions(false); setShowSearch(true) }} className="btn-secondary"><Search className="mr-2 h-4 w-4" />Search</button><button onClick={() => { setShowActions(false); onOpenMenu() }} className="btn-secondary"><Menu className="mr-2 h-4 w-4" />All sections</button></div>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="fixed inset-0 z-50 bg-slate-50 p-4 safe-area-bottom safe-area-top" role="dialog" aria-modal="true" aria-label="Search KodiFlow">
          <div className="mx-auto max-w-lg"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">KodiFlow</p><h2 className="text-xl font-bold text-slate-950">Search</h2></div><button onClick={() => setShowSearch(false)} className="icon-button" aria-label="Close search"><X className="h-5 w-5" /></button></div>
            <form onSubmit={submitSearch}><label htmlFor="mobile-global-search" className="sr-only">Search properties, tenants, units, or invoices</label><div className="relative"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input ref={searchRef} id="mobile-global-search" value={query} onChange={(event) => setQuery(event.target.value)} className="input pl-10" placeholder="Tenant, unit, property, invoice..." type="search" /><button className="btn-primary mt-3 w-full" type="submit">Search KodiFlow</button></div></form>
            <p className="mt-5 text-sm text-slate-500">Searches properties, tenants, units, and invoices. Use the quick actions menu to record payments or create records.</p>
          </div>
        </div>
      )}
    </>
  )
}

function MobileLink({ item, active }: { item: typeof primaryNavigation[number]; active: boolean }) {
  const Icon = item.icon
  return <Link href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? 'text-primary-700' : 'text-slate-500'}`}><Icon className="h-5 w-5" /><span>{item.label}</span></Link>
}
