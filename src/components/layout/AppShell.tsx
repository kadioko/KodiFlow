'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { MobileSidebar, Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { LoadingState, PageSkeleton } from '@/components/ui/LoadingState'

interface AppShellProps {
  children: React.ReactNode
}

const publicPrefixes = ['/auth']

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
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
      })
      .catch(() => {
        if (!mounted) return
        setUser(null)
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
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar user={user} />
        <MobileSidebar user={user} open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header user={user} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 safe-area-bottom sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
