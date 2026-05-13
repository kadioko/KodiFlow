'use client'

import { User } from '@supabase/supabase-js'
import { Search, LogOut } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { NotificationManager } from '@/components/notifications/NotificationManager'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center flex-1">
        <form action="/search" className="max-w-lg w-full lg:max-w-xs">
          <label htmlFor="search" className="sr-only">Search</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="search"
              name="q"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Search properties, tenants..."
              type="search"
            />
          </div>
        </form>
      </div>

      <div className="flex items-center space-x-4">
        <NotificationManager />

        <div className="h-6 w-px bg-gray-200"></div>

        <button
          onClick={handleLogout}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <LogOut className="h-5 w-5 mr-1" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
