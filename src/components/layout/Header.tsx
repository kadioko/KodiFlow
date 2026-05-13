'use client'

import { User } from '@supabase/supabase-js'
import { Search, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { NotificationManager } from '@/components/notifications/NotificationManager'
import { BrandLogo } from '@/components/brand/BrandLogo'

interface HeaderProps {
  user: User
  dashboardVisible?: boolean
  onToggleDashboard?: () => void
  onOpenMobileMenu?: () => void
}

export function Header({ user, dashboardVisible = true, onToggleDashboard, onOpenMobileMenu }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/70 bg-white/85 px-4 shadow-sm backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="lg:hidden">
          <BrandLogo href="/dashboard" size="sm" tone="dark" priorityLabel="KodiFlow dashboard" />
        </div>
        {onToggleDashboard && (
          <button
            type="button"
            onClick={onToggleDashboard}
            className="hidden items-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:flex"
            title={dashboardVisible ? 'Hide dashboard navigation' : 'Show dashboard navigation'}
          >
            {dashboardVisible ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            <span className="ml-2 hidden xl:inline">{dashboardVisible ? 'Hide dashboard' : 'Show dashboard'}</span>
          </button>
        )}
        <form action="/search" className="hidden w-full max-w-xl md:block lg:max-w-md">
          <label htmlFor="search" className="sr-only">Search</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="search"
              name="q"
              className="block w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-2.5 pl-11 pr-4 text-sm leading-5 text-slate-800 shadow-inner placeholder:text-slate-400 outline-none transition-all focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
              placeholder="Search properties, tenants..."
              type="search"
            />
          </div>
        </form>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <NotificationManager />

        <div className="h-6 w-px bg-slate-200"></div>

        <button
          onClick={handleLogout}
          className="flex items-center rounded-xl px-2 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:px-3"
          aria-label="Logout"
        >
          <LogOut className="mr-0 h-5 w-5 sm:mr-1" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
