'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { MobileSidebar, Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { LoadingState, PageSkeleton } from '@/components/ui/LoadingState'
import { MobileBottomBar } from '@/components/layout/MobileBottomBar'
import { useMobileViewport } from '@/components/layout/useMobileViewport'

type AppRole = 'none' | 'viewer' | 'property_manager' | 'accountant' | 'maintenance_manager' | 'admin' | 'super_admin'

interface AppShellProps {
  children: React.ReactNode
}

const publicPrefixes = ['/auth']

export function AppShell({ children }: AppShellProps) {
  useMobileViewport()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [adminRole, setAdminRole] = useState<AppRole>('none')
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isPublicPage = pathname === '/' || publicPrefixes.some((prefix) => pathname.startsWith(prefix))

  useEffect(() => {
    let mounted = true

    if (isPublicPage) {
      setLoading(false)
      return () => {
        mounted = false
      }
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 15000)

    fetch('/api/auth/session', {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((data) => {
        if (!mounted) return
        setUser(data.user ?? null)
        setAdminRole((data.adminRole ?? 'none') as AppRole)
      })
      .catch(() => {
        if (!mounted) return
        setUser(null)
        setAdminRole('none')
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        if (!mounted) return
        setLoading(false)
      })

    return () => {
      mounted = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [isPublicPage])

  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      window.location.replace(`/auth/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [isPublicPage, loading, pathname, user])

  if (isPublicPage) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 p-4 safe-area-top safe-area-bottom sm:p-6 lg:p-8">
        <PageSkeleton />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 p-4 safe-area-top safe-area-bottom sm:p-6">
        <LoadingState title="Sign in required" message="Taking you to the secure sign-in screen..." fullHeight />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="flex min-h-[100dvh] lg:h-[100dvh] lg:overflow-hidden">
        <Sidebar user={user} adminRole={adminRole} />
        <MobileSidebar user={user} adminRole={adminRole} open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
          <Header user={user} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
          <main id="main-content" className="mobile-page-content min-w-0 flex-1 p-4 sm:p-6 lg:overflow-y-auto lg:p-8">
            {children}
          </main>
          <MobileBottomBar onOpenMenu={() => setMobileMenuOpen(true)} />
        </div>
      </div>
    </div>
  )
}
